package io.polyapi.client.model.specification;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AuthFunctionSpecification extends Specification {
  private FunctionSpecification function;
  private String subResource;

  public boolean isAudienceRequired() {
    return function.getArguments().stream().anyMatch(argument -> argument.getName().equals("audience"));
  }
}

