package io.polyapi.client.api;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class OnUpdateOptions {
  private VariableChangeEvent.Type type;
  private Boolean secret;
}
