package com.inboxpoint.handoff;

import java.io.IOException;
import java.sql.SQLException;

import com.inboxpoint.persistence.SqliteTextHandoff.ClientText;
import com.inboxpoint.persistence.SqliteTextHandoff.NativeOperatorText;
import com.inboxpoint.persistence.SqliteTextHandoff.Request;

public interface OperatorHandoff {
    void relayClientText(ClientText text) throws IOException, SQLException, InterruptedException;

    void mirrorNativeReply(Request request, NativeOperatorText text) throws IOException, SQLException, InterruptedException;
}
