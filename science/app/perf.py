import datetime
import time
from typing import Optional
from prisma import get_client
from prisma.models import PerfLog


class PerfLogger:
    def __init__(self):
        self.start = datetime.datetime.now()
        self.start_count = time.perf_counter()

    def set_data(
        self,
        *,
        snippet: str,
        type: int,
        input_length: int,
        output_length: int,
        apiKey: Optional[str] = None,
        userId: Optional[str] = None,
        applicationId: Optional[str] = None,
    ):
        self.snippet = snippet
        self.input_length = input_length
        self.output_length = output_length
        self.type = type
        self.apiKey = apiKey
        self.userId = userId
        self.applicationId = applicationId

    def stop_and_save(self) -> PerfLog:
        db = get_client()
        if self.apiKey:
            db_api_key = db.apikey.find_unique(where={"key": self.apiKey})
            if db_api_key:
                self.userId = db_api_key.userId
                self.applicationId = db_api_key.applicationId

        duration = time.perf_counter() - self.start_count
        return db.perflog.create(
            {
                "start": self.start,
                "duration": duration,
                "snippet": self.snippet,
                "input_length": self.input_length,
                "output_length": self.output_length,
                "type": self.type,
                "userId": self.userId,
                "applicationId": self.applicationId,
            }
        )
