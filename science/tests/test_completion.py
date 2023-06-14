import copy
from typing import List
from mock import Mock, patch
from app.utils import create_new_conversation
from load_fixtures import test_environment_get_or_create, test_user_get_or_create
from app.completion import (
    _id_extraction_fallback,
    get_best_function_example,
    get_function_options_prompt,
    get_best_function_messages,
    _extract_ids_from_completion,
)
from app.typedefs import ExtractKeywordDto, SpecificationDto
from .testing import DbTestCase

EXTRACTION_FALLBACK_EXAMPLE = """The following function can be used to get a list of products from a Shopify store and then log the first product:

- `poly.shopify.products.getProducts` (id: 3d02d0a3-dcf8-4bc3-8f03-a8619291f936, score: 5)
- `poly.shopify.products.deleteProducts` (id: 4442d0a3-dcf8-4bc3-8f03-a8619291f936, score: 5)
{}

Here's an example implementation in TypeScript:

```typescript
import poly from 'poly-api-library';

const shop = 'darko-demo-store';

poly.shopify.products.getProducts(shop)
  .then((products) => {
    console.log(products[0]);
  })
  .catch((error) => {
    console.error(error);
  });
```

This function retrieves a list of all products in the store and returns product details including id, title, vendor, price, inventory, and images. It is useful for displaying a catalog of products or for inventory management. The confidence score is 5 as this function is specifically designed to retrieve a list of products from a Shopify store.
"""

STEP_2_RESPONSE_EXAMPLE = """The function that can be used to search flight information is:

```
{"id": "9ce603a4-5b5f-4e1c-8a43-994b2d7e8df2"}
```

Here's an example of how to use it in Python:

```python
import requests

url = "https://api.poly.com/astra/datastax/flights/flightSearch"

querystring = {
    "originAirportCode": "LAX",
    "destinationAirportCode": "JFK",
    "startDateTimeRange": "2022-01-01T00:00:00Z",
    "endDateTimeRange": "2022-01-07T00:00:00Z"
}

response = requests.request("GET", url, params=querystring)

print(response.text)
```

Note: This is just an example and you will need to replace the query parameters with your own values.
"""


def _fake_extract(user_id, conversation_id, keyword):
    return {
        "keywords": keyword,
        "semantically_similar_keywords": "jarjar",
        "http_methods": "GET",
    }


FUNCTIONS: List[SpecificationDto] = [
    {
        "id": "f7588018-2364-4586-b60d-b08a285f1ea3",
        "name": "accuweatherGetlocation",
        "context": "",
        "description": "",
        "type": "apiFunction",
        "function": {
            "arguments": [
                {
                    "name": "locationId",
                    "type": {"kind": "primitive", "type": "string"},
                    "required": True,
                },
                {
                    "name": "AAPIKey",
                    "type": {"kind": "primitive", "type": "string"},
                    "required": True,
                },
            ],
            "returnType": {"kind": "void"},
        },
    },
    {
        "id": "60062c03-dcfd-437d-832c-6cba9543f683",
        "name": "gMapsGetXy",
        "context": "shipping",
        "description": "get the X and Y coordinates of a location from Google Maps",
        "type": "apiFunction",
        "function": {
            "arguments": [
                {
                    "name": "locationId",
                    "type": {"kind": "primitive", "type": "string"},
                    "required": True,
                },
                {
                    "name": "GAPIKey",
                    "type": {"kind": "primitive", "type": "string"},
                    "required": True,
                },
            ],
            "returnType": {"kind": "void"},
        },
    },
    {
        "id": "bde87ad6-acbf-4556-9bd7-e27a479c0373",
        "name": "serviceNow.createIncident",
        "context": "incidentManagement",
        "description": "This API call allows users to create a new incident in ServiceNow's system. The user must provide a payload with all the fields needed to create the incident, such as short description, assigned group, and priority level. The response payload will contain the incident number and details, including its state, priority, and assigned user/group.",
        "type": "apiFunction",
        "function": {
            "arguments": [
                {
                    "name": "impact",
                    "type": {"kind": "primitive", "type": "string"},
                    "required": True,
                },
            ],
            "returnType": {"kind": "void"},
        },
    },
]


WEBHOOKS: List[SpecificationDto] = [
    {
        "id": "4005e0b5-6071-4d67-96a5-405b4d09492f",
        "name": "packageDelivered",
        "context": "shipping",
        "description": "Event handler for when a package is delivered",
        "type": "webhookHandle",
        "function": {
            "arguments": [],
            "returnType": {"kind": "void"},
        },
    }
]


def get_functions(*args, **kwargs):
    return copy.deepcopy(FUNCTIONS)


def get_webhooks(*args, **kwargs):
    return copy.deepcopy(WEBHOOKS)


def _fake_threshold(*args, **kwargs):
    # set a very low threshold so we can test the completion logic
    # independent of the keyword scoring
    return -1


class T(DbTestCase):
    def setUp(self):
        super().setUp()
        self.user = test_user_get_or_create()
        self.environment = test_environment_get_or_create()

    @patch("app.keywords.get_similarity_threshold", new=_fake_threshold)
    @patch("app.completion.query_node_server")
    def test_library_message_no_keywords(self, query_node_server: Mock) -> None:
        query_node_server.return_value = Mock(
            status_code=200, json=lambda: get_functions()
        )

        d, stats = get_function_options_prompt(self.user.id, self.environment.id, None)
        self.assertEqual(query_node_server.call_count, 0)
        self.assertIsNone(d)

    @patch("app.keywords.get_similarity_threshold", new=_fake_threshold)
    @patch("app.completion.query_node_server")
    def test_library_message_functions(self, query_node_server: Mock) -> None:
        query_node_server.side_effect = [
            Mock(status_code=200, json=lambda: get_functions()),
            Mock(status_code=200, json=lambda: []),
        ]

        keywords = "how do I find the x and y coordinates of a Google Map?".lower()
        keyword_data = ExtractKeywordDto(
            keywords=keywords, semantically_similar_keywords="", http_methods=""
        )
        d, stats = get_function_options_prompt(
            self.user.id, self.environment.id, keyword_data
        )
        assert d
        self.assertEqual(query_node_server.call_count, 1)
        self.assertEqual(stats["match_count"], 3)
        self.assertIn("Here are some functions", d["content"])

    @patch("app.keywords.get_similarity_threshold", new=_fake_threshold)
    @patch("app.completion.query_node_server")
    def test_library_message_webhooks(self, query_node_server: Mock) -> None:
        query_node_server.side_effect = [
            Mock(status_code=200, json=lambda: get_webhooks()),
        ]

        d, stats = get_function_options_prompt(self.user.id, self.environment.id, {"keywords": "foo bar"})  # type: ignore
        assert d
        self.assertEqual(query_node_server.call_count, 1)
        self.assertEqual(stats["match_count"], 1)
        self.assertTrue(d["content"].startswith("Here are some event handlers"))
        self.assertIn("poly.shipping.packageDelivered", d["content"])

    @patch("app.completion.extract_keywords", new=_fake_extract)
    @patch("app.completion.query_node_server")
    def test_get_best_function_messages(self, query_node_server: Mock) -> None:
        conversation = create_new_conversation(self.user.id)
        self.db.systemprompt.delete_many()  # no system prompt!

        query_node_server.side_effect = [
            Mock(status_code=200, json=lambda: get_functions()),
        ]

        messages, stats = get_best_function_messages(
            self.user.id,
            conversation.id,
            self.environment.id,
            "how do I create a new incident in ServiceNow?",
        )
        self.assertEqual(query_node_server.call_count, 1)
        self.assertEqual(stats["match_count"], 1)
        self.assertEqual(len(messages), 2)

    @patch("app.utils.query_node_server")
    @patch("app.completion.get_chat_completion")
    def test_get_best_function_example(self, get_chat_completion, query_node_server):
        conversation = create_new_conversation(self.user.id)
        get_chat_completion.return_value = {"choices": [{"message": {"role": "assistant", "content": "foobar"}}]}
        query_node_server.return_value = Mock(status_code=200, json=get_functions)

        result = get_best_function_example(
            self.user.id,
            conversation.id,
            self.environment.id,
            ["f7588018-2364-4586-b60d-b08a285f1ea3"],
            "how do I check flight?",
        )

        self.assertEqual(get_chat_completion.call_count, 1)
        messages = get_chat_completion.call_args[0][0]
        print(messages[0]["content"])
        print(messages[1]["content"])
        self.assertEqual(len(messages), 4)
        self.assertEqual(query_node_server.call_count, 1)

        self.assertTrue(result)

    def test_extract_json_from_completion(self):
        response = '''[
            {"id": "9ce603a4-5b5f-4e1c-8a43-994b2d7e8df2", "score": 3},
            {"id": "8ce603a4-5b5f-4e1c-8a43-994b2d7e8df2", "score": 1}
        ]'''
        public_ids = _extract_ids_from_completion(response)
        self.assertEqual(public_ids, ["9ce603a4-5b5f-4e1c-8a43-994b2d7e8df2"])

    def test_extract_json_from_completion_fallback(self):
        public_ids = _extract_ids_from_completion(STEP_2_RESPONSE_EXAMPLE)
        self.assertEqual(public_ids, ["9ce603a4-5b5f-4e1c-8a43-994b2d7e8df2"])

    def test_id_extraction_fallback(self):
        rv = _id_extraction_fallback(EXTRACTION_FALLBACK_EXAMPLE)
        self.assertEqual(rv, ["3d02d0a3-dcf8-4bc3-8f03-a8619291f936", "4442d0a3-dcf8-4bc3-8f03-a8619291f936"])