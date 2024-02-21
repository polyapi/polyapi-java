package io.polyapi.client.internal.proxy;

import io.polyapi.client.internal.service.InvocationService;
import io.polyapi.client.api.model.PolyEntity;
import org.junit.jupiter.api.Test;
import org.powermock.api.mockito.PowerMockito;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.hamcrest.CoreMatchers.equalTo;
import static org.hamcrest.CoreMatchers.instanceOf;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class PolyProxyFactoryTest {
    private static final Logger logger = LoggerFactory.getLogger(PolyProxyFactoryTest.class);
    private static final String DEFAULT_STRING = "DEFAULT_STRING";

    @Test
    public void createProxyTest() throws Throwable {
        String entityId = MockPolyServerFunction.class.getAnnotation(PolyEntity.class).value();
        logger.debug("Mock object ID: {}", entityId);
        logger.debug("Mocking InvocationHandler.");
        var serviceMock = PowerMockito.mock(InvocationService.class);
        when(serviceMock.invokeServerFunction(eq(MockPolyServerFunction.class), eq(entityId), anyMap(), eq(String.class))).thenReturn(DEFAULT_STRING);
        logger.debug("Creating PolyProxyFactory with mock.");
        var factory = new PolyProxyFactory(serviceMock);
        logger.debug("Creating proxy for {}.", MockPolyServerFunction.class.getSimpleName());
        var proxy = factory.createServerFunctionProxy(MockPolyServerFunction.class);
        logger.debug("Proxy created.");
        assertThat(proxy, instanceOf(MockPolyServerFunction.class));
        assertThat(proxy.doMagic(DEFAULT_STRING), equalTo(DEFAULT_STRING));
        verify(serviceMock).invokeServerFunction(eq(MockPolyServerFunction.class), eq(entityId), eq(Map.of("parameter", DEFAULT_STRING)), eq(String.class));
    }
}
