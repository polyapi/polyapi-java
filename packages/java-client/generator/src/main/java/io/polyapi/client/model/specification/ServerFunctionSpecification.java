package io.polyapi.client.model.specification;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ServerFunctionSpecification extends Specification {
  private FunctionSpecification function;
  private String[] requirements;
  private String code;
  private String language;
}
