#!/usr/bin/env python3
""" take public function data and dump to na1
"""
import json
from prisma import Prisma, register


def dump_auth_providers() -> None:
    auth_provider_ids = []  # TODO get these
    db_auths = db.authprovider.find_many(where={"id": {"in": auth_provider_ids}})
    funcs = []
    for db_auth in db_auths:
        funcs.append(
            {
                "name": db_auth.name,
                "context": db_auth.context,
                "authorizeUrl": db_auth.authorizeUrl,
                "tokenUrl": db_auth.tokenUrl,
                "revokeUrl": db_auth.revokeUrl,
                "introspectUrl": db_auth.introspectUrl,
                "audienceRequired": db_auth.audienceRequired,
                "refreshEnabled": db_auth.refreshEnabled,
                "trained": db_auth.trained,
                "visibility": db_auth.visibility,
                # TODO do the rest of the fields
            }
        )
    with open("auth_providers.json", "w") as f:
        f.write(json.dumps(funcs, indent=2))


if __name__ == "__main__":
    db = Prisma()
    db.connect()
    register(db)

    dump_auth_providers()

    db.disconnect()
