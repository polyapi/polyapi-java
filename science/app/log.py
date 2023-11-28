""" logging related functions
"""
import sys
import logging
import rollbar
from typing import Dict

logging.basicConfig(stream=sys.stdout, level=logging.INFO)


def log(*args, **kwargs) -> None:
    try:
        print(*args, **kwargs, flush=True)
    except UnicodeEncodeError:
        print("UnicodeEncodeError! TODO FIXME")


def log_exception(error):
    logging.exception(error)


def rlog_desc_info(trace_id: str, msg: str, data: Dict, completion: str) -> None:
    """lets log some info stuff related to description generation so we can track things
    down if a bug is reported
    """
    if rollbar._initialized:
        rollbar.report_message(
            msg,
            "info",
            payload_data={
                "prompt_data": data,
                "completion": completion,
                "trace_id": trace_id,
            },
        )
    else:
        parts = [
            trace_id,
            msg,
            "input:",
            str(data),
            "output:",
            completion,
        ]
        log("\n".join(parts))
