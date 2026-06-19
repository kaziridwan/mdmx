import Link from "next/link";
import { join } from "node:path";
import { getDocuments, type IMDXDocument } from "@imdx/next";
import { CONTENT_DIR, projectRoot, registry } from "../lib/imdx-config";

// Always read the working tree fresh (saves change it).
export const dynamic = "force-dynamic";

export default async function Home() {
  const docs = await getDocuments(join(projectRoot(), CONTENT_DIR), {
    registry: registry(),
  });

  const published = docs.filter((d) => d.frontmatter.status === "published");
  const drafts = docs.filter((d) => d.frontmatter.status !== "published");

  return (
    <main className="imdx-home">
      <h1>iMDX — local CMS</h1>
      <p>
        Your React components are first-class editor blocks. Edits save as
        canonical iMDX into <code>{CONTENT_DIR}/</code> in this repo — no GitHub,
        no database. Open a post and use the document panel to set its status.
      </p>

      <Section title="Published" docs={published} empty="Nothing published yet." />
      <Section title="Drafts" docs={drafts} empty="No drafts." />
    </main>
  );
}

function Section({ title, docs, empty }: { title: string; docs: IMDXDocument[]; empty: string }) {
  return (
    <section className="imdx-home-section">
      <h2 className="imdx-home-section-title">
        {title} <span className="imdx-home-count">{docs.length}</span>
      </h2>
      {docs.length === 0 ? (
        <p className="imdx-home-empty">{empty}</p>
      ) : (
        <ul className="imdx-home-list">
          {docs.map((doc) => {
            const hasErrors = doc.diagnostics?.some((d) => d.severity === "error");
            return (
              <li key={doc.path} className="imdx-home-item">
                <Link href={`/edit/${doc.path}`} className="imdx-home-link">
                  {String(doc.frontmatter.title ?? doc.slug)}
                </Link>
                <code className="imdx-home-path">{doc.path}</code>
                {hasErrors ? <span className="imdx-home-bad">⚠ invalid</span> : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
