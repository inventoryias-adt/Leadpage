"""Estado em SQLite: evita repetir produto e guarda o histórico de pacotes."""
from __future__ import annotations

import sqlite3
import time
from pathlib import Path


class State:
    def __init__(self, path: str):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.con = sqlite3.connect(path)
        self.con.execute(
            """CREATE TABLE IF NOT EXISTS packages (
                   uid TEXT PRIMARY KEY,
                   title TEXT,
                   commission_rate REAL,
                   created_at INTEGER,
                   path TEXT)"""
        )
        self.con.commit()

    def seen(self, uid: str) -> bool:
        return self.con.execute("SELECT 1 FROM packages WHERE uid=?", (uid,)).fetchone() is not None

    def mark(self, uid: str, title: str, rate: float, path: str) -> None:
        self.con.execute(
            "INSERT OR REPLACE INTO packages VALUES (?,?,?,?,?)",
            (uid, title, rate, int(time.time()), path),
        )
        self.con.commit()

    def close(self) -> None:
        self.con.close()
