"""Helpers for turning a demo's minimal replica into a project workspace."""

from __future__ import annotations

import json
from typing import Any


_LANGUAGE_BY_EXT = {
    "html": "html",
    "htm": "html",
    "js": "javascript",
    "mjs": "javascript",
    "cjs": "javascript",
    "ts": "typescript",
    "tsx": "typescript",
    "css": "css",
    "py": "python",
    "json": "json",
    "md": "markdown",
}

_FALLBACK_FILES = {
    "index.html": (
        "<!doctype html><html><body><h1>Demo Template</h1>"
        "<script type='module' src='./src/main.js'></script></body></html>"
    ),
    "src/main.js": "console.log('Start from this template and build your own version.');",
}


def _coerce_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def _guess_language(filename: str) -> str:
    if "." not in filename:
        return "html"
    ext = filename.rsplit(".", 1)[-1].strip().lower()
    return _LANGUAGE_BY_EXT.get(ext, "html")


def parse_minimal_replica(minimal_replica: Any, demo_name: str = "Demo") -> tuple[str, dict[str, str]]:
    """Return (entry_file, files) using the same fallback as the fork-template API."""

    parsed = _coerce_dict(minimal_replica)
    entry_file = parsed.get("entry_file")
    raw_files = parsed.get("files")

    files: dict[str, str] = {}
    if isinstance(raw_files, dict):
        for name, content in raw_files.items():
            if isinstance(name, str) and name.strip():
                files[name] = str(content or "")

    if not files:
        files = dict(_FALLBACK_FILES)

    if not isinstance(entry_file, str) or not entry_file or entry_file not in files:
        entry_file = next(iter(files), "src/main.js")

    return entry_file, files


def build_demo_workspace_payload(minimal_replica: Any, demo_name: str = "Demo") -> dict[str, Any]:
    """Build the workspace payload consumed by ProjectRepo.save_project_workspace."""

    entry_file, files = parse_minimal_replica(minimal_replica, demo_name=demo_name)
    normalized_files: list[dict[str, Any]] = []
    for name, content in files.items():
        normalized_files.append(
            {
                "name": name,
                "language": _guess_language(name),
                "content": content,
                "is_main": name == entry_file,
            }
        )

    entry_content = files.get(entry_file, "")
    return {
        "code": entry_content,
        "language": _guess_language(entry_file),
        "filename": entry_file,
        "files": normalized_files,
    }
