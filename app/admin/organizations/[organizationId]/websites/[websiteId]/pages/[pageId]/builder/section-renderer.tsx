import type { Section } from "@livingsites/domain";
import { getSectionType } from "@livingsites/application";

const stringProp = (props: Section["props"], key: string) => typeof props[key] === "string" ? props[key] : "";
const entries = (props: Section["props"], key: string) => Array.isArray(props[key]) ? props[key] as Record<string, unknown>[] : [];

export function RegisteredSectionRenderer({ section }: { readonly section: Section }) {
  const type = getSectionType(String(section.sectionTypeId));
  if (!type) return <section className="builder-unknown">Unsupported section type</section>;
  const props = section.props;
  switch (type.rendererKey) {
    case "hero": return <section className="preview-hero"><p className="preview-kicker">Welcome</p><h1>{stringProp(props, "headline")}</h1><p>{stringProp(props, "subheading")}</p><a href={stringProp(props, "ctaUrl") || "#"}>{stringProp(props, "ctaLabel")}</a></section>;
    case "rich-text": return <section className="preview-copy"><h2>{stringProp(props, "heading")}</h2><p>{stringProp(props, "body")}</p></section>;
    case "image": return <figure className="preview-image">{stringProp(props, "imageUrl") ? <img src={stringProp(props, "imageUrl")} alt={stringProp(props, "alt")} /> : <div className="image-placeholder">Image placeholder</div>}<figcaption>{stringProp(props, "caption")}</figcaption></figure>;
    case "services": return <section className="preview-services"><h2>{stringProp(props, "heading")}</h2><div>{entries(props, "items").map((item, index) => <article key={index}><span>0{index + 1}</span><h3>{String(item.title ?? "")}</h3><p>{String(item.description ?? "")}</p></article>)}</div></section>;
    case "gallery": return <section className="preview-gallery"><h2>{stringProp(props, "heading")}</h2><div>{entries(props, "images").map((image, index) => String(image.imageUrl ?? "") ? <img key={index} src={String(image.imageUrl)} alt={String(image.alt ?? "")} /> : <div className="image-placeholder" key={index}>Image {index + 1}</div>)}</div></section>;
    case "cta": return <section className="preview-cta"><h2>{stringProp(props, "heading")}</h2><p>{stringProp(props, "body")}</p><a href={stringProp(props, "url") || "#"}>{stringProp(props, "buttonLabel")}</a></section>;
    default: return <section className="builder-unknown">Unsupported section type</section>;
  }
}
