from __future__ import annotations


def main() -> None:
    import uvicorn

    uvicorn.run("kanban_backend.main:app", host="127.0.0.1", port=8000, reload=True)


__all__ = ["main"]
