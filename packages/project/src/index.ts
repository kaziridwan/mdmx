/**
 * @mdmx/project — what an MDMX project on disk looks like.
 *
 * Sits between `@mdmx/core` (the spec: parse/serialize/validate) and the
 * runtimes (`@mdmx/cli`, `@mdmx/next`, `@mdmx/dashboard`): config schema and
 * loading, environment/mode resolution, and registry loading. Node-only, but
 * framework-free — nothing here imports React or Next.
 */

export {
  ConfigParseError,
  CONFIG_FILENAMES,
  DEFAULT_CONFIG,
  findConfigFile,
  loadConfig,
  mergeConfig,
  parseProjectConfig,
  validateConfig,
} from "./config.js";
export type { LoadedConfig, MDMXConfig, ProjectConfigFile } from "./config.js";

export {
  ENV_CLIENT_ID,
  ENV_CLIENT_SECRET,
  ENV_SESSION_SECRET,
  insecureCookiesDefault,
  ModeResolutionError,
  resolveMode,
} from "./env.js";
export type {
  GitHubCredentials,
  MDMXMode,
  ResolvedMode,
  ResolveModeOptions,
} from "./env.js";

export {
  loadRegistry,
  loadRegistrySpec,
  MissingRegistryError,
  REGISTRY_JSON,
  registryPath,
  tryLoadRegistrySpec,
} from "./registry.js";

export { detectTailwind } from "./tailwind.js";
