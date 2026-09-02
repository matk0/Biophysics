import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import { RENDERER_REVISION } from "../src/lib/renderer-contract.mjs";

test("the encyclopedia serves the exact pinned renderer build", async () => {
  const publicRoot = new URL("../public/renderer/", import.meta.url);
  const revision = (await readFile(new URL("REVISION", publicRoot), "utf8")).trim();
  const html = await readFile(new URL("embed/index.html", publicRoot), "utf8");

  assert.equal(revision, RENDERER_REVISION);
  const assets = [...html.matchAll(/(?:src|href)="\.\.\/assets\/([^"]+)"/g)].map((match) => match[1]);
  assert.equal(assets.length, 2);
  await Promise.all(assets.map((asset) => access(new URL(`assets/${asset}`, publicRoot))));
});
