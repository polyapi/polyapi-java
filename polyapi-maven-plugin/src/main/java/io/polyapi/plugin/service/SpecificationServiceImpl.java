package io.polyapi.plugin.service;

import io.polyapi.commons.api.http.HttpClient;
import io.polyapi.commons.api.json.JsonParser;
import io.polyapi.commons.api.service.PolyApiService;
import io.polyapi.plugin.model.specification.IgnoredSpecification;
import io.polyapi.plugin.model.specification.Specification;
import io.polyapi.plugin.model.specification.function.ClientFunctionSpecification;
import lombok.extern.slf4j.Slf4j;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.fasterxml.jackson.databind.type.TypeFactory.defaultInstance;
import static java.lang.String.format;
import static java.util.function.Predicate.not;
import static java.util.stream.Collectors.joining;

@Slf4j
public class SpecificationServiceImpl extends PolyApiService implements SpecificationService {

    public SpecificationServiceImpl(HttpClient client, JsonParser jsonParser, String host, Integer port) {
        super(client, jsonParser, host, port);
    }

    @Override
    public List<Specification> list(List<String> contextFilters, List<String> functionIdFilters) {
        log.info("Retrieving JSON specifications from PolyAPI for this user.");

        List<String> sanitizedContextFilters = sanitizeFilters(contextFilters);
        List<String> sanitizedFunctionIdFilters = sanitizeFilters(functionIdFilters);

        Map<String, List<String>> queryParams = new HashMap<>();
        if (!sanitizedContextFilters.isEmpty()) {
            queryParams.put("contexts", List.of(String.join(",", sanitizedContextFilters)));
        }
        if (!sanitizedFunctionIdFilters.isEmpty()) {
            queryParams.put("ids", List.of(String.join(",", sanitizedFunctionIdFilters)));
        }
        if (!queryParams.isEmpty()) {
            log.info("Applying server-side filters: {}", queryParams);
        }

        List<Specification> specifications = get("specs", new HashMap<>(), queryParams, defaultInstance().constructCollectionType(List.class, Specification.class));

        if (log.isTraceEnabled()) {
            log.trace("Retrieved specifications with the following IDs: [{}]", specifications.stream().map(Specification::getId).collect(joining(", ")));
        }

        Map<String, Specification> filteredMap = new LinkedHashMap<>();
        specifications.stream()
                .filter(not(IgnoredSpecification.class::isInstance))
                .filter(specification -> specificationMatchesContextFilters(specification, sanitizedContextFilters))
                .filter(specification -> specificationMatchesIdFilters(specification, sanitizedFunctionIdFilters))
                .filter(not(specification -> specification instanceof ClientFunctionSpecification clientFunctionSpecification && !clientFunctionSpecification.isJava()))
                .forEach(specification -> {
                    String key = format("%s.%s", specification.getContext(), specification.getName()).toLowerCase();
                    if (filteredMap.containsKey(key)) {
                        log.warn("Skipping {} specification '{}' in context '{}' as it clashes with {} specification with the same name and context.",
                                specification.getType(), specification.getName(), specification.getContext(), filteredMap.get(key).getType());
                    } else {
                        filteredMap.put(key, specification);
                    }
                });
        List<Specification> result = filteredMap.values().stream().toList();
        log.info("{} specifications retrieved after server and local filtering.", result.size());
        return result;
    }

    private List<String> sanitizeFilters(List<String> filters) {
        return Optional.ofNullable(filters)
                .orElse(List.of())
                .stream()
                .filter(java.util.Objects::nonNull)
                .map(String::trim)
                .filter(not(String::isBlank))
                .toList();
    }

    private boolean specificationMatchesContextFilters(Specification specification, List<String> contextFilters) {
        if (contextFilters.isEmpty()) {
            return true;
        }
        String context = Optional.ofNullable(specification.getContext()).orElse("").trim().toLowerCase();
        return contextFilters.stream()
                .map(String::toLowerCase)
                .anyMatch(contextFilter -> contextFilter.equals(context) || context.startsWith(format("%s.", contextFilter)));
    }

    private boolean specificationMatchesIdFilters(Specification specification, List<String> functionIdFilters) {
        if (functionIdFilters.isEmpty()) {
            return true;
        }
        return functionIdFilters.stream().anyMatch(idFilter -> idFilter.equals(specification.getId()));
    }
}
