import json
from unittest.mock import patch, Mock
from keywords import extract_keywords, get_function_match_limit, keywords_similar, get_top_function_matches
from .testing import DbTestCase


ACCUWEATHER = {
    "id": "f7588018-2364-4586-b60d-b08a285f1ea3",
    "name": "accuweatherGetlocation",
    "context": "",
    "description": "get the weather for a specific location (using locationid)",
    "arguments": [
        {"name": "locationId", "type": "string", "payload": False},
        {"name": "AAPIKey", "type": "string", "payload": False},
    ],
}
GOOGLE_MAPS = {
    "id": "60062c03-dcfd-437d-832c-6cba9543f683",
    "name": "gMapsGetXy",
    "context": "shipping",
    "description": "get the X and Y coordinates of a location from Google Maps",
    "arguments": [
        {"name": "location", "type": "string", "payload": True},
        {"name": "GAPIKey", "type": "string", "payload": False},
    ],
}
SERVICE_NOW = {
    "id": "bde87ad6-acbf-4556-9bd7-e27a479c0373",
    "name": "serviceNow.createIncident",
    "context": "incidentManagement",
    "description": "This API call allows users to create a new incident in ServiceNow's system. The user must provide a payload with all the fields needed to create the incident, such as short description, assigned group, and priority level. The response payload will contain the incident number and details, including its state, priority, and assigned user/group.",
    "arguments": [
        {"key": "impact", "name": "impact", "type": "string", "payload": True},
    ],
    "type": "url",
}


class T(DbTestCase):
    def test_keywords_similar_weather(self):
        # "how do I get the weather at a certain location?"
        keywords = "current weather location get"

        # accuweather does pass even though we might not expect it to
        for func, expected in [
            (GOOGLE_MAPS, True),
            (ACCUWEATHER, True),
            (SERVICE_NOW, False),
        ]:
            self.assertTrue(keywords_similar(keywords, func))
            with self.subTest(func=func):
                similar, ratio = keywords_similar(keywords, func)
                self.assertEqual(similar, expected, ratio)

    def test_keywords_similar_maps(self):
        # how do I get the geocoordinates of a location?
        keywords = "geocoordinates location get"

        # accuweather does pass even though we might not expect it to
        for func, expected in [
            (GOOGLE_MAPS, True),
            (ACCUWEATHER, True),
            (SERVICE_NOW, False),
        ]:
            self.assertTrue(keywords_similar(keywords, func))
            with self.subTest(func=func):
                similar, ratio = keywords_similar(keywords, func)
                self.assertEqual(similar, expected, ratio)

    def test_keywords_similar_incident(self):
        # how do I create an incident on service now?
        keywords = "create incident service now"
        for func, expected in [
            (GOOGLE_MAPS, False),
            (ACCUWEATHER, False),
            (SERVICE_NOW, True),
        ]:
            self.assertTrue(keywords_similar(keywords, func))
            with self.subTest(func=func):
                similar, ratio = keywords_similar(keywords, func)
                self.assertEqual(similar, expected, ratio)

    def test_top_5_keywords(self):
        keyword_data = {"keywords": "xasyz"}
        top_5, stats = get_top_function_matches(
            [ACCUWEATHER, GOOGLE_MAPS, SERVICE_NOW], keyword_data
        )
        self.assertEqual(top_5, [])

    @patch("keywords.openai.ChatCompletion.create")
    def test_extract_keywords(self, chat_create: Mock):
        mock_response = {
            "keywords": "foo bar",
            "semantically_similar_keywords": "foo bar",
            "http_methods": "get post",
        }
        chat_create.return_value = {
            "choices": [{"message": {"content": json.dumps(mock_response)}}]
        }
        keyword_data = extract_keywords("test")
        assert keyword_data
        self.assertEqual(keyword_data["keywords"], "foo bar")
        self.assertEqual(keyword_data["semantically_similar_keywords"], "foo bar")
        self.assertEqual(keyword_data["http_methods"], "get post")

    @patch("keywords.openai.ChatCompletion.create")
    def test_extract_keywords_lists(self, chat_create: Mock):
        mock_response = {
            "keywords": ["foo", "bar"],
            "semantically_similar_keywords": ["foo", "bar"],
            "http_methods": ["get", "post"],
        }
        chat_create.return_value = {
            "choices": [{"message": {"content": json.dumps(mock_response)}}]
        }
        keyword_data = extract_keywords("test")
        assert keyword_data
        self.assertEqual(keyword_data["keywords"], "foo bar")
        self.assertEqual(keyword_data["semantically_similar_keywords"], "foo bar")
        self.assertEqual(keyword_data["http_methods"], "get post")

    def test_get_function_match_limit(self):
        value = 6
        name = "function_match_limit"
        defaults = {"name": name, "value": str(value)}
        self.db.configvariable.upsert(where={"name": name}, data={"update": defaults, "create": defaults})
        limit = get_function_match_limit()
        self.assertEqual(limit, 6)