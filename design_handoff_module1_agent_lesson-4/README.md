# WASA-4 · Build Your First AI Agent — Module 1 (LO1)

A 13-page, ~15-minute self-paced interactive lesson for university students with no experience building AI agents. One learning objective: given descriptions of AI-supported tasks, learners distinguish a **single LLM call**, a **fixed workflow**, and an **AI agent** by asking **"Who determines what happens next?"** — *the user*, *predefined rules*, or *the model during execution*.

Core message (Page 13, verbatim): *"The goal is not a more agentic system. It's knowing when an agent is needed — so the agent you build is truly necessary."*

This repo contains the static lesson (Netlify), pre-generated narration, the teacher artwork, and an anonymous analytics backend + dashboard (Render).

## About these files (read first)
The frontend is a **high-fidelity working prototype** built in HTML + React 18 with in-browser Babel. It is the design reference *and* runs as-is on Netlify. For a production build, recreate it in your stack (recommended: **Vite + React + TypeScript**, static deploy): port the `.jsx` files nearly 1:1 (replace `window.*` globals with ES imports, precompile JSX) and keep every value documented below. All copy (narration, on-screen text, options, feedback) comes from the course specification and **must be used verbatim**.

**Fidelity:** high — final colours, type, spacing, iconography, diagrams, copy, interactions, and audio.

## Repo layout
```
/frontend          the 13-page lesson (index.html + JSX/CSS/JS)
   index.html      entry (loads config.js, analytics.js, React, then the JSX files)
   config.js       API_BASE_URL — the only place the backend URL is set
   analytics.js    anonymous tracking (batching, sendBeacon, offline queue)
   core.jsx        icons, decider/approach system, diagrams, Choice/Feedback, click FX
   narrator.jsx    narration player (MP3 files → Web Speech fallback)
   pages-a.jsx     Pages 1–4 (+ tap-to-match Matcher)
   pages-b.jsx     Pages 5–8 (+ QSeq)
   pages-c.jsx     Pages 9–13
   app.jsx         shell: header, toggles, staged reveal, teacher, onboarding, captions, nav, fit-to-viewport
   styles.css      all tokens and styles
/backend           FastAPI app: main.py, models.py, requirements.txt, render.yaml, Procfile, README.md, static/analytics.html
/audio             narration MP3s: scene<N>-seg<M>.mp3 (+ manifest.json with part timings)
/assets/teacher    teacher poses: wave.png, point.png, think.png, celebrate.png (transparent PNG)
netlify.toml       publishes /frontend and copies /audio + /assets/teacher next to it at build time
.gitignore         keeps .env, *.db, exports out of git
```

## Run locally
**Frontend** (any static server; audio needs http, not file://):
```bash
mkdir -p frontend/assets && cp -r audio frontend/audio && cp -r assets/teacher frontend/assets/teacher
cd frontend && python -m http.server 5500     # open http://localhost:5500
```
**Backend:** see `backend/README.md` (`uvicorn main:app --reload --port 8000`), then set `API_BASE_URL: 'http://localhost:8000'` in `frontend/config.js`. With `API_BASE_URL` empty the lesson works fully offline; events just queue in `localStorage`.

## Deploy
1. **Frontend → Netlify:** *Add new site → Import from Git*, pick the repo. Netlify reads `netlify.toml` (publish `frontend`, build command copies audio + teacher art). No other settings.
2. **Backend → Render:** follow `backend/README.md` (Blueprint from `backend/render.yaml`; set `ANALYTICS_PASSWORD` and `ALLOWED_ORIGINS` = your Netlify URL). ⚠️ Free tier disk is ephemeral — export Excel regularly or switch to free PostgreSQL (`DATABASE_URL`).
3. Put the Render URL into `frontend/config.js` → `API_BASE_URL`, commit; Netlify redeploys.
4. Dashboard (team only, not linked from the lesson): `https://<render-app>/analytics`.

## Publish on GitHub
```bash
git init && git add . && git commit -m "WASA-4 Module 1 lesson + analytics backend"
git branch -M main
git remote add origin https://github.com/<org>/<repo>.git
git push -u origin main
```
Before pushing, confirm no secrets are staged: `git status` must not list `.env`; `backend/.env.example` holds variable names only. Never commit `ANALYTICS_PASSWORD`.

---

# Design specification

## Global shell
- Full viewport (`100dvh`) grid: **header / stage / caption strip (only when CC on) / footer**. Header and footer are always visible; target viewports **1440×900** and **1280×800** with **no vertical scrolling** — page content auto-scales between 0.8 and 1 (`useFitToStage`) after flexible spacing and `clamp()` type.
- **Header:** brand (left) · phase progress **Hook → Learn → Compare → Practice → Reflect** (centre; current pill dark) · right cluster: narration progress ("2 of 5" + clickable dots), Play/Pause, Replay, divider, **Sound toggle** (speaker with waves / muted; turns ALL narration audio and click sounds on/off; persists for the session) and **CC toggle** (default **off**; persists for the session).
- **Footer (Fix 8):** 3-column grid `minmax(0,1fr) auto minmax(260px,1fr)`; left = "Page N of 13" + dots + lock hint; centre = **Back + Next grouped**; right ≥260px **empty** for the Netlify badge. Next is locked until the page's interaction is complete.
- **Captions:** when CC is on, a dark strip above the footer shows the current narration segment's text.

## Start screen (Fix 9)
Three one-line rows (The course / The scenario / You will), then **one** large centred **Start** button in the accent colour (`--focus: oklch(0.55 0.13 200)` ≈ `#0E8A93`, 68px tall, 26px Bricolage 700). Sound toggle top-right. No "continue without audio" option. If progress is saved, a small "Start from the beginning instead" text link appears.

## Page 2 onboarding (Fix 10)
First visit to Page 2 per session shows an overlay (max 3 steps, one line each with a mini illustration) + the teacher **waving**: (1) "Listen to the teacher — she points at what she is talking about." (2) "Answer by tapping an option — Next unlocks when you finish." (3) "Use the icons at the top right for sound and captions." **Skip** (top-right) and **Skip intro** (bottom) close it immediately; Page 2 narration starts after it closes. Stored in `sessionStorage` (`bya-m1-session.onboarded`).

## Narration (Fix 11)
- Audio files: **`audio/scene<N>-seg<M>.mp3`** (N = page 1–13, M = segment from 1). Generated with **Piper** (rhasspy/piper), voice **en_US-lessac-high**, `length_scale 1.1` (≈ rate 0.9), each sentence/clause synthesized separately and joined with pauses (220 ms between clauses, 290 ms between sentences, 240 ms between parts, 160 ms before emphasis phrases such as "who decides", "not simply"). 55 files + `manifest.json` (`{ "scene4-seg1": { duration, parts: [startSeconds…], text } }`) so the teacher can point at each *part* of a segment while one file plays.
- Segment model per page: `{ t, hl, key? }` or `{ parts: [{ t, hl }], key? }`; `dyn: true` = runtime text (Page 12 recalls the learner's Page 3 answer → always Web Speech).
- Feedback narration appended after answers continues numbering: Page 3 seg3–4, Page 7 seg7–8.
- **Fallback:** if a file 404s/errs/stalls (6 s), that segment is spoken by the Web Speech API (natural/neural en-US voice preferred, rate 0.9, same chunking). With sound off, segments advance on a timer so visuals still progress. Pages are never silent with sound on. To replace audio, drop new MP3s with the same names into `/audio` — no code change. No paid TTS, no API keys.
- Controls: play/pause, replay (from segment 1), dot = play that segment only, tap any narrated element = replay its segment.

## Teacher agent (Fix 12)
- Art: `assets/teacher/{wave,point,think,celebrate}.png`, transparent, same canvas size; cross-fade 0.35 s between poses (never a jump cut).
- Pose logic: **wave** during onboarding · **point** while narration plays (default) · **think** on question pages while the interaction is unfinished and narration is idle · **celebrate** for 2.2 s after any correct answer (`lesson:correct` event).
- Placement: fixed bottom-left, above footer/caption strip, width 118px (104px on question pages; 64–74px under 1100px). On ≥1100px the stage reserves a **128px left gutter** (`--tgut`) so she never covers content; if the current target sits near her zone she moves to the top-left corner.
- Pointing: a small hand (mustard cuff, warm skin, dark outline — same style) glides (0.55 s) to the **top-left corner of the target element, from outside**, so it never covers its text; for the footer Next button it points from above. If the hand cannot be placed (e.g. narrow screens), a **very subtle** 1.5px outline at ~28% opacity is used instead.

## Staged reveal (Fix 13)
The R1 highlight ring and pulsing dot are removed. Every element mapped to a narration segment (`data-hl="key"`; `data-hlr="key"` for extra pieces that should appear with that key) starts at **10% opacity, desaturated, non-interactive (`inert`)** and fades/slides in (0.55 s) when its segment (or part) starts. Once reached, elements stay visible (furthest segment is persisted per page). Feedback segments appended later are never staged.

## Page 6 — show, don't test (Fix 14)
No sorting and no questions. Order: scenario card (approved poster → large poster / social post / email banner; "Maya's poster design is approved. It needs to become three deliverables: …") → chain **Approved design → Resize → Check dimensions → Apply naming rules → Export** appearing step by step as each is named (current step glows in the rules colour, teacher points) → "defined in advance" tag + "The path is predefined." → logo-missing edge panel (broken chain, three unconnected possible actions, 💡 explanation) → Fixed Workflow summary. Next unlocks when narration reaches the last segment.

## Visual system (unchanged)
| Decider | Label | Icon | Main | Ink | Soft |
|---|---|---|---|---|---|
| User | The user | person | `oklch(0.52 0.15 252)` ≈ #2F64B8 | ≈ #1F4F98 | ≈ #E8EFFA |
| Rules | Predefined rules | checklist | `oklch(0.70 0.145 68)` ≈ #D6922A | ≈ #7D5418 | ≈ #FAEFD9 |
| Model | The model | 4-point spark | `oklch(0.53 0.21 322)` ≈ #A92E9C | ≈ #8A1E80 | ≈ #F8EAF5 |

Approach icons: single call = speech bubble · workflow = chain of boxes · agent = loop. Diagrams: **LineDiagram** (User → Model → Response, return arrow + USER badge in user colour), **ChainDiagram** (boxes + rules-colour arrows, "DEFINED IN ADVANCE" tag, AI-tool chips on steps, broken variant with "?" gap), **LoopMini** (dashed boundary, Goal pill, Observe/Decide/Act/Check with Decide in model colour). Icons: ⚠ only for errors; 💡 hints; ⓘ neutral; ✓ correct; ✗ "not quite".
Tokens: bg `#F3F0E8`, bg2 `#ECE8DE`, card `#FFF`, ink `#1C2130`, ink2 `#5A606E`, ink3 `#8A8F9A`, line `#E2DDD1`, line2 `#C8C2B4`; ok ≈ #2E8A5C; bad ≈ #C2482F. Type: Bricolage Grotesque (headings), Atkinson Hyperlegible (body, 17px/1.5), IBM Plex Mono (labels). Radii 6/8/12/14/18/22/999.

## Interaction contract (Fix 6, unchanged)
Clickable things look clickable (border + shadow, hover lift, pointer, small "TAP TO CHOOSE"-style labels); display-only content has no hover. Feedback is hidden until an option is chosen; each option shows its own exact feedback; learners can change answers; Next unlocks only when correct. Every click gives a pop animation, a soft 80 ms Web-Audio tone (muted with sound off) and `navigator.vibrate(10)` where supported. P4/P7 matching is tap-badge-then-tap-slot (no drag required).

## State & persistence
- `localStorage['bya-m1-v3'] = { idx, state, seen, maxSeg }` — progress and answers; Page 3's `saved` choice is shown and spoken on Page 12.
- `sessionStorage['bya-m1-session'] = { audio, cc, onboarded }`.
- Analytics: `localStorage['bya-analytics-sid']` (UUID), `bya-analytics-queue` (pending events), `bya-analytics-start`.

## Analytics (Part B)
`analytics.js` sends batches (`fetch` every few seconds or at 20 events; `navigator.sendBeacon` on page hide). Delegated document listeners record `click_anywhere` (x/y + nearest `[data-track]` id or element label; flagged interactive / non-interactive) and `button_click`; `change` on textareas records `input`. The app emits `session_start`, `scene_enter`/`scene_exit` (+seconds), `quiz_attempt`/`quiz_complete` (question ids such as `p4-match:agent`, `p10 …`, `p11-q3`, `p12-reflection`), `lesson_complete` (+ total seconds). Tracking is wrapped in try/catch and never blocks the lesson; when the backend is down events stay queued and retry with backoff. No keystrokes outside input fields; no personal data.
Dashboard and endpoints: see `backend/README.md`.

## Assets
- Narration MP3s: generated with Piper (MIT-licensed engine; voice en_US-lessac-high — check the voice model card for its dataset licence before commercial use).
- Teacher poses: supplied by the team; converted to transparent, consistently cropped PNGs.
- All other visuals are HTML/CSS/SVG. Fonts: Google Fonts (Atkinson Hyperlegible, Bricolage Grotesque, IBM Plex Mono). Chart.js 4.4.6 via CDN on the dashboard only.
