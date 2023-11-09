#!/usr/bin/env python3
"""
To run this script:
$ cd science
$ PYTHONPATH="./" bootstrap/update_public_functions.py
"""
import json
from prisma import Prisma, register, get_client


def update_auth_providers() -> None:
    try:
        with open("./data/auth_providers.json") as f:
            provider_data = json.loads(f.read())
    except FileNotFoundError:
        print("No auth provider data to load. Please contact support@polyapi.io to get the latest data.")
        return

    db = get_client()
    if db.authprovider.count():
        print("Auth providers exist, skipping initialization.")
        return

    tenant = db.tenant.find_unique(where={"name": "poly-system"})
    assert tenant
    environment = db.environment.find_first(where={"tenantId": tenant.id})
    assert environment

    for p in provider_data:
        p['environmentId'] = environment.id
        auth_provider = db.authprovider.create(data=p)
        print(f'Auth provider {auth_provider.context}.{auth_provider.name} created!')


if __name__ == "__main__":
    db = Prisma()
    db.connect()
    register(db)

    update_auth_providers()

    db.disconnect()
