"""Turn raw MCP tool output into readable Markdown, and provider errors into clear messages.

MCP tools return content blocks such as [{'type': 'text', 'text': '{"cod": 401, ...}'}].
Agents and the UI should never show that raw shape.
"""

import json
import re
from typing import Any

WARNING = "⚠️"

SERVICE_NAMES = {
    "openweather": "OpenWeather",
    "tavily": "Tavily",
    "aviationstack": "AviationStack",
}


def to_text(result: Any) -> str:
    """Flatten MCP content blocks (or any value) into plain text."""
    if result is None:
        return ""
    if isinstance(result, str):
        return result
    if isinstance(result, (list, tuple)):
        parts = []
        for block in result:
            if isinstance(block, dict) and "text" in block:
                parts.append(str(block["text"]))
            elif hasattr(block, "text"):
                parts.append(str(block.text))
            else:
                parts.append(to_text(block))
        return "\n".join(p for p in parts if p)
    if isinstance(result, dict):
        return json.dumps(result, ensure_ascii=False)
    return str(result)


def parse_json(text: str) -> Any:
    try:
        return json.loads(text)
    except (TypeError, ValueError):
        return None


def is_warning(text: str) -> bool:
    return isinstance(text, str) and text.lstrip().startswith(WARNING)


def error_message(service: str, status: Any = None, detail: str = "") -> str:
    """A short, actionable explanation of a provider error."""
    name = SERVICE_NAMES.get(service, service)
    code = str(status or "")
    detail = (detail or "").strip().rstrip(".")
    if code in {"401", "403"} or re.search(r"invalid[ _]?(api[ _]?)?(access[ _]?)?key|unauthori[sz]ed|not supplied a valid", detail, re.I):
        head = f"{name} rejected your API key"
        hint = "Check the key under **API keys**, or clear it to use dummy data."
    elif code == "429" or re.search(r"rate limit|usage limit|quota", detail, re.I):
        head = f"{name} usage limit reached"
        hint = "Your plan's quota or rate limit was hit. Try again later or use another key."
    elif code == "404" or re.search(r"city not found|not found", detail, re.I):
        head = f"{name} couldn't find that location"
        hint = "Try a more specific city name."
    else:
        head = f"{name} returned an error"
        hint = "Live data for this part of the plan is unavailable right now."
    extra = f" ({code + ': ' if code else ''}{detail[:160]})" if detail else (f" ({code})" if code else "")
    return f"{WARNING} **{head}**{extra}. {hint}"


def detect_error(service: str, data: Any) -> str | None:
    """Return an error message if a parsed provider response is an error, else None."""
    if not isinstance(data, dict):
        return None
    if service == "openweather":
        cod = data.get("cod")
        if cod is not None and str(cod) != "200":
            return error_message(service, cod, str(data.get("message", "")))
    if service == "tavily":
        if data.get("error") or (data.get("status") and str(data.get("status")) != "200"):
            detail = data.get("detail")
            if isinstance(detail, dict):
                detail = detail.get("error") or json.dumps(detail)
            return error_message(service, data.get("status"), str(detail or data.get("error") or ""))
    if service == "aviationstack":
        if data.get("ok") is False or "error" in data:
            err = data.get("error")
            if isinstance(err, dict):
                err = err.get("message") or err.get("info") or json.dumps(err)
            return error_message(service, None, str(err or ""))
    return None


def _num(v: Any, unit: str = "") -> str:
    if isinstance(v, (int, float)):
        return f"{round(v, 1):g}{unit}"
    return f"{v}{unit}" if v not in (None, "") else "–"


def format_current_weather(data: dict) -> str:
    city = data.get("city", "")
    cond = str(data.get("condition", "")).capitalize()
    return (
        f"**{city}**: {_num(data.get('temperature_c'), '°C')} "
        f"(feels like {_num(data.get('feels_like_c'), '°C')}), {cond}\n\n"
        f"Humidity {_num(data.get('humidity'), '%')} · Wind {_num(data.get('wind_speed'), ' m/s')}"
    )


def format_forecast(data: dict) -> str:
    rows = data.get("forecast") or []
    if not rows:
        return "No forecast available."
    lines = ["| Time | Temp | Conditions |", "|---|---|---|"]
    for r in rows:
        when = str(r.get("datetime", ""))[5:16].replace("-", "/")  # MM/DD HH:MM
        lines.append(f"| {when} | {_num(r.get('temperature'), '°C')} | {str(r.get('weather', '')).capitalize()} |")
    return "\n".join(lines)


def format_search_results(data: Any, text: str, limit: int = 6) -> str:
    """Tavily results as a Markdown list. Handles JSON and Tavily's 'Title:/URL:/Content:' text."""
    results = []
    if isinstance(data, dict) and isinstance(data.get("results"), list):
        results = [
            {"title": r.get("title", ""), "url": r.get("url", ""), "content": r.get("content", "")}
            for r in data["results"]
            if isinstance(r, dict)
        ]
    elif "URL:" in text:
        for block in re.split(r"\n\s*\n(?=Title:)", text):
            title = re.search(r"Title:\s*(.+)", block)
            url = re.search(r"URL:\s*(\S+)", block)
            content = re.search(r"Content:\s*(.+)", block, re.S)
            if title or url:
                results.append({
                    "title": title.group(1).strip() if title else "",
                    "url": url.group(1).strip() if url else "",
                    "content": content.group(1).strip() if content else "",
                })
    if not results:
        return text.strip()

    lines = []
    answer = data.get("answer") if isinstance(data, dict) else None
    if answer:
        lines += [str(answer).strip(), ""]
    for r in results[:limit]:
        title = (r["title"] or r["url"] or "Result").replace("[", "(").replace("]", ")")
        snippet = re.sub(r"\s+", " ", r["content"]).strip()
        if len(snippet) > 220:
            snippet = snippet[:217].rsplit(" ", 1)[0] + "…"
        link = f"[{title}]({r['url']})" if r["url"] else f"**{title}**"
        lines.append(f"- {link}" + (f": {snippet}" if snippet else ""))
    return "\n".join(lines)


def normalize(service: str, tool: str, result: Any) -> str:
    """Raw MCP tool output → readable Markdown (or a clear error message)."""
    text = to_text(result)
    if is_warning(text):
        return text
    data = parse_json(text)
    err = detect_error(service, data)
    if err:
        return err
    if tool == "get_current_weather" and isinstance(data, dict):
        return format_current_weather(data)
    if tool == "get_forecast" and isinstance(data, dict):
        return format_forecast(data)
    if tool == "tavily_search":
        return format_search_results(data, text)
    return text
