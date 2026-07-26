"use client";
import { StudioEditorView as StudioEditorScreen } from "@mdmx/studio/ui";
import { useStudioBridge } from "../studio-bridge.js";

/** Adapter: see StudioView.tsx. */
export function StudioEditorView({ name }: { name?: string }) {
  const bridge = useStudioBridge();
  return <StudioEditorScreen name={name} {...bridge} />;
}
