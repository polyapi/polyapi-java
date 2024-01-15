package io.polyapi.plugin.model.property;

import com.fasterxml.jackson.databind.JsonNode;
import io.polyapi.plugin.model.specification.function.PropertyMetadata;
import lombok.Getter;
import lombok.Setter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;

import static java.lang.String.format;
import static java.util.function.Predicate.not;

@Getter
@Setter
public class ObjectPropertyType extends PropertyType {
    private static final Logger logger = LoggerFactory.getLogger(ObjectPropertyType.class);
    private JsonNode schema;
    private List<PropertyMetadata> properties;
    private String typeName;

    @Override
    public String getInCodeType() {
        if (typeName != null && !typeName.isEmpty()) {
            return typeName;
        }
        return "Object";
    }

    @Override
    public String getTypeSchema() {
        if (schema == null) {
            return null;
        }

        String result = schema.toString()
                // replace all > and < with underscores
                .replace(">", "_").replace("<", "_");

        // replace all dots with underscores, but only if they are within quotes
        boolean withinQuotes = false;
        StringBuilder sb = new StringBuilder();
        for (char c : result.toCharArray()) {
            if (c == '\"') {
                withinQuotes = !withinQuotes;
            }
            if (c == '.' && withinQuotes) {
                sb.append('_');
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    @Override
    public String getType(String defaultType) {
        return getType(schema, defaultType);
    }

    private String getType(JsonNode node, String defaultType) {
        if (Optional.ofNullable(node).map(Object::toString).filter(schema -> schema.trim().replace(" ", "").length() > 2).isPresent()) {
            return switch (Optional.ofNullable(node.get("type")).map(JsonNode::textValue).orElse("")) {
                case "array" ->
                        format("%s<%s>", List.class.getName(), getRefType(node, "", type -> getType(type, defaultType)));
                case "integer" -> Integer.class.getSimpleName();
                case "string" -> String.class.getSimpleName();
                case "number" -> Double.class.getSimpleName();
                case "boolean" -> Boolean.class.getSimpleName();
                default -> defaultType;
            };
        } else if (properties != null && !properties.isEmpty()) {
            return defaultType;
        } else {
            return getInCodeType();
        }
    }

    private String getRefType(JsonNode node, String packageName, Function<JsonNode, String> defaultProcessing) {
        return Optional.ofNullable(node.get("items"))
                .map(items -> items.get("$ref"))
                .map(JsonNode::textValue)
                .map(value -> value.replace("#/definitions/", packageName))
                .filter(not(String::isBlank))
                .orElseGet(() -> Optional.ofNullable(node.get("items")).map(defaultProcessing).orElse(null));
    }

    @Override
    public Set<String> getImports(String basePackage, String defaultType) {
        return getImports(schema, basePackage, defaultType);
    }

    private Set<String> getImports(JsonNode node, String basePackage, String defaultType) {
        if (Optional.ofNullable(node).map(Object::toString).filter(schema -> schema.trim().replace(" ", "").length() > 2).isPresent()) {
            return switch (Optional.ofNullable(node.get("type")).map(JsonNode::textValue).orElse("")) {
                case "array" ->
                        Optional.ofNullable(getRefType(node, format("%s.", basePackage), type -> getImports(type, basePackage, defaultType).stream().findFirst().orElse(null)))
                                .map(Set::of)
                                .orElseGet(Set::of);
                case "integer", "string", "number", "boolean" -> Set.of();
                default -> Set.of(format("%s.%s", basePackage, defaultType));
            };
        } else if (properties != null && !properties.isEmpty()) {
            return Set.of(format("%s.%s", basePackage, defaultType));
        } else {
            return Set.of();
        }
    }
}
