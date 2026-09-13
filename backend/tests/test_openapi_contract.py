"""Contract test: keep the running API in sync with _docs/openapi.yaml."""

from __future__ import annotations

from pathlib import Path

import yaml
from fastapi.testclient import TestClient

from kanban_backend.main import app

REPO_ROOT = Path(__file__).resolve().parents[2]


def _load_documented_operations() -> set[str]:
    spec = yaml.safe_load((REPO_ROOT / "_docs" / "openapi.yaml").read_text())
    ops: set[str] = set()
    for path, methods in spec["paths"].items():
        for method in methods:
            ops.add(f"{method.upper()} {path}")
    return ops


def test_documented_paths_exist_in_generated_openapi():
    with TestClient(app) as client:
        generated = client.app.openapi()

    generated_ops = {
        f"{method.upper()} {path}"
        for path, methods in generated["paths"].items()
        for method in methods
    }
    documented = _load_documented_operations()

    assert generated_ops >= documented, (
        "Documented operations missing from the generated app: "
        f"{sorted(documented - generated_ops)}"
    )


def test_openapi_is_valid_yaml():
    with TestClient(app) as client:
        generated = client.app.openapi()
    assert generated["openapi"].startswith("3.")
    info = generated["info"]
    assert info.get("title")
    assert info.get("version")
