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

@Slf4j
@Setter
@Mojo(name = "generate-sources")
public class GenerateSourcesMojo extends PolyApiMojo {

    @Parameter(property = "overwrite", defaultValue = "false")
    private Boolean overwrite;

    @Parameter(property = "context")
    private String context;
    private PolyGenerationService polyGenerationService;

    @Override
    public void execute(String host, Integer port) {
        log.info("Initiating generation of Poly sources.");
        this.polyGenerationService = new PolyGenerationServiceImpl(getHttpClient(), getJsonParser(), host, port, getTokenProvider().getToken());
        List<String> contextFilters = Arrays.stream(Optional.ofNullable(context).map(contextCsv -> contextCsv.split(",")).orElse(new String[]{""})).toList();
        log.debug("Context filters: \"{}\"", join("\", \"", contextFilters));
        this.polyGenerationService.generate(contextFilters, overwrite);
        log.info("Poly generation complete.");
    }
}
