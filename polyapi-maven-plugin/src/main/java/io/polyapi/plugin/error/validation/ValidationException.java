package io.polyapi.plugin.error.validation;

import io.polyapi.plugin.error.PolyApiMavenPluginException;
import lombok.Getter;

import static java.lang.String.format;

/**
 * Parent class for exceptions thrown for validation purposes. Stores the name of the property being validated and injects it into the message.
 */
@Getter
public class ValidationException extends PolyApiMavenPluginException {

    private final String propertyName;

    /**
     * Constructor that takes the propertyName and a message template and generates the message with them.
     *
     * @param propertyName    The name of the property being validated.
     * @param messageTemplate The message template.
     */
    public ValidationException(String propertyName, String messageTemplate) {
        super(format(messageTemplate, propertyName));
        this.propertyName = propertyName;
    }

    /**
     * Constructor that takes the propertyName and a message template and generates the message with them. It also includes the cause of the exception.
     *
     * @param propertyName    The name of the property being validated.
     * @param messageTemplate The message template.
     * @param cause           The cause of the exception.
     */
    public ValidationException(String propertyName, String messageTemplate, Throwable cause) {
        super(format(messageTemplate, propertyName), cause);
        this.propertyName = propertyName;
    }
}
