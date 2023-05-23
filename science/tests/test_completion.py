import copy
from typing import List
from mock import Mock, patch
from load_fixtures import test_user_get_or_create
from app.completion import (
    get_best_function_example,
    get_conversations_for_user,
    get_function_options_prompt,
    get_best_function_messages,
)
from app.typedefs import ExtractKeywordDto, SpecificationDto
from .testing import DbTestCase


def _fake_extract(keyword):
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
                {"name": "locationId", "type": {"kind": "primitive", "type": "string"}, "required": True},
                {"name": "AAPIKey", "type": {"kind": "primitive", "type": "string"}, "required": True},
            ],
            "returnType": {
                "kind": "void"
            }
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
                {"name": "locationId", "type": {"kind": "primitive", "type": "string"}, "required": True},
                {"name": "GAPIKey", "type": {"kind": "primitive", "type": "string"}, "required": True},
            ],
            "returnType": {
                "kind": "void"
            }
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
                {"name": "impact", "type": {"kind": "primitive", "type": "string"}, "required": True},
            ],
            "returnType": {
                "kind": "void"
            },
        }
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
            "returnType": {
                "kind": "void"
            },
        }
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
    def test_get_conversations_for_user(self) -> None:
        user = test_user_get_or_create()
        self.db.functiondefined.delete_many()
        self.db.webhookdefined.delete_many()
        self.db.conversationmessage.delete_many(where={"userId": user.id})

        messages = get_conversations_for_user(user.id)
        self.assertEqual(messages, [])

        msg = self.db.conversationmessage.create(
            data={"userId": user.id, "content": "first", "role": "user"}
        )
        messages = get_conversations_for_user(user.id)
        self.assertEqual(messages, [msg])

    @patch("app.keywords.get_similarity_threshold", new=_fake_threshold)
    @patch("app.completion.query_node_server")
    def test_library_message_no_keywords(self, query_node_server: Mock) -> None:
        query_node_server.return_value = Mock(status_code=200, json=lambda: get_functions())

        d, stats = get_function_options_prompt(None)
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
        d, stats = get_function_options_prompt(keyword_data)
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

        d, stats = get_function_options_prompt({"keywords": "foo bar"})  # type: ignore
        assert d
        self.assertEqual(query_node_server.call_count, 1)
        self.assertEqual(stats["match_count"], 1)
        self.assertTrue(d["content"].startswith("Here are some event handlers"))
        self.assertIn("poly.shipping.packageDelivered", d["content"])

    @patch("app.completion.extract_keywords", new=_fake_extract)
    @patch("app.completion.query_node_server")
    def test_get_best_function_messages(self, query_node_server: Mock) -> None:
        self.db.systemprompt.delete_many()  # no system prompt!

        query_node_server.side_effect = [
            Mock(status_code=200, json=lambda: get_functions()),
        ]

        messages, stats = get_best_function_messages(
            "how do I create a new incident in ServiceNow?"
        )
        self.assertEqual(query_node_server.call_count, 1)
        self.assertEqual(stats["match_count"], 1)
        self.assertEqual(len(messages), 2)

    @patch("app.utils.query_node_server")
    @patch("app.completion.get_chat_completion")
    def test_get_best_function_example(self, get_chat_completion, query_node_server):
        get_chat_completion.return_value = {"choices": ["foobar"]}
        query_node_server.return_value = Mock(status_code=200, json=get_functions)

        # user = test_user_get_or_create()
        # united = united_get_status_get_or_create(user)
        result = get_best_function_example("60062c03-dcfd-437d-832c-6cba9543f683", "how do I check flight?")

        self.assertEqual(get_chat_completion.call_count, 1)
        messages = get_chat_completion.call_args[0][0]
        print(messages[0]['content'])
        print(messages[1]['content'])
        self.assertEqual(len(messages), 2)
        self.assertEqual(query_node_server.call_count, 1)

        self.assertEqual(result, "foobar")