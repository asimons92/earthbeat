import { modulatorTransferCurve, type AxisLock } from '@/runtime/modulatorTransferCurve';

const PLOT_WIDTH = 220;
const PLOT_HEIGHT = 140;
const MARGIN = { top: 10, right: 10, bottom: 36, left: 44 };
const INNER_WIDTH = PLOT_WIDTH - MARGIN.left - MARGIN.right;
const INNER_HEIGHT = PLOT_HEIGHT - MARGIN.top - MARGIN.bottom;

function formatTick(value: number): string {
  if (!Number.isFinite(value)) return '';
  const abs = Math.abs(value);
  if (abs !== 0 && (abs >= 1000 || abs < 0.01)) {
    return value.toExponential(1);
  }
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

type ModulatorTransferCurveProps = {
  inMin: number;
  inMax: number;
  outMin: number;
  outMax: number;
  channelValue: number | null;
  yAxisIsRatio: boolean;
  xLock: AxisLock | null;
  yLock: AxisLock | null;
  xAxisLabel: string;
  yAxisLabel: string;
};

export function ModulatorTransferCurve({
  inMin,
  inMax,
  outMin,
  outMax,
  channelValue,
  yAxisIsRatio,
  xLock,
  yLock,
  xAxisLabel,
  yAxisLabel,
}: ModulatorTransferCurveProps) {
  const geometry = modulatorTransferCurve(
    { inMin, inMax, outMin, outMax },
    {
      width: INNER_WIDTH,
      height: INNER_HEIGHT,
      channelValue,
      xLock,
      yLock,
    },
  );

  const polylinePoints = geometry.polyline
    .map((point) => `${MARGIN.left + point.x},${MARGIN.top + point.y}`)
    .join(' ');

  const yUnit = yAxisIsRatio ? '×' : '';
  const ariaLabel = `Modulator transfer curve from ${xAxisLabel} to ${yAxisLabel}`;
  const plotCenterX = MARGIN.left + INNER_WIDTH / 2;
  const plotCenterY = MARGIN.top + INNER_HEIGHT / 2;

  return (
    <div className="inspector__transfer">
      <svg
        className="inspector__transfer-svg"
        viewBox={`0 0 ${PLOT_WIDTH} ${PLOT_HEIGHT}`}
        role="img"
        aria-label={ariaLabel}
      >
        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={INNER_WIDTH}
          height={INNER_HEIGHT}
          className="inspector__transfer-frame"
        />
        {geometry.yTicks.map((tick) => {
          const span = geometry.yDomain.max - geometry.yDomain.min;
          const y =
            MARGIN.top +
            (span === 0
              ? INNER_HEIGHT / 2
              : ((geometry.yDomain.max - tick) / span) * INNER_HEIGHT);
          return (
            <g key={`y-${tick}`}>
              <line
                x1={MARGIN.left}
                y1={y}
                x2={MARGIN.left + INNER_WIDTH}
                y2={y}
                className="inspector__transfer-grid"
              />
              <text
                x={MARGIN.left - 4}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                className="inspector__transfer-tick"
              >
                {formatTick(tick)}
                {yUnit}
              </text>
            </g>
          );
        })}
        {geometry.xTicks.map((tick) => {
          const span = geometry.xDomain.max - geometry.xDomain.min;
          const x =
            MARGIN.left +
            (span === 0
              ? INNER_WIDTH / 2
              : ((tick - geometry.xDomain.min) / span) * INNER_WIDTH);
          return (
            <text
              key={`x-${tick}`}
              x={x}
              y={PLOT_HEIGHT - 18}
              textAnchor="middle"
              className="inspector__transfer-tick"
            >
              {formatTick(tick)}
            </text>
          );
        })}
        <text
          x={plotCenterX}
          y={PLOT_HEIGHT - 4}
          textAnchor="middle"
          className="inspector__transfer-axis-label"
        >
          {xAxisLabel}
        </text>
        <text
          x={10}
          y={plotCenterY}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(-90 10 ${plotCenterY})`}
          className="inspector__transfer-axis-label"
        >
          {yAxisLabel}
        </text>
        <polyline
          points={polylinePoints}
          fill="none"
          className="inspector__transfer-curve"
        />
        {geometry.livePointSvg ? (
          <circle
            cx={MARGIN.left + geometry.livePointSvg.x}
            cy={MARGIN.top + geometry.livePointSvg.y}
            r={3.5}
            className="inspector__transfer-point"
          />
        ) : null}
      </svg>
    </div>
  );
}
