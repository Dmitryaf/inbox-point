package com.inboxpoint.vk;

import java.io.IOException;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class VkLongPollEventTest {
    @Test
    void validatesMixedEnvelopesAndParsesOnlyNewMessages() throws Exception {
        var update = JsonMapper.shared().readTree("""
                [
                  {"group_id":1,"type":"message_allow","object":{"user_id":2}},
                  {"group_id":1,"type":"message_reply","object":{"reply":"value"}},
                  {"group_id":1,"type":"message_new","object":{"message":{"id":7,"date":1000,"peer_id":2,"from_id":2,"text":"Hello"}}},
                  {"group_id":1,"type":"message_new","object":{"message":{"text":"Incomplete"}}}
                ]
                """);
        for (var event : update) {
            assertThat(VkApiClient.isEvent(event)).isTrue();
        }
        assertThat(VkChannel.messageNew(update.get(2)).path("text").asString()).isEqualTo("Hello");
        assertThatThrownBy(() -> VkChannel.messageNew(update.get(3))).isInstanceOf(IOException.class);
    }
}
