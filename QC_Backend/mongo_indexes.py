import logging
from typing import Any, Iterable, Mapping, Sequence

from pymongo import ASCENDING
from pymongo.errors import PyMongoError

logger = logging.getLogger(__name__)

IndexKeys = str | Sequence[tuple[str, Any]]

INDEX_OPTION_KEYS = (
    "unique",
    "sparse",
    "expireAfterSeconds",
    "partialFilterExpression",
    "collation",
)


def normalize_index_keys(keys: IndexKeys) -> list[tuple[str, Any]]:
    if isinstance(keys, str):
        return [(keys, ASCENDING)]
    return [(field, direction) for field, direction in keys]


def default_index_name(keys: IndexKeys) -> str:
    parts: list[str] = []
    for field, direction in normalize_index_keys(keys):
        safe_field = field.replace(".", "_").replace(" ", "_")
        parts.extend([safe_field, str(direction)])
    return "_".join(parts)


def _index_option_mismatches(existing: Mapping[str, Any], requested: Mapping[str, Any]) -> dict[str, tuple[Any, Any]]:
    mismatches: dict[str, tuple[Any, Any]] = {}
    for option in INDEX_OPTION_KEYS:
        if option not in requested:
            continue
        existing_value = existing.get(option)
        requested_value = requested.get(option)
        values_differ = (
            bool(existing_value) != bool(requested_value)
            if isinstance(requested_value, bool)
            else existing_value != requested_value
        )
        if values_differ:
            mismatches[option] = (existing_value, requested_value)
    return mismatches


def find_equivalent_index(
    index_information: Mapping[str, Mapping[str, Any]],
    keys: IndexKeys,
    options: Mapping[str, Any] | None = None,
) -> tuple[str, Mapping[str, Any]] | None:
    desired_keys = normalize_index_keys(keys)
    requested_options = options or {}
    for index_name, index_info in index_information.items():
        if list(index_info.get("key", [])) != desired_keys:
            continue
        mismatches = _index_option_mismatches(index_info, requested_options)
        if mismatches:
            logger.warning(
                "mongo_index_equivalent_key_with_different_options existing_index=%s mismatches=%s",
                index_name,
                mismatches,
            )
        return index_name, index_info
    return None


def ensure_index(collection: Any, keys: IndexKeys, *, name: str | None = None, **options: Any) -> str | None:
    """Create an index only when no equivalent key pattern exists.

    MongoDB treats indexes with the same key pattern as equivalent even when the
    name differs. Calling create_index with a new name in that situation raises
    "Index already exists with a different name" warnings/errors on startup.
    """
    index_name = name or default_index_name(keys)
    try:
        existing = find_equivalent_index(collection.index_information(), keys, options)
        if existing:
            existing_name, _ = existing
            if existing_name != index_name:
                logger.debug(
                    "mongo_index_reused_existing_name collection=%s requested=%s existing=%s",
                    collection.name,
                    index_name,
                    existing_name,
                )
            return existing_name
        return collection.create_index(keys, name=index_name, **options)
    except PyMongoError:
        logger.exception("mongo_index_ensure_failed collection=%s index=%s", getattr(collection, "name", "unknown"), index_name)
        raise


async def ensure_index_async(collection: Any, keys: IndexKeys, *, name: str | None = None, **options: Any) -> str | None:
    index_name = name or default_index_name(keys)
    try:
        existing = find_equivalent_index(await collection.index_information(), keys, options)
        if existing:
            existing_name, _ = existing
            if existing_name != index_name:
                logger.debug(
                    "mongo_index_reused_existing_name collection=%s requested=%s existing=%s",
                    collection.name,
                    index_name,
                    existing_name,
                )
            return existing_name
        return await collection.create_index(keys, name=index_name, **options)
    except PyMongoError:
        logger.exception("mongo_index_ensure_failed collection=%s index=%s", getattr(collection, "name", "unknown"), index_name)
        raise


def ensure_indexes(collection: Any, definitions: Iterable[tuple[IndexKeys, dict[str, Any]]]) -> None:
    for keys, options in definitions:
        ensure_index(collection, keys, **options)


def drop_index_if_exists(collection: Any, index_name: str) -> bool:
    if index_name not in collection.index_information():
        return False
    collection.drop_index(index_name)
    return True
