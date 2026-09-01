import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the static publisher pins a lockfile-compatible Node and npm toolchain", async () => {
  const nodeVersion = (await readFile(new URL("../.node-version", import.meta.url), "utf8")).trim();
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.equal(nodeVersion, "22.19.0");
  assert.equal(packageJson.engines?.node, "22.19.0");
  assert.equal(packageJson.packageManager, "npm@10.9.3");
});
