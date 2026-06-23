import { Plugin, PluginKey, type EditorState } from "prosemirror-state";

export interface SlashState {
  active: boolean;
  /** Query text after the slash (excluding the slash). */
  query: string;
  /** Document position of the slash character. */
  from: number;
}

const INACTIVE: SlashState = { active: false, query: "", from: 0 };

export const slashKey = new PluginKey<SlashState>("mdmxSlash");

/**
 * Tracks a `/`-trigger at the start of an empty-ish paragraph. The React
 * SlashMenu reads this plugin state to render a positioned menu; selecting an
 * item deletes `from..selection` and runs the item's command.
 */
export function slashPlugin(): Plugin<SlashState> {
  return new Plugin<SlashState>({
    key: slashKey,
    state: {
      init: () => INACTIVE,
      apply: (_tr, _value, _old, newState) => computeSlashState(newState),
    },
  });
}

function computeSlashState(state: EditorState): SlashState {
  const sel = state.selection;
  if (!sel.empty) return INACTIVE;
  const $from = sel.$from;
  if ($from.parent.type.name !== "paragraph") return INACTIVE;
  const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼");
  const match = /^\/(\S*)$/.exec(textBefore);
  if (!match) return INACTIVE;
  return { active: true, query: match[1] ?? "", from: $from.pos - match[0].length };
}

export function getSlashState(state: EditorState): SlashState {
  return slashKey.getState(state) ?? INACTIVE;
}
