import json
import uuid
from mock import patch, Mock
from openai.error import ServiceUnavailableError

from .testing import DbTestCase

# TODO make relative?
from app.description import DescInputDto
from load_fixtures import test_user_get_or_create


class T(DbTestCase):
    def test_test_user_get_or_create(self) -> None:
        user = test_user_get_or_create()
        self.assertEqual(user.name, "test")
        self.assertEqual("foo", "foo")

    @patch("app.views.split_route_and_question")
    @patch("app.views.get_completion_answer")
    def test_function_completion(self, get_answer: Mock, route_question) -> None:
        # setup
        user = test_user_get_or_create()
        route_question.return_value = "function", "hi world"

        get_answer.return_value = "123"
        mock_input = {
            "question": "/d Cómo",
            "user_id": user.id,
            "environment_id": "123",
        }

        # execute
        resp = self.client.get("/function-completion", query_string=mock_input)

        # test
        self.assertStatus(resp, 200)
        self.assertEqual(get_answer.call_count, 1)

    @patch("app.views.redis_get")
    @patch("app.views.split_route_and_question")
    @patch("app.views.get_completion_answer")
    def test_function_completion_question_uuid(
        self, get_answer: Mock, route_question, redis_get: Mock
    ) -> None:
        # setup
        user = test_user_get_or_create()
        redis_get.return_value = json.dumps({"message": "first three numbers"})
        route_question.return_value = "function", "hi world"

        question_uuid = str(uuid.uuid4())
        # r = redis.Redis()
        # r.set(question_uuid, json.dumps({"message": "foobar"}).encode("utf8"))

        get_answer.return_value = "123"
        mock_input = {
            "question_uuid": question_uuid,
            "user_id": user.id,
            "environment_id": "123",
        }

        # execute
        resp = self.client.get("/function-completion", query_string=mock_input)

        # test
        self.assertStatus(resp, 200)
        self.assertEqual(get_answer.call_count, 1)

    @patch("app.views.split_route_and_question")
    @patch("app.views.get_completion_answer")
    def test_function_completion_error(self, get_answer: Mock, route_question) -> None:
        # setup
        user = test_user_get_or_create()
        route_question.return_value = "function", "hi world"

        get_answer.side_effect = ServiceUnavailableError(
            "The server is overloaded or not ready yet."
        )
        mock_input = {
            "question": "hi world",
            "user_id": user.id,
            "environment_id": "123",
        }

        # execute
        resp = self.client.get("/function-completion", query_string=mock_input)

        # test
        self.assertStatus(resp, 500)
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
            "code": None,
            "arguments": None,
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
            "code": None,
            "arguments": None,
        }

        # execute
        resp = self.client.post("/webhook-description", json=mock_input)

        # test
        self.assertEqual(chat_create.call_count, 1)
        output = resp.get_json()
        self.assertEqual(output["context"], "booking.reservations")
        self.assertEqual(output["name"], "createReservation")
        self.assertEqual(output["description"], "This Event handler...")

    def test_rate_limit_error(self):
        resp = self.client.get("/error-rate-limit")
        self.assertStatus(resp, 500)
        self.assertTrue(resp.text.startswith("OpenAI is overloaded"))

    def test_plugin_chat_error(self):
        resp = self.client.post("/plugin-chat", json={"conversationId": "foo"})
        self.assertStatus(resp, 400)
        data = resp.get_json()
        self.assertNotIn("conversationId", data["message"])
