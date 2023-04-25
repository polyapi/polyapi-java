import json
import unittest
from unittest.mock import patch
from app.description import _get_context_and_names, _parse_openai_response, get_function_description, \
  get_webhook_description
from load_fixtures import load_functions, test_user_get_or_create
from .testing import DbTestCase


class T(DbTestCase):
    @patch("app.description.openai.ChatCompletion.create")
    def test_get_function_description(self, mock_chat):
        mock_content = {"description": "foobar", "name": "foo", "context": "ba-r"}
        mock_chat.return_value = {'choices': [{'message': {'content': json.dumps(mock_content)}}]}
        output = get_function_description(
            {
                "url": "https://example.com",
                "method": "POST",
                "short_description": "Create a thing",
            }
        )
        self.assertEqual(mock_chat.call_count, 1)
        self.assertEqual(output['name'], 'foo')
        self.assertEqual(output['context'], 'bar')
        self.assertEqual(output['description'], 'foobar')

    @patch("app.description.openai.ChatCompletion.create")
    def test_get_webhook_description(self, mock_chat):
      mock_content = {"description": "foobar", "name": "foo", "context": "ba-r"}
      mock_chat.return_value = {'choices': [{'message': {'content': json.dumps(mock_content)}}]}
      output = get_webhook_description(
        {
          "url": "https://example.com",
          "method": "POST",
          "short_description": "Create a thing",
        }
      )
      self.assertEqual(mock_chat.call_count, 1)
      self.assertEqual(output['name'], 'foo')
      self.assertEqual(output['context'], 'bar')
      self.assertEqual(output['description'], 'foobar')

    @unittest.skip("Old approach not asking OpenAI to return JSON")
    def test_parse_function_description(self):
        completion = """Context:
        comms.mailchimp
        Name:
        mailchimp.getMembers
        Description:
        This API call retrieves a list of members subscribed..."""
        parsed = _parse_openai_response(completion)
        self.assertEqual(parsed['context'], 'comms.mailchimp')
        self.assertEqual(parsed['name'], 'mailchimp.getMembers')
        self.assertEqual(parsed['description'], 'This API call retrieves a list of members subscribed...')

    def test_get_contexts_and_names(self):
        user = test_user_get_or_create
        load_functions(user)
        contexts = _get_context_and_names()
        self.assertIn("hospitality.opera.getHotelDetails", contexts)
        self.assertIn("travel.unitedAirlines.getFlights", contexts)