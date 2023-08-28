#!/usr/bin/env python3
from pathlib import Path
import openai


def start_fine_tune() -> None:
    abs_path = Path(__file__).parent
    jsonl_path = (abs_path / "data/examples.jsonl").resolve()
    upload = openai.File.create(file=open(jsonl_path, "rb"), purpose="fine-tune")
    resp = openai.FineTune.create(training_file=upload.id, model="davinci")
    print("To follow the model and see when it's done, please run the following:")
    print(f"openai api fine_tunes.follow -i {resp['id']}")

    # TODO
    # mark all funcs as trained (aka fine tuned)?


if __name__ == "__main__":
    start_fine_tune()