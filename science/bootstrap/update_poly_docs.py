#!/usr/bin/env python3
"""
To run this script:
$ cd science
$ PYTHONPATH="./" bootstrap/update_poly_docs.py
"""
from prisma import Prisma, register

from app.docs import update_poly_docs


if __name__ == "__main__":
    db = Prisma()
    db.connect()
    register(db)

    update_poly_docs()

    db.disconnect()
