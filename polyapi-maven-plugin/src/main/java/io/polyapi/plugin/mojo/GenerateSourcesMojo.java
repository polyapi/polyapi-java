package io.polyapi.plugin.mojo;


import io.polyapi.commons.api.service.file.FileService;
import io.polyapi.commons.internal.file.FileServiceImpl;
import io.polyapi.plugin.model.specification.Context;
import io.polyapi.plugin.model.specification.Specification;
import io.polyapi.plugin.model.specification.function.CustomFunctionSpecification;
import io.polyapi.plugin.model.specification.function.FunctionSpecification;
import io.polyapi.plugin.model.specification.variable.ServerVariableSpecification;
import io.polyapi.plugin.service.SpecificationServiceImpl;
import io.polyapi.plugin.service.schema.JsonSchemaParser;
import io.polyapi.plugin.service.template.PolyHandlebars;
import io.polyapi.plugin.service.visitor.CodeGenerationVisitor;
import lombok.Setter;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.util.HashMap;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

import static java.lang.String.format;
import static java.util.function.Predicate.not;

@Mojo(name = "generate-sources")
@Setter
public class GenerateSourcesMojo extends PolyApiMojo {
    private static final Logger logger = LoggerFactory.getLogger(GenerateSourcesMojo.class);
    private FileService fileService;
    private JsonSchemaParser jsonSchemaParser;

    @Parameter(property = "overwrite", defaultValue = "false")
    private Boolean overwrite;

    @Parameter(property = "context")
    private String context;


    @Override
    public void execute(String host, Integer port) {
        this.fileService = new FileServiceImpl(new PolyHandlebars(), overwrite);
        this.jsonSchemaParser = new JsonSchemaParser();
        var specifications = new SpecificationServiceImpl(host, port, getHttpClient(), getJsonParser()).getJsonSpecs();
        var context = new HashMap<String, Object>();
        // @FIXME: Are we sure we want to set this ID at this level?
        context.put("clientId", UUID.randomUUID().toString());
        context.put("host", host);
        context.put("port", port);
        context.put("apiKey", getTokenProvider().getToken());

        // FIXME: We should remove the ClientInfo class.
        context.put("apiBaseUrl", format("%s:%s", host, port));
        context.put("packageName", "io.polyapi");
        fileService.createClassFileWithDefaultPackage("ClientInfo", "clientInfo", context);
        fileService.createFileFromTemplate(new File("target/generated-resources/poly.properties"), "poly.properties", context);
        fileService.createFileWithContent(new File(new File("target/.poly"), "specs.json"), getJsonParser().toJsonString(specifications));
        writeContext("Poly", specifications, FunctionSpecification.class);
        writeContext("Vari", specifications, ServerVariableSpecification.class);
        logger.info("Sources generated correctly.");
    }

    private <T extends Specification> void writeContext(String rootName, List<Specification> specifications, Class<T> filter) {
        logger.debug("Creating root context.");
        var rootContext = new Context(null, rootName);
        specifications.stream()
                .filter(filter::isInstance)
                .filter(specification -> !(specification instanceof CustomFunctionSpecification && !CustomFunctionSpecification.class.cast(specification).isJava()))
                .filter(specification -> Stream.of(Optional.ofNullable(context).orElse("").toLowerCase().split(","))
                        .map(String::trim)
                        .anyMatch(Optional.ofNullable(specification.getContext()).orElse("").toLowerCase()::startsWith))
                .peek(specification -> logger.trace("Generating context for specification {}.", specification.getName()))
                .forEach(specification -> createContext(rootContext, Stream.of(specification.getContext().split("\\.")).filter(not(String::isEmpty)).toList(), specification));
        rootContext.accept(new CodeGenerationVisitor(fileService, getJsonParser(), jsonSchemaParser));
    }

    private Context createContext(Context parent, List<String> contextList, Specification specification) {
        if (contextList.isEmpty()) {
            logger.debug("Adding specification to context {}.", parent.getName());
            parent.getSpecifications().add(specification);
            return parent;
        } else {
            var contextName = contextList.get(0);
            logger.debug("Retrieving context {}.", contextName);
            return createContext(parent.put(new Context(parent, contextName)),
                    contextList.subList(1, contextList.size()),
                    specification);
        }
    }
}
