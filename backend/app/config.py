from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
CONTENT = ROOT / 'content'   # seed source for roadmaps and notes
DIST = ROOT / 'frontend' / 'dist'


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(ROOT / '.env', BACKEND / '.env'), extra='ignore')   # real env vars win

    mongodb_uri: str
    db_name: str = 'dsa_tracker'
    cookie_secure: bool = True   # set COOKIE_SECURE=false only for local http:// development
    session_days: int = 30


settings = Settings()
