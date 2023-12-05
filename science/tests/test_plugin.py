import json
import uuid
from unittest.mock import Mock, patch

from app.plugin import (
    _get_openapi_url,
    get_plugin_chat,
    openapi_to_openai_functions,
)
from openai.types.chat.chat_completion import ChatCompletion
from load_fixtures import test_plugin_get_or_create
from .testing import DbTestCase


MOCK_OPENAPI = {
    "openapi": "3.0.1",
    "info": {
        "version": "v1",
        "title": "Service Nexus",
        "description": "Endpoints that allow users to execute functions on PolyAPI",
    },
    "servers": [{"url": "https://service-nexus-1a0400cf.develop-k8s.polyapi.io"}],
    "paths": {
        "/functions/api/a43bd64b-1b83-4b4f-824c-441bac050957/execute": {
            "post": {
                "summary": "This API call allows sends SMS messages through Twilio",
                "operationId": "commsMessagingTwilioSendSms",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "$ref": "#/components/schemas/commsMessagingTwilioSendSmsBody"
                            }
                        }
                    },
                },
                "responses": {
                    "201": {
                        "description": "This API call allows sends SMS messages through Twilio's messaging service. The user can specify the number of the recipient as a string using the coutry code as string with no spaces, for example +16504859634, as well as the message body. The respon",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/commsMessagingTwilioSendSmsResponse"
                                }
                            }
                        },
                    }
                },
            }
        },
        "/functions/api/83704918-28d0-4c7f-8897-7e27ad291c96/execute": {
            "post": {
                "summary": "Create a new incident in ServiceNow with details like priority, state, short description, impact, urgency, and assignment group. Returns the created incident with its unique identifier (sys_id) and other incident details.",
                "operationId": "serviceNowIncidentsCreate",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "$ref": "#/components/schemas/serviceNowIncidentsCreateBody"
                            }
                        }
                    },
                },
                "responses": {
                    "201": {
                        "description": "Create a new incident in ServiceNow with details like priority, state, short description, impact, urgency, and assignment group. Returns the created incident with its unique identifier (sys_id) and other incident details.",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/serviceNowIncidentsCreateResponse"
                                }
                            }
                        },
                    }
                },
            }
        },
    },
    "components": {
        "schemas": {
            "commsMessagingTwilioSendSmsBody": {
                "type": "object",
                "properties": {
                    "My_Phone_Number": {"type": "string"},
                    "message": {"type": "string"},
                },
                "required": ["My_Phone_Number", "message"],
            },
            "commsMessagingTwilioSendSmsResponse": {
                "type": "object",
                "description": "response",
                "properties": {
                    "body": {"type": "string"},
                    "from": {"type": "string"},
                },
            },
            "serviceNowIncidentsCreateBody": {
                "type": "object",
                "properties": {
                    "payload": {
                        "type": "object",
                        "properties": {
                            "impact": {"type": "number"},
                            "priority": {"type": "number"},
                            "businessImpact": {"type": "string"},
                            "businessUrgency": {"type": "number"},
                            "businessSeverity": {"type": "number"},
                            "escalationRequest": {"type": "string"},
                        },
                        "required": [
                            "impact",
                            "priority",
                            "businessImpact",
                            "businessUrgency",
                            "businessSeverity",
                            "escalationRequest",
                        ],
                    }
                },
                "required": ["payload"],
            },
            "serviceNowIncidentsCreateResponse": {
                "type": "object",
                "description": "response",
                "properties": {},
            },
        }
    },
}


MOCK_NO_FUNCTION_STEP_1_RESP = ChatCompletion(
    id="123",
    created=123,
    model="gpt-4-0613",
    object="chat.completion",
    choices=[
        {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": "The capital of Sweden is Stockholm.",
            },
            "finish_reason": "stop",
        }
    ]
)


MOCK_STEP_1_RESP = ChatCompletion(**{
    "id": "chatcmpl-7iokRKBFPOec9EQmKDLBigFSEznpc",
    "object": "chat.completion",
    "created": 1690915863,
    "model": "gpt-4-0613",
    "choices": [
        {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": None,
                "function_call": {
                    "name": "commsMessagingTwilioSendSms",
                    "arguments": '{\n"My_Phone_Number": "503-267-0612",\n"message": "tested"\n}',
                },
            },
            "finish_reason": "function_call",
        }
    ],
    "usage": {"prompt_tokens": 80, "completion_tokens": 33, "total_tokens": 113},
})


class T(DbTestCase):
    @patch("app.plugin._function_call")
    @patch("app.plugin.requests.post")
    @patch("app.plugin.requests.get")
    def test_get_plugin_chat(
        self, requests_get: Mock, requests_post: Mock, chat_create: Mock
    ):
        api_key = self.db.apikey.find_first(where={"userId": {"not": None}})
        assert api_key
        requests_get.return_value = Mock(status_code=200, json=lambda: MOCK_OPENAPI)
        requests_post.return_value = Mock(
            status_code=201, text=json.dumps({"answer": "Message sent"})
        )
        chat_create.return_value = MOCK_STEP_1_RESP
        plugin = test_plugin_get_or_create("service-nexus")

        question = "please send a text message saying 'tested' to 503-267-0612"
        conversation_id = uuid.uuid4().hex
        resp = get_plugin_chat(
            api_key.key, api_key.id, plugin.id, conversation_id, question
        )

        self.assertEqual(requests_get.call_count, 1)
        self.assertEqual(
            requests_post.call_count, 4
        )  # loop over and hit all 4 functions
        self.assertEqual(chat_create.call_count, 5)

        self.assertTrue(resp)

        convo = self.db.conversation.find_unique(where={"id": conversation_id})
        self.assertTrue(convo)

    @patch("app.plugin._function_call")
    @patch("app.plugin.requests.post")
    @patch("app.plugin.requests.get")
    def test_get_plugin_chat_general(
        self, requests_get: Mock, requests_post: Mock, chat_create: Mock
    ):
        api_key = self.db.apikey.find_first(where={"userId": {"not": None}})
        chat_create.return_value = MOCK_NO_FUNCTION_STEP_1_RESP
        requests_get.return_value = Mock(status_code=200, json=lambda: MOCK_OPENAPI)
        plugin = test_plugin_get_or_create("service-nexus")

        question = "what is the capital of Sweden?"
        conversation_id = uuid.uuid4().hex
        chat_resp = get_plugin_chat(
            api_key.key, api_key.id, plugin.id, conversation_id, question
        )
        self.assertEqual(chat_resp["conversationGuid"], conversation_id)
        messages = chat_resp["messages"]
        self.assertEqual(len(messages), 2)
        self.assertEqual(messages[1]["role"], "assistant")
        self.assertEqual(messages[1]["content"], "The capital of Sweden is Stockholm.")

        self.assertEqual(requests_get.call_count, 1)
        self.assertEqual(requests_post.call_count, 0)  # should not hit execute endpoint
        self.assertEqual(chat_create.call_count, 1)

    def test_openapi_to_openai_functions(self):
        functions = openapi_to_openai_functions(MOCK_OPENAPI)
        self.assertEqual(len(functions), 2)
        func = functions[0]
        self.assertEqual(func["name"], "commsMessagingTwilioSendSms")
        self.assertEqual(
            func["description"],
            "This API call allows sends SMS messages through Twilio",
        )
        # print(func['parameters'])
        self.assertTrue(func["parameters"])

    def test_get_openapi_url(self):
        "https://service-nexus-1a0400cf.develop-k8s.polyapi.io/plugins/service-nexus/openapi"
        # environment = self.db.environment.find_first()
        slug = "service-nexus"
        plugin = test_plugin_get_or_create(slug)
        url = _get_openapi_url(plugin.id)
        self.assertTrue(url)
        # self.assertEqual(
        #     url,
        #     f"https://{slug}-{environment.subdomain}.develop-k8s.polyapi.io/plugins/{slug}/openapi",
        # )
