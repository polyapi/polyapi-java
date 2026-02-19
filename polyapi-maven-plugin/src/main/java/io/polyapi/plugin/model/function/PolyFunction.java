package io.polyapi.plugin.model.function;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.polyapi.commons.api.model.LifecycleState;
import io.polyapi.commons.api.model.Visibility;
import io.polyapi.plugin.model.specification.SchemaRef;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static java.lang.String.format;
import static java.util.stream.Collectors.joining;

@JsonInclude(JsonInclude.Include.NON_NULL)
@Getter
@Setter
@ToString
public class PolyFunction {
    private String id;
    private String context;
    private String name;
    private String contextName;
    private String description;
    private String sourceCode; // Only used when deploying a function
    private String code;
    private String language = "java";
    private String returnType;
    private Visibility visibility;
    private LifecycleState state;
    private Boolean logsEnabled;
    private List<String> requirements;
    private String ownerUserId;

    private Map<String, Object> returnTypeSchema;
    private List<PolyFunctionArgument> arguments;

    private List<ReturnType> otherReturnTypes;
    private List<SchemaRef> unresolvedReturnTypePolySchemaRefs;

    /**
     * Gets the signature of this function in the form of functionName(ArgClass, ArgClass2...).
     *
     * @return String The signature of this function.
     */
    public String getSignature() {
        return format("%s(%s)", name, Optional.ofNullable(arguments).orElseGet(ArrayList::new).stream()
                .map(PolyFunctionArgument::getType)
                .collect(joining(", ")));
    }
}
