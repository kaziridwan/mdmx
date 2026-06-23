import Link from "next/link";
import { join } from "node:path";
import { getDocuments } from "@mdmx/next";
import { CmsHeader } from "../../../components/CmsHeader";
import { DocList } from "../../../components/DocList";
import { NewPostButton } from "../../../components/NewPostButton";
import { CONTENT_DIR, projectRoot, registry } from "../../../lib/mdmx-config";

export const dynamic = "force-dynamic";

export default async function CollectionPage({ params }: { params: { name: string } }) {
  const reg = registry();
  const collection = reg.getCollection(params.name);

  if (!collection) {
    return (
      <main className="mdmx-home">
        <CmsHeader crumbs={[{ label: params.name }]} />
        <p className="mdmx-home-empty">
          No collection named <code>{params.name}</code>. <Link href="/">Back home</Link>.
        </p>
      </main>
    );
  }

  const all = await getDocuments(join(projectRoot(), CONTENT_DIR), { registry: reg });
  const docs = all.filter(
    (d) => reg.collectionForPath(`${CONTENT_DIR}/${d.path}`)?.name === collection.name,
  );
  const published = docs.filter((d) => d.frontmatter.status === "published");
  const drafts = docs.filter((d) => d.frontmatter.status !== "published");

  return (
    <main className="mdmx-home">
      <CmsHeader crumbs={[{ label: collection.name }]} />
      <div className="mdmx-collection-head">
        <div>
          <h1>{collection.name}</h1>
          <p>
            Entries in <code>{collection.dir}/</code>.
          </p>
        </div>
        <NewPostButton collection={collection} contentDir={CONTENT_DIR} />
      </div>

      <DocList title="Published" docs={published} empty="Nothing published yet." />
      <DocList title="Drafts" docs={drafts} empty="No drafts." />
    </main>
  );
}
