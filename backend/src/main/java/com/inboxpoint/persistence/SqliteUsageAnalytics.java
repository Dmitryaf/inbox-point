package com.inboxpoint.persistence;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Repository;

@Repository
public final class SqliteUsageAnalytics {
    private static final Totals ZERO = new Totals(0, 0);
    private static final String FILTERED = """
            WITH filtered AS (
                SELECT id, event_type, channel, occurred_at, action_key, action_label
                FROM usage_events
                WHERE occurred_at >= ? AND occurred_at <= ? AND (? IS NULL OR channel = ?)
                    AND event_type IN ('new_request', 'menu_action')
            )
            """;
    private final Path database;

    public SqliteUsageAnalytics(Environment environment) {
        database = Path.of(environment.getProperty("DATABASE_PATH", "./data/inbox-point.sqlite"));
    }

    public Report report(int days, String channel, Instant observedAt) throws SQLException {
        var firstDay = LocalDate.ofInstant(observedAt, ZoneOffset.UTC).minusDays(days - 1);
        var since = SqliteDatabase.timestamp(firstDay.atStartOfDay().toInstant(ZoneOffset.UTC));
        var until = SqliteDatabase.timestamp(observedAt);
        var filter = "all".equals(channel) ? null : channel;
        var byDate = new HashMap<String, Totals>();
        var byChannel = new HashMap<>(Map.of("telegram", ZERO, "vk", ZERO));
        String lastRequestAt = null;
        try (var connection = SqliteDatabase.openExisting(database, true)) {
            connection.setAutoCommit(false);
            try (var statement = filtered(connection, since, until, filter, """
                    SELECT substr(occurred_at, 1, 10) AS day, channel,
                        SUM(event_type = 'new_request') AS requests, SUM(event_type = 'menu_action') AS menu_actions,
                        MAX(CASE WHEN event_type = 'new_request' THEN occurred_at END) AS last_request
                    FROM filtered GROUP BY day, channel
                    """); var rows = statement.executeQuery()) {
                while (rows.next()) {
                    var totals = new Totals(rows.getLong("requests"), rows.getLong("menu_actions"));
                    byDate.merge(rows.getString("day"), totals, Totals::add);
                    byChannel.merge(rows.getString("channel"), totals, Totals::add);
                    var candidate = rows.getString("last_request");
                    if (candidate != null && (lastRequestAt == null || candidate.compareTo(lastRequestAt) > 0)) {
                        lastRequestAt = candidate;
                    }
                }
            }
            var actions = actions(connection, since, until, filter);
            connection.commit();
            var daily = new ArrayList<Day>(days);
            for (int index = 0; index < days; index++) {
                var date = firstDay.plusDays(index).toString();
                var totals = byDate.getOrDefault(date, ZERO);
                daily.add(new Day(date, totals.requests(), totals.menuActions()));
            }
            var summary = byChannel.get("telegram").add(byChannel.get("vk"));
            return new Report(Map.copyOf(byChannel), List.copyOf(actions), List.copyOf(daily), lastRequestAt,
                    summary, days + "d", channel, since, until, "UTC");
        }
    }

    private static List<Action> actions(Connection connection, String since, String until, String channel) throws SQLException {
        var actions = new ArrayList<Action>();
        try (var statement = filtered(connection, since, until, channel, """
                , menu AS (
                    SELECT action_key, action_label, channel,
                        ROW_NUMBER() OVER (PARTITION BY action_key ORDER BY occurred_at DESC, id DESC) AS latest
                    FROM filtered WHERE event_type = 'menu_action'
                )
                SELECT action_key, MAX(CASE WHEN latest = 1 THEN action_label END) AS label,
                    COUNT(*) AS count, SUM(channel = 'telegram') AS telegram, SUM(channel = 'vk') AS vk
                FROM menu GROUP BY action_key ORDER BY count DESC, label, action_key
                """); var rows = statement.executeQuery()) {
            while (rows.next()) {
                actions.add(new Action(rows.getString("action_key"), rows.getString("label"), rows.getLong("count"),
                        rows.getLong("telegram"), rows.getLong("vk")));
            }
        }
        return actions;
    }

    private static PreparedStatement filtered(Connection connection, String since, String until, String channel, String query)
            throws SQLException {
        var statement = connection.prepareStatement(FILTERED + query);
        statement.setString(1, since);
        statement.setString(2, until);
        statement.setString(3, channel);
        statement.setString(4, channel);
        return statement;
    }

    public record Report(Map<String, Totals> channels, List<Action> actions, List<Day> daily, String lastRequestAt,
            Totals summary, String period, String channel, String recordedSince, String observedAt, String timeZone) { }

    public record Totals(long requests, long menuActions) {
        private Totals add(Totals other) {
            return new Totals(requests + other.requests, menuActions + other.menuActions);
        }
    }

    public record Action(String key, String label, long count, long telegram, long vk) { }

    public record Day(String date, long requests, long menuActions) { }
}
