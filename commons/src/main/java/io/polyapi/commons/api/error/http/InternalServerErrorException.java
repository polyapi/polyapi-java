package io.polyapi.commons.api.error.http;

import io.polyapi.commons.api.http.Response;

/**
 * Exception thrown when there's an Internal Server Error (status code 500) response from the server.
 */
public class InternalServerErrorException extends HttpResponseException {

    /**
     * Constructor that takes a message and the response returned.
     *
     * @param response The response.
     */
    public InternalServerErrorException(Response response) {
        super("An internal error occurred on the server. Please contact an administrator.", response);
    }
}
