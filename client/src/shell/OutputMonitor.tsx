import { useEffect, useRef, useState } from 'react';

import { getConnectorKind, oscillatorDefaults } from '@/generated/catalog';
import {
  channelHistoryToSvgPath,
  timeDomainToSvgPath,
} from '@/runtime/audioScopePath';
import type { MonitorStrip } from '@/runtime/monitorStrips';
import type { ConnectorSample } from '@/runtime/resolveVoiceParams';
import type { SampleHistoryState } from '@/runtime/sampleHistory';

const SCOPE_WIDTH = 320;
const SCOPE_HEIGHT = 64;
const STRIP_WIDTH = 200;
const STRIP_HEIGHT = 48;
const ANALYSER_BINS = 2048;

const idleScopePath = timeDomainToSvgPath([], SCOPE_WIDTH, SCOPE_HEIGHT);

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, ms / 1000);
  const whole = Math.floor(totalSec);
  const frac = Math.floor((totalSec - whole) * 100);
  return `${whole}.${frac.toString().padStart(2, '0')} s`;
}

function readoutPrimary(lastSamplesByKind: Partial<Record<string, ConnectorSample>>): string {
  const usgs = lastSamplesByKind.usgs_earthquakes;
  if (usgs && usgs.kindKey === 'usgs_earthquakes' && usgs.mag != null) {
    return `M ${usgs.mag}`;
  }
  return `${oscillatorDefaults.frequencyHz} Hz`;
}

function readoutSecondary(
  lastSamplesByKind: Partial<Record<string, ConnectorSample>>,
  lastSample: ConnectorSample | null,
): string {
  const parts: string[] = [];
  for (const [kindKey, sample] of Object.entries(lastSamplesByKind)) {
    if (!sample) continue;
    const kind = getConnectorKind(kindKey);
    const label = kind?.label ?? kindKey;
    if (sample.kindKey === 'usgs_earthquakes') {
      parts.push(sample.place || label);
    } else if (sample.kindKey === 'noaa_coops_tides' && sample.waterLevel != null) {
      parts.push(`${label} ${sample.waterLevel.toFixed(2)} m`);
    } else {
      parts.push(label);
    }
  }
  if (parts.length === 0) {
    return lastSample ? 'Live sample' : 'Waiting for samples';
  }
  return parts.join(' · ');
}

type OutputMonitorProps = {
  lastSample: ConnectorSample | null;
  lastSamplesByKind: Partial<Record<string, ConnectorSample>>;
  monitorStrips: MonitorStrip[];
  sampleHistoryByStripId: SampleHistoryState;
  playStartedAtMs: number | null;
  isPlaying: boolean;
  getTimeDomainSnapshot: (out: Float32Array) => boolean;
};

export function OutputMonitor({
  lastSample,
  lastSamplesByKind,
  monitorStrips,
  sampleHistoryByStripId,
  playStartedAtMs,
  isPlaying,
  getTimeDomainSnapshot,
}: OutputMonitorProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [liveScopePath, setLiveScopePath] = useState(idleScopePath);
  const bufferRef = useRef(new Float32Array(ANALYSER_BINS));

  useEffect(() => {
    if (playStartedAtMs == null) return;
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 50);
    return () => window.clearInterval(id);
  }, [playStartedAtMs]);

  useEffect(() => {
    if (!isPlaying) return;
    let frame = 0;
    const draw = () => {
      const buf = bufferRef.current;
      if (getTimeDomainSnapshot(buf)) {
        setLiveScopePath(timeDomainToSvgPath(buf, SCOPE_WIDTH, SCOPE_HEIGHT));
      }
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [getTimeDomainSnapshot, isPlaying]);

  const elapsedLabel =
    playStartedAtMs == null ? '0.00 s' : formatElapsed(nowMs - playStartedAtMs);
  const scopePath = isPlaying ? liveScopePath : idleScopePath;

  return (
    <section className="shell__monitor" aria-label="Output monitor">
      <div className="monitor__meta">
        <div className="monitor__title">Output monitor</div>
        <div className="monitor__readout">
          <span>{readoutPrimary(lastSamplesByKind)}</span>
          <span>{readoutSecondary(lastSamplesByKind, lastSample)}</span>
        </div>
      </div>
      <div className="monitor__viz">
        {monitorStrips.map((strip) => {
          const values = sampleHistoryByStripId[strip.id] ?? [];
          const path = channelHistoryToSvgPath(
            values,
            strip.inMin,
            strip.inMax,
            STRIP_WIDTH,
            STRIP_HEIGHT,
          );
          return (
            <div key={strip.id} className="monitor__strip">
              <div className="monitor__strip-label">{strip.label}</div>
              <svg
                className="monitor__strip-wave"
                viewBox={`0 0 ${STRIP_WIDTH} ${STRIP_HEIGHT}`}
                preserveAspectRatio="none"
                aria-hidden
              >
                <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
          );
        })}
        <div className="monitor__strip monitor__strip--scope">
          <div className="monitor__strip-label">Audio</div>
          <svg
            className="monitor__scope-wave"
            viewBox={`0 0 ${SCOPE_WIDTH} ${SCOPE_HEIGHT}`}
            preserveAspectRatio="none"
            aria-hidden
          >
            <path d={scopePath} fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
      </div>
      <div className="monitor__time">{elapsedLabel}</div>
    </section>
  );
}
