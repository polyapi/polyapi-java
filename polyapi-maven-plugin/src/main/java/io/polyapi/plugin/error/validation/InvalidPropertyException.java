package io.polyapi.plugin.error.validation;

import java.lang.reflect.Method;

import static java.lang.String.format;

public class InvalidPropertyException extends ValidationException {
    public InvalidPropertyException(String propertyName, String propertyValue, Method method, String pattern) {
        super(propertyName, format("Property '%s' with value '%s' of method '%s' doesn't match pattern '%s'.", "%s", propertyValue, method, pattern));
    }
}
