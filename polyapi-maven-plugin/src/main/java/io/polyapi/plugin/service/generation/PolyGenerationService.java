package io.polyapi.plugin.service.generation;

import java.util.List;

public interface PolyGenerationService {

    void generate(List<String> contextFilters, List<String> functionIdFilters, boolean overwrite);
}
