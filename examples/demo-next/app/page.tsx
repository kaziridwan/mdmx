import Link from "next/link";
import { cookies } from "next/headers";
import { getSession, privateHref, type MDMXEntry } from "@mdmx/next";
import { listEntries } from "../.mdmx/server";
import { SiteHeader } from "./site-header";
import { Badge } from "@/components/ui/badge";

// The public face of the demo: published posts for everyone; private posts
// listed too when the viewer has an MDMX session (localMode: always).
export const dynamic = "force-dynamic";

function PostRow({ doc, href, status }: { doc: MDMXEntry; href: string; status?: string }) {
  const title = typeof doc.frontmatter.title === "string" ? doc.frontmatter.title : doc.slug;
  const desc =
    typeof doc.frontmatter.description === "string" ? doc.frontmatter.description : null;
  return (
    <div className="flex items-baseline gap-3 border-b py-3.5">
      <Link href={href} className="text-lg font-semibold text-foreground no-underline hover:text-primary">
        {title}
      </Link>
      {status ? <Badge variant="secondary">{status}</Badge> : null}
      {desc ? <span className="text-sm text-muted-foreground">{desc}</span> : null}
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
      <main className="mx-auto max-w-[720px] px-10 pt-12 pb-24 font-sans">
        <h1 className="mb-6 text-3xl font-bold">Posts</h1>
        {published.map((doc) => (
          <PostRow key={doc.path} doc={doc} href={`/posts/${encodeURIComponent(doc.slug)}`} />
        ))}
        {published.length === 0 ? <p className="text-sm text-muted-foreground">Nothing published yet.</p> : null}
        {priv.length > 0 ? (
          <>
            <h2 className="mt-10 mb-4 text-2xl font-bold">Private</h2>
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
