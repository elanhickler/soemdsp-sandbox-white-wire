const nodeGraphNodeLabels = Object.freeze({
  audioInput: "Input",
  osc: "Osc",
  spiral: "Spiral",
  noise: "Noise",
  gain: "Gain",
  bias: "Bias",
  textBox: "Text Box",
  output: "Output",
});

const nodeGraphModuleDefinitions = Object.freeze({
  audioInput: {
    outputs: ["Left", "Right"],
    parameters: [
      {
        defaultValue: "0.35",
        key: "level",
        label: "Amplitude",
        max: "1",
        mid: "0.35",
        min: "0",
        step: "0.01",
      },
    ],
  },
  osc: {
    outputs: ["Out"],
    parameters: [
      {
        choices: ["Saw", "Square", "Triangle", "Sine", "Noise"],
        defaultValue: "0",
        displayChoices: true,
        divideChoicesVisibly: true,
        key: "waveform",
        kind: "waveform",
        label: "Waveform",
        linearSmoothing: false,
        max: "4",
        mid: "2",
        min: "0",
        step: "1",
      },
      {
        defaultValue: "440",
        key: "frequency",
        kind: "frequency",
        label: "Frequency",
        max: "20000",
        mid: "440",
        min: "0",
        step: "any",
        unit: "Hz",
      },
      {
        defaultValue: "0",
        key: "phase",
        kind: "phase",
        label: "Phase",
        max: "1",
        mid: "0.5",
        min: "0",
        step: "0.01",
        unit: "cycle",
        wraparound: true,
      },
      {
        defaultValue: "0.35",
        key: "level",
        label: "Amplitude",
        max: "0.8",
        mid: "0.35",
        min: "0",
        step: "0.01",
      },
    ],
  },
  spiral: {
    outputs: ["X", "Y", "Z"],
    parameters: [
      { key: "frequency", label: "Frequency", defaultValue: "440", min: "40", mid: "440", max: "2000", step: "any", unit: "Hz" },
      { key: "density", label: "Density", defaultValue: "1", min: "0.1", mid: "1", max: "16", step: "0.01" },
      { key: "size", label: "Size", defaultValue: "0.5", min: "0.1", mid: "0.5", max: "4", step: "0.01" },
      { key: "sharp", label: "Sharp", defaultValue: "0.5", min: "0.01", mid: "0.5", max: "0.99", step: "0.01" },
      { key: "sharpCurve", label: "Sharp Curve", defaultValue: "0", min: "0", mid: "0.5", max: "1", step: "0.01" },
      { key: "sharpCurveMult", label: "Sharp Curve Mult", defaultValue: "1", min: "0", mid: "1", max: "4", step: "0.01" },
      { key: "position", label: "Position", defaultValue: "0", min: "0", mid: "0.5", max: "1", step: "0.01", kind: "phase", unit: "cycle", wraparound: true },
      { key: "positionSpeed", label: "Position Speed", defaultValue: "0", min: "-10", mid: "0", max: "10", step: "0.01", unit: "Hz" },
      { key: "morph", label: "Morph", defaultValue: "0", min: "0", mid: "0.5", max: "1", step: "0.01", kind: "phase", wraparound: true },
      { key: "morphSpeed", label: "Morph Speed", defaultValue: "0", min: "-10", mid: "0", max: "10", step: "0.01", unit: "Hz" },
      { key: "rotX", label: "Rot X", defaultValue: "0", min: "0", mid: "0.5", max: "1", step: "0.01", kind: "phase", wraparound: true },
      { key: "rotXSpeed", label: "Rot X Speed", defaultValue: "0", min: "-10", mid: "0", max: "10", step: "0.01", unit: "Hz" },
      { key: "rotY", label: "Rot Y", defaultValue: "0", min: "0", mid: "0.5", max: "1", step: "0.01", kind: "phase", wraparound: true },
      { key: "rotYSpeed", label: "Rot Y Speed", defaultValue: "0", min: "-10", mid: "0", max: "10", step: "0.01", unit: "Hz" },
      { key: "zDepth", label: "Z Depth", defaultValue: "0", min: "0", mid: "0", max: "1", step: "0.01" },
      { key: "zAmount", label: "Z Amount", defaultValue: "0", min: "0", mid: "0", max: "1", step: "0.01" },
      { key: "level", label: "Level", defaultValue: "0.35", min: "0", mid: "0.35", max: "0.8", step: "0.01" },
    ],
  },
  noise: {
    outputs: ["Out"],
    parameters: [
      {
        defaultValue: "0.12",
        key: "level",
        label: "Amplitude",
        max: "0.5",
        mid: "0.12",
        min: "0",
        step: "0.01",
      },
    ],
  },
  gain: {
    inputs: ["In"],
    outputs: ["Out"],
    parameters: [
      {
        defaultValue: "1.5",
        key: "amount",
        label: "Amount",
        max: "3",
        mid: "1",
        min: "0",
        step: "0.01",
      },
    ],
  },
  bias: {
    inputs: ["In"],
    outputs: ["Out"],
    parameters: [
      {
        defaultValue: "0.05",
        key: "offset",
        label: "Offset",
        max: "0.4",
        mid: "0",
        min: "-0.4",
        step: "0.01",
      },
    ],
  },
  textBox: {
    layout: "textBox",
    layoutOnly: true,
    parameters: [],
  },
  output: {
    inputs: ["Left", "Right"],
    output: true,
    parameters: [
      {
        defaultValue: "1",
        key: "volume",
        label: "Volume",
        max: "2",
        mid: "1",
        min: "0",
        step: "0.01",
      },
    ],
  },
});

const nodeGraphOutputInputPorts = Object.freeze(["Left", "Right"]);
const nodeGraphAudioBlockSize = 512;
const nodeGraphOutputClipLimit = 0.95;
const nodeGraphTau = Math.PI * 2;
const nodeGraphPiOver2 = Math.PI / 2;
const nodeGraphPiOver4 = Math.PI / 4;

const nodeGraphGrid = Object.freeze({
  heightPx: 28,
  sizePx: 28,
  widthPx: 28,
});

const nodeGraphModuleLayout = Object.freeze({
  bodyRowGapGu: 1 / 28,
  fitCushionGu: 2 / 28,
  headerHeightGu: 76 / 28,
  headerTitleRowHeightGu: 22 / 28,
  ioPaddingYGu: 4 / 28,
  ioRowGapGu: 1 / 28,
  ioRowHeightGu: 16 / 28,
  ioSectionMinHeightGu: 24 / 28,
  moduleGridInsetGu: 6 / 28,
  sliderRowHeightGu: 30 / 28,
  textBoxBodyMinGu: 4,
});

const nodeGraphPatchFormat = Object.freeze({
  kind: "soemdsp-sandbox-node-patch",
  version: 1,
});
