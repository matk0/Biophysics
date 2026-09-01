import { conceptPayload, loadConcepts, localizeConcept } from "../../../../../lib/vault.mjs";

export async function getStaticPaths() {
  const concepts = await loadConcepts();
  return ["en", "sk"].flatMap((locale) => concepts.map((concept) => ({
    params: { slug: concept.slug, locale },
    props: { payload: conceptPayload(localizeConcept(concept, locale)) },
  })));
}

export function GET({ props }) {
  return new Response(JSON.stringify(props.payload), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
