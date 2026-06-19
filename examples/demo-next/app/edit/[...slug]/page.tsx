import Link from "next/link";
import { LocalProvider } from "@imdx/next";
import { CONTENT_DIR, projectRoot, registry, registrySpec } from "../../../lib/imdx-config";
import { EditorClient } from "./EditorClient";

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: { slug: string[] } }) {
  const rel = params.slug.join("/");
  const path = `${CONTENT_DIR}/${rel}`;
  const provider = new LocalProvider(projectRoot());

  let initialSource: string;
  let initialSha: string;
  try {
    const file = await provider.read(path);
    initialSource = file.content;
    initialSha = file.sha;
  } catch {
    return (
      <main className="imdx-home">
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
      collection={registry().collectionForPath(path)}
    />
  );
}
