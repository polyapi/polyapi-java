#!/usr/bin/env python3
import csv
from typing import List
import openai


def get_function_prompt() -> str:
    preface = "Given the following functions,"
    parts: List[str] = [preface]

    with open("./data/toy.csv") as f:
        reader = csv.reader(f)
        for row in reader:
            code = row[0]
            comment = row[1]

            if code == "Code":
                # skip the header
                continue

            parts.append(f"// {comment}\n{code}")

    return "\n\n".join(parts)



def main() -> None:
    prompt = get_function_prompt()
    print(prompt)

    import ipdb; ipdb.set_trace()

    # resp = openai.FineTune.create(training_file=upload.id, model="davinci")


if __name__ == "__main__":
    main()
