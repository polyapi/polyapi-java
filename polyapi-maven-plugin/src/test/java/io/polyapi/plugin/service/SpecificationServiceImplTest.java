package io.polyapi.plugin.service;

import io.polyapi.plugin.model.specification.IgnoredSpecification;
import io.polyapi.plugin.model.specification.Specification;
import io.polyapi.plugin.model.specification.function.ClientFunctionSpecification;
import io.polyapi.plugin.model.specification.function.ServerFunctionSpecification;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Type;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Test class for {@link SpecificationServiceImpl}.
 */
public class SpecificationServiceImplTest {

    @Test
    void listDoesNotSendEmptyQueryParams() {
        StubSpecificationService service = new StubSpecificationService(List.of());

        List<Specification> result = service.list(List.of("", "   "), Arrays.asList(" ", null));

        assertEquals("specs", service.capturedRelativePath);
        assertTrue(service.capturedQueryParams.isEmpty());
        assertTrue(result.isEmpty());
    }

    @Test
    void listSanitizesAndSendsServerSideFilters() {
        StubSpecificationService service = new StubSpecificationService(List.of(serverSpec("id-1", "alpha", "fn")));

        List<Specification> result = service.list(List.of(" alpha ", " "), List.of(" id-1 ", ""));

        assertEquals(1, result.size());
        assertEquals(Map.of("contexts", List.of("alpha"), "ids", List.of("id-1")), service.capturedQueryParams);
    }

    @Test
    void listAppliesFallbackFilteringAndDeduplication() {
        Specification duplicateCandidate = serverSpec("id-dup", "alpha", "shared");
        Specification includedDirectMatch = serverSpec("id-1", "alpha", "shared");
        Specification includedNestedContext = serverSpec("id-2", "alpha.child", "childFn");
        Specification excludedByContext = serverSpec("id-other", "beta", "otherFn");
        Specification excludedByLanguage = clientSpec("id-js", "alpha", "jsFn", "javascript");
        Specification excludedIgnoredType = ignoredSpec("id-ignored", "alpha", "ignoredFn");

        StubSpecificationService service = new StubSpecificationService(List.of(
                includedDirectMatch,
                duplicateCandidate,
                includedNestedContext,
                excludedByContext,
                excludedByLanguage,
                excludedIgnoredType
        ));

        List<Specification> result = service.list(
                List.of("alpha"),
                List.of("id-1", "id-2", "id-dup", "id-other", "id-js", "id-ignored")
        );

        assertEquals(List.of("id-1", "id-2"), result.stream().map(Specification::getId).toList());
        assertEquals(Map.of(
                "contexts", List.of("alpha"),
                "ids", List.of("id-1,id-2,id-dup,id-other,id-js,id-ignored")
        ), service.capturedQueryParams);
    }

    private static ServerFunctionSpecification serverSpec(String id, String context, String name) {
        ServerFunctionSpecification specification = new ServerFunctionSpecification();
        specification.setId(id);
        specification.setType("serverFunction");
        specification.setContext(context);
        specification.setName(name);
        specification.setLanguage("java");
        return specification;
    }

    private static ClientFunctionSpecification clientSpec(String id, String context, String name, String language) {
        ClientFunctionSpecification specification = new ClientFunctionSpecification();
        specification.setId(id);
        specification.setType("customFunction");
        specification.setContext(context);
        specification.setName(name);
        specification.setLanguage(language);
        return specification;
    }

    private static IgnoredSpecification ignoredSpec(String id, String context, String name) {
        IgnoredSpecification specification = new IgnoredSpecification();
        specification.setId(id);
        specification.setType("unknown");
        specification.setContext(context);
        specification.setName(name);
        return specification;
    }

    private static class StubSpecificationService extends SpecificationServiceImpl {
        private final List<Specification> response;
        private String capturedRelativePath;
        private Map<String, List<String>> capturedQueryParams = Map.of();

        private StubSpecificationService(List<Specification> response) {
            super(null, null, "https://polyapi.io", 443);
            this.response = response;
        }

        @Override
        public <O> O get(String relativePath, Map<String, List<String>> headers, Map<String, List<String>> queryParams, Type expectedResponseType) {
            this.capturedRelativePath = relativePath;
            this.capturedQueryParams = new HashMap<>(queryParams);
            @SuppressWarnings("unchecked")
            O casted = (O) response;
            return casted;
        }
    }
}
