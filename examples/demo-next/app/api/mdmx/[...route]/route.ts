import { createMDMXHandlers } from "@mdmx/next";

// The whole content/media API. Everything — content dir, media dir, repo,
// validation, the registry, the mode, the provider — resolves from
// mdmx.config.json and the environment (ADR-039). Set the three
// MDMX_GITHUB_* env vars and this same file runs GitHub mode in production.
export const { GET, POST, PUT, DELETE } = createMDMXHandlers();

export const dynamic = "force-dynamic";
