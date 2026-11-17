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
    timestamp = Column(DateTime, default=utcnow, index=True, nullable=False)


def init_db():
    Base.metadata.create_all(bind=engine)
