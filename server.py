"""FastAPI server exposing the multi-agent travel planner to the Next.js frontend.

Run:
    uvicorn server:api --reload --port 8000
"""

import contextvars
import json
import os
import uuid
from typing import Any, Iterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage
from langgraph.types import Command
from pydantic import BaseModel, Field

import keys
import mock
from graph import app as travel_graph

MOCK_MODE = mock.enabled()

# Fields of TravelState that are safe and useful to send to the client.
PUBLIC_FIELDS = [
    "user_query",
    "trip_constraints",
    "selected_agents",
    "supervisor_reasoning",
    "flight_results",
    "hotel_results",
    "weather_results",
    "budget_results",
    "itinerary",
    "approval_request",
    "human_feedback",
    "approved",
    "final_response",
    "llm_calls",
]

api = FastAPI(
    title="Multi-Agent Travel Planner API",
    version="1.0.0",
    description="LangGraph supervisor + specialist agents with human-in-the-loop approval.",
)

origins = [
    o.strip()
    for o in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,https://voyagent-lime.vercel.app",
    ).split(",")
    if o.strip()
]
api.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    # e.g. FRONTEND_ORIGIN_REGEX=https://my-app-.*\.vercel\.app for Vercel preview deployments
    # Default also allows this project's Vercel preview/deployment URLs.
    allow_origin_regex=os.getenv("FRONTEND_ORIGIN_REGEX", r"https://voyagent-[a-z0-9]+-kishan-18fd\.vercel\.app") or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Schemas ----------


class ApiKeysIn(BaseModel):
    """Optional user-supplied keys. Used only for this request; never stored."""

    groq: str = Field("", max_length=300)
    tavily: str = Field("", max_length=300)
    aviationstack: str = Field("", max_length=300)
    openweather: str = Field("", max_length=300)


class PlanRequest(BaseModel):
    query: str = Field(..., min_length=3, description="Natural-language travel request")
    user_id: str = Field("demo_user", description="User identifier")
    thread_id: str | None = Field(None, description="Existing thread to continue; a new one is created if omitted")
    api_keys: ApiKeysIn | None = Field(None, description="Optional API keys; services without a key return dummy data")


class ApprovalRequest(BaseModel):
    approved: bool
    feedback: str = ""
    api_keys: ApiKeysIn | None = None

    def resume_value(self) -> dict[str, Any]:
        # Only the decision goes into the graph: keys must never reach graph state/checkpoints.
        return {"approved": self.approved, "feedback": self.feedback}


class PlanResponse(BaseModel):
    thread_id: str
    status: str  # "awaiting_approval" | "completed" | "blocked"
    state: dict[str, Any]
    interrupt: dict[str, Any] | None = None
    # Per service: "live" (real API) or "mock" (dummy data). Keys: llm, flights, hotels, weather.
    modes: dict[str, str] | None = None


# ---------- Helpers ----------


def _config(thread_id: str) -> dict:
    return {"configurable": {"thread_id": thread_id}}


def _public(values: dict[str, Any]) -> dict[str, Any]:
    return {k: values[k] for k in PUBLIC_FIELDS if k in values}


def _initial_input(req: PlanRequest) -> dict[str, Any]:
    return {
        "messages": [HumanMessage(content=req.query)],
        "user_id": req.user_id,
        "user_query": req.query,
        "flight_results": "",
        "hotel_results": "",
        "weather_results": "",
        "budget_results": "",
        "itinerary": "",
        "final_response": "",
        "llm_calls": 0,
    }


# thread_id -> service modes of its latest run (no secrets; just "live"/"mock").
_thread_modes: dict[str, dict[str, str]] = {}


def _keys_for(api_keys: "ApiKeysIn | None") -> keys.ApiKeys:
    return keys.resolve(api_keys.model_dump() if api_keys else None)


def _snapshot(thread_id: str) -> PlanResponse:
    """Build a response from the checkpointed state of a thread."""
    snap = travel_graph.get_state(_config(thread_id))
    values = dict(snap.values or {})
    if not values:
        raise HTTPException(status_code=404, detail=f"Thread '{thread_id}' not found")

    interrupt_value = None
    for task in snap.tasks or ():
        for intr in getattr(task, "interrupts", ()) or ():
            interrupt_value = intr.value
            break

    if interrupt_value is not None:
        status = "awaiting_approval"
    elif values.get("final_response") and not values.get("selected_agents") and not values.get("itinerary"):
        status = "blocked"
    else:
        status = "completed"

    return PlanResponse(
        thread_id=thread_id,
        status=status,
        state=_public(values),
        interrupt=interrupt_value,
        modes=_thread_modes.get(thread_id),
    )


def _run_blocking(graph_input: Any, thread_id: str, api_keys: keys.ApiKeys) -> PlanResponse:
    _thread_modes[thread_id] = keys.modes(api_keys)
    token = keys.set_current(api_keys)
    try:
        travel_graph.invoke(graph_input, config=_config(thread_id))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=keys.redact(str(exc), api_keys)) from None
    finally:
        keys.reset_current(token)
    return _snapshot(thread_id)


def _sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


def _stream_graph(graph_input: Any, thread_id: str, api_keys: keys.ApiKeys) -> Iterator[str]:
    """Run the graph and emit one SSE event per completed node.

    Sync generator: Starlette iterates it in a threadpool, so the blocking
    LangGraph/LLM calls don't stall the event loop. Each next() may run in a
    different thread/context, so every step runs inside one pinned context that
    carries this request's API keys.
    """
    modes = keys.modes(api_keys)
    _thread_modes[thread_id] = modes
    yield _sse("start", {"thread_id": thread_id, "modes": modes})

    ctx = contextvars.copy_context()
    ctx.run(keys.set_current, api_keys)
    try:
        chunks = ctx.run(
            lambda: iter(travel_graph.stream(graph_input, config=_config(thread_id), stream_mode="updates"))
        )
        while True:
            try:
                chunk = ctx.run(next, chunks)
            except StopIteration:
                break
            for node, update in chunk.items():
                if node == "__interrupt__":
                    payload = update[0].value if update else {}
                    yield _sse("interrupt", {"node": "human_approval", "data": payload})
                else:
                    yield _sse("node", {"node": node, "data": _public(update or {})})
        yield _sse("done", _snapshot(thread_id).model_dump())
    except Exception as exc:  # surface errors to the UI instead of dropping the stream
        yield _sse("error", {"message": keys.redact(str(exc), api_keys)})


_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


# ---------- Routes ----------


@api.get("/api/health")
def health():
    """`modes`: what a request WITHOUT user keys gets. `server_keys`: which keys the server
    holds (booleans), so the UI can tell users which keys they still need to add."""
    server = keys.server_keys()
    return {
        "status": "ok",
        "mock_mode": MOCK_MODE,
        "modes": keys.modes(server if keys.is_complete(server) else keys.ApiKeys()),
        "server_keys": keys.availability(server),
    }


@api.get("/api/agents")
def agents():
    """Static description of the pipeline, used by the UI to render the agent graph."""
    return [
        {"id": "supervisor", "name": "Supervisor", "description": "Guardrails + routes the request to specialists"},
        {"id": "flight_agent", "name": "Flights", "description": "Searches live flights via AviationStack MCP"},
        {"id": "hotel_agent", "name": "Hotels", "description": "Finds stays via Tavily search"},
        {"id": "weather_agent", "name": "Weather", "description": "Forecast via Weather MCP"},
        {"id": "budget_agent", "name": "Budget", "description": "Estimates trip cost"},
        {"id": "itinerary_agent", "name": "Itinerary", "description": "Drafts the day-by-day plan"},
        {"id": "human_approval", "name": "Your Review", "description": "Human-in-the-loop approval"},
        {"id": "final_response", "name": "Final Plan", "description": "Polishes the approved plan"},
    ]


@api.post("/api/plan", response_model=PlanResponse)
def create_plan(req: PlanRequest):
    """Run the agents until the human-approval checkpoint (blocking)."""
    thread_id = req.thread_id or f"{req.user_id}_{uuid.uuid4().hex[:8]}"
    return _run_blocking(_initial_input(req), thread_id, _keys_for(req.api_keys))


@api.post("/api/plan/stream")
def create_plan_stream(req: PlanRequest):
    """Same as POST /api/plan but streams agent progress as Server-Sent Events."""
    thread_id = req.thread_id or f"{req.user_id}_{uuid.uuid4().hex[:8]}"
    return StreamingResponse(
        _stream_graph(_initial_input(req), thread_id, _keys_for(req.api_keys)),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@api.get("/api/plan/{thread_id}", response_model=PlanResponse)
def get_plan(thread_id: str):
    return _snapshot(thread_id)


@api.post("/api/plan/{thread_id}/approve", response_model=PlanResponse)
def approve_plan(thread_id: str, body: ApprovalRequest):
    """Resume a thread paused at human approval (blocking)."""
    current = _snapshot(thread_id)
    if current.status != "awaiting_approval":
        raise HTTPException(status_code=409, detail="Thread is not awaiting approval")
    return _run_blocking(Command(resume=body.resume_value()), thread_id, _keys_for(body.api_keys))


@api.post("/api/plan/{thread_id}/approve/stream")
def approve_plan_stream(thread_id: str, body: ApprovalRequest):
    current = _snapshot(thread_id)
    if current.status != "awaiting_approval":
        raise HTTPException(status_code=409, detail="Thread is not awaiting approval")
    return StreamingResponse(
        _stream_graph(Command(resume=body.resume_value()), thread_id, _keys_for(body.api_keys)),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )
