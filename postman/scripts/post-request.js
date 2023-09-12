const postmanCollection = require('postman-collection');

const polyData = pm.environment.get('polyData');
const apiKey = pm.environment.get('polyApiKey');
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

if (contentType.match(/application\/json/) !== null) {
  response = pm.response.json();
} else {
  response = pm.response.text();
}

const collectionVariables = pm.collectionVariables.toObject();
const environmentVariables = pm.environment.toObject();

const rawObject = {
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
    ...environmentVariables,
    ...collectionVariables,
  },
  statusCode: pm.response.code,
  templateUrl: `${templateUrl.protocol ? `${templateUrl.protocol}://` : ''}${templateUrl.getRemote()}${templateUrl.getPathWithQuery()}`,
  templateBody,
};

const postRequest = {
  url: 'https://na1.polyapi.io/functions/api',
  method: 'POST',
  header: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  },
  body: {
    mode: 'raw',
    raw: JSON.stringify(rawObject),
  },
};

async function getIntrospectionData() {

  const headers = pm.request.headers.all().filter(value => !['Content-Length'].includes(value.key)).reduce((acum, header) => {
    const argumentPattern = /(?<=\{\{)([^}]+)(?=\})/gi;
    const parsedHeaderValue = header.value;
    const argumentsMatch = parsedHeaderValue.match(argumentPattern);

    if (argumentsMatch) {
      for (const pmArg of argumentsMatch) {
        const argValue = collectionVariables[pmArg] || environmentVariables[pmArg];

        if (argValue) {
          parsedHeaderValue.replace(`{{${pmArg}}}`, argValue);
        }
      }
    }

    return {
      ...acum,
      [header.key]: {
        ...header,
        value: parsedHeaderValue,
      },
    };

  }, {});

  const introspectionRequest = {
    url: url.toString(),
    method: 'POST',
    header: headers,
    body: {
      mode: 'raw',
      raw: JSON.stringify({
        query: 'query IntrospectionQuery{__schema{queryType{name}mutationType{name}subscriptionType{name}types{...FullType}directives{name description locations args{...InputValue}}}}fragment FullType on __Type{kind name description fields(includeDeprecated:true){name description args{...InputValue}type{...TypeRef}isDeprecated deprecationReason}inputFields{...InputValue}interfaces{...TypeRef}enumValues(includeDeprecated:true){name description isDeprecated deprecationReason}possibleTypes{...TypeRef}}fragment InputValue on __InputValue{name description type{...TypeRef}defaultValue}fragment TypeRef on __Type{kind name ofType{kind name ofType{kind name ofType{kind name ofType{kind name ofType{kind name ofType{kind name ofType{kind name}}}}}}}}',
      }),
    },
  };

  const response = await (new Promise((resolve, reject) => {
    pm.sendRequest(introspectionRequest, (error, response) => {

      if (error) {
        return reject(new Error('Graphql introspection call failed.'));
      }

      resolve(response);

    });
  }));

  return response.json();
}

function teachPoly(introspectionResponse) {
  return new Promise((resolve, reject) => {
    pm.sendRequest({
      ...postRequest,
      body: {
        ...postRequest.body,
        raw: introspectionResponse
          ? JSON.stringify({ ...rawObject, introspectionResponse })
          : JSON.stringify(rawObject),
      },
    }, (error, response) => {
      if (error) {
        return reject(error);
      }
      resolve(response);
    });
  });
}

(async () => {

  try {
    console.log('Training poly function...');

    let response = null;

    if (body.mode === 'graphql' && !polyData?.inferArgTypesFromPostmanGraphqlVariables) {

      console.log('Introspecting api...');

      const introspectionResponse = await getIntrospectionData();

      if (!introspectionResponse?.data?.__schema) {
        console.warn('Cannot introspect api, inferring argument types from postman graphql variables box...');
      }

      response = await teachPoly(introspectionResponse.data);

    } else {
      if(body.mode === 'graphql') {
        console.log('`inferArgTypesFromPostmanGraphqlVariables` flag activated, inferring argument types from postman graphql variables box...');
      }
      response = await teachPoly();
    }

    if (response.code >= 400) {
      return console.error(`Training call failed with status code ${response.code}`);
    }

    console.log('Function trained.');
  } catch (err) {
    console.log('Training of poly function failed.');
    console.error(err);
  }
})();

