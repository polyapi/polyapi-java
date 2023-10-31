package io.polyapi.client.model.specification;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import io.polyapi.client.model.VisibilityMetadata;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonTypeInfo(
  use = JsonTypeInfo.Id.NAME,
  include = JsonTypeInfo.As.PROPERTY,
  property = "type"
)
@JsonSubTypes({
  @JsonSubTypes.Type(value = ApiFunctionSpecification.class, name = "apiFunction"),
  @JsonSubTypes.Type(value = CustomFunctionSpecification.class, name = "customFunction"),
  @JsonSubTypes.Type(value = ServerFunctionSpecification.class, name = "serverFunction"),
  @JsonSubTypes.Type(value = AuthFunctionSpecification.class, name = "authFunction"),
  @JsonSubTypes.Type(value = WebhookHandleSpecification.class, name = "webhookHandle"),
  @JsonSubTypes.Type(value = ServerVariableSpecification.class, name = "serverVariable"),
})
public class Specification {
  private String id;
  private String context;
  private String name;
  private String description;
  private VisibilityMetadata visibilityMetadata;

  public boolean isRootContext() {
    return getContext().isEmpty();
  }
}
