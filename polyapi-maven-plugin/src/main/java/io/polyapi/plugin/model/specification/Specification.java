package io.polyapi.plugin.model.specification;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import io.polyapi.plugin.model.Generable;
import io.polyapi.plugin.model.VisibilityMetadata;
import io.polyapi.plugin.model.specification.function.ApiFunctionSpecification;
import io.polyapi.plugin.model.specification.function.AuthFunctionSpecification;
import io.polyapi.plugin.model.specification.function.CustomFunctionSpecification;
import io.polyapi.plugin.model.specification.function.ServerFunctionSpecification;
import io.polyapi.plugin.model.specification.function.WebhookHandleSpecification;
import io.polyapi.plugin.model.specification.variable.ServerVariableSpecification;
import io.polyapi.plugin.service.visitor.CodeGenerationVisitor;
import io.polyapi.plugin.service.visitor.PolyVisitor;
import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

import static java.lang.String.format;
import static java.util.function.Predicate.not;
import static java.util.stream.Collectors.joining;

@Getter
@Setter
@JsonTypeInfo(
        use = JsonTypeInfo.Id.NAME,
        property = "type",
        visible = true
)
@JsonSubTypes({
        @JsonSubTypes.Type(value = ApiFunctionSpecification.class, name = "apiFunction"),
        @JsonSubTypes.Type(value = CustomFunctionSpecification.class, name = "customFunction"),
        @JsonSubTypes.Type(value = ServerFunctionSpecification.class, name = "serverFunction"),
        @JsonSubTypes.Type(value = AuthFunctionSpecification.class, name = "authFunction"),
        @JsonSubTypes.Type(value = WebhookHandleSpecification.class, name = "webhookHandle"),
        @JsonSubTypes.Type(value = ServerVariableSpecification.class, name = "serverVariable"),
})
public abstract class Specification implements Generable {
    private String id;
    private String type;
    private String context;
    private String name;
    private String description;
    private VisibilityMetadata visibilityMetadata;

    @Override
    public String getPackageName() {
        return format("io.polyapi.%s",
                Stream.of(getTypePackage(), Optional.ofNullable(context).orElse(""))
                        .filter(not(String::isBlank))
                        .map(String::toLowerCase)
                        .collect(joining(".")));
    }

    protected abstract String getTypePackage();

    @Override
    public void accept(PolyVisitor visitor) {
        visitor.visit(this);
    }

    public abstract Set<String> getImports();

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
