from .testing import DbTestCase
from app.typedefs import SpecificationDto
from load_fixtures import (
    load_functions,
    test_environment_get_or_create,
    test_user_get_or_create,
    united_get_status_get_or_create,
)
from app.utils import (
    camel_case,
    create_new_conversation,
    filter_to_real_public_ids,
    func_args,
    func_path,
    func_path_with_args,
    get_public_id,
    get_return_type_properties,
    get_variables,
    store_message,
)

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
                        {
                            "name": "x",
                            "type": {"kind": "primitive", "type": "number"},
                            "required": True,
                        },
                        {
                            "name": "y",
                            "type": {"kind": "primitive", "type": "number"},
                            "required": True,
                        },
                    ],
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
        self.assertEqual(
            fpwa,
            "poly.shipping.gMapsGetXy(payload: {x: number, y: number}, GAPIKey: string)",
        )

    def test_store_message(self):
        user = test_user_get_or_create()
        conversation = create_new_conversation(user.id)

        msg = store_message(
            user.id,
            conversation.id,
            {
                "role": "user",
                "content": "profound question",
            },
        )
        self.assertEqual(msg.userId, user.id)
        self.assertEqual(msg.content, "profound question")

    def test_get_public_id_none(self):
        result = get_public_id("foobar")
        self.assertIsNone(result)

    def test_get_public_id_api(self):
        user = test_user_get_or_create()
        united = united_get_status_get_or_create(user)
        result = get_public_id(united.id)
        self.assertEqual(result, united)

    def test_camel_case(self):
        # should keep camel case
        out = camel_case("fooBar")
        self.assertEqual(out, "fooBar")

    def test_filter_to_real_public_ids(self):
        func = self.db.apifunction.find_first()
        assert func
        real = filter_to_real_public_ids([func.id, "fakeid"])
        self.assertEqual(real, [func.id])

    def test_get_variables(self):
        environment = test_environment_get_or_create()
        self.db.variable.delete_many(where={"visibility": "PUBLIC"})
        self.db.variable.delete_many(where={"name": "foo"})
        var = self.db.variable.create(
            data={
                "name": "foo",
                "context": "bar",
                "environmentId": environment.id,
                "description": "baz",
                "visibility": "ENVIRONMENT",
            }
        )
        variables = get_variables("badId")
        self.assertEqual(variables, [])

        variables = get_variables(environment.id)
        self.assertEqual(variables[0]["name"], var.name)

        # now lets make the variable public and try it!
        self.db.variable.update_many(
            where={"name": "foo"}, data={"visibility": "PUBLIC"}
        )
        variables = get_variables("badId")
        self.assertEqual(variables[0]["name"], var.name)

    def test_get_return_properties_string(self):
        spec = {
            "function": {
                "returnType": {
                    "kind": "string",
                    "schema": {
                        "title": "foobar",
                    },
                }
            }
        }
        props = get_return_type_properties(spec)
        self.assertEqual(props["data"]["kind"], "string")