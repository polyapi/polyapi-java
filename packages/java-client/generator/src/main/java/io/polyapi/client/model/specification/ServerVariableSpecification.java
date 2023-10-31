package io.polyapi.client.model.specification;

import io.polyapi.client.utils.StringUtils;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ServerVariableSpecification extends Specification {
  private VariableSpecification variable;

  public String getClassName() {
    return StringUtils.toPascalCase(getName());
  }
}
