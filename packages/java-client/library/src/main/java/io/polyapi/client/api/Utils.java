package io.polyapi.client.api;

import java.util.HashMap;
import java.util.Map;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import com.google.gson.JsonArray;

public class Utils {
  public static <T> Map<String, T> jsonObjectToMap(JSONObject jsonObject) throws JSONException {
    var map = new HashMap<String, T>();
    var keys = jsonObject.keys();
    while (keys.hasNext()) {
      var key = (String) keys.next();
      Object value = jsonObject.get(key);
      if (value instanceof JSONObject) {
        value = jsonObjectToMap((JSONObject) value);
      }
      map.put(key, (T) value);
    }
    return map;
  }

  public static JsonArray toJsonArray(String[] array) {
    var jsonArray = new JsonArray();
    for (var item : array) {
      jsonArray.add(item);
    }
    return jsonArray;
  }
}
