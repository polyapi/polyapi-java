import unittest
from prisma import Prisma
from app import create_app
from werkzeug.test import TestResponse


class DbTestCase(unittest.TestCase):
    # TODO replace with testing flask_app that uses test db
    app = create_app(testing=True)

    @classmethod
    def setUpClass(cls):
        cls.app_context = cls.app.app_context()
        cls.app_context.push()

    def setUp(self):
        self.client = self.app.test_client()

        # HACK this will reuse the local db for now
        self.db = Prisma()
        self.db.connect()

    def tearDown(self):
        self.db.disconnect()

    @classmethod
    def tearDownClass(cls):
        cls.app_context.pop()

    def assertStatus(self, resp: TestResponse, status: int) -> None:
        self.assertEqual(resp.status_code, status, resp.data)