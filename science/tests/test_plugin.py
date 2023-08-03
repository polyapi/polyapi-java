from unittest.mock import Mock, patch
from app.plugin import get_plugin_chat, openapi_to_openai_functions
from .testing import DbTestCase

SPEC = {
    "id": "ec66c324-80fe-4d9a-a5fa-2f7f38384155",
    "type": "apiFunction",
    "context": "comms.messaging",
    "name": "twilioSendSms",
    "description": "This API call allows sends SMS messages through Twilio's messaging service.",
    "function": {
        "arguments": [
            {
                "name": "My_Phone_Number",
                "description": "",
                "required": True,
                "type": {"kind": "primitive", "type": "string"},
            },
            {
                "name": "message",
                "description": "",
                "required": True,
                "type": {"kind": "primitive", "type": "string"},
            },
        ],
    },
}

MOCK_PLUGIN_OPENAPI = {
    "openapi": "3.0.1",
    "info": {
        "version": "v1",
        "title": "Service Nexus",
        "description": "Endpoints that allow users to execute functions on PolyAPI",
    },
    "servers": [{"url": "https://service-nexus-1a0400cf.develop-k8s.polyapi.io"}],
    "paths": {
        "/functions/api/ec66c324-80fe-4d9a-a5fa-2f7f38384155/execute": {
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
        }
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
                    "num_segments": {"type": "string", "format": "integer"},
                    "direction": {"type": "string"},
                    "from": {"type": "string"},
                    "date_updated": {"type": "string"},
                    "price": {"nullable": True},
                    "error_message": {"nullable": True},
                    "uri": {"type": "string"},
                    "account_sid": {"type": "string"},
                    "num_media": {"type": "string", "format": "integer"},
                    "to": {"type": "string"},
                    "date_created": {"type": "string"},
                    "status": {"type": "string"},
                    "sid": {"type": "string"},
                    "date_sent": {"nullable": True},
                    "messaging_service_sid": {"nullable": True},
                    "error_code": {"nullable": True},
                    "price_unit": {"type": "string"},
                    "api_version": {"type": "string", "format": "date"},
                },
            },
        }
    },
}

MOCK_STEP_1_RESP = {
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
}


class T(DbTestCase):
    # def test_get_plugin_chat(self):
    #     chat_create.return_value = "foobar"
    @patch("app.plugin.openai.ChatCompletion.create")
    @patch("app.plugin.requests.post")
    @patch("app.plugin.requests.get")
    def test_get_plugin_chat(self, requests_get: Mock, requests_post: Mock, chat_create: Mock):
        requests_post.return_value = Mock(
            status_code=201, json=lambda: {"answer": "Message sent"}
        )
        requests_get.return_value = Mock(
            status_code=200, json=lambda: MOCK_PLUGIN_OPENAPI
        )
        chat_create.return_value = MOCK_STEP_1_RESP
        resp = get_plugin_chat(
            "123", "please send a text message saying 'tested' to 503-267-0612"
        )
        self.assertTrue(resp)

    def test_openapi_to_openai_functions(self):
        functions = openapi_to_openai_functions(MOCK_PLUGIN_OPENAPI)
        self.assertEqual(len(functions), 1)
        func = functions[0]
        self.assertEqual(func["name"], "commsMessagingTwilioSendSms")
        self.assertEqual(
            func["description"],
            "This API call allows sends SMS messages through Twilio",
        )
        self.assertTrue(func["parameters"])
