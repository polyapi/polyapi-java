package io.polyapi.plugin.service;

import io.polyapi.commons.api.http.HttpClient;
import io.polyapi.commons.api.json.JsonParser;
import io.polyapi.commons.api.service.PolyApiService;
import io.polyapi.plugin.model.specification.IgnoredSpecification;
import io.polyapi.plugin.model.specification.Specification;
import io.polyapi.plugin.model.specification.function.ClientFunctionSpecification;
import io.polyapi.plugin.model.specification.function.ServerFunctionSpecification;
import lombok.extern.slf4j.Slf4j;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;

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
    public List<Specification> list(List<String> contextFilters) {
        log.info("Retrieving JSON specifications from PolyAPI for this user.");
        List<Specification> specifications = get("specs", defaultInstance().constructCollectionType(List.class, Specification.class));
        log.debug("{} specifications retrieved without filter.", specifications.size());
        if (log.isDebugEnabled()) {
            log.trace("Retrieved specifications with the following IDs: [{}]", specifications.stream().map(Specification::getId).collect(joining(", ")));
        }
        log.debug("Validating for duplicate context/name pairs and filtering specification contexts.");
        Map<String, Specification> filteredMap = new HashMap<>();
        specifications.stream()
                .filter(not(IgnoredSpecification.class::isInstance))
                .filter(specification -> {
                    String context = specification.getContext().trim().toLowerCase();
                    return contextFilters.isEmpty() || contextFilters.stream()
                            .map(String::trim)
                            .map(String::toLowerCase)
                            .anyMatch(contextFilter -> contextFilter.equalsIgnoreCase(context) || contextFilter.isEmpty() || context.startsWith(format("%s.", contextFilter)));
                })
                .filter(not(specification -> specification instanceof ClientFunctionSpecification clientFunctionSpecification && !clientFunctionSpecification.getLanguage().equalsIgnoreCase("java")))
                .forEach(specification -> {
            String key = format("%s.%s", specification.getContext(), specification.getName()).toLowerCase();
            if (filteredMap.containsKey(key)) {
                log.warn("Skipping {} specification '{}' in context '{}' as it clashes with {} specification with the same name and context.", specification.getType(), specification.getName(), specification.getContext(), filteredMap.get(key).getType());
            } else {
                log.debug("Specification key '{}' not repeated (yet).", key);
                filteredMap.put(key, specification);
            }
        });
        List<Specification> result = filteredMap.values().stream().toList();
        log.info("{} specifications retrieved.", result.size());
        return result;
    }
}
