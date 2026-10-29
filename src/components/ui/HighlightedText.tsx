import { cn } from '@/lib/utils';
import {
  HIGHLIGHT_CLASS,
  renderSegments,
  type CharMap,
  type IndexedHit,
} from '@/lib/engine/unit-index';

interface Props {
  text: string;
  charMap: CharMap;
  onHit?: (hit: IndexedHit) => void;
  /** Show a visible marker for invisible characters */
  showMarkers?: boolean;
  /** Location id to render with the selected ring */
  selectedId?: string | null;
  className?: string;
}

/**
 * Renders text with individually highlighted, clickable, keyboard-accessible
 * spans for every suspicious character. Highlighting is decided by comparing
 * each rendered character against the character map — never by stored offsets.
 * Never uses innerHTML — plain text nodes only.
 */
export function HighlightedText({
  text,
  charMap,
  onHit,
  showMarkers = true,
  selectedId,
  className,
}: Props) {
  const segs = renderSegments(text, charMap);
  if (segs.length === 0) return null;

  return (
    <span className={cn(className)}>
      {segs.map((seg, i) => {
        if (!seg.hit) return <span key={i}>{seg.text}</span>;
        const h = seg.hit;
        const marker = showMarkers ? markerFor(h) : null;
        return (
          <span
            key={i}
            role="button"
            tabIndex={0}
            title={`${h.loc.line ? `Line ${h.loc.line}, ` : ''}inspect character`}
            className={cn('hl', HIGHLIGHT_CLASS[h.category], h.loc.id === selectedId && 'selected')}
            onClick={(e) => {
              e.stopPropagation();
              onHit?.(h);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onHit?.(h);
              }
            }}
          >
            {seg.text}
            {marker ? <span className="ml-[1px] align-baseline text-[9px] opacity-70">{marker}</span> : null}
          </span>
        );
      })}
    </span>
  );
}

function markerFor(h: IndexedHit): string | null {
  if (h.category === 'mojibake') return null;
  const cp = h.char.codePointAt(0)!;
  if (cp === 0xfeff) return 'BOM';
  if (cp === 0x00ad) return 'SHY';
  if (h.category === 'invisible' || h.category === 'control') return '·';
  return null;
}
