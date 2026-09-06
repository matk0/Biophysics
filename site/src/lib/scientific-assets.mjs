import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

export const MAX_PUBLISHED_ASSET_BYTES = 25 * 1024 * 1024;
export const ASSET_CONTENT_TYPES = {
  ".json": "application/json; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".usda": "model/vnd.usda; charset=utf-8",
  ".usd": "model/vnd.usd",
  ".usdc": "model/vnd.usdc",
  ".zip": "application/zip",
};

export function containedPath(root, target) {
  const relative = path.relative(root, target);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export function assertRelativeAssetPath(value) {
  if (typeof value !== "string" || !value.split("/").every((part) => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(part))) {
    throw new Error(`Assets must use contained relative paths: ${String(value)}`);
  }
  return value;
}

export function declaredAssetReference(concept, assetPath) {
  assertRelativeAssetPath(assetPath);
  const prefix = `Assets/concepts/${concept}/`;
  if (!assetPath.startsWith(prefix)) throw new Error("Published assets must stay within their concept assets");
  const asset = assetPath.slice(prefix.length);
  if (!ASSET_CONTENT_TYPES[path.extname(asset)]) throw new Error(`Unsupported published asset: ${assetPath}`);
  return { concept, asset, publicPath: `/assets/concepts/${concept}/${asset}` };
}

export async function readContainedAsset(vaultRoot, relativePath, containmentRoot = vaultRoot) {
  assertRelativeAssetPath(relativePath);
  const target = path.resolve(vaultRoot, relativePath);
  if (!containedPath(containmentRoot, target)) throw new Error(`Asset is outside its concept assets: ${relativePath}`);
  let resolved;
  try {
    resolved = await realpath(target);
  } catch (error) {
    if (error.code === "ENOENT") throw new Error(`Missing generated asset or source: ${relativePath}`);
    throw error;
  }
  if (!containedPath(await realpath(containmentRoot), resolved)) {
    throw new Error(`Asset is outside its concept assets: ${relativePath}`);
  }
  const info = await stat(resolved);
  if (!info.isFile() || info.size > MAX_PUBLISHED_ASSET_BYTES) throw new Error(`Invalid or oversized asset: ${relativePath}`);
  return readFile(resolved);
}

export async function verifyGeneratedAssets({ vaultRoot, concept, manifestPath }) {
  declaredAssetReference(concept, manifestPath);
  const conceptRoot = path.resolve(vaultRoot, "Assets", "concepts", concept);
  const manifest = JSON.parse(await readContainedAsset(vaultRoot, manifestPath, conceptRoot));
  if (manifest.schema !== `${concept}-generated/v1`
    || !Array.isArray(manifest.sources) || manifest.sources.length === 0
    || !Array.isArray(manifest.outputs) || manifest.outputs.length === 0) {
    throw new Error(`Invalid generated asset manifest: ${manifestPath}`);
  }
  const seen = new Set();
  for (const [kind, records] of [["sources", manifest.sources], ["outputs", manifest.outputs]]) {
    for (const record of records) {
      if (!record || !/^[a-f0-9]{64}$/.test(record.sha256) || seen.has(record.path)) {
        throw new Error(`Invalid or duplicate generated asset record: ${manifestPath}`);
      }
      seen.add(record.path);
      const bytes = await readContainedAsset(vaultRoot, record.path, kind === "outputs" ? conceptRoot : vaultRoot);
      if (createHash("sha256").update(bytes).digest("hex") !== record.sha256) {
        throw new Error(`Stale generated asset or source: ${record.path}; regenerate the scientific assets`);
      }
    }
  }
  return manifest;
}

export function assertEmbeddedGlb(bytes) {
  if (bytes.length < 28 || bytes.length > 8 * 1024 * 1024
    || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2
    || bytes.readUInt32LE(8) !== bytes.length || bytes.readUInt32LE(16) !== 0x4e4f534a) {
    throw new Error("Invalid or oversized GLB 2 scene");
  }
  const jsonLength = bytes.readUInt32LE(12);
  const binaryStart = 20 + jsonLength;
  if (jsonLength % 4 !== 0 || binaryStart + 8 > bytes.length
    || bytes.readUInt32LE(binaryStart + 4) !== 0x004e4942
    || bytes.readUInt32LE(binaryStart) % 4 !== 0
    || binaryStart + 8 + bytes.readUInt32LE(binaryStart) !== bytes.length) {
    throw new Error("GLB scene must contain one JSON chunk and one embedded BIN chunk");
  }
  const document = JSON.parse(bytes.subarray(20, binaryStart).toString("utf8"));
  if (document.asset?.version !== "2.0" || document.buffers?.length !== 1
    || document.buffers[0].uri !== undefined
    || !Number.isInteger(document.buffers[0].byteLength)
    || document.buffers[0].byteLength < 1
    || document.buffers[0].byteLength > bytes.readUInt32LE(binaryStart)
    || bytes.readUInt32LE(binaryStart) - document.buffers[0].byteLength > 3
    || [document.images, document.textures, document.skins, document.animations, document.extensionsUsed, document.extensionsRequired].some((value) => value?.length)) {
    throw new Error("GLB scene must use a single embedded buffer without external or active resources");
  }
  return bytes;
}
