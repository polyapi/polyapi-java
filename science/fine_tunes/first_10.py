FIRST_10 = [
    {
        "prompt": """To import the Poly API Library:
`import poly from 'polyapi'`

Use any combination of only the following functions to answer my question:

// id: 1f74882e-a6cb-4975-a580-dfc25b65a1dc
// type: apiFunction
// description: This API call is used to send a message via Twilio. The request payload includes the 'To', 'From', and 'Body' parameters, representing the recipient's number, sender's number, and the message content respectively. The response payload provides information about the sent message, including its status
// returns {"data": {"kind": "object", "schema": {"$schema": "http://json-schema.org/draft-06/schema#", "definitions": {"SubresourceUris": {"type": "object", "additionalProperties": false, "properties": {"media": {"type": "string"}}, "required": ["media"], "title": "SubresourceUris"}}, "type": "object", "additionalProperties": false, "properties": {"body": {"type": "string"}, "num_segments": {"type": "string", "format": "integer"}, "direction": {"type": "string"}, "from": {"type": "string"}, "date_updated": {"type": "string"}, "price": {"type": "null"}, "error_message": {"type": "null"}, "uri": {"type": "string"}, "account_sid": {"type": "string"}, "num_media": {"type": "string", "format": "integer"}, "to": {"type": "string"}, "date_created": {"type": "string"}, "status": {"type": "string"}, "sid": {"type": "string"}, "date_sent": {"type": "null"}, "messaging_service_sid": {"type": "null"}, "error_code": {"type": "null"}, "price_unit": {"type": "string"}, "api_version": {"type": "string", "format": "date"}, "subresource_uris": {"$ref": "#/definitions/SubresourceUris"}}, "required": ["account_sid", "api_version", "body", "date_created", "date_sent", "date_updated", "direction", "error_code", "error_message", "from", "messaging_service_sid", "num_media", "num_segments", "price", "price_unit", "sid", "status", "subresource_uris", "to", "uri"], "title": "ResponseType"}}}
poly.PS.twilio.messages.send1(
toNumber: string,
message: string,
)
""",
        "question": "how do I send an sms through Twilio?",
        "completion": """Sure, here's an example of how you can do it:

```typescript
import poly from 'polyapi';

async function sendSMS() {
    const toNumber = '+1234567890'; // replace with the recipient's number
    const message = 'Hello, this is a test message'; // replace with your message

    try {
        const response = await poly.PS.twilio.messages.send1(toNumber, message);
        console.log('Message sent successfully', response);
    } catch (error) {
        console.error('Failed to send message', error);
    }
}

sendSMS();
```

In this example, replace '+1234567890' with the recipient's phone number and 'Hello, this is a test message' with your desired message. The `poly.PS.twilio.messages.send1` function sends the message and returns a promise. If the message is sent successfully, the promise is resolved and the response is logged to the console. If there's an error (like a network issue or invalid parameters), the promise is rejected and the error is logged to the console.
""",
    },
    {
        "prompt": """To import the Poly API Library:
`import poly from 'polyapi'`

Use any combination of only the following functions to answer my question:

// id: 58688056-a219-4af2-94a0-e65c6b6cf8ba
// type: apiFunction
// description: This API call retrieves detailed information about a specific product in a Shopify online store. It retrieves information on product title, description, vendor, product type, creation and update times, published status, product variants and options, quantity and other details related to the product. The call takes a GET request with the product's unique identifier as an input parameter.
// returns {"data": {"kind": "object", "schema": {"$schema": "http://json-schema.org/draft-06/schema#", "definitions": {"Product": {"type": "object", "additionalProperties": false, "properties": {"id": {"type": "integer"}, "title": {"type": "string"}, "body_html": {"type": "string"}, "vendor": {"type": "string"}, "product_type": {"type": "string"}, "created_at": {"type": "string", "format": "date-time"}, "handle": {"type": "string"}, "updated_at": {"type": "string", "format": "date-time"}, "published_at": {"$ref": "#/definitions/Image"}, "template_suffix": {"$ref": "#/definitions/Image"}, "status": {"type": "string"}, "published_scope": {"type": "string"}, "tags": {"type": "string"}, "admin_graphql_api_id": {"type": "string"}, "variants": {"type": "array", "items": {"$ref": "#/definitions/Variant"}}, "options": {"type": "array", "items": {"$ref": "#/definitions/Option"}}, "images": {"type": "array", "items": {}}, "image": {"$ref": "#/definitions/Image"}}, "required": ["admin_graphql_api_id", "body_html", "created_at", "handle", "id", "image", "images", "options", "product_type", "published_at", "published_scope", "status", "tags", "template_suffix", "title", "updated_at", "variants", "vendor"], "title": "Product"}, "Image": {"type": "object", "additionalProperties": false, "title": "Image"}, "Option": {"type": "object", "additionalProperties": false, "properties": {"id": {"type": "integer"}, "product_id": {"type": "integer"}, "name": {"type": "string"}, "position": {"type": "integer"}, "values": {"type": "array", "items": {"type": "string"}}}, "required": ["id", "name", "position", "product_id", "values"], "title": "Option"}, "Variant": {"type": "object", "additionalProperties": false, "properties": {"id": {"type": "integer"}, "product_id": {"type": "integer"}, "title": {"type": "string"}, "price": {"type": "string"}, "sku": {"type": "string"}, "position": {"type": "integer"}, "inventory_policy": {"type": "string"}, "compare_at_price": {"$ref": "#/definitions/Image"}, "fulfillment_service": {"type": "string"}, "inventory_management": {"$ref": "#/definitions/Image"}, "option1": {"type": "string"}, "option2": {"$ref": "#/definitions/Image"}, "option3": {"$ref": "#/definitions/Image"}, "created_at": {"type": "string", "format": "date-time"}, "updated_at": {"type": "string", "format": "date-time"}, "taxable": {"type": "boolean"}, "barcode": {"type": "string"}, "grams": {"type": "integer"}, "image_id": {"$ref": "#/definitions/Image"}, "weight": {"type": "integer"}, "weight_unit": {"type": "string"}, "inventory_item_id": {"type": "integer"}, "inventory_quantity": {"type": "integer"}, "old_inventory_quantity": {"type": "integer"}, "requires_shipping": {"type": "boolean"}, "admin_graphql_api_id": {"type": "string"}}, "required": ["admin_graphql_api_id", "barcode", "compare_at_price", "created_at", "fulfillment_service", "grams", "id", "image_id", "inventory_item_id", "inventory_management", "inventory_policy", "inventory_quantity", "old_inventory_quantity", "option1", "option2", "option3", "position", "price", "product_id", "requires_shipping", "sku", "taxable", "title", "updated_at", "weight", "weight_unit"], "title": "Variant"}}, "type": "object", "additionalProperties": false, "properties": {"product": {"$ref": "#/definitions/Product"}}, "required": ["product"], "title": "ResponseType"}}}
poly.PS.shopify.products.getProductDetails(
shop: string,
productId: number,
shopToken: string,
)
""",
        "question": "how do I get product details via shopify?",
        "completion": """Certainly! You can use the `getProductDetails` function from the Poly API library to get product details from Shopify. Here's an example:

```typescript
import poly from 'polyapi';

async function getProductDetails() {
    const shop = 'your-shop-name'; // replace with your shop name
    const productId = 123456; // replace with your product id
    const shopToken = 'your-shop-token'; // replace with your shop token

    try {
        const response = await poly.PS.shopify.products.getProductDetails(shop, productId, shopToken);
        console.log('Product details:', response);
    } catch (error) {
        console.error('Failed to get product details', error);
    }
}

getProductDetails();
```

In this example, replace 'your-shop-name' with your Shopify shop name, '123456' with the ID of the product you want to get details for, and 'your-shop-token' with your Shopify shop token. The `poly.PS.shopify.products.getProductDetails` function sends a GET request to Shopify and returns a promise. If the request is successful, the promise is resolved and the product details are logged to the console. If there's an error (like a network issue or invalid parameters), the promise is rejected and the error is logged to the console.
""",
    },
    {
        "prompt": """To import the Poly API Library:
`import poly from 'polyapi'`

Use any combination of only the following functions to answer my question:

// id: 0b9cd4d4-0533-48ac-b10d-9fa2f972b811
// type: apiFunction
// description: This API call is used to create a new bird record in the pstmn database. It includes details such as the bird's common name, scientific name, lifespan, size, features, and diet.
// returns {"data": {"kind": "object", "schema": {"$schema": "http://json-schema.org/draft-06/schema#", "definitions": {"Diet": {"type": "object", "additionalProperties": false, "properties": {"type": {"type": "string"}, "percentage": {"type": "integer"}}, "required": ["percentage", "type"], "title": "Diet"}, "Features": {"type": "object", "additionalProperties": false, "properties": {"color": {"type": "string"}, "beak": {"type": "string"}, "wings": {"type": "array", "items": {"type": "string"}}}, "required": ["beak", "color", "wings"], "title": "Features"}, "Size": {"type": "object", "additionalProperties": false, "properties": {"height": {"type": "integer"}, "weight": {"type": "integer"}}, "required": ["height", "weight"], "title": "Size"}}, "type": "object", "additionalProperties": false, "properties": {"id": {"type": "integer"}, "name": {"type": "string"}, "scientificName": {"type": "string"}, "lifespan": {"type": "integer"}, "size": {"$ref": "#/definitions/Size"}, "features": {"$ref": "#/definitions/Features"}, "diet": {"type": "array", "items": {"$ref": "#/definitions/Diet"}}}, "required": ["diet", "features", "id", "lifespan", "name", "scientificName", "size"], "title": "ResponseType"}}}
poly.pstmn.birds.create1(
token: string,
birdObject: {
name: string,
scientificName: string,
lifespan: integer,
size: {
height: integer,
weight: integer
},
features: {
color: string,
beak: string,
wings: [string]
},
diet: [{
type: string,
percentage: integer
}]
},
)

// id: aa2e20bf-2cb1-4f9b-aeb3-da3010378478
// type: apiFunction
// description: This API call is used to create a new bird entry in the pstmn database. It includes details such as the bird's common name, scientific name, lifespan, size, features, and diet.
// returns {"data": {"kind": "object", "schema": {"$schema": "http://json-schema.org/draft-06/schema#", "definitions": {"Diet": {"type": "object", "additionalProperties": false, "properties": {"type": {"type": "string"}, "percentage": {"type": "integer"}}, "required": ["percentage", "type"], "title": "Diet"}, "Features": {"type": "object", "additionalProperties": false, "properties": {"color": {"type": "string"}, "beak": {"type": "string"}, "wings": {"type": "array", "items": {"type": "string"}}}, "required": ["beak", "color", "wings"], "title": "Features"}, "Size": {"type": "object", "additionalProperties": false, "properties": {"height": {"type": "integer"}, "weight": {"type": "integer"}}, "required": ["height", "weight"], "title": "Size"}}, "type": "object", "additionalProperties": false, "properties": {"id": {"type": "integer"}, "name": {"type": "string"}, "scientificName": {"type": "string"}, "lifespan": {"type": "integer"}, "size": {"$ref": "#/definitions/Size"}, "features": {"$ref": "#/definitions/Features"}, "diet": {"type": "array", "items": {"$ref": "#/definitions/Diet"}}}, "required": ["diet", "features", "id", "lifespan", "name", "scientificName", "size"], "title": "ResponseType"}}}
poly.pstmn.birds.create(
token: string,
payload: {
name: string,
scientificName: string,
maxAge: number,
height: number,
weight: number,
commaSeparatedColors: string,
beakColor: string,
wingsCharacteristics: [string],
dietList: [{
type: string,
percentage: integer
}],
},
)
""",
        "question": "how do I create a new bird in the pstmn database?",
        "completion": """Sure, you can use either the `create1` or `create` function from the `poly.pstmn.birds` API. Here's an example of how to use each:

Using `create1`:

```typescript
const token = 'your_token_here';
const birdObject = {
  name: 'Parrot',
  scientificName: 'Psittaciformes',
  lifespan: 80,
  size: {
    height: 40,
    weight: 1
  },
  features: {
    color: 'Green',
    beak: 'Short',
    wings: ['Colorful', 'Long']
  },
  diet: [{
    type: 'Fruits',
    percentage: 70
  }, {
    type: 'Seeds',
    percentage: 30
  }]
};

poly.pstmn.birds.create1(token, birdObject);
```

Using `create`:

```typescript
const token = 'your_token_here';
const payload = {
  name: 'Parrot',
  scientificName: 'Psittaciformes',
  maxAge: 80,
  height: 40,
  weight: 1,
  commaSeparatedColors: 'Green,Red',
  beakColor: 'Black',
  wingsCharacteristics: ['Colorful', 'Long'],
  dietList: [{
    type: 'Fruits',
    percentage: 70
  }, {
    type: 'Seeds',
    percentage: 30
  }]
};

poly.pstmn.birds.create(token, payload);
```

Make sure to replace `'your_token_here'` with your actual token.
""",
    },
    {
        "prompt": """To import the Poly API Library:
`import poly from 'polyapi'`

Use any combination of only the following functions to answer my question:

// id: 80ec9fd0-127c-456b-bc04-140333f59fee
// type: apiFunction
// description: Create a new task in Asana. Assign it to a project and section. Set the task name and notes. Returns the created task's details including project, section, creation and modification time, status, and URL.
// returns {"data": {"kind": "object", "schema": {"$schema": "http://json-schema.org/draft-06/schema#", "definitions": {"Data": {"type": "object", "additionalProperties": false, "properties": {"gid": {"type": "string"}, "projects": {"type": "array", "items": {"$ref": "#/definitions/Workspace"}}, "memberships": {"type": "array", "items": {"$ref": "#/definitions/Membership"}}, "resource_type": {"type": "string"}, "created_at": {"type": "string", "format": "date-time"}, "modified_at": {"type": "string", "format": "date-time"}, "name": {"type": "string"}, "notes": {"type": "string"}, "assignee": {"type": "null"}, "parent": {"type": "null"}, "actual_time_minutes": {"type": "integer"}, "completed": {"type": "boolean"}, "assignee_status": {"type": "string"}, "completed_at": {"type": "null"}, "due_on": {"type": "null"}, "due_at": {"type": "null"}, "resource_subtype": {"type": "string"}, "start_on": {"type": "null"}, "start_at": {"type": "null"}, "tags": {"type": "array", "items": {}}, "workspace": {"$ref": "#/definitions/Workspace"}, "num_hearts": {"type": "integer"}, "num_likes": {"type": "integer"}, "permalink_url": {"type": "string", "format": "uri", "qt-uri-protocols": ["https"]}, "hearted": {"type": "boolean"}, "hearts": {"type": "array", "items": {}}, "liked": {"type": "boolean"}, "likes": {"type": "array", "items": {}}, "followers": {"type": "array", "items": {"$ref": "#/definitions/Workspace"}}}, "required": ["actual_time_minutes", "assignee", "assignee_status", "completed", "completed_at", "created_at", "due_at", "due_on", "followers", "gid", "hearted", "hearts", "liked", "likes", "memberships", "modified_at", "name", "notes", "num_hearts", "num_likes", "parent", "permalink_url", "projects", "resource_subtype", "resource_type", "start_at", "start_on", "tags", "workspace"], "title": "Data"}, "Workspace": {"type": "object", "additionalProperties": false, "properties": {"gid": {"type": "string"}, "resource_type": {"type": "string"}, "name": {"type": "string"}}, "required": ["gid", "name", "resource_type"], "title": "Workspace"}, "Membership": {"type": "object", "additionalProperties": false, "properties": {"project": {"$ref": "#/definitions/Workspace"}, "section": {"$ref": "#/definitions/Workspace"}}, "required": ["project", "section"], "title": "Membership"}}, "type": "object", "additionalProperties": false, "properties": {"data": {"$ref": "#/definitions/Data"}}, "required": ["data"], "title": "ResponseType"}}}
// NOTE: please allow `response.data.data...` for this return type
poly.asana.tasks.create1(
asanaToken: string,  // A string that represents the user's Asana token. This is used for authentication and authorization to create a task in Asana.
projectId: number,  // A number that represents the ID of the project in Asana where the task will be created.
sectionId: number,  // A number that represents the ID of the section in the Asana project where the task will be created.
taskName: string,  // A string that represents the name of the task that will be created in Asana.
taskDetails: string,  // A string that represents the details or notes of the task that will be created in Asana.
)
""",
        "question": "how do I create a new task in asana?",
        "completion": """Sure, you can use the `create1` function from the `poly.asana.tasks` API. Here's an example of how to use it:

```typescript
import poly from 'polyapi';

const asanaToken = 'your_asana_token';
const projectId = 123456; // replace with your project ID
const sectionId = 78910; // replace with your section ID
const taskName = 'New Task';
const taskDetails = 'Details for the new task';

poly.asana.tasks.create1(asanaToken, projectId, sectionId, taskName, taskDetails)
  .then(response => {
    console.log(response.data);
  })
  .catch(error => {
    console.error(error);
  });
```

Make sure to replace `'your_asana_token'`, `123456`, `78910`, `'New Task'`, and `'Details for the new task'` with your actual Asana token, project ID, section ID, task name, and task details, respectively.
""",
    },
    {
        "prompt": """To import the Poly API Library:
`import poly from 'polyapi'`

Use any combination of only the following functions to answer my question:

// id: d8d04264-2181-496c-8521-7e3f30bee5dd
// type: apiFunction
// description: This API call retrieves the details of a specific task in Asana. It returns information such as the task's ID, assignee, status, completion status, creation time, followers, hearts, likes, memberships, modification time, name, notes, parent, projects, resource type, start time, tags, and workspace. https://developers.asana.com/reference/gettask
// returns {"data": {"kind": "object", "schema": {"$schema": "http://json-schema.org/draft-06/schema#", "definitions": {"Data": {"type": "object", "additionalProperties": false, "properties": {"gid": {"type": "string"}, "actual_time_minutes": {"type": "null"}, "assignee": {"type": "null"}, "assignee_status": {"type": "string"}, "completed": {"type": "boolean"}, "completed_at": {"type": "null"}, "created_at": {"type": "string", "format": "date-time"}, "due_at": {"type": "null"}, "due_on": {"type": "null"}, "followers": {"type": "array", "items": {"$ref": "#/definitions/Workspace"}}, "hearted": {"type": "boolean"}, "hearts": {"type": "array", "items": {}}, "liked": {"type": "boolean"}, "likes": {"type": "array", "items": {}}, "memberships": {"type": "array", "items": {"$ref": "#/definitions/Membership"}}, "modified_at": {"type": "string", "format": "date-time"}, "name": {"type": "string"}, "notes": {"type": "string"}, "num_hearts": {"type": "integer"}, "num_likes": {"type": "integer"}, "parent": {"type": "null"}, "permalink_url": {"type": "string", "format": "uri", "qt-uri-protocols": ["https"]}, "projects": {"type": "array", "items": {"$ref": "#/definitions/Workspace"}}, "resource_type": {"type": "string"}, "start_at": {"type": "null"}, "start_on": {"type": "null"}, "tags": {"type": "array", "items": {}}, "resource_subtype": {"type": "string"}, "workspace": {"$ref": "#/definitions/Workspace"}}, "required": ["actual_time_minutes", "assignee", "assignee_status", "completed", "completed_at", "created_at", "due_at", "due_on", "followers", "gid", "hearted", "hearts", "liked", "likes", "memberships", "modified_at", "name", "notes", "num_hearts", "num_likes", "parent", "permalink_url", "projects", "resource_subtype", "resource_type", "start_at", "start_on", "tags", "workspace"], "title": "Data"}, "Workspace": {"type": "object", "additionalProperties": false, "properties": {"gid": {"type": "string"}, "name": {"type": "string"}, "resource_type": {"type": "string"}}, "required": ["gid", "name", "resource_type"], "title": "Workspace"}, "Membership": {"type": "object", "additionalProperties": false, "properties": {"project": {"$ref": "#/definitions/Workspace"}, "section": {"$ref": "#/definitions/Workspace"}}, "required": ["project", "section"], "title": "Membership"}}, "type": "object", "additionalProperties": false, "properties": {"data": {"$ref": "#/definitions/Data"}}, "required": ["data"], "title": "ResponseType"}}}
// NOTE: please allow `response.data.data...` for this return type
poly.asana.tasks.getDetails(
taskId: number,  // This is a number that represents the unique identifier of the specific task in Asana. It is used to retrieve the details of the specific task.
asanaToken: string,  // This is a string that represents the user's authentication token for Asana. It is used to authenticate the user's account and grant access to the specific task details.
)
     """,
        "question": "how do I get the details of an asana task?",
        "completion": """Sure, to get the details of an Asana task, you'll need to use the `poly.asana.tasks.getDetails` function. Here's an example of how to use it:

```typescript
import poly from 'polyapi';

async function getTaskDetails(taskId: number, asanaToken: string) {
    const response = await poly.asana.tasks.getDetails(taskId, asanaToken);
    console.log(response.data);
}

// Use the function
getTaskDetails(12345, 'your_asana_token');
```

In this example, replace `12345` with your task ID and `'your_asana_token'` with your actual Asana token. The function will return the task details.
""",
    },
]
