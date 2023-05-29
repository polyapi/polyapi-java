const postmanCollection = require('postman-collection');

const polyData = pm.environment.get('polyData');
const apiKey = pm.environment.get('X-PolyApiKey');
const { method, description, url, body } = pm.request;

const templateBody = new postmanCollection.RequestBody(pm.environment.get('templateBody'));
const templateHeaders = new postmanCollection.HeaderList(null, pm.environment.get('templateHeaders'));
const templateAuth = new postmanCollection.RequestAuth(pm.environment.get('templateAuth'));
const templateUrl = new postmanCollection.Url(pm.environment.get('templateUrl'));

pm.environment.unset('polyData');
pm.environment.unset('polyFunctionId');

pm.environment.unset('templateBody');
pm.environment.unset('templateHeaders');
pm.environment.unset('templateAuth');
pm.environment.unset('templateUrl');

let response;

const contentType = pm.response.headers.get('content-type') || '';

if(contentType.match(/application\/json/) !== null) {
    response = pm.response.json();
} else {
    response = pm.response.text();
}

const postRequest = {
  url: 'https://staging.polyapi.io/teach',
  method: 'POST',
  header: {
    'Content-Type': 'application/json',
    'X-PolyApiKey': apiKey,
  },
  body: {
    mode: 'raw',
    raw: JSON.stringify({
      description: description?.context,
      requestName: pm.info.requestName,
      ...polyData,
      url,
      body,
      templateHeaders,
      method,
      templateAuth,
      response,
      variables: {
        ...pm.environment.toObject(),
        ...pm.collectionVariables.toObject(),
      },
      statusCode: pm.response.code,
      templateUrl: `${templateUrl.protocol ? `${templateUrl.protocol}://` : ''}${templateUrl.getRemote()}${templateUrl.getPathWithQuery()}`,
      templateBody
    }),
  },
};

pm.sendRequest(postRequest, (error) => {
  if (error) {
    console.log(error);
  }
});
