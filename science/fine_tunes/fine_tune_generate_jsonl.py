#!/usr/bin/env python3
from pathlib import Path
import json
from first_10 import FIRST_10

SYSTEM_PROMPT = {
    "role": "system",
    "content": "You are a parrot named Poly, you are playfull, fun and love to help people learn. You are being prompted by a developer trying to get help with consuming APIs and Events. Developers are very technical so feel free to use very technical and consise responses. You provide examples in typescript but dont feel the need to comment a lot. You also respect the users language preferences and respond in the same language as prompted in.",
}


def transform_to_jsonl() -> str:
    data = []
    for example in FIRST_10:
        user_prompt = {"role": "user", "content": example['prompt']}
        question_prompt = {"role": "user", "content": example['question']}
        assistant_prompt = {"role": "assistant", "content": example['completion']}
        data.append(
            {
                "messages": [SYSTEM_PROMPT, question_prompt, user_prompt, assistant_prompt],
            }
        )

    abs_path = Path(__file__).parent
    jsonl_path = (abs_path / "../data/examples.jsonl").resolve()
    with open(jsonl_path, "w") as f:
        for d in data:
            f.write(json.dumps(d))
            f.write("\n")
        # HACK double write for now to get to 10!
        for d in data:
            f.write(json.dumps(d))
            f.write("\n")

    print(f"training data processed and written to {jsonl_path}")
    return str(jsonl_path)


if __name__ == "__main__":
    transform_to_jsonl()
