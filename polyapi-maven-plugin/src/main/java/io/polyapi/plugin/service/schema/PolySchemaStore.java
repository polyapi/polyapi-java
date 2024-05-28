package io.polyapi.plugin.service.schema;

import com.fasterxml.jackson.databind.JsonNode;
import org.jsonschema2pojo.FragmentResolver;
import org.jsonschema2pojo.Schema;
import org.jsonschema2pojo.SchemaStore;

import java.net.URI;
import java.net.URISyntaxException;

import static org.apache.commons.lang3.StringUtils.*;

/**
 * This class is a copy of the parent {@link SchemaStore} with the difference that uses a {@link PolyFragmentResolver} instead of a {@link FragmentResolver}.
 */
public class PolySchemaStore extends SchemaStore {
    protected final FragmentResolver fragmentResolver = new PolyFragmentResolver();

    /**
     * Create or look up a new schema which has the given ID and read the
     * contents of the given ID as a URL. If a schema with the given ID is
     * already known, then a reference to the original schema will be returned.
     *
     * @param id                        the id of the schema being created
     * @param refFragmentPathDelimiters A string containing any characters
     *                                  that should act as path delimiters when resolving $ref fragments.
     * @return a schema object containing the contents of the given path
     */
    public synchronized Schema create(URI id, String refFragmentPathDelimiters) {

        URI normalizedId = id.normalize();

        if (!schemas.containsKey(normalizedId)) {

            URI baseId = removeFragment(id).normalize();
            if (!schemas.containsKey(baseId)) {
                logger.debug("Reading schema: " + baseId);
                final JsonNode baseContent = contentResolver.resolve(baseId);
                schemas.put(baseId, new Schema(baseId, baseContent, null));
            }

            final Schema baseSchema = schemas.get(baseId);
            if (normalizedId.toString().contains("#")) {
                JsonNode childContent = fragmentResolver.resolve(baseSchema.getContent(), '#' + id.getFragment(), refFragmentPathDelimiters);
                schemas.put(normalizedId, new Schema(normalizedId, childContent, baseSchema));
            }
        }

        return schemas.get(normalizedId);
    }

    /**
     * Create or look up a new schema using the given schema as a parent and the
     * path as a relative reference. If a schema with the given parent and
     * relative path is already known, then a reference to the original schema
     * will be returned.
     *
     * @param parent                    the schema which is the parent of the schema to be created.
     * @param path                      the relative path of this schema (will be used to create a
     *                                  complete URI by resolving this path against the parent
     *                                  schema's id)
     * @param refFragmentPathDelimiters A string containing any characters
     *                                  that should act as path delimiters when resolving $ref fragments.
     * @return a schema object containing the contents of the given path
     */
    @SuppressWarnings("PMD.UselessParentheses")
    public Schema create(Schema parent, String path, String refFragmentPathDelimiters) {
        if (!path.equals("#")) {
            // if path is an empty string then resolving it below results in jumping up a level. e.g. "/path/to/file.json" becomes "/path/to"
            path = stripEnd(path, "#?&/");
        }

        // encode the fragment for any funny characters
        if (path.contains("#")) {
            String pathExcludingFragment = substringBefore(path, "#");
            String fragment = substringAfter(path, "#");
            URI fragmentURI;
            try {
                fragmentURI = new URI(null, null, fragment);
            } catch (URISyntaxException e) {
                throw new IllegalArgumentException("Invalid fragment: " + fragment + " in path: " + path);
            }
            path = pathExcludingFragment + "#" + fragmentURI.getRawFragment();
        }
        URI id = (parent == null || parent.getId() == null) ? URI.create(path) : parent.getId().resolve(path);
        String stringId = id.toString();
        if (stringId.endsWith("#")) {
            try {
                id = new URI(stripEnd(stringId, "#"));
            } catch (URISyntaxException e) {
                throw new IllegalArgumentException("Bad path: " + stringId);
            }
        }
        if (selfReferenceWithoutParentFile(parent, path) || substringBefore(stringId, "#").isEmpty()) {
            JsonNode parentContent = parent.getGrandParent().getContent();
            if (schemas.containsKey(id)) {
                return schemas.get(id);
            } else {
                Schema schema = new Schema(id, fragmentResolver.resolve(parentContent, path, refFragmentPathDelimiters), parent.getGrandParent());
                schemas.put(id, schema);
                return schema;
            }
        }
        return create(id, refFragmentPathDelimiters);
    }
}
