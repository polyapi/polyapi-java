from .testing import DbTestCase
from app.typedefs import SpecificationDto
from load_fixtures import (
    load_functions,
    test_environment_get_or_create,
    test_user_get_or_create,
    united_get_status_get_or_create,
)
from app.utils import (
    _process_property_spec,
    _process_schema_property,
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
                "description": "da payload",
                "type": {
                    "kind": "object",
                    "properties": [
                        {
                            "name": "x",
                            "description": "latitude of location",
                            "type": {"kind": "primitive", "type": "number"},
                            "required": True,
                        },
                        {
                            "name": "y",
                            "description": "longitude of location",
                            "type": {"kind": "primitive", "type": "number"},
                            "required": True,
                        },
                    ],
                },
                "required": True,
            },
            {
                "name": "GAPIKey",
                "description": "your api key",
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

REF_FUNC = {
    "id": "087cbfbb-414d-417d-9f52-1845feeff441",
    "type": "apiFunction",
    "context": "operaCloud.rsv",
    "name": "createReservation",
    "description": "Used to create a reservation for a specific hotel. Expects arrival and departure dates, number of adults, first and last name, phone number and email. Returns Links",
    "function": {
        "arguments": [
            {
                "name": "payload",
                "required": True,
                "type": {
                    "kind": "object",
                    "properties": [
                        {
                            "name": "costTotal",
                            "description": "I am total cost",
                            "required": True,
                            "type": {"kind": "primitive", "type": "number"},
                        },
                        {
                            "name": "rateArray",
                            "description": "",
                            "required": True,
                            "type": {
                                "kind": "object",
                                "schema": {
                                    "$schema": "http://json-schema.org/draft-06/schema#",
                                    "type": "array",
                                    "items": {"$ref": "#/definitions/ArgumentElement"},
                                    "definitions": {
                                        "ArgumentElement": {
                                            "type": "object",
                                            "additionalProperties": False,
                                            "properties": {
                                                "base": {"$ref": "#/definitions/Base"},
                                                "total": {
                                                    "$ref": "#/definitions/Total"
                                                },
                                                "start": {
                                                    "type": "string",
                                                    "format": "date",
                                                },
                                                "end": {
                                                    "type": "string",
                                                    "format": "date",
                                                },
                                            },
                                            "required": [
                                                "base",
                                                "end",
                                                "start",
                                                "total",
                                            ],
                                            "title": "ArgumentElement",
                                        },
                                        "Base": {
                                            "type": "object",
                                            "additionalProperties": False,
                                            "properties": {
                                                "amountBeforeTax": {"type": "integer"},
                                                "currencyCode": {"type": "string"},
                                            },
                                            "required": [
                                                "amountBeforeTax",
                                                "currencyCode",
                                            ],
                                            "title": "Base",
                                        },
                                        "Total": {
                                            "type": "object",
                                            "additionalProperties": False,
                                            "properties": {
                                                "amountBeforeTax": {"type": "integer"}
                                            },
                                            "required": ["amountBeforeTax"],
                                            "title": "Total",
                                        },
                                    },
                                },
                            },
                        },
                        {
                            "name": "arrivalDate",
                            "description": "",
                            "required": True,
                            "type": {"kind": "primitive", "type": "string"},
                        },
                        {
                            "name": "departureDate",
                            "description": "",
                            "required": True,
                            "type": {"kind": "primitive", "type": "string"},
                        },
                    ],
                },
            },
        ],
    },
}

JSONREF_PROPERTY = {
    "$schema": "http://json-schema.org/draft-06/schema#",
    "type": "array",
    "items": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "base": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "amountBeforeTax": {"type": "integer"},
                    "currencyCode": {"type": "string"},
                },
                "required": ["amountBeforeTax", "currencyCode"],
                "title": "Base",
            },
            "total": {
                "type": "object",
                "additionalProperties": False,
                "properties": {"amountBeforeTax": {"type": "integer"}},
                "required": ["amountBeforeTax"],
                "title": "Total",
            },
            "start": {"type": "string", "format": "date"},
            "end": {"type": "string", "format": "date"},
        },
        "required": ["base", "end", "start", "total"],
        "title": "ArgumentElement",
    },
    "definitions": {
        "ArgumentElement": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "base": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "amountBeforeTax": {"type": "integer"},
                        "currencyCode": {"type": "string"},
                    },
                    "required": ["amountBeforeTax", "currencyCode"],
                    "title": "Base",
                },
                "total": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {"amountBeforeTax": {"type": "integer"}},
                    "required": ["amountBeforeTax"],
                    "title": "Total",
                },
                "start": {"type": "string", "format": "date"},
                "end": {"type": "string", "format": "date"},
            },
            "required": ["base", "end", "start", "total"],
            "title": "ArgumentElement",
        },
        "Base": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "amountBeforeTax": {"type": "integer"},
                "currencyCode": {"type": "string"},
            },
            "required": ["amountBeforeTax", "currencyCode"],
            "title": "Base",
        },
        "Total": {
            "type": "object",
            "additionalProperties": False,
            "properties": {"amountBeforeTax": {"type": "integer"}},
            "required": ["amountBeforeTax"],
            "title": "Total",
        },
    },
}

OPTORO = {
    "name": "returnsPortalOrder",
    "description": "JSON object for creating the portal return order",
    "required": True,
    "type": {
        "kind": "object",
        "schema": {
            "$schema": "http://json-schema.org/draft-06/schema#",
            "definitions": {
                "ReturnsPortalOrder": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "orders": {
                            "type": "array",
                            "items": {"$ref": "#/definitions/Order"},
                            "description": "Array containing the orders details.",
                        }
                    },
                    "required": ["orders"],
                    "title": "ReturnsPortalOrder",
                },
                "Order": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "identifier": {
                            "type": "string",
                            "description": "Identifier is the order identifier used by the clients internal ecomm systems.",
                        },
                        "raw_status": {
                            "type": "string",
                            "description": "The raw status of the order.",
                        },
                        "status": {
                            "type": "string",
                            "description": "Status can be sent as Created, Shipped, or Cancelled.",
                        },
                        "total_amount_cents": {
                            "type": "integer",
                            "description": "Total_amount_cents is the sum of the header level total_amount_cents and product_amount_cents.",
                        },
                        "product_amount_cents": {
                            "type": "integer",
                            "description": "Product_amount_cents at the header level is the sum of the product_amount_cents for each line.",
                        },
                        "tax_amount_cents": {
                            "type": "integer",
                            "description": "Tax_amount_cents at the header level is the sum of the tax_amount_cents for each line.",
                        },
                        "discount_amount_cents": {"type": "integer"},
                        "shipping_amount_cents": {"type": "integer"},
                        "shipping_tax_amount_cents": {"type": "integer"},
                        "currency": {"type": "string"},
                        "tags": {"type": "array", "items": {}},
                        "created_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Created_at should be the time the order was created in the Order Management System.",
                        },
                        "updated_at": {"type": "string", "format": "date-time"},
                        "items": {
                            "type": "array",
                            "items": {"$ref": "#/definitions/Item"},
                            "description": "Array containing the items details.",
                        },
                        "customer": {"$ref": "#/definitions/Customer"},
                        "shipping_address": {"$ref": "#/definitions/IngAddress"},
                        "billing_address": {"$ref": "#/definitions/IngAddress"},
                        "transactions": {"type": "array", "items": {}},
                        "refunds": {"type": "array", "items": {}},
                        "discounts": {"type": "array", "items": {}},
                    },
                    "required": [
                        "billing_address",
                        "created_at",
                        "currency",
                        "customer",
                        "discount_amount_cents",
                        "discounts",
                        "identifier",
                        "items",
                        "product_amount_cents",
                        "raw_status",
                        "refunds",
                        "shipping_address",
                        "shipping_amount_cents",
                        "shipping_tax_amount_cents",
                        "status",
                        "tags",
                        "tax_amount_cents",
                        "total_amount_cents",
                        "transactions",
                        "updated_at",
                    ],
                    "title": "Order",
                },
                "IngAddress": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "name": {"type": "string"},
                        "street1": {"type": "string"},
                        "city": {"type": "string"},
                        "state": {"type": "string"},
                        "zip_code": {"type": "string", "format": "integer"},
                        "country_code": {"type": "string"},
                        "phone": {"type": "string"},
                    },
                    "required": [
                        "city",
                        "country_code",
                        "name",
                        "phone",
                        "state",
                        "street1",
                        "zip_code",
                    ],
                    "title": "IngAddress",
                },
                "Customer": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "identifier": {
                            "type": "string",
                            "format": "integer",
                            "description": "If there is no customer identifier it is recommended to send the customers email as the identifier.",
                        },
                        "first_name": {"type": "string"},
                        "last_name": {"type": "string"},
                        "email": {"type": "string"},
                        "phone": {"type": "string"},
                    },
                    "required": [
                        "email",
                        "first_name",
                        "identifier",
                        "last_name",
                        "phone",
                    ],
                    "title": "Customer",
                },
                "Item": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "identifier": {
                            "type": "string",
                            "format": "integer",
                            "description": "Identifier is the forward order lines identifier.",
                        },
                        "sku": {"type": "string"},
                        "upc": {"type": "string", "format": "integer"},
                        "quantity": {
                            "type": "integer",
                            "description": "The quantity is the total quantity on the order-line.",
                        },
                        "quantity_shipped": {
                            "type": "integer",
                            "description": "The quantity_shipped is the total quantity of shipped units on the order-line. This scenario is a full shipment and refund so the quantity_shipped is equal to the quantity.",
                        },
                        "quantity_canceled": {
                            "type": "integer",
                            "description": "The quantity_canceled is the total quantity of cancelled units on the order-line. This scenario is a full shipment and refund so the quantity_canceled is 0.",
                        },
                        "tracking_number": {"type": "string"},
                        "shipped_date": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Shipped_date can be used to mark the start of the return window.",
                        },
                        "product_identifier": {
                            "type": "string",
                            "format": "integer",
                            "description": "Product_identifier is the Client Id unique to that product (ex. same SKU from different vendors). Send SKU if no product_identifier exists.",
                        },
                        "variant_identifier": {
                            "type": "string",
                            "format": "integer",
                            "description": "Variant_identifier is used to find the skus that should be made available to the customer as part of the even exchange.",
                        },
                        "title": {"type": "string"},
                        "tags": {"type": "array", "items": {}},
                        "product_amount_cents": {
                            "type": "integer",
                            "description": "Product_amount_cents is the unit_price_amount_cents multiplied by the quantity_shipped.",
                        },
                        "tax_amount_cents": {
                            "type": "integer",
                            "description": "Tax_amount_cents is the tax, in cents, for all units for the sku in the shipment.",
                        },
                        "discount_amount_cents": {"type": "integer"},
                        "unit_price_amount_cents": {
                            "type": "integer",
                            "description": "Unit_price_amount_cents is the price, in cents, for a single unit of the sku.",
                        },
                        "image_url": {
                            "type": "string",
                            "format": "uri",
                            "qt-uri-protocols": ["https"],
                            "qt-uri-extensions": [".jpg"],
                        },
                        "weight": {
                            "type": "number",
                            "description": "Weight is needed for determining ER eligibility if catalog is not provided.",
                        },
                    },
                    "required": [
                        "discount_amount_cents",
                        "identifier",
                        "image_url",
                        "product_amount_cents",
                        "product_identifier",
                        "quantity",
                        "quantity_canceled",
                        "quantity_shipped",
                        "shipped_date",
                        "sku",
                        "tags",
                        "tax_amount_cents",
                        "title",
                        "tracking_number",
                        "unit_price_amount_cents",
                        "upc",
                        "variant_identifier",
                        "weight",
                    ],
                    "title": "Item",
                },
            },
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "returns_portal_order": {
                    "$ref": "#/definitions/ReturnsPortalOrder",
                    "description": "Contains details of the returns portal order.",
                }
            },
            "required": ["returns_portal_order"],
            "title": "Argument",
        },
    },
}

CALLBACK_PROPERTY = {
    "name": "callback",
    "required": True,
    "type": {
        "kind": "function",
        "spec": {
            "arguments": [
                {
                    "name": "event",
                    "required": False,
                    "type": {
                        "kind": "object",
                        "schema": {
                            "$schema": "http://json-schema.org/draft-06/schema#",
                            "definitions": {},
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "foo": {"type": "string"},
                                "bar": {"type": "string", "format": "integer"},
                            },
                            "required": ["bar", "foo"],
                            "title": "WebhookEventType",
                        },
                    },
                },
                {
                    "name": "headers",
                    "required": False,
                    "type": {"kind": "object", "typeName": "Record<string, any>"},
                },
                {
                    "name": "params",
                    "required": False,
                    "type": {"kind": "object", "typeName": "Record<string, any>"},
                },
            ],
            "returnType": {"kind": "void"},
            "synchronous": True,
        },
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
        self.assertTrue(args[0].startswith("payload:"))
        self.assertEqual(args[1], "GAPIKey: string,  // your api key")

    def test_func_args_ref(self):
        arguments = func_args(REF_FUNC)
        self.assertIn("rateArray", arguments[0])

    def test_process_property_optoro_desc(self):
        """nested properties under JSONREF should provide description"""
        property_str = _process_property_spec(OPTORO)
        self.assertIn("status", property_str)
        self.assertIn("// Status can be sent", property_str)

    def test_process_schema_property(self):
        processed = _process_schema_property(JSONREF_PROPERTY)
        expected = """[{
base: {
amountBeforeTax: integer,
currencyCode: string,
},
total: {
amountBeforeTax: integer,
},
start: string,
end: string,
},],"""
        self.assertEqual(processed, expected)

    def test_func_path_with_args(self):
        fpwa = func_path_with_args(FUNC)
        expected = """poly.shipping.gMapsGetXy(
payload: {
x: number,  // latitude of location
y: number,  // longitude of location
},  // da payload
GAPIKey: string,  // your api key
)"""
        self.assertEqual(fpwa, expected)

    def test_store_message(self):
        user = test_user_get_or_create()
        conversation = create_new_conversation(user.id)

        msg = store_message(
            conversation.id,
            {
                "role": "user",
                "content": "profound question",
            },
        )
        self.assertEqual(msg.content, "profound question")

    def test_store_message_name(self):
        user = test_user_get_or_create()
        conversation = create_new_conversation(user.id)

        msg = store_message(
            conversation.id,
            {
                "role": "function",
                "name": "foobar",
                "content": "profound question",
            },
        )
        self.assertEqual(msg.role, "function")
        self.assertEqual(msg.name, "foobar")
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

    def test_get_return_properties_get_products(self):
        spec = {
            "function": {
                "returnType": {
                    "kind": "object",
                    "schema": {
                        "$schema": "http://json-schema.org/draft-06/schema#",
                        "definitions": {
                            "Product": {
                                "type": "object",
                                "additionalProperties": False,
                                "properties": {
                                    "id": {"type": "integer"},
                                    "title": {"type": "string"},
                                    "body_html": {"type": "string"},
                                    "vendor": {"type": "string"},
                                    "product_type": {"type": "string"},
                                    "created_at": {
                                        "type": "string",
                                        "format": "date-time",
                                    },
                                    "handle": {"type": "string"},
                                    "updated_at": {
                                        "type": "string",
                                        "format": "date-time",
                                    },
                                    "published_at": {
                                        "type": "string",
                                        "format": "date-time",
                                    },
                                    "template_suffix": {"type": "string"},
                                    "status": {"type": "string"},
                                    "published_scope": {"type": "string"},
                                    "tags": {"type": "string"},
                                    "admin_graphql_api_id": {"type": "string"},
                                    "variants": {
                                        "type": "array",
                                        "items": {"$ref": "#/definitions/Variant"},
                                    },
                                    "options": {
                                        "type": "array",
                                        "items": {"$ref": "#/definitions/Option"},
                                    },
                                    "images": {
                                        "type": "array",
                                        "items": {"$ref": "#/definitions/Image"},
                                    },
                                    "image": {"$ref": "#/definitions/Image"},
                                },
                                "required": [
                                    "admin_graphql_api_id",
                                    "body_html",
                                    "created_at",
                                    "handle",
                                    "id",
                                    "image",
                                    "images",
                                    "options",
                                    "product_type",
                                    "published_at",
                                    "published_scope",
                                    "status",
                                    "tags",
                                    "template_suffix",
                                    "title",
                                    "updated_at",
                                    "variants",
                                    "vendor",
                                ],
                                "title": "Product",
                            },
                            "Alt": {
                                "type": "object",
                                "additionalProperties": False,
                                "title": "Alt",
                            },
                            "Image": {
                                "type": "object",
                                "additionalProperties": False,
                                "properties": {
                                    "id": {"type": "integer"},
                                    "product_id": {"type": "integer"},
                                    "position": {"type": "integer"},
                                    "created_at": {
                                        "type": "string",
                                        "format": "date-time",
                                    },
                                    "updated_at": {
                                        "type": "string",
                                        "format": "date-time",
                                    },
                                    "alt": {"$ref": "#/definitions/Alt"},
                                    "width": {"type": "integer"},
                                    "height": {"type": "integer"},
                                    "src": {
                                        "type": "string",
                                        "format": "uri",
                                        "qt-uri-protocols": ["https"],
                                        "qt-uri-extensions": [".webp"],
                                    },
                                    "variant_ids": {"type": "array", "items": {}},
                                    "admin_graphql_api_id": {"type": "string"},
                                },
                                "required": [
                                    "admin_graphql_api_id",
                                    "alt",
                                    "created_at",
                                    "height",
                                    "id",
                                    "position",
                                    "product_id",
                                    "src",
                                    "updated_at",
                                    "variant_ids",
                                    "width",
                                ],
                                "title": "Image",
                            },
                            "Option": {
                                "type": "object",
                                "additionalProperties": False,
                                "properties": {
                                    "id": {"type": "integer"},
                                    "product_id": {"type": "integer"},
                                    "name": {"type": "string"},
                                    "position": {"type": "integer"},
                                    "values": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                    },
                                },
                                "required": [
                                    "id",
                                    "name",
                                    "position",
                                    "product_id",
                                    "values",
                                ],
                                "title": "Option",
                            },
                            "Variant": {
                                "type": "object",
                                "additionalProperties": False,
                                "properties": {
                                    "id": {"type": "integer"},
                                    "product_id": {"type": "integer"},
                                    "title": {"type": "string"},
                                    "price": {"type": "string"},
                                    "sku": {"type": "string"},
                                    "position": {"type": "integer"},
                                    "inventory_policy": {"type": "string"},
                                    "compare_at_price": {"$ref": "#/definitions/Alt"},
                                    "fulfillment_service": {"type": "string"},
                                    "inventory_management": {"type": "string"},
                                    "option1": {"type": "string"},
                                    "option2": {"$ref": "#/definitions/Alt"},
                                    "option3": {"$ref": "#/definitions/Alt"},
                                    "created_at": {
                                        "type": "string",
                                        "format": "date-time",
                                    },
                                    "updated_at": {
                                        "type": "string",
                                        "format": "date-time",
                                    },
                                    "taxable": {"type": "boolean"},
                                    "barcode": {"type": "string"},
                                    "grams": {"type": "integer"},
                                    "image_id": {"$ref": "#/definitions/Alt"},
                                    "weight": {"type": "integer"},
                                    "weight_unit": {"type": "string"},
                                    "inventory_item_id": {"type": "integer"},
                                    "inventory_quantity": {"type": "integer"},
                                    "old_inventory_quantity": {"type": "integer"},
                                    "requires_shipping": {"type": "boolean"},
                                    "admin_graphql_api_id": {"type": "string"},
                                },
                                "required": [
                                    "admin_graphql_api_id",
                                    "barcode",
                                    "compare_at_price",
                                    "created_at",
                                    "fulfillment_service",
                                    "grams",
                                    "id",
                                    "image_id",
                                    "inventory_item_id",
                                    "inventory_management",
                                    "inventory_policy",
                                    "inventory_quantity",
                                    "old_inventory_quantity",
                                    "option1",
                                    "option2",
                                    "option3",
                                    "position",
                                    "price",
                                    "product_id",
                                    "requires_shipping",
                                    "sku",
                                    "taxable",
                                    "title",
                                    "updated_at",
                                    "weight",
                                    "weight_unit",
                                ],
                                "title": "Variant",
                            },
                        },
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "products": {
                                "type": "array",
                                "items": {"$ref": "#/definitions/Product"},
                            }
                        },
                        "required": ["products"],
                        "title": "ReturnType",
                    },
                }
            }
        }
        props = get_return_type_properties(spec)
        self.assertIn("data", props)

    def test_process_property_spec_function(self):
        arg = _process_property_spec(CALLBACK_PROPERTY)
        self.assertIn("WebhookEventType", arg)