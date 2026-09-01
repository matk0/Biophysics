import { loadConcepts, loadVisualization } from "../../../../../lib/vault.mjs";

export async function getStaticPaths() {
  const concepts = await loadConcepts();
  return concepts.flatMap((concept) => (concept.data.visualizations ?? []).map(({ id }) => ({
    params: { concept: concept.slug, id },
    props: { concept: concept.slug, id },
  })));
}

export async function GET({ props }) {
  const payload = await loadVisualization(props.concept, props.id);
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
