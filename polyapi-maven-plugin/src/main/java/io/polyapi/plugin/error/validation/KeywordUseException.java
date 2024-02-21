package io.polyapi.plugin.error.validation;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.stream.Collectors;

import static java.lang.String.format;

public class KeywordUseException extends ValidationException {
    public KeywordUseException(String propertyName, String propertyValue, Method method, String... keywords) {
        super(propertyName, format("Property '%s' with value '%s' of method '%s' uses Java keywords '%s'. Please rename the context accordingly.", "%s", propertyValue, method, Arrays.stream(keywords).collect(Collectors.joining("', '"))));
    }
}
