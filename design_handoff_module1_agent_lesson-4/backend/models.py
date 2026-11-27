"""Database models and session factory (SQLAlchemy 2.x).

DATABASE_URL defaults to a local SQLite file. Set it to a PostgreSQL URL
(e.g. Render's free PostgreSQL) to keep data across redeploys.
"""
import os
from datetime import datetime, timezone

from sqlalchemy import (Boolean, Column, DateTime, Float, ForeignKey, Integer,
                        String, Text, create_engine)
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./analytics.db")
# Render / Heroku style URLs start with postgres:// — SQLAlchemy needs postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Session(Base):
    __tablename__ = "sessions"
    session_id = Column(String(64), primary_key=True)
    started_at = Column(DateTime, default=utcnow, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    completed = Column(Boolean, default=False, nullable=False)
    version = Column(String(2), nullable=True)  # A/B study: 'A' (narration) or 'B' (on-screen text)


class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(64), ForeignKey("sessions.session_id"), index=True, nullable=False)
    scene = Column(Integer, nullable=True, index=True)
    event_type = Column(String(40), index=True, nullable=False)
    target = Column(String(255), nullable=True)
    value = Column(Text, nullable=True)
    x = Column(Float, nullable=True)
    y = Column(Float, nullable=True)
    attempt_no = Column(Integer, nullable=True)
    correct = Column(Boolean, nullable=True)
    version = Column(String(2), nullable=True, index=True)  # A/B study: 'A' or 'B', copied from the event payload
    timestamp = Column(DateTime, default=utcnow, index=True, nullable=False)


def init_db():
    Base.metadata.create_all(bind=engine)
    _ensure_version_columns()


def _ensure_version_columns():
    """Add the version column to tables created before it existed.

    create_all() never alters an existing table, so a local analytics.db
    from before this change would otherwise reject every insert. On Render
    the SQLite file is wiped on redeploy, so this is a no-op there — it only
    matters for a pre-existing local database.
    """
    from sqlalchemy import inspect, text
    insp = inspect(engine)
    for table in ("sessions", "events"):
        try:
            cols = [c["name"] for c in insp.get_columns(table)]
        except Exception:
            continue
        if "version" not in cols:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN version VARCHAR(2)"))
