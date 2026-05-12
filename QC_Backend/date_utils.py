from datetime import datetime, timedelta, timezone

IST_TIMEZONE = timezone(timedelta(hours=5, minutes=30))


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def serialize_datetime(value: datetime) -> str:
    return ensure_utc_datetime(value).isoformat()


def to_ist_date_key(value: datetime) -> str:
    return ensure_utc_datetime(value).astimezone(IST_TIMEZONE).date().isoformat()
