import { createHash } from "node:crypto";
import { readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

import {
  assertSdfV2000,
  moleculeSources,
  normalizeRendererSpecification,
} from "./renderer-contract.mjs";

const VAULT_ROOT = path.resolve(process.env.BIOPHYSICS_VAULT_ROOT ?? path.join(process.cwd(), ".."));
const CONCEPTS_ROOT = path.join(VAULT_ROOT, "Concepts");
const ASSETS_ROOT = path.join(VAULT_ROOT, "Assets", "concepts");
const LOCALES = { en: "English", sk: "Slovenčina" };
const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_PUBLIC_SITE_ORIGIN = "https://biophysics-encyclopedia.pages.dev";

function publicSiteOrigin() {
  const origin = new URL(process.env.PUBLIC_SITE_ORIGIN ?? DEFAULT_PUBLIC_SITE_ORIGIN);
  if (
    origin.protocol !== "https:"
    || origin.username
    || origin.password
    || origin.pathname !== "/"
    || origin.search
    || origin.hash
  ) {
    throw new Error("PUBLIC_SITE_ORIGIN must be an HTTPS origin without credentials or a path");
  }
  return origin.origin;
}

function section(markdown, heading) {
  const pattern = new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, "m");
  return markdown.match(pattern)?.[1]?.trim() ?? "";
}

function conceptLinks(markdown, locale) {
  const related = [];
  const links = /\[\[Concepts\/([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g;
  for (const match of markdown.matchAll(links)) {
    related.push({
      id: match[1],
      title: match[2] || match[1],
    });
  }
  return [...new Map(related.map((item) => [item.id, item])).values()];
}

function renderMarkdown(markdown, locale) {
  const withLinks = markdown.replace(
    /\[\[Concepts\/([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g,
    (_, slug, label) => `[${label || slug}](/${locale}/concepts/${slug}/)`,
  );
  return sanitizeHtml(marked.parse(withLinks), {
    allowedTags: [
      "p", "a", "em", "strong", "ul", "ol", "li", "blockquote",
      "code", "pre", "hr", "br", "h3", "h4", "h5", "h6", "del",
      "sub", "sup",
    ],
    allowedAttributes: {
      a: ["href", "title"],
      ol: ["start"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
  });
}

function plainText(markdown) {
  const paragraph = markdown.split(/\n\s*\n/, 1)[0] ?? "";
  return paragraph
    .replace(/\[\[Concepts\/[^\]|]+\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[Concepts\/([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function validateConcept(slug, data, content) {
  const required = ["title", "type", "created", "updated", "sources", "tags", "primary_branch", "branches"];
  for (const key of required) {
    if (!(key in data)) throw new Error(`${slug} is missing frontmatter field ${key}`);
  }
  if (data.type !== "concept") throw new Error(`${slug} is not a concept`);
  for (const heading of Object.values(LOCALES)) {
    if (!section(content, heading)) throw new Error(`${slug} is missing ${heading}`);
  }
}

export async function loadConcepts() {
  const filenames = (await readdir(CONCEPTS_ROOT)).filter((name) => name.endsWith(".md")).sort();
  return Promise.all(filenames.map(async (filename) => {
    const slug = filename.slice(0, -3);
    const parsed = matter(await readFile(path.join(CONCEPTS_ROOT, filename), "utf8"));
    validateConcept(slug, parsed.data, parsed.content);
    return { slug, data: parsed.data, content: parsed.content };
  }));
}

export function localizeConcept(concept, locale) {
  if (!(locale in LOCALES)) throw new Error(`Unsupported locale: ${locale}`);
  const markdown = section(concept.content, LOCALES[locale]);
  const origin = publicSiteOrigin();
  return {
    schema_version: 1,
    id: concept.slug,
    requested_locale: locale,
    locale,
    title: locale === "sk" ? concept.data.localized_titles?.sk : concept.data.title,
    definition: plainText(markdown),
    canonical_url: `${origin}/${locale}/concepts/${concept.slug}/`,
    updated_at: dateString(concept.data.updated),
    revision: createHash("sha256")
      .update(JSON.stringify(concept.data))
      .update("\0")
      .update(concept.content)
      .digest("hex"),
    body: renderMarkdown(markdown, locale),
    related: conceptLinks(markdown, locale),
    visualizations: (concept.data.visualizations ?? []).map(({ id, titles, selected }) => ({
      id,
      title: titles?.[locale] ?? titles?.en ?? id,
      spec_url: `${origin}/api/v1/visualizations/${concept.slug}/${id}.json`,
      ...(selected ? { selected } : {}),
    })),
  };
}

export function conceptPayload(localizedConcept) {
  const { body: _body, ...payload } = localizedConcept;
  return payload;
}

export async function loadVisualization(concept, id) {
  if (!SAFE_ID.test(concept) || !SAFE_ID.test(id)) {
    throw new Error("Invalid visualization identifier");
  }

  const concepts = await loadConcepts();
  const conceptPage = concepts.find(({ slug }) => slug === concept);
  const entry = conceptPage?.data.visualizations?.find((item) => item.id === id);
  if (!entry) throw new Error(`Unknown visualization: ${concept}/${id}`);

  const specificationPath = path.resolve(VAULT_ROOT, entry.specification);
  const conceptAssetsRoot = path.resolve(ASSETS_ROOT, concept);
  if (!containedPath(conceptAssetsRoot, specificationPath)) {
    throw new Error("Visualization specification must stay within Assets/concepts");
  }
  const [realConceptAssetsRoot, realSpecificationPath] = await Promise.all([
    realpath(conceptAssetsRoot),
    realpath(specificationPath),
  ]);
  if (!containedPath(realConceptAssetsRoot, realSpecificationPath)) {
    throw new Error("Visualization specification must stay within Assets/concepts");
  }

  const specification = JSON.parse(await readFile(realSpecificationPath, "utf8"));
  if (specification.version !== 1 || specification.id !== id) {
    throw new Error(`Visualization identity mismatch: ${concept}/${id}`);
  }

  const normalized = await normalizeRendererSpecification(specification, {
    concept,
    conceptAssetsRoot: realConceptAssetsRoot,
    specificationPath: realSpecificationPath,
    publicOrigin: publicSiteOrigin(),
  });
  for (const source of moleculeSources(normalized)) {
    if (source.url !== undefined) publicStructureReference(concept, source.url);
  }
  return normalized;
}

export async function loadMoleculeStructure(concept, molecule) {
  if (!SAFE_ID.test(concept) || !SAFE_ID.test(molecule)) {
    throw new Error("Invalid molecule identifier");
  }

  const structures = await loadMoleculeStructurePaths();
  if (!structures.some((entry) => entry.concept === concept && entry.molecule === molecule)) {
    throw new Error(`Unknown molecule: ${concept}/${molecule}`);
  }

  const structurePath = path.resolve(
    ASSETS_ROOT,
    concept,
    "molecules",
    `${molecule}.sdf`,
  );
  const conceptAssetsRoot = path.resolve(ASSETS_ROOT, concept);
  if (!containedPath(conceptAssetsRoot, structurePath)) {
    throw new Error("Molecule structure must stay within Assets/concepts");
  }
  const [realConceptAssetsRoot, realStructurePath] = await Promise.all([
    realpath(conceptAssetsRoot),
    realpath(structurePath),
  ]);
  if (!containedPath(realConceptAssetsRoot, realStructurePath)) {
    throw new Error("Molecule structure must stay within Assets/concepts");
  }
  return assertSdfV2000(await readFile(realStructurePath, "utf8"));
}

export async function loadMoleculeStructurePaths() {
  const concepts = await loadConcepts();
  const structures = new Map();

  for (const concept of concepts) {
    for (const { id } of concept.data.visualizations ?? []) {
      const specification = await loadVisualization(concept.slug, id);
      for (const source of moleculeSources(specification)) {
        if (source.url === undefined) continue;
        const reference = publicStructureReference(concept.slug, source.url);
        structures.set(`${reference.concept}/${reference.molecule}`, reference);
      }
    }
  }

  return [...structures.values()].sort((left, right) => (
    `${left.concept}/${left.molecule}`.localeCompare(`${right.concept}/${right.molecule}`)
  ));
}

function dateString(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  throw new Error(`Invalid updated date: ${String(value)}`);
}

function publicStructureReference(concept, sourceUrl) {
  const url = new URL(sourceUrl);
  const prefix = `/assets/concepts/${encodeURIComponent(concept)}/molecules/`;
  if (url.origin !== publicSiteOrigin() || url.search || url.hash || !url.pathname.startsWith(prefix)) {
    throw new Error(`Molecule URL cannot be published by this site: ${sourceUrl}`);
  }
  const filename = url.pathname.slice(prefix.length);
  const match = filename.match(/^([a-z0-9]+(?:-[a-z0-9]+)*)\.sdf$/);
  if (!match) throw new Error(`Molecule URL cannot be published by this site: ${sourceUrl}`);
  return { concept, molecule: match[1] };
}

function containedPath(root, target) {
  const relative = path.relative(root, target);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
