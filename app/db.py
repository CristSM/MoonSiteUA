"""Conexión a SQLite. La base de datos se crea sola la primera vez."""
import os
import sqlite3
from pathlib import Path

from seed import seed

HERE = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("MOONSITE_DB", HERE / "moonsite.db"))


def connect(path: Path | str = None) -> sqlite3.Connection:
    con = sqlite3.connect(path or DB_PATH, check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def init(path: Path | str = None) -> sqlite3.Connection:
    con = connect(path)
    con.executescript((HERE / "schema.sql").read_text(encoding="utf-8"))
    seed(con)
    return con
