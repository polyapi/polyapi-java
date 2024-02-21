package io.polyapi.plugin.service;

import io.polyapi.commons.api.http.HttpClient;
import io.polyapi.commons.api.json.JsonParser;
import io.polyapi.commons.api.service.PolyApiService;
import io.polyapi.plugin.model.specification.Specification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static com.fasterxml.jackson.databind.type.TypeFactory.defaultInstance;
import static java.lang.String.format;
import static java.util.function.Function.identity;
import static java.util.stream.Collectors.joining;

public class SpecificationServiceImpl extends PolyApiService implements SpecificationService {
    private static final Logger logger = LoggerFactory.getLogger(SpecificationServiceImpl.class);

    public SpecificationServiceImpl(String host, Integer port, HttpClient client, JsonParser jsonParser) {
        super(host, port, client, jsonParser);
    }

    @Override
    public List<Specification> getJsonSpecs() {
        logger.info("Retrieving JSon specifications from Poly API for this user.");
        List<Specification> specifications = get("specs", defaultInstance().constructCollectionType(List.class, Specification.class));
        logger.info("{} specifications retrieved.", specifications.size());
        if (logger.isDebugEnabled()) {
            logger.trace("Retrieved specifications with the following IDs: [{}]", specifications.stream().map(Specification::getId).collect(joining(", ")));
        }
        logger.debug("Validating for duplicate context/name pairs.");
        Map<String, Specification> uniquenessValidationMap = new HashMap<>();
        specifications.forEach(specification -> {
            String key = format("%s.%s", specification.getContext(), specification.getName());
            if (uniquenessValidationMap.containsKey(key)) {
                logger.warn("Skipping {} specification '{}' in context '{}' as it clashes with {} specification with the same name and context.", specification.getType(), specification.getName(), specification.getContext(), uniquenessValidationMap.get(key).getType());
            } else {
                logger.debug("Specification key '{}' not repeated (yet).", key);
                uniquenessValidationMap.put(key, specification);
            }
        });
        return uniquenessValidationMap.values().stream().toList();
    }
}
