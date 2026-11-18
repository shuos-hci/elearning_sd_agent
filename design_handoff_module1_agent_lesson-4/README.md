# WASA-4 · Build Your First AI Agent — Module 1 (LO1)

A 13-page, ~15-minute self-paced interactive lesson for university students with no experience building AI agents. One learning objective: given descriptions of AI-supported tasks, learners distinguish a **single LLM call**, a **fixed workflow**, and an **AI agent** by asking **"Who determines what happens next?"** — *the user*, *predefined rules*, or *the model during execution*.

Core message (Page 13, verbatim): *"The goal is not a more agentic system. It's knowing when an agent is needed — so the agent you build is truly necessary."*

This repo contains the static lesson (Netlify), pre-generated narration, the Milo artwork, and an anonymous analytics backend + dashboard (Render).

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
   milo.jsx        Milo (layered 2D guide: poses, blink)
   narrator.jsx    narration player (MP3 files → Web Speech fallback)
   pages-a.jsx     Pages 1–4 (+ tap-to-match Matcher)
   pages-b.jsx     Pages 5–8 (+ QSeq)
   pages-c.jsx     Pages 9–13
   app.jsx         shell: header, toggles, staged reveal, Milo, onboarding, captions, nav, fit-to-viewport
   styles.css      all tokens and styles
/backend           FastAPI app: main.py, models.py, requirements.txt, render.yaml, Procfile, README.md, static/analytics.html
/audio             narration MP3s: scene<N>-seg<M>.mp3 (+ manifest.json with part timings)
/assets/milo       Milo layers: base.png, arm-left.png, arm-right.png (+ milo-original.png, the source drawing)
/tools/kokoro      standalone narration + art tooling (kokoro-js generator, extractor, installer, Milo cutter)
/backups           pre-change copies (audio-piper, old HTML, teacher art) — safe to delete once reviewed
netlify.toml       publishes /frontend and copies /audio + /assets/milo next to it at build time
.gitignore         keeps .env, *.db, exports out of git
```

## Run locally
**Frontend** (any static server; audio needs http, not file://):
```bash
mkdir -p frontend/assets && cp -r audio frontend/audio && cp -r assets/milo frontend/assets/milo
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

## Start screen (course cover)
The approved **ivory cover** (bg `#F3F0E8`): label, title **Build Your First AI Agent**, "Who decides what happens next?", Milo (left), three decorative cards, Sound + CC toggles. All text is real HTML; layout scales with `--u` (1 px of the 1672×941 reference). Flow:
1. **Cover loads → the welcome narration starts by itself** (scene 0, `audio/scene0-seg1.mp3`; Web Speech fallback if missing; silent timed text if Sound is off). Milo's mouth moves only while audio is audible; his gestures follow the narration parts.
2. While it plays only **"Skip intro"** (plain text) is shown. There is **no timed reveal**.
3. The two **course entry choices** appear only when the welcome **finishes naturally** or the learner clicks **"Skip intro"** (which stops the audio + mouth and stays on the cover — it does not enter the lesson). "Skip intro" then disappears; the welcome never replays and the lesson is never entered automatically.
   - **Start new** — first lesson page with fresh progress (answers/progress cleared).
   - **Continue** — restores the saved page and answers. Enabled only for a *valid* saved record with real progress (`hasSavedProgress`: a later page, any answer, a visited page — page 1 counts — or narration progress; corrupt/out-of-range records are ignored). Otherwise it stays visible but disabled with "No saved progress yet".
4. **If the browser blocks audible autoplay** the narrator reports `status: 'blocked'`: a **"Play welcome"** button is shown (one click plays the intro on the cover), nothing pretends to play, the mouth stays still, "Skip intro" still works (then the choices appear and Play welcome is hidden).
Opening narration (4 parts): "Hi, welcome to Build Your First AI Agent! I’m Milo, your learning guide. I’ll explain key ideas and guide you through the activities step by step. Are you ready? Let’s start our learning journey together!" The lesson no longer repeats a greeting (Page 2 starts at "In this course, you will begin…"; its title is revealed with that part via `data-hlr="coursemap"`).
`prefers-reduced-motion`: cover/Milo animations are off; the teaching cursor jumps to its target without travel or nudge.
## Page 2 onboarding (Fix 10)
First visit to Page 2 per session shows an overlay (max 3 steps, one line each with a mini illustration) + Milo **waving**: (1) "Listen to Milo — his cursor shows the part being explained." (2) "Answer by tapping an option — Next unlocks when you finish." (3) "Use the icons at the top right for sound and captions." **Skip** (top-right) and **Skip intro** (bottom) close it immediately; Page 2 narration starts after it closes. Stored in `sessionStorage` (`bya-m1-session.onboarded`).

## Learning modes (one implementation, shared content and progress)
A segmented selector **[Narration] [Caption Only]** sits at the top of the course menu (top bar) and on the opening cover. Default: Narration; the choice and the CC preference (default **on**) are remembered in `localStorage['bya-m1-prefs']`. Switching never reloads the page or resets progress.
- **Explanation paragraphs.** Each page's narration segments are grouped by meaning (`paras` on every page in `pages-*.jsx`: `{ s: [firstSeg, lastSeg], main: 'target-key' }`, 1–3 sentences each; feedback after Page 3 / Page 7 answers becomes its own paragraph, derived from page state). Both modes use the same boundaries and the same panel (21 px, left-aligned, whole paragraph at once, sized to the tallest paragraph of the page so nothing jumps) with **Back / Continue** and a "2 / 5" counter. These move between explanations only; page navigation and activity-completion rules are unchanged (Continue stops at the last paragraph; Next stays locked until the activity is done).
- **Narration.** Plays the current paragraph with the existing clips (`narrator.playRange`), then **stops and waits** for Continue (never auto-advances). Continue before the end stops the audio, reveals what the paragraph still owed, and plays the next one; Back plays the previous one again. Play/pause + replay in the panel; CC toggle in the top bar (off removes the caption area entirely, leaving a compact controls-only bar). Mouth, content reveals and the floating cursor follow the audio as before.
- **Caption Only.** A silent reading mode: `narrator.setEnabled(false)` stops and disables all audio, Web Speech and timers (no silent audio, no duration timers, UI click tones off); audio controls, Sound and CC are hidden; the paragraph text is always visible. Entering a paragraph reveals all content discussed in it (previous content stays, future content stays hidden with its space reserved); the cursor indicates the paragraph's main target and stays still; Milo's mouth is still.
- **Switching.** Narration → Caption Only: audio stops immediately, the full paragraph and its content are shown, waits for Continue. Caption Only → Narration: same paragraph and reveals, CC preference restored, nothing starts by itself — press Play to hear the paragraph from its beginning.
- **Cover.** Narration keeps the approved welcome playback / autoplay fallback / Skip intro / choices-after-welcome flow. Caption Only: no welcome audio, the full welcome text and "Start new" / "Continue" appear immediately. Switching modes on the cover never enters the lesson.
- **Saved progress** now also stores the current paragraph (`para`) and how far each page is revealed (`rev`). Mode and CC changes are recorded through the existing `button_click` events (`data-track` = `mode-narration`, `mode-caption`, `cc-toggle`, `para-back`, `para-continue`).

## Matching questions (Pages 4 and 7)
Page 3 also shows its system cards and reason chips in a different order on every visit. Answers are **dragged** onto the place they belong (pointer drag with a ghost and a highlighted drop target; tap-an-answer-then-tap-a-place and the keyboard still work). The tray order is shuffled on every visit so that no answer ever sits under its own slot (`derangedOrder` in `pages-a.jsx`) — never "first to first". A wrong drop shows the hint and the answer returns to the tray.

## Narration (Fix 11)
- Audio files: **`audio/scene<N>-seg<M>.mp3`** (N = 0 for the opening, 1–13 for pages; M = segment from 1) + `manifest.json` (`{ "scene4-seg1": { duration, parts: [startSeconds…], text } }`, used to sync Milo's gestures and pointing-free highlights). Voice: **Kokoro `af_heart`**, speed 0.95, pitch-shifted **+1.5 semitones** (tempo preserved), loudness-matched, 96 kbps mono MP3 — generated locally with `kokoro-js` (see `tools/kokoro/`; no paid API). 66 clips: opening, 55 lesson segments (incl. Page 3/7 feedback) and 10 Page 12 variants.
- **Page 12, segment 1** recalls the learner's Page 3 answer: pre-rendered for "no saved choice" and for each approach × preset reason (`scene12-seg1-<single|workflow|agent>-<0|1|2>`, `scene12-seg1-none`); a reason the learner typed themselves is spoken by the Web Speech fallback.
- **Pace:** clips are played at **`playbackRate` 1.08 with `preservesPitch`** (`PLAYBACK_RATE` in `narrator.jsx`) — no second speed-up at synthesis; manifest durations and part offsets are *media* time, and captions, reveals, gestures and the mouth follow `currentTime`. Pauses between segments and the silent-mode timers use the same `PACE`.
- **Fallback:** if a file 404s/errs/stalls (6 s), that segment is spoken by the Web Speech API (rate 0.97 ≈ 0.9 × 1.08). With sound off, segments advance on a timer so visuals still progress.
- Regenerate: `cd tools/kokoro && npm i && node extract-narration.mjs && node generate-narration.mjs && node install-narration.mjs` (`--only name1,name2` to redo a few clips). Original Piper audio: `backups/pre-kokoro/audio-piper/`.
- Controls (Narration mode): play/pause and replay act on the current explanation paragraph; Back / Continue move between paragraphs; tapping a narrated element plays the paragraph it belongs to.

## Milo, the learning guide (replaces the teacher)
- Art: the approved 2D Milo (`assets/milo/milo-original.png`), split by `tools/kokoro/cut-milo.mjs` into `base.png`, `arm-left.png`, `arm-right.png`. `frontend/milo.jsx` rotates the arms about the shoulders and draws blink / happy eyes and the **speaking mouth** in an SVG overlay (the original smile is covered by a visor-coloured patch; three flat mouths replace it: rest, small, wide).
- **Speaking:** `narrator` reports `speaking` (true only while audio is audible: `<audio>` events, or Web Speech `onstart/onend`); the mouth is driven by the loudness (AnalyserNode, when an AudioContext is allowed) or else by a short varied cycle gated by `speaking`. It returns to rest immediately on pause, mute, end, skip or navigation.
- **Activation (`cue`) = Milo's floating teaching cursor.** When the narration moves to a new target (`data-hl`, else `data-hlr`), the lesson shows a flat SVG arrow cursor (teal fill, navy outline, ivory inset, mustard dot, faint teal halo; 40 px) — an instructional overlay (`FloatingCursor` in `app.jsx`; `pointer-events: none`, `aria-hidden`, the system cursor is untouched). First target of a page: it fades in beside the target. Later targets: the *same* cursor glides directly to the next one (350–500 ms ease-in-out, one tween that re-targets from its current visible position if a target arrives mid-flight; it never returns to Milo), nudges 4 px toward the target on arrival, then stays still. It points at the *visible content* of the target (not its empty margin), picks the edge placement/rotation that covers the least text and stays clear of captions, navigation, the top bar and Milo, follows scrolling/resizing/layout changes, and is cleared on page changes. It hides while the learner answers (pointer or keyboard on an answer control, or typing) until the narration reaches a new target (e.g. explanatory feedback), never points at answer controls, and under reduced motion it jumps to the target without travel or nudge. Milo only makes a small arm gesture + brief teal signal near his hand when the target is in a *new area* of the page. There are no outlines, frames, brackets, trails or beams.
- Poses: cover `idle · wave · self · present · invite`; lesson `rest · explain · think · celebrate` (wave in the Page 2 onboarding). Placement: fixed bottom-left above the caption strip/footer, 148 px wide (132 px on question pages), 164 px left gutter on ≥1100 px.
## Staged reveal (Fix 13)
Every element mapped to a narration segment (`data-hl="key"`; `data-hlr="key"` for extra pieces that should appear with that key) is **hidden** (`opacity: 0; visibility: hidden`, `inert`) until its segment (or part) starts — no faint ghost or dashed placeholder box is shown for upcoming content. Its layout space stays reserved (no layout jump); it is not clickable or focusable while hidden. At its cue it fades in with a slight upward movement (0.55 s). Once reached, elements stay visible (furthest segment is persisted per page). Feedback segments appended later are never staged. The same applies to the other narration-driven placeholders (Page 1 frames `.sframe.is-hidden`, Page 2 unit map and goal `.p2-rv`, Page 9 setup blocks `.setup-block.is-dim`). Dashed outlines with instructional meaning (empty answer slots, the broken-chain gap, the agent boundary fence, "floating" possible actions) and learner-driven locks are unchanged.
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
- Milo: supplied 2D drawing (transparent PNG), split into layers by `tools/kokoro/cut-milo.mjs`.
- All other visuals are HTML/CSS/SVG. Fonts: Google Fonts (Atkinson Hyperlegible, Bricolage Grotesque, IBM Plex Mono). Chart.js 4.4.6 via CDN on the dashboard only.
