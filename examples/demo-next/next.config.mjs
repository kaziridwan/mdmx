/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages ship built ESM; transpiling them keeps Next's bundler
  // happy with the symlinked monorepo deps.
  transpilePackages: ["@mdmx/core", "@mdmx/editor", "@mdmx/next", "@mdmx/dashboard", "@mdmx/project", "@mdmx/studio"],
  // Next 16 writes AGENTS.md/CLAUDE.md into the app on every `next dev`; the
  // repo keeps its own hand-curated pair at the root.
  agentRules: false,
};

export default nextConfig;
