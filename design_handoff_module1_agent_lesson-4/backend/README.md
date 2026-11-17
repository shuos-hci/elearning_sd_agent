# Backend — learning analytics (FastAPI + SQLite)

Records how learners use the Module 1 lesson, stores it in SQL, and gives the team an Excel export and a password-protected dashboard. It is a **separate service** from the static frontend (the lesson stays on Netlify).

**Privacy:** each learner gets a random anonymous UUID created in their browser. No names, emails, or IP addresses are stored (the API never reads the client IP).

## Files
| File | Purpose |
|---|---|
| `main.py` | FastAPI app — endpoints, summary maths, Excel export |
| `models.py` | SQLAlchemy models: `sessions`, `events`; DB connection (`DATABASE_URL`) |
| `static/analytics.html` | Dashboard page (Chart.js via CDN, password gate) |
| `requirements.txt` | Pinned dependencies (Python 3.11+) |
| `render.yaml` | Render Blueprint (free tier) |
| `Procfile` | Start command for Procfile-based hosts |
| `.env.example` | Variable **names** only — never commit real values |

## Tables
- **sessions** — `session_id, started_at, ended_at, completed`
- **events** — `id, session_id, scene, event_type, target, value, x, y, attempt_no, correct, timestamp`

Event types: `session_start`, `lesson_complete` (value = total lesson seconds), `scene_enter`, `scene_exit` (value = seconds on scene), `button_click` (target = button id, value = label), `input` (target = field id, value = typed text — answer fields only), `click_anywhere` (x/y + target label; value = `interactive` | `non-interactive`), `quiz_attempt` (target = question id, attempt_no, correct, value = answer + seconds), `quiz_complete` (attempt_no = attempts needed, value = seconds on question).

## Endpoints
| Method | Path | Auth | What it does |
|---|---|---|---|
| POST | `/api/events` | none | Accepts a JSON array of events (also `text/plain` from `sendBeacon`). Always returns 200; invalid events are skipped, never crash. |
| GET | `/api/summary` | password | JSON with the dashboard numbers + written trend notes |
| GET | `/api/export.xlsx` | password | Workbook with sheets `summary`, `sessions`, `events` |
| GET | `/analytics` | password gate in page | The dashboard (not linked from any student page; `noindex`) |
| GET | `/healthz` | none | Health check |

Password = environment variable `ANALYTICS_PASSWORD`, sent as header `X-Analytics-Password` (the dashboard does this for you). If the variable is not set, the protected endpoints return 503.

## Run locally
```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
export ANALYTICS_PASSWORD='choose-a-local-password'    # Windows PowerShell: $env:ANALYTICS_PASSWORD='...'
export ALLOWED_ORIGINS='http://localhost:5500'
uvicorn main:app --reload --port 8000
```
Open http://localhost:8000/analytics and enter the password.
To send events from the lesson, serve the frontend (see the repo README) and set `API_BASE_URL: 'http://localhost:8000'` in `frontend/config.js`.

## Deploy on Render (free tier) — step by step
1. Push the repo to GitHub (see repo README).
2. In Render: **New + → Blueprint**, pick the repo. Render reads `backend/render.yaml` (root dir `backend`).
   *Alternative:* **New + → Web Service**, Root Directory `backend`, Build `pip install -r requirements.txt`, Start `uvicorn main:app --host 0.0.0.0 --port $PORT`.
3. In the service's **Environment** tab set:
   - `ANALYTICS_PASSWORD` — a strong password the team shares privately (never put it in the repo).
   - `ALLOWED_ORIGINS` — your Netlify URL, e.g. `https://wasa4-module1.netlify.app` (comma-separate several; add `http://localhost:5500` for local testing).
4. Deploy. Your backend URL looks like `https://wasa4-analytics.onrender.com`. Check `https://…/healthz`.
5. Put that URL in `frontend/config.js` → `API_BASE_URL`, commit, and Netlify redeploys the lesson.
6. Dashboard: `https://…onrender.com/analytics`.

> **Important — Render free tier has an ephemeral disk.** The default SQLite file (`analytics.db`) is **lost on every redeploy or restart**. Either:
> - **Export the Excel file regularly** (dashboard → *Export Excel*) — e.g. after every class session; or
> - **Switch to Render's free PostgreSQL:** create a PostgreSQL instance (New + → PostgreSQL, plan Free), copy its *Internal Database URL*, and set it as `DATABASE_URL` on the web service (or uncomment the `databases:` / `DATABASE_URL` blocks in `render.yaml`). No code change is needed — `models.py` reads `DATABASE_URL` and `psycopg2-binary` is already in `requirements.txt`. Note that Render's free PostgreSQL databases also expire after a limited period; export before then.
>
> The free web service also sleeps after inactivity; the first request may take ~30 s. The lesson keeps working meanwhile because events are queued in the browser and retried.

## Changing the password
Change `ANALYTICS_PASSWORD` in the Render Environment tab and redeploy. Anyone with the old password is logged out on their next refresh.
