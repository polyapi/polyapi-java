package io.polyapi.commons.internal.http;

import io.polyapi.commons.api.error.PolyApiException;
import io.polyapi.commons.api.http.HttpClient;
import io.polyapi.commons.api.http.HttpMethod;
import io.polyapi.commons.api.http.Request;
import io.polyapi.commons.api.http.RequestRecord;
import io.polyapi.commons.api.http.Response;
import io.polyapi.commons.api.http.ResponseRecord;
import io.polyapi.commons.api.http.TokenProvider;
import lombok.extern.slf4j.Slf4j;
import okhttp3.OkHttpClient;
import okhttp3.RequestBody;
import org.apache.commons.io.IOUtils;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.UUID;

import static java.lang.String.format;
import static java.lang.String.join;
import static java.nio.charset.Charset.defaultCharset;
import static java.util.concurrent.TimeUnit.MILLISECONDS;
import static java.util.stream.Collectors.joining;

@Slf4j
public class DefaultHttpClient implements HttpClient {

    private final OkHttpClient client;
    private final HttpClientConfiguration configuration;

    /**
     * Utility constructor that sets a default {@link OkHttpClient} and uses a {@link TokenProvider}.
     *
     * @param configuration The configuration for the HTTP client.
     */
    public DefaultHttpClient(HttpClientConfiguration configuration) {
        this(new OkHttpClient.Builder()
                .connectTimeout(configuration.getConnectTimeoutMillis(), MILLISECONDS)
                .readTimeout(configuration.getReadTimeoutMillis(), MILLISECONDS)
                .writeTimeout(configuration.getWriteTimeoutMillis(), MILLISECONDS)
                .build(), configuration);
    }

    public DefaultHttpClient(OkHttpClient client, HttpClientConfiguration configuration) {
        this.client = client;
        this.configuration = configuration;
    }

    @Override
    public HttpRequestBuilder prepareRequest(String host, Integer port, HttpMethod method, String relativePath) {
        log.debug("Preparing request ");
        return new HttpRequestBuilder(host, port, method, relativePath);
    }

    @Override
    public HttpRequestBuilder prepareAuthenticatedRequest(String host, Integer port, HttpMethod method, String relativePath) {
        return prepareRequest(host, port, method, relativePath)
                .withHeader("Authorization", configuration.getTokenProvider().getTokenAsHeader());
    }

    @Override
    public Response send(Request request) {
        try {
            UUID requestId = UUID.randomUUID();
            log.debug("Sending request. Request identified as {}.", requestId);
            if (log.isTraceEnabled()) {

                // Adding logging trace values.
                log.warn("Trace logging enabled. Request specific confidential information such as secret keys and tokens may be revealed.");
                var stringBody = IOUtils.toString(request.body(), defaultCharset());
                request = new RequestRecord(request.host(), request.relativePath(), request.port(), request.queryParams(), request.method(), request.headers(), new ByteArrayInputStream(stringBody.getBytes(defaultCharset())));
                log.trace("Request with ID {} contents:\n{\n'url':'{}';\n'headers': {\n{}\n};\n'method': '{}';\n'body':{}",
                        requestId,
                        request.getUrl(),
                        request.headers().entrySet().stream()
                                .map(entry -> format("'%s'='%s'", entry.getKey(), join(", ", entry.getValue())))
                                .collect(joining(";")),
                        request.method(),
                        stringBody
                );
            }
            okhttp3.Request.Builder builder = new okhttp3.Request.Builder()
                    .url(request.getUrl())
                    .method(request.method().name(), request.body().available() > 0 ? RequestBody.create(IOUtils.toString(request.body(), defaultCharset()).getBytes(defaultCharset())) : null);

            // This block of code is created because the Headers class doesn't have a way of including the headers all together.
            request.headers().forEach((key, list) -> list.forEach(value -> builder.header(key, value)));
            try (okhttp3.Response response = client.newCall(builder.build()).execute()) {
                log.debug("Request with ID {} complete. Status code is {}", requestId, response.code());
                var result = new ResponseRecord(response.headers().toMultimap(), new ByteArrayInputStream(response.body().bytes()), response.code());
                if (log.isTraceEnabled()) {
                    log.trace("Response to request with ID {} contents:\n{\n    'status':{};\n    headers': {\n{}\n};\n    'body':{}",
                            requestId,
                            result.statusCode(),
                            result.headers().entrySet().stream()
                                    .map(entry -> format("'%s'='%s'", entry.getKey(), join(", ", entry.getValue())))
                                    .collect(joining(";")),
                            IOUtils.toString(result.body(), defaultCharset())
                    );
                    result.body().reset();
                }
                return (response.code() < 200 || response.code() > 299) ? configuration.getErrorHandlingStrategy().apply(result) : result;
            } catch (IOException e) {
                // FIXME: Throw the appropriate exception.
                throw new RuntimeException(e);
            }
        } catch (IOException e) {
            // FIXME: Throw the appropriate exception.
            throw new PolyApiException(e);
        }
    }
}
