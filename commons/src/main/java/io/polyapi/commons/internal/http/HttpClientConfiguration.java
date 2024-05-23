package io.polyapi.commons.internal.http;

import io.polyapi.commons.api.error.http.BadRequestException;
import io.polyapi.commons.api.error.http.ForbiddenException;
import io.polyapi.commons.api.error.http.HttpResponseException;
import io.polyapi.commons.api.error.http.ImATeapotException;
import io.polyapi.commons.api.error.http.InternalServerErrorException;
import io.polyapi.commons.api.error.http.MethodNotAllowedException;
import io.polyapi.commons.api.error.http.NotAcceptableException;
import io.polyapi.commons.api.error.http.NotFoundException;
import io.polyapi.commons.api.error.http.RequestTimeoutException;
import io.polyapi.commons.api.error.http.ServiceUnavailableException;
import io.polyapi.commons.api.error.http.UnauthorizedException;
import io.polyapi.commons.api.error.http.UnexpectedHttpResponseException;
import io.polyapi.commons.api.error.http.UnexpectedInformationalResponseException;
import io.polyapi.commons.api.http.Response;
import io.polyapi.commons.api.http.TokenProvider;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.concurrent.TimeUnit;
import java.util.function.Function;

@Getter
@AllArgsConstructor
public class HttpClientConfiguration {
    public static final Long DEFAULT_TIMEOUT_MILLIS = 10000L;
    private final TokenProvider tokenProvider;
    private Long connectTimeoutMillis;
    private Long readTimeoutMillis;
    private Long writeTimeoutMillis;
    private Function<Response, Response> errorHandlingStrategy;

    public HttpClientConfiguration(String hardcodedApiKey) {
        this(new HardcodedTokenProvider(hardcodedApiKey));
    }

    private HttpClientConfiguration(TokenProvider tokenProvider) {
        this.tokenProvider = tokenProvider;
    }

    public static HttpClientConfigurationBuilder builder(String apiKey) {
        return builder(new HardcodedTokenProvider(apiKey));
    }

    public static HttpClientConfigurationBuilder builder(TokenProvider tokenProvider) {
        return new HttpClientConfigurationBuilder(tokenProvider);
    }

    public static class HttpClientConfigurationBuilder {
        private HttpClientConfiguration configuration;

        private HttpClientConfigurationBuilder(TokenProvider tokenProvider) {
            this.configuration = new HttpClientConfiguration(tokenProvider, DEFAULT_TIMEOUT_MILLIS, DEFAULT_TIMEOUT_MILLIS, DEFAULT_TIMEOUT_MILLIS, response -> {
                if (response.statusCode() < 200) {
                    throw new UnexpectedInformationalResponseException(response);
                }
                Function<Response, HttpResponseException> exceptionConstructor = switch (response.statusCode()) {
                    case 400 -> BadRequestException::new;
                    case 401 -> UnauthorizedException::new;
                    case 403 -> ForbiddenException::new;
                    case 404 -> NotFoundException::new;
                    case 405 -> MethodNotAllowedException::new;
                    case 406 -> NotAcceptableException::new;
                    case 408 -> RequestTimeoutException::new;
                    case 418 -> ImATeapotException::new;
                    case 500 -> InternalServerErrorException::new;
                    case 503 -> ServiceUnavailableException::new;
                    default -> UnexpectedHttpResponseException::new;
                };
                throw exceptionConstructor.apply(response);
            });
        }

        /**
         * Sets the connect timeout.
         *
         * @param millis The amount of milliseconds that the client will wait on connection before timing out.
         */
        public HttpClientConfigurationBuilder withConnectTimeoutMillis(Long millis) {
            this.configuration.connectTimeoutMillis = millis;
            return this;
        }

        /**
         * Sets the connect timeout.
         *
         * @param amount   The amount of time units that the client will wait on connection before timing out.
         * @param timeUnit The {@link TimeUnit} of the timeout to set.
         */
        public HttpClientConfigurationBuilder withConnectTimeout(int amount, TimeUnit timeUnit) {
            this.configuration.connectTimeoutMillis = timeUnit.toMillis(amount);
            return this;
        }

        /**
         * Sets the read timeout.
         *
         * @param millis The amount of milliseconds that the client will wait on reading the response before timing out.
         */
        public HttpClientConfigurationBuilder withReadTimeoutMillis(Long millis) {
            this.configuration.readTimeoutMillis = millis;
            return this;
        }

        /**
         * Sets the read timeout.
         *
         * @param amount   The amount of time units that the client will wait on reading the response before timing out.
         * @param timeUnit The {@link TimeUnit} of the timeout to set.
         */
        public HttpClientConfigurationBuilder withReadTimeout(int amount, TimeUnit timeUnit) {
            this.configuration.readTimeoutMillis = timeUnit.toMillis(amount);
            return this;
        }

        /**
         * Sets the write timeout.
         *
         * @param millis The amount of milliseconds that the client will wait on writing before timing out.
         */
        public HttpClientConfigurationBuilder withWriteTimeoutMillis(Long millis) {
            this.configuration.writeTimeoutMillis = millis;
            return this;
        }

        /**
         * Sets the write timeout.
         *
         * @param amount   The amount of time units that the client will wait on writing before timing out.
         * @param timeUnit The {@link TimeUnit} of the timeout to set.
         */
        public HttpClientConfigurationBuilder withWriteTimeout(int amount, TimeUnit timeUnit) {
            this.configuration.writeTimeoutMillis = timeUnit.toMillis(amount);
            return this;
        }

        /**
         * Sets the error handling strategy.
         *
         * @return strategy Strategy for handling status codes that are not 2XX. By default, an exception is thrown.
         */
        public HttpClientConfigurationBuilder withErrorHandlingStrategy(Function<Response, Response> strategy) {
            this.configuration.errorHandlingStrategy = strategy;
            return this;
        }

        public HttpClientConfiguration build() {
            return configuration;
        }
    }
}
