package io.polyapi.plugin.service.generation;

import io.polyapi.commons.api.http.HttpClient;
import io.polyapi.commons.api.json.JsonParser;
import io.polyapi.plugin.model.generation.Context;
import io.polyapi.plugin.model.generation.ResolvedContext;
import io.polyapi.plugin.model.specification.Specification;
import io.polyapi.plugin.model.specification.function.ClientFunctionSpecification;
import io.polyapi.plugin.model.specification.function.FunctionSpecification;
import io.polyapi.plugin.model.specification.variable.ServerVariableSpecification;
import io.polyapi.plugin.model.specification.webhook.WebhookHandleSpecification;
import io.polyapi.plugin.service.FileService;
import io.polyapi.plugin.service.FileServiceImpl;
import io.polyapi.plugin.service.SpecificationService;
import io.polyapi.plugin.service.SpecificationServiceImpl;
import io.polyapi.plugin.service.schema.JsonSchemaParser;
import io.polyapi.plugin.service.visitor.SpecificationCodeGeneratorVisitor;
import lombok.extern.slf4j.Slf4j;

import java.io.File;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

import static java.lang.String.format;
import static java.util.function.Predicate.not;

@Slf4j
public class PolyGenerationServiceImpl implements PolyGenerationService {
    private final FileService fileService;
    private final JsonParser jsonParser;
    private final JsonSchemaParser jsonSchemaParser;
    private final String host;
    private final Integer port;
    private final PolyObjectResolverService polyObjectResolverService;
    private final SpecificationService specificationService;
    private final String apiKey;

    public PolyGenerationServiceImpl(HttpClient httpClient, JsonParser jsonParser, String host, Integer port, String apiKey) {
        this.jsonParser = jsonParser;
        this.host = host;
        this.port = port;
        this.apiKey = apiKey;
        this.jsonSchemaParser = new JsonSchemaParser();
        this.fileService = new FileServiceImpl();
        this.polyObjectResolverService = new PolyObjectResolverService(jsonSchemaParser);
        this.specificationService = new SpecificationServiceImpl(httpClient, jsonParser, host, port);
    }

    @Override
    public void generate(List<String> contextFilters, List<String> functionIdFilters, boolean overwrite) {
        // The call to list now passes both filters for server-side processing.
        log.info("Applying context  filters on the API call: {}", contextFilters);
        log.info("Applying function ID filters on the API call: {}", functionIdFilters);
        var specifications = specificationService.list(contextFilters, functionIdFilters);

        var contextModel = new HashMap<String, Object>();
        contextModel.put("clientId", UUID.randomUUID().toString());
        contextModel.put("host", host);
        contextModel.put("port", port);
        contextModel.put("apiKey", apiKey);
        contextModel.put("apiBaseUrl", format("%s:%s", host, port));
        contextModel.put("packageName", "io.polyapi");
        fileService.createFileFromTemplate(new File("target/generated-resources/poly.properties"), "poly.properties", contextModel, overwrite);
        fileService.createFileWithContent(new File(new File("target/.poly"), "specs.json"), jsonParser.toJsonString(specifications), overwrite);
        writeContext("Poly", specifications, overwrite, FunctionSpecification.class, WebhookHandleSpecification.class);
        writeContext("Vari", specifications, overwrite, ServerVariableSpecification.class);
        log.info("Sources generated correctly.");
    }

    @SafeVarargs
    private void writeContext(String rootName, List<Specification> specifications, boolean overwrite, Class<? extends Specification>... filter) {
        log.debug("Creating root context.");
        var rootContext = new Context(null, rootName);
        specifications.stream()
                .filter(specification -> Arrays.stream(filter).anyMatch(clazz -> clazz.isInstance(specification)))
                .filter(specification -> !(specification instanceof ClientFunctionSpecification clientFunctionSpecification && !clientFunctionSpecification.isJava()))
                .forEach(specification -> createContext(rootContext, Stream.of(specification.getContext().split("\\.")).filter(not(String::isEmpty)).toList(), specification));
        generate(rootContext, overwrite);
    }

    private void generate(Context context, boolean overwrite) {
        SpecificationCodeGeneratorVisitor visitor = new SpecificationCodeGeneratorVisitor(fileService, polyObjectResolverService, jsonParser, jsonSchemaParser, overwrite);
        ResolvedContext resolvedContext = polyObjectResolverService.resolve(context);
        if (context.getParent() == null) {
            fileService.generateFile(resolvedContext, context.getClassName(), overwrite);
        } else {
            fileService.generateFile(resolvedContext, overwrite);
        }
        context.getSubcontexts().forEach(subcontext -> generate(subcontext, overwrite));
        context.getSpecifications().forEach(visitor::doVisit);
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
