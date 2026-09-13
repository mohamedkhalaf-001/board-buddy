import pytest
from fastapi.testclient import TestClient

from kanban_backend.main import app


@pytest.fixture
def client():
    """TestClient with a freshly reset (seeded) mock database per test."""
    with TestClient(app) as c:
        app.state.db.reset()
        yield c
