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
import java.util.StringJoiner;
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
    public List<Specification> list(List<String> contextFilters, List<String> functionIdFilters) {
        log.info("Retrieving JSON specifications from PolyAPI for this user.");
        
        // Build the query parameter string for server-side filtering
        StringJoiner queryParams = new StringJoiner("&");
        if (contextFilters != null && !contextFilters.isEmpty()) {
            queryParams.add("contexts=" + String.join(",", contextFilters));
        }
        if (functionIdFilters != null && !functionIdFilters.isEmpty()) {
            queryParams.add("ids=" + String.join(",", functionIdFilters));
        }

        String path = "specs";
        if (queryParams.length() > 0) {
            path += "?" + queryParams.toString();
            log.info("Applying server-side filters: {}", queryParams.toString());
        }

        // Make the API call with the constructed path
        List<Specification> specifications = get(path, defaultInstance().constructCollectionType(List.class, Specification.class));

        if (log.isTraceEnabled()) {
            log.trace("Retrieved specifications with the following IDs: [{}]", specifications.stream().map(Specification::getId).collect(joining(", ")));
        }

        log.info("{} specifications retrieved after server-side filtering.", specifications.size());
        return specifications;
    }
}
