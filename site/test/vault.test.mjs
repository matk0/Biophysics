import assert from "node:assert/strict";
import test from "node:test";

import {
  conceptPayload,
  loadConcepts,
  localizeConcept,
  loadMoleculeStructure,
  loadVisualization,
} from "../src/lib/vault.mjs";

const expectedSlugs = [
  "amino-acids",
  "anabolism",
  "catabolism",
  "chromosomes",
  "dna",
  "fats",
  "fatty-acids",
  "genes",
  "macronutrients",
  "melatonin",
  "micronutrients",
  "mitochondrial-magnetism",
  "photosynthesis",
  "protein-synthesis",
  "proteins",
  "serotonin",
];

test("the public catalogue exposes every concept in English and Slovak", async () => {
  const concepts = await loadConcepts();

  assert.deepEqual(concepts.map(({ slug }) => slug).sort(), expectedSlugs);

  for (const concept of concepts) {
    for (const locale of ["en", "sk"]) {
      const localized = localizeConcept(concept, locale);
      assert.equal(localized.locale, locale);
      assert.ok(localized.title.length > 0);
      assert.ok(localized.definition.length > 0);
      assert.ok(localized.body.length > 0);
      assert.ok(Array.isArray(localized.related));
      const payload = conceptPayload(localized);
      assert.deepEqual(Object.keys(payload).sort(), [
        "canonical_url",
        "definition",
        "id",
        "locale",
        "related",
        "requested_locale",
        "revision",
        "schema_version",
        "title",
        "updated_at",
        "visualizations",
      ]);
      assert.equal(payload.schema_version, 1);
      assert.match(payload.canonical_url, /^https:\/\/[^/]+\/(en|sk)\/concepts\/[a-z0-9-]+\/$/);
      assert.match(payload.updated_at, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(payload.revision, /^[a-f0-9]{64}$/);
      assert.ok(payload.related.every((related) => Object.keys(related).sort().join(",") === "id,title"));
      assert.ok(payload.visualizations.every(({ spec_url }) => spec_url.startsWith("https://")));
    }
  }
});

test("scientific visualization specifications are served from concept assets", async () => {
  const aminoAcids = await loadVisualization("amino-acids", "proteinogenic-amino-acids");
  assert.equal(aminoAcids.version, 1);
  assert.equal(aminoAcids.kind, "molecule_collection");
  assert.equal(aminoAcids.items.length, 20);
  assert.ok(aminoAcids.items.every(({ data }) => data.url.startsWith("https://")));
  assert.match(await loadMoleculeStructure("amino-acids", "alanine"), /V2000/);

  const dna = await loadVisualization("dna", "double-helix");
  assert.equal(dna.kind, "dna_helix");
  assert.equal(dna.basePairs.length, 12);
  assert.deepEqual(dna.geometry, { basePairsPerTurn: 10.5, risePerPair: 0.42, radius: 2.2 });

  await assert.rejects(
    loadVisualization("../Raw", "anything"),
    /Invalid visualization identifier/,
  );
});
