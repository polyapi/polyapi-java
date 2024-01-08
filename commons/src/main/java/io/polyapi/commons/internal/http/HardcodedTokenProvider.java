package io.polyapi.commons.internal.http;

import io.polyapi.commons.api.http.TokenProvider;

/**
 * {@link TokenProvider} that always return the same set token.
 *
 * @deprecated This class should be replaced for one that obtains the token dynamically and refreshes it.
 */
public class HardcodedTokenProvider implements TokenProvider {

  private final String token;

  public HardcodedTokenProvider(String token) {
    this.token = token;
  }

  @Override
  public String getToken() {
    return token;
  }
}
