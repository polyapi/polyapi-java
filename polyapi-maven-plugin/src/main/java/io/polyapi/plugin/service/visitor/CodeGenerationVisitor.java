package io.polyapi.plugin.service.visitor;

import io.polyapi.commons.api.json.JsonParser;
import io.polyapi.commons.api.service.file.FileService;
import io.polyapi.plugin.model.CustomType;
import io.polyapi.plugin.model.Generable;
import io.polyapi.plugin.model.function.CodeObject;
import io.polyapi.plugin.model.property.PropertyType;
import io.polyapi.plugin.model.property.VoidPropertyType;
import io.polyapi.plugin.model.specification.Context;
import io.polyapi.plugin.model.specification.Specification;
import io.polyapi.plugin.model.specification.function.CustomFunctionSpecification;
import io.polyapi.plugin.model.specification.function.FunctionSpecification;
import io.polyapi.plugin.model.specification.function.PropertyMetadata;
import io.polyapi.plugin.model.specification.variable.ServerVariableSpecification;
import io.polyapi.plugin.service.schema.JsonSchemaParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import static java.lang.String.format;
import static java.util.function.Predicate.not;
import static java.util.stream.IntStream.range;

public class CodeGenerationVisitor implements PolyVisitor {
    private static final Logger logger = LoggerFactory.getLogger(CodeGenerationVisitor.class);

    private final FileService fileService;
    private final JsonSchemaParser jsonSchemaParser;
    private final JsonParser jsonParser;

    public CodeGenerationVisitor(FileService fileService, JsonParser jsonParser, JsonSchemaParser jsonSchemaParser) {
        this.fileService = fileService;
        this.jsonParser = jsonParser;
        this.jsonSchemaParser = jsonSchemaParser;
    }

    private void generate(Generable generable) {
        generate(generable, generable.getClass().getSimpleName());
    }

    private void generate(Generable generable, String template) {
        logger.debug("Attempting to write {} with template {} on package {}.", generable.getClassName(), template, generable.getPackageName());
        fileService.createClassFile(generable.getPackageName(), generable.getClassName(), template, generable);
    }

    @Override
    public void visit(Specification specification) {
        logger.debug("Generating code for {}", specification.getName());
        generate(specification);
    }

    @Override
    public void visit(FunctionSpecification specification) {
        visit((Specification) specification);

        logger.debug("Generating classes for {} function return type.", specification.getName());
        var functionMetadata = specification.getFunction();
        Optional.ofNullable(functionMetadata.getReturnType())
                .filter(not(VoidPropertyType.class::isInstance))
                .ifPresent(type -> generate(specification.getClassName() + "Response", specification.getPackageName(), type));
        logger.debug("Generating classes for {} function arguments.", specification.getName());
        List<PropertyMetadata> arguments = Optional.ofNullable(functionMetadata.getArguments()).orElseGet(ArrayList::new);
        range(0, arguments.size()).forEach(i -> generate(format("%sArgument%s", specification.getClassName(), i), specification.getPackageName(), arguments.get(i).getType()));
    }

    private void generate(String defaultName, String packageName, PropertyType propertyType) {
        Optional.of(propertyType)
                .filter(type -> Objects.nonNull(type.getTypeSchema()))
                .map(type -> jsonSchemaParser.parse(defaultName, packageName, type))
                .stream()
                .flatMap(List::stream)
                .forEach(type -> type.accept(this));
    }

    @Override
    public void visit(CustomFunctionSpecification specification) {
        if (specification.isJava()) {
            visit((FunctionSpecification) specification);
            CodeObject codeObject = Optional.of(specification.getCode())
                    .map(String::trim)
                    .filter(code -> code.startsWith("{"))
                    .map(code -> jsonParser.<CodeObject>parseString(specification.getCode(), CodeObject.class))
                    .orElseGet(() -> {
                        CodeObject result = new CodeObject();
                        result.setCode(specification.getCode().replace("PolyCustomFunction", specification.getClassName()));
                        result.setClassName(specification.getClassName());
                        return result;
                    });
            codeObject.setPackageName(format("%s.delegate", specification.getPackageName()));
            new CustomType(codeObject.getPackageName(), codeObject.getClassName(), format("package %s;\n%s", codeObject.getPackageName(), codeObject.getCode().trim().startsWith("package ") ? codeObject.getCode().substring(codeObject.getCode().indexOf(';') + 1) : codeObject.getCode())).accept(this);
        }
    }

    @Override
    public void visit(ServerVariableSpecification specification) {
        fileService.createClassFile(specification.getPackageName(), format("%sHandler", specification.getClassName()), specification.getClass().getSimpleName(), specification);
        jsonSchemaParser.parse(specification.getClassName(), specification.getPackageName(), specification.getVariable().getValueType()).forEach(customType -> customType.accept(this));
    }

    @Override
    public void visit(Context context) {
        if (context.getParent() == null) {
            generate(context, context.getClassName());
        } else {
            generate(context);
        }
        context.getSubcontexts().forEach(subcontext -> subcontext.accept(this));
        context.getSpecifications().forEach(specification -> specification.accept(this));
    }

    @Override
    public void visit(CustomType customType) {
        generate(customType);
    }
}
