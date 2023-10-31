package io.polyapi.client.api;

import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class AuthTokenOptions {
  private String callbackUrl;
  private Integer timeout;
  private String audience;
  private Boolean autoCloseOnToken;
  private Boolean autoCloseOnUrl;
  private String userId;
}
