package io.polyapi.plugin.service.schema;

import com.fasterxml.jackson.databind.JsonNode;
import org.jsonschema2pojo.FragmentResolver;
import org.jsonschema2pojo.JsonPointerUtils;

import java.net.URLDecoder;
import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.List;

import static java.lang.String.format;
import static java.util.Arrays.asList;
import static org.apache.commons.lang3.StringUtils.split;

/**
 * Class that copies parent {@link FragmentResolver} but that adds a {@link URLDecoder#decode(String, Charset)} to the part to evaluate it.
 */
public class PolyFragmentResolver extends FragmentResolver {
    public JsonNode resolve(JsonNode tree, String path, String refFragmentPathDelimiters) {
        return resolve(tree, new ArrayList<>(asList(split(path, refFragmentPathDelimiters))));
    }

    private JsonNode resolve(JsonNode tree, List<String> path) {
        if (path.isEmpty()) {
            return tree;
        } else {
            String part = path.remove(0);
            if (tree.isArray()) {
                try {
                    int index = Integer.parseInt(part);
                    return resolve(tree.get(index), path);
                } catch (NumberFormatException e) {
                    throw new IllegalArgumentException("Not a valid array index: " + part);
                }
            }
            String decodedPart = JsonPointerUtils.decodeReferenceToken(URLDecoder.decode(part.replace("+","%2B"), Charset.defaultCharset()));
            if (tree.has(decodedPart)) {
                return resolve(tree.get(decodedPart), path);
            } else {
                throw new IllegalArgumentException("Path not present: " + decodedPart);
            }
        }

    }
}
