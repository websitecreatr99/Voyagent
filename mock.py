"""Dummy data used when a service has no API key.

The real LangGraph graph, routing, guardrail branch, human-in-the-loop interrupt
and API all run unchanged; only the leaf calls (LLM text generation and MCP tools)
return canned data. Which services use this is decided per request (see keys.py);
MOCK_MODE=true makes the server ignore its own keys so only user-supplied keys go live.
"""

import json
import os
import re
import time

TRUTHY = {"1", "true", "yes", "on"}

KNOWN_DESTINATIONS = [
    "Tokyo", "Kyoto", "Osaka", "Japan", "Bali", "Goa", "Paris", "London", "Dubai", "Singapore",
    "Bangkok", "Thailand", "Switzerland", "Italy", "Rome", "New York", "Maldives", "Kerala",
    "Manali", "Ladakh", "Vietnam", "Sydney", "Istanbul", "Barcelona",
]
OFF_TOPIC = re.compile(r"\b(poem|essay|code|hack|homework|joke|recipe|password)\b", re.I)


def enabled() -> bool:
    return os.getenv("MOCK_MODE", "").strip().lower() in TRUTHY


def _delay():
    time.sleep(float(os.getenv("MOCK_DELAY", "1.2")))


def _destination(text: str) -> str:
    for place in KNOWN_DESTINATIONS:
        if re.search(rf"\b{re.escape(place)}\b", text, re.I):
            return place
    return "Tokyo"


def _days(text: str) -> int:
    m = re.search(r"(\d+)\s*-?\s*(?:day|night)", text, re.I)
    return max(2, min(int(m.group(1)), 10)) if m else 5


def _request(prompt: str) -> str:
    m = re.search(r"(?:User request|Original user request):\s*\n(.+?)(?:\n\n|\Z)", prompt, re.S)
    return m.group(1).strip() if m else prompt


def fake_llm_text(system: str, prompt: str) -> str:
    _delay()
    s = system.lower()
    req = _request(prompt)
    dest = _destination(req)
    days = _days(req)

    if "guardrail" in s:
        blocked = bool(OFF_TOPIC.search(req))
        return json.dumps({
            "allowed": not blocked,
            "reason": "This request is not about travel planning, so the agents won't handle it." if blocked else "",
        })

    if "route work" in s:
        wants_weather = bool(re.search(r"weather|season|pack|monsoon|rain|snow|december|june|winter|summer", req, re.I))
        agents = ["flight_agent", "hotel_agent"] + (["weather_agent"] if wants_weather else []) + ["budget_agent", "itinerary_agent"]
        budget = re.search(r"(?:under|within|budget of)\s+([^,.;]+)", req, re.I)
        return json.dumps({
            "selected_agents": agents,
            "trip_constraints": {
                "destination": dest,
                "origin": (re.search(r"from\s+([A-Z][a-zA-Z]+)", req) or [None, "Delhi"])[1],
                "duration": f"{days} days",
                "budget": budget.group(1).strip() if budget else "flexible",
                "travel_style": "budget" if re.search(r"budget|cheap|affordable", req, re.I) else "mid-range",
                "special_preferences": [],
            },
            "reasoning": (
                f"This is a {days}-day trip to {dest}. Flights and stays are core to the plan, "
                + ("weather matters for the travel dates, " if wants_weather else "")
                + "and a budget check keeps the plan realistic before the itinerary is drafted."
            ),
        })

    if "flight" in s:
        return (
            f"### Recommended flights to {dest}\n"
            "| Option | Route | Duration | Fare (return) |\n|---|---|---|---|\n"
            "| Best value | DEL → hub → destination (1 stop) | ~11h | ₹38,000 – ₹48,000 |\n"
            "| Fastest | Direct flight | ~7–8h | ₹55,000 – ₹68,000 |\n\n"
            "**Booking tips**\n- Book 6–8 weeks ahead for the best fares.\n"
            "- Tuesday/Wednesday departures are usually cheapest.\n"
            "- Avoid red-eyes if you want to use day 1."
        )

    if "budget" in s:
        return (
            "| Category | Estimate |\n|---|---|\n"
            f"| Flights | ₹45,000 |\n| Stay ({days} nights) | ₹{days * 4500:,} |\n"
            f"| Food | ₹{days * 2500:,} |\n| Local transport | ₹{days * 1200:,} |\n| Activities | ₹{days * 1800:,} |\n\n"
            "**Verdict:** Feasible. Biggest risk is last-minute flight prices — lock those in first.\n\n"
            "**Save more:** stay near a transit hub, use day passes, and have lunch at local set-meal spots."
        )

    if "itinerary" in s:
        ideas = [
            "Arrive, check in, evening walk through the old town",
            "Top landmarks in the morning, food market in the evening",
            "Day trip to a nearby scenic spot",
            "Museums and neighbourhood café hopping",
            "Local experience: cooking class or guided tour",
            "Shopping street and sunset viewpoint",
            "Slow morning, souvenir shopping, depart",
        ]
        lines = [f"# Draft itinerary — {days} days in {dest}\n"]
        for d in range(days):
            lines.append(f"## Day {d + 1}\n{ideas[min(d, len(ideas) - 1) if d < days - 1 else -1]}.\n")
        lines.append("> *Dummy data: add a Groq API key to get a real AI-generated plan.*")
        return "\n".join(lines)

    if "final" in s:
        if "human approved" in prompt.lower():
            head = "Your plan is approved and ready to book."
        else:
            fb = re.search(r"Human feedback:\s*\n(.+?)(?:\n\n|\Z)", prompt, re.S)
            head = f"Revised with your feedback: *{fb.group(1).strip() if fb else 'changes applied'}*."
        return (
            f"# Your {days}-day {dest} trip\n\n{head}\n\n"
            "## At a glance\n- **Flights:** 1-stop best-value option, book 6–8 weeks ahead\n"
            "- **Stay:** central budget hotel near transit\n- **Budget:** within your limit with ~10% buffer\n\n"
            "## Checklist\n- [ ] Book flights\n- [ ] Reserve hotel\n- [ ] Get travel insurance\n- [ ] Download offline maps\n\n"
            "> *Dummy data: add a Groq API key to get a real AI-generated plan.*"
        )

    return "Dummy response."


async def fake_tavily_search(query: str):
    _delay()
    dest = _destination(query)
    return (
        f"### Where to stay in {dest}\n"
        "- **Central district** — best for first-timers, walkable, ₹4,000–6,000/night\n"
        "- **Near the main station** — great transit links, ₹3,500–5,000/night\n"
        "- **Quiet residential area** — local feel, cheaper, ₹2,800–4,000/night\n\n"
        "*Dummy data: add a Tavily API key for real hotel search.*"
    )


async def fake_tool(*args, **kwargs):
    _delay()
    return {"mock": True, "query": [str(a) for a in args]}


async def fake_weather(city: str):
    _delay()
    return f"{city}: 14°C, clear skies, light breeze (dummy data)"


async def fake_forecast(city: str):
    _delay()
    return f"{city} next 5 days: 12–17°C, mostly sunny, one day of light rain (dummy data)"
