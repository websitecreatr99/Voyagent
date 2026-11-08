# Voyagent — Frontend

Next.js (App Router) + Tailwind CSS UI for the multi-agent travel planner. It talks to the FastAPI server on the `backend` branch.

## Features

- Animated aurora hero with one-click example prompts
- Live agent pipeline: each agent's status streams in over Server-Sent Events
- Supervisor plan with the parsed trip constraints and the agents it selected
- Result cards for flights, hotels, weather and budget, with skeleton loaders
- Human-in-the-loop review: approve the draft, or send feedback for a revision
- Final plan with copy and Markdown download
- Guardrail-blocked, error and API-offline states
- **Bring your own API keys (optional):** the **API keys** button opens a dialog for Groq, AviationStack, Tavily and OpenWeather keys. It's all-or-nothing: with all 4 keys the plan runs live; with fewer, the whole plan uses dummy data and the UI lists the missing keys. Keys are sent only with your requests, never stored on the server, and kept in the browser only for the session unless you tick "Remember on this device".
- **Dummy-data labelling:** a banner (with "x of 4 keys added" and the missing keys) and per-card badges show when results are sample data, and link to the keys dialog
- **GitHub button** in the header and footer (`NEXT_PUBLIC_GITHUB_URL` overrides the link)

## Run

Requires Node.js 18.17 or newer (Next.js 14).

```bash
cd frontend
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL if the API isn't on http://localhost:8000
npm install
npm run dev                  # http://localhost:3000
```

Start the backend in another terminal (on the `backend` branch):

```bash
uvicorn server:api --reload --port 8000
```

## Structure

```
app/          layout, global styles, main page (state machine for plan → review → final)
components/   AgentPipeline, PromptBox, ResultCard, ApprovalPanel, FinalPlan, Markdown, Background
lib/api.ts    typed API client + SSE stream parser
```

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

In **Render → Environment**:

1. Add `GROQ_API_KEY`, `TAVILY_API_KEY`, `AVIATION_STACK_API_KEY` and `OPENWEATHER_API_KEY`.
2. Set `MOCK_MODE=false`.
3. *(Optional)* Persist plans across restarts: create a **Render PostgreSQL** database and set `DATABASE_URL` to its *Internal Database URL*. Tables are created automatically on startup.
4. Save. Render redeploys. The frontend needs no changes.

The AviationStack and Weather MCP servers run inside the backend service (installed from `requirements.txt`). Tavily uses its hosted MCP endpoint. No separate servers are needed.

## Environment variable reference

**Backend (Render / `voyagent-backend/.env`)**

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `MOCK_MODE` | no | `false` | `true` = canned responses, no keys needed |
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
| `NEXT_PUBLIC_GITHUB_URL` | no | Target of the GitHub button. Defaults to this project's repository. |

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
