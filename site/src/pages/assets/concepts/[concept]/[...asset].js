import { loadConceptAsset, loadConceptAssetPaths } from "../../../../lib/vault.mjs";

export async function getStaticPaths() {
  return (await loadConceptAssetPaths()).map(({ concept, asset }) => ({
    params: { concept, asset },
    props: { concept, asset },
  }));
}

export async function GET({ props }) {
  const { bytes, contentType } = await loadConceptAsset(props.concept, props.asset);
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": contentType } });
}
