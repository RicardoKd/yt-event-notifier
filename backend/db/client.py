import logging
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Protocol
from contextvars import ContextVar

logger = logging.getLogger(__name__)

# Context variable to hold the D1 database binding from Cloudflare
_db_binding: ContextVar[Any] = ContextVar("db_binding")

class LocalD1Binding:
    """Mock D1 binding for local development using sqlite3."""
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        import sqlite3
        from backend.db.schema import _CREATE_GROUPS, _CREATE_SLOTS, _CREATE_STREAMS
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(_CREATE_GROUPS)
            conn.execute(_CREATE_SLOTS)
            conn.execute(_CREATE_STREAMS)

    def prepare(self, sql: str):
        return LocalD1Statement(self.db_path, sql)

class LocalD1Statement:
    def __init__(self, db_path: str, sql: str):
        self.db_path = db_path
        self.sql = sql
        self.params = ()

    def bind(self, *params: Any):
        self.params = params
        return self

    async def all(self) -> dict[str, list[dict[str, Any]]]:
        import sqlite3
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(self.sql, self.params).fetchall()
            return {"results": [dict(r) for r in rows]}

    async def run(self) -> Any:
        import sqlite3
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(self.sql, self.params)
            conn.commit()
            return type("D1Result", (), {"meta": {"last_row_id": cursor.lastrowid}})()

class D1Cursor:
    def __init__(self, result: Any):
        self._result = result
        self._index = 0
        self._rows = result.get("results", []) if result else []

    async def fetchone(self) -> dict[str, Any] | None:
        if self._index < len(self._rows):
            row = self._rows[self._index]
            self._index += 1
            return row
        return None

    async def fetchall(self) -> list[dict[str, Any]]:
        return self._rows

class D1Connection:
    def __init__(self, db: Any):
        self._db = db

    async def execute(self, sql: str, params: tuple[Any, ...] = ()) -> D1Cursor:
        # Cloudflare D1 uses ? for placeholders, same as SQLite
        stmt = self._db.prepare(sql)
        if params:
            stmt = stmt.bind(*params)
        
        # Determine if it's a mutation or a query
        sql_upper = sql.strip().upper()
        if sql_upper.startswith(("INSERT", "UPDATE", "DELETE", "REPLACE")):
            res = await stmt.run()
            # Mocking lastrowid if possible, though D1 run() returns meta
            cursor = D1Cursor(None)
            cursor.lastrowid = res.meta.get("last_row_id")
            return cursor
        else:
            res = await stmt.all()
            return D1Cursor(res)

    async def commit(self) -> None:
        # D1 is auto-commit per statement/batch
        pass

    async def close(self) -> None:
        pass

def set_db(db: Any) -> None:
    _db_binding.set(db)

@asynccontextmanager
async def db_context() -> AsyncGenerator[D1Connection, None]:
    db = _db_binding.get()
    conn = D1Connection(db)
    # Note: init_schema should be handled via wrangler d1 execute or a migration
    # but we can keep a check here if needed. 
    # For now, we assume the schema is managed via Cloudflare dashboard/CLI.
    try:
        yield conn
    finally:
        await conn.close()

def get_connection() -> D1Connection:
    db = _db_binding.get()
    return D1Connection(db)
