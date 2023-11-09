#!/usr/bin/env python3
""" take public function data and dump to na1
"""
import json
from prisma import Prisma, register


def dump_public_functions() -> None:
    func_ids = ["9b2e812a-8bd5-4ee7-8831-7aa548b7df5c"]
    db_funcs = db.apifunction.find_many(where={"id": {"in": func_ids}})
    funcs = []
    for db_func in db_funcs:
        funcs.append(
            {
                "name": db_func.name,
                "context": db_func.context,
                "description": db_func.description,
                "payload": db_func.payload,
                "method": db_func.method,
                "url": db_func.url,
                "headers": db_func.headers,
                "body": db_func.body,
                "auth": db_func.auth,
                "responseType": db_func.responseType,
                "argumentsMetadata": db_func.argumentsMetadata,
                "trained": db_func.trained,
                "visibility": db_func.visibility,
                "graphqlIdentifier": db_func.graphqlIdentifier,
                "graphqlIntrospectionResponse": db_func.graphqlIntrospectionResponse,
                "enableRedirect": db_func.enableRedirect,
            }
        )
    with open("public_functions.json", "w") as f:
        f.write(json.dumps(funcs, indent=2))


if __name__ == "__main__":
    db = Prisma()
    db.connect()
    register(db)

    dump_public_functions()

    db.disconnect()
