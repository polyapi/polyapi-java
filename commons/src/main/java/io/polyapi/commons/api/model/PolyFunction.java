package io.polyapi.commons.api.model;

import java.lang.annotation.Retention;
import java.lang.annotation.Target;

import static java.lang.Boolean.FALSE;
import static java.lang.annotation.ElementType.METHOD;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

/**
 * Annotation that marks a specific method as a Poly function.
 * When uploading functions,
 */
@Target(METHOD)
@Retention(RUNTIME)
public @interface PolyFunction {

    /**
     * Enum that describes the type of function and where will be executed when invoked.
     *
     * @return FunctionType The type of the function.
     */
    FunctionType type() default FunctionType.SERVER;

    /**
     * The context that holds the function. If not set, it will default to the class package.
     *
     * @return String The context.
     */
    String context() default "";

    /**
     * The name of the function. If not set, it will default to the method name.
     *
     * @return String The name of the function.
     */
    String name() default "";

    /**
     * Flag indicating if the annotated method is a valid server function to deploy. This is present because functions generated with Poly shouldn't be deployable.
     *
     * @return boolean The flag indicating if this function is to be deployed.
     */
    boolean isDeployable() default true;
}
