import logging
import os
import threading
import time
from datetime import datetime, timedelta

from extractors.peel_extractor import cleanup_old_s3_files, process_s3_prefix
from paths import get_qc_data_key


logger = logging.getLogger("peel_scheduler")

DEFAULT_EXTRACTION_INTERVAL_SECONDS = 3 * 60 * 60
DEFAULT_CLEANUP_INTERVAL_SECONDS = 24 * 60 * 60
DEFAULT_RECONCILIATION_INTERVAL_SECONDS = 15 * 60

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
        logger.info("scheduled_extraction_started prefix=%s force=%s", prefix, force)
        summary = process_s3_prefix(prefix, force=force)
        logger.info("scheduled_extraction_completed summary=%s", summary)
    except Exception as exc:
        logger.exception("scheduled_extraction_failed error=%s", exc)


def _run_cleanup(prefix: str) -> None:
    try:
        days = _read_int_env("PEEL_CLEANUP_DAYS", 7)
        dry_run = os.getenv("PEEL_CLEANUP_DRY_RUN", "false").lower() in {"1", "true", "yes"}
        logger.info("scheduled_cleanup_started prefix=%s days=%s dry_run=%s", prefix, days, dry_run)
        summary = cleanup_old_s3_files(prefix, days=days, dry_run=dry_run)
        logger.info("scheduled_cleanup_completed summary=%s", summary)
    except Exception as exc:
        logger.exception("scheduled_cleanup_failed error=%s", exc)


def _run_reconciliation() -> None:
    try:
        from services.peel_audit_reconciliation_service import reconciliation_enabled, reconcile_pending_audits
        if reconciliation_enabled():
            logger.info("scheduled_peel_audit_reconciliation_completed summary=%s", reconcile_pending_audits())
    except Exception as exc:
        logger.exception("scheduled_peel_audit_reconciliation_failed error=%s", exc)


def _scheduler_loop(run_immediately: bool) -> None:
    prefix = get_qc_data_key("Auto Peel Test Result")
    extraction_interval = _read_int_env("PEEL_EXTRACTION_INTERVAL_SECONDS", DEFAULT_EXTRACTION_INTERVAL_SECONDS)
    cleanup_interval = _read_int_env("PEEL_CLEANUP_INTERVAL_SECONDS", DEFAULT_CLEANUP_INTERVAL_SECONDS)
    reconciliation_interval = _read_int_env("PEEL_AUDIT_RECONCILIATION_INTERVAL_SECONDS", DEFAULT_RECONCILIATION_INTERVAL_SECONDS)

    now = datetime.utcnow()
    next_extraction = now if run_immediately else now + timedelta(seconds=extraction_interval)
    cleanup_on_start = os.getenv("PEEL_CLEANUP_RUN_ON_START", "false").lower() in {"1", "true", "yes"}
    next_cleanup = now if cleanup_on_start else now + timedelta(seconds=cleanup_interval)
    next_reconciliation = now if run_immediately else now + timedelta(seconds=reconciliation_interval)

    logger.info(
        "peel_scheduler_started prefix=%s extraction_interval=%s cleanup_interval=%s",
        prefix,
        extraction_interval,
        cleanup_interval,
    )

    while True:
        now = datetime.utcnow()
        if now >= next_extraction:
            _run_extraction(prefix)
            next_extraction = datetime.utcnow() + timedelta(seconds=extraction_interval)

        if now >= next_cleanup:
            _run_cleanup(prefix)
            next_cleanup = datetime.utcnow() + timedelta(seconds=cleanup_interval)

        if now >= next_reconciliation:
            _run_reconciliation()
            next_reconciliation = datetime.utcnow() + timedelta(seconds=reconciliation_interval)

        next_run = min(next_extraction, next_cleanup, next_reconciliation)
        sleep_seconds = max(5, min(60, int((next_run - datetime.utcnow()).total_seconds())))
        time.sleep(sleep_seconds)


def start_peel_scheduler(run_immediately: bool = True):
    global _scheduler_thread, _scheduler_started

    if os.getenv("PEEL_SCHEDULER_ENABLED", "true").lower() in {"0", "false", "no"}:
        logger.info("peel_scheduler_disabled")
        return None

    with _scheduler_lock:
        if _scheduler_started:
            return _scheduler_thread

        _scheduler_thread = threading.Thread(
            target=_scheduler_loop,
            args=(run_immediately,),
            daemon=True,
            name="peel-scheduler",
        )
        _scheduler_thread.start()
        _scheduler_started = True
        return _scheduler_thread
