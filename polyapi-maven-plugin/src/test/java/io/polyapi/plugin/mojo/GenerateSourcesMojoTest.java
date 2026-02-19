package io.polyapi.plugin.mojo;

import io.polyapi.plugin.service.generation.PolyGenerationService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GenerateSourcesMojoTest {

    @Test
    void parseCsvFilterDropsBlankValues() {
        assertEquals(List.of("alpha", "beta"), GenerateSourcesMojo.parseCsvFilter(" alpha, ,beta,,  "));
        assertEquals(List.of(), GenerateSourcesMojo.parseCsvFilter(null));
        assertEquals(List.of(), GenerateSourcesMojo.parseCsvFilter(" , , "));
    }

    @Test
    void executeUsesLegacyContextWhenContextsIsNotSet() {
        GenerateSourcesMojo mojo = new GenerateSourcesMojo();
        CapturingPolyGenerationService capturingService = new CapturingPolyGenerationService();
        mojo.setPolyGenerationService(capturingService);
        mojo.setContext("legacy, child");
        mojo.setFunctionIds("id-1, id-2");
        mojo.setOverwrite(Boolean.TRUE);

        mojo.execute("https://polyapi.io", 443);

        assertEquals(List.of("legacy", "child"), capturingService.contextFilters);
        assertEquals(List.of("id-1", "id-2"), capturingService.functionIdFilters);
        assertEquals(Boolean.TRUE, capturingService.overwrite);
    }

    @Test
    void executePrefersContextsOverLegacyContext() {
        GenerateSourcesMojo mojo = new GenerateSourcesMojo();
        CapturingPolyGenerationService capturingService = new CapturingPolyGenerationService();
        mojo.setPolyGenerationService(capturingService);
        mojo.setContext("legacy");
        mojo.setContexts("preferred");
        mojo.setFunctionIds(" , ");
        mojo.setOverwrite(Boolean.FALSE);

        mojo.execute("https://polyapi.io", 443);

        assertEquals(List.of("preferred"), capturingService.contextFilters);
        assertEquals(List.of(), capturingService.functionIdFilters);
        assertEquals(Boolean.FALSE, capturingService.overwrite);
    }

    @Test
    void executeFallsBackToLegacyContextWhenContextsIsBlank() {
        GenerateSourcesMojo mojo = new GenerateSourcesMojo();
        CapturingPolyGenerationService capturingService = new CapturingPolyGenerationService();
        mojo.setPolyGenerationService(capturingService);
        mojo.setContext("legacy");
        mojo.setContexts("   ");
        mojo.setOverwrite(Boolean.FALSE);

        mojo.execute("https://polyapi.io", 443);

        assertEquals(List.of("legacy"), capturingService.contextFilters);
    }

    private static class CapturingPolyGenerationService implements PolyGenerationService {
        private List<String> contextFilters;
        private List<String> functionIdFilters;
        private Boolean overwrite;

        @Override
        public void generate(List<String> contextFilters, List<String> functionIdFilters, boolean overwrite) {
            this.contextFilters = contextFilters;
            this.functionIdFilters = functionIdFilters;
            this.overwrite = overwrite;
        }
    }
}
