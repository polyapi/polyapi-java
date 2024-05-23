package io.polyapi.plugin.mojo;

import io.polyapi.commons.api.error.http.UnexpectedHttpResponseException;
import io.polyapi.commons.api.http.HttpClient;
import io.polyapi.commons.api.http.TokenProvider;
import io.polyapi.commons.api.json.JsonParser;
import io.polyapi.commons.internal.http.DefaultHttpClient;
import io.polyapi.commons.internal.http.HardcodedTokenProvider;
import io.polyapi.commons.internal.http.HttpClientConfiguration;
import io.polyapi.commons.internal.json.JacksonJsonParser;
import io.polyapi.plugin.error.PolyApiMavenPluginException;
import io.polyapi.plugin.service.MavenService;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.IOUtils;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoExecutionException;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.Parameter;
import org.apache.maven.project.MavenProject;

import java.io.IOException;

import static io.polyapi.plugin.mojo.validation.Validator.validateNotEmpty;
import static io.polyapi.plugin.mojo.validation.Validator.validatePortFormat;
import static java.nio.charset.Charset.defaultCharset;

@Setter
@Slf4j
public abstract class PolyApiMojo extends AbstractMojo {

    @Parameter(defaultValue = "${project}", readonly = true)
    private MavenProject project;

    @Parameter(property = "host", required = true)
    private String host;

    @Parameter(property = "port")
    private String port;

    @Parameter(property = "apiKey", required = true)
    private String apiKey;
    private MavenService mavenService;
    private TokenProvider tokenProvider;
    private HttpClient httpClient;
    private JsonParser jsonParser;

    @Override
    public void execute() throws MojoExecutionException, MojoFailureException {
        try {
            log.debug("Setting up Maven service.");
            mavenService = new MavenService(project);
            mavenService.getPropertyFromPlugin("host", host, this::setHost);
            mavenService.getPropertyFromPlugin("port", port, this::setPort);
            validatePortFormat("port", port);
            mavenService.getPropertyFromPlugin("apiKey", apiKey, this::setApiKey);
            validateNotEmpty("apiKey", apiKey);
            tokenProvider = new HardcodedTokenProvider(apiKey);
            httpClient = new DefaultHttpClient(HttpClientConfiguration.builder(tokenProvider).build());
            jsonParser = new JacksonJsonParser();
            execute(host, Integer.valueOf(port));
        } catch (PolyApiMavenPluginException e) {
            log.error("An exception occurred during the plugin execution.", e);
            throw new MojoFailureException(e);
        } catch (UnexpectedHttpResponseException e) {
            log.error("An unexpected HTTP response code {} was returned from the server.", e.getResponse().statusCode());
            if (log.isDebugEnabled()) {
                try {
                    log.debug("Response from server is: {}", IOUtils.toString(e.getResponse().body(), defaultCharset()));
                } catch (IOException ex) {
                    throw new MojoExecutionException(ex);
                }
            }
            throw new MojoFailureException(e);
        } catch (RuntimeException e) {
            log.error("An unexpected exception occurred during the plugin execution.", e);
            throw new MojoExecutionException(e);
        }
    }

    protected MavenService getMavenService() {
        return this.mavenService;
    }

    protected TokenProvider getTokenProvider() {
        return tokenProvider;
    }

    protected HttpClient getHttpClient() {
        return httpClient;
    }

    protected JsonParser getJsonParser() {
        return jsonParser;
    }

    protected abstract void execute(String host, Integer port);
}
