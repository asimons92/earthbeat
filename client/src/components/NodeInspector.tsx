import { useMemo } from 'react';
import type { Edge, Node } from '@xyflow/react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getConnectorKind,
  modulatableChannelsForKind,
  oscillatorDefaults,
  oscillatorModulatableParams,
  usgsConnector,
} from '@/generated/catalog';

function modulatorStatus(data: {
  channelKey: string;
  targetParam: string;
  inMin: number;
  inMax: number;
  outMin: number;
  outMax: number;
}) {
  const outIsRatio = data.targetParam === 'frequencyHz';
  const outRange = outIsRatio
    ? `${data.outMin}×–${data.outMax}×`
    : `${data.outMin}–${data.outMax}`;
  return `${data.inMin}–${data.inMax} → ${outRange}`;
}

function modulatorLabel(channelKey: string, targetParam: string) {
  const channel = usgsConnector.channels.find((entry) => entry.key === channelKey);
  const param = oscillatorModulatableParams.find((entry) => entry.key === targetParam);
  const left = channel?.label ?? channelKey;
  const right = param?.label ?? targetParam;
  return `${left} → ${right}`;
}

type NodeInspectorProps = {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  onChangeNodeData: (nodeId: string, data: Record<string, unknown>) => void;
};

export function NodeInspector({
  nodes,
  edges,
  selectedNodeId,
  onChangeNodeData,
}: NodeInspectorProps) {
  const selected = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const upstreamConnector = useMemo(() => {
    if (!selected || selected.type !== 'modulator') return null;
    const inbound = edges.find((edge) => edge.target === selected.id);
    if (!inbound) return null;
    const node = nodes.find((entry) => entry.id === inbound.source);
    if (!node || node.type !== 'connector') return null;
    return node;
  }, [edges, nodes, selected]);

  const downstreamOscillator = useMemo(() => {
    if (!selected || selected.type !== 'modulator') return null;
    const outbound = edges.find((edge) => edge.source === selected.id);
    if (!outbound) return null;
    const node = nodes.find((entry) => entry.id === outbound.target);
    if (!node || node.type !== 'oscillator') return null;
    return node;
  }, [edges, nodes, selected]);

  const channelOptions = useMemo(() => {
    if (!upstreamConnector) return [];
    const kindKey = String(upstreamConnector.data.kindKey ?? '');
    return modulatableChannelsForKind(kindKey);
  }, [upstreamConnector]);

  const targetOptions = useMemo(() => {
    if (!downstreamOscillator) return [];
    return [...oscillatorModulatableParams];
  }, [downstreamOscillator]);

  if (!selected) {
    return (
      <aside className="shell__inspector" aria-label="Node inspector">
        <div className="inspector__title">Inspector</div>
        <p className="inspector__empty">Select a node on the canvas.</p>
      </aside>
    );
  }

  if (selected.type === 'modulator') {
    const data = selected.data as {
      label: string;
      channelKey: string;
      targetParam: string;
      inMin: number;
      inMax: number;
      outMin: number;
      outMax: number;
      status: string;
    };

    const patchModulator = (patch: Partial<typeof data>) => {
      const next = { ...data, ...patch };
      const channel = channelOptions.find((entry) => entry.key === next.channelKey);
      const target = targetOptions.find((entry) => entry.key === next.targetParam);
      if (patch.channelKey && channel) {
        next.inMin = 'mapHintMin' in channel ? Number(channel.mapHintMin) : Number(channel.min);
        next.inMax = 'mapHintMax' in channel ? Number(channel.mapHintMax) : Number(channel.max);
      }
      if (patch.targetParam && target) {
        next.outMin = target.modulationOutMin;
        next.outMax = target.modulationOutMax;
      }
      next.label = modulatorLabel(next.channelKey, next.targetParam);
      next.status = modulatorStatus(next);
      onChangeNodeData(selected.id, next);
    };

    return (
      <aside className="shell__inspector" aria-label="Node inspector">
        <div className="inspector__title">Modulator</div>
        <p className="inspector__hint">{data.label}</p>

        <div className="inspector__field">
          <Label htmlFor="modulator-channel">Channel</Label>
          {upstreamConnector ? (
            <Select
              value={data.channelKey}
              onValueChange={(value) => {
                if (value) patchModulator({ channelKey: value });
              }}
              disabled={channelOptions.length === 0}
            >
              <SelectTrigger id="modulator-channel" size="sm">
                <SelectValue placeholder="Choose channel" />
              </SelectTrigger>
              <SelectContent>
                {channelOptions.map((channel) => (
                  <SelectItem key={channel.key} value={channel.key}>
                    {channel.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="inspector__empty">Wire a Connector into this Modulator.</p>
          )}
        </div>

        <div className="inspector__field">
          <Label htmlFor="modulator-target">Target param</Label>
          {downstreamOscillator ? (
            <Select
              value={data.targetParam}
              onValueChange={(value) => {
                if (value) patchModulator({ targetParam: value });
              }}
              disabled={targetOptions.length === 0}
            >
              <SelectTrigger id="modulator-target" size="sm">
                <SelectValue placeholder="Choose param" />
              </SelectTrigger>
              <SelectContent>
                {targetOptions.map((param) => (
                  <SelectItem key={param.key} value={param.key}>
                    {param.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="inspector__empty">Wire this Modulator into an Oscillator.</p>
          )}
        </div>

        <div className="inspector__row">
          <div className="inspector__field">
            <Label htmlFor="modulator-in-min">In min</Label>
            <Input
              id="modulator-in-min"
              type="number"
              value={data.inMin}
              onChange={(event) => patchModulator({ inMin: Number(event.target.value) })}
            />
          </div>
          <div className="inspector__field">
            <Label htmlFor="modulator-in-max">In max</Label>
            <Input
              id="modulator-in-max"
              type="number"
              value={data.inMax}
              onChange={(event) => patchModulator({ inMax: Number(event.target.value) })}
            />
          </div>
        </div>

        <div className="inspector__row">
          <div className="inspector__field">
            <Label htmlFor="modulator-out-min">
              {data.targetParam === 'frequencyHz' ? 'Ratio min' : 'Out min'}
            </Label>
            <Input
              id="modulator-out-min"
              type="number"
              step={data.targetParam === 'frequencyHz' ? '0.1' : undefined}
              value={data.outMin}
              onChange={(event) => patchModulator({ outMin: Number(event.target.value) })}
            />
          </div>
          <div className="inspector__field">
            <Label htmlFor="modulator-out-max">
              {data.targetParam === 'frequencyHz' ? 'Ratio max' : 'Out max'}
            </Label>
            <Input
              id="modulator-out-max"
              type="number"
              step={data.targetParam === 'frequencyHz' ? '0.1' : undefined}
              value={data.outMax}
              onChange={(event) => patchModulator({ outMax: Number(event.target.value) })}
            />
          </div>
        </div>
      </aside>
    );
  }

  if (selected.type === 'connector') {
    const data = selected.data as {
      label: string;
      kindKey: string;
      status: string;
      interpolate?: boolean;
    };
    const kind = getConnectorKind(data.kindKey) ?? usgsConnector;
    const isNoaa = data.kindKey === 'noaa_coops_tides';
    const interpolate = data.interpolate !== false;
    return (
      <aside className="shell__inspector" aria-label="Node inspector">
        <div className="inspector__title">Connector</div>
        <p className="inspector__hint">{data.label}</p>
        <div className="inspector__field">
          <Label>Connector kind</Label>
          <p className="inspector__readonly">{kind.label}</p>
        </div>
        {isNoaa ? (
          <div className="inspector__field">
            <Label htmlFor="connector-interpolate">Smooth interpolate</Label>
            <label className="inspector__check" htmlFor="connector-interpolate">
              <input
                id="connector-interpolate"
                type="checkbox"
                checked={interpolate}
                onChange={(event) => {
                  onChangeNodeData(selected.id, {
                    ...data,
                    interpolate: event.target.checked,
                  });
                }}
              />
              <span>Lerp between tide points while scrubbing</span>
            </label>
          </div>
        ) : null}
        <div className="inspector__field">
          <Label>Modulatable channels</Label>
          <ul className="inspector__list">
            {kind.channels
              .filter((channel) => channel.modulatable)
              .map((channel) => (
                <li key={channel.key}>
                  {channel.label} ({channel.key})
                </li>
              ))}
          </ul>
        </div>
      </aside>
    );
  }

  if (selected.type === 'oscillator') {
    const data = selected.data as {
      label: string;
      waveform: string;
      frequencyHz?: number;
      gain?: number;
      status: string;
    };
    const frequencyHz = data.frequencyHz ?? oscillatorDefaults.frequencyHz;
    const gain = data.gain ?? oscillatorDefaults.gain;

    return (
      <aside className="shell__inspector" aria-label="Node inspector">
        <div className="inspector__title">Oscillator</div>
        <p className="inspector__hint">{data.label}</p>
        <div className="inspector__field">
          <Label>Waveform</Label>
          <p className="inspector__readonly">{data.waveform}</p>
        </div>
        <div className="inspector__field">
          <Label htmlFor="oscillator-frequency">Frequency (Hz)</Label>
          <Input
            id="oscillator-frequency"
            type="number"
            value={frequencyHz}
            onChange={(event) => {
              const nextFrequency = Number(event.target.value);
              onChangeNodeData(selected.id, {
                ...data,
                frequencyHz: nextFrequency,
                gain,
                status: `${nextFrequency} Hz`,
              });
            }}
          />
        </div>
        <div className="inspector__field">
          <Label htmlFor="oscillator-gain">Gain</Label>
          <Input
            id="oscillator-gain"
            type="number"
            step="0.01"
            min={0}
            max={1}
            value={gain}
            onChange={(event) => {
              const nextGain = Number(event.target.value);
              onChangeNodeData(selected.id, {
                ...data,
                frequencyHz,
                gain: nextGain,
                status: `${frequencyHz} Hz`,
              });
            }}
          />
        </div>
      </aside>
    );
  }

  return (
    <aside className="shell__inspector" aria-label="Node inspector">
      <div className="inspector__title">Inspector</div>
      <p className="inspector__empty">No inspector for this node type yet.</p>
    </aside>
  );
}
