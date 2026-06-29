import logging
import os
import threading
import time
from datetime import datetime, timedelta

from extractors.calibration_extractor import process_s3_prefix
from paths import get_qc_data_key


logger = logging.getLogger("calibration_scheduler")

DEFAULT_CALIBRATION_INTERVAL_SECONDS = 3 * 60 * 60

_scheduler_thread = None
_scheduler_started = False
_scheduler_lock = threading.Lock()


def _read_int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def _run_extraction(prefix: str, force: bool = False) -> None:
    try:
        logger.info("calibration_scheduled_extraction_started prefix=%s force=%s", prefix, force)
        summary = process_s3_prefix(prefix, force=force)
        logger.info("calibration_scheduled_extraction_completed summary=%s", summary)
    except Exception as exc:
        logger.exception("calibration_scheduled_extraction_failed error=%s", exc)


def _scheduler_loop(run_immediately: bool) -> None:
    prefix = get_qc_data_key("Calibration Data")
    interval = _read_int_env("CALIBRATION_EXTRACTION_INTERVAL_SECONDS", DEFAULT_CALIBRATION_INTERVAL_SECONDS)
    now = datetime.utcnow()
    next_extraction = now if run_immediately else now + timedelta(seconds=interval)

    logger.info("calibration_extractor_started prefix=%s interval=%s", prefix, interval)
    while True:
        now = datetime.utcnow()
        if now >= next_extraction:
            _run_extraction(prefix)
            next_extraction = datetime.utcnow() + timedelta(seconds=interval)

        sleep_seconds = max(5, min(60, int((next_extraction - datetime.utcnow()).total_seconds())))
        time.sleep(sleep_seconds)


def start_calibration_scheduler(run_immediately: bool = True):
    global _scheduler_thread, _scheduler_started

    if os.getenv("CALIBRATION_SCHEDULER_ENABLED", "true").lower() in {"0", "false", "no"}:
        logger.info("calibration_scheduler_disabled")
        return None

    with _scheduler_lock:
        if _scheduler_started:
            return _scheduler_thread

        _scheduler_thread = threading.Thread(
            target=_scheduler_loop,
            args=(run_immediately,),
            daemon=True,
            name="calibration-scheduler",
        )
        _scheduler_thread.start()
        _scheduler_started = True
        return _scheduler_thread
