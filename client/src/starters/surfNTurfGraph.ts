import type { DomainGraph } from '@/persist/graphMapper';

/** Baked starter key for Surf n Turf (from prod spooky patch). */
export const SURF_N_TURF_KEY = 'surf_n_turf';

/** Display name for the Surf n Turf starter Patch. */
export const SURF_N_TURF_NAME = 'Surf n Turf';

/** Domain graph baked from prod patch da020f10 (formerly spooky). */
export const SURF_N_TURF_GRAPH: DomainGraph = {
  "connectors": [
    {
      "id": "connector-df351eb4-5c1a-488e-aab9-010ca47cc8bf",
      "patchId": "starter-surf-n-turf",
      "kindKey": "usgs_earthquakes",
      "label": "USGS Quakes",
      "positionX": -134.268622352037,
      "positionY": 2.389305095602822
    },
    {
      "id": "connector-c321ba38-de46-468d-888f-889dfeed2919",
      "patchId": "starter-surf-n-turf",
      "kindKey": "noaa_coops_tides",
      "label": "NOAA Tides 2",
      "positionX": -139.73953527153338,
      "positionY": 179.17854559308404
    },
    {
      "id": "connector-cffc5882-fe27-405c-8428-bd1311f52668",
      "patchId": "starter-surf-n-turf",
      "kindKey": "ndbc_buoy_waves",
      "label": "NDBC Waves 3",
      "positionX": -164.89755346463068,
      "positionY": 415.0977769298175
    }
  ],
  "modulators": [
    {
      "id": "modulator-818f0642-ee1f-4d28-8118-fd790a250b69",
      "patchId": "starter-surf-n-turf",
      "label": "Magnitude → Frequency (Hz)",
      "positionX": 93.32043279514428,
      "positionY": -0.46441937480457085,
      "channelKey": "mag",
      "targetParam": "frequencyHz",
      "inMin": 1,
      "inMax": 8,
      "outMin": 0,
      "outMax": 1.5
    },
    {
      "id": "modulator-ef24d481-02b9-4fe8-a23b-706ab33d0114",
      "patchId": "starter-surf-n-turf",
      "label": "Water level → Frequency (Hz)",
      "positionX": 77.19586787354852,
      "positionY": 180.24251192650274,
      "channelKey": "waterLevel",
      "targetParam": "frequencyHz",
      "inMin": -1,
      "inMax": 3,
      "outMin": 0.5,
      "outMax": 4
    },
    {
      "id": "modulator-59f5e994-b33d-4a10-9fe2-74f3b55647de",
      "patchId": "starter-surf-n-turf",
      "label": "Wave period → Frequency (Hz)",
      "positionX": 64.1841435743662,
      "positionY": 425.29532792796806,
      "channelKey": "wavePeriod",
      "targetParam": "frequencyHz",
      "inMin": 4,
      "inMax": 16,
      "outMin": 0.5,
      "outMax": 2
    }
  ],
  "oscillators": [
    {
      "id": "oscillator-f544a3ad-d134-4859-9a58-e396ec876f86",
      "patchId": "starter-surf-n-turf",
      "label": "Sine Tone",
      "positionX": 623.0614394366903,
      "positionY": 7.729836839589751,
      "waveform": "saw",
      "frequencyHz": 220,
      "gain": 0.03
    },
    {
      "id": "oscillator-17e7caef-c8c6-4f22-936f-57e4cb0f56ca",
      "patchId": "starter-surf-n-turf",
      "label": "Sine Tone 2",
      "positionX": 611.9998902276847,
      "positionY": 198.97676588823253,
      "waveform": "sine",
      "frequencyHz": 60,
      "gain": 0.08
    },
    {
      "id": "oscillator-4decf913-fa10-4997-82c4-67fbefe2190f",
      "patchId": "starter-surf-n-turf",
      "label": "Sine Tone 3",
      "positionX": 572.7305669194619,
      "positionY": -175.97819852351734,
      "waveform": "saw",
      "frequencyHz": 440,
      "gain": 0.01
    },
    {
      "id": "oscillator-0374a320-cbc7-4e05-a0f1-324e8c998075",
      "patchId": "starter-surf-n-turf",
      "label": "Sine Tone 4",
      "positionX": 676.7384600904368,
      "positionY": 416.2449784548759,
      "waveform": "sine",
      "frequencyHz": 220,
      "gain": 0.07
    },
    {
      "id": "oscillator-547104a0-a0ed-41be-8f4b-c8e5d71193ce",
      "patchId": "starter-surf-n-turf",
      "label": "Sine Tone 5",
      "positionX": 684.4328621204605,
      "positionY": 608.237849676458,
      "waveform": "saw",
      "frequencyHz": 400,
      "gain": 0.02
    }
  ],
  "effects": [
    {
      "id": "effect-e233f7d6-e834-431a-922b-2e48ce2c42b4",
      "patchId": "starter-surf-n-turf",
      "kindKey": "scale_snap",
      "label": "Scale Snap",
      "positionX": 367.2171777770099,
      "positionY": 1.1034751516532353,
      "tonic": "C",
      "scaleKey": "major",
      "enabled": true,
      "a4Hz": 440,
      "drive": 2,
      "timeMs": 250,
      "feedback": 0.35,
      "mix": 0.35
    },
    {
      "id": "effect-31235e2e-ee88-421a-a039-d625c8cb87bf",
      "patchId": "starter-surf-n-turf",
      "kindKey": "scale_snap",
      "label": "Scale Snap 2",
      "positionX": 358.401750802476,
      "positionY": 180.1385782437158,
      "tonic": "C",
      "scaleKey": "major",
      "enabled": true,
      "a4Hz": 440,
      "drive": 2,
      "timeMs": 250,
      "feedback": 0.35,
      "mix": 0.35
    },
    {
      "id": "effect-f4088bb6-c99a-4c4b-8b02-fac367d2b8b0",
      "patchId": "starter-surf-n-turf",
      "kindKey": "scale_snap",
      "label": "Scale Snap 3",
      "positionX": 408.79110732613185,
      "positionY": 442.572031916272,
      "tonic": "C",
      "scaleKey": "major",
      "enabled": true,
      "a4Hz": 440,
      "drive": 2,
      "timeMs": 250,
      "feedback": 0.35,
      "mix": 0.35
    },
    {
      "id": "effect-d2fac549-fcb8-425c-9154-d1146a7b6cd4",
      "patchId": "starter-surf-n-turf",
      "kindKey": "delay",
      "label": "Delay 4",
      "positionX": 921.3892010874486,
      "positionY": 396.1098422387737,
      "tonic": "C",
      "scaleKey": "major",
      "enabled": true,
      "a4Hz": 440,
      "drive": 2,
      "timeMs": 250,
      "feedback": 0.35,
      "mix": 0.35
    },
    {
      "id": "effect-e6e6cdf6-1bee-48f9-b97c-b11ad952ff1d",
      "patchId": "starter-surf-n-turf",
      "kindKey": "delay",
      "label": "Delay 5",
      "positionX": 926.3350921369981,
      "positionY": 633.6366598011193,
      "tonic": "C",
      "scaleKey": "major",
      "enabled": true,
      "a4Hz": 440,
      "drive": 2,
      "timeMs": 250,
      "feedback": 0.35,
      "mix": 0.35
    },
    {
      "id": "effect-62e4e672-ab1e-47c5-a42b-aa7b42e733f6",
      "patchId": "starter-surf-n-turf",
      "kindKey": "delay",
      "label": "Delay 6",
      "positionX": 852.5731800110436,
      "positionY": -123.523824251909,
      "tonic": "C",
      "scaleKey": "major",
      "enabled": true,
      "a4Hz": 440,
      "drive": 2,
      "timeMs": 250,
      "feedback": 0.6,
      "mix": 0.35
    },
    {
      "id": "effect-b9c1fc63-de97-46a9-83a6-f14fdea7332e",
      "patchId": "starter-surf-n-turf",
      "kindKey": "delay",
      "label": "Delay 7",
      "positionX": 926.4671734830994,
      "positionY": 43.145118755179695,
      "tonic": "C",
      "scaleKey": "major",
      "enabled": true,
      "a4Hz": 440,
      "drive": 2,
      "timeMs": 1000,
      "feedback": 0.6,
      "mix": 0.35
    }
  ],
  "wires": [
    {
      "id": "xy-edge__connector-df351eb4-5c1a-488e-aab9-010ca47cc8bfout-modulator-818f0642-ee1f-4d28-8118-fd790a250b69in",
      "patchId": "starter-surf-n-turf",
      "sourceNodeId": "connector-df351eb4-5c1a-488e-aab9-010ca47cc8bf",
      "targetNodeId": "modulator-818f0642-ee1f-4d28-8118-fd790a250b69",
      "sourceHandle": "out",
      "targetHandle": "in"
    },
    {
      "id": "xy-edge__modulator-818f0642-ee1f-4d28-8118-fd790a250b69out-effect-e233f7d6-e834-431a-922b-2e48ce2c42b4in",
      "patchId": "starter-surf-n-turf",
      "sourceNodeId": "modulator-818f0642-ee1f-4d28-8118-fd790a250b69",
      "targetNodeId": "effect-e233f7d6-e834-431a-922b-2e48ce2c42b4",
      "sourceHandle": "out",
      "targetHandle": "in"
    },
    {
      "id": "xy-edge__effect-e233f7d6-e834-431a-922b-2e48ce2c42b4out-oscillator-f544a3ad-d134-4859-9a58-e396ec876f86in",
      "patchId": "starter-surf-n-turf",
      "sourceNodeId": "effect-e233f7d6-e834-431a-922b-2e48ce2c42b4",
      "targetNodeId": "oscillator-f544a3ad-d134-4859-9a58-e396ec876f86",
      "sourceHandle": "out",
      "targetHandle": "in"
    },
    {
      "id": "xy-edge__connector-c321ba38-de46-468d-888f-889dfeed2919out-modulator-ef24d481-02b9-4fe8-a23b-706ab33d0114in",
      "patchId": "starter-surf-n-turf",
      "sourceNodeId": "connector-c321ba38-de46-468d-888f-889dfeed2919",
      "targetNodeId": "modulator-ef24d481-02b9-4fe8-a23b-706ab33d0114",
      "sourceHandle": "out",
      "targetHandle": "in"
    },
    {
      "id": "xy-edge__modulator-ef24d481-02b9-4fe8-a23b-706ab33d0114out-effect-31235e2e-ee88-421a-a039-d625c8cb87bfin",
      "patchId": "starter-surf-n-turf",
      "sourceNodeId": "modulator-ef24d481-02b9-4fe8-a23b-706ab33d0114",
      "targetNodeId": "effect-31235e2e-ee88-421a-a039-d625c8cb87bf",
      "sourceHandle": "out",
      "targetHandle": "in"
    },
    {
      "id": "xy-edge__effect-31235e2e-ee88-421a-a039-d625c8cb87bfout-oscillator-17e7caef-c8c6-4f22-936f-57e4cb0f56cain",
      "patchId": "starter-surf-n-turf",
      "sourceNodeId": "effect-31235e2e-ee88-421a-a039-d625c8cb87bf",
      "targetNodeId": "oscillator-17e7caef-c8c6-4f22-936f-57e4cb0f56ca",
      "sourceHandle": "out",
      "targetHandle": "in"
    },
    {
      "id": "xy-edge__effect-e233f7d6-e834-431a-922b-2e48ce2c42b4out-oscillator-4decf913-fa10-4997-82c4-67fbefe2190fin",
      "patchId": "starter-surf-n-turf",
      "sourceNodeId": "effect-e233f7d6-e834-431a-922b-2e48ce2c42b4",
      "targetNodeId": "oscillator-4decf913-fa10-4997-82c4-67fbefe2190f",
      "sourceHandle": "out",
      "targetHandle": "in"
    },
    {
      "id": "xy-edge__connector-cffc5882-fe27-405c-8428-bd1311f52668out-modulator-59f5e994-b33d-4a10-9fe2-74f3b55647dein",
      "patchId": "starter-surf-n-turf",
      "sourceNodeId": "connector-cffc5882-fe27-405c-8428-bd1311f52668",
      "targetNodeId": "modulator-59f5e994-b33d-4a10-9fe2-74f3b55647de",
      "sourceHandle": "out",
      "targetHandle": "in"
    },
    {
      "id": "xy-edge__modulator-59f5e994-b33d-4a10-9fe2-74f3b55647deout-effect-f4088bb6-c99a-4c4b-8b02-fac367d2b8b0in",
      "patchId": "starter-surf-n-turf",
      "sourceNodeId": "modulator-59f5e994-b33d-4a10-9fe2-74f3b55647de",
      "targetNodeId": "effect-f4088bb6-c99a-4c4b-8b02-fac367d2b8b0",
      "sourceHandle": "out",
      "targetHandle": "in"
    },
    {
      "id": "xy-edge__effect-f4088bb6-c99a-4c4b-8b02-fac367d2b8b0out-oscillator-0374a320-cbc7-4e05-a0f1-324e8c998075in",
      "patchId": "starter-surf-n-turf",
      "sourceNodeId": "effect-f4088bb6-c99a-4c4b-8b02-fac367d2b8b0",
      "targetNodeId": "oscillator-0374a320-cbc7-4e05-a0f1-324e8c998075",
      "sourceHandle": "out",
      "targetHandle": "in"
    },
    {
      "id": "xy-edge__effect-f4088bb6-c99a-4c4b-8b02-fac367d2b8b0out-oscillator-547104a0-a0ed-41be-8f4b-c8e5d71193cein",
      "patchId": "starter-surf-n-turf",
      "sourceNodeId": "effect-f4088bb6-c99a-4c4b-8b02-fac367d2b8b0",
      "targetNodeId": "oscillator-547104a0-a0ed-41be-8f4b-c8e5d71193ce",
      "sourceHandle": "out",
      "targetHandle": "in"
    },
    {
      "id": "xy-edge__oscillator-0374a320-cbc7-4e05-a0f1-324e8c998075out-effect-d2fac549-fcb8-425c-9154-d1146a7b6cd4in",
      "patchId": "starter-surf-n-turf",
      "sourceNodeId": "oscillator-0374a320-cbc7-4e05-a0f1-324e8c998075",
      "targetNodeId": "effect-d2fac549-fcb8-425c-9154-d1146a7b6cd4",
      "sourceHandle": "out",
      "targetHandle": "in"
    },
    {
      "id": "xy-edge__oscillator-547104a0-a0ed-41be-8f4b-c8e5d71193ceout-effect-e6e6cdf6-1bee-48f9-b97c-b11ad952ff1din",
      "patchId": "starter-surf-n-turf",
      "sourceNodeId": "oscillator-547104a0-a0ed-41be-8f4b-c8e5d71193ce",
      "targetNodeId": "effect-e6e6cdf6-1bee-48f9-b97c-b11ad952ff1d",
      "sourceHandle": "out",
      "targetHandle": "in"
    },
    {
      "id": "xy-edge__oscillator-4decf913-fa10-4997-82c4-67fbefe2190fout-effect-62e4e672-ab1e-47c5-a42b-aa7b42e733f6in",
      "patchId": "starter-surf-n-turf",
      "sourceNodeId": "oscillator-4decf913-fa10-4997-82c4-67fbefe2190f",
      "targetNodeId": "effect-62e4e672-ab1e-47c5-a42b-aa7b42e733f6",
      "sourceHandle": "out",
      "targetHandle": "in"
    },
    {
      "id": "xy-edge__oscillator-f544a3ad-d134-4859-9a58-e396ec876f86out-effect-b9c1fc63-de97-46a9-83a6-f14fdea7332ein",
      "patchId": "starter-surf-n-turf",
      "sourceNodeId": "oscillator-f544a3ad-d134-4859-9a58-e396ec876f86",
      "targetNodeId": "effect-b9c1fc63-de97-46a9-83a6-f14fdea7332e",
      "sourceHandle": "out",
      "targetHandle": "in"
    }
  ]
} ;
