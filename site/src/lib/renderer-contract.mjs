import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";
import schema from "../schemas/biophysics-renderer-v1.schema.json" with { type: "json" };

export const RENDERER_REVISION = "424c31b97f38158b317f8bea95480b4f0d6f5e79";
export const MAX_SPECIFICATION_BYTES = 1_000_000;
export const MAX_SDF_BYTES = 1_000_000;
export const MAX_SDF_ATOMS = 1_024;
export const MAX_SDF_BONDS = 2_048;

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateSpecification = ajv.compile(schema);

export function assertRendererSpecification(specification) {
  let serialized;
  try {
    serialized = JSON.stringify(specification);
  } catch {
    throw new Error("Invalid renderer v1 specification: value must be JSON serializable");
  }
  if (serialized === undefined) {
    throw new Error("Invalid renderer v1 specification: value must be JSON serializable");
  }
  if (new TextEncoder().encode(serialized).byteLength > MAX_SPECIFICATION_BYTES) {
    throw new Error(`Invalid renderer v1 specification: exceeds ${MAX_SPECIFICATION_BYTES} bytes`);
  }
  if (!validateSpecification(specification)) {
    throw new Error(`Invalid renderer v1 specification: ${ajv.errorsText(validateSpecification.errors)}`);
  }

  assertRendererStringLengths(specification);
  if (specification.kind === "molecule_collection") {
    const identifiers = specification.items.map(({ id }) => id);
    if (new Set(identifiers).size !== identifiers.length) {
      throw new Error("Molecule collection item ids must be unique");
    }
    if (specification.initial !== undefined && !identifiers.includes(specification.initial)) {
      throw new Error(`Initial molecule does not exist: ${specification.initial}`);
    }
  }

  return specification;
}

function assertRendererStringLengths(specification) {
  for (const localized of localizedValues(specification)) {
    const translations = typeof localized === "string" ? [localized] : Object.values(localized);
    if (translations.some((value) => value.length === 0 || value.length > 256)) {
      throw new Error("Invalid renderer v1 specification: localized text has an invalid length");
    }
  }
  for (const source of moleculeSources(specification)) {
    if (source.url !== undefined && (source.url.length === 0 || source.url.length > 2_048)) {
      throw new Error("Invalid renderer v1 specification: molecule data URL has an invalid length");
    }
    if (source.text !== undefined && new TextEncoder().encode(source.text).byteLength > 1_000_000) {
      throw new Error("Invalid renderer v1 specification: inline SDF exceeds 1000000 bytes");
    }
  }
}

function localizedValues(specification) {
  const values = [specification.label, specification.accessibilityLabel];
  if (specification.kind === "molecule_collection") {
    values.push(...specification.items.map(({ label }) => label));
  }
  return values.filter((value) => value !== undefined);
}

export function moleculeSources(specification) {
  if (specification.kind === "molecule") return [specification.data];
  if (specification.kind === "molecule_collection") return specification.items.map(({ data }) => data);
  return [];
}

export async function normalizeRendererSpecification(specification, options) {
  assertRendererSpecification(specification);
  const context = await assetContext(options);
  let normalized;

  if (specification.kind === "molecule") {
    normalized = {
      ...specification,
      data: await normalizeSdfSource(specification.data, context),
    };
  } else if (specification.kind === "molecule_collection") {
    normalized = {
      ...specification,
      items: await Promise.all(specification.items.map(async (item) => ({
        ...item,
        data: await normalizeSdfSource(item.data, context),
      }))),
    };
  } else {
    normalized = specification;
  }

  assertRendererSpecification(normalized);
  return normalized;
}

export function assertSdfV2000(source) {
  if (typeof source !== "string" || new TextEncoder().encode(source).byteLength > MAX_SDF_BYTES) {
    invalidSdf();
  }
  const lines = source.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  if (lines.some((line) => line.length > 512)) invalidSdf();
  const countsIndex = lines.findIndex((line) => line.includes("V2000"));
  if (countsIndex < 0 || !lines.slice(countsIndex + 1).some((line) => line.trim() === "M  END")) {
    invalidSdf();
  }

  const counts = lines[countsIndex].trim().split(/\s+/);
  const atomCount = sdfInteger(counts[0]);
  const bondCount = sdfInteger(counts[1]);
  if (atomCount < 1 || atomCount > MAX_SDF_ATOMS || bondCount < 0 || bondCount > MAX_SDF_BONDS) {
    invalidSdf();
  }

  const atomLines = lines.slice(countsIndex + 1, countsIndex + 1 + atomCount);
  const bondLines = lines.slice(countsIndex + 1 + atomCount, countsIndex + 1 + atomCount + bondCount);
  if (atomLines.length !== atomCount || bondLines.length !== bondCount) invalidSdf();

  for (const line of atomLines) {
    const fields = line.trim().split(/\s+/);
    const position = fields.slice(0, 3).map(Number);
    const element = fields[3];
    if (
      position.length !== 3
      || position.some((value) => !Number.isFinite(value) || Math.abs(value) > 1_000_000)
      || !element
      || !/^[A-Z][a-z]?$/.test(element)
    ) {
      invalidSdf();
    }
  }

  for (const line of bondLines) {
    const fields = line.trim().split(/\s+/);
    const from = sdfInteger(fields[0]) - 1;
    const to = sdfInteger(fields[1]) - 1;
    const order = sdfInteger(fields[2]);
    if (
      from < 0
      || to < 0
      || from >= atomCount
      || to >= atomCount
      || from === to
      || ![1, 2, 3].includes(order)
    ) {
      invalidSdf();
    }
  }

  return source;
}

async function assetContext({ concept, conceptAssetsRoot, specificationPath, publicOrigin }) {
  if (typeof concept !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(concept)) {
    throw new Error("Invalid concept identifier");
  }
  const root = path.resolve(conceptAssetsRoot);
  const specification = path.resolve(specificationPath);
  if (!containedPath(root, specification)) {
    throw new Error("Visualization specification must stay within its concept assets");
  }
  const origin = new URL(publicOrigin);
  if (
    origin.protocol !== "https:"
    || origin.username
    || origin.password
    || origin.pathname !== "/"
    || origin.search
    || origin.hash
  ) {
    throw new Error("Public site origin must be an HTTPS origin without credentials or a path");
  }
  return {
    concept,
    root,
    realRoot: await realpath(root),
    specification,
    origin: origin.origin,
  };
}

async function normalizeSdfSource(source, context) {
  if (source.text !== undefined) {
    assertSdfV2000(source.text);
    return source;
  }

  const segments = source.url.split("/");
  if (
    segments.length === 0
    || !source.url.endsWith(".sdf")
    || segments.some((segment) => !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(segment))
  ) {
    throw new Error(`Molecule data must use a contained relative SDF path: ${source.url}`);
  }
  const target = path.resolve(path.dirname(context.specification), ...segments);
  if (!containedPath(context.root, target)) {
    throw new Error(`Molecule data must use a contained relative SDF path: ${source.url}`);
  }
  const realTarget = await realpath(target);
  if (!containedPath(context.realRoot, realTarget)) {
    throw new Error(`Molecule data must use a contained relative SDF path: ${source.url}`);
  }
  assertSdfV2000(await readFile(realTarget, "utf8"));

  const publicPath = path.relative(context.root, target)
    .split(path.sep)
    .map(encodeURIComponent)
    .join("/");
  return {
    ...source,
    url: `${context.origin}/assets/concepts/${encodeURIComponent(context.concept)}/${publicPath}`,
  };
}

function containedPath(root, target) {
  const relative = path.relative(root, target);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function sdfInteger(value) {
  if (!value || !/^\d+$/.test(value)) invalidSdf();
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed)) invalidSdf();
  return parsed;
}

function invalidSdf() {
  throw new Error("Unsupported or invalid V2000 SDF record");
}
