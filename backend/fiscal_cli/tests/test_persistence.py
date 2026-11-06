import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fiscal_cli.organization import _atomic_json
from fiscal_cli.persistence import write_atomic_json
from fiscal_cli.registry import Company, RegistryState, load_local, save_local


class AtomicPersistenceTests(unittest.TestCase):
    def test_new_parent_and_replacement_preserve_json_format(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "nested" / "resultado.json"
            write_atomic_json(path, {"anterior": True}, prefix="resultado-")
            payload = {"situação": "conferência", "itens": [1, {"válido": True}]}
            write_atomic_json(path, payload, prefix="resultado-")
            self.assertEqual(path.read_bytes(), (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
            self.assertEqual(list(path.parent.iterdir()), [path])

    def test_replace_failure_keeps_previous_file_and_removes_temporary(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "resultado.json"
            original = b'{"anterior":true}\n'
            path.write_bytes(original)

            def failed_replace(source, destination):
                self.assertEqual(Path(source).parent, path.parent)
                self.assertTrue(Path(source).name.startswith("resultado-"))
                self.assertEqual(json.loads(Path(source).read_text(encoding="utf-8")), {"novo": True})
                self.assertEqual(destination, path)
                raise OSError("replacement unavailable")

            with patch("fiscal_cli.persistence.os.replace", side_effect=failed_replace):
                with self.assertRaisesRegex(OSError, "replacement unavailable"):
                    _atomic_json(path, {"novo": True})
            self.assertEqual(path.read_bytes(), original)
            self.assertEqual(list(path.parent.iterdir()), [path])

    def test_serialization_failure_keeps_previous_file_and_removes_temporary(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "resultado.json"
            original = b'{"anterior":true}\n'
            path.write_bytes(original)
            with self.assertRaises(TypeError):
                write_atomic_json(path, {"unsupported": object()}, prefix="resultado-")
            self.assertEqual(path.read_bytes(), original)
            self.assertEqual(list(path.parent.iterdir()), [path])

    def test_registry_roundtrip_preserves_schema_and_temporary_prefix(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "empresas.json"
            company = Company("21", "21-EMPRESA", "00000000000000", xml_folder="21-RECEBIMENTO")
            state = RegistryState([company], [], [])
            from fiscal_cli.persistence import os
            replace = os.replace
            observed = []

            def observe_replace(source, destination):
                observed.append(Path(source).name)
                replace(source, destination)

            with patch("fiscal_cli.persistence.os.replace", side_effect=observe_replace):
                save_local(path, state)
            self.assertTrue(observed[0].startswith("empresas-"))
            self.assertEqual(load_local(path).payload(), state.payload())
            self.assertEqual(list(path.parent.iterdir()), [path])


if __name__ == "__main__":
    unittest.main()
