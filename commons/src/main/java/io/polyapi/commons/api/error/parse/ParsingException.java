package io.polyapi.commons.api.error.parse;

import io.polyapi.commons.api.error.PolyApiException;

/**
 * Parent exception of all the exceptions thrown when parsing to or from JSon.
 */
public class ParsingException extends PolyApiException {

  /**
   * @see PolyApiException#PolyApiException(String)
   */
  public ParsingException(String message) {
    super(message);
  }

  /**
   * @see PolyApiException#PolyApiException(String, Throwable)
   */
  public ParsingException(String message, Throwable cause) {
    super(message, cause);
  }
}
