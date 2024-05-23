package io.polyapi.plugin.model.specification;

import static io.polyapi.plugin.utils.StringUtils.toPascalCase;
import static java.lang.String.format;
import static java.util.function.Predicate.not;
import static java.util.stream.Collectors.joining;

import java.util.Objects;
import java.util.Optional;
import java.util.stream.Stream;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import io.polyapi.plugin.model.specification.function.ApiFunctionSpecification;
import io.polyapi.plugin.model.specification.function.AuthFunctionSpecification;
import io.polyapi.plugin.model.specification.function.CustomFunctionSpecification;
import io.polyapi.plugin.model.specification.function.ServerFunctionSpecification;
import io.polyapi.plugin.model.specification.variable.ServerVariableSpecification;
import io.polyapi.plugin.model.specification.webhook.WebhookHandleSpecification;
import io.polyapi.plugin.model.visitor.PolySpecificationVisitor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonTypeInfo(
        use = JsonTypeInfo.Id.NAME,
        property = "type",
        visible = true,
        defaultImpl = IgnoredSpecification.class
)
@JsonSubTypes({
        @JsonSubTypes.Type(value = ApiFunctionSpecification.class, name = "apiFunction"),
        @JsonSubTypes.Type(value = CustomFunctionSpecification.class, name = "customFunction"),
        @JsonSubTypes.Type(value = ServerFunctionSpecification.class, name = "serverFunction"),
        @JsonSubTypes.Type(value = AuthFunctionSpecification.class, name = "authFunction"),
        @JsonSubTypes.Type(value = WebhookHandleSpecification.class, name = "webhookHandle"),
        @JsonSubTypes.Type(value = ServerVariableSpecification.class, name = "serverVariable")
})
public abstract class Specification {
    private String id;
    private String type;
    private String context;
    private String name;
    private String description;
    private VisibilityMetadata visibilityMetadata;

    public abstract String getSpecificationType();

    public void accept(PolySpecificationVisitor visitor) {
        visitor.visit(this);
    }

    public String getPackageName() {
        return format("io.polyapi.%s.%s",
                Stream.of(getSpecificationType(), Optional.ofNullable(context).orElse(""))
                        .filter(not(String::isBlank))
                        .map(String::toLowerCase)
                        .collect(joining(".")),
                name.toLowerCase());
    }

    public String getClassName() {
        return toPascalCase(name);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Specification that)) return false;
        return Objects.equals(context, that.context) && Objects.equals(name, that.name);
    }

    @Override
    public int hashCode() {
        return Objects.hash(context, name);
    }
}
