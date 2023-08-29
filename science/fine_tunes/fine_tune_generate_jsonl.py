#!/usr/bin/env python3
from pathlib import Path
import json
from first_10 import FIRST_10

SYSTEM = "TODO"


def transform_to_jsonl() -> str:
    data = []
    for example in FIRST_10:
        data.append(
            {
                "prompt": SYSTEM + "\n\n" + example["prompt"],
                # TODO make a `converation_get_completion_answer`
                # and make this base one not require db/user_id
                "completion": example["completion"],
            }
        )

    abs_path = Path(__file__).parent
    jsonl_path = (abs_path / "../data/examples.jsonl").resolve()
    with open(jsonl_path, "w") as f:
        for d in data:
            f.write(json.dumps(d))
            f.write("\n")

    print(f"training data processed and written to {jsonl_path}")
    return str(jsonl_path)


if __name__ == "__main__":
    transform_to_jsonl()
