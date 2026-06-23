import Link from "next/link";
import type { MDMXDocument } from "@mdmx/next";

/** A titled list of documents (links into the editor), with an empty state. */
export function DocList({
  title,
  docs,
  empty,
}: {
  title: string;
  docs: MDMXDocument[];
  empty: string;
}) {
  return (
    <section className="mdmx-home-section">
      <h2 className="mdmx-home-section-title">
        {title} <span className="mdmx-home-count">{docs.length}</span>
      </h2>
      {docs.length === 0 ? (
        <p className="mdmx-home-empty">{empty}</p>
      ) : (
        <ul className="mdmx-home-list">
          {docs.map((doc) => {
            const hasErrors = doc.diagnostics?.some((d) => d.severity === "error");
            return (
              <li key={doc.path} className="mdmx-home-item">
                <Link href={`/edit/${doc.path}`} className="mdmx-home-link">
                  {String(doc.frontmatter.title ?? doc.slug)}
                </Link>
                <code className="mdmx-home-path">{doc.path}</code>
                {hasErrors ? <span className="mdmx-home-bad">⚠ invalid</span> : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
