package io.polyapi.commons.api.error.http;

import io.polyapi.commons.api.http.Response;

/**
 * Exception thrown when there's a Request Timeout (status code 408) response from the server.
 */
public class RequestTimeoutException extends HttpResponseException {

    /**
     * Constructor that takes a message and the response returned.
     *
     * @param response The response.
     */
    public RequestTimeoutException(Response response) {
        super("Server is taking longer than the expected amount. Please retry later.", response);
    }
}
