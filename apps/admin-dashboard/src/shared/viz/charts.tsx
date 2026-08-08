/**
 * The three chart forms this console needs, as inline SVG.
 *
 * ┌─ NO CHART LIBRARY, AND THAT IS A STACK DECISION RATHER THAN A PREFERENCE ───────────────────┐
 * │ Recharts, Chart.js, visx and D3 are all absent from `STACK_ADDITIONS.md`, and a dependency  │
 * │ with no approved `A-NN` row is a review blocker that `ci:deps-approved` fails the build on. │
 * │ Three static forms over five to eight points each is a few dozen lines of path arithmetic;  │
 * │ importing 40-90 KB and an `A-NN` proposal to avoid writing them would be the wrong trade.    │
 * │                                                                                              │
 * │ If a form arrives that genuinely needs a library — a real time axis, zoom, brushing — the   │
 * │ answer is an `A-NN` row and the owner's approval, not a quietly added package.               │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ ONE AXIS, ALWAYS ──────────────────────────────────────────────────────────────────────────┐
 * │ `MultiLine` puts three series on ONE y-scale. A second scale is the most common chart lie   │
 * │ there is: the two lines cross wherever the author chose the ratio, and every reader takes   │
 * │ the crossing for a fact about the data.                                                      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ COLOUR IS THE VALIDATED SERIES PALETTE, AND IDENTITY IS NEVER COLOUR ALONE ────────────────┐
 * │ Slots come from `--gm-viz-series-N` in `packages/ui` — validated against this surface, with │
 * │ a recorded relief obligation in light mode. Every series here carries a direct label or a   │
 * │ legend entry with its own text, so a reader who cannot separate two hues still can.          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Charts scale with `viewBox` + `preserveAspectRatio="none"` on the fills only; text is rendered
 * outside the SVG so it never inherits the stretch.
 */

/**
 * The four categorical slots, as the custom properties `packages/ui` emits.
 *
 * `--gm-color-viz-series-N`, not `--gm-viz-series-N`. The generator prefixes every colour token
 * with `color-`, and a var that does not exist resolves to nothing: `stroke` and `fill` fall back
 * to black, which on the dark surface is an invisible chart rather than an error. Both charts and
 * the donut rendered completely blank before this was corrected, with no console warning.
 */
const SLOT_VAR = [
  '',
  'var(--gm-color-viz-series-1)',
  'var(--gm-color-viz-series-2)',
  'var(--gm-color-viz-series-3)',
  'var(--gm-color-viz-series-4)',
];

export const seriesColour = (slot: number): string => SLOT_VAR[slot] ?? SLOT_VAR[1] ?? '';

// ---------------------------------------------------------------------------
// Area — one series over time.
// ---------------------------------------------------------------------------

/**
 * A filled area with a 2px line on top.
 *
 * The y-axis starts at ZERO. Cropping the baseline to "make the trend visible" multiplies every
 * slope by an arbitrary factor and is the second most common chart lie after the dual axis.
 */
export function AreaChart({
  values,
  labels,
  slot = 1,
  height = 160,
}: {
  readonly values: readonly number[];
  readonly labels: readonly string[];
  readonly slot?: number;
  readonly height?: number;
}) {
  if (values.length < 2) return null;

  const width = 100;
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);

  const point = (value: number, index: number): string =>
    `${String(index * step)},${String(100 - (value / max) * 92)}`;

  const line = values.map(point).join(' ');
  const area = `0,100 ${line} ${String(width)},100`;
  const colour = seriesColour(slot);

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${String(width)} 100`}
        preserveAspectRatio="none"
        style={{ height: `${String(height)}px` }}
        className="w-full"
        role="img"
        aria-label={`${String(values.length)} points, peak ${String(max)}`}
      >
        {/* Recessive gridlines. Three, not eight — a grid dense enough to read values off is a
            table pretending to be a chart. */}
        {[25, 50, 75].map((y) => (
          <line
            key={y}
            x1="0"
            x2={width}
            y1={y}
            y2={y}
            stroke="currentColor"
            strokeWidth="0.25"
            className="text-border-subtle"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <polygon points={area} fill={colour} opacity="0.16" />
        <polyline
          points={line}
          fill="none"
          stroke={colour}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          // Without this the 2px stroke is stretched by the same factor as the x-axis and the
          // line renders thick and lumpy at wide viewports.
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <figcaption className="mt-stack-2xs flex justify-between text-xs text-content-muted">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Donut — part to whole, four slices.
// ---------------------------------------------------------------------------

export interface DonutSlice {
  readonly label: string;
  readonly value: number;
  readonly slot: number;
  readonly formatted: string;
}

/**
 * A donut with EVERY slice directly labelled beside it.
 *
 * The labels are not optional. Two of the four light-mode slots sit below 3:1 against white, and
 * the palette is only compliant there "with relief — visible labels or a table view". Strip the
 * labels to a bare legend of swatches and the chart stops meeting the standard it was validated
 * against.
 *
 * Four slices is also the ceiling. A fifth category folds into "Others" rather than taking a
 * fifth colour, because the palette's fifth slot is not validated against the fourth here.
 */
export function Donut({
  slices,
  size = 148,
}: {
  readonly slices: readonly DonutSlice[];
  readonly size?: number;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) return null;

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-inline-lg">
      <svg
        viewBox="0 0 100 100"
        style={{ width: `${String(size)}px`, height: `${String(size)}px` }}
        className="shrink-0 -rotate-90"
        role="img"
        aria-label="Revenue by source"
      >
        {slices.map((slice) => {
          const fraction = slice.value / total;
          // A 2px surface-coloured gap between segments. Adjacent fills that touch read as one
          // shape at small sizes, which is exactly when a donut is hardest to read anyway.
          const length = Math.max(fraction * circumference - 2, 0.5);
          const dash = `${String(length)} ${String(circumference - length)}`;
          const rotation = offset;
          offset += fraction * circumference;

          return (
            <circle
              key={slice.label}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={seriesColour(slice.slot)}
              strokeWidth="14"
              strokeDasharray={dash}
              strokeDashoffset={-rotation}
            />
          );
        })}
      </svg>

      <ul className="min-w-0 flex-1 flex flex-col gap-stack-2xs">
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-center gap-inline-xs text-xs">
            <span
              aria-hidden="true"
              className="h-[0.625rem] w-[0.625rem] shrink-0 rounded-full"
              style={{ backgroundColor: seriesColour(slice.slot) }}
            />
            {/* Label AND share AND amount. Text wears text tokens, never the series colour —
                a coloured swatch beside it carries identity. */}
            <span className="min-w-0 flex-1 truncate text-content-secondary">{slice.label}</span>
            <span className="shrink-0 tabular-nums text-content-muted">
              {((slice.value / total) * 100).toFixed(1)}%
            </span>
            <span className="shrink-0 tabular-nums text-content">{slice.formatted}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multi-line — three series, one scale.
// ---------------------------------------------------------------------------

export interface LineSeries {
  readonly label: string;
  readonly slot: number;
  readonly points: readonly number[];
}

export function MultiLine({
  series,
  labels,
  height = 160,
}: {
  readonly series: readonly LineSeries[];
  readonly labels: readonly string[];
  readonly height?: number;
}) {
  const all = series.flatMap((one) => one.points);
  if (all.length === 0) return null;

  const width = 100;
  const max = Math.max(...all, 1);
  const count = series[0]?.points.length ?? 0;
  const step = count > 1 ? width / (count - 1) : width;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${String(width)} 100`}
        preserveAspectRatio="none"
        style={{ height: `${String(height)}px` }}
        className="w-full"
        role="img"
        aria-label={`${String(series.length)} series over ${String(count)} periods`}
      >
        {[25, 50, 75].map((y) => (
          <line
            key={y}
            x1="0"
            x2={width}
            y1={y}
            y2={y}
            stroke="currentColor"
            strokeWidth="0.25"
            className="text-border-subtle"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {series.map((one) => (
          <polyline
            key={one.label}
            points={one.points
              .map((value, index) => `${String(index * step)},${String(100 - (value / max) * 92)}`)
              .join(' ')}
            fill="none"
            stroke={seriesColour(one.slot)}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      <figcaption className="mt-stack-2xs flex justify-between text-xs text-content-muted">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </figcaption>
    </figure>
  );
}

/** A legend. Present whenever there are two or more series — identity is never colour alone. */
export function Legend({ items }: { readonly items: readonly { label: string; slot: number }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-inline-md">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-inline-2xs text-xs text-content-secondary"
        >
          <span
            aria-hidden="true"
            className="h-[0.5rem] w-[0.5rem] rounded-full"
            style={{ backgroundColor: seriesColour(item.slot) }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
