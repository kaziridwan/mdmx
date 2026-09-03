import type { CSSProperties } from "react";
import { ArrowDownIcon, ArrowUpIcon, CodeIcon, CopyIcon, TrashIcon } from "./icons.js";

export interface BlockActionsProps {
  /** The contextual component's name (the toolbar's label). */
  name: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onEditSource: () => void;
  /** Absolute position inside `.mdmx-canvas-wrap` (measured by the editor). */
  style: CSSProperties;
}

/**
 * The small toolbar anchored to the contextual block's top-right corner:
 * move, duplicate, edit source, delete (ADR-058). Pointer-down is swallowed
 * so a click never steals the editor's selection.
 */
export function BlockActions({
  name,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onEditSource,
  style,
}: BlockActionsProps) {
  return (
    <div
      className="mdmx-block-actions"
      role="toolbar"
      aria-label={`${name} block actions`}
      style={style}
      onMouseDown={(e) => e.preventDefault()}
    >
      <span className="mdmx-block-actions-name">{name}</span>
      <button type="button" aria-label="Move block up" title="Move up (⌘⇧↑)" disabled={!canMoveUp} onClick={onMoveUp}>
        <ArrowUpIcon size={14} />
      </button>
      <button type="button" aria-label="Move block down" title="Move down (⌘⇧↓)" disabled={!canMoveDown} onClick={onMoveDown}>
        <ArrowDownIcon size={14} />
      </button>
      <button type="button" aria-label="Duplicate block" title="Duplicate (⌘⇧D)" onClick={onDuplicate}>
        <CopyIcon size={14} />
      </button>
      <button type="button" aria-label="Edit block source" title="Edit source" onClick={onEditSource}>
        <CodeIcon size={14} />
      </button>
      <button type="button" className="is-danger" aria-label="Delete block" title="Delete (⌘⇧⌫)" onClick={onDelete}>
        <TrashIcon size={14} />
      </button>
    </div>
  );
}
