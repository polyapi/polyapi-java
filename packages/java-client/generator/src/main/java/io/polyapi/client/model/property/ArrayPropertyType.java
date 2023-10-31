package io.polyapi.client.model.property;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ArrayPropertyType extends PropertyType {
  private PropertyType items;

  @Override
  public String getInCodeType() {
    return "java.util.List<" + items.getInCodeType() + ">";
  }
}
