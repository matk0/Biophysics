import argparse
import hashlib
from importlib.metadata import version
import json
import math
from pathlib import Path
import shutil
import struct
import sys
import tempfile
import zipfile

import numpy as np
from scipy.integrate import quad
from scipy.optimize import brentq
from pxr import Gf, Sdf, Usd, UsdGeom, UsdShade, Vt


ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "Assets/concepts/hydrogen"
ASSET_PREFIX = "Assets/concepts/hydrogen/"
SOURCE_PATHS = [ASSET_PREFIX+"model.v1.json", ASSET_PREFIX+"atom.qcschema.json",
                "tools/hydrogen/generate.py", "tools/hydrogen/requirements.txt", "tools/hydrogen/test_generate.py"]
SCENE_OUTPUTS = ["metrics.v1.json", "scene.usda", "layers/density-1s.usda", "layers/density-2p-z.usda",
                 "scenes/scene-1s.glb", "scenes/scene-2p-z.glb"]
OUTPUTS = SCENE_OUTPUTS + ["bundle-manifest.v1.json", "hydrogen-bundle.zip"]


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True, allow_nan=False) + "\n")


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_inputs(model, atom):
    if model["schema"] != "hydrogen-analytical-model/v1" or set(model["states"]) != {"1s", "2p-z"}:
        raise ValueError("Unsupported hydrogen analytical model")
    for state, quantum, density in [("1s", (1, 0, 0), "exp(-2*r)/pi"), ("2p-z", (2, 1, 0), "z^2*exp(-r)/(32*pi)")]:
        record = model["states"][state]
        if tuple(record[key] for key in ("n", "l", "m_l")) != quantum or record["density"] != density:
            raise ValueError("Unsupported electronic state definition")
    if atom["symbols"] != ["H"] or atom["geometry"] != [0, 0, 0] or atom["mass_numbers"] != [1]:
        raise ValueError("This model requires one protium nucleus at the origin")
    if atom["molecular_charge"] != 0 or atom["molecular_multiplicity"] != 2:
        raise ValueError("This model requires neutral doublet hydrogen")
    if model["surface"]["probability"] != 0.9 or model["coordinates"]["unit"] != "bohr":
        raise ValueError("This model requires a 90% surface in bohr coordinates")
    if model["presentation"]["usd_meters_per_unit"] != 1e-10:
        raise ValueError("This exporter requires angstrom USD coordinates")
    for key in ("profile_intervals", "azimuth_segments"):
        if not isinstance(model["surface"][key], int) or model["surface"][key] < 16:
            raise ValueError("Surface resolution must be an integer of at least 16")
    dependencies = {}
    for line in (ROOT/"tools/hydrogen/requirements.txt").read_text().splitlines():
        package, pinned = line.split("==")
        dependencies[package] = version(package)
        if dependencies[package] != pinned:
            raise ValueError(f"Dependency {package} requires pinned version {pinned}")
    return dependencies


def threshold_2p(probability):
    def roots(k):
        fn = lambda r: r * r * math.exp(-r) - k
        return brentq(fn, 0, 2, xtol=1e-14), brentq(fn, 2, 100, xtol=1e-13)

    def mass(k):
        lower, upper = roots(k)
        integrand = lambda r: (r**4 * math.exp(-r) - k**1.5 * r * math.exp(r / 2)) / 24
        return quad(integrand, lower, upper, epsabs=1e-13, epsrel=1e-13)[0]

    k = brentq(lambda value: mass(value) - probability, 1e-12, 4 * math.exp(-2) * (1 - 1e-12), xtol=1e-15)
    return k, roots(k), mass(k)


def profiles(state, model):
    probability = model["surface"]["probability"]
    t = np.linspace(0, math.pi, model["surface"]["profile_intervals"] + 1)
    if state == "1s":
        mass = lambda r: 1 - math.exp(-2*r) * (1 + 2*r + 2*r*r)
        radius = brentq(lambda r: mass(r) - probability, 0, 30, xtol=1e-14)
        z, s = -radius * np.cos(t), radius * np.sin(t)
        s[[0, -1]] = 0
        return [(z, s)], math.exp(-2*radius)/math.pi, mass(radius)
    k, (lower, upper), probability = threshold_2p(probability)
    r = lower + (upper-lower) * (1 - np.cos(t)) / 2
    z = np.sqrt(k) * np.exp(r/2)
    s = np.sqrt(np.maximum(0, r*r-z*z))
    s[[0, -1]] = 0
    return [(-z[::-1], s[::-1]), (z, s)], k/(32*math.pi), probability


def revolution(z, radius, segments):
    phi = np.arange(segments) * 2*math.pi/segments
    rings = np.stack([
        radius[1:-1, None] * np.cos(phi),
        radius[1:-1, None] * np.sin(phi),
        np.broadcast_to(z[1:-1, None], (len(z)-2, segments)),
    ], axis=-1).reshape(-1, 3)
    points = np.concatenate([[[0, 0, z[0]]], rings, [[0, 0, z[-1]]]])
    triangles = []
    for j in range(segments):
        nxt = (j+1) % segments
        triangles.append([0, 1+nxt, 1+j])
        for ring in range(len(z)-3):
            a, b = 1+ring*segments+j, 1+ring*segments+nxt
            c, d = a+segments, b+segments
            triangles.extend([[a, b, c], [b, d, c]])
        end = 1+(len(z)-3)*segments
        triangles.append([len(points)-1, end+j, end+nxt])
    return points, np.asarray(triangles, dtype=np.uint32)


def validate_mesh(points, triangles):
    if not np.isfinite(points).all() or triangles.max() >= len(points):
        raise ValueError("Invalid mesh coordinates or indices")
    a, b, c = points[triangles[:, 0]], points[triangles[:, 1]], points[triangles[:, 2]]
    if np.any(np.linalg.norm(np.cross(b-a, c-a), axis=1) < 1e-12):
        raise ValueError("Degenerate triangle")
    edges = np.concatenate([triangles[:, [0, 1]], triangles[:, [1, 2]], triangles[:, [2, 0]]])
    undirected = np.sort(edges, axis=1)
    _, inverse, counts = np.unique(undirected, axis=0, return_inverse=True, return_counts=True)
    orientation = np.bincount(inverse, weights=np.where(edges[:, 0] < edges[:, 1], 1, -1))
    if np.any(counts != 2) or np.any(orientation != 0):
        raise ValueError("Mesh is not a closed consistently oriented manifold")
    parent = np.arange(len(points))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for u, v in undirected:
        parent[find(u)] = find(v)
    groups = np.array([find(i) for i in range(len(points))])
    volume_terms = np.einsum("ij,ij->i", a, np.cross(b, c))/6
    for component in np.unique(groups):
        if volume_terms[groups[triangles[:, 0]] == component].sum() <= 0:
            raise ValueError("Inward mesh winding")
    return int(len(np.unique(groups)))


def mesh_probability(state, cross_sections, segments, order):
    nodes, weights = np.polynomial.legendre.leggauss(order)
    delta = nodes * math.pi/segments
    total = 0.0
    for z, radius in cross_sections:
        half = (z[1:]-z[:-1])/2
        heights = (z[1:]+z[:-1])[:, None]/2 + half[:, None]*nodes
        circumradius = (radius[1:]+radius[:-1])[:, None]/2 + (radius[1:]-radius[:-1])[:, None]/2*nodes
        side_radius = circumradius[:, :, None] * math.cos(math.pi/segments) / np.cos(delta)
        r = np.sqrt(side_radius**2 + heights[:, :, None]**2)
        abs_z = np.abs(heights[:, :, None])
        if state == "1s":
            radial_integral = ((2*abs_z+1)*np.exp(-2*abs_z) - (2*r+1)*np.exp(-2*r))/(4*math.pi)
        else:
            radial_integral = abs_z**2 * ((abs_z+1)*np.exp(-abs_z) - (r+1)*np.exp(-r))/(32*math.pi)
        total += float(np.einsum("ijk,i,j,k->", radial_integral, half, weights, weights) * math.pi)
    return total


def build_state(state, model):
    cross_sections, isovalue, probability = profiles(state, model)
    segments = model["surface"]["azimuth_segments"]
    angstrom_per_bohr = model["constants"]["bohr_m"] / 1e-10
    all_points, all_triangles, final_sections = [], [], []
    offset = 0
    for z, radius in cross_sections:
        points, triangles = revolution(z, radius, segments)
        points = (points*angstrom_per_bohr).astype(np.float32)
        all_points.append(points)
        all_triangles.append(triangles+offset)
        offset += len(points)
        sample = np.r_[0, 1+np.arange(len(z)-2)*segments, len(points)-1]
        final_sections.append((points[sample, 2].astype(float)/angstrom_per_bohr,
                               points[sample, 0].astype(float)/angstrom_per_bohr))
    points, triangles = np.concatenate(all_points), np.concatenate(all_triangles)
    components = validate_mesh(points.astype(float), triangles)
    coarse = mesh_probability(state, final_sections, segments, 12)
    mass = mesh_probability(state, final_sections, segments, 24)
    tolerance = model["surface"]
    if abs(probability-0.9) > tolerance["analytical_probability_tolerance"]:
        raise ValueError("Full-space probability failed")
    if abs(mass-0.9) > tolerance["mesh_probability_tolerance"]:
        raise ValueError(f"Mesh probability failed: {mass}")
    if abs(mass-coarse) > tolerance["quadrature_tolerance"]:
        raise ValueError("Mesh quadrature did not converge")
    normalized = points.astype(float)/angstrom_per_bohr
    normals = normalized / np.linalg.norm(normalized, axis=1)[:, None]
    if state == "2p-z":
        normals[:, 2] -= 2/normalized[:, 2]
    normals /= np.linalg.norm(normals, axis=1)[:, None]
    metric = {
        "isovalue_bohr_inverse_cubed": isovalue,
        "full_space_probability": probability,
        "mesh_probability": mass,
        "quadrature_change": abs(mass-coarse),
        "components": components,
        "closed_oriented_manifold": True,
        "vertices": len(points), "triangles": len(triangles),
        "bounds_angstrom": [points.min(axis=0).tolist(), points.max(axis=0).tolist()],
    }
    return points, triangles, normals.astype(np.float32), metric


def usd_stage(path=None):
    stage = Usd.Stage.CreateNew(str(path)) if path else Usd.Stage.CreateInMemory()
    UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.z)
    UsdGeom.SetStageMetersPerUnit(stage, 1e-10)
    return stage


def write_usd(output, states, model):
    (output/"layers").mkdir(parents=True, exist_ok=True)
    for state, (points, triangles, normals, metric) in states.items():
        stage = usd_stage()
        root = UsdGeom.Xform.Define(stage, "/Density")
        stage.SetDefaultPrim(root.GetPrim())
        mesh = UsdGeom.Mesh.Define(stage, "/Density/Surface")
        mesh.CreatePointsAttr(Vt.Vec3fArray.FromNumpy(points))
        mesh.CreateFaceVertexCountsAttr(Vt.IntArray.FromNumpy(np.full(len(triangles), 3, dtype=np.int32)))
        mesh.CreateFaceVertexIndicesAttr(Vt.IntArray.FromNumpy(triangles.ravel().astype(np.int32)))
        mesh.CreateNormalsAttr(Vt.Vec3fArray.FromNumpy(normals))
        mesh.SetNormalsInterpolation(UsdGeom.Tokens.vertex)
        mesh.CreateSubdivisionSchemeAttr(UsdGeom.Tokens.none)
        mesh.CreateOrientationAttr(UsdGeom.Tokens.rightHanded)
        mesh.CreateDoubleSidedAttr(False)
        mesh.CreateExtentAttr(Vt.Vec3fArray([Gf.Vec3f(*metric["bounds_angstrom"][0]), Gf.Vec3f(*metric["bounds_angstrom"][1])]))
        color = Gf.Vec3f(*model["presentation"]["color_linear_rgb"])
        mesh.CreateDisplayColorAttr(Vt.Vec3fArray([color]))
        mesh.GetPrim().CreateAttribute("science:state", Sdf.ValueTypeNames.String).Set(state)
        mesh.GetPrim().CreateAttribute("science:enclosedProbability", Sdf.ValueTypeNames.Double).Set(metric["full_space_probability"])
        mesh.GetPrim().CreateAttribute("science:isovalueBohrInverseCubed", Sdf.ValueTypeNames.Double).Set(metric["isovalue_bohr_inverse_cubed"])
        material = UsdShade.Material.Define(stage, "/Density/Material")
        shader = UsdShade.Shader.Define(stage, "/Density/Material/PreviewSurface")
        shader.CreateIdAttr("UsdPreviewSurface")
        shader.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).Set(color)
        shader.CreateInput("roughness", Sdf.ValueTypeNames.Float).Set(model["presentation"]["roughness"])
        shader.CreateInput("metallic", Sdf.ValueTypeNames.Float).Set(0)
        shader.CreateInput("opacity", Sdf.ValueTypeNames.Float).Set(model["presentation"]["opacity"])
        material.CreateSurfaceOutput().ConnectToSource(shader.ConnectableAPI(), "surface")
        UsdShade.MaterialBindingAPI.Apply(mesh.GetPrim()).Bind(material)
        stage.GetRootLayer().Export(str(output/"layers"/f"density-{state}.usda"))
    stage = usd_stage(output/"scene.usda")
    root = UsdGeom.Xform.Define(stage, "/Hydrogen")
    stage.SetDefaultPrim(root.GetPrim())
    root.GetPrim().SetDocumentation("Stationary electron probability density. The two 2p_z lobes together enclose 90%; neither state depicts an electron orbit.")
    root.GetPrim().CreateAttribute("science:model", Sdf.ValueTypeNames.Asset).Set(Sdf.AssetPath("model.v1.json"))
    root.GetPrim().CreateAttribute("science:atom", Sdf.ValueTypeNames.Asset).Set(Sdf.AssetPath("atom.qcschema.json"))
    for attribute, value in {
        "modelIdentifier": model["identifier"], "atomIdentifier": model["atom_identifier"],
        "modelSchema": model["schema_identifier"], "atomSchema": "qcschema_molecule/2",
        "modelSha256": sha256(ASSETS/"model.v1.json"), "atomSha256": sha256(ASSETS/"atom.qcschema.json"),
    }.items():
        root.GetPrim().CreateAttribute("science:"+attribute, Sdf.ValueTypeNames.String).Set(value)
    variants = root.GetPrim().GetVariantSets().AddVariantSet("state")
    for state in states:
        variants.AddVariant(state)
        variants.SetVariantSelection(state)
        with variants.GetVariantEditContext():
            density = stage.DefinePrim("/Hydrogen/Density", "Xform")
            density.GetReferences().AddReference(f"layers/density-{state}.usda", "/Density")
    variants.SetVariantSelection("1s")
    stage.GetRootLayer().Export(str(output/"scene.usda"))


def composed_mesh(scene, state):
    stage = Usd.Stage.Open(str(scene))
    if not stage or UsdGeom.GetStageUpAxis(stage) != "Z" or UsdGeom.GetStageMetersPerUnit(stage) != 1e-10:
        raise ValueError("Unexpected native USD coordinate system")
    variants = stage.GetDefaultPrim().GetVariantSets().GetVariantSet("state")
    with Usd.EditContext(stage, stage.GetSessionLayer()):
        if not variants.SetVariantSelection(state):
            raise ValueError(f"Missing USD variant: {state}")
    meshes = [UsdGeom.Mesh(prim) for prim in stage.Traverse() if prim.IsA(UsdGeom.Mesh)]
    if len(meshes) != 1:
        raise ValueError("Each hydrogen variant must compose exactly one mesh")
    mesh = meshes[0]
    counts = np.asarray(mesh.GetFaceVertexCountsAttr().Get())
    if not np.all(counts == 3) or mesh.GetSubdivisionSchemeAttr().Get() != "none":
        raise ValueError("Composed USD mesh must be explicit triangles")
    if mesh.GetOrientationAttr().Get() != "rightHanded":
        raise ValueError("Unexpected USD orientation")
    points = np.asarray(mesh.GetPointsAttr().Get(), dtype=np.float32)
    triangles = np.asarray(mesh.GetFaceVertexIndicesAttr().Get(), dtype=np.uint32).reshape(-1, 3)
    normals = np.asarray(mesh.GetNormalsAttr().Get(), dtype=np.float32)
    transform = np.asarray(UsdGeom.XformCache().GetLocalToWorldTransform(mesh.GetPrim()))
    if not np.array_equal(transform, np.eye(4)):
        raise ValueError("Hydrogen composition must preserve the proton-centered frame")
    validate_mesh(points.astype(float), triangles)
    material = UsdShade.MaterialBindingAPI(mesh.GetPrim()).ComputeBoundMaterial()[0]
    shader = material.ComputeSurfaceSource()[0]
    return points, triangles, normals, {
        "baseColorFactor": list(shader.GetInput("diffuseColor").Get()) + [shader.GetInput("opacity").Get()],
        "roughnessFactor": shader.GetInput("roughness").Get(),
        "metallicFactor": shader.GetInput("metallic").Get(),
    }


def write_glb(scene, state, destination):
    points, triangles, normals, material = composed_mesh(scene, state)
    positions = (points[:, [0, 2, 1]].astype(float) * [1e-10, 1e-10, -1e-10]).astype("<f4")
    normals = (normals[:, [0, 2, 1]] * [1, 1, -1]).astype("<f4")
    arrays = [positions, normals, triangles.astype("<u4").ravel()]
    views, accessors, binary = [], [], bytearray()
    for index, array in enumerate(arrays):
        data = array.tobytes()
        views.append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(data), "target": 34963 if index == 2 else 34962})
        accessor = {"bufferView": index, "componentType": 5125 if index == 2 else 5126,
                    "count": len(array), "type": "SCALAR" if index == 2 else "VEC3"}
        if index == 0:
            accessor.update({"min": positions.min(axis=0).tolist(), "max": positions.max(axis=0).tolist()})
        accessors.append(accessor)
        binary.extend(data)
    document = {
        "asset": {"version": "2.0", "generator": "hydrogen USD readback exporter",
                  "extras": {"source": "native composed scene.usda", "state": state,
                             "metersPerUnit": 1, "enclosedProbability": 0.9}},
        "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0, "name": f"Hydrogen {state}"}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1}, "indices": 2, "material": 0}]}],
        "materials": [{"name": "Probability density", "pbrMetallicRoughness": material, "doubleSided": False}],
        "buffers": [{"byteLength": len(binary)}], "bufferViews": views, "accessors": accessors,
    }
    json_bytes = json.dumps(document, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    json_bytes += b" " * (-len(json_bytes) % 4)
    length = 12 + 8 + len(json_bytes) + 8 + len(binary)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(struct.pack("<4sII", b"glTF", 2, length) + struct.pack("<I4s", len(json_bytes), b"JSON") +
                            json_bytes + struct.pack("<I4s", len(binary), b"BIN\0") + binary)


def generate(output):
    model = json.loads((ASSETS/"model.v1.json").read_text())
    atom = json.loads((ASSETS/"atom.qcschema.json").read_text())
    dependencies = validate_inputs(model, atom)
    output.mkdir(parents=True, exist_ok=True)
    for name in ["model.v1.json", "atom.qcschema.json"]:
        if (ASSETS/name).resolve() != (output/name).resolve():
            shutil.copyfile(ASSETS/name, output/name)
    states = {state: build_state(state, model) for state in model["states"]}
    write_json(output/"metrics.v1.json", {
        "schema": "hydrogen-metrics/v1",
        "states": {state: data[3] for state, data in states.items()},
    })
    write_usd(output, states, model)
    for state in states:
        write_glb(output/"scene.usda", state, output/"scenes"/f"scene-{state}.glb")
    files = {path: ROOT/path for path in SOURCE_PATHS}
    files.update({ASSET_PREFIX+path: output/path for path in SCENE_OUTPUTS})
    bundle_index = {"schema": "hydrogen-bundle/v1", "files": [
        {"path": path, "sha256": sha256(file)} for path, file in sorted(files.items())
    ]}
    write_json(output/"bundle-manifest.v1.json", bundle_index)
    files[ASSET_PREFIX+"bundle-manifest.v1.json"] = output/"bundle-manifest.v1.json"
    with zipfile.ZipFile(output/"hydrogen-bundle.zip", "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path, file in sorted(files.items()):
            entry = zipfile.ZipInfo(path, date_time=(1980, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, file.read_bytes())
    manifest = {
        "schema": "hydrogen-generated/v1", "dependencies": dependencies,
        "sources": [{"path": path, "sha256": sha256(ROOT/path)} for path in SOURCE_PATHS],
        "outputs": [{"path": ASSET_PREFIX+path, "sha256": sha256(output/path)} for path in OUTPUTS],
        "states": {state: data[3] for state, data in states.items()},
    }
    write_json(output/"generated.v1.json", manifest)
    return manifest


def check(output):
    manifest_path = output/"generated.v1.json"
    if not manifest_path.is_file():
        raise ValueError("Missing generated.v1.json; generate assets first")
    manifest = json.loads(manifest_path.read_text())
    if manifest.get("schema") != "hydrogen-generated/v1":
        raise ValueError("Invalid generation manifest")
    for key, expected in [("sources", SOURCE_PATHS), ("outputs", [ASSET_PREFIX+path for path in OUTPUTS])]:
        entries = manifest.get(key, [])
        if len(entries) != len(expected) or {item["path"] for item in entries} != set(expected):
            raise ValueError(f"Incomplete {key} in generation manifest")
        for item in entries:
            path = ROOT/item["path"] if key == "sources" else output/item["path"][len(ASSET_PREFIX):]
            if not path.is_file() or sha256(path) != item["sha256"]:
                raise ValueError(f"Stale {key[:-1]}: {item['path']}")
    with tempfile.TemporaryDirectory(prefix="hydrogen-check-") as directory:
        fresh = generate(Path(directory))
        if fresh != manifest:
            raise ValueError("Generated manifest differs from deterministic native USD regeneration")
    return manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, default=ASSETS)
    parser.add_argument("--check", action="store_true", help="Verify hashes, scientific acceptance and deterministic native USD exports without changing assets")
    args = parser.parse_args()
    try:
        manifest = check(args.output_dir.resolve()) if args.check else generate(args.output_dir.resolve())
    except (ValueError, OSError, RuntimeError) as error:
        print(str(error), file=sys.stderr)
        return 1
    print(("Verified" if args.check else "Generated") + " hydrogen 1s and 2p-z assets")
    for state, metric in manifest["states"].items():
        print(f"{state}: full-space {metric['full_space_probability']:.12f}; mesh {metric['mesh_probability']:.9f}; {metric['triangles']} triangles")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
