package io.polyapi.client.internal.service;

import io.polyapi.client.api.ApiFunctionResponse;

import java.lang.reflect.Type;
import java.util.Map;

public interface InvocationService {

    <T> T invokeServerFunction(Class<?> invokingClass, String id, Map<String, Object> body, Type expectedResponseType);

    <T> ApiFunctionResponse<T> invokeApiFunction(Class<?> invokingClass, String id, Map<String, Object> body, Type expectedResponseType);

    <T> T invokeCustomFunction(Class<?> invokingClass, String id, Map<String, Object> body, Type expectedResponseType);

    Void invokeAuthFunction(Class<?> invokingClass, String id, Map<String, Object> body, Type expectedResponseType);

    Void invokeSubresourceAuthFunction(Class<?> invokingClass, String id, Map<String, Object> body, Type expectedResponseType);

    <T> T getVariable(String id, Type type);

    <T> void updateVariable(String id, T entity);

}
