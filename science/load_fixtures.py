#!/usr/bin/env python3
import datetime
import csv
import os
from typing import List, TypedDict
from prisma import Prisma, register, get_client
from prisma.models import User, ApiFunction, Environment, GptPlugin
from app.utils import url_function_path


class FunctionDict(TypedDict):
    context: str
    name: str
    description: str
    method: str
    url: str
    headers: str


def _get_data_list():
    rv = []
    with open("./data/fixtures.csv") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rv.append(row)
    return rv


def test_user_get_or_create() -> User:
    db = get_client()
    user = db.user.find_first(where={"name": "test"})

    if not user:
        tenant = db.tenant.find_first()
        assert tenant
        user = db.user.create(data={"name": "test", "role": "ADMIN", "tenantId": tenant.id})

    return user


def test_environment_get_or_create() -> Environment:
    db = get_client()
    tenant = db.tenant.find_first(where={"name": "test"})
    if not tenant:
        tenant = db.tenant.create(data={"name": "test"})

    user = db.environment.find_first(where={"name": "test"})
    if not user:
        user = db.environment.create(
            data={
                "name": "test",
                "tenantId": tenant.id,
                "subdomain": "test",
            }
        )
    return user


def test_plugin_get_or_create(slug: str) -> GptPlugin:
    environment = test_environment_get_or_create()
    db = get_client()
    plugin = db.gptplugin.find_first(where={"slug": slug})
    if not plugin:
        plugin = db.gptplugin.create(
            data={
                "slug": slug,
                "name": "Service Nexus",
                "environmentId": environment.id,
                "iconUrl": "",
                "functionIds": "",
            }
        )
    return plugin


def load_functions(user: User) -> None:
    db = get_client()
    environment = test_environment_get_or_create()
    assert environment
    data_list: List[FunctionDict] = _get_data_list()

    for data in data_list:
        headers = data["headers"]
        if "'" in headers:
            # replace single quotes with double to make this valid json
            headers = headers.replace("'", '"')

        func = db.apifunction.find_first(where={"name": data["name"]})
        if func:
            print(f"{url_function_path(func)} already exists.")
        else:
            func = db.apifunction.create(
                data={
                    "context": data["context"],
                    "name": data["name"],
                    "description": data["description"],
                    "url": data["url"],
                    "headers": headers,
                    "method": data["method"],
                    "createdAt": datetime.datetime.now(),
                    "environmentId": environment.id,
                    "visibility": "PUBLIC",
                }  # type: ignore
            )
            print(f"Created {url_function_path(func)}")

    if not db.apifunction.find_first(where={"name": "twilioSendSms"}):
        db.apifunction.create(data=dict(
            environmentId=environment.id,
            context="comms.messaging",
            name="twilioSendSms",
            description="This API call allows sends SMS messages through Twilio's messaging service.",
            method="POST",
            body='{"mode":"urlencoded","urlencoded":[{"key":"To","value":"{{My_Phone_Number}}"},{"key":"From","value":"+17622396902"},{"key":"Body","value":"{{message}}"}]}',
            url='https://api.twilio.com/2010-04-01/Accounts/ACe562bccbc410295451a07d40747eb10b/Messages.json',
            auth=os.environ.get("TWILIO_AUTH"),
            responseType='{"$schema":"http://json-schema.org/draft-06/schema#","definitions":{"SubresourceUris":{"type":"object","additionalProperties":false,"properties":{"media":{"type":"string"}},"required":["media"],"title":"SubresourceUris"}},"type":"object","additionalProperties":false,"properties":{"body":{"type":"string"},"num_segments":{"type":"string","format":"integer"},"direction":{"type":"string"},"from":{"type":"string"},"date_updated":{"type":"string"},"price":{"type":"null"},"error_message":{"type":"null"},"uri":{"type":"string"},"account_sid":{"type":"string"},"num_media":{"type":"string","format":"integer"},"to":{"type":"string"},"date_created":{"type":"string"},"status":{"type":"string"},"sid":{"type":"string"},"date_sent":{"type":"null"},"messaging_service_sid":{"type":"null"},"error_code":{"type":"null"},"price_unit":{"type":"string"},"api_version":{"type":"string","format":"date"},"subresource_uris":{"$ref":"#/definitions/SubresourceUris"}},"required":["account_sid","api_version","body","date_created","date_sent","date_updated","direction","error_code","error_message","from","messaging_service_sid","num_media","num_segments","price","price_unit","sid","status","subresource_uris","to","uri"],"title":"ResponseType"}',
            argumentsMetadata='{}',
            visibility="PUBLIC")
        )


def united_get_status_get_or_create(user: User, load=True) -> ApiFunction:
    if load:
        load_functions(user)

    db = get_client()
    united = db.apifunction.find_first(where={"name": "unitedAirlines.getStatus"})
    assert united
    return united


if __name__ == "__main__":
    # if no passed db, use default db
    db = Prisma()
    db.connect()
    register(db)

    # create User
    user = db.user.find_first(where={"role": "ADMIN"})
    if not user:
        print("Admin user not found. Please run Poly server first for initialization.")
        exit(1)

    db.tenant.update_many(where={}, data={"publicVisibilityAllowed": True})
    load_functions(user)
    db.disconnect()
