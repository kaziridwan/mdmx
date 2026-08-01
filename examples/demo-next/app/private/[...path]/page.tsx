import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getEntryBySlug, getSession } from "@mdmx/next";
import { MDMXContent } from "@mdmx/next/render";
import { renderComponents } from "../../../.mdmx/server";
import { SiteHeader } from "../../site-header";

// /private/<collection path>/<slug> — entries with status "private", visible
// only to an authenticated MDMX session (ADR: road-to-0.4.1). This demo runs
// local mode, so the synthetic session always passes; in GitHub mode the
// sealed OAuth cookie is required and everyone else is sent to /mdmx.
//
// A Layer-2 page: the collection directory comes from the URL rather than a
// collection name, so it calls the reader itself — but the component map
// (author components + studio components) still comes from codegen.
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

  const entry = await getEntryBySlug(collectionDir, slug, { status: "private" });
  if (!entry) notFound();

  return (
    <>
      <SiteHeader />
      <article className="mdmx-page">
        <span className="site-badge" data-status="private">
          private
        </span>
        <MDMXContent source={entry.source} components={await renderComponents()} />
      </article>
    </>
  );
}
