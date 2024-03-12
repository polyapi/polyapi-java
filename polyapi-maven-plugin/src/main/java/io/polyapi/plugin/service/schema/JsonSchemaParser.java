package io.polyapi.plugin.service.schema;

import com.sun.codemodel.JClass;
import com.sun.codemodel.JCodeModel;
import com.sun.codemodel.JType;
import io.polyapi.plugin.error.PolyApiMavenPluginException;
import io.polyapi.plugin.model.ParsedType;
import io.polyapi.plugin.model.generation.CustomType;
import io.polyapi.plugin.model.type.PolyType;
import io.polyapi.plugin.service.PolyCodeWriter;
import io.polyapi.plugin.service.PolyGenerationConfig;
import org.jsonschema2pojo.SchemaGenerator;
import org.jsonschema2pojo.SchemaMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import static java.util.stream.Collectors.toSet;

public class JsonSchemaParser {
    private static final Logger logger = LoggerFactory.getLogger(JsonSchemaParser.class);

    // FIXME: This whole JSon schema parsing needs:
    // FIXME: 1. More automated testing.
    // FIXME: 2. A refactor.
    public List<CustomType> parse(String defaultName, String packageName, String schema) {
        try {
            var codeModel = new JCodeModel();
            logger.trace("Generating Java code from JSon schema {}.", schema);

            // This cannot be put as an attribute of this class as it does not take well when being reused and has many errors.
            new SchemaMapper(new PolyRuleFactory(new PolyGenerationConfig()), new SchemaGenerator())
                    .generate(codeModel, defaultName, packageName, Optional.ofNullable(schema).orElse(""));
            logger.debug("Code generated. Writing to string.");
            try (var codeWriter = new PolyCodeWriter()) {
                codeModel.build(codeWriter);
                var result = codeWriter.getClasses();
                if (logger.isTraceEnabled()) {
                    result.forEach((String name, String code) -> logger.trace("Generated code for {} is: {}", name, code));
                }
                return result.entrySet().stream()
                        .map(entry -> new CustomType(packageName, entry.getKey(), entry.getValue()))
                        .toList();
            }
        } catch (IOException e) {
            //FIXME: Throw the appropriate exception
            throw new PolyApiMavenPluginException(e);
        }
    }

    public ParsedType getType(String defaultName, String packageName, String schema) {
        // This cannot be put as an attribute of this class as it does not take well when being reused and has many errors.
        try {
            return getType(new SchemaMapper(new PolyRuleFactory(new PolyGenerationConfig()), new SchemaGenerator())
                    .generate(new JCodeModel(), defaultName, packageName, Optional.ofNullable(schema).orElse(""))
                    .boxify());
        } catch (IOException e) {
            //FIXME: Throw the appropriate exception
            throw new PolyApiMavenPluginException(e);
        }
    }

    private ParsedType getType(JClass jClass) {
        return new ParsedType(jClass.erasure().fullName(), Optional.ofNullable(jClass.getTypeParameters())
                .orElseGet(ArrayList::new)
                .stream()
                .map(this::getType)
                .toList());
    }
}
