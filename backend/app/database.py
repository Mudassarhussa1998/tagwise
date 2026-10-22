import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR") or BASE_DIR / "uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

def database_url() -> URL | str:
    """DATABASE_URL wins if set; otherwise build one from the POSTGRES_* variables."""
    if url := os.getenv("DATABASE_URL"):
        return url
    return URL.create(
        "postgresql+psycopg",
        username=os.getenv("POSTGRES_USER") or None,
        password=os.getenv("POSTGRES_PASSWORD") or None,
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        database=os.getenv("POSTGRES_DB") or "tagwise",
    )


engine = create_engine(database_url(), pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
