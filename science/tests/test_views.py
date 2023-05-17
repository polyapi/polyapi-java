import json
from mock import patch, Mock
from openai.error import ServiceUnavailableError

from app.keywords import get_function_match_limit

from .testing import DbTestCase

# TODO make relative?
from app.description import DescInputDto
from app.utils import clear_conversation
from load_fixtures import test_user_get_or_create


class T(DbTestCase):
    def test_user_get_or_create(self) -> None:
        user = test_user_get_or_create()
        self.assertEqual(user.name, "test")
        self.assertEqual("foo", "foo")

    def test_clear_conversation(self):
        user = test_user_get_or_create()
        data = {
            "userId": user.id,
            "role": "user",
            "content": "how do I get the status of a united flight?",
        }
        msg = self.db.conversationmessage.create(data=data)

        # clearing other user id shouldn't delete this msg
        clear_conversation(-1)
        self.assertTrue(self.db.conversationmessage.find_first(where={"id": msg.id}))

        # clearing this user id should clear it
        clear_conversation(user.id)
        self.assertFalse(self.db.conversationmessage.find_first(where={"id": msg.id}))

    @patch("app.views.get_completion_answer")
    def test_function_completion_error(self, get_answer: Mock) -> None:
        # setup
        get_answer.side_effect = ServiceUnavailableError(
            "The server is overloaded or not ready yet."
        )
        mock_input = {
            "question": "hi world",
            "user_id": 1,
        }

        # execute
        resp = self.client.post("/function-completion", json=mock_input)

        # test
        self.assertEqual(resp.status_code, 500)
        self.assertEqual(get_answer.call_count, 1)

    @patch("app.description.openai.ChatCompletion.create")
    def test_function_description(self, chat_create: Mock) -> None:
        # setup
        mock_output = json.dumps(
            {
                "context": "booking.reservations",
                "name": "createReservation",
                "description": "This API call...",
            }
        )
        chat_create.return_value = {"choices": [{"message": {"content": mock_output}}]}
        mock_input: DescInputDto = {
            "url": "http://example.com",
            "method": "GET",
            "short_description": "I am the description",
            "payload": "I am the payload",
            "response": "I am the response",
        }

        # execute
        resp = self.client.post("/function-description", json=mock_input)

        # test
        self.assertEqual(chat_create.call_count, 1)
        output = resp.get_json()
        self.assertEqual(output["context"], "booking.reservations")
        self.assertEqual(output["name"], "createReservation")
        self.assertEqual(output["description"], "This API call...")

    @patch("app.description.openai.ChatCompletion.create")
    def test_webhook_description(self, chat_create: Mock) -> None:
        # setup
        mock_output = json.dumps(
            {
                "context": "booking.reservations",
                "name": "createReservation",
                "description": "This Event handler...",
            }
        )
        chat_create.return_value = {"choices": [{"message": {"content": mock_output}}]}
        mock_input: DescInputDto = {
            "url": "http://example.com",
            "method": "GET",
            "short_description": "I am the description",
            "payload": "I am the payload",
            "response": "I am the response",
        }

        # execute
        resp = self.client.post("/webhook-description", json=mock_input)

        # test
        self.assertEqual(chat_create.call_count, 1)
        output = resp.get_json()
        self.assertEqual(output["context"], "booking.reservations")
        self.assertEqual(output["name"], "createReservation")
        self.assertEqual(output["description"], "This Event handler...")

    def test_configure(self):
        data = {"name": "function_match_limit", "value": "4"}
        resp = self.client.post("/configure", json=data)
        self.assertEqual(resp.status_code, 201)
        out = get_function_match_limit()
        self.assertEqual(out, 4)
