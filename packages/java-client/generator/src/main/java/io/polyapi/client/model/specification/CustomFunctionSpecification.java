package io.polyapi.client.model.specification;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CustomFunctionSpecification extends Specification {
  private FunctionSpecification function;
  private String[] requirements;
  private String code;
}

