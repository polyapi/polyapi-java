package io.polyapi.plugin.model.specification.resolved;

import static java.lang.String.format;
import static java.util.function.Predicate.isEqual;
import static java.util.function.Predicate.not;
import static java.util.stream.Collectors.joining;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

import io.polyapi.plugin.model.generation.KeyValuePair;
import io.polyapi.plugin.utils.StringUtils;
import lombok.Getter;

@Getter
public class ResolvedFunctionSpecification extends ResolvedSpecification {
    private final String methodName;
    private final List<KeyValuePair<String, String>> arguments;
    private final String returnType;

    public ResolvedFunctionSpecification(ResolvedFunctionSpecification base) {
        this(base.getId(), base.getName(), base.getPackageName(), base.getImports(), base.getClassName(), base.methodName, base.arguments, base.returnType);
    }

    public ResolvedFunctionSpecification(String id, String name, String packageName, Set<String> imports, String className, String methodName, List<KeyValuePair<String, String>> arguments, String returnType) {
        super(id, name, packageName, imports, className);
        this.methodName = methodName;
        this.arguments = new ArrayList<>();
        Optional.ofNullable(arguments).ifPresent(this.arguments::addAll);
        this.returnType = returnType;
    }

    public String getReturnType() {
        String result = Optional.ofNullable(returnType)
                .map(String::trim)
                .filter(not(String::isBlank))
                .filter(not(isEqual(Void.class.getName())))
                .orElse("void");
        return result.equalsIgnoreCase(Object.class.getName()) ? "<T> T" : result;
    }

    public String getParamNames() {
        return toQuotedString(arguments.stream().map(KeyValuePair::key).map(StringUtils::toCamelCase));
    }

    public String getParamVariableNames() {
        return arguments.stream().map(KeyValuePair::key).map(StringUtils::toCamelCase).collect(joining(", "));
    }

    public String getParamTypes() {
        return toQuotedString(arguments.stream().map(KeyValuePair::value));
    }

    private String toQuotedString(Stream<String> valueStream) {
        return valueStream.map(value -> format("\"%s\"", value)).collect(joining(", "));
    }

    public String getMethodSignature() {
        return format("%s(%s)", methodName, arguments.stream().map(Object::toString).collect(joining(", ")));
    }

    public Boolean isReturnsValue() {
        return !getReturnType().equalsIgnoreCase("void");
    }
}
