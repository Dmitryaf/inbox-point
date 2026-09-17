package com.inboxpoint.vk;

import java.io.IOException;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class VkLongPollEventTest {
    @Test
    void separatesNativeStaffRepliesFromApiMessages() {
        var message = tools.jackson.databind.json.JsonMapper.shared().createObjectNode()
                .put("date", 1000).put("admin_author_id", 123).put("text", "From VK").put("random_id", 0);
        assertThat(VkChannel.nativeReply("native", 2, 7, message)).isNotNull();
        message.put("random_id", 9);
        assertThat(VkChannel.nativeReply("native", 2, 7, message)).isNotNull();
        message.remove("admin_author_id");
        assertThat(VkChannel.nativeReply("native", 2, 7, message)).isNull();
    }

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
