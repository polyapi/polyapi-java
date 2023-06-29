const { headers, body, auth, url } = pm.request;

pm.environment.set('templateHeaders', headers);
pm.environment.set('templateBody', body);
pm.environment.set('templateAuth', auth);
pm.environment.set('templateUrl', url);

/*
    You can use code snippets bellow in specific requests to change Poly behavior when training.
    WARNING: Don't use them in collection pre-request and/or post-request, if you use them in collection level they will affect all requests
    inside collection.
*/

/**
 * To set api context, description and/or name you can do:
 * pm.environment.set('polyData', {
 *   description: 'lorem ipsum...',
 *   name: 'createPost',
 *   context: 'jsonplaceholder
 * });
 */

/**
 * To set response payload path you can do:
 * pm.environment.set('polyData', {
 *   payload: '$.results[0].geometry.location'
 * });
 */

/**
 * To explicitly create a new api function and skip retraining rules, pass { id: 'new' } to polyData environment variable:
 * pm.environment.set('polyData', {
 *   id: 'new'
 * });
 */

/**
 * To explicitly override a saved api function, pass { id: string } with api function id to polyData environment variable:
 * pm.environment.set('polyData', {
 *   id: '2915f8c3-1740-4d3b-8165-510d4089c580'
 * });
 */
