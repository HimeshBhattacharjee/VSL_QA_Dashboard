import logging

progress_logger = logging.getLogger("qc.progress")


def log_progress(*values, sep: str = " ", **_kwargs) -> None:
    progress_logger.info(sep.join(str(value) for value in values))
