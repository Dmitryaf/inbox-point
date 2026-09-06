package com.inboxpoint.operations;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class ProtectedRouteHeadersTest {
    @Test
    void protectsEveryOwnerSurfaceWhenAQueryIsPresent() throws Exception {
        for (String path : new String[]{"/setup", "/manage", "/ops", "/api/ops/status", "/api/manage/content"}) {
            var request = new MockHttpServletRequest("GET", path);
            request.setQueryString("reload=1");
            var response = new MockHttpServletResponse();
            new ProtectedRouteHeaders().doFilter(request, response, new MockFilterChain());
            assertThat(response.getHeader("Cache-Control")).isEqualTo("no-store");
            assertThat(response.getHeader("X-Frame-Options")).isEqualTo("DENY");
        }
        var ordinary = new MockHttpServletResponse();
        new ProtectedRouteHeaders().doFilter(new MockHttpServletRequest("GET", "/health"),
                ordinary, new MockFilterChain());
        assertThat(ordinary.getHeader("Cache-Control")).isNull();
    }
}
