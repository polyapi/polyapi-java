#!/usr/bin/env python3
import datetime
import csv
from typing import List, TypedDict
from prisma import Prisma, register, get_client
from prisma.models import User, ApiFunction
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
        user = db.user.create(
            data={"name": "test", "role": "ADMIN"}
        )
    return user


def load_functions(user: User) -> None:
    db = get_client()
    data_list: List[FunctionDict] = _get_data_list()

    for data in data_list:
        headers = data["headers"]
        if "'" in headers:
            # replace single quotes with double to make this valid json
            headers = headers.replace("'", '"')

        func = db.apifunction.find_first(where={"name": data['name']})
        if func:
            print(f"{url_function_path(func)} already exists.")
        else:
            func = db.apifunction.create(
                data={
                    "context": data["context"],
                    "name": data["name"],
                    "description": data["description"],
                    "userId": user.id,
                    "url": data["url"],
                    "headers": headers,
                    "method": data["method"],
                    "createdAt": datetime.datetime.now(),
                }  # type: ignore
            )
            print(f"Created {url_function_path(func)}")

    db.functiondefined.delete_many()
    db.webhookdefined.delete_many()
    conversations_deleted = db.conversationmessage.delete_many()
    print(f"Deleted {conversations_deleted} conversations.")


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

    load_functions(user)
    db.disconnect()
