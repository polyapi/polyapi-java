package io.polyapi.client.api;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import io.polyapi.client.model.specification.ApiType;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VariableChangeEvent<T> {

  private Type type;
  private boolean secret;
  private String id;
  private T previousValue;
  private T currentValue;
  private long updateTime;
  private String updatedBy;
  private List<UpdatedField> updatedFields;

  public enum Type {
    UPDATE("update"),
    DELETE("delete");

    private final String jsonValue;

    Type(String jsonValue) {
      this.jsonValue = jsonValue;
    }

    @JsonValue
    public String jsonValue() {
      return this.jsonValue;
    }

    @JsonCreator
    public static Type fromJsonValue(String jsonValue) {
      for (Type type : Type.values()) {
        if (type.jsonValue.equalsIgnoreCase(jsonValue)) {
          return type;
        }
      }
      throw new IllegalArgumentException("Unexpected value '" + jsonValue + "'");
    }
  }

  public enum UpdatedField {
    VALUE("value"),
    SECRET("secret");

    private final String jsonValue;

    UpdatedField(String jsonValue) {
      this.jsonValue = jsonValue;
    }

    @JsonValue
    public String jsonValue() {
      return this.jsonValue;
    }

    @JsonCreator
    public static UpdatedField fromJsonValue(String jsonValue) {
      for (UpdatedField type : UpdatedField.values()) {
        if (type.jsonValue.equalsIgnoreCase(jsonValue)) {
          return type;
        }
      }
      throw new IllegalArgumentException("Unexpected value '" + jsonValue + "'");
    }
  }
}
