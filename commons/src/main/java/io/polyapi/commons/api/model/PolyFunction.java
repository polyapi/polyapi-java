package io.polyapi.commons.api.model;

import java.lang.annotation.Retention;
import java.lang.annotation.Target;

import static java.lang.annotation.ElementType.METHOD;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

/**
 * Annotation that marks a specific method as a Poly function.
 * When uploading functions,
 */
@Target(METHOD)
@Retention(RUNTIME)
public @interface PolyFunction {
    String AUTO_DETECT_CONTEXT = "-autodetect-";

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
    boolean deployFunction() default true;

    /**
     * Comma separated value that indicates the contexts that the function must be aware of when executing.
     * <p>If this is set, then when uploading the function, only the functions within the indicated contexts will be
     * selected as well as any in any subcontext. For example, if setting this to 'polyapi.sample,polyapi.example', then
     * all the functions within the `polyapi.sample` and `polyapi.example` will be available for the function as well as
     * functions within a `polyapi.sample.value` subcontext, but not functions within `polyapi.others` nor within
     * `polyapi.sample1`. If no value is set for this, then the code will be scanned for functions or server variables and their contexts will be added automatically.</p>
     * <p></p>This is an attribute for performance purposes. Removing availability of a context containing a Poly function that
     * is being used may lead to deployment failure.</p>
     *
     * @return String The comma separated value indicating the contexts available for the function.
     */
    String contextAwareness() default AUTO_DETECT_CONTEXT;
}
