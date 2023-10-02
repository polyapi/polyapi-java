import datetime
from app.perf import PerfLogger
from app.constants import PerfLogType
from load_fixtures import test_user_get_or_create
from .testing import DbTestCase


class T(DbTestCase):
    def test_perf_logger(self) -> None:
        user = test_user_get_or_create()

        before = datetime.datetime.now()
        plogger = PerfLogger()
        plogger.set_data(
            snippet="hi world",
            input_length=len("hi world"),
            output_length=len("abc"),
            type=PerfLogType.science_api_execute.value,
            userId=user.id)
        plogger.stop_and_save()

        # get recent PerfLogs
        perflogs = self.db.perflog.find_many(where={"start": {"gte": before}})
        self.assertEqual(len(perflogs), 1)

        perflog = perflogs[0]
        self.assertEqual(perflog.userId, user.id)
        self.assertEqual(perflog.snippet, "hi world")
        self.assertEqual(perflog.inputLength, 8)
        self.assertEqual(perflog.outputLength, 3)
        self.assertEqual(perflog.type, PerfLogType.science_api_execute.value)
        self.assertGreater(perflog.duration, 0)

