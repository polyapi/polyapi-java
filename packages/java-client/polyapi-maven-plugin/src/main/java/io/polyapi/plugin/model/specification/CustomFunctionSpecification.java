package io.polyapi.plugin.model.specification;

import io.polyapi.plugin.utils.StringUtils;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CustomFunctionSpecification extends Specification {
  private FunctionSpecification function;
  private String[] requirements;
  private String code;
  private String language;

  public String getClassName() {
    return StringUtils.toPascalCase(getName()) + "$CustomFunction";
  }

  public boolean isJava() {
    return "java".equals(language);
  }
}

