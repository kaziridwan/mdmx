import { notFound } from "next/navigation";
import { getDocumentBySlug, getStudioComponentDefs } from "@mdmx/next";
import { MDMXContent, studioRenderComponents } from "@mdmx/next/render";
import { serverComponents } from "../../../lib/components-server";
import { SiteHeader } from "../../site-header";
import { StudioTailwindRuntime } from "../../studio-runtime";

// Published posts only: drafts and private entries 404 here (private ones
// live under /private/posts/[slug], behind the session guard).
export const dynamic = "force-dynamic";

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = await getDocumentBySlug("content/posts", decodeURIComponent(slug), {
    status: "published",
  });
  if (!doc) notFound();

  const studioDefs = await getStudioComponentDefs("content");
  const components = { ...serverComponents, ...studioRenderComponents(studioDefs) };
  const usesStudio = studioDefs.some((def) => doc.source.includes(`<${def.name}`));

  return (
    <>
      <StudioTailwindRuntime enabled={usesStudio} />
      <SiteHeader />
      <article className="mdmx-page">
        <MDMXContent source={doc.source} components={components} />
      </article>
    </>
  );
}
