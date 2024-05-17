package io.polyapi.plugin.mojo;


import io.polyapi.commons.api.service.file.FileService;
import io.polyapi.commons.internal.file.FileServiceImpl;
import io.polyapi.plugin.model.generation.Context;
import io.polyapi.plugin.model.generation.ResolvedContext;
import io.polyapi.plugin.model.specification.Specification;
import io.polyapi.plugin.model.specification.function.CustomFunctionSpecification;
import io.polyapi.plugin.model.specification.function.FunctionSpecification;
import io.polyapi.plugin.model.specification.variable.ServerVariableSpecification;
import io.polyapi.plugin.model.specification.webhook.WebhookHandleSpecification;
import io.polyapi.plugin.service.SpecificationServiceImpl;
import io.polyapi.plugin.service.generation.PolyObjectResolverService;
import io.polyapi.plugin.service.schema.JsonSchemaParser;
import io.polyapi.plugin.service.template.PolyHandlebars;
import io.polyapi.plugin.service.visitor.CodeGenerator;
import io.polyapi.plugin.service.visitor.SpecificationCodeGeneratorVisitor;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

import java.io.File;
import java.util.*;
import java.util.stream.Stream;

import static java.lang.String.format;
import static java.util.function.Predicate.not;

@Slf4j
@Setter
@Mojo(name = "generate-sources")
public class GenerateSourcesMojo extends PolyApiMojo {
    private FileService fileService;
    private PolyObjectResolverService polyObjectResolverService;
    private CodeGenerator codeGenerator;
    private JsonSchemaParser jsonSchemaParser;

    @Parameter(property = "overwrite", defaultValue = "false")
    private Boolean overwrite;

    @Parameter(property = "context")
    private String context;
    private SpecificationCodeGeneratorVisitor specificationCodeGeneratorVisitor;

    @Override
    public void execute(String host, Integer port) {
        this.fileService = new FileServiceImpl(new PolyHandlebars(), overwrite);
        this.codeGenerator = new CodeGenerator(fileService);
        this.jsonSchemaParser = new JsonSchemaParser();
        this.polyObjectResolverService = new PolyObjectResolverService(jsonSchemaParser);
        this.specificationCodeGeneratorVisitor = new SpecificationCodeGeneratorVisitor(fileService, polyObjectResolverService, getJsonParser(), jsonSchemaParser);
        var specifications = new SpecificationServiceImpl(host, port, getHttpClient(), getJsonParser()).getJsonSpecs(Optional.ofNullable(this.context).map(contextCsv -> contextCsv.split(",")).orElse(new String[]{""}));
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
        writeContext("Poly", specifications, FunctionSpecification.class, WebhookHandleSpecification.class);
        writeContext("Vari", specifications, ServerVariableSpecification.class);
        log.info("Sources generated correctly.");
    }

    @SafeVarargs
    private void writeContext(String rootName, List<Specification> specifications, Class<? extends Specification>... filter) {
        log.debug("Creating root context.");
        var rootContext = new Context(null, rootName);
        specifications.stream()
                .filter(specification -> Arrays.stream(filter).anyMatch(clazz -> clazz.isInstance(specification)))
                .filter(specification -> !(specification instanceof CustomFunctionSpecification customFunctionSpecification && !customFunctionSpecification.isJava()))
                .forEach(specification -> createContext(rootContext, Stream.of(specification.getContext().split("\\.")).filter(not(String::isEmpty)).toList(), specification));
        generate(rootContext);
    }

    private void generate(Context context) {
        ResolvedContext resolvedContext = polyObjectResolverService.resolve(context);
        if (context.getParent() == null) {
            codeGenerator.generate(resolvedContext, context.getClassName());
        } else {
            codeGenerator.generate(resolvedContext);
        }
        context.getSubcontexts().forEach(this::generate);
        context.getSpecifications().forEach(specificationCodeGeneratorVisitor::doVisit);
    }

    private Context createContext(Context parent, List<String> contextList, Specification specification) {
        if (contextList.isEmpty()) {
            log.debug("Adding specification to context {}.", parent.getName());
            parent.getSpecifications().add(specification);
            return parent;
        } else {
            var contextName = contextList.get(0);
            log.debug("Retrieving context {}.", contextName);
            return createContext(parent.put(new Context(parent, contextName)),
                    contextList.subList(1, contextList.size()),
                    specification);
        }
    }
}
