/**
 * Links never navigate inside the canvas (ADR-052): a click on any `<a href>`
 * — in an author component or a link mark — is suppressed, and ⌘/Ctrl-click
 * opens the target in a new tab. Selection still happens on mousedown, so a
 * click on a link selects the block like any other non-interactive element.
 */

export interface LinkClick {
  anchor: HTMLAnchorElement;
  action: "suppress" | "open";
}

/** Classify a click within `root`; null when it isn't on a link. Pure; unit-tested. */
export function linkClickAction(event: Event, root: HTMLElement): LinkClick | null {
  const target = event.target;
  const el =
    target instanceof Element ? target : ((target as Node | null)?.parentElement ?? null);
  const anchor = el?.closest("a[href]") as HTMLAnchorElement | null | undefined;
  if (!anchor || !root.contains(anchor)) return null;
  const mouse = event as MouseEvent;
  return { anchor, action: mouse.metaKey || mouse.ctrlKey ? "open" : "suppress" };
}
