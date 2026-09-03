import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  RENDERER_REVISION,
  assertRendererSpecification,
  normalizeRendererSpecification,
} from "../src/lib/renderer-contract.mjs";

const inlineSdf = `Water
  Biophysics

  1  0  0  0  0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
M  END
`;

test("the pinned renderer v1 contract accepts every supported kind and rejects divergent inputs", () => {
  assert.equal(RENDERER_REVISION, "ccdf74461699c671a9f68cf3626f0cc0a9fa108a");

  const molecule = {
    version: 1,
    kind: "molecule",
    id: "water",
    data: { format: "sdf-v2000", text: inlineSdf },
  };
  const collection = {
    version: 1,
    kind: "molecule_collection",
    id: "waters",
    items: [{ id: "water", data: molecule.data }],
    initial: "water",
  };
  const dna = {
    version: 1,
    kind: "dna_helix",
    id: "short-dna",
    basePairs: [["A", "T"], ["G", "C"]],
    geometry: { basePairsPerTurn: 10.5, risePerPair: 0.42, radius: 2.2 },
  };
  const retiredMitochondrion = {
    version: 1,
    kind: "mitochondrion",
    id: "mitochondrion-cutaway",
    geometry: {
      length: 8,
      radius: 2.25,
      membraneThickness: 0.14,
      intermembraneGap: 0.2,
      cristae: { count: 7, depth: 2.7 },
    },
  };

  assert.equal(assertRendererSpecification(molecule), molecule);
  assert.equal(assertRendererSpecification(collection), collection);
  assert.equal(assertRendererSpecification(dna), dna);
  assert.throws(
    () => assertRendererSpecification(retiredMitochondrion),
    /renderer v1 specification/i,
  );

  assert.throws(
    () => assertRendererSpecification({ ...molecule, executable: true }),
    /renderer v1 specification/i,
  );
  assert.throws(
    () => assertRendererSpecification({ ...dna, basePairs: [["A", "G"]] }),
    /renderer v1 specification/i,
  );
  assert.throws(
    () => assertRendererSpecification({ ...collection, items: [...collection.items, ...collection.items] }),
    /unique/i,
  );
  assert.throws(
    () => assertRendererSpecification({ ...collection, initial: "missing" }),
    /initial molecule/i,
  );
});

test("relative SDF assets are contained, validated, and normalized for individual and collection specifications", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "biophysics-renderer-contract-"));
  const molecules = path.join(root, "molecules");
  await mkdir(molecules);
  await writeFile(path.join(molecules, "water.sdf"), inlineSdf);

  const options = {
    concept: "water",
    conceptAssetsRoot: root,
    specificationPath: path.join(root, "water.v1.json"),
    publicOrigin: "https://encyclopedia.example",
  };
  const source = { format: "sdf-v2000", url: "molecules/water.sdf" };

  try {
    const molecule = await normalizeRendererSpecification({
      version: 1,
      kind: "molecule",
      id: "water",
      data: source,
    }, options);
    assert.equal(
      molecule.data.url,
      "https://encyclopedia.example/assets/concepts/water/molecules/water.sdf",
    );

    const collection = await normalizeRendererSpecification({
      version: 1,
      kind: "molecule_collection",
      id: "waters",
      items: [{ id: "water", data: source }],
    }, options);
    assert.equal(collection.items[0].data.url, molecule.data.url);

    await assert.rejects(
      normalizeRendererSpecification({ ...molecule, data: { ...source, url: "../secret.sdf" } }, options),
      /relative SDF path/i,
    );

    await writeFile(path.join(molecules, "broken.sdf"), "not an SDF record");
    await assert.rejects(
      normalizeRendererSpecification({
        version: 1,
        kind: "molecule",
        id: "broken",
        data: { format: "sdf-v2000", url: "molecules/broken.sdf" },
      }, options),
      /V2000 SDF/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
