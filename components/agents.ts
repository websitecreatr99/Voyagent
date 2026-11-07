import { BedDouble, Brain, CloudSun, Map, Plane, Sparkles, UserCheck, Wallet, type LucideIcon } from "lucide-react";
import type { NodeId, ServiceId, TravelState } from "@/lib/api";

export type NodeStatus = "pending" | "running" | "done" | "skipped" | "waiting";

export interface AgentMeta {
  id: NodeId;
  name: string;
  blurb: string;
  icon: LucideIcon;
  /** Tailwind gradient classes for the agent's accent */
  accent: string;
  /** Which state field holds this agent's output */
  field?: keyof TravelState;
  /** Which external service's key decides whether this agent's output is live or dummy data */
  service?: ServiceId;
}

export const AGENTS: AgentMeta[] = [
  { id: "supervisor", name: "Supervisor", blurb: "Guardrails & routing", icon: Brain, accent: "from-violet-400 to-indigo-500", service: "llm" },
  { id: "flight_agent", name: "Flights", blurb: "AviationStack MCP", icon: Plane, accent: "from-sky-400 to-cyan-500", field: "flight_results", service: "flights" },
  { id: "hotel_agent", name: "Hotels", blurb: "Tavily search", icon: BedDouble, accent: "from-pink-400 to-rose-500", field: "hotel_results", service: "hotels" },
  { id: "weather_agent", name: "Weather", blurb: "Weather MCP", icon: CloudSun, accent: "from-amber-300 to-orange-500", field: "weather_results", service: "weather" },
  { id: "budget_agent", name: "Budget", blurb: "Cost breakdown", icon: Wallet, accent: "from-emerald-400 to-teal-500", field: "budget_results", service: "llm" },
  { id: "itinerary_agent", name: "Itinerary", blurb: "Day-by-day draft", icon: Map, accent: "from-fuchsia-400 to-purple-500", field: "itinerary", service: "llm" },
  { id: "human_approval", name: "Your Review", blurb: "Human-in-the-loop", icon: UserCheck, accent: "from-yellow-300 to-amber-500" },
  { id: "final_response", name: "Final Plan", blurb: "Polished & ready", icon: Sparkles, accent: "from-orange-300 to-pink-500", service: "llm" },
];

export const SPECIALISTS: NodeId[] = ["flight_agent", "hotel_agent", "weather_agent", "budget_agent"];

export const agentById = (id: string) => AGENTS.find((a) => a.id === id);
