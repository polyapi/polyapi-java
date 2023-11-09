#!/usr/bin/env python3
"""
To run this script:
$ cd science
$ PYTHONPATH="./" bootstrap/update_public_functions.py
"""
import json
from prisma import Prisma, register, get_client


def update_poly_functions() -> None:
    try:
        with open("./data/public_functions.json") as f:
            function_json = json.loads(f.read())
    except FileNotFoundError:
        print("No public function data to load. Please contact support@polyapi.io to get the latest public function data.")
        return

    db = get_client()
    if db.apifunction.count():
        print("Api functions exist, skipping initialization.")
        return

    tenant = db.tenant.find_unique(where={"name": "poly-system"})
    assert tenant
    environment = db.environment.find_first(where={"tenantId": tenant.id})
    assert environment

    for data in function_json:
        data['environmentId'] = environment.id
        api_func = db.apifunction.create(data=data)
        print(f'API Function {api_func.context}.{api_func.name} created!')


if __name__ == "__main__":
    db = Prisma()
    db.connect()
    register(db)

    update_poly_functions()

    db.disconnect()
