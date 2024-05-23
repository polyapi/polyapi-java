package io.polyapi.commons.api.error.http;

import io.polyapi.commons.api.http.Response;

/**
 * Exception thrown when there's a Bad Request (status code 400) response from the server.
 */
public class BadRequestException extends HttpResponseException {

    /**
     * Constructor that takes a message and the response returned.
     *
     * @param response The response.
     */
    public BadRequestException(Response response) {
        super("A Bad request status code was received. Please verify the input.", response);
    }
}
