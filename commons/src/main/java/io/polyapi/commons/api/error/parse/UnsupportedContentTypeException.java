package io.polyapi.commons.api.error.parse;

import java.lang.reflect.Type;

/**
 * Exception thrown when the content type of the response is not supported or tye type expected by the caller doesn't match the type of the response.
 */
public class UnsupportedContentTypeException extends ParsingException {
    public UnsupportedContentTypeException(String contentType, Type type) {
        super("Unsupported content type '" + contentType + "' for response type " + type + ".");
    }
}
