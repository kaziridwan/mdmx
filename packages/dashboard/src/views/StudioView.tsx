"use client";
import { StudioView as StudioScreen } from "@mdmx/studio/ui";
import { useStudioBridge } from "../studio-bridge.js";

/**
 * The Component Studio screens live in `@mdmx/studio/ui` (ADR-045); the
 * dashboard's job is to supply the client and the chrome.
 */
export function StudioView() {
  const bridge = useStudioBridge();
  return <StudioScreen {...bridge} />;
}
