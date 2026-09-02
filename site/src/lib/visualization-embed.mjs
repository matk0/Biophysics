const LOCALES = new Set(["en", "sk"]);

export function rendererEmbed(visualization, locale) {
  if (!LOCALES.has(locale)) throw new Error(`Unsupported locale: ${locale}`);
  const specification = new URL(visualization.spec_url);
  const query = new URLSearchParams({ spec: specification.pathname, locale });
  if (visualization.selected) query.set("selected", visualization.selected);
  return {
    title: visualization.title,
    src: `/renderer/embed/?${query}`,
  };
}
