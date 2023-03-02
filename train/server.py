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
    question = "how do I get a list of flights for a specific user?"

    resp = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "assistant", "content": prompt},
            {"role": "user", "content": question},
        ],
    )
    return resp['choices'][0]["message"]["content"]


if __name__ == "__main__":
    main()
