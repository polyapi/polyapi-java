package io.polyapi.commons.internal.json;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjetland.jackson.jsonSchema.JsonSchemaGenerator;
import io.polyapi.commons.api.error.parse.JsonToObjectParsingException;
import io.polyapi.commons.api.error.parse.ObjectToJsonParsingException;
import io.polyapi.commons.api.json.JsonParser;
import org.apache.commons.io.IOUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Type;
import java.nio.charset.Charset;
import java.util.Optional;

import static com.fasterxml.jackson.databind.type.TypeFactory.defaultInstance;
import static java.nio.charset.Charset.defaultCharset;

/**
 * Wrapper class around the Jackson mapping library to handle all the errors it can throw and unify all the configuration for it.
 */
public class JacksonJsonParser implements JsonParser {
  private static final Logger logger = LoggerFactory.getLogger(JsonParser.class);
  private final ObjectMapper objectMapper;
  private final JsonSchemaGenerator jsonSchemaGenerator;

  /**
   * Utility constructor that uses a standard {@link ObjectMapper} instance.
   */
  public JacksonJsonParser() {
    this(new ObjectMapper());
  }

  /**
   * Default constructor that receives an {@link ObjectMapper}.
   *
   * @param objectMapper The object mapper.
   */
  public JacksonJsonParser(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
    this.jsonSchemaGenerator = new JsonSchemaGenerator(objectMapper);
  }

  /**
   * @see JsonParser#toJsonString(Object)
   */
  @Override
  public String toJsonString(Object object) {
    try {
      logger.debug("Parsing object of type {} to String.", object.getClass().getSimpleName());
      String result = objectMapper.writeValueAsString(object);
      logger.debug("Parsing successful.");
      if (logger.isTraceEnabled()) {
        logger.trace("Parsed result is:\n{}", result);
      }
      return result;
    } catch (JsonProcessingException e) {
      throw new ObjectToJsonParsingException(object, e);
    }
  }

  /**
   * @see JsonParser#toJsonInputStream(Object)
   */
  @Override
  public InputStream toJsonInputStream(Object object) {
    try {
      logger.debug("Parsing object of type {} to InputStream.", Optional.ofNullable(object).map(Object::getClass).map(Class::getName).orElse("null"));
      InputStream result = new ByteArrayInputStream(object == null ? new byte[]{} : objectMapper.writeValueAsBytes(object));
      logger.debug("Parsing successful.");
      if (logger.isTraceEnabled()) {
        logger.trace("Parsed result is:\n{}", IOUtils.toString(result, defaultCharset()));
        logger.trace("Resetting InputStream.");
        result.reset();
        logger.trace("InputStream reset.");
      }
      return result;
    } catch (IOException e) {
      throw new ObjectToJsonParsingException(object, e);
    }
  }

  /**
   * @see JsonParser#parseString(String, Type)
   */
  @Override
  public <O> O parseString(String json, Type expectedResponseType) {
    try {
      if (logger.isTraceEnabled()) {
        logger.trace("Input to parse is:\n{}", json);
      }
      logger.debug("Parsing JSon String to object of type {}.", expectedResponseType.getTypeName());
      O result = objectMapper.readValue(json, defaultInstance().constructType(expectedResponseType));
      logger.debug("Parsing successful.");
      return result;
    } catch (IOException e) {
      throw new JsonToObjectParsingException(json, expectedResponseType, e);
    }
  }

  /**
   * @see JsonParser#parseInputStream(InputStream, Type)
   */
  @Override
  public <O> O parseInputStream(InputStream json, Type expectedResponseType) {
    try {
      if (logger.isTraceEnabled()) {
        logger.trace("Converting InputStream to String to be able to log its contents.");
        String compiledInputStream = IOUtils.toString(json, defaultCharset());
        logger.trace("Input to parse is:\n{}", compiledInputStream);
        logger.trace("Creating ByteArrayInputStream with the printed contents and using this instead of the argument.");
        json = new ByteArrayInputStream(compiledInputStream.getBytes(defaultCharset()));
        logger.trace("ByteArrayInputStream created successfully.");
      }
      logger.debug("Parsing JSon InputStream to object of type {}.", expectedResponseType.getTypeName());

      O result;
      if (expectedResponseType == String.class) {
        result = (O) IOUtils.toString(json, Charset.defaultCharset());
      } else {
        result = objectMapper.readValue(json, defaultInstance().constructType(expectedResponseType));
      }

      logger.debug("Parsing successful.");
      return result;
    } catch (IOException e) {
      throw new JsonToObjectParsingException(json, expectedResponseType, e);
    }
  }

  /**
   * @see JsonParser#toJsonSchema(Type)
   */
  @Override
  public String toJsonSchema(Type type) {
    logger.debug("Generating JSon schema for class '{}'", type.getTypeName());
    JsonNode schema = jsonSchemaGenerator.generateJsonSchema(defaultInstance().constructType(type));
    logger.debug("Schema generated. Converting to String.");
    String result = toJsonString(schema);
    logger.debug("JSon converted successfully.");
    return result;
  }
}
