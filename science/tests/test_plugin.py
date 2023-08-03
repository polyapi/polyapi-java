from unittest.mock import Mock, patch
from app.plugin import MOCK_OPENAPI, get_plugin_chat, openapi_to_openai_functions
from .testing import DbTestCase

MOCK_NO_FUNCTION_STEP_1_RESP = {
    "choices": [
        {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": "The capital of Sweden is Stockholm.",
            },
            "finish_reason": "stop",
        }
    ]
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
    @patch("app.plugin.openai.ChatCompletion.create")
    @patch("app.plugin.requests.post")
    @patch("app.plugin.requests.get")
    def test_get_plugin_chat(
        self, requests_get: Mock, requests_post: Mock, chat_create: Mock
    ):
        requests_get.return_value = Mock(status_code=200, json=lambda: MOCK_OPENAPI)
        requests_post.return_value = Mock(
            status_code=201, json=lambda: {"answer": "Message sent"}
        )
        chat_create.return_value = MOCK_STEP_1_RESP

        question = "please send a text message saying 'tested' to 503-267-0612"
        resp = get_plugin_chat("123", question)

        self.assertEqual(requests_get.call_count, 1)
        self.assertEqual(requests_post.call_count, 1)  # should hit execute endpoint
        self.assertEqual(chat_create.call_count, 2)

        self.assertTrue(resp)

    @patch("app.plugin.openai.ChatCompletion.create")
    @patch("app.plugin.requests.post")
    @patch("app.plugin.requests.get")
    def test_get_plugin_chat_general(
        self, requests_get: Mock, requests_post: Mock, chat_create: Mock
    ):
        chat_create.return_value = MOCK_NO_FUNCTION_STEP_1_RESP
        requests_get.return_value = Mock(status_code=200, json=lambda: MOCK_OPENAPI)

        question = "what is the capital of Sweden?"
        messages = get_plugin_chat("123", question)
        self.assertEqual(len(messages), 1)
        self.assertEqual(messages[0]["role"], "assistant")
        self.assertEqual(messages[0]["content"], "The capital of Sweden is Stockholm.")

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
        self.assertTrue(func["parameters"])
