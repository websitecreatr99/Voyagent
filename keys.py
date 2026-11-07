"""Per-request API keys.

Keys come from the request (user-supplied in the UI) and fall back to the server's
environment unless MOCK_MODE is on. They live only in a ContextVar for the duration
of a request: they are never written to graph state, checkpoints or logs.

Each service runs live only when its key is available; otherwise it returns dummy data.
"""

import os
from contextvars import ContextVar
from dataclasses import dataclass, fields


def _mock_mode() -> bool:
    return os.getenv("MOCK_MODE", "").strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class ApiKeys:
    groq: str = ""
    tavily: str = ""
    aviationstack: str = ""
    openweather: str = ""

    def secrets(self) -> list[str]:
        return [getattr(self, f.name) for f in fields(self) if getattr(self, f.name)]


# Which key powers which part of the pipeline (as shown in the UI).
SERVICE_KEYS = {
    "llm": "groq",            # supervisor, budget, itinerary, final plan
    "flights": "aviationstack",
    "hotels": "tavily",
    "weather": "openweather",
}

_current: ContextVar[ApiKeys] = ContextVar("api_keys", default=ApiKeys())


def server_keys() -> ApiKeys:
    """Keys configured on the server. Ignored while MOCK_MODE is on."""
    if _mock_mode():
        return ApiKeys()
    return ApiKeys(
        groq=os.getenv("GROQ_API_KEY", "").strip(),
        tavily=os.getenv("TAVILY_API_KEY", "").strip(),
        aviationstack=os.getenv("AVIATION_STACK_API_KEY", "").strip(),
        openweather=os.getenv("OPENWEATHER_API_KEY", "").strip(),
    )


def resolve(user: dict | None) -> ApiKeys:
    """User-supplied keys win; missing ones fall back to the server's keys."""
    user = user or {}
    base = server_keys()
    return ApiKeys(**{
        f.name: (str(user.get(f.name) or "").strip() or getattr(base, f.name))
        for f in fields(ApiKeys)
    })


def modes(keys: ApiKeys) -> dict[str, str]:
    """'live' or 'mock' for each service, given a set of keys."""
    return {svc: ("live" if getattr(keys, k) else "mock") for svc, k in SERVICE_KEYS.items()}


def set_current(keys: ApiKeys):
    return _current.set(keys)


def reset_current(token) -> None:
    _current.reset(token)


def current() -> ApiKeys:
    return _current.get()


def redact(text: str, keys: ApiKeys | None = None) -> str:
    """Remove any key values from a message before it is logged or returned."""
    keys = keys or current()
    for secret in keys.secrets() + server_keys().secrets():
        if len(secret) >= 6:
            text = text.replace(secret, "***")
    return text
