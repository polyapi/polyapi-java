package io.polyapi.client.model.specification;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ApiFunctionSpecification extends Specification {
  private FunctionSpecification function;
  private ApiType apiType;
}
