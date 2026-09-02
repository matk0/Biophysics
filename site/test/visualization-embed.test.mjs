import assert from "node:assert/strict";
import test from "node:test";

import { rendererEmbed } from "../src/lib/visualization-embed.mjs";

const visualization = {
  id: "mitochondrion-cutaway",
  title: "Mitochondrion cutaway",
  spec_url: "https://biophysics-encyclopedia.pages.dev/api/v1/visualizations/mitochondria/mitochondrion-cutaway.json",
};

test("concept visualizations use the pinned same-origin renderer and local specification route", () => {
  assert.deepEqual(rendererEmbed(visualization, "en"), {
    title: "Mitochondrion cutaway",
    src: "/renderer/embed/?spec=%2Fapi%2Fv1%2Fvisualizations%2Fmitochondria%2Fmitochondrion-cutaway.json&locale=en",
  });
  assert.equal(
    rendererEmbed({ ...visualization, title: "Prierez mitochondriou" }, "sk").src,
    "/renderer/embed/?spec=%2Fapi%2Fv1%2Fvisualizations%2Fmitochondria%2Fmitochondrion-cutaway.json&locale=sk",
  );
});
