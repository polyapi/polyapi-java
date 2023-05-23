import uuid
from .testing import DbTestCase
from app.typedefs import SpecificationDto
from load_fixtures import load_functions, test_user_get_or_create, united_get_status_get_or_create
from app.utils import func_args, func_path, func_path_with_args, get_public_id, store_message

FUNC: SpecificationDto = {
    "id": "60062c03-dcfd-437d-832c-6cba9543f683",
    "type": "apiFunction",
    "name": "gMapsGetXy",
    "context": "shipping",
    "description": "",
    "function": {
        "arguments": [
            {
                "name": "payload",
                "type": {
                    "kind": "object",
                    "properties": [
                        {"name": "x", "type": {"kind": "primitive", "type": "number"}, "required": True},
                        {"name": "y", "type": {"kind": "primitive", "type": "number"}, "required": True},
                    ]
                },
                "required": True,
            },
            {
                "name": "GAPIKey",
                "type": {
                    "kind": "primitive",
                    "type": "string",
                },
                "required": True,
            },
        ],
        "returnType": {"kind": "string"},
    },
}


class T(DbTestCase):
    def test_load_fixtures(self) -> None:
        # smoke test to make sure this works
        user = test_user_get_or_create()
        load_functions(user)

    def test_func_path(self) -> None:
        data: SpecificationDto = {
            "id": "123",
            "type": "apiFunction",
            "name": "twilio.sendSMS",
            "context": "messaging",
            "description": "send SMS",
            "function": {"arguments": [], "returnType": {"kind": "void"}},
        }
        self.assertEqual(func_path(data), "poly.messaging.twilio.sendSMS")

    def test_func_args(self):
        args = func_args(FUNC)
        self.assertEqual(len(args), 2)
        self.assertEqual(args[0], "payload: {x: number, y: number}")
        self.assertEqual(args[1], "GAPIKey: string")

    def test_func_path_with_args(self):
        fpwa = func_path_with_args(FUNC)
        self.assertEqual(fpwa, "poly.shipping.gMapsGetXy(payload: {x: number, y: number}, GAPIKey: string)")

    def test_store_message(self):
        user = test_user_get_or_create()

        function_ids = [uuid.uuid4().hex]
        webhook_ids = [uuid.uuid4().hex]
        msg = store_message(
            user.id,
            {
                "role": "user",
                "content": "profound question",
                "function_ids": function_ids,
                "webhook_ids": webhook_ids,
            },
        )
        self.assertEqual(msg.userId, user.id)
        self.assertEqual(msg.content, "profound question")

        msg = self.db.conversationmessage.find_first(
            where={"id": msg.id}, include={"functions": True, "webhooks": True}
        )
        self.assertEqual(function_ids, [f.functionPublicId for f in msg.functions])
        self.assertEqual(webhook_ids, [w.webhookPublicId for w in msg.webhooks])

    def test_get_public_id_none(self):
        result = get_public_id("foobar")
        self.assertIsNone(result)

    def test_get_public_id_api(self):
        user = test_user_get_or_create()
        united = united_get_status_get_or_create(user)
        result = get_public_id(united.publicId)
        self.assertEqual(result, united)