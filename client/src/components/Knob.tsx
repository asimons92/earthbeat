import { useRef } from 'react';

import {
  clampKnobValue,
  nudgeKnob,
  valueToNorm,
  type KnobCurve,
} from '@/components/knobValue';
import { cn } from '@/lib/utils';

const PIXELS_PER_FULL_TRAVEL = 120;
const ARROW_STEP_NORM = 0.01;
const PAGE_STEP_NORM = 0.1;
/** Sweep from 7 o'clock to 5 o'clock (270 degrees). */
const SWEEP_START_DEG = -135;
const SWEEP_DEG = 270;

export type KnobProps = {
  id: string;
  value: number;
  min: number;
  max: number;
  curve?: KnobCurve;
  disabled?: boolean;
  /** Digits after the decimal in the readout. */
  decimals?: number;
  className?: string;
  onChange: (next: number) => void;
};

function formatReadout(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(decimals);
}

export function Knob({
  id,
  value,
  min,
  max,
  curve = 'linear',
  disabled = false,
  decimals = 2,
  className,
  onChange,
}: KnobProps) {
  const lastYRef = useRef<number | null>(null);
  const clamped = clampKnobValue(value, min, max);
  const norm = valueToNorm(clamped, min, max, curve);
  const angleDeg = SWEEP_START_DEG + norm * SWEEP_DEG;

  const commit = (next: number) => {
    if (disabled) return;
    onChange(clampKnobValue(next, min, max));
  };

  return (
    <div className={cn('inspector__knob', className)}>
      <div
        id={id}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={clamped}
        aria-valuetext={formatReadout(clamped, decimals)}
        aria-orientation="vertical"
        aria-disabled={disabled || undefined}
        className="inspector__knob-dial"
        style={{ ['--knob-angle' as string]: `${angleDeg}deg` }}
        onPointerDown={(event) => {
          if (disabled) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          lastYRef.current = event.clientY;
        }}
        onPointerMove={(event) => {
          if (disabled) return;
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          if (lastYRef.current === null) return;
          const dy = event.clientY - lastYRef.current;
          lastYRef.current = event.clientY;
          const deltaNorm = -dy / PIXELS_PER_FULL_TRAVEL;
          commit(nudgeKnob(clamped, min, max, curve, deltaNorm));
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          lastYRef.current = null;
        }}
        onPointerCancel={() => {
          lastYRef.current = null;
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          const large = event.shiftKey;
          const step = large ? PAGE_STEP_NORM : ARROW_STEP_NORM;
          if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
            event.preventDefault();
            commit(nudgeKnob(clamped, min, max, curve, step));
            return;
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
            event.preventDefault();
            commit(nudgeKnob(clamped, min, max, curve, -step));
            return;
          }
          if (event.key === 'PageUp') {
            event.preventDefault();
            commit(nudgeKnob(clamped, min, max, curve, PAGE_STEP_NORM));
            return;
          }
          if (event.key === 'PageDown') {
            event.preventDefault();
            commit(nudgeKnob(clamped, min, max, curve, -PAGE_STEP_NORM));
            return;
          }
          if (event.key === 'Home') {
            event.preventDefault();
            commit(min);
            return;
          }
          if (event.key === 'End') {
            event.preventDefault();
            commit(max);
          }
        }}
      >
        <span className="inspector__knob-indicator" aria-hidden="true">
          <span className="inspector__knob-needle" />
        </span>
      </div>
      <output className="inspector__knob-readout" htmlFor={id}>
        {formatReadout(clamped, decimals)}
      </output>
    </div>
  );
}
