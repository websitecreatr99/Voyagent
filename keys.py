"""Per-request API keys.

Keys come from the request (user-supplied in the UI) and fall back to the server's
environment unless MOCK_MODE is on. They live only in a ContextVar for the duration
of a request: they are never written to graph state, checkpoints or logs.

All-or-nothing: the plan runs live only when ALL four keys are available (user-supplied
and server keys combined). If any key is missing, every service returns dummy data.
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


def is_complete(keys: ApiKeys) -> bool:
    return all(getattr(keys, f.name) for f in fields(ApiKeys))


def resolve(user: dict | None) -> ApiKeys:
    """Combine user-supplied keys with the server's keys (user keys win).

    All-or-nothing: unless all four keys are available, return no keys at all,
    so every service uses dummy data instead of mixing live and dummy results.
    """
    user = user or {}
    base = server_keys()
    merged = ApiKeys(**{
        f.name: (str(user.get(f.name) or "").strip() or getattr(base, f.name))
        for f in fields(ApiKeys)
    })
    return merged if is_complete(merged) else ApiKeys()


def availability(keys: ApiKeys) -> dict[str, bool]:
    """Which services have a key (before the all-or-nothing rule). Booleans only, never values."""
    return {svc: bool(getattr(keys, k)) for svc, k in SERVICE_KEYS.items()}


def modes(keys: ApiKeys) -> dict[str, str]:
    """'live' or 'mock' for each service, given a set of keys."""
    return {svc: ("live" if getattr(keys, k) else "mock") for svc, k in SERVICE_KEYS.items()}


class RunState:
    """Mutable per-run state, shared by every agent of one request (same object in all copied contexts).

    - fallback: set when a live call fails (rejected key, rate limit, network). From then on
      every service returns dummy data so the plan still completes through all agents.
    - used_dummy: whether the agent currently running used any dummy data (read and reset
      by the server after each agent, so each result can be labelled accurately).
    """

    def __init__(self):
        self.fallback: dict | None = None
        self.used_dummy = False


_run: ContextVar["RunState | None"] = ContextVar("run_state", default=None)


def start_run() -> RunState:
    state = RunState()
    _run.set(state)
    return state


def run_state() -> RunState:
    state = _run.get()
    if state is None:  # e.g. a direct tool call outside a request
        state = start_run()
    return state


def is_live(field: str) -> bool:
    """True if this run should call the real service for this key (key present and no fallback yet)."""
    return bool(getattr(current(), field)) and run_state().fallback is None


def use_dummy() -> None:
    run_state().used_dummy = True


def trigger_fallback(service: str, message: str) -> None:
    """Switch the rest of this run to dummy data after a live failure (first failure wins)."""
    state = run_state()
    if state.fallback is None:
        state.fallback = {"service": service, "message": message}
    state.used_dummy = True


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
