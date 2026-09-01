import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Cloudflare Pages applies a defensive policy to every static response", async () => {
  const headers = await readFile(new URL("../public/_headers", import.meta.url), "utf8");

  assert.match(headers, /^\/\*$/m);
  assert.match(headers, /Content-Security-Policy: default-src 'none';/);
  assert.match(headers, /script-src 'none'/);
  assert.match(headers, /style-src 'self' 'unsafe-inline'/);
  assert.match(headers, /object-src 'none'/);
  assert.match(headers, /base-uri 'none'/);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /Referrer-Policy: no-referrer/);
});
