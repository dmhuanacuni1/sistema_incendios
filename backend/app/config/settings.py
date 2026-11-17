import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR / "correo.env")


def _uri_base_datos():
    url = os.environ.get("DATABASE_URL", "").strip().strip('"')
    if not url:
        raise RuntimeError("Falta DATABASE_URL en backend/.env")
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


class Config:
    SQLALCHEMY_DATABASE_URI = _uri_base_datos()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }
    SECRET_KEY = os.environ.get("SECRET_KEY", "").strip().strip('"')
    JWT_ACCESS_MINUTES = int(os.environ.get("JWT_ACCESS_MINUTES", "30"))
    JWT_REFRESH_DAYS = int(os.environ.get("JWT_REFRESH_DAYS", "7"))
    JWT_RESET_MINUTES = int(os.environ.get("JWT_RESET_MINUTES", "60"))
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://127.0.0.1:5173").strip().strip('"')
