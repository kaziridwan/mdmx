import Link from "next/link";
import { cookies } from "next/headers";
import { getSession, privateHref, type MDMXEntry } from "@mdmx/next";
import { listEntries } from "../.mdmx/server";
import { SiteHeader } from "./site-header";

// The public face of the demo: published posts for everyone; private posts
// listed too when the viewer has an MDMX session (localMode: always).
export const dynamic = "force-dynamic";

function PostRow({ doc, href, status }: { doc: MDMXEntry; href: string; status?: string }) {
  const title = typeof doc.frontmatter.title === "string" ? doc.frontmatter.title : doc.slug;
  const desc =
    typeof doc.frontmatter.description === "string" ? doc.frontmatter.description : null;
  return (
    <div className="site-list-item">
      <Link href={href}>{title}</Link>
      {status ? (
        <span className="site-badge" data-status={status}>
          {status}
        </span>
      ) : null}
      {desc ? <span className="site-list-desc">{desc}</span> : null}
    </div>
  );
}

export default async function Home() {
  const published = await listEntries("posts");
  const session = getSession((await cookies()).toString(), { localMode: true });
  const priv = session ? await listEntries("posts", { status: "private" }) : [];

  return (
    <>
      <SiteHeader />
      <main className="site-list">
        <h1>Posts</h1>
        {published.map((doc) => (
          <PostRow key={doc.path} doc={doc} href={`/posts/${encodeURIComponent(doc.slug)}`} />
        ))}
        {published.length === 0 ? <p className="site-list-desc">Nothing published yet.</p> : null}
        {priv.length > 0 ? (
          <>
            <h2>Private</h2>
            {priv.map((doc) => (
              <PostRow
                key={doc.path}
                doc={doc}
                href={privateHref("posts", doc.slug)}
                status="private"
              />
            ))}
          </>
        ) : null}
      </main>
    </>
  );
}
