#!/usr/bin/env python3
import csv
from typing import List
import openai
from flask import Flask, request

app = Flask(__name__)


@app.route("/")
def home():
    readme_link = "<a href='https://github.com/polyapi/poly-alpha/blob/main/train/README.md'>README</a>"
    return f"<h1>Hello, World!</h1>\n<div>You probably want `POST /function_completions/`! See the {readme_link} for details"


@app.route("/function-completion", methods=['POST'])  # type: ignore
def function_completion():
    # question = "how do I get a list of flights for a specific user?"
    question = request.get_json(force=True)['question']
    functions = get_functions()

    resp = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "assistant", "content": functions},
            {"role": "user", "content": question},
        ],
    )
    return resp['choices'][0]["message"]["content"]


def get_functions() -> str:
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