package io.polyapi.client.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;

@Getter
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonPropertyOrder({
  "type",
  "id",
  "path"
})
public final class InjectedVariable {
  @JsonProperty("type")
  private final String type = "PolyVariable";
  @JsonProperty("id")
  private final String id;
  @JsonProperty("path")
  private final String path;

  public InjectedVariable(String id, String path) {
    this.id = id;
    this.path = path;
  }
}
