/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages ship built ESM; transpiling them keeps Next's bundler
  // happy with the symlinked monorepo deps.
  transpilePackages: ["@mdmx/core", "@mdmx/editor", "@mdmx/next"],
};

export default nextConfig;
