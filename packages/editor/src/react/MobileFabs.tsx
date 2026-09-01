import { CodeIcon, LayersIcon, SlidersIcon } from "./icons.js";

export interface MobileFabsProps {
  onOpenPalette: () => void;
  onOpenSource: () => void;
  onOpenProperties: () => void;
}

/**
 * Mobile-only floating controls (hidden on desktop via CSS): open the
 * component palette or the Source/Properties sheet.
 */
export function MobileFabs({ onOpenPalette, onOpenSource, onOpenProperties }: MobileFabsProps) {
  return (
    <>
      <div className="mdmx-mobile-fabs mdmx-fabs-left">
        <button type="button" className="mdmx-fab" aria-label="Open components" onClick={onOpenPalette}>
          <LayersIcon size={20} />
        </button>
      </div>
      <div className="mdmx-mobile-fabs mdmx-fabs-right">
        <button type="button" className="mdmx-fab" aria-label="Open source" onClick={onOpenSource}>
          <CodeIcon size={20} />
        </button>
        <button
          type="button"
          className="mdmx-fab"
          aria-label="Open properties"
          onClick={onOpenProperties}
        >
          <SlidersIcon size={20} />
        </button>
      </div>
    </>
  );
}
