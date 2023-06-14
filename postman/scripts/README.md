## Postman
### Setup Pre-request script
Copy content of `pre-request.js` to `Pre-request Script` tab in Postman Collection/Folder/Request.\

### Setup Tests script
Copy content of `post-request.js` to `Tests` tab in Postman Collection/Folder/Request.\
Set `polyApiKey` environment variable to your Poly API key.

### Run Collection/Folder/Request
Run Collection/Folder/Request in Postman to teach Poly API with about the requests.

### Custom Poly data
You can set function name, context, description and/or response payload for a specific request, by adding Pre-request Script to the request.
```javascript
pm.environment.set('polyData', {
  name: 'myFunction',
  description: 'My function description',
  context: 'myContext',
  payload: '$.results[0].geometry.location'
});
```
`name`, `context` `description` and `payload` are optional.
`payload` is using [JSONPath format](https://goessner.net/articles/JsonPath/index.html#e2)

### Retraining rules

If when we are training an api function, Poly finds a previously saved api function (in database) with same [origin](https://developer.mozilla.org/en-US/docs/Web/API/URL/origin), [pathname](https://developer.mozilla.org/en-US/docs/Web/API/URL/pathname) and [postman arguments](https://learning.postman.com/docs/sending-requests/variables) don't differ between new training api function and the found one, Poly retrains the found function with details about new training one.

Users could want avoid this implicitly retraining behavior by creating a new api function, for instance if they want to add new hardcoded values to query params, headers or body data.
If you want to explicitly create a new api function version with those hardocded values, you can provide inside `polyData` environment variable, an `id: 'new'`:

```javascript
pm.environment.set('polyData', {
  id: 'new'
});
```

In an opposite case, when training an api function and Poly can't find a previously saved api function with same origin and pathname, or it finds an api function with same origin and pathname but Postman arguments differ, it will create a new api function. If you want to explicitly retrain a specific api function, you can pass api function identifier in `polyData` environment variable.

```javascript
pm.environment.set('polyData', {
  id: '2915f8c3-1740-4d3b-8165-510d4089c580'
});
```

In both cases `id` field is optional, if not provided, retraining/creating new function will be decided by Poly.
