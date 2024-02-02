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
    FunctionType type() default FunctionType.SERVER;

    String context() default "";

    String name() default "";

    boolean isDeployable() default true;
}
