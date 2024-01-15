package io.polyapi.plugin.service.visitor;

import io.polyapi.commons.api.service.file.FileService;
import io.polyapi.plugin.model.CustomType;
import io.polyapi.plugin.model.Generable;
import io.polyapi.plugin.model.property.VoidPropertyType;
import io.polyapi.plugin.model.specification.Context;
import io.polyapi.plugin.model.specification.Specification;
import io.polyapi.plugin.model.specification.function.CustomFunctionSpecification;
import io.polyapi.plugin.model.specification.function.FunctionSpecification;
import io.polyapi.plugin.model.specification.variable.ServerVariableSpecification;
import io.polyapi.plugin.service.JsonSchemaParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Stream;

import static io.polyapi.plugin.utils.StringUtils.toPascalCase;
import static java.lang.String.format;
import static java.util.function.Predicate.not;
import static java.util.stream.IntStream.range;
import static java.util.stream.Stream.concat;

public class CodeGenerationVisitor implements PolyVisitor {
    private static final Logger logger = LoggerFactory.getLogger(CodeGenerationVisitor.class);

    private final FileService fileService;
    private final JsonSchemaParser jsonSchemaParser;

    public CodeGenerationVisitor(FileService fileService, JsonSchemaParser jsonSchemaParser) {
        this.fileService = fileService;
        this.jsonSchemaParser = jsonSchemaParser;
    }

    private void generate(Generable generable) {
        generate(generable, generable.getClass().getSimpleName());
    }

    private void generate(Generable generable, String template) {
        logger.info("Writing {} with template {} on package {}.", generable.getClassName(), template, generable.getPackageName());
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

        logger.info("Generating class for {} function return type.", specification.getName());
        var functionMetadata = specification.getFunction();
        Optional.ofNullable(functionMetadata.getReturnType())
                .filter(not(VoidPropertyType.class::isInstance))
                .filter(returnType -> Objects.nonNull(returnType.getTypeSchema()))
                .map(returnType -> concat(
                        jsonSchemaParser.parse(format("%sResponse", specification.getClassName()), specification.getPackageName(), functionMetadata.getReturnType()).stream(),
                        range(0, Optional.ofNullable(functionMetadata.getArguments()).orElseGet(ArrayList::new).size())
                                .boxed()
                                .map(i -> jsonSchemaParser.parse(
                                        format("%s$%s", specification.getClassName(), toPascalCase(functionMetadata.getArguments().get(i).getName())),
                                        specification.getPackageName(),
                                        functionMetadata.getArguments().get(i).getType()
                                ))
                                .flatMap(List::stream)
                )
                ).orElseGet(Stream::of)
                .forEach(this::generate);
    }

    @Override
    public void visit(CustomFunctionSpecification specification) {
        if (specification.isJava()) {
            visit((FunctionSpecification) specification);
            new CustomType(specification.getPackageName(), format("%sDelegate", specification.getClassName()), specification.getCode()).accept(this);
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
