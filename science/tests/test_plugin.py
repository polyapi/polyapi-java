from app.plugin import get_plugin_chat
from .testing import DbTestCase


class T(DbTestCase):
    def test_get_plugin_chat(self):
        resp = get_plugin_chat("123", "foo")
        self.assertEqual(resp, "foobar")