import json
import struct
import hashlib
import shutil
import zipfile
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


GENERATOR = Path(__file__).with_name("generate.py")


class HydrogenGenerationTest(unittest.TestCase):
    def test_generated_surfaces_enclose_ninety_percent_in_full_space(self):
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run(
                [sys.executable, str(GENERATOR), "--output-dir", directory],
                capture_output=True, text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            report = json.loads((Path(directory) / "metrics.v1.json").read_text())
            for state, expected_components in [("1s", 1), ("2p-z", 2)]:
                metric = report["states"][state]
                self.assertAlmostEqual(metric["full_space_probability"], 0.9, delta=1e-10)
                self.assertAlmostEqual(metric["mesh_probability"], 0.9, delta=0.001)
                self.assertLess(metric["quadrature_change"], 1e-5)
                self.assertEqual(metric["components"], expected_components)
                self.assertTrue(metric["closed_oriented_manifold"])

    def test_browser_meshes_match_native_composed_usd_variants(self):
        import numpy as np
        from pxr import Usd, UsdGeom

        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            result = subprocess.run(
                [sys.executable, str(GENERATOR), "--output-dir", directory],
                capture_output=True, text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue((output / "scene.usda").is_file())
            self.assertEqual(result.stderr, "")
            stage = Usd.Stage.Open(str(output / "scene.usda"))
            self.assertEqual(stage.GetDefaultPrim().GetAttribute("science:modelIdentifier").Get(),
                             "urn:biophysics:hydrogen:stationary-density:v1")
            self.assertEqual(stage.GetDefaultPrim().GetAttribute("science:atomIdentifier").Get(),
                             "urn:biophysics:atom:protium:neutral")
            self.assertEqual(UsdGeom.GetStageUpAxis(stage), "Z")
            self.assertEqual(UsdGeom.GetStageMetersPerUnit(stage), 1e-10)
            variants = stage.GetDefaultPrim().GetVariantSets().GetVariantSet("state")
            self.assertEqual(set(variants.GetVariantNames()), {"1s", "2p-z"})
            for state in variants.GetVariantNames():
                variants.SetVariantSelection(state)
                mesh = UsdGeom.Mesh(stage.GetPrimAtPath("/Hydrogen/Density/Surface"))
                points = np.asarray(mesh.GetPointsAttr().Get(), dtype=np.float32)
                indices = np.asarray(mesh.GetFaceVertexIndicesAttr().Get(), dtype=np.uint32)
                payload = (output / "scenes" / f"scene-{state}.glb").read_bytes()
                magic, version, length = struct.unpack_from("<4sII", payload)
                self.assertEqual((magic, version, length), (b"glTF", 2, len(payload)))
                json_length = struct.unpack_from("<I", payload, 12)[0]
                document = json.loads(payload[20:20+json_length])
                binary = payload[28+json_length:]
                primitive = document["meshes"][0]["primitives"][0]

                def array(accessor_id, dtype):
                    accessor = document["accessors"][accessor_id]
                    view = document["bufferViews"][accessor["bufferView"]]
                    return np.frombuffer(binary[view["byteOffset"]:view["byteOffset"]+view["byteLength"]], dtype=dtype)

                actual = array(primitive["attributes"]["POSITION"], "<f4").reshape(-1, 3)
                expected = (points[:, [0, 2, 1]].astype(float) * [1e-10, 1e-10, -1e-10]).astype(np.float32)
                np.testing.assert_array_equal(actual, expected)
                np.testing.assert_array_equal(array(primitive["indices"], "<u4"), indices)
                self.assertEqual(document["asset"]["extras"]["source"], "native composed scene.usda")

    def test_check_and_bundle_detect_stale_sources_and_outputs(self):
        root = GENERATOR.parents[2]
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory)
            sources = ["model.v1.json", "atom.qcschema.json"]
            for name in sources:
                target = fixture / "Assets/concepts/hydrogen" / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(root / "Assets/concepts/hydrogen" / name, target)
            for name in ["generate.py", "test_generate.py", "requirements.txt"]:
                target = fixture / "tools/hydrogen" / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(GENERATOR.parent / name, target)
            command = [sys.executable, str(fixture / "tools/hydrogen/generate.py")]

            def run(*arguments):
                return subprocess.run(command + list(arguments), capture_output=True, text=True)

            result = run()
            self.assertEqual(result.returncode, 0, result.stderr)
            result = run("--check")
            self.assertEqual(result.returncode, 0, result.stderr)
            assets = fixture / "Assets/concepts/hydrogen"
            with zipfile.ZipFile(assets / "hydrogen-bundle.zip") as archive:
                index = json.loads(archive.read("Assets/concepts/hydrogen/bundle-manifest.v1.json"))
                for entry in index["files"]:
                    self.assertEqual(hashlib.sha256(archive.read(entry["path"])).hexdigest(), entry["sha256"])
                self.assertIn("tools/hydrogen/generate.py", archive.namelist())
            glb = assets / "scenes/scene-1s.glb"
            glb.write_bytes(glb.read_bytes() + b"tampered")
            result = run("--check")
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("stale output", result.stderr.lower())
            result = run()
            self.assertEqual(result.returncode, 0, result.stderr)
            model = assets / "model.v1.json"
            model.write_text(model.read_text() + " ")
            result = run("--check")
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("stale source", result.stderr.lower())


if __name__ == "__main__":
    unittest.main()
