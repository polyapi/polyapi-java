#!/usr/bin/env python3
import time
from typing import cast
from pathlib import Path
import openai


def start_fine_tune() -> None:
    upload = True
    if upload:
        abs_path = Path(__file__).parent
        jsonl_path = (abs_path / "../data/examples.jsonl").resolve()
        upload = openai.File.create(file=open(jsonl_path, "rb"), purpose="fine-tune")
        upload_id = cast(str, upload.id)  # type: ignore
        time.sleep(60)  # need to wait a bit for file to be available
    else:
        # file has already been uploaded and we are waiting for it!
        upload_id = "file-EzZlGMx9Lg6uztWuaFLJ5R0G"
    resp = openai.FineTuningJob.create(training_file=upload_id, model="gpt-3.5-turbo-0613")
    print("To follow the model and see when it's done, please run the following:")
    print(f"watch -n 60 openai api fine_tuning.job.get -i {resp['id']}")

    # TODO
    # mark all funcs as trained (aka fine tuned)?


if __name__ == "__main__":
    start_fine_tune()