package io.polyapi.client.api;

import java.util.Map;

@lombok.Setter
@lombok.Getter
public class ApiFunctionResponse<T> {
  private T data;
  private Map<String, String> headers;
  private int status;
}
