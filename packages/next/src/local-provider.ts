import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import {
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import {
  assertSafePath,
  ConflictError,
  PathSafetyError,
  type CommitOptions,
  type CommitResult,
  type ContentProvider,
  type FileChange,
  type FileMeta,
} from "@mdmx/core";

/**
 * Development-mode ContentProvider backed by the local filesystem.
 *
 * No OAuth, no network: saves write straight to the working tree, and the
 * developer commits via their own git. Blob shas are computed git-style so
 * optimistic-concurrency semantics are identical to GitHubProvider — this
 * class doubles as the reference implementation that keeps the interface
 * honest before GitLab exists.
 */
export class LocalProvider implements ContentProvider {
  private readonly root: string;
  private commitCounter = 0;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async list(dir: string): Promise<FileMeta[]> {
    const safe = dir === "" ? "" : assertSafePath(dir);
    const abs = this.resolveWithinRoot(safe);
    const out: FileMeta[] = [];
    await this.walk(abs, safe, out);
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }

  async read(path: string): Promise<{ content: string; sha: string }> {
    const safe = assertSafePath(path);
    const buf = await readFile(this.resolveWithinRoot(safe));
    return { content: buf.toString("utf8"), sha: gitBlobSha(buf) };
  }

  async commit(
    changes: FileChange[],
    message: string,
    options?: CommitOptions,
  ): Promise<CommitResult> {
    if (changes.length === 0) throw new Error("commit requires at least one change");
    const safeChanges = changes.map((c) => ({ ...c, path: assertSafePath(c.path) }));
    await this.verifyExpected(options);
    for (const change of safeChanges) {
      const abs = this.resolveWithinRoot(change.path);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(
        abs,
        typeof change.content === "string" ? change.content : Buffer.from(change.content),
      );
    }
    this.commitCounter += 1;
    return { sha: `local-${this.commitCounter}`, message };
  }

  async delete(
    path: string,
    message: string,
    options?: CommitOptions,
  ): Promise<CommitResult> {
    const safe = assertSafePath(path);
    await this.verifyExpected(options);
    await rm(this.resolveWithinRoot(safe));
    this.commitCounter += 1;
    return { sha: `local-${this.commitCounter}`, message };
  }

  // ---------------------------------------------------------------------------

  private async verifyExpected(options?: CommitOptions): Promise<void> {
    if (!options?.expectedShas) return;
    for (const [path, expected] of Object.entries(options.expectedShas)) {
      const safe = assertSafePath(path);
      let actual: string | null = null;
      try {
        const buf = await readFile(this.resolveWithinRoot(safe));
        actual = gitBlobSha(buf);
      } catch {
        actual = null;
      }
      if (actual !== expected) {
        throw new ConflictError(path, `expected ${expected ?? "absent"}, found ${actual ?? "absent"}`);
      }
    }
  }

  /** Belt-and-braces: even after assertSafePath, re-verify containment. */
  private resolveWithinRoot(relPath: string): string {
    const abs = resolve(this.root, relPath);
    if (abs !== this.root && !abs.startsWith(this.root + sep)) {
      throw new PathSafetyError(relPath, "resolves outside the content root");
    }
    return abs;
  }

  private async walk(absDir: string, relDir: string, out: FileMeta[]): Promise<void> {
    let entries;
    try {
      entries = await readdir(absDir, { withFileTypes: true });
    } catch {
      return; // missing directory lists as empty
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const rel = relDir === "" ? entry.name : `${relDir}/${entry.name}`;
      const abs = join(absDir, entry.name);
      if (entry.isDirectory()) {
        await this.walk(abs, rel, out);
      } else if (entry.isFile()) {
        const [buf, s] = await Promise.all([readFile(abs), stat(abs)]);
        out.push({ path: rel, sha: gitBlobSha(buf), size: s.size });
      }
    }
  }
}

export function gitBlobSha(buf: Buffer): string {
  return createHash("sha1")
    .update(`blob ${buf.length}\0`)
    .update(buf)
    .digest("hex");
}
