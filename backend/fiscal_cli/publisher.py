"""Verified, non-overwriting publication for fiscal XML copies."""

from __future__ import annotations

import hashlib
import os
import tempfile
from pathlib import Path

from .models import CopyOperation


CHUNK_SIZE = 1024 * 1024


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _copy_to_temporary(source: Path, descriptor: int) -> str:
    digest = hashlib.sha256()
    # Own the temporary descriptor before opening the source so a missing or
    # inaccessible source cannot leave an open file that blocks cleanup.
    with os.fdopen(descriptor, "wb") as output_file, source.open("rb") as input_file:
        for chunk in iter(lambda: input_file.read(CHUNK_SIZE), b""):
            output_file.write(chunk)
            digest.update(chunk)
        output_file.flush()
        os.fsync(output_file.fileno())
    return digest.hexdigest()


def _existing_result(destination: Path, expected_hash: str) -> tuple[str, str]:
    if destination.is_file():
        try:
            if hash_file(destination) == expected_hash:
                return "duplicate_identical", ""
        except OSError:
            pass
    return "filename_conflict", ""


def _publish_no_replace(temporary: Path, destination: Path) -> None:
    if os.name == "nt":
        # On Windows, rename is atomic on the same volume and raises if the
        # destination already exists. This works on the synchronized project
        # drive without requiring hard-link support.
        os.rename(temporary, destination)
    else:
        # POSIX rename replaces existing files, so use an atomic create-link.
        os.link(temporary, destination)


def publish_operation(operation: CopyOperation, temporary_root: Path) -> tuple[str, str]:
    """Copy and atomically publish one operation, leaving no partial XML."""
    destination = operation.destination
    try:
        if destination.exists():
            return _existing_result(destination, operation.sha256)
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary_root.mkdir(parents=True, exist_ok=True)
        descriptor, temporary_name = tempfile.mkstemp(prefix="fiscal-", suffix=".tmp", dir=temporary_root)
        temporary = Path(temporary_name)
        try:
            actual_hash = _copy_to_temporary(operation.source, descriptor)
            if actual_hash != operation.sha256:
                return "copy_failed", "source_changed_after_classification"
            if hash_file(temporary) != operation.sha256:
                return "copy_failed", "temporary_hash_mismatch"
            try:
                # The platform-specific operation is atomic and cannot
                # replace a file created by another run.
                _publish_no_replace(temporary, destination)
            except FileExistsError:
                return _existing_result(destination, operation.sha256)
            except OSError as exc:
                # Report filesystem restrictions rather than falling back to
                # a non-atomic or overwriting copy.
                return "copy_failed", f"atomic_publish_failed: {exc}"
            if hash_file(destination) != operation.sha256:
                try:
                    if os.path.samefile(temporary, destination):
                        destination.unlink()
                except OSError:
                    pass
                return "copy_failed", "published_hash_mismatch"
            return "copied_verified", ""
        finally:
            temporary.unlink(missing_ok=True)
    except OSError as exc:
        return "copy_failed", str(exc)

