package io.polyapi.plugin.service;

import io.polyapi.commons.api.http.HttpClient;
import io.polyapi.commons.api.json.JsonParser;
import io.polyapi.commons.api.service.PolyApiService;
import io.polyapi.plugin.model.function.PolyFunction;
import io.polyapi.plugin.model.function.PolyFunctionMetadata;
import org.apache.commons.io.IOUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;

import static java.lang.String.format;

public class PolyFunctionServiceImpl extends PolyApiService implements PolyFunctionService {
    private static final Logger logger = LoggerFactory.getLogger(PolyFunctionServiceImpl.class);
    private final JavaParserService javaParserService;

    @Deprecated
    public PolyFunctionServiceImpl(String host, Integer port, HttpClient client, JsonParser jsonParser) {
        this(host, port, client, jsonParser, null);
    }

    public PolyFunctionServiceImpl(String host, Integer port, HttpClient client, JsonParser jsonParser, ClassLoader classLoader) {
        super(host, port, client, jsonParser);
        this.javaParserService = new JavaParserServiceImpl(classLoader, jsonParser);
    }

    @Override
    public PolyFunction postServerFunction(PolyFunction polyFunction) {
        return post("functions/server", polyFunction, PolyFunction.class);
    }

    @Override
    public PolyFunction postClientFunction(PolyFunction polyFunction) {
        return post("functions/client", polyFunction, PolyFunction.class);
    }

    @Override
    public String deploy(PolyFunctionMetadata polyFunctionMetadata) {
        logger.info("Deploying {} function '{}' on context '{}'.", polyFunctionMetadata.getTypedType(), polyFunctionMetadata.name(), polyFunctionMetadata.context());
        PolyFunction function = post(format("functions/%s", polyFunctionMetadata.getTypedType()), javaParserService.parseFunction(polyFunctionMetadata), PolyFunction.class);
        logger.info("Deployment of {} function '{}' on context'{}' successful.", polyFunctionMetadata.getTypedType(), polyFunctionMetadata.name(), polyFunctionMetadata.context());
        return function.getId();
    }
}
