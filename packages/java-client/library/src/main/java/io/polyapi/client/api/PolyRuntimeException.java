package io.polyapi.client.api;

public class PolyRuntimeException extends RuntimeException {
  public PolyRuntimeException() {
  }

  public PolyRuntimeException(String message) {
    super(message);
  }

  public PolyRuntimeException(String message, Throwable cause) {
    super(message, cause);
  }

  public PolyRuntimeException(Throwable cause) {
    super(cause);
  }

  public PolyRuntimeException(String message, Throwable cause, boolean enableSuppression, boolean writableStackTrace) {
    super(message, cause, enableSuppression, writableStackTrace);
  }
}
