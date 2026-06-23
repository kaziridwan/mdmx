import { createMDMXHandlers, LocalProvider } from "@mdmx/next";
import {
  CONTENT_DIR,
  MEDIA_DIR,
  REPO,
  projectRoot,
  registry,
} from "../../../../lib/mdmx-config";

// The content/media API, mounted at /api/mdmx/*. localMode skips GitHub OAuth
// and runs as a synthetic "local" session; saves go to the working tree via
// LocalProvider. Validation, path-safety, CSRF, and conflict checks still apply.
export const { GET, POST, PUT, DELETE } = createMDMXHandlers({
  repo: REPO,
  contentDir: CONTENT_DIR,
  mediaDir: MEDIA_DIR,
  localMode: true,
  createProvider: () => new LocalProvider(projectRoot()),
  registry: registry(),
  validation: "report",
  insecureCookies: true,
});

export const dynamic = "force-dynamic";
