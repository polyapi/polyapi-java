import json
import unittest
from unittest.mock import patch, Mock
from app.description import (
    _parse_openai_response,
    get_argument_descriptions,
    get_function_description,
    get_variable_description,
    get_webhook_description,
)
from .testing import DbTestCase


TRUNCATE = {
    "id": "fad0c259-2e8a-4cb8-aeca-b2a491bca8d1",
    "type": "apiFunction",
    "context": "fabric.productAttributes",
    "name": "create",
    "short_description": "fabric.productAttributes.create",
    # "description": "This API call is used to create a new product attribute in the Fabric Inc system. The attribute type, target, validation rules, name, and description are specified in the request payload. The response payload returns the ID, name, description, localizability, target, type, validation rules, update a",
    "url": "",
    "method": "POST",
    "arguments": [
        {
            "name": "tenant",
            "description": "A string that represents the tenant in the Fabric Inc system.",
            "required": True,
            "type": {"kind": "primitive", "type": "string"},
        },
        {
            "name": "token",
            "description": "A string that represents the token for the API call.",
            "required": True,
            "type": {"kind": "primitive", "type": "string"},
        },
        {
            "name": "payload",
            "required": True,
            "type": {
                "kind": "object",
                "properties": [
                    {
                        "name": "type",
                        "description": "A string that specifies the type of the product attribute.",
                        "required": True,
                        "type": {"kind": "primitive", "type": "string"},
                    },
                    {
                        "name": "name",
                        "description": "A string that specifies the name of the product attribute.",
                        "required": True,
                        "type": {"kind": "primitive", "type": "string"},
                    },
                    {
                        "name": "description",
                        "description": "A string that provides a description of the product attribute.",
                        "required": True,
                        "type": {"kind": "primitive", "type": "string"},
                    },
                    {
                        "name": "validationDetails",
                        "description": "An object that contains various validation rules for the product attribute. It includes 'isMandatory' (a boolean that indicates whether the attribute is mandatory), 'isManualOverwrite' (a boolean that indicates whether the attribute can be manually overwritten), 'isDecimal' (a boolean that indicates whether the attribute is a decimal), 'startWith' (an integer that indicates the starting value of the attribute), 'subType' (a string that specifies the subtype of the attribute), and 'formula' (a string that represents the formula for the attribute).",
                        "required": False,
                        "type": {
                            "kind": "object",
                            "schema": {
                                "$schema": "http://json-schema.org/draft-06/schema#",
                                "definitions": {},
                                "type": "object",
                                "additionalProperties": False,
                                "properties": {
                                    "isMandatory": {"type": "boolean"},
                                    "isManualOverwrite": {"type": "boolean"},
                                    "isDecimal": {"type": "boolean"},
                                    "startWith": {"type": "integer"},
                                    "subType": {"type": "string"},
                                    "formula": {"type": "string"},
                                },
                                "required": [
                                    "formula",
                                    "isDecimal",
                                    "isMandatory",
                                    "isManualOverwrite",
                                    "startWith",
                                    "subType",
                                ],
                                "title": "Argument",
                            },
                        },
                    },
                    {
                        "name": "isLocalizable",
                        "description": "A boolean that indicates whether the product attribute is localizable.",
                        "required": False,
                        "type": {"kind": "primitive", "type": "boolean"},
                    },
                ],
            },
        },
    ],
    "response": json.dumps(
        {
            "kind": "object",
            "schema": {
                "$schema": "http://json-schema.org/draft-06/schema#",
                "definitions": {
                    "Validation": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "isMandatory": {"type": "boolean"},
                            "subType": {"type": "string"},
                            "formula": {"type": "string"},
                            "isManualOverwrite": {"type": "boolean"},
                        },
                        "required": [
                            "formula",
                            "isMandatory",
                            "isManualOverwrite",
                            "subType",
                        ],
                        "title": "Validation",
                    }
                },
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "id": {"type": "string"},
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                    "isLocalizable": {"type": "boolean"},
                    "target": {"type": "string"},
                    "type": {"type": "string"},
                    "validation": {"$ref": "#/definitions/Validation"},
                    "updatedAt": {"type": "string"},
                    "createdAt": {"type": "string"},
                    "updatedBy": {"type": "string"},
                },
                "required": [
                    "createdAt",
                    "description",
                    "id",
                    "isLocalizable",
                    "name",
                    "target",
                    "type",
                    "updatedAt",
                    "updatedBy",
                    "validation",
                ],
                "title": "ResponseType",
            },
        }
    ),
}


class T(DbTestCase):
    @unittest.skip("Use this to test OpenAI for real to refine prompts")
    def test_get_function_description_real(self):
        data = get_function_description(TRUNCATE)
        print(data["context"])
        print(data["name"])
        print(data["description"])

    @patch("app.description.get_chat_completion")
    def test_get_function_description(self, mock_chat):
        mock_content = {"description": "foobar", "name": "foo", "context": "ba-r"}
        mock_chat.return_value = json.dumps(mock_content)
        output = get_function_description(
            {
                "url": "https://example.com",
                "method": "POST",
                "short_description": "Create a thing",
            }  # type: ignore
        )
        self.assertEqual(mock_chat.call_count, 1)
        self.assertEqual(output["name"], "foo")
        self.assertEqual(output["context"], "baR")
        self.assertEqual(output["description"], "foobar")

    @patch("app.description.get_chat_completion")
    def test_get_webhook_description(self, mock_chat):
        mock_content = {"description": "foobar", "name": "foo", "context": "ba-r"}
        mock_chat.return_value = json.dumps(mock_content)
        output = get_webhook_description(
            {
                "url": "https://example.com",
                "method": "POST",
                "short_description": "Create a thing",
            }
        )
        self.assertEqual(mock_chat.call_count, 1)
        self.assertEqual(output["name"], "foo")
        self.assertEqual(output["context"], "baR")
        self.assertEqual(output["description"], "foobar")

    @patch("app.description.get_chat_completion")
    def test_get_variable_description(self, mock_chat):
        mock_content = {"description": "foobar"}
        mock_chat.return_value = json.dumps(mock_content)
        output = get_variable_description(
            {
                "name": "fromPhoneNumber",
                "context": "messaging.twilio",
                "secret": False,
                "value": "+18033697",
            }
        )
        self.assertEqual(mock_chat.call_count, 1)
        self.assertEqual(output["description"], "foobar")

    @unittest.skip("Old approach not asking OpenAI to return JSON")
    def test_parse_function_description(self):
        completion = """Context:
        comms.mailchimp
        Name:
        mailchimp.getMembers
        Description:
        This API call retrieves a list of members subscribed..."""
        parsed = _parse_openai_response(completion)
        self.assertEqual(parsed["context"], "comms.mailchimp")
        self.assertEqual(parsed["name"], "mailchimp.getMembers")
        self.assertEqual(
            parsed["description"],
            "This API call retrieves a list of members subscribed...",
        )

    @patch("app.description.get_chat_completion")
    def test_get_argument_descriptions(self, chat_create: Mock):
        completion = """Sure! Here is the JSON:

        ```
        [{"name": "toNumber", "description": "The number to which the message will be sent, including country code."}]
        ```
"""
        chat_create.return_value = completion

        arguments = get_argument_descriptions(
            None,
            "sms.messaging",
            "twilio",
            "send a message",
            [{"name": "toNumber", "type": {"kind": "primitive", "type": "string"}}],
        )
        self.assertEqual(
            arguments[0]["description"],
            "The number to which the message will be sent, including country code.",
        )
