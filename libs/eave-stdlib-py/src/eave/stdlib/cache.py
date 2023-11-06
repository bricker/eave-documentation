import abc
import time
from typing import Optional, Protocol
import redis.asyncio as redis
from redis.asyncio.retry import Retry
from redis.backoff import ConstantBackoff
from .config import shared_config
from .logging import eaveLogger


class CacheInterface(Protocol):
    @abc.abstractmethod
    async def get(self, name: str) -> str | None:
        ...

    @abc.abstractmethod
    async def set(self, name: str, value: str, ex: Optional[int] = None) -> bool | None:
        ...

    @abc.abstractmethod
    async def delete(self, *names: str) -> int:
        ...

    @abc.abstractmethod
    async def close(self, close_connection_pool: Optional[bool] = None) -> None:
        ...

    @abc.abstractmethod
    async def ping(self) -> bool:
        ...


class _CacheEntry:
    value: str
    ts: float
    ex: Optional[int] = None

    def __init__(self, value: str, ex: Optional[int] = None) -> None:
        self.value = value
        self.ex = ex
        self.ts = time.time()

    @property
    def expired(self) -> bool:
        return self.ex is not None and (self.ts + self.ex < time.time())


class EphemeralCache(CacheInterface):
    _store: dict[str, _CacheEntry] = {}

    async def get(self, name: str) -> str | None:
        e = self._store.get(name)
        if e is None:
            return None
        elif e.expired:
            await self.delete(name)
            return None
        else:
            return e.value

    async def set(self, name: str, value: str, ex: Optional[int] = None) -> bool | None:
        # quick way to put a hard limit on the size of this cache.
        # This class is only for development so there's no need for anything more complex than this.
        if len(self._store.keys()) > 100:
            self._store.clear()

        self._store[name] = _CacheEntry(value=value, ex=ex)
        return True

    async def delete(self, *names: str) -> int:
        num = 0
        for k in names:
            try:
                self._store.pop(k)
                num += 1
            except KeyError:
                pass

        return num

    async def close(self, close_connection_pool: Optional[bool] = None) -> None:
        return None

    async def ping(self) -> bool:
        return True


_PROCESS_CACHE_CLIENT: Optional[CacheInterface] = None


def client() -> CacheInterface | None:
    global _PROCESS_CACHE_CLIENT

    if not _PROCESS_CACHE_CLIENT:
        if redis_cfg := shared_config.redis_connection:
            host, port, db = redis_cfg
            auth = shared_config.redis_auth
            redis_tls_ca = shared_config.redis_tls_ca

            logauth = auth[:4] if auth else "(none)"
            eaveLogger.debug(f"Redis connection: host={host}, port={port}, db={db}, auth={logauth}...")

            try:
                _PROCESS_CACHE_CLIENT = redis.Redis(
                    host=host,
                    port=port,
                    db=db,
                    password=auth,
                    decode_responses=True,
                    ssl=redis_tls_ca is not None,
                    ssl_ca_data=redis_tls_ca,
                    health_check_interval=60 * 5,
                    socket_keepalive=True,
                    retry=Retry(retries=2, backoff=ConstantBackoff(backoff=3)),
                )
            except Exception as e:
                eaveLogger.exception(e)

        else:
            _PROCESS_CACHE_CLIENT = EphemeralCache()

    return _PROCESS_CACHE_CLIENT


def client_or_exception() -> CacheInterface:
    cache_client = client()
    assert cache_client is not None, "cache client unexpectedly None"
    return cache_client


def initialized_client() -> Optional[CacheInterface]:
    """
    Before closing a connection, check this property.
    Otherwise, if a connection wasn't previously established, you'd have to create a connection just to immediately close it.
    Because the client() function lazily creates a connection.
    """
    return _PROCESS_CACHE_CLIENT
