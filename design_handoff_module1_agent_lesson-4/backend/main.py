"""WASA-4 Module 1 — learning analytics backend.

Endpoints
  POST /api/events        batch of events (JSON array). Always 200; bad events are skipped.
  GET  /api/summary       dashboard numbers (JSON)            — password required
  GET  /api/export.xlsx   Excel workbook: summary_A/B, sessions_A/B, events_A/B  — password required
  GET  /analytics         dashboard page (password gate in the page)
  GET  /healthz           health check

Password: env ANALYTICS_PASSWORD, sent as header `X-Analytics-Password` (or ?key= for the download link).
No personal data is stored: only the random session UUID created in the learner's browser.
"""
import hmac
import io
import os
import statistics
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from models import Event, Session, SessionLocal, init_db

ANALYTICS_PASSWORD = os.getenv("ANALYTICS_PASSWORD", "")
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
MAX_BATCH = 500
EVENT_TYPES = {
    "session_start", "lesson_complete", "scene_enter", "scene_exit", "button_click",
    "input", "click_anywhere", "quiz_attempt", "quiz_complete",
}
SCENE_NAMES = {
    1: "Hook", 2: "Orientation", 3: "Initial choice", 4: "Central distinction", 5: "Single LLM call",
    6: "Fixed workflow", 7: "When agency helps", 8: "AI agent", 9: "Compare", 10: "Practice 1",
    11: "Practice 2", 12: "Return", 13: "Summary",
}

app = FastAPI(title="WASA-4 Module 1 analytics", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Analytics-Password"],
)
STATIC = Path(__file__).parent / "static"


@app.on_event("startup")
def _startup():
    init_db()


def db():
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


def require_password(x_analytics_password: Optional[str] = Header(None), key: Optional[str] = Query(None)):
    supplied = x_analytics_password or key or ""
    if not ANALYTICS_PASSWORD:
        raise HTTPException(503, "ANALYTICS_PASSWORD is not set on the server.")
    if not hmac.compare_digest(supplied.encode(), ANALYTICS_PASSWORD.encode()):
        raise HTTPException(401, "Wrong password.")
    return True


# ------------------------------------------------------------------ ingest
def _parse_ts(v: Any) -> datetime:
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return datetime.utcnow()


def _num(v):
    try:
        return float(v) if v is not None and v != "" else None
    except Exception:
        return None


def _int(v):
    try:
        return int(v) if v is not None and v != "" else None
    except Exception:
        return None


def _s(v, n):
    return None if v is None else str(v)[:n]


@app.post("/api/events")
async def ingest(request: Request, s=Depends(db)):
    """Accepts a JSON array (or {"events": [...]}) — also as text/plain for navigator.sendBeacon."""
    accepted = skipped = 0
    try:
        raw = await request.body()
        import json
        data = json.loads(raw.decode("utf-8") or "[]")
    except Exception:
        return JSONResponse({"accepted": 0, "skipped": 0, "note": "unreadable body"}, status_code=200)
    if isinstance(data, dict):
        data = data.get("events", [data])
    if not isinstance(data, list):
        data = []
    for ev in data[:MAX_BATCH]:
        try:
            if not isinstance(ev, dict):
                skipped += 1; continue
            sid = _s(ev.get("session_id"), 64)
            et = _s(ev.get("event_type"), 40)
            if not sid or et not in EVENT_TYPES:
                skipped += 1; continue
            ts = _parse_ts(ev.get("timestamp"))
            ver = _s(ev.get("version"), 2)
            ver = ver if ver in ("A", "B") else None  # A/B study version; anything else is treated as unknown
            sess = s.get(Session, sid)
            if sess is None:
                sess = Session(session_id=sid, started_at=ts, completed=False, version=ver)
                s.add(sess)
            if ts < sess.started_at:
                sess.started_at = ts
            if sess.ended_at is None or ts > sess.ended_at:
                sess.ended_at = ts
            if sess.version is None and ver:
                sess.version = ver
            if et == "lesson_complete":
                sess.completed = True
            correct = ev.get("correct")
            s.add(Event(
                session_id=sid, scene=_int(ev.get("scene")), event_type=et,
                target=_s(ev.get("target"), 255), value=_s(ev.get("value"), 4000),
                x=_num(ev.get("x")), y=_num(ev.get("y")), attempt_no=_int(ev.get("attempt_no")),
                correct=None if correct is None else bool(correct), version=ver, timestamp=ts,
            ))
            s.flush()
            accepted += 1
        except Exception:
            s.rollback()
            skipped += 1
    try:
        s.commit()
    except Exception:
        s.rollback()
        return JSONResponse({"accepted": 0, "skipped": accepted + skipped, "note": "commit failed"}, status_code=200)
    return {"accepted": accepted, "skipped": skipped}


# ------------------------------------------------------------------ summary
def compute_summary(s, version: Optional[str] = None) -> dict:
    q = s.query(Session)
    if version:
        q = q.filter(Session.version == version)
    sessions = q.all()
    sess_ids = {x.session_id for x in sessions}
    events = [e for e in s.query(Event).order_by(Event.timestamp).all() if e.session_id in sess_ids]
    n = len(sessions)
    completed = [x for x in sessions if x.completed]

    # total lesson time per completed session: last event − session start (seconds)
    by_sess = defaultdict(list)
    for e in events:
        by_sess[e.session_id].append(e)
    lesson_times = []
    for x in completed:
        evs = by_sess.get(x.session_id, [])
        done = [e for e in evs if e.event_type == "lesson_complete"]
        # prefer the value measured in the browser (seconds since session start); else last event - start
        v = _num(done[-1].value) if done else None
        if v is None and evs:
            v = (evs[-1].timestamp - x.started_at).total_seconds()
        if v is not None and 0 < v < 4 * 3600:   # ignore abandoned tabs reopened days later
            lesson_times.append(v)

    # time per scene (scene_exit value = seconds spent)
    scene_t = defaultdict(list)
    for e in events:
        if e.event_type == "scene_exit" and e.scene:
            v = _num(e.value)
            if v is not None and 0 <= v < 3 * 3600:
                scene_t[e.scene].append(v)
    avg_scene = [
        {"scene": k, "name": SCENE_NAMES.get(k, str(k)), "avg_seconds": round(statistics.mean(v), 1), "visits": len(v)}
        for k, v in sorted(scene_t.items())
    ]

    # attempts to get each question right
    qc = defaultdict(list); qt = defaultdict(list)
    for e in events:
        if e.event_type == "quiz_complete" and e.target:
            if e.attempt_no:
                qc[e.target].append(e.attempt_no)
            v = _num(e.value)
            if v is not None:
                qt[e.target].append(v)
    wrong = Counter(e.target for e in events if e.event_type == "quiz_attempt" and e.correct is False)
    questions = [
        {"question": k, "avg_attempts": round(statistics.mean(v), 2), "completions": len(v),
         "avg_seconds": round(statistics.mean(qt[k]), 1) if qt.get(k) else None, "wrong_attempts": wrong.get(k, 0)}
        for k, v in sorted(qc.items())
    ]

    clicks = Counter(e.target for e in events if e.event_type == "button_click" and e.target)
    nonint = [e for e in events if e.event_type == "click_anywhere" and e.value == "non-interactive"]
    nonint_targets = Counter(f"S{e.scene or '?'} · {e.target or '(blank)'}" for e in nonint)
    nonint_scene = Counter(e.scene for e in nonint if e.scene)

    recent = sorted(sessions, key=lambda x: x.started_at, reverse=True)[:25]
    recent_rows = []
    for x in recent:
        evs = by_sess.get(x.session_id, [])
        last_scene = max((e.scene or 0) for e in evs) if evs else 0
        dur = (evs[-1].timestamp - x.started_at).total_seconds() if evs else 0
        recent_rows.append({
            "session_id": x.session_id[:8] + "…", "started_at": x.started_at.isoformat(timespec="seconds"),
            "completed": x.completed, "furthest_scene": last_scene, "minutes": round(dur / 60, 1), "events": len(evs),
        })

    return {
        "total_sessions": n,
        "completed_sessions": len(completed),
        "completion_rate": round(len(completed) / n, 3) if n else 0,
        "avg_lesson_minutes": round(statistics.mean(lesson_times) / 60, 1) if lesson_times else None,
        "total_events": len(events),
        "avg_time_per_scene": avg_scene,
        "questions": questions,
        "top_buttons": [{"target": k, "clicks": v} for k, v in clicks.most_common(12)],
        "noninteractive_clicks": len(nonint),
        "top_noninteractive_targets": [{"target": k, "clicks": v} for k, v in nonint_targets.most_common(12)],
        "noninteractive_by_scene": [{"scene": k, "clicks": v} for k, v in sorted(nonint_scene.items())],
        "recent_sessions": recent_rows,
    }


def trend_notes(sm: dict) -> List[str]:
    notes = []
    if not sm["total_sessions"]:
        return ["No sessions recorded yet. Share the lesson link and check back."]
    notes.append(f"{sm['total_sessions']} sessions so far; {round(sm['completion_rate'] * 100)}% reached the end of the lesson.")
    if sm["avg_lesson_minutes"]:
        m = sm["avg_lesson_minutes"]
        notes.append(f"Completers spent {m} minutes on average (target ≈ 15)." + (" That is well above target — look for pages that slow learners down." if m > 22 else ""))
    if sm["avg_time_per_scene"]:
        slow = max(sm["avg_time_per_scene"], key=lambda r: r["avg_seconds"])
        notes.append(f"Slowest scene: {slow['scene']} ({slow['name']}) at {slow['avg_seconds']} s on average.")
    if sm["questions"]:
        hard = max(sm["questions"], key=lambda r: r["avg_attempts"])
        if hard["avg_attempts"] > 1.3:
            notes.append(f"Hardest question: {hard['question']} — {hard['avg_attempts']} attempts on average before the right answer.")
        else:
            notes.append("Most questions are answered correctly on the first or second try.")
    if sm["noninteractive_clicks"]:
        t = sm["top_noninteractive_targets"][0]
        notes.append(f"{sm['noninteractive_clicks']} clicks landed on non-interactive areas; the most common was “{t['target']}” ({t['clicks']}×) — a sign learners expected it to be clickable.")
    if sm["completion_rate"] < 0.6 and sm["recent_sessions"]:
        drop = Counter(r["furthest_scene"] for r in sm["recent_sessions"] if not r["completed"]).most_common(1)
        if drop:
            notes.append(f"Learners who did not finish most often stopped at scene {drop[0][0]}.")
    return notes


@app.get("/api/summary")
def summary(_=Depends(require_password), s=Depends(db)):
    sm = compute_summary(s)
    sm["trends"] = trend_notes(sm)
    return sm


# ------------------------------------------------------------------ Excel export
HEAD = PatternFill("solid", fgColor="1C2130")


def _sheet(ws, headers, rows, widths=None):
    ws.append(headers)
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF"); c.fill = HEAD
    for r in rows:
        ws.append(r)
    ws.freeze_panes = "A2"
    for i, h in enumerate(headers, 1):
        ws.column_dimensions[get_column_letter(i)].width = (widths or {}).get(h, max(12, min(40, len(h) + 6)))


def _write_summary_sheet(ws, version, sm, notes):
    """One summary sheet for a single A/B version — same layout as the old overall summary."""
    ws["A1"] = f"WASA-4 Module 1 — learning analytics summary (Version {version})"; ws["A1"].font = Font(bold=True, size=14)
    ws["A2"] = f"Exported {datetime.utcnow().isoformat(timespec='minutes')} UTC"
    r = 4
    for k, v in [("Version", version), ("Sessions", sm["total_sessions"]), ("Completed sessions", sm["completed_sessions"]),
                 ("Completion rate", f"{round(sm['completion_rate'] * 100, 1)}%"),
                 ("Average lesson time (min, completers)", sm["avg_lesson_minutes"]),
                 ("Clicks on non-interactive areas", sm["noninteractive_clicks"]), ("Total events", sm["total_events"])]:
        ws.cell(r, 1, k).font = Font(bold=True); ws.cell(r, 2, v); r += 1
    r += 1; ws.cell(r, 1, "Trends to notice").font = Font(bold=True, size=12); r += 1
    for t in notes:
        ws.cell(r, 1, "• " + t).alignment = Alignment(wrap_text=True); ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=5); ws.row_dimensions[r].height = 30; r += 1

    def block(title, headers, rows):
        nonlocal r
        r += 1; ws.cell(r, 1, title).font = Font(bold=True, size=12); r += 1
        for i, h in enumerate(headers, 1):
            c = ws.cell(r, i, h); c.font = Font(bold=True, color="FFFFFF"); c.fill = HEAD
        r += 1
        for row in rows:
            for i, v in enumerate(row, 1):
                ws.cell(r, i, v)
            r += 1
    block("Average time per scene", ["Scene", "Name", "Avg seconds", "Visits"],
          [[x["scene"], x["name"], x["avg_seconds"], x["visits"]] for x in sm["avg_time_per_scene"]])
    block("Attempts per question", ["Question", "Avg attempts to correct", "Completions", "Avg seconds", "Wrong attempts"],
          [[x["question"], x["avg_attempts"], x["completions"], x["avg_seconds"], x["wrong_attempts"]] for x in sm["questions"]])
    block("Top clicked buttons", ["Button", "Clicks"], [[x["target"], x["clicks"]] for x in sm["top_buttons"]])
    block("Top non-interactive click targets", ["Target", "Clicks"], [[x["target"], x["clicks"]] for x in sm["top_noninteractive_targets"]])
    ws.column_dimensions["A"].width = 44
    for c in "BCDE":
        ws.column_dimensions[c].width = 22

@app.get("/api/export.xlsx")
def export_xlsx(_=Depends(require_password), s=Depends(db)):
    wb = Workbook()
    # Summary, sessions and events are each split by A/B version so the two
    # arms can be compared directly. Sessions/events without a version
    # (recorded before the version field existed) appear in neither sheet.
    for version in ("A", "B"):
        sm = compute_summary(s, version)
        ws = wb.active if version == "A" else wb.create_sheet(f"summary_{version}")
        if version == "A":
            ws.title = "summary_A"
        _write_summary_sheet(ws, version, sm, trend_notes(sm))

    for version in ("A", "B"):
        sessions_v = s.query(Session).filter(Session.version == version).order_by(Session.started_at).all()
        ids = [x.session_id for x in sessions_v]
        _sheet(wb.create_sheet(f"sessions_{version}"), ["session_id", "started_at", "ended_at", "completed", "version"],
               [[x.session_id, x.started_at, x.ended_at, x.completed, x.version] for x in sessions_v],
               {"session_id": 40, "started_at": 22, "ended_at": 22})
        _sheet(wb.create_sheet(f"events_{version}"),
               ["id", "session_id", "version", "scene", "event_type", "target", "value", "x", "y", "attempt_no", "correct", "timestamp"],
               [[e.id, e.session_id, e.version, e.scene, e.event_type, e.target, e.value, e.x, e.y, e.attempt_no, e.correct, e.timestamp]
                for e in s.query(Event).filter(Event.session_id.in_(ids)).order_by(Event.id)],
               {"session_id": 40, "target": 36, "value": 50, "timestamp": 22, "event_type": 16})

    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    name = f"wasa4-analytics-{datetime.utcnow():%Y%m%d-%H%M}.xlsx"
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": f'attachment; filename="{name}"'})


# ------------------------------------------------------------------ dashboard
@app.get("/analytics", include_in_schema=False)
def dashboard():
    return FileResponse(STATIC / "analytics.html", headers={"X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store"})


@app.get("/healthz", include_in_schema=False)
def health():
    return {"ok": True}


@app.get("/", include_in_schema=False)
def root():
    return {"service": "wasa4-analytics", "ok": True}
