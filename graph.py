import psycopg
from psycopg.rows import dict_row
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import END, START, StateGraph

from agents import (
    budget_agent,
    final_response_agent,
    flight_agent,
    hotel_agent,
    human_approval_agent,
    itinerary_agent,
    supervisor_agent,
    weather_agent,
)
from config import DATABASE_URL
from state import TravelState

AGENT_ORDER = [
    "flight_agent",
    "hotel_agent",
    "weather_agent",
    "budget_agent",
    "itinerary_agent",
]

ROUTE_MAP = {
    "flight_agent": "flight_agent",
    "hotel_agent": "hotel_agent",
    "weather_agent": "weather_agent",
    "budget_agent": "budget_agent",
    "itinerary_agent": "itinerary_agent",
}

SUPERVISOR_ROUTE_MAP = {**ROUTE_MAP, "end": END}


def _selected_agents(state: TravelState) -> list[str]:
    selected = state.get("selected_agents")
    return [agent for agent in AGENT_ORDER if agent in (selected or [])]


def route_from_supervisor(state: TravelState) -> str:
    selected = _selected_agents(state)
    if not selected and state.get("final_response"):
        # Guardrail blocked the request; nothing to plan.
        return "end"
    return selected[0] if selected else "itinerary_agent"



def route_after_agent(current_agent: str):
    def route(state: TravelState) -> str:
        selected = _selected_agents(state)
        current_index = AGENT_ORDER.index(current_agent)

        for next_agent in AGENT_ORDER[current_index + 1:]:
            if next_agent in selected:
                return next_agent

        return "itinerary_agent"

    return route




def build_graph():
    graph = StateGraph(TravelState)

    graph.add_node("supervisor", supervisor_agent)
    graph.add_node("flight_agent", flight_agent)
    graph.add_node("hotel_agent", hotel_agent)
    graph.add_node("weather_agent", weather_agent)
    graph.add_node("budget_agent", budget_agent)
    graph.add_node("itinerary_agent", itinerary_agent)
    graph.add_node("human_approval", human_approval_agent)
    graph.add_node("final_response", final_response_agent)

    graph.add_edge(START, "supervisor")
    graph.add_conditional_edges("supervisor", route_from_supervisor, SUPERVISOR_ROUTE_MAP)
    graph.add_conditional_edges("flight_agent", route_after_agent("flight_agent"), ROUTE_MAP)
    graph.add_conditional_edges("hotel_agent", route_after_agent("hotel_agent"), ROUTE_MAP)
    graph.add_conditional_edges("weather_agent", route_after_agent("weather_agent"), ROUTE_MAP)
    graph.add_conditional_edges("budget_agent", route_after_agent("budget_agent"), ROUTE_MAP)
    graph.add_edge("itinerary_agent", "human_approval")
    graph.add_edge("human_approval", "final_response")
    graph.add_edge("final_response", END)

    return graph.compile(checkpointer=_build_checkpointer())


def _build_checkpointer():
    """Postgres checkpointer when DATABASE_URL is reachable, otherwise in-memory.

    interrupt() (human approval) requires a checkpointer either way.
    """
    if DATABASE_URL:
        try:
            # Settings required by PostgresSaver (setup() runs CREATE INDEX CONCURRENTLY
            # and the saver reads rows as dicts).
            conn = psycopg.connect(
                DATABASE_URL,
                autocommit=True,
                prepare_threshold=0,
                row_factory=dict_row,
                connect_timeout=5,
            )
            checkpointer = PostgresSaver(conn)
            checkpointer.setup()
            print("[graph] Using PostgreSQL checkpointer")
            return checkpointer
        except Exception as exc:
            print(f"[graph] PostgreSQL unavailable ({type(exc).__name__}); using in-memory checkpointer")

    return MemorySaver()


app = build_graph()


