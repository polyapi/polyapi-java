package io.polyapi.plugin.service;

import io.polyapi.commons.api.http.HttpClient;
import io.polyapi.commons.api.json.JsonParser;
import io.polyapi.commons.api.service.PolyApiService;
import io.polyapi.plugin.error.function.UnclearFunctionReferenceException;
import io.polyapi.plugin.model.function.PolyFunction;
import io.polyapi.plugin.model.specification.Specification;
import lombok.extern.slf4j.Slf4j;

import java.util.Collections;
import java.util.List;

import static java.lang.String.format;

@Slf4j
public class PolyFunctionServiceImpl extends PolyApiService implements PolyFunctionService {
    private final SpecificationService specificationService;

    public PolyFunctionServiceImpl(HttpClient client, JsonParser jsonParser, String host, Integer port) {
        super(client, jsonParser, host, port);
        this.specificationService = new SpecificationServiceImpl(client, jsonParser, host, port);
    }

    @Override
    public PolyFunction deploy(String type, PolyFunction polyFunction) {
        log.info("Deploying {} function '{}' on context '{}'.", type, polyFunction.getName(), polyFunction.getContext());
        PolyFunction function = post(format("functions/%s", type), polyFunction, PolyFunction.class);
        log.info("Deployment of {} function '{}' on context'{}' successful.", type, polyFunction.getName(), polyFunction.getContext());
        return function;
    }

    @Override
    public void delete(String context, String name) {
        log.info("Deleting function '{}' on context '{}'.", name, context);
        List<Specification> specifications = specificationService.list(List.of(context), Collections.emptyList())
                .stream()
                .filter(spec -> spec.getName().equalsIgnoreCase(name) && spec.getContext().equalsIgnoreCase(context))
                .toList();
        if (specifications.size() > 1) {
            List<Specification> filteredSpecifications = specifications.stream()
                    .filter(function -> function.getName().equals(name) && function.getContext().equals(context))
                    .toList();
            if (filteredSpecifications.isEmpty()) {
                throw new UnclearFunctionReferenceException(toReference(context, name), specifications.stream()
                        .map(function -> toReference(function.getContext(), function.getName()))
                        .toList());
            } else {
                specifications = filteredSpecifications;
            }
        }
        specifications.stream().findAny()
                .ifPresentOrElse(this::delete, () -> log.warn("No function named '{}' on context '{}' has been deleted.", name, context));
    }

    @Override
    public void delete(String id) {
        specificationService.list(Collections.emptyList(), List.of(id)).stream()
                .filter(specification -> specification.getId().equals(id))
                .forEach(this::delete);
    }

    private void delete(Specification specification) {
        log.info("Deleting function with ID '{}'.", specification.getId());
        String relativePath = "";
        switch (specification.getType()) {
            case "apiFunction":
            case "customFunction":
            case "serverFunction":
                relativePath = specification.getType().toLowerCase().replace("function", "");
                break;
            case "authFunction":
                relativePath = "auth-providers";
                break;
            case "webhookHandle":
                relativePath = "webhooks";
                break;
            case "serverVariable":
                relativePath = "variables";
                break;
        }
        super.delete(format("functions/%s/%s", relativePath, specification.getId()));
        log.info("Function with ID '{}'.", specification.getId());
    }

    private String toReference(String context, String name) {
        return format("%s.%s", context, name);
    }
}
