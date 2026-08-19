import type { Section } from "@livingsites/domain";
import { RegisteredSectionRenderer as SharedSectionRenderer } from "../../../../../../../../components/registered-section-renderer";

export function RegisteredSectionRenderer({ section }: { readonly section: Section }) {
  return <SharedSectionRenderer section={{ sectionTypeId: String(section.sectionTypeId), props: section.props }} unknownFallback={<section className="builder-unknown">Unsupported section type</section>} />;
}
