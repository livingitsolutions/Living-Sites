import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getComposition } from "@/app/lib/composition";
import { RegisteredSectionRenderer } from "@/app/components/registered-section-renderer";

export const dynamic = "force-dynamic";

export default async function PublicWebsitePage({ params }: { readonly params: Promise<{ path?: string[] }> }) {
  const [{ path = [] }, requestHeaders] = await Promise.all([params, headers()]);
  const hostname = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const composition = getComposition();
  const result = await composition.runWithTenantContext({ mode: "public" }, () => composition.resolvePublishedPage(
    { hostname, path: path.length ? `/${path.join("/")}` : "/" },
    { websiteReader: composition.websiteRepository, pageReader: composition.pageRepository, pageSnapshotReader: composition.pageSnapshotReader },
  ));
  if (!result.ok) notFound();
  const { website, snapshot } = result.value;
  return <main className="public-site" data-website={String(website.id)}><header className="public-masthead"><a href="/">{website.name}</a></header><article>{snapshot.sections.map((section) => <RegisteredSectionRenderer key={String(section.sectionId)} section={section} />)}</article></main>;
}
