import { MDMXEntry } from "../../../.mdmx/server";
import { SiteHeader } from "../../site-header";

// Published posts only: drafts and private entries 404 here (private ones
// live under /private/posts/[slug], behind the session guard).
export const dynamic = "force-dynamic";

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <>
      <SiteHeader />
      <article className="mdmx-page">
        <MDMXEntry collection="posts" slug={slug} />
      </article>
    </>
  );
}
