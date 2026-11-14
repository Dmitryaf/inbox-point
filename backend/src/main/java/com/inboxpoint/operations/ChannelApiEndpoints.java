package com.inboxpoint.operations;

import java.net.URI;

record ChannelApiEndpoints(URI telegram, URI vk) {
    static ChannelApiEndpoints production() {
        return new ChannelApiEndpoints(URI.create("https://api.telegram.org"), URI.create("https://api.vk.com"));
    }
}
