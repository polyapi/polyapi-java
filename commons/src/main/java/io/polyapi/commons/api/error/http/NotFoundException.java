package io.polyapi.commons.api.error.http;

import io.polyapi.commons.api.http.Response;

/**
 * Exception thrown when there's a Not Found (status code 404) response from the server.
 */
public class NotFoundException extends HttpResponseException {

    /**
     * Constructor that takes a message and the response returned.
     *
     * @param response The response.
     */
    public NotFoundException(Response response) {
        super("The sought entity was not found.", response);
    }
}
