package io.polyapi.commons.api.error.http;

import io.polyapi.commons.api.http.Response;

/**
 * Exception thrown when there's a Not Acceptable (status code 406) response from the server.
 */
public class NotAcceptableException extends HttpResponseException {

    /**
     * Constructor that takes a message and the response returned.
     *
     * @param response The response.
     */
    public NotAcceptableException(Response response) {
        super("Request indicates that the accept header is not of the same type as the returned one from the server.", response);
    }
}
