"""MCP tool access with per-request API keys.

Each service gets its own MCP client built from the keys of the current request
(see keys.py). When a service has no key, the call returns dummy data from mock.py
instead of contacting the real API.
"""

import os
import sys
from pathlib import Path

from langchain_mcp_adapters.client import MultiServerMCPClient

import keys
import mock
import tool_format

PROJECT_DIR = Path(__file__).resolve().parent

# By default the stdio MCP servers run with the same Python as this app
# (aviationstack-mcp is installed from requirements.txt). Override with env vars
# if you run them from a separate environment.
AVIATIONSTACK_MCP_PYTHON = os.getenv("AVIATIONSTACK_MCP_PYTHON", sys.executable)
WEATHER_MCP_PYTHON = os.getenv("WEATHER_MCP_PYTHON", sys.executable)
WEATHER_MCP_SCRIPT = os.getenv("WEATHER_MCP_SCRIPT", str(PROJECT_DIR / "weather_mcp_server.py"))


def _server_env(**extra: str) -> dict[str, str]:
    """Environment for a stdio MCP server: inherit ours, add the request's API key."""
    env = dict(os.environ)
    env.update(extra)
    return env


def _connection(service: str, key: str) -> dict:
    if service == "tavily":
        return {
            "transport": "streamable_http",
            "url": f"https://mcp.tavily.com/mcp/?tavilyApiKey={key}",
        }
    if service == "aviationstack":
        return {
            "transport": "stdio",
            "command": AVIATIONSTACK_MCP_PYTHON,
            "args": ["-m", "aviationstack_mcp", "mcp", "run"],
            "env": _server_env(AVIATION_STACK_API_KEY=key),
        }
    if service == "openweather":
        return {
            "transport": "stdio",
            "command": WEATHER_MCP_PYTHON,
            "args": [WEATHER_MCP_SCRIPT],
            "cwd": str(PROJECT_DIR),
            "env": _server_env(OPENWEATHER_API_KEY=key),
        }
    raise ValueError(f"Unknown MCP service: {service}")


# (service, key) -> loaded tools. Bounded so user-supplied keys don't pile up.
_tools_cache: dict[tuple[str, str], list] = {}
_MAX_CACHED = 64


async def _get_tools(service: str, key: str) -> list:
    cache_key = (service, key)
    if cache_key not in _tools_cache:
        client = MultiServerMCPClient({service: _connection(service, key)})
        try:
            tools = await client.get_tools()
        except Exception as e:
            # Never print raw exceptions: they can contain the key (e.g. in the Tavily URL).
            print(f"[mcp] failed to load {service} tools: {keys.redact(repr(e))}")
            raise RuntimeError(keys.redact(f"Could not connect to the {service} MCP server: {e}")) from None
        if len(_tools_cache) >= _MAX_CACHED:
            _tools_cache.pop(next(iter(_tools_cache)))
        _tools_cache[cache_key] = tools
    return _tools_cache[cache_key]


async def call_tool(service: str, tool_name: str, args: dict | None = None) -> str:
    """Call a live MCP tool and return readable Markdown.

    Provider errors (rejected key, rate limit, ...) come back as a short warning
    message instead of raw JSON, and never stop the plan.
    """
    key = getattr(keys.current(), service)
    try:
        tools = await _get_tools(service, key)
        tool = next((t for t in tools if t.name == tool_name), None)
        if tool is None:
            raise ValueError(f"Tool '{tool_name}' not found on {service} MCP server")
        raw = await tool.ainvoke(args or {})
    except Exception as e:
        msg = keys.redact(str(e))
        print(f"[mcp] {service}.{tool_name} failed: {type(e).__name__}: {msg}")
        return tool_format.error_message(service, None, msg)
    return keys.redact(tool_format.normalize(service, tool_name, raw))


def _has_key(service: str) -> bool:
    return bool(getattr(keys.current(), service))


# ------------------------
# Tools used by the agents
# ------------------------


async def tavily_search(query: str):
    if not _has_key("tavily"):
        return await mock.fake_tavily_search(query)
    return await call_tool("tavily", "tavily_search", {"query": query})


async def list_airports(search: str = "", limit: int = 10):
    if not _has_key("aviationstack"):
        return await mock.fake_tool(search)
    return await call_tool("aviationstack", "list_airports", {"search": search, "limit": limit, "offset": 0})


async def list_airlines(search: str = "", limit: int = 10):
    if not _has_key("aviationstack"):
        return await mock.fake_tool(search)
    return await call_tool("aviationstack", "list_airlines", {"search": search, "limit": limit, "offset": 0})


async def current_weather(city: str):
    if not _has_key("openweather"):
        return await mock.fake_weather(city)
    return await call_tool("openweather", "get_current_weather", {"city": city})


async def forecast(city: str):
    if not _has_key("openweather"):
        return await mock.fake_forecast(city)
    return await call_tool("openweather", "get_forecast", {"city": city})
