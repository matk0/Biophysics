import { loadMoleculeStructure, loadVisualization } from "../../../../../lib/vault.mjs";

export async function getStaticPaths() {
  const specification = await loadVisualization("amino-acids", "proteinogenic-amino-acids");
  return specification.items.map(({ id }) => ({
    params: { concept: "amino-acids", molecule: id },
    props: { concept: "amino-acids", molecule: id },
  }));
}

export async function GET({ props }) {
  return new Response(await loadMoleculeStructure(props.concept, props.molecule), {
    headers: { "Content-Type": "chemical/x-mdl-sdfile; charset=utf-8" },
  });
}
