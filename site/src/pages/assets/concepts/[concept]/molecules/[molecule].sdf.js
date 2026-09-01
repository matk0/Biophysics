import { loadMoleculeStructure, loadMoleculeStructurePaths } from "../../../../../lib/vault.mjs";

export async function getStaticPaths() {
  return (await loadMoleculeStructurePaths()).map(({ concept, molecule }) => ({
    params: { concept, molecule },
    props: { concept, molecule },
  }));
}

export async function GET({ props }) {
  return new Response(await loadMoleculeStructure(props.concept, props.molecule), {
    headers: { "Content-Type": "chemical/x-mdl-sdfile; charset=utf-8" },
  });
}
