package io.polyapi.client.model.property;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

@JsonTypeInfo(
  use = JsonTypeInfo.Id.NAME,
  include = JsonTypeInfo.As.PROPERTY,
  property = "kind"
)
@JsonSubTypes({
  @JsonSubTypes.Type(value = VoidPropertyType.class, name = "void"),
  @JsonSubTypes.Type(value = PrimitivePropertyType.class, name = "primitive"),
  @JsonSubTypes.Type(value = ArrayPropertyType.class, name = "array"),
  @JsonSubTypes.Type(value = ObjectPropertyType.class, name = "object"),
  @JsonSubTypes.Type(value = FunctionPropertyType.class, name = "function"),
  @JsonSubTypes.Type(value = PlainPropertyType.class, name = "plain")
})
public abstract class PropertyType {

  public String getInCodeType() {
    return "Object";
  }
}
