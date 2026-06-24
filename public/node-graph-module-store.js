const nodeGraphModuleStoreTypes = Object.freeze([
  "osc",
  "additiveOsc",
  "gpuAdditiveOsc",
  "distortionOscillator",
  "dsfOscillator",
  "ellipsoid",
  "polyBlep",
  "fbPolyBlepOsc",
  "sineWavetable",
  "jerobeamNyqistShannon",
  "drumMachine",
  "kickDrum",
  "snareDrum",
  "clock",
  "transport",
  "clockDivider",
  "delayedTrigger",
  "buttonEvents",
  "nextPatch",
  "previousPatch",
  "randomClock",
  "triggerCounter",
  "triggerDivider",
  "stepSequencer",
  "melodySequencer",
  "chordSequencer",
  "arpeggiator",
  "spiral",
  "lorenzAttractor",
  "rosslerAttractor",
  "chuaAttractor",
  "aizawaAttractor",
  "thomasAttractor",
  "halvorsenAttractor",
  "noise",
  "stereoNoise",
  "noiseGenerator",
  "randomWalk",
  "fractalBrownianNoise",
  "clapPlugin",
  "codeblock",
  "graph",
  "graph2",
  "gain",
  "bias",
  "rotate3dTo2d",
  "output",
  "macroKnob",
  "bipolarKnob",
  "valueSlider",
  "rangeSlider",
  "midiOut",
  "midiNotePitch",
  "midiController",
  "keyboardController",
  "macroControls",
  "pitchModWheel",
  "xyPad",
  "portalInLeft",
  "portalInRight",
  "portalInMono",
  "portalOutLeft",
  "portalOutRight",
  "portalOutMono",
  "portalGenericInput",
  "portalGenericOutput",
  "groupInput",
  "groupOutput",
  "audioPlayer",
  "samplePlayer",
  "sampleLooper",
  "highpass",
  "lowpass",
  "bandpass",
  "cookbookFilter",
  "ladderFilter",
  "slewLimiter",
  "delayEffect",
  "reverbEffect",
  "distortionEffect",
  "sampleHold",
  "digitalCurveEnvelope",
  "expAdsr",
  "flowerChildEnvelopeFollower",
  "linearEnvelope",
  "pluckEnvelope",
  "vactrolEnvelope",
  "sandboxVisuals",
  "screenSpaceShader",
  "bloomGlow",
  "rgbaHsla",
  "chromaColor",
  "image",
  "canvas",
  "led",
  "visualOscilloscope",
  "traceDisplay",
  "dotOscilloscope",
  "valueOscilloscope",
  "lineBurnOscilloscope",
  "scope2d",
  "parabol",
  "vibratoGenerator",
  "wowAndFlutter",
  "speakerProtection",
  "badvalMonitor",
  "textBox",
]);

const nodeGraphModuleStoreUnderConstructionTypes = Object.freeze(new Set([
  "groupInput",
  "groupOutput",
]));

const nodeGraphModuleGroupStorageKey = "soemdsp-sandbox.moduleGroups.v1";
const nodeGraphModuleCatalogVisibilityStorageKey = "soemdsp-sandbox.moduleCatalogVisibility.v2";

const nodeGraphModuleStoreDepartments = Object.freeze([
  "Oscillator",
  "Chaos",
  "OMS",
  "Noise",
  "Filter",
  "Envelope",
  "Modulators",
  "Delay",
  "Drum",
  "Dynamics",
  "Sequence",
  "Audio",
  "Visual",
  "Oscilloscope",
  "Controllers",
  "Portals",
  "Loops",
  "Samples",
  "Debug",
]);

const nodeGraphModuleStoreVisualGroups = Object.freeze([
  {
    label: "Generate",
    departments: Object.freeze(["Oscillator", "Chaos", "OMS", "Noise", "Additive", "Drum", "Sequence"]),
  },
  {
    label: "Process",
    departments: Object.freeze(["Filter", "Envelope", "Modulators", "Delay", "Dynamics"]),
  },
  {
    label: "Interact",
    departments: Object.freeze(["Controllers", "Portals", "Oscilloscope", "Visual", "Debug"]),
  },
  {
    label: "Memory",
    departments: Object.freeze(["Audio", "Loops", "Samples"]),
  },
]);

const nodeGraphModuleStoreVisualGroupByDepartment = Object.freeze(
  nodeGraphModuleStoreVisualGroups.reduce((groups, group) => {
    for (const department of group.departments) {
      groups[department] = group.label;
    }
    return groups;
  }, {}),
);

const nodeGraphModuleStoreDepartmentAds = Object.freeze({
  Oscillator: {
    symbol: "∿",
    title: "Oscillator",
    pitch: "Start with a voice. Tone generators, phase motion, and the raw signal that everything else learns to orbit.",
  },
  "Drum": {
    symbol: "▥",
    title: "Drum",
    pitch: "Rhythm machines, drum voices, pattern engines, and percussion control surfaces.",
  },
  Filter: {
    symbol: "◫",
    title: "Filter",
    pitch: "Shape the airframe. Carve mass, reveal brightness, and teach a signal where it is allowed to fly.",
  },
  Delay: {
    symbol: "FX",
    title: "Delay",
    pitch: "Delay, reverb, distortion, and performance processors for shaping finished sound.",
  },
  Sequence: {
    symbol: "♪",
    title: "Sequence",
    pitch: "Pitch lanes and melodic pattern tools for generating lines, hooks, and motion.",
  },
  "Chord Sequencer": {
    symbol: "♬",
    title: "Chord Sequencer",
    pitch: "Progression tools for harmonic movement, voicings, and chord-triggered systems.",
  },
  Arpeggiator: {
    symbol: "↟",
    title: "Arpeggiator",
    pitch: "Pattern engines for broken chords, rhythmic note motion, and performance arps.",
  },
  Audio: {
    symbol: "OUT",
    title: "Audio Player",
    pitch: "Music playback, audio sinks, and listening endpoints for turning patch signal into rendered or live sound.",
  },
  Dynamics: {
    symbol: "⚡",
    title: "Dynamics",
    pitch: "Power routing, level control, offsets, and response shaping for keeping a circuit alive under pressure.",
  },
  Debug: {
    symbol: "DBG",
    title: "Debug",
    pitch: "Inspection tools, sentinels, and safety monitors for catching bad values while a patch is under test.",
  },
  Envelope: {
    symbol: "⌒",
    title: "Envelope",
    pitch: "Attack, decay, sustain, release, and gate-shaped motion. Make sound and visuals breathe on command.",
  },
  Modulators: {
    symbol: "⇄",
    title: "Modulator",
    pitch: "Motion sources for pitch, amplitude, time, and texture. Small control engines that make patches move.",
  },
  Controllers: {
    symbol: "⌘",
    title: "Controllers",
    pitch: "Input devices and control bridges for keyboards, MIDI, gamepads, and external gestures.",
  },
  Portals: {
    symbol: "IO",
    title: "Portals",
    pitch: "Patch boundary portals for moving left, right, and mono signal lanes between rooms, templates, and larger circuits.",
  },
  Samples: {
    symbol: "▣",
    title: "Samples",
    pitch: "Audio-file shelf. Empty by default until sandbox has a real file-library flow.",
  },
  Loops: {
    symbol: "∞",
    title: "Loops",
    pitch: "Loop-file shelf. Empty by default until sandbox has a real audio-loop library flow.",
  },
  Noise: {
    symbol: "✦",
    title: "Noise",
    pitch: "Noise, dust, instability, sparks, and all the useful mess a clean machine secretly needs.",
  },
  Chaos: {
    symbol: "∞",
    title: "Chaos",
    pitch: "All the various attractors and strange motion systems. The wild shelf where math starts looking back.",
  },
  OMS: {
    symbol: "OMS",
    title: "OMS",
    pitch: "Orbit and motion systems. Spiral Generator lives here while this style gets its own lane.",
  },
  Visual: {
    symbol: "V",
    title: "Visual",
    pitch: "Visual sinks, RGBA sources, canvas layers, and formula tiles for turning patch motion into screen output.",
  },
  Oscilloscope: {
    symbol: "OSC",
    title: "Oscilloscope",
    pitch: "Dedicated display testbeds for trace, dot, line burn, 2D scope, and canvas-style visual inspection.",
  },
});

const nodeGraphModuleStoreCatalog = Object.freeze({
  osc: {
    category: "Oscillator",
    description: "Core tone generator. Turns frequency, phase, and waveform into a controllable voice.",
    notes: ["phase counter", "waveform selection", "frequency control"],
  },
  additiveOsc: {
    category: "Additive",
    developerOnly: true,
    description: "Harmonic additive tone source using SOEMDSP waveform partial recipes.",
    notes: ["harmonic sum", "waveform selector", "band-limited partials"],
  },
  gpuAdditiveOsc: {
    category: "Additive",
    developerOnly: true,
    description: "Buffered GPU additive engine proof module. Reuses the CPU additive path in live audio and prepares WebGPU chunk rendering with fallback.",
    label: "GPU Additive",
    notes: ["WebGPU proof", "buffered backend", "CPU fallback"],
  },
  distortionOscillator: {
    category: "Oscillator",
    description: "Placeholder for a tone source with built-in distortion character and drive-shaped motion.",
    label: "DistortionOscillator",
    notes: ["placeholder", "driven tone", "future oscillator"],
  },
  dsfOscillator: {
    category: "Oscillator",
    description: "Placeholder for a discrete summation formula oscillator with rich harmonic control.",
    label: "DSFOscillator",
    notes: ["placeholder", "harmonic series", "future oscillator"],
  },
  ellipsoid: {
    category: "Oscillator",
    description: "SOEMDSP ellipsoid motion oscillator. Emits paired X/Y curved waveform outputs from two phase-offset ellipsoid DSP paths.",
    label: "Ellipsoid",
    notes: ["geometric motion", "x/y output", "soemdsp oscillator"],
  },
  polyBlep: {
    category: "Oscillator",
    description: "Anti-aliased PolyBLEP oscillator for clean saw, ramp, square, triangle, sine, and noise waveform outputs.",
    label: "PolyBLEP",
    notes: ["anti-aliasing", "polyblep", "realtime oscillator"],
  },
  fbPolyBlepOsc: {
    category: "Oscillator",
    description: "Realtime forward/backward PolyBLEP oscillator test module, split out from the current PolyBLEP oscillator path for edge-repair experiments.",
    label: "F/B PolyBLEP",
    notes: ["anti-aliasing", "known-edge repair", "realtime oscillator"],
  },
  sineWavetable: {
    category: "Oscillator",
    description: "Placeholder for a sine wavetable oscillator with table-driven phase playback.",
    label: "Sinewavetable",
    notes: ["placeholder", "wavetable", "future oscillator"],
  },
  jerobeamNyqistShannon: {
    category: "Oscillator",
    description: "Placeholder for a Jerobeam Nyqist/Shannon oscillator concept and audiovisual sampling study.",
    label: "JerobeamNyqistShannon",
    notes: ["placeholder", "sampling theorem", "future oscillator"],
  },
  drumMachine: {
    category: "Drum",
    description: "Placeholder for a compact pattern-driven drum machine module.",
    label: "DrumMachine",
    notes: ["placeholder", "patterns", "percussion"],
  },
  kickDrum: {
    category: "Drum",
    description: "Placeholder for a synthesized kick voice with pitch drop, body, and click controls.",
    label: "KickDrum",
    notes: ["placeholder", "drum voice", "low punch"],
  },
  snareDrum: {
    category: "Drum",
    description: "Placeholder for a synthesized snare voice with noise, tone, and snap controls.",
    label: "SnareDrum",
    notes: ["placeholder", "drum voice", "noise snap"],
  },
  clock: {
    category: "Sequence",
    description: "Timer pulse source. Emits a steady gate for triggering samplers, sequencers, and motion events.",
    notes: ["rate and phase control", "duty cycle", "reset input"],
  },
  transport: {
    category: "Sequence",
    description: "Project-synced beat clock source. Emits in-phase square waves derived from patch BPM.",
    label: "Transport",
    notes: ["project BPM", "beat divisions", "engine-start phase"],
  },
  clockDivider: {
    category: "Sequence",
    description: "Clock-aware divider. Count incoming clock edges and emit a slower gate for rhythmic subdivision.",
    notes: ["clock input", "division control", "reset input"],
  },
  delayedTrigger: {
    category: "Sequence",
    description: "One-shot timer. Catch a trigger, wait a precise delay, then emit a pulse for downstream events.",
    notes: ["delayed pulse", "reset input", "one-shot timing"],
  },
  randomClock: {
    category: "Sequence",
    description: "Seeded random interval clock. Emits a short trigger and a duty-controlled gate between minimum and maximum seconds.",
    notes: ["random timing", "trigger and gate outputs", "reset input"],
  },
  triggerCounter: {
    category: "Sequence",
    description: "Pulse counter. Count incoming triggers, emit a wrap pulse, and expose the count as modulation.",
    notes: ["count pulses", "wrap output", "reset input"],
  },
  triggerDivider: {
    category: "Sequence",
    description: "Divides incoming trigger pulses into slower clocks for envelopes, sequencers, and rhythmic patches.",
    notes: ["trigger division", "reset input", "pulse width"],
  },
  stepSequencer: {
    category: "Sequence",
    description: "Eight-step trigger sequencer. Advance it with Clock and route stepped control values anywhere.",
    notes: ["trigger input", "reset input", "stepped modulation"],
  },
  melodySequencer: {
    category: "Sequence",
    description: "Placeholder for a pitch-aware sequencer for hooks, lines, and scale-constrained motion.",
    label: "MelodySequencer",
    notes: ["placeholder", "pitch lane", "scale control"],
  },
  chordSequencer: {
    category: "Sequence",
    description: "Placeholder for arranging chord progressions and voicing changes inside the graph.",
    label: "ChordSequencer",
    notes: ["placeholder", "progressions", "voicing"],
  },
  arpeggiator: {
    category: "Sequence",
    description: "Placeholder for rhythmic note-pattern generation from held chords or chord sources.",
    label: "Arpeggiator",
    notes: ["placeholder", "note pattern", "arp engine"],
  },
  spiral: {
    category: "OMS",
    description: "Jerobeam spiral engine. Emits X/Y/Z motion-signal for alien curves and audiovisual flight paths.",
    label: "Spiral Generator",
    notes: ["attractor motion", "rotation", "density and morph controls"],
  },
  lorenzAttractor: {
    category: "Chaos",
    description: "Classic butterfly attractor motion for turbulent curls and folding trajectories.",
    label: "Lorenz Attractor",
    notes: ["butterfly attractor", "3D chaos", "X/Y/Z motion"],
  },
  rosslerAttractor: {
    category: "Chaos",
    description: "Ribbon-like chaotic orbit with spiral rolls and folding motion.",
    label: "RosslerAttractor",
    notes: ["spiral fold", "continuous chaos", "planned attractor"],
  },
  chuaAttractor: {
    category: "Chaos",
    description: "Double-scroll circuit attractor for electric, mirrored, hardware-chaos behavior.",
    label: "ChuaAttractor",
    notes: ["double scroll", "circuit chaos", "planned attractor"],
  },
  aizawaAttractor: {
    category: "Chaos",
    description: "Layered orbital attractor with hovering shells and complex central motion.",
    label: "AizawaAttractor",
    notes: ["orbital shells", "3D motion", "planned attractor"],
  },
  thomasAttractor: {
    category: "Chaos",
    description: "Sine-driven strange attractor for smooth looping chaos and balanced spatial motion.",
    label: "ThomasAttractor",
    notes: ["sine feedback", "smooth chaos", "planned attractor"],
  },
  halvorsenAttractor: {
    category: "Chaos",
    description: "Dense braided attractor motion for tangled audiovisual trajectories.",
    label: "HalvorsenAttractor",
    notes: ["braided chaos", "dense orbit", "planned attractor"],
  },
  noise: {
    category: "Noise",
    description: "Unstable broadband energy source for static, wind, percussion dust, and danger texture.",
    notes: ["random source", "amplitude", "texture generator"],
  },
  stereoNoise: {
    category: "Noise",
    description: "Two independent broadband noise streams as X/Y vector outputs plus a summed mono output for clouds and textures.",
    notes: ["x/y source", "independent channels", "amplitude"],
  },
  noiseGenerator: {
    category: "Noise",
    description: "Selectable random source for comparing uniform, gaussian, brown, pink, and crackle flavors side by side.",
    notes: ["distribution choices", "seed control", "noise lab"],
  },
  randomWalk: {
    category: "Noise",
    description: "Flexible soemdsp-style random walk with white, filtered, random-step, and fixed-step motion modes.",
    notes: ["bounded walk", "jitter curve", "one-pole smoothing"],
  },
  fractalBrownianNoise: {
    category: "Noise",
    description: "Three-axis layered fBm motion source with octave, persistence, scale, and seed controls for rough organic drift.",
    notes: ["out x/y/z", "seeded value noise", "slow terrain motion"],
  },
  clapPlugin: {
    category: "Audio",
    developerOnly: true,
    description: "Browser-side shell for a local CLAP host plugin. Stores plugin identity and can use a host instance during bounded Render Sample.",
    label: "CLAP Plugin",
    notes: ["local host", "native plugin", "offline render"],
  },
  codeblock: {
    category: "Controllers",
    description: "Patch-local JavaScript signal processor with editable input and output ports.",
    notes: ["dynamic ports", "JavaScript body", "local patch code"],
  },
  graph: {
    category: "Visual",
    description: "Patch-local soemdsp-style graph object with curve nodes and a vertical cursor position.",
    notes: ["curve display", "cursor line", "graph nodes"],
  },
  graph2: {
    category: "Visual",
    description: "Single-algorithm graph testbed for comparing linear, smooth, and meandering point interpolation.",
    label: "Graph 2",
    notes: ["global smoothing", "curve laboratory", "graph nodes"],
  },
  gain: {
    category: "Dynamics",
    description: "Signal booster and throttle. Use it to push, tame, or route engine power.",
    notes: ["multiplication", "level control", "headroom"],
  },
  bias: {
    category: "Dynamics",
    description: "Offsets a signal away from center. Useful for steering modulation and shifting control lanes.",
    notes: ["addition", "offset", "control lane shift"],
  },
  rotate3dTo2d: {
    category: "Dynamics",
    description: "Rotates an X/Y/Z signal point in 3D and projects the result back to X/Y.",
    label: "Rotation 3D to 2D",
    notes: ["3D rotation", "2D projection", "signal transform"],
  },
  output: {
    category: "Audio",
    description: "Stereo audio sink. Route Left and Right signals here to hear the patch.",
    label: "Output",
    notes: ["audio sink", "left right inputs", "render target"],
  },
  macroKnob: {
    category: "Controllers",
    description: "Compact 4x4 external knob module. Drag it by hand and patch its value output into another module's parameter modulation input.",
    label: "Macro Knob",
    notes: ["4x4 knob", "manual control", "parameter link"],
  },
  bipolarKnob: {
    category: "Controllers",
    description: "Compact 4x4 center-zero knob module for offsets, modulation depth, and expressive push/pull control links.",
    label: "Bipolar Knob",
    notes: ["4x4 knob", "center zero", "performance control"],
  },
  valueSlider: {
    category: "Controllers",
    description: "Resizable bias-output slider for manual control in the modular view and UI view.",
    label: "Value Slider",
    notes: ["bias output", "resizable widget", "manual control"],
  },
  rangeSlider: {
    category: "Controllers",
    description: "Placeholder for paired minimum/maximum slider control for constraining modulation ranges.",
    label: "RangeSlider",
    notes: ["placeholder", "min max", "range control"],
  },
  midiOut: {
    category: "Controllers",
    description: "Manual MIDI-number source. Outputs the selected note as a normalized 0..1 signal and as the full 0..127 value.",
    notes: ["midi number", "normalized output", "full value output"],
  },
  midiNotePitch: {
    category: "Controllers",
    description: "MIDI note converter. Applies octave and pitch offsets, then emits normalized pitch, full MIDI pitch, and frequency in Hz.",
    notes: ["midi note input", "frequency output", "pitch conversion"],
  },
  midiController: {
    category: "Controllers",
    description: "Placeholder for mapping MIDI controls into the modular graph.",
    label: "MIDIController",
    notes: ["placeholder", "MIDI input", "external control"],
  },
  buttonEvents: {
    category: "Controllers",
    description: "External page button event source. Emits short pulses for explicit click, hover, down, up, enter, and leave events sent into sandbox.",
    label: "Button Events",
    notes: ["external UI", "button triggers", "music page bridge"],
  },
  nextPatch: {
    category: "Controllers",
    description: "Patch command receiver. A trigger edge loads the next saved patch through the main UI patch explorer path.",
    label: "Next Patch",
    notes: ["patch navigation", "trigger input", "music player"],
  },
  previousPatch: {
    category: "Controllers",
    description: "Patch command receiver. A trigger edge loads the previous saved patch through the main UI patch explorer path.",
    label: "Previous Patch",
    notes: ["patch navigation", "trigger input", "music player"],
  },
  keyboardController: {
    category: "Controllers",
    description: "Mouse-playable keyboard source. Emits sustained gate, one-sample gate, key index, quantized key, MIDI pitch, normalized double, phase increment, frequency, numeric pitch, and X/Y gesture values.",
    label: "MIDI Keyboard",
    notes: ["keyboard input", "midi pitch", "gesture signals"],
  },
  macroControls: {
    category: "Controllers",
    description: "Reads the ten macro knobs under the modular view and emits M1 through M10 as live 0..1 control signals.",
    label: "Macro Controls",
    notes: ["macro row", "manual control", "ten outputs"],
  },
  pitchModWheel: {
    category: "Controllers",
    description: "Reads the separate pitch and mod wheel controls beside the keyboard. Pitch emits -1..1, while mod emits 0..1.",
    label: "Pitch / Mod Wheel",
    notes: ["pitch wheel", "mod wheel", "performance control"],
  },
  xyPad: {
    category: "Controllers",
    description: "Placeholder for a two-axis performance pad that outputs X/Y control values.",
    label: "XYPad",
    notes: ["placeholder", "two-axis control", "performance gesture"],
  },
  portalInLeft: {
    category: "Portals",
    description: "Placeholder portal for bringing a left-channel signal into a patch region.",
    label: "In Left",
    notes: ["placeholder", "left input", "patch boundary"],
  },
  portalInRight: {
    category: "Portals",
    description: "Placeholder portal for bringing a right-channel signal into a patch region.",
    label: "In Right",
    notes: ["placeholder", "right input", "patch boundary"],
  },
  portalInMono: {
    category: "Portals",
    description: "Placeholder portal for bringing a mono signal into a patch region.",
    label: "In Mono",
    notes: ["placeholder", "mono input", "patch boundary"],
  },
  portalOutLeft: {
    category: "Portals",
    description: "Placeholder portal for sending a left-channel signal out of a patch region.",
    label: "Out Left",
    notes: ["placeholder", "left output", "patch boundary"],
  },
  portalOutRight: {
    category: "Portals",
    description: "Placeholder portal for sending a right-channel signal out of a patch region.",
    label: "Out Right",
    notes: ["placeholder", "right output", "patch boundary"],
  },
  portalOutMono: {
    category: "Portals",
    description: "Placeholder portal for sending a mono signal out of a patch region.",
    label: "Out Mono",
    notes: ["placeholder", "mono output", "patch boundary"],
  },
  portalGenericInput: {
    category: "Portals",
    description: "Placeholder portal for bringing a generic signal into a patch region.",
    label: "Generic Input",
    notes: ["placeholder", "generic input", "patch boundary"],
  },
  portalGenericOutput: {
    category: "Portals",
    description: "Placeholder portal for sending a generic signal out of a patch region.",
    label: "Generic Output",
    notes: ["placeholder", "generic output", "patch boundary"],
  },
  groupInput: {
    category: "Portals",
    description: "Defines an exposed input on a saved module group.",
    label: "Group Input",
    notes: ["group interface", "public input", "patch boundary"],
  },
  groupOutput: {
    category: "Portals",
    description: "Defines an exposed output on a saved module group.",
    label: "Group Output",
    notes: ["group interface", "public output", "patch boundary"],
  },
  samplePlayer: {
    category: "Audio",
    description: "Patch-local one-shot sample playback. Trigger starts from Start and plays to End with simple click ramps.",
    label: "Sample Player",
    notes: ["sample playback", "one shot", "audio source"],
  },
  audioPlayer: {
    category: "Audio",
    description: "Patch-local music file player with stereo outputs and a phasor-driven scrub input for sample-accurate playback head control.",
    label: "Music Player",
    notes: ["music playback", "scrubbable", "phasor", "audio source"],
  },
  sampleLooper: {
    category: "Audio",
    description: "Patch-local gated sample loop playback with loop bounds, pitch control, and seam crossfade.",
    label: "Sample Looper",
    notes: ["sample playback", "loop", "audio source"],
  },
  highpass: {
    category: "Filter",
    description: "Cuts low-frequency mass so bright signal can escape the hull.",
    notes: ["cutoff frequency", "stateful filter", "bright motion"],
  },
  lowpass: {
    category: "Filter",
    description: "Cuts high-frequency sparks and leaves heavier warm signal behind.",
    notes: ["cutoff frequency", "smoothing", "warm motion"],
  },
  bandpass: {
    category: "Filter",
    description: "Focuses a signal between low and high cut points using the one-pole filter pair.",
    notes: ["low cut", "high cut", "focused band"],
  },
  cookbookFilter: {
    category: "Filter",
    description: "RSMET cookbook biquad cascade with mode, frequency, stages, Q, and gain controls plus an in-module response curve.",
    label: "Multi Stage Filter",
    notes: ["mode selection", "biquad stages", "curve display"],
  },
  ladderFilter: {
    category: "Filter",
    description: "RSMET ladder filter using the gain-compensated getSample path with frequency, resonance, stage depth, and mode controls.",
    label: "Ladder Filter",
    notes: ["RSMET ladder", "gain compensated", "resonant stages"],
  },
  slewLimiter: {
    category: "Modulators",
    description: "Limits rising and falling motion independently, turning abrupt changes into shaped ramps.",
    notes: ["up time", "down time", "asymmetric glide"],
  },
  delayEffect: {
    category: "Delay",
    description: "SOEMDSP-style modulated fractional delay with feedback, wet/dry mix, and diffuse mode.",
    label: "Delay",
    notes: ["modulated delay", "fractional echo", "diffuse mode"],
  },
  reverbEffect: {
    category: "Delay",
    description: "Placeholder for space, room, tail, and ambience processing.",
    label: "ReverbEffect",
    notes: ["placeholder", "space", "decay"],
  },
  distortionEffect: {
    category: "Delay",
    description: "Placeholder for drive, clipping, saturation, and tone-shaping distortion effects.",
    label: "DistortionEffect",
    notes: ["placeholder", "drive", "saturation"],
  },
  sampleHold: {
    category: "Noise",
    description: "Captures an input value when a trigger rises and holds it until the next trigger.",
    notes: ["triggered capture", "held output", "stepped motion"],
  },
  digitalCurveEnvelope: {
    category: "Envelope",
    description: "Programmable curve envelope for drawing sharper motion and custom response shapes.",
    label: "DigitalCurveEnvelope",
    notes: ["curve table", "custom shape", "planned envelope"],
  },
  expAdsr: {
    category: "Envelope",
    description: "Soundemote-style exponential ADSR. Gate it with a clock or pulse and shape the rise and fall curves.",
    label: "ExponentialEnvelope",
    notes: ["gate input", "target-ratio curves", "loopable envelope"],
  },
  flowerChildEnvelopeFollower: {
    category: "Envelope",
    description: "FlowerChild-style rectified envelope follower with attack, hold, and decay slew behavior.",
    label: "FlowerChild Envelope Follower",
    notes: ["audio input", "attack hold decay", "signed follower port"],
  },
  linearEnvelope: {
    category: "Envelope",
    description: "Straight-line envelope for predictable ramps, fades, gates, and simple motion.",
    label: "LinearEnvelope",
    notes: ["gate input", "linear DADSR", "loopable ramp"],
  },
  pluckEnvelope: {
    category: "Envelope",
    description: "Fast feedback pluck contour for struck, picked, pinged, and percussive behaviors.",
    label: "PluckEnvelope",
    notes: ["trigger input", "decay energy", "auto release"],
  },
  vactrolEnvelope: {
    category: "Envelope",
    description: "Optical-style control shaper. Feed it light and get the slow, curved response of a vactrol detector.",
    notes: ["light input", "attack/release lag", "dark current"],
  },
  sandboxVisuals: {
    category: "Visual",
    description: "Sink module for routing patch signals into the screen view. Drive shake, dim, color, scope pause/shutoff, or patch X/Y for direct visual motion.",
    notes: ["visual sink", "shake input", "scope pause"],
  },
  screenSpaceShader: {
    category: "Visual",
    description: "Scripted screen-space visual sink. Declare custom inputs and map them into screen shake, dim, color, scope pause, and offset controls.",
    notes: ["scripted visual sink", "custom inputs", "screen shader controls"],
  },
  bloomGlow: {
    category: "Visual",
    description: "Visual sink for routing patch signals into screen dimming, brightness, bloom, and glow response.",
    notes: ["visual sink", "dim input", "bloom and glow"],
  },
  rgbaHsla: {
    category: "Visual",
    description: "Precise color sink with RGB channels, HSL channels, an HSL mix control, and alpha for the screen wash.",
    notes: ["visual sink", "rgb channels", "hsla control"],
  },
  chromaColor: {
    category: "Visual",
    description: "Stylized color sink for chroma-driven screen washes with hue drift, spread, alpha, trace brightness, bloom, and glow.",
    notes: ["visual sink", "chroma wash", "moving color"],
  },
  image: {
    category: "Visual",
    description: "Patch-local image asset node. Route it into Screen Visuals Trace Image to texture phosphor trace dots.",
    notes: ["load image", "save image", "trace texture"],
  },
  canvas: {
    category: "Oscilloscope",
    description: "Layered RGBA compositor for images, scopes, shader passes, transforms, and future game-engine surfaces.",
    notes: ["layer compositor", "RGBA output", "shader script"],
  },
  led: {
    category: "Visual",
    description: "One-grid-unit signal light. Patch any gate or control signal into In and use it as a compact in-world indicator.",
    label: "LED",
    notes: ["1 GU tile", "input light", "visual indicator"],
  },
  visualOscilloscope: {
    category: "Visual",
    description: "Square in-world display tile. Patch any signal into In and use it as a dedicated visual display.",
    notes: ["square display", "signal display", "visual sink"],
  },
  traceDisplay: {
    category: "Oscilloscope",
    description: "Focused 1D waveform display testbed. Patch any signal into In and inspect the current trace without the full prettyscope renderer.",
    notes: ["1D waveform", "display testbed", "input trace"],
  },
  dotOscilloscope: {
    category: "Oscilloscope",
    description: "Placeholder for a clock-like oscilloscope that draws one efficient brightness dot from the current buffered value.",
    label: "0D Burn",
    notes: ["clock display", "single dot", "latest value"],
  },
  valueOscilloscope: {
    category: "Oscilloscope",
    description: "Single-value oscilloscope that draws the latest input as one horizontal line across the display.",
    label: "1D Value",
    notes: ["value display", "horizontal line", "latest value"],
  },
  lineBurnOscilloscope: {
    category: "Oscilloscope",
    description: "First-pass line-burn oscilloscope style with a heavier trace pass, ready for dedicated burn tuning.",
    label: "1D Burn",
    notes: ["burn display", "line trace", "testbed"],
  },
  scope2d: {
    category: "Oscilloscope",
    description: "First-pass 2D scope display for inspecting the latest X/Y signal point.",
    label: "2D Burn",
    notes: ["xy display", "2D scope", "latest point"],
  },
  parabol: {
    category: "Modulators",
    description: "Curved control motion for sweeps, bends, and non-linear transitions.",
    label: "Parabol",
    notes: ["parabolic curve", "control motion", "planned modulator"],
  },
  vibratoGenerator: {
    category: "Modulators",
    description: "Pitch-motion generator for musical vibrato and animated oscillator control.",
    label: "VibratoGenerator",
    notes: ["pitch modulation", "rate and depth", "planned modulator"],
  },
  wowAndFlutter: {
    category: "Modulators",
    description: "Tape-style slow wow and fast flutter motion for unstable pitch and timing character.",
    label: "WowAndFlutter",
    notes: ["wow motion", "flutter motion", "planned modulator"],
  },
  badvalMonitor: {
    category: "Debug",
    description: "Circuit sentinel. Watches for invalid values before they spread through the machine.",
    notes: ["NaN guard", "infinity guard", "debug safety"],
  },
  speakerProtection: {
    category: "Debug",
    description: "Hard safety fuse. Trips ear and speaker protection immediately if a wired sample exceeds absolute 1.0.",
    notes: ["speaker safety", "ear protection", "hard limit"],
  },
  textBox: {
    category: "Visual",
    description: "In-world label plate for prompts, lore, instructions, and electric annotations.",
    notes: ["annotation", "layout", "field notes"],
  },
});

function defaultNodeGraphModuleCatalogVisibility() {
  return Object.fromEntries(
    nodeGraphModuleStoreTypes.map((type) => [
      type,
      {
        developer: true,
        home: false,
      },
    ]),
  );
}

function normalizeNodeGraphModuleCatalogVisibility(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(
    nodeGraphModuleStoreTypes.map((type) => {
      const entry = source[type];
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        return [
          type,
          {
            developer: entry.developer !== false && entry.shop !== false,
            home: entry.home === true,
          },
        ];
      }
      return [
        type,
        {
          developer: entry !== false,
          home: false,
        },
      ];
    }),
  );
}

function nodeGraphModuleCatalogVisibility() {
  return normalizeNodeGraphModuleCatalogVisibility(nodeGraphMvp.moduleCatalogVisibility);
}

function nodeGraphModuleIsStoreVisible(type, shelf = "shop") {
  const visibility = nodeGraphModuleCatalogVisibility()[type];
  if (shelf === "developer") {
    return visibility?.developer !== false;
  }
  if (shelf === "home") {
    return visibility?.home === true;
  }
  return true;
}

function applyNodeGraphModuleCatalogVisibility(value = {}) {
  nodeGraphMvp.moduleCatalogVisibility = normalizeNodeGraphModuleCatalogVisibility(value);
  renderNodeGraphModuleStoreCatalog();
}

function loadNodeGraphModuleCatalogVisibilityLocal() {
  if (!nodeGraphLocalDefaultPresetAllowed()) {
    return null;
  }
  try {
    const text = window.localStorage.getItem(nodeGraphModuleCatalogVisibilityStorageKey);
    if (!text) {
      return null;
    }
    return normalizeNodeGraphModuleCatalogVisibility(JSON.parse(text));
  } catch {
    return null;
  }
}

function saveNodeGraphModuleCatalogVisibilityLocal(value = nodeGraphModuleCatalogVisibility()) {
  if (!nodeGraphLocalDefaultPresetAllowed()) {
    return false;
  }
  try {
    window.localStorage.setItem(
      nodeGraphModuleCatalogVisibilityStorageKey,
      JSON.stringify(normalizeNodeGraphModuleCatalogVisibility(value)),
    );
    return true;
  } catch {
    return false;
  }
}

function nodeGraphModuleStoreEntries() {
  return nodeGraphModuleStoreTypes
    .map((type) => {
      const implemented =
        Object.hasOwn(nodeGraphModuleDefinitions, type) &&
        !nodeGraphModuleStoreUnderConstructionTypes.has(type);
      const developerVisible = nodeGraphModuleIsStoreVisible(type, "developer");
      const developerOnly = nodeGraphModuleStoreCatalog[type]?.developerOnly === true;
      const publicVisible = !developerOnly;
      return {
        ...(nodeGraphModuleStoreCatalog[type] || {}),
        type,
        demoPatch: nodeGraphModuleStoreDemoPatchAvailable(type),
        demoListen: nodeGraphModuleStoreDemoListenAvailable(type),
        developerOnly,
        developerVisible,
        homeVisible: nodeGraphModuleIsStoreVisible(type, "home") && implemented,
        implemented,
        label: nodeGraphModuleStoreCatalog[type]?.label || nodeGraphNodeLabels[type] || type,
        shopVisible: publicVisible,
        visible: publicVisible,
      };
    });
}

function setNodeGraphModuleCatalogVisibility(type, visible, shelf = "shop") {
  if (!nodeGraphModuleStoreTypes.includes(type)) {
    return;
  }
  const key = shelf === "home" ? "home" : "developer";
  const current = nodeGraphModuleCatalogVisibility();
  nodeGraphMvp.moduleCatalogVisibility = {
    ...current,
    [type]: {
      ...(current[type] || { developer: true, home: false }),
      [key]: Boolean(visible),
    },
  };
  saveNodeGraphModuleCatalogVisibilityLocal();
  renderNodeGraphModuleStoreCatalog();
}

function normalizeNodeGraphModuleStoreDepartment(department = "") {
  const value = String(department || "");
  if (value === "Sequencer") {
    return "Sequence";
  }
  return value;
}

function setNodeGraphModuleStoreDepartment(department = "") {
  nodeGraphMvp.moduleStoreDepartment = normalizeNodeGraphModuleStoreDepartment(department);
  renderNodeGraphModuleStoreCatalog();
  if (typeof saveNodeGraphModuleStoreStateToUserSettings === "function") {
    saveNodeGraphModuleStoreStateToUserSettings();
  }
}

function saveNodeGraphModuleStoreStateToUserSettings() {
  if (
    typeof serializeNodeUiDevSettings === "function" &&
    typeof saveNodeUiDevLocalDefaultSettings === "function"
  ) {
    saveNodeUiDevLocalDefaultSettings(serializeNodeUiDevSettings());
  }
}

function nodeGraphNormalizeModuleDepartmentSearch(value = "") {
  return String(value || "").trim().toLowerCase();
}

function nodeGraphModuleStoreEntryMatchesSearch(entry, query) {
  const needle = nodeGraphNormalizeModuleDepartmentSearch(query);
  if (!needle) {
    return true;
  }
  const haystack = [
    entry.label,
    entry.type,
    entry.category,
    entry.description,
    ...(entry.notes || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function nodeGraphModuleStoreDepartmentMatchesSearch(department, entries, query) {
  const needle = nodeGraphNormalizeModuleDepartmentSearch(query);
  if (!needle) {
    return true;
  }
  const haystack = [
    department,
    ...(entries || []).flatMap((entry) => [
      entry.label,
      entry.type,
      entry.description,
      ...(entry.notes || []),
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function nodeGraphModuleStoreSearchResultOrder(a, b) {
  const implementedDelta = Number(Boolean(b?.implemented)) - Number(Boolean(a?.implemented));
  if (implementedDelta) {
    return implementedDelta;
  }
  return String(a?.label || "").localeCompare(String(b?.label || ""));
}

function nodeGraphModuleStorePublicEntriesByDepartment(entries = []) {
  const groups = new Map();
  for (const department of nodeGraphModuleStoreDepartments) {
    groups.set(department, []);
  }
  entries
    .filter((entry) => entry.visible)
    .forEach((entry) => {
      const department = entry.category || "Other";
      if (!groups.has(department)) {
        groups.set(department, []);
      }
      groups.get(department).push(entry);
    });
  return [...groups.entries()]
    .map(([department, departmentEntries]) => [
      department,
      departmentEntries.sort((a, b) => a.label.localeCompare(b.label)),
    ])
    .sort(([a], [b]) => {
      const aIndex = nodeGraphModuleStoreDepartments.indexOf(a);
      const bIndex = nodeGraphModuleStoreDepartments.indexOf(b);
      const normalizedA = aIndex === -1 ? Number.POSITIVE_INFINITY : aIndex;
      const normalizedB = bIndex === -1 ? Number.POSITIVE_INFINITY : bIndex;
      return normalizedA - normalizedB || a.localeCompare(b);
    });
}

const nodeGraphModuleShopWindowDefaultSize = Object.freeze({
  width: 180,
  height: 620,
  minWidth: 96,
  maxWidth: 980,
  minHeight: 120,
  maxHeight: 760,
});

function normalizeNodeGraphModuleShopWindowSize(size = {}) {
  if (typeof normalizeNodeGraphFloatingWindowSize === "function") {
    return normalizeNodeGraphFloatingWindowSize(size, nodeGraphModuleShopWindowDefaultSize);
  }
  const source = size && typeof size === "object" ? size : {};
  return {
    width: Math.max(
      nodeGraphModuleShopWindowDefaultSize.minWidth,
      Math.min(
        nodeGraphModuleShopWindowDefaultSize.maxWidth,
        Math.round(Number(source.width) || nodeGraphModuleShopWindowDefaultSize.width),
      ),
    ),
    height: Math.max(
      nodeGraphModuleShopWindowDefaultSize.minHeight,
      Math.min(
        nodeGraphModuleShopWindowDefaultSize.maxHeight,
        Math.round(Number(source.height) || nodeGraphModuleShopWindowDefaultSize.height),
      ),
    ),
  };
}

function applyNodeGraphModuleShopWindowSize(size = {}) {
  const panel = document.getElementById("nodeModuleShopView");
  const normalized = normalizeNodeGraphModuleShopWindowSize(size);
  if (panel) {
    if (typeof applyNodeGraphFloatingWindowSizeVars === "function") {
      applyNodeGraphFloatingWindowSizeVars(panel, "node-module-shop", nodeGraphModuleShopWindowDefaultSize, normalized);
    } else {
      panel.style.setProperty("--node-module-shop-width", `${normalized.width}px`);
      panel.style.setProperty("--node-module-shop-height", `${normalized.height}px`);
    }
  }
  return normalized;
}

function nodeGraphModuleShopWindowSizeFromElement(panel = document.getElementById("nodeModuleShopView")) {
  const rect = panel?.getBoundingClientRect?.();
  return normalizeNodeGraphModuleShopWindowSize({
    width: rect?.width,
    height: rect?.height,
  });
}

function saveNodeGraphModuleShopWindowSizeToUserSettings() {
  const panel = document.getElementById("nodeModuleShopView");
  if (typeof rememberNodeGraphWorkspaceWindowState === "function") {
    rememberNodeGraphWorkspaceWindowState(
      "moduleBrowser",
      panel,
      { open: !panel?.hidden, size: nodeGraphModuleShopWindowSizeFromElement(panel) },
      { status: false },
    );
  }
}

function handleNodeGraphModuleDepartmentSearchInput(event) {
  nodeGraphMvp.moduleStoreDepartmentSearch = String(event?.currentTarget?.value || "");
  renderNodeGraphModuleStoreCatalog();
}

function handleNodeGraphModuleDepartmentSearchKeydown(event) {
  if (event?.key !== "Escape") {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  nodeGraphMvp.moduleStoreDepartmentSearch = "";
  event.currentTarget.value = "";
  renderNodeGraphModuleStoreCatalog();
}

function nodeGraphModuleStoreDemoPatchAvailable(type) {
  return Boolean(
    Object.hasOwn(nodeGraphModuleDefinitions, type) &&
    !["audioInput", "groupInput", "groupOutput", "moduleGroup", "output"].includes(type)
  );
}

function nodeGraphModuleStoreDemoListenAvailable(type) {
  if (!nodeGraphModuleStoreDemoPatchAvailable(type)) {
    return false;
  }
  return nodeGraphPatchNodeOutputPorts(createNodeGraphPatchNode(type, { id: "demo" })).length > 0;
}

function nodeGraphModuleStoreDemoPatch(type) {
  if (!nodeGraphModuleStoreDemoPatchAvailable(type)) {
    return null;
  }
  const definition = nodeGraphModuleDefinitions[type];
  const outputPorts = nodeGraphPatchNodeOutputPorts(createNodeGraphPatchNode(type, { id: "demo" }));
  const sourcePort = outputPorts.find((port) => port !== "Gate") || outputPorts[0] || "";
  const nodes = [
    createNodeGraphPatchNode(type, { gx: 3, gy: 5, id: "demo" }),
    createNodeGraphPatchNode("output", { gx: 16, gy: 5, id: "output" }),
  ];
  const connections = [];
  if (sourcePort) {
    connections.push({
      destinationNode: "output",
      destinationPort: "Left",
      sourceNode: "demo",
      sourcePort,
    });
    connections.push({
      destinationNode: "output",
      destinationPort: "Right",
      sourceNode: "demo",
      sourcePort,
    });
  }
  return validateNodeGraphPatch({
    audio: { targetSampleRate: 44100 },
    bypassedNodes: [],
    connections,
    format: { ...nodeGraphPatchFormat },
    grid: { ...nodeGraphGrid },
    info: {
      author: "Soundemote",
      description: `Demo patch for ${nodeGraphNodeLabels[type] || type}.`,
      name: `${nodeGraphNodeLabels[type] || type} demo`,
      tags: `${definition?.category || "module"}, demo`,
    },
    modulations: [],
    monitors: [],
    nodes,
    timing: {
      tempoBpm: 120,
      timeSignatureDenominator: 4,
      timeSignatureNumerator: 4,
    },
    uiItems: [],
    view: { widthGu: 22, heightGu: 13 },
    visual: normalizeNodeGraphPatchVisual(nodeGraphMvp.patch?.visual),
    windows: normalizeNodeGraphPatchWindows({}),
  });
}

function playNodeGraphRenderedAudioElement() {
  const audio = document.getElementById("audioPlayer");
  if (!audio?.src) {
    return;
  }
  audio.currentTime = 0;
  audio.play?.().catch?.((_error) => {});
}

function withNodeGraphModuleStoreDemoPatch(entry, callback) {
  const userPatch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const demoPatch = nodeGraphModuleStoreDemoPatch(entry.type);
  if (!demoPatch) {
    setNodeGraphScriptStatus(`${entry.label} demo unavailable`, false);
    return;
  }
  commitNodeGraphPatch(demoPatch, {
    record: false,
    status: `${entry.label} demo loaded`,
  });
  callback({ demoPatch, userPatch });
}

function listenToNodeGraphModuleStoreDemo(entry) {
  withNodeGraphModuleStoreDemoPatch(entry, ({ userPatch }) => {
    renderNodeGraphAudio();
    const rendered = nodeGraphMvp.rendered ? { ...nodeGraphMvp.rendered } : null;
    const statusText = rendered ? `${entry.label} demo rendered` : `${entry.label} demo render blocked`;
    commitNodeGraphPatch(userPatch, {
      record: false,
      status: "returned to your patch",
    });
    if (rendered) {
      nodeGraphMvp.rendered = rendered;
      syncNodeGraphRenderedAudioElement();
      playNodeGraphRenderedAudioElement();
      setNodeGraphScriptStatus(statusText, true);
    } else {
      markNodeGraphRenderPending(statusText);
      setNodeGraphScriptStatus(statusText, false);
    }
  });
}

function watchNodeGraphModuleStoreDemo(entry) {
  withNodeGraphModuleStoreDemoPatch(entry, () => {
    setNodeGraphViewMode("ui");
  });
}

function editNodeGraphModuleStoreDemo(entry) {
  withNodeGraphModuleStoreDemoPatch(entry, () => {
    setNodeGraphViewMode("modular-only");
  });
}

function createNodeGraphModuleStoreButton(entry) {
  const card = document.createElement(entry.visible && entry.implemented ? "button" : "div");
  const spawnLabel = `Drag into scene to spawn ${entry.label} module`;
  card.className = "scene-context-store-card";
  card.dataset.moduleEnabled = String(entry.visible);
  card.dataset.homeEnabled = String(entry.homeVisible);
  card.dataset.developerEnabled = String(entry.developerVisible);
  card.dataset.moduleImplemented = String(entry.implemented);
  card.title = entry.visible && entry.implemented
    ? `${spawnLabel}. ${entry.description || "Module reference entry."}`
    : `${entry.label}: ${entry.description || "Module reference entry."}`;
  card.setAttribute("aria-label", entry.visible && entry.implemented
    ? spawnLabel
    : `${entry.label} module unavailable`);
  if (entry.visible && entry.implemented) {
    card.dataset.contextModule = entry.type;
    card.type = "button";
    card.role = "button";
    card.tabIndex = 0;
  } else {
    card.classList.add("under-construction");
    card.setAttribute("aria-disabled", "true");
  }

  const label = document.createElement("strong");
  label.textContent = entry.label;

  if (entry.implemented) {
    card.append(label);
  } else {
    const status = document.createElement("small");
    status.textContent = "Under construction";
    card.append(label, status);
  }
  return card;
}

function createNodeGraphModuleDepartmentButton(department, entries) {
  const ad = nodeGraphModuleStoreDepartmentAds[department] || {};
  const titleText = ad.title || department;
  const button = document.createElement("button");
  button.className = "scene-context-store-department-card node-module-category-row";
  button.type = "button";
  button.dataset.storeDepartment = department;
  button.title = `${titleText}: module department`;
  button.setAttribute("aria-label", `Open ${titleText} module department.`);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    setNodeGraphModuleStoreDepartment(department);
  });

  const title = document.createElement("strong");
  title.className = "scene-context-store-department-title";
  title.textContent = titleText;

  const count = document.createElement("span");
  count.className = "scene-context-store-department-count";
  const workingCount = entries.filter((entry) => entry.visible && entry.implemented).length;
  count.textContent = String(workingCount);

  button.append(title, count);
  return button;
}

function createNodeGraphModuleStoreVisualGroupHeader(groupLabel) {
  const header = document.createElement("div");
  header.className = "scene-context-store-visual-group";
  header.textContent = groupLabel;
  return header;
}

function renderNodeGraphModuleStoreDepartmentGroup(target, groupLabel, departmentEntries, departmentSearch) {
  const matchingDepartments = departmentEntries.filter(([department, entries]) =>
    nodeGraphModuleStoreDepartmentMatchesSearch(department, entries, departmentSearch)
  );
  if (!matchingDepartments.length) {
    return;
  }
  target.append(createNodeGraphModuleStoreVisualGroupHeader(groupLabel));
  for (const [department, entries] of matchingDepartments) {
    target.append(createNodeGraphModuleDepartmentButton(department, entries));
  }
}

function loadNodeGraphModuleGroupsLocal() {
  if (!nodeGraphLocalDefaultPresetAllowed()) {
    return {};
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(nodeGraphModuleGroupStorageKey) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function saveNodeGraphModuleGroupsLocal(groups) {
  if (!nodeGraphLocalDefaultPresetAllowed()) {
    return false;
  }
  try {
    window.localStorage.setItem(nodeGraphModuleGroupStorageKey, JSON.stringify(groups));
    return true;
  } catch {
    return false;
  }
}

function createNodeGraphModuleGroupButton(name, group) {
  const card = document.createElement("div");
  card.className = "scene-context-store-card";
  card.dataset.moduleGroup = name;
  card.dataset.contextGroup = name;
  const label = document.createElement("strong");
  label.textContent = name;
  card.append(label);
  return card;
}

function renderNodeGraphModuleGroupCatalog() {
  const shell = document.getElementById("nodeModuleGroups");
  const target = document.getElementById("nodeModuleGroupList");
  if (!shell || !target) {
    return;
  }
  const groups = loadNodeGraphModuleGroupsLocal();
  const names = Object.keys(groups).sort((a, b) => a.localeCompare(b));
  target.innerHTML = "";
  for (const name of names) {
    target.append(createNodeGraphModuleGroupButton(name, groups[name]));
  }
  shell.hidden = names.length === 0;
}

function renderNodeGraphModuleStoreCatalog() {
  const available = document.getElementById("nodeModuleDepartmentList");
  const homeShell = document.getElementById("nodeModuleHomeShelfShell");
  const homeShelf = document.getElementById("nodeModuleHomeShelf");
  const shopView = document.getElementById("nodeModuleShopView");
  const backButton = document.getElementById("nodeModuleDepartmentBack");
  const departmentTitle = document.getElementById("nodeModuleDepartmentTitle");
  if (!available || !homeShell || !homeShelf || !shopView) {
    return;
  }

  available.innerHTML = "";
  homeShelf.innerHTML = "";
  const entries = nodeGraphModuleStoreEntries();
  const selectedDepartment = normalizeNodeGraphModuleStoreDepartment(nodeGraphMvp.moduleStoreDepartment || "");
  if (nodeGraphMvp.moduleStoreDepartment !== selectedDepartment) {
    nodeGraphMvp.moduleStoreDepartment = selectedDepartment;
  }
  const departmentSearch = nodeGraphMvp.moduleStoreDepartmentSearch || "";
  const searchingAllModules = !selectedDepartment &&
    Boolean(nodeGraphNormalizeModuleDepartmentSearch(departmentSearch));
  const departmentSearchField = document.getElementById("nodeModuleDepartmentSearch");
  if (departmentSearchField && departmentSearchField.value !== departmentSearch) {
    departmentSearchField.value = departmentSearch;
  }

  const publicDepartmentEntries = nodeGraphModuleStorePublicEntriesByDepartment(entries);
  const publicDepartmentNames = new Set(publicDepartmentEntries.map(([department]) => department));
  if (selectedDepartment && !publicDepartmentNames.has(selectedDepartment)) {
    nodeGraphMvp.moduleStoreDepartment = "";
    renderNodeGraphModuleStoreCatalog();
    if (typeof saveNodeGraphModuleStoreStateToUserSettings === "function") {
      saveNodeGraphModuleStoreStateToUserSettings();
    }
    return;
  }
  const matchingEntries = entries.filter((item) => nodeGraphModuleStoreEntryMatchesSearch(item, departmentSearch));
  const publicEntries = matchingEntries.filter((entry) =>
    entry.visible &&
    (!selectedDepartment || entry.category === selectedDepartment)
  );
  const visibleModuleEntries = selectedDepartment || departmentSearch
    ? [...publicEntries].sort(nodeGraphModuleStoreSearchResultOrder)
    : publicEntries;
  const homeEntries = entries.filter((entry) => entry.implemented && entry.homeVisible);

  shopView.classList.toggle("department-selected", Boolean(selectedDepartment));
  if (backButton) {
    backButton.hidden = !selectedDepartment;
  }
  if (departmentTitle) {
    departmentTitle.hidden = !selectedDepartment;
    departmentTitle.textContent = selectedDepartment || "";
  }
  available.classList.add("scene-context-store-department-list");
  available.classList.toggle("node-module-store-list", Boolean(selectedDepartment || searchingAllModules));

  for (const entry of homeEntries) {
    homeShelf.append(createNodeGraphModuleStoreButton(entry));
  }
  homeShell.hidden = homeEntries.length === 0;

  if (selectedDepartment || searchingAllModules) {
    for (const entry of visibleModuleEntries) {
      available.append(createNodeGraphModuleStoreButton(entry));
    }
  } else {
    const entriesByDepartment = new Map(publicDepartmentEntries);
    const handledDepartments = new Set();
    for (const group of nodeGraphModuleStoreVisualGroups) {
      const groupDepartmentEntries = group.departments
        .filter((department) => entriesByDepartment.has(department))
        .map((department) => {
          handledDepartments.add(department);
          return [department, entriesByDepartment.get(department)];
        });
      renderNodeGraphModuleStoreDepartmentGroup(
        available,
        group.label,
        groupDepartmentEntries,
        departmentSearch,
      );
    }
    const otherDepartmentEntries = publicDepartmentEntries.filter(([department]) => !handledDepartments.has(department));
    if (otherDepartmentEntries.length) {
      renderNodeGraphModuleStoreDepartmentGroup(available, "Other", otherDepartmentEntries, departmentSearch);
    }
  }
  if (!available.children.length) {
    const empty = document.createElement("div");
    empty.className = "scene-context-store-empty";
    empty.textContent = departmentSearch
      ? "No modules match this search."
      : selectedDepartment
        ? "No modules are available in this category."
        : "No categories are available.";
    available.append(empty);
  }
  renderNodeGraphModuleGroupCatalog();
}

function positionNodeGraphModuleShopView(x, y) {
  const panel = document.getElementById("nodeModuleShopView");
  if (!panel) {
    return;
  }
  panel.style.position = "fixed";
  panel.style.margin = "0";
  const { left, top } = nodeGraphFloatingWindowPosition(panel, x, y);
  if (typeof setNodeGraphFloatingWindowViewportPosition === "function") {
    setNodeGraphFloatingWindowViewportPosition(panel, left, top);
  } else {
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.right = "auto";
  }
  if (typeof rememberNodeGraphWorkspaceWindowState === "function") {
    rememberNodeGraphWorkspaceWindowState(
      "moduleBrowser",
      panel,
      { open: !panel.hidden, position: { left, top } },
      { persist: false },
    );
  }
}

function positionNodeGraphModuleShopViewNearPoint(point = null) {
  const panel = document.getElementById("nodeModuleShopView");
  if (!panel) {
    return;
  }
  const x = Number(point?.x);
  const y = Number(point?.y);
  panel.hidden = false;
  const rect = panel.getBoundingClientRect();
  positionNodeGraphModuleShopView(
    Number.isFinite(x) ? x : Math.max(12, (window.innerWidth - rect.width) * 0.5),
    Number.isFinite(y) ? y : 72,
  );
}

function beginNodeGraphModuleShopViewDrag(event) {
  const panel = document.getElementById("nodeModuleShopView");
  if (!panel || panel.hidden) {
    return;
  }
  beginNodeGraphFloatingWindowDrag(event, panel, "moduleShopDragging");
}

function dragNodeGraphModuleShopView(event) {
  dragNodeGraphFloatingWindow(
    event,
    "moduleShopDragging",
    document.getElementById("nodeModuleShopView"),
    (next) => {
      if (typeof rememberNodeGraphWorkspaceWindowState === "function") {
        rememberNodeGraphWorkspaceWindowState(
          "moduleBrowser",
          document.getElementById("nodeModuleShopView"),
          { open: true, position: next },
          { persist: false },
        );
      }
    },
  );
}

function endNodeGraphModuleShopViewDrag(event) {
  endNodeGraphFloatingWindowDrag(event, "moduleShopDragging", () => {
    if (typeof rememberNodeGraphWorkspaceWindowState === "function") {
      rememberNodeGraphWorkspaceWindowState(
        "moduleBrowser",
        document.getElementById("nodeModuleShopView"),
        { open: true },
        { status: false },
      );
    }
  });
}

function beginNodeGraphModuleShopViewResize(event) {
  const panel = document.getElementById("nodeModuleShopView");
  beginNodeGraphFloatingWindowResize(event, panel, "moduleShopResizing");
}

function dragNodeGraphModuleShopViewResize(event) {
  dragNodeGraphFloatingWindowResize(event, "moduleShopResizing", applyNodeGraphModuleShopWindowSize);
}

function endNodeGraphModuleShopViewResize(event) {
  endNodeGraphFloatingWindowResize(event, "moduleShopResizing", saveNodeGraphModuleShopWindowSizeToUserSettings);
}

function openNodeGraphModuleShop(point = null, windowPoint = null) {
  const panel = document.getElementById("nodeModuleShopView");
  if (panel && !panel.hidden) {
    pulseNodeGraphFloatingWindowAttention(panel);
    return;
  }
  nodeGraphMvp.sceneContextPoint = point;
  nodeGraphMvp.sceneContextTargetNode = null;
  nodeGraphMvp.sceneContextTargetWire = null;
  setNodeGraphViewMode("shop");
  renderNodeGraphModuleStoreCatalog();
  if (typeof applyNodeGraphModuleShopWindowSize === "function") {
    applyNodeGraphModuleShopWindowSize(nodeGraphMvp.workspaceWindowStates?.moduleBrowser?.size);
  }
  if (
    typeof positionNodeGraphWorkspaceWindowFromState !== "function" ||
    !positionNodeGraphWorkspaceWindowFromState("moduleBrowser", panel)
  ) {
    positionNodeGraphModuleShopViewNearPoint(windowPoint || point);
  }
  if (typeof rememberNodeGraphWorkspaceWindowState === "function") {
    rememberNodeGraphWorkspaceWindowState("moduleBrowser", panel, { open: true }, { status: false });
  }
}

function closeNodeGraphModuleShop() {
  nodeGraphMvp.sceneContextPoint = null;
  const panel = document.getElementById("nodeModuleShopView");
  if (panel) {
    panel.hidden = true;
  }
  if (typeof rememberNodeGraphWorkspaceWindowState === "function") {
    rememberNodeGraphWorkspaceWindowState("moduleBrowser", panel, { open: false }, { status: false });
  }
  setNodeGraphViewMode("modular");
}

function loadNodeGraphModuleStoreStateLocal() {
  renderNodeGraphModuleStoreCatalog();
}
