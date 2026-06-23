import Link from "next/link";
import { join } from "node:path";
import { getDocuments, type MDMXDocument } from "@mdmx/next";
import type { CollectionSpec } from "@mdmx/core";
import { CmsHeader } from "../components/CmsHeader";
import { CONTENT_DIR, projectRoot, registry } from "../lib/mdmx-config";

// Always read the working tree fresh (saves change it).
export const dynamic = "force-dynamic";

export default async function Home() {
  const reg = registry();
  const docs = await getDocuments(join(projectRoot(), CONTENT_DIR), { registry: reg });

  // Group every document under the collection that owns its path.
  const byCollection = new Map<string, MDMXDocument[]>();
  for (const doc of docs) {
    const collection = reg.collectionForPath(`${CONTENT_DIR}/${doc.path}`);
    if (!collection) continue;
    const list = byCollection.get(collection.name) ?? [];
    list.push(doc);
    byCollection.set(collection.name, list);
  }

  return (
    <main className="mdmx-home">
      <CmsHeader />
      <h1>MDMX — local CMS</h1>
      <p>
        Your React components are first-class editor blocks. Content is organized
        into <strong>collections</strong> — typed groupings whose entries save as
        canonical MDMX into <code>{CONTENT_DIR}/</code> in this repo. Pick a
        collection to browse or add posts.
      </p>

      {reg.collections.length === 0 ? (
        <p className="mdmx-home-empty">No collections configured.</p>
      ) : (
        <ul className="mdmx-collection-grid">
          {reg.collections.map((collection) => (
            <CollectionCard
              key={collection.name}
              collection={collection}
              docs={byCollection.get(collection.name) ?? []}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

function CollectionCard({
  collection,
  docs,
}: {
  collection: CollectionSpec;
  docs: MDMXDocument[];
}) {
  const published = docs.filter((d) => d.frontmatter.status === "published").length;
  return (
    <li>
      <Link href={`/collections/${collection.name}`} className="mdmx-collection-card">
        <span className="mdmx-collection-name">{collection.name}</span>
        <span className="mdmx-collection-meta">
          {docs.length} {docs.length === 1 ? "entry" : "entries"}
          {published > 0 ? ` · ${published} published` : ""}
        </span>
        <code className="mdmx-collection-dir">{collection.dir}</code>
      </Link>
    </li>
  );
}
