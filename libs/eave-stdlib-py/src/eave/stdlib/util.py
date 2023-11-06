import base64
import contextlib
import hashlib
from functools import wraps
import json
from typing import Any, Awaitable, Callable, Optional, ParamSpec, Type, TypeVar
import uuid

from eave.stdlib.typing import JsonObject

from eave.stdlib.exceptions import UnexpectedMissingValue

T = TypeVar("T")
P = ParamSpec("P")


def sync_memoized(f: Callable[..., T]) -> Callable[..., T]:
    @wraps(f)
    def wrapper(self: Any, *args: Any, **kwargs: Any) -> T:
        if not hasattr(self, "__memo__"):
            # FIXME: This is not threadsafe
            self.__memo__ = dict[str, Any]()

        memokey = f.__name__
        if memokey in self.__memo__:
            memoval: T = self.__memo__[memokey]
            return memoval

        value: T = f(self, *args, **kwargs)
        self.__memo__[memokey] = value
        return value

    return wrapper


def memoized(f: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
    @wraps(f)
    async def wrapper(self: Any, *args: Any, **kwargs: Any) -> T:
        if hasattr(self, "__memo__") is False:
            # FIXME: This is not threadsafe
            self.__memo__ = dict[str, Any]()

        memokey = f.__name__
        if memokey in self.__memo__:
            memoval: T = self.__memo__[memokey]
            return memoval

        value: T = await f(self, *args, **kwargs)
        self.__memo__[memokey] = value
        return value

    return wrapper


def sha256hexdigest(data: str | bytes) -> str:
    """
    sha256-hash the data (utf-8 string or bytes), and return a hex string
    """
    return hashlib.sha256(ensure_bytes(data)).hexdigest()


def b64encode(data: str | bytes, urlsafe: bool = False) -> str:
    """
    base64-encode the data (utf-8 string or bytes) and return an ASCII string
    """
    b = ensure_bytes(data)
    if urlsafe:
        return base64.urlsafe_b64encode(b).decode()
    else:
        return base64.b64encode(b).decode()


def b64decode(data: str | bytes, urlsafe: bool = False) -> str:
    """
    base64-decode the data (ASCII string or bytes) and return a utf8 string.
    Note that this function only works if you know that the encoded data will decode into a utf-8 string.
    If you are dealing with non-utf8 data, use `base64.b64decode` directly.
    """
    b = ensure_bytes(data)
    if urlsafe:
        return base64.urlsafe_b64decode(b).decode()
    else:
        return base64.b64decode(b).decode()


def ensure_bytes(data: str | bytes | dict) -> bytes:
    """
    Use to reconcile some data into bytes.
    """
    if isinstance(data, dict):
        bytes = json.dumps(data).encode()
    elif isinstance(data, str):
        bytes = data.encode()
    else:
        bytes = data

    return bytes


def ensure_uuid(data: str | bytes | int | uuid.UUID | None) -> uuid.UUID:
    if isinstance(data, uuid.UUID):
        return data
    elif isinstance(data, bytes):
        return uuid.UUID(bytes=data)
    elif isinstance(data, int):
        return uuid.UUID(int=data)
    elif isinstance(data, str):
        return uuid.UUID(hex=data)
    else:
        raise TypeError(type(data))


def ensure_uuid_or_none(data: str | bytes | int | uuid.UUID | None) -> uuid.UUID | None:
    if data is None:
        return None
    else:
        return ensure_uuid(data)


def ensure_str_or_none(data: str | bytes | int | uuid.UUID | None) -> str | None:
    if data is None:
        return None
    else:
        return str(data)


def ensure_str(data: str | bytes | int | uuid.UUID | dict) -> str:
    if isinstance(data, str):
        return data
    elif isinstance(data, dict):
        return json.dumps(data)
    else:
        return str(data)


def compact_deterministic_json(data: dict) -> str:
    return json.dumps(data, indent=None, separators=(",", ":"), sort_keys=True)


def pretty_deterministic_json(data: dict) -> str:
    return json.dumps(data, sort_keys=True)


def nand(a: Any, b: Any) -> bool:
    """Neither or one"""
    return not (bool(a) and bool(b))


def nor(a: Any, b: Any) -> bool:
    """Exactly neither"""
    return not (bool(a) or bool(b))


def xor(a: Any, b: Any) -> bool:
    """Exactly one"""
    return bool(a) ^ bool(b)


def xnor(a: Any, b: Any) -> bool:
    """Neither or both"""
    return not xor(a, b)


def unwrap(value: Optional[T], default: Optional[T] = None) -> T:
    """
    Unwraps an Optional object to its wrapped type.
    You should use this method when you expect the wrapped type not to be None.
    If the object is not None, returns the unwrapped object.
    If the object is None and no default given, raises UnexpectedMissingValue
    If the object is None and a default is given, logs a warning and returns the default.
    This is meant to be used when you know the object isn't None. It's a short-hand for the following verbose pattern:

        if (foo := result.get("foo")) is None:
            raise UnexpectedMissingValue()

        do_something(foo)

    or, using this function:

        foo = unwrap(result.get("foo"))
        do_something(foo)

    You can optionally specify a default value, which does two things if given:
    1. Logs a warning that the default value was used
    1. Returns the default value instead of raising
    This is the "safe" version of this operation, where you want to know that an unexpected None was encountered,
    but carry on with the program. For example:

        if (foo := result.get("foo")) is None:
            eaveLogger.warning("foo is None")
            foo = "default foo"

        do_something(foo)

    or, using this function:

        foo = unwrap(result.get("foo"), "default foo")
        do_something(foo)

    This is different from other default-value mechanisms because it automatically logs a warning.
    """
    if value is None:
        if default is None:
            raise UnexpectedMissingValue("force-unwrapped a None value")
        else:
            return default
    else:
        return value


def redact(string: str | None) -> str | None:
    if string is None:
        return None

    strlen = len(string)
    if strlen <= 8:
        return f"[redacted {strlen} chars]"
    return f"{string[:4]}[redacted {strlen - 8} chars]{string[-4:]}"


def erasetype(data: JsonObject, key: str, default: Optional[Any] = None) -> Any:
    if v := data.get(key, default):
        return v
    else:
        return None


T = TypeVar("T")


def suppress(e: Type[Exception], func: Callable[[], T]) -> T | None:
    """
    Proxy to contextlib.suppress(), but with the ability to do it on a single line
    """
    with contextlib.suppress(e):
        return func()
