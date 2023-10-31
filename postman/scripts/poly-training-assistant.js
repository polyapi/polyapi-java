const postmanCollection = require('postman-collection');

const scriptVersion = '0.1.0';

const templateBodyParts = pm.request.body.raw.split('{');

let shouldEncode = pm.request.url.getPath().match(/^\/functions\/api\/[-,0-9,a-z]{36}$/) !== null;

templateBodyParts[1] = `"templateBody": ${shouldEncode ? `"${btoa(pm.request.body.raw)}"` : JSON.stringify(pm.request.body.raw)}, ${templateBodyParts[1]}`


pm.request.update({
  body: new postmanCollection.RequestBody({
    mode: 'raw',
    raw: templateBodyParts.join('{'),
    options: {
      raw: {
        language: 'json'
      }
    }
  })
});

pm.request.headers.add({
  key: 'x-poly-training-assistant-version',
  value: scriptVersion
});
