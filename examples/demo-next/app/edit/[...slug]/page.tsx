import Link from "next/link";
import { LocalProvider } from "@mdmx/next";
import { CONTENT_DIR, projectRoot, registry, registrySpec } from "../../../lib/mdmx-config";
import { EditorClient } from "./EditorClient";

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: { slug: string[] } }) {
  const rel = params.slug.join("/");
  const path = `${CONTENT_DIR}/${rel}`;
  const provider = new LocalProvider(projectRoot());
  const collection = registry().collectionForPath(path);
  const backHref = collection ? `/collections/${collection.name}` : "/";
  const backLabel = collection ? collection.name : "Home";

  let initialSource: string;
  let initialSha: string;
  try {
    const file = await provider.read(path);
    initialSource = file.content;
    initialSha = file.sha;
  } catch {
    return (
      <main className="mdmx-home">
        <p>
          Could not read <code>{path}</code>. <Link href="/">Back</Link>
        </p>
      </main>
    );
  }

  return (
    <EditorClient
      path={path}
      initialSource={initialSource}
      initialSha={initialSha}
      registrySpec={registrySpec()}
      collection={collection}
      backHref={backHref}
      backLabel={backLabel}
    />
  );
}
