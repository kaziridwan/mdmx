/**
 * jsdom has no layout: `Range.getClientRects`/`getBoundingClientRect` are
 * missing, and CodeMirror measures through them whenever it draws a
 * selection or scrolls a position into view. Zero-sized rects keep it happy;
 * nothing here affects the node-environment suites.
 */
if (typeof Range !== "undefined") {
  const proto = Range.prototype as unknown as Record<string, unknown>;
  const rect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) });
  if (typeof proto.getClientRects !== "function") {
    proto.getClientRects = () => {
      const list = [] as unknown as DOMRectList & { item: (i: number) => DOMRect | null };
      (list as { item: (i: number) => DOMRect | null }).item = () => null;
      return list;
    };
  }
  if (typeof proto.getBoundingClientRect !== "function") {
    proto.getBoundingClientRect = rect;
  }
}
