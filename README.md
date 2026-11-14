# Build a Multi-Agent Travel Planning System using LangGraph + MCP | Supervisor Agent + Guardrails + Human-in-the-Loop


This project extends the Multi-Agent Travel Planning System built by integrating Supervisor Agent + Guardrails + Human-in-the-Loop

---

# Requirements

## APIs

- Groq API: https://console.groq.com
- Tavily API: https://www.tavily.com/
- AviationStack API: https://aviationstack.com/
- OpenWeatherMap API: https://openweathermap.org/

## Tools

- PostgreSQL: https://www.postgresql.org/download/
- Tavily MCP Server: https://docs.tavily.com/documentation/mcp

---

# Step 1: Create Python Environment


    python -m venv langgraph_env3


Activate:


    langgraph_env3\Scripts\activate


---

# Step 2: Install Dependencies


    pip install langgraph langchain langchain-openai langchain-groq langchain-community langchain-tavily psycopg[binary] psycopg_pool python-dotenv tavily-python requests streamlit



    pip install -U "psycopg[binary,pool]" langgraph-checkpoint-postgres


---

# Step 3: Install PostgreSQL

Download PostgreSQL:

https://www.postgresql.org/download/

**Important:** Note your PostgreSQL password and port number during installation.

---

# Step 4: Create Database


    CREATE DATABASE langgraph_memory_demo;


---

# Step 5: Setup .env File

Create a `.env` file:

    GROQ_API_KEY=your_groq_api_key

    TAVILY_API_KEY=your_tavily_api_key

    AVIATIONSTACK_API_KEY=your_aviationstack_api_key

    DATABASE_URL=postgresql://postgres:postgres@localhost:5433/langgraph_memory_demo


---

# Step 6: Get API Keys

- Groq: https://console.groq.com
- Tavily: https://tavily.com
- AviationStack: https://aviationstack.com
- OpenWeatherMap: https://openweathermap.org/

---

# Setup AviationStack MCP Server (Local MCP Server)

Repository:

https://github.com/Pradumnasaraf/aviationstack-mcp

Open PowerShell:

    E:

    cd E:\Multi_agent_system_with_MCP


Clone repository:


    git clone https://github.com/Pradumnasaraf/aviationstack-mcp.git

    cd aviationstack-mcp


## Install UV

Check:

    uv --version


Install:

    pip install uv


If installation fails:

    powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"


## Create .env File

    AVIATION_STACK_API_KEY=your_api_key_here


## Install Dependencies

    uv sync


This will:

- Create `.venv`
- Install dependencies
- Install AviationStack MCP package

## Activate Environment

    .venv\Scripts\activate


## Start MCP Server

    uv run -m aviationstack_mcp mcp run


or


    python -m aviationstack_mcp mcp run


The server will remain running and wait for MCP requests.

## Stop Server

    CTRL + C


---

# Setup Weather MCP Server

Get API key:

https://openweathermap.org/

Add the API key to your `.env` file.

Install dependencies:

    pip install mcp requests


---

# Run the Application

## Streamlit Web App
Run:

    streamlit run frontend.py


---

# Example Prompt

    Plan a complete 7 days Japan trip including flights, hotels and sightseeing under 2 lakhs.


---

# Features

- Multi-Agent Architecture using LangGraph
- PostgreSQL Memory
- Tavily Search Integration
- AviationStack MCP Integration
- Weather MCP Integration
- Streamlit Web App
- Real-Time Travel Planning
- Human in the loop
- Guardrails


---

# FastAPI Backend (for the Next.js frontend)

`server.py` exposes the LangGraph planner over HTTP. The Next.js UI lives on the `frontend` branch.

Install and run (Python 3.13+, required by `aviationstack-mcp`):

    uv venv --python 3.13 .venv
    .venv\Scripts\activate
    uv pip install -r requirements.txt
    uvicorn server:api --reload --port 8000

The AviationStack and Weather MCP servers are started automatically over stdio using the
same Python environment, so no separate `aviationstack-mcp` clone is needed. To run them from
another environment, set `AVIATIONSTACK_MCP_PYTHON`, `WEATHER_MCP_PYTHON` or `WEATHER_MCP_SCRIPT`.

Interactive docs: http://localhost:8000/docs

Allowed browser origins are set with `FRONTEND_ORIGINS` (comma-separated, default `http://localhost:3000`).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET  | `/api/health` | Health check |
| GET  | `/api/agents` | Agent pipeline metadata |
| POST | `/api/plan` | Run agents up to the human-approval step. Body: `{"query": "...", "user_id": "demo_user", "thread_id": null}` |
| POST | `/api/plan/stream` | Same as above, streamed as Server-Sent Events (`start`, `node`, `interrupt`, `done`, `error`) |
| GET  | `/api/plan/{thread_id}` | Current state of a thread |
| POST | `/api/plan/{thread_id}/approve` | Resume after review. Body: `{"approved": true, "feedback": ""}` |
| POST | `/api/plan/{thread_id}/approve/stream` | Same as above, streamed as SSE |

`status` in responses is one of `awaiting_approval`, `completed`, or `blocked` (rejected by the input guardrail).

Without `DATABASE_URL`, threads are kept in memory and are lost when the server restarts.

## API keys, dummy data and mock mode

The planner needs **all four keys** to run live. It's all-or-nothing: if any key is missing,
**every** service returns dummy data, so a plan never mixes real and sample results.

| Service | Key | Dummy data used |
|---|---|---|
| LLM (supervisor, budget, itinerary, final plan) | Groq | Canned text |
| Flights | AviationStack | Canned airport/airline data |
| Hotels | Tavily | Canned hotel areas |
| Weather | OpenWeather | Canned forecast |

Keys come from two places:

1. **The request.** Users can paste their own keys in the UI (**API keys** button). They are sent
   as `api_keys` in `POST /api/plan[/stream]` and `/approve[/stream]`, used only for that request,
   and never written to graph state, checkpoints or logs. They are also scrubbed from error messages.
2. **The server's environment** (`GROQ_API_KEY`, ...). These fill in any keys the user didn't supply,
   unless `MOCK_MODE=true`. In that case the server ignores its own keys and only user-supplied keys count.

User keys and server keys are combined. The plan goes live only if the combined set has all four.

**Invalid keys never stop a plan.** If a live call fails (rejected key, rate limit, network error),
the run switches to dummy data from that point and still completes through all 8 agents. The stream
sends a `fallback` event (`{"service", "message"}`, e.g. *"Groq rejected the API key (401: Invalid API Key)"*),
and the rest of that plan, including the final step after approval, stays on dummy data. Each `node`
event carries `dummy: true|false`, and responses include `fallback` and `dummy_nodes`, so the UI labels
exactly which agents used dummy data. In dummy mode, the supervisor runs every specialist agent.

`GET /api/health` returns `modes` (what a request without user keys gets) and `server_keys`
(which keys the server holds, as booleans only, never the values). Every plan response and the
stream's `start` event also include `modes` (`live` or `mock` per service), so the UI can label dummy data.

## Deploy to Render

`render.yaml` describes the service (branch `backend`, Python 3.13, `MOCK_MODE=true`).
After deploying, set in the Render dashboard:

- `FRONTEND_ORIGINS` — your Vercel URL, e.g. `https://voyagent.vercel.app`
- `GROQ_API_KEY`, `TAVILY_API_KEY`, `AVIATION_STACK_API_KEY`, `OPENWEATHER_API_KEY`
- then `MOCK_MODE=false`

Without `DATABASE_URL`, plans are kept in memory and are lost when the free instance sleeps or restarts.

---

# Clone, Run and Deploy (End-to-End Guide)

This guide takes you from a fresh clone to a working deployment: the **FastAPI backend on Render** and the **Next.js frontend on Vercel**, connected to each other. You can do everything with **mock mode** first, then add real API keys.

## How the repository is organised

| Branch | Contents |
|---|---|
| `main` | Project landing page (this README) |
| `backend` | FastAPI + LangGraph multi-agent API (`server.py`, `agents.py`, `graph.py`, `mock.py`, `render.yaml`) |
| `frontend` | Next.js 14 + Tailwind UI (`app/`, `components/`, `lib/api.ts`, `vercel.json`) |

```
Browser ──► Vercel (Next.js UI) ──HTTPS + Server-Sent Events──► Render (FastAPI)
                                                                  ├─ Groq LLM
                                                                  ├─ Tavily MCP (hosted)
                                                                  ├─ AviationStack MCP (runs inside the service)
                                                                  └─ Weather MCP (runs inside the service)
```

## 1. Prerequisites

**Tools**

| Tool | Version | Check |
|---|---|---|
| Git | any recent | `git --version` |
| Python | **3.13+** (required by `aviationstack-mcp`) | `python --version` |
| [uv](https://docs.astral.sh/uv/) (recommended) | any recent | `uv --version` |
| Node.js | **18.17+** (20 or 24 LTS recommended) | `node -v` |

**Accounts** (all have free tiers): [GitHub](https://github.com), [Render](https://render.com), [Vercel](https://vercel.com).

**API keys.** You don't need these for mock mode; you need them for real results.

| Variable | Get it from |
|---|---|
| `GROQ_API_KEY` | https://console.groq.com/keys |
| `TAVILY_API_KEY` | https://app.tavily.com |
| `AVIATION_STACK_API_KEY` | https://aviationstack.com/dashboard |
| `OPENWEATHER_API_KEY` | https://home.openweathermap.org/api_keys |
| `DATABASE_URL` *(optional)* | Any PostgreSQL. Without it, plans are kept in memory. |

## 2. Clone the code

The backend and frontend live on separate branches, so clone each one into its own folder:

```bash
git clone -b backend  https://github.com/kishannextq/hackathon2.git voyagent-backend
git clone -b frontend https://github.com/kishannextq/hackathon2.git voyagent-frontend
```

> The repository is private. Ask the owner for access, or use your own copy (see step 4).

## 3. Run locally (optional, recommended)

### Backend

```bash
cd voyagent-backend
uv venv --python 3.13 .venv
# Windows:      .venv\Scripts\activate
# macOS/Linux:  source .venv/bin/activate
uv pip install -r requirements.txt
```

Create a `.env` file in `voyagent-backend/`. Never commit it.

```env
# Mock mode: full flow with canned responses, no keys needed
MOCK_MODE=true

# Real mode: set MOCK_MODE=false and fill these in
GROQ_API_KEY=
TAVILY_API_KEY=
AVIATION_STACK_API_KEY=
OPENWEATHER_API_KEY=
# DATABASE_URL=postgresql://user:password@localhost:5432/langgraph_memory_demo
```

Start it:

```bash
uvicorn server:api --reload --port 8000
```

Check http://localhost:8000/api/health. It should return `{"status":"ok","mock_mode":true}`. Interactive API docs are at http://localhost:8000/docs.

### Frontend

In a second terminal:

```bash
cd voyagent-frontend
cp .env.example .env.local        # Windows PowerShell: copy .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000. The header should show **API online**. Pick an example prompt, watch the agents work, then approve or request changes.

## 4. Put the code in your own GitHub repository

Render deploys from GitHub. Vercel can deploy from GitHub or straight from your machine. If you are deploying from your own copy:

1. Create an empty repository on GitHub (private is fine), for example `your-user/voyagent`.
2. Push both branches to it:

```bash
cd voyagent-backend
git remote set-url origin https://github.com/<your-user>/voyagent.git
git push -u origin backend

cd ../voyagent-frontend
git remote set-url origin https://github.com/<your-user>/voyagent.git
git push -u origin frontend
```

## 5. Deploy the backend to Render

### Option A: Blueprint (uses `render.yaml`)

1. In the Render Dashboard, choose **New → Blueprint**.
2. Connect your GitHub account if asked, and give Render access to the repository.
3. Select the repository and the **`backend`** branch. Render reads `render.yaml`.
4. Render asks for the values marked `sync: false`. Leave the API keys empty for now (mock mode is on). Leave `FRONTEND_ORIGINS` empty too; you set it in step 7.
5. Click **Apply** and wait for the deploy to show **Live**. The first build takes about 3–5 minutes.

### Option B: Manual web service

**New → Web Service**, connect the repository, then use:

| Setting | Value |
|---|---|
| Branch | `backend` |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn server:api --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/api/health` |
| Instance Type | Free (or any) |
| Environment variables | `PYTHON_VERSION=3.13.5`, `MOCK_MODE=true` |

### Check it

```bash
curl https://<your-service>.onrender.com/api/health
# {"status":"ok","mock_mode":true}
```

Copy this URL. The frontend needs it in the next step.

## 6. Deploy the frontend to Vercel

> `NEXT_PUBLIC_API_URL` is built into the frontend at **build time**. Whenever you change it, redeploy.

### Option A: Vercel Dashboard (Git-connected, redeploys on every push)

1. **Add New → Project**, then import your repository.
2. Framework Preset: **Next.js** (`vercel.json` also sets this). Root Directory: `./`.
3. Under **Environment Variables**, add `NEXT_PUBLIC_API_URL` = `https://<your-service>.onrender.com` (no trailing slash).
4. Click **Deploy**. The first build may fail, because Vercel builds the default branch (`main`), which has no app.
5. Go to **Settings → Git → Production Branch**, set it to **`frontend`**, then **Deployments → Redeploy**. You can also set the Production Branch to `frontend` before the first deploy.

### Option B: Vercel CLI (deploys from your machine)

```bash
cd voyagent-frontend
npx vercel login
npx vercel link --yes --project voyagent        # creates or links the project
npx vercel env add NEXT_PUBLIC_API_URL production
#   when prompted, paste: https://<your-service>.onrender.com
npx vercel deploy --prod
```

The output lists the production domain, for example `https://voyagent-xxxx.vercel.app`. `.vercelignore` keeps `.env` files out of the upload.

> **Deployment Protection:** the production domain is public, but the per-deployment URLs (`voyagent-<hash>-<team>.vercel.app`) may require a Vercel login. Share the production domain.

## 7. Connect the two (CORS)

The backend only accepts browser requests from origins it knows. In **Render → your service → Environment**, add:

| Variable | Value |
|---|---|
| `FRONTEND_ORIGINS` | `https://<your-vercel-domain>` (comma-separate several; no trailing slash) |
| `FRONTEND_ORIGIN_REGEX` *(optional)* | e.g. `https://voyagent-.*-<your-team>\.vercel\.app` to also allow preview deployments |

Save. Render redeploys automatically. To check it:

```bash
curl -s -o /dev/null -D - -X OPTIONS https://<your-service>.onrender.com/api/plan/stream \
  -H "Origin: https://<your-vercel-domain>" -H "Access-Control-Request-Method: POST" \
  | grep -i access-control-allow-origin
```

## 8. Test the whole flow

1. Open your Vercel URL. The header should show **API online**. On the free Render plan, the first request after a sleep can take 30–60 seconds.
2. Click an example prompt, then **Plan my trip**.
3. Watch the agent tiles: Supervisor, Flights / Hotels / Weather / Budget, Itinerary.
4. At **Review the draft itinerary**, click **Approve & finalize** to see the final plan, or **Request changes** with feedback for a revised plan.
5. Try `write me a poem`. The guardrail should block it.

In mock mode, every response ends with *"Mock mode: generated without calling an LLM."*

## 9. Switch to real AI responses

**Option A: per user, no server change.** Click **API keys** in the app header, paste **all four**
keys, and plan a trip. With fewer than four, the whole plan uses dummy data, and the UI shows which keys are missing.

**Option B: server-wide keys,** used for everyone who doesn't bring their own. In **Render → Environment**:

1. Add `GROQ_API_KEY`, `TAVILY_API_KEY`, `AVIATION_STACK_API_KEY` and `OPENWEATHER_API_KEY`.
2. Set `MOCK_MODE=false`.
3. *(Optional)* Persist plans across restarts: create a **Render PostgreSQL** database and set `DATABASE_URL` to its *Internal Database URL*. Tables are created automatically on startup.
4. Save. Render redeploys. The frontend needs no changes.

The AviationStack and Weather MCP servers run inside the backend service (installed from `requirements.txt`). Tavily uses its hosted MCP endpoint. No separate servers are needed.

## Environment variable reference

**Backend (Render / `voyagent-backend/.env`)**

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `MOCK_MODE` | no | `false` | `true` = ignore the server's own keys; only keys users paste in the UI go live, everything else is dummy data |
| `MOCK_DELAY` | no | `1.2` | Seconds each mocked call waits (makes the live progress visible) |
| `GROQ_API_KEY` | real mode | — | LLM |
| `GROQ_MODEL` | no | `llama-3.3-70b-versatile` | Groq model name |
| `TAVILY_API_KEY` | real mode | — | Hotel search |
| `AVIATION_STACK_API_KEY` | real mode | — | Flight data |
| `OPENWEATHER_API_KEY` | real mode | — | Weather |
| `DATABASE_URL` | no | — | PostgreSQL for persistent plans (otherwise in-memory) |
| `FRONTEND_ORIGINS` | deployed | localhost + project defaults | Allowed CORS origins, comma-separated |
| `FRONTEND_ORIGIN_REGEX` | no | project default | Regex of extra allowed origins |
| `PYTHON_VERSION` | Render | — | `3.13.5` |

**Frontend (Vercel / `voyagent-frontend/.env.local`)**

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes | Backend URL, e.g. `https://<your-service>.onrender.com`. Read at build time. |

## Troubleshooting

| Symptom | Fix |
|---|---|
| Header shows **API offline** | The backend may be asleep (free plan): open `/api/health` and wait. Otherwise check `NEXT_PUBLIC_API_URL` and **redeploy** the frontend, and check that `FRONTEND_ORIGINS` contains your exact Vercel domain. |
| Browser console shows a CORS error | Add the exact origin (scheme + host, no trailing slash) to `FRONTEND_ORIGINS` on Render. |
| Render deploy ends with **Timed Out** | Health Check Path must be exactly `/api/health`. If you set it from Git Bash on Windows, Git Bash may rewrite the path: prefix the command with `MSYS_NO_PATHCONV=1` or set it in the dashboard. |
| Render build fails on `aviationstack-mcp` | Python is older than 3.13. Set `PYTHON_VERSION=3.13.5`. |
| Vercel: *No Output Directory named "public"* | The framework preset isn't Next.js, or Vercel is building `main`. Keep `vercel.json`, and set Production Branch to `frontend`. |
| Plan fails with `401 Invalid API Key` | A key is wrong or missing. Fix it on Render, or set `MOCK_MODE=true`. |
| Plans disappear after a while | Free instances sleep and memory is cleared. Add `DATABASE_URL`. |
| `npm run dev` fails locally | Node is older than 18.17. Upgrade Node. |
| Buttons do nothing / page never becomes interactive | You're running an old Next.js build. Pull the latest `frontend` branch (Next 14) and reinstall. |
