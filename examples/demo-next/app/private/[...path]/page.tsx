import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getDocumentBySlug, getSession, getStudioComponentDefs } from "@mdmx/next";
import { MDMXContent, studioRenderComponents } from "@mdmx/next/render";
import { serverComponents } from "../../../lib/components-server";
import { SiteHeader } from "../../site-header";
import { StudioTailwindRuntime } from "../../studio-runtime";

// /private/<collection path>/<slug> — entries with status "private", visible
// only to an authenticated MDMX session (ADR: road-to-0.4.1). This demo runs
// localMode, so the synthetic local session always passes; in GitHub mode the
// sealed OAuth cookie is required and everyone else is sent to the login at
// /mdmx. Anything that isn't private 404s: each status has exactly one home.
export const dynamic = "force-dynamic";

export default async function PrivatePostPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const session = getSession((await cookies()).toString(), { localMode: true });
  if (!session) redirect("/mdmx");

  const segments = (await params).path.map(decodeURIComponent);
  if (segments.length < 2) notFound();
  const slug = segments[segments.length - 1]!;
  const collectionDir = ["content", ...segments.slice(0, -1)].join("/");

  const doc = await getDocumentBySlug(collectionDir, slug, { status: "private" });
  if (!doc) notFound();

  const studioDefs = await getStudioComponentDefs("content");
  const components = { ...serverComponents, ...studioRenderComponents(studioDefs) };
  const usesStudio = studioDefs.some((def) => doc.source.includes(`<${def.name}`));

  return (
    <>
      <StudioTailwindRuntime enabled={usesStudio} />
      <SiteHeader />
      <article className="mdmx-page">
        <span className="site-badge" data-status="private">
          private
        </span>
        <MDMXContent source={doc.source} components={components} />
      </article>
    </>
  );
}
