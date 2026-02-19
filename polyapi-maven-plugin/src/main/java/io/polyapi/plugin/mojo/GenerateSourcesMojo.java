package io.polyapi.plugin.mojo;


import io.polyapi.plugin.service.generation.PolyGenerationService;
import io.polyapi.plugin.service.generation.PolyGenerationServiceImpl;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static java.lang.String.join;
import static java.util.function.Predicate.not;

@Slf4j
@Setter
@Mojo(name = "generate-sources")
public class GenerateSourcesMojo extends PolyApiMojo {

    @Parameter(property = "overwrite", defaultValue = "false")
    private Boolean overwrite;

    @Parameter(property = "contexts")
    private String contexts;

    @Parameter(property = "context")
    private String context;

    @Parameter(property = "functionIds")
    private String functionIds;

    private PolyGenerationService polyGenerationService;

    @Override
    public void execute(String host, Integer port) {
        log.info("Initiating generation of Poly sources.");
        if (this.polyGenerationService == null) {
            this.polyGenerationService = new PolyGenerationServiceImpl(getHttpClient(), getJsonParser(), host, port, getTokenProvider().getToken());
        }

        if (isDefined(contexts) && isDefined(context)) {
            log.warn("Both 'contexts' and legacy 'context' parameters were provided. Using 'contexts'.");
        }

        String contextFilter = isDefined(contexts) ? contexts : context;
        List<String> contextFilters = parseCsvFilter(contextFilter);
        log.debug("Context filters: \"{}\"", join("\", \"", contextFilters));

        List<String> functionIdFilters = parseCsvFilter(functionIds);
        log.debug("Function ID filters: \"{}\"", join("\", \"", functionIdFilters));

        this.polyGenerationService.generate(contextFilters, functionIdFilters, overwrite);
        log.info("Poly generation complete.");
    }

    static List<String> parseCsvFilter(String filter) {
        return Arrays.stream(Optional.ofNullable(filter).orElse("").split(","))
                .map(String::trim)
                .filter(not(String::isBlank))
                .toList();
    }

    private static boolean isDefined(String value) {
        return Optional.ofNullable(value)
                .map(String::trim)
                .filter(not(String::isEmpty))
                .isPresent();
    }
}
