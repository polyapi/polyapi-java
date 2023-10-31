package io.polyapi.client.api;

import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class GetAuthTokenResponse {
  private String token;
  private String url;
  private String error;
}
