"""Atomic JSON persistence shared by execution history and company registry."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any


def write_atomic_json(path: Path, payload: dict[str, Any], *, prefix: str) -> None:
    """Replace a JSON file only after its UTF-8 contents are flushed to disk."""
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=prefix, suffix=".tmp", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise
