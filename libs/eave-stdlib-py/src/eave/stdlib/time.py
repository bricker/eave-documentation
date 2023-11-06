import os
import time

ONE_SECOND_IN_MS = 1000
ONE_MINUTE_IN_MS = ONE_SECOND_IN_MS * 60
ONE_HOUR_IN_MS = ONE_MINUTE_IN_MS * 60
ONE_DAY_IN_MS = ONE_HOUR_IN_MS * 24
ONE_WEEK_IN_MS = ONE_DAY_IN_MS * 7
ONE_YEAR_IN_MS = ONE_DAY_IN_MS * 365


def set_utc() -> None:
    os.environ["TZ"] = "UTC"
    time.tzset()
