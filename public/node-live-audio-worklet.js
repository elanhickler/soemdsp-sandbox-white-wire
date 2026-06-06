const nodeLiveAdditiveHardMaxHarmonics = 1024;

const nodeLiveRaptEllipticQuarterbandSos = Object.freeze([
  Object.freeze([1.3515101236634053e-04, 1.8481719657676747e-04, 1.3515101236634053e-04, 1, -1.5863119326809123, 0.6428204816292211]),
  Object.freeze([1, -0.3714014551732318, 0.9999999999999998, 1, -1.5620959364626055, 0.7161571320953768]),
  Object.freeze([1, -1.0298229723362611, 1, 1, -1.5310702081483014, 0.8130950789236201]),
  Object.freeze([1, -1.2676395426322578, 1.0000000000000002, 1, -1.50809401930334, 0.8931580864862605]),
  Object.freeze([1, -1.3628788519102755, 1.0000000000000002, 1, -1.4983265140498274, 0.9475287279522546]),
  Object.freeze([1, -1.3980241837651683, 1, 1, -1.5032624176850438, 0.9843747059042128]),
]);

class NodeLiveAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.inputConnections = new Map();
    this.badNumberCount = 0;
    this.lastBadValueReason = "";
    this.lastBadValueNodeId = "";
    this.lastBadValueSource = "";
    this.inputMeterPeak = 0;
    this.inputMeterSamples = 0;
    this.inputMeterSquareSum = 0;
    this.meterClipCount = 0;
    this.meterCounter = 0;
    this.meterPeak = 0;
    this.meterProtectionMuteCount = 0;
    this.meterSamples = 0;
    this.meterSquareSum = 0;
    this.macroControls = new Array(10).fill(0);
    this.pitchModWheelSignal = { mod: 0, pitch: 0 };
    this.midiKeyboardGatePulseSamples = 0;
    this.midiKeyboardSignal = null;
    this.moduleGroupRuntimes = new Map();
    this.modulationConnections = new Map();
    this.nodeOutputs = new Map();
    this.nodes = new Map();
    this.noiseSeedKeys = new Map();
    this.noiseSeeds = new Map();
    this.order = [];
    this.engineSampleRate = sampleRate;
    this.hostSampleRate = sampleRate;
    this.oversamplingRatio = 1;
    this.raptEllipticDecimatorLeft = this.createRaptEllipticDecimatorState();
    this.raptEllipticDecimatorRight = this.createRaptEllipticDecimatorState();
    this.raptEllipticDecimatorRatio = 1;
    this.bandpassStates = new Map();
    this.clockDividerStates = new Map();
    this.clockStates = new Map();
    this.codeblockFunctions = new Map();
    this.cookbookFilterStates = new Map();
    this.delayedTriggerStates = new Map();
    this.expAdsrStates = new Map();
    this.fractalBrownianNoiseStates = new Map();
    this.flowerChildEnvelopeFollowerStates = new Map();
    this.highpassStates = new Map();
    this.ladderFilterStates = new Map();
    this.linearEnvelopeStates = new Map();
    this.lowpassStates = new Map();
    this.noiseGeneratorStates = new Map();
    this.noiseSampleHoldStates = new Map();
    this.oscResetStates = new Map();
    this.oscillatorLastPhaseIncrements = new Map();
    this.oscillatorStoppedSamples = new Map();
    this.outputNode = "output";
    this.patchFingerprint = "";
    this.phases = new Map();
    this.pluckEnvelopeStates = new Map();
    this.planSerial = 0;
    this.randomClockStates = new Map();
    this.sampleHoldStates = new Map();
    this.randomWalkStates = new Map();
    this.sessionId = 0;
    this.scopeBuffers = new Map();
    this.scopeCounter = 0;
    this.slewLimiterStates = new Map();
    this.smoothers = new Map();
    this.spiralStates = new Map();
    this.stepSequencerStates = new Map();
    this.triggerCounterStates = new Map();
    this.triggerDividerStates = new Map();
    this.triangleStates = new Map();
    this.vactrolEnvelopeStates = new Map();
    this.visualSinks = [];
    this.resetVisualControls();
    this.earProtector = this.createEarProtector(sampleRate);
    this.port.onmessage = (event) => this.handleMessage(event.data || {});
  }

  createEarProtector(rate = sampleRate) {
    const threshold = Math.pow(10, 6 / 20);
    const clipLimit = 0.8;
    const increment = 1 / Math.max(1, 0.0005 * rate);
    const decrement = 1 / Math.max(1, 0.15 * rate);
    const w = Math.min((Math.PI * 2) / Math.max(1, rate), 0.000142475857) * 1000;
    const a1 = Math.exp(-w);
    const b0 = 0.5 * (1 + a1);
    const b1 = -b0;
    let counter = 0;
    let inputBuffer = 0;
    let outputBuffer = 0;
    return {
      protect: (left = 0, right = left) => {
        const mono = ((Number(left) || 0) + (Number(right) || 0)) * 0.5;
        outputBuffer = b0 * mono + b1 * inputBuffer + a1 * outputBuffer;
        inputBuffer = mono;
        if (Math.abs(outputBuffer) >= threshold) {
          counter += increment;
        }
        const gain = counter >= 1 ? 0 : 1;
        counter = Math.max(0, Math.min(2, counter)) - decrement;
        return {
          left: this.clampValue((Number(left) || 0) * gain, -clipLimit, clipLimit),
          muted: gain <= 0,
          right: this.clampValue((Number(right) || 0) * gain, -clipLimit, clipLimit),
        };
      },
    };
  }

  createRaptEllipticDecimatorState() {
    return nodeLiveRaptEllipticQuarterbandSos.map(() => [0, 0]);
  }

  resetRaptEllipticDecimator() {
    this.raptEllipticDecimatorLeft = this.createRaptEllipticDecimatorState();
    this.raptEllipticDecimatorRight = this.createRaptEllipticDecimatorState();
    this.raptEllipticDecimatorRatio = this.oversamplingRatio;
  }

  processRaptEllipticDecimatorSample(input, states) {
    let y = Number(input) || 0;
    for (let section = 0; section < nodeLiveRaptEllipticQuarterbandSos.length; section += 1) {
      const [b0, b1, b2, , a1, a2] = nodeLiveRaptEllipticQuarterbandSos[section];
      const z1 = states[section][0];
      const z2 = states[section][1];
      const sectionOut = b0 * y + z1;
      states[section][0] = b1 * y - a1 * sectionOut + z2;
      states[section][1] = b2 * y - a2 * sectionOut;
      y = sectionOut;
    }
    return y;
  }

  createVisualControlState() {
    return {
      controls: {
        blue: 0,
        chromaAlpha: 0,
        chromaDrift: 0,
        chromaHue: 0,
        chromaLightness: 0,
        chromaSaturation: 0,
        chromaSpread: 0,
        green: 0,
        red: 0,
        scopePaused: 0,
        scopeTracesOff: 0,
        screenDim: 0,
        screenShake: 0,
        visualBloom: 0,
        visualBrightness: 0,
        visualGlow: 0,
        x: 0,
        y: 0,
      },
      counter: 0,
      states: new Map([
        ["blue", 0],
        ["chromaAlpha", 0],
        ["chromaDrift", 0],
        ["chromaHue", 0],
        ["chromaLightness", 0],
        ["chromaSaturation", 0],
        ["chromaSpread", 0],
        ["green", 0],
        ["red", 0],
        ["scopePaused", 0],
        ["scopeTracesOff", 0],
        ["screenDim", 0],
        ["screenShake", 0],
        ["visualBloom", 0],
        ["visualBrightness", 0],
        ["visualGlow", 0],
        ["x", 0],
        ["y", 0],
      ]),
    };
  }

  resetVisualControls() {
    const visualState = this.createVisualControlState();
    this.visualControls = visualState.controls;
    this.visualControlCounter = visualState.counter;
    this.visualControlStates = visualState.states;
  }

  handleMessage(message) {
    if (message.type === "stop") {
      this.clearPlan();
      return;
    }
    if (message.type === "setPlan") {
      this.setPlan(message.plan, message);
      return;
    }
    if (message.type === "setParams") {
      this.setParams(message.nodes, message);
      return;
    }
    if (message.type === "setMidiKeyboardSignal") {
      this.setMidiKeyboardSignal(message.signal);
      return;
    }
    if (message.type === "setMacroControls") {
      this.setMacroControls(message.values);
      return;
    }
    if (message.type === "setPitchModWheelSignal") {
      this.setPitchModWheelSignal(message.signal);
    }
  }

  clearPlan() {
    this.inputConnections = new Map();
    this.badNumberCount = 0;
    this.lastBadValueReason = "";
    this.lastBadValueNodeId = "";
    this.lastBadValueSource = "";
    this.inputMeterPeak = 0;
    this.inputMeterSamples = 0;
    this.inputMeterSquareSum = 0;
    this.meterClipCount = 0;
    this.meterCounter = 0;
    this.meterPeak = 0;
    this.meterProtectionMuteCount = 0;
    this.meterSamples = 0;
    this.meterSquareSum = 0;
    this.macroControls = new Array(10).fill(0);
    this.pitchModWheelSignal = { mod: 0, pitch: 0 };
    this.midiKeyboardGatePulseSamples = 0;
    this.midiKeyboardSignal = null;
    this.moduleGroupRuntimes = new Map();
    this.modulationConnections = new Map();
    this.nodeOutputs = new Map();
    this.nodes = new Map();
    this.order = [];
    this.patchFingerprint = "";
    this.engineSampleRate = sampleRate;
    this.hostSampleRate = sampleRate;
    this.oversamplingRatio = 1;
    this.bandpassStates = new Map();
    this.clockDividerStates = new Map();
    this.clockStates = new Map();
    this.codeblockFunctions = new Map();
    this.cookbookFilterStates = new Map();
    this.delayedTriggerStates = new Map();
    this.expAdsrStates = new Map();
    this.fractalBrownianNoiseStates = new Map();
    this.flowerChildEnvelopeFollowerStates = new Map();
    this.highpassStates = new Map();
    this.ladderFilterStates = new Map();
    this.linearEnvelopeStates = new Map();
    this.lowpassStates = new Map();
    this.noiseGeneratorStates = new Map();
    this.noiseSampleHoldStates = new Map();
    this.oscResetStates = new Map();
    this.pluckEnvelopeStates = new Map();
    this.randomClockStates = new Map();
    this.randomWalkStates = new Map();
    this.sampleHoldStates = new Map();
    this.slewLimiterStates = new Map();
    this.scopeBuffers = new Map();
    this.scopeCounter = 0;
    this.smoothers = new Map();
    this.spiralStates = new Map();
    this.stepSequencerStates = new Map();
    this.triggerCounterStates = new Map();
    this.triggerDividerStates = new Map();
    this.triangleStates = new Map();
    this.vactrolEnvelopeStates = new Map();
    this.visualSinks = [];
    this.resetVisualControls();
  }

  setPlan(plan, message = {}) {
    const patchFingerprint = message.patchFingerprint || plan?.patchFingerprint || "";
    this.patchFingerprint = patchFingerprint;
    this.planSerial = message.planSerial || 0;
    this.sessionId = message.sessionId || 0;
    this.hostSampleRate = Math.max(1, Number(message.sampleRate) || sampleRate || 44100);
    const requestedRatio = Number(message.oversamplingRatio) ||
      ((Number(message.engineSampleRate) || this.hostSampleRate) / this.hostSampleRate);
    this.oversamplingRatio = Math.max(1, Math.min(4, Math.round(requestedRatio) || 1));
    this.engineSampleRate = this.hostSampleRate * this.oversamplingRatio;
    if (this.raptEllipticDecimatorRatio !== this.oversamplingRatio) {
      this.resetRaptEllipticDecimator();
    }
    const nodes = Array.isArray(plan?.nodes) ? plan.nodes : [];
    const ids = new Set(nodes.map((node) => node.id));
    this.nodes = new Map(nodes.map((node) => [node.id, {
      id: node.id,
      codeblock: this.normalizeCodeblock(node.codeblock),
      moduleGroup: node.moduleGroup || null,
      moduleGroupPlan: node.moduleGroupPlan || null,
      paramMeta: node.paramMeta || {},
      params: node.params || {},
      type: node.type,
    }]));
    this.order = Array.isArray(plan?.order) ? [...plan.order] : [...ids];
    this.outputNode = plan?.outputNode || "output";
    this.visualSinks = (Array.isArray(plan?.visualSinks) ? plan.visualSinks : []).map((sink) => ({
      ...sink,
      inputs: (Array.isArray(sink?.inputs) ? sink.inputs : []).map((input) => ({ ...input })),
    }));
    this.inputConnections = this.buildInputConnectionMap(plan?.connections, ids);
    this.modulationConnections = this.buildModulationConnectionMap(plan?.modulations, ids);
    this.resetVisualControls();

    for (const id of ids) {
      if (!this.nodeOutputs.has(id)) {
        this.nodeOutputs.set(id, 0);
      }
      const node = this.nodes.get(id);
      if ((node?.type === "osc" || node?.type === "fbPolyBlepOsc") && !this.phases.has(id)) {
        this.phases.set(id, 0);
      }
      if ((node?.type === "osc" || node?.type === "fbPolyBlepOsc") && !this.oscResetStates.has(id)) {
        this.oscResetStates.set(id, this.createOscResetState());
      }
      if ((node?.type === "osc" || node?.type === "fbPolyBlepOsc") && !this.triangleStates.has(id)) {
        this.triangleStates.set(id, 0);
      }
      if ((node?.type === "osc" || node?.type === "fbPolyBlepOsc" || node?.type === "noise") && !this.noiseSeeds.has(id)) {
        this.noiseSeeds.set(id, this.stableSeed(id));
      }
      if (node?.type === "stereoNoise") {
        if (!this.noiseSeeds.has(`${id}:left`)) {
          this.noiseSeeds.set(`${id}:left`, this.stableSeed(`${id}:left`));
        }
        if (!this.noiseSeeds.has(`${id}:right`)) {
          this.noiseSeeds.set(`${id}:right`, this.stableSeed(`${id}:right`));
        }
      }
      if (node?.type === "spiral" && !this.spiralStates.has(id)) {
        this.spiralStates.set(id, this.createSpiralState());
      }
      if (node?.type === "highpass" && !this.highpassStates.has(id)) {
        this.highpassStates.set(id, this.createHighpassState());
      }
      if (node?.type === "lowpass" && !this.lowpassStates.has(id)) {
        this.lowpassStates.set(id, this.createLowpassState());
      }
      if (node?.type === "bandpass" && !this.bandpassStates.has(id)) {
        this.bandpassStates.set(id, this.createBandpassState());
      }
      if (node?.type === "cookbookFilter" && !this.cookbookFilterStates.has(id)) {
        this.cookbookFilterStates.set(id, this.createCookbookFilterState());
      }
      if (node?.type === "ladderFilter" && !this.ladderFilterStates.has(id)) {
        this.ladderFilterStates.set(id, this.createLadderFilterState());
      }
      if (node?.type === "clock" && !this.clockStates.has(id)) {
        this.clockStates.set(id, this.createClockState());
      }
      if (node?.type === "clockDivider" && !this.clockDividerStates.has(id)) {
        this.clockDividerStates.set(id, this.createTriggerDividerState());
      }
      if (node?.type === "delayedTrigger" && !this.delayedTriggerStates.has(id)) {
        this.delayedTriggerStates.set(id, this.createDelayedTriggerState());
      }
      if (node?.type === "randomClock" && !this.randomClockStates.has(id)) {
        this.randomClockStates.set(id, this.createRandomClockState());
      }
      if (node?.type === "sampleHold" && !this.sampleHoldStates.has(id)) {
        this.sampleHoldStates.set(id, this.createSampleHoldState());
      }
      if (node?.type === "slewLimiter" && !this.slewLimiterStates.has(id)) {
        this.slewLimiterStates.set(id, this.createSlewLimiterState());
      }
      if (node?.type === "expAdsr" && !this.expAdsrStates.has(id)) {
        this.expAdsrStates.set(id, this.createExpAdsrState());
      }
      if (node?.type === "linearEnvelope" && !this.linearEnvelopeStates.has(id)) {
        this.linearEnvelopeStates.set(id, this.createLinearEnvelopeState());
      }
      if (node?.type === "noiseGenerator" && !this.noiseGeneratorStates.has(id)) {
        this.noiseGeneratorStates.set(id, this.createNoiseGeneratorState());
      }
      if (node?.type === "noise" && !this.noiseSampleHoldStates.has(id)) {
        this.noiseSampleHoldStates.set(id, this.createNoiseSampleHoldState());
      }
      if (node?.type === "randomWalk" && !this.randomWalkStates.has(id)) {
        this.randomWalkStates.set(id, this.createRandomWalkState());
      }
      if (node?.type === "fractalBrownianNoise" && !this.fractalBrownianNoiseStates.has(id)) {
        this.fractalBrownianNoiseStates.set(id, this.createFractalBrownianNoiseState());
      }
      if (
        node?.type === "flowerChildEnvelopeFollower" &&
        !this.flowerChildEnvelopeFollowerStates.has(id)
      ) {
        this.flowerChildEnvelopeFollowerStates.set(id, this.createFlowerChildEnvelopeFollowerState());
      }
      if (node?.type === "pluckEnvelope" && !this.pluckEnvelopeStates.has(id)) {
        this.pluckEnvelopeStates.set(id, this.createPluckEnvelopeState());
      }
      if (node?.type === "stepSequencer" && !this.stepSequencerStates.has(id)) {
        this.stepSequencerStates.set(id, this.createStepSequencerState());
      }
      if (node?.type === "triggerCounter" && !this.triggerCounterStates.has(id)) {
        this.triggerCounterStates.set(id, this.createTriggerCounterState());
      }
      if (node?.type === "triggerDivider" && !this.triggerDividerStates.has(id)) {
        this.triggerDividerStates.set(id, this.createTriggerDividerState());
      }
      if (node?.type === "vactrolEnvelope" && !this.vactrolEnvelopeStates.has(id)) {
        this.vactrolEnvelopeStates.set(id, this.createVactrolEnvelopeState());
      }
      if (node?.type === "moduleGroup" && node.moduleGroupPlan && !this.moduleGroupRuntimes.has(id)) {
        this.moduleGroupRuntimes.set(id, this.createNestedRuntime(node.moduleGroupPlan));
      }
      for (const [key, value] of Object.entries(node?.params || {})) {
        const smootherKey = this.parameterKey(id, key);
        const metadata = node.paramMeta?.[key];
        if (!this.smoothers.has(smootherKey)) {
          this.smoothers.set(smootherKey, this.createSmoother(value, metadata));
        } else {
          this.updateSmoother(this.smoothers.get(smootherKey), value, metadata);
        }
      }
    }

    for (const id of [...this.phases.keys()]) {
      if (!ids.has(id)) {
        this.phases.delete(id);
      }
    }
    for (const id of [...this.oscResetStates.keys()]) {
      if (!ids.has(id)) {
        this.oscResetStates.delete(id);
      }
    }
    for (const id of [...this.triangleStates.keys()]) {
      if (!ids.has(id)) {
        this.triangleStates.delete(id);
      }
    }
    for (const id of [...this.oscillatorLastPhaseIncrements.keys()]) {
      const nodeId = String(id).split(":")[0];
      if (!ids.has(nodeId)) {
        this.oscillatorLastPhaseIncrements.delete(id);
      }
    }
    for (const id of [...this.oscillatorStoppedSamples.keys()]) {
      const nodeId = String(id).split(":")[0];
      if (!ids.has(nodeId)) {
        this.oscillatorStoppedSamples.delete(id);
      }
    }
    for (const id of [...this.noiseSeeds.keys()]) {
      const nodeId = String(id).split(":")[0];
      if (!ids.has(nodeId)) {
        this.noiseSeeds.delete(id);
      }
    }
    for (const id of [...this.noiseSeedKeys.keys()]) {
      const nodeId = String(id).split(":")[0];
      if (!ids.has(nodeId)) {
        this.noiseSeedKeys.delete(id);
      }
    }
    for (const id of [...this.nodeOutputs.keys()]) {
      if (!ids.has(id)) {
        this.nodeOutputs.delete(id);
      }
    }
    for (const id of [...this.spiralStates.keys()]) {
      if (!ids.has(id)) {
        this.spiralStates.delete(id);
      }
    }
    for (const id of [...this.highpassStates.keys()]) {
      if (!ids.has(id)) {
        this.highpassStates.delete(id);
      }
    }
    for (const id of [...this.lowpassStates.keys()]) {
      if (!ids.has(id)) {
        this.lowpassStates.delete(id);
      }
    }
    for (const id of [...this.linearEnvelopeStates.keys()]) {
      if (!ids.has(id)) {
        this.linearEnvelopeStates.delete(id);
      }
    }
    for (const id of [...this.bandpassStates.keys()]) {
      if (!ids.has(id)) {
        this.bandpassStates.delete(id);
      }
    }
    for (const id of [...this.clockStates.keys()]) {
      if (!ids.has(id)) {
        this.clockStates.delete(id);
      }
    }
    for (const id of [...this.codeblockFunctions.keys()]) {
      if (!ids.has(id)) {
        this.codeblockFunctions.delete(id);
      }
    }
    for (const id of [...this.cookbookFilterStates.keys()]) {
      if (!ids.has(id)) {
        this.cookbookFilterStates.delete(id);
      }
    }
    for (const id of [...this.ladderFilterStates.keys()]) {
      if (!ids.has(id)) {
        this.ladderFilterStates.delete(id);
      }
    }
    for (const id of [...this.clockDividerStates.keys()]) {
      if (!ids.has(id)) {
        this.clockDividerStates.delete(id);
      }
    }
    for (const id of [...this.delayedTriggerStates.keys()]) {
      if (!ids.has(id)) {
        this.delayedTriggerStates.delete(id);
      }
    }
    for (const id of [...this.sampleHoldStates.keys()]) {
      if (!ids.has(id)) {
        this.sampleHoldStates.delete(id);
      }
    }
    for (const id of [...this.slewLimiterStates.keys()]) {
      if (!ids.has(id)) {
        this.slewLimiterStates.delete(id);
      }
    }
    for (const id of [...this.expAdsrStates.keys()]) {
      if (!ids.has(id)) {
        this.expAdsrStates.delete(id);
      }
    }
    for (const id of [...this.noiseGeneratorStates.keys()]) {
      if (!ids.has(id)) {
        this.noiseGeneratorStates.delete(id);
      }
    }
    for (const id of [...this.noiseSampleHoldStates.keys()]) {
      if (!ids.has(id)) {
        this.noiseSampleHoldStates.delete(id);
      }
    }
    for (const id of [...this.randomWalkStates.keys()]) {
      if (!ids.has(id)) {
        this.randomWalkStates.delete(id);
      }
    }
    for (const id of [...this.randomClockStates.keys()]) {
      if (!ids.has(id)) {
        this.randomClockStates.delete(id);
      }
    }
    for (const id of [...this.fractalBrownianNoiseStates.keys()]) {
      if (!ids.has(id)) {
        this.fractalBrownianNoiseStates.delete(id);
      }
    }
    for (const id of [...this.flowerChildEnvelopeFollowerStates.keys()]) {
      if (!ids.has(id)) {
        this.flowerChildEnvelopeFollowerStates.delete(id);
      }
    }
    for (const id of [...this.pluckEnvelopeStates.keys()]) {
      if (!ids.has(id)) {
        this.pluckEnvelopeStates.delete(id);
      }
    }
    for (const id of [...this.stepSequencerStates.keys()]) {
      if (!ids.has(id)) {
        this.stepSequencerStates.delete(id);
      }
    }
    for (const id of [...this.triggerCounterStates.keys()]) {
      if (!ids.has(id)) {
        this.triggerCounterStates.delete(id);
      }
    }
    for (const id of [...this.triggerDividerStates.keys()]) {
      if (!ids.has(id)) {
        this.triggerDividerStates.delete(id);
      }
    }
    for (const id of [...this.vactrolEnvelopeStates.keys()]) {
      if (!ids.has(id)) {
        this.vactrolEnvelopeStates.delete(id);
      }
    }
    for (const id of [...this.moduleGroupRuntimes.keys()]) {
      if (!ids.has(id)) {
        this.moduleGroupRuntimes.delete(id);
      }
    }
    for (const key of [...this.smoothers.keys()]) {
      const [nodeId, parameter] = key.split(".");
      if (!ids.has(nodeId) || !(parameter in (this.nodes.get(nodeId)?.params || {}))) {
        this.smoothers.delete(key);
      }
    }
    this.port.postMessage({
      connectionCount: Array.isArray(plan?.connections) ? plan.connections.length : 0,
      feedbackConnectionCount: Array.isArray(plan?.feedbackConnections) ? plan.feedbackConnections.length : 0,
      feedbackModulationCount: Array.isArray(plan?.feedbackModulations) ? plan.feedbackModulations.length : 0,
      feedbackModulations: (Array.isArray(plan?.feedbackModulations) ? plan.feedbackModulations : []).map(
        (modulation) =>
          `${modulation.sourceNode}.${modulation.sourcePort} -> ${modulation.destinationNode}.${modulation.destinationParam}`,
      ),
      feedbackSignals: (Array.isArray(plan?.feedbackConnections) ? plan.feedbackConnections : []).map(
        (connection) =>
          `${connection.sourceNode}.${connection.sourcePort} -> ${connection.destinationNode}.${connection.destinationPort}`,
      ),
      modulationCount: Array.isArray(plan?.modulations) ? plan.modulations.length : 0,
      engineSampleRate: this.engineSampleRate,
      nodeCount: this.nodes.size,
      order: [...this.order],
      oversamplingRatio: this.oversamplingRatio,
      patchFingerprint,
      planSerial: this.planSerial,
      sampleRate: this.hostSampleRate,
      sessionId: this.sessionId,
      speakerOutputActive: Boolean(plan?.speakerOutputActive),
      stateReadCount: (
        (Array.isArray(plan?.feedbackConnections) ? plan.feedbackConnections.length : 0) +
        (Array.isArray(plan?.feedbackModulations) ? plan.feedbackModulations.length : 0)
      ),
      type: "planApplied",
      visualSinkCount: Array.isArray(plan?.visualSinks) ? plan.visualSinks.length : 0,
      visualSinks: Array.isArray(plan?.visualSinks) ? plan.visualSinks : [],
    });
  }

  setParams(nodes, message = {}) {
    const patchFingerprint = message.patchFingerprint || "";
    this.patchFingerprint = patchFingerprint || this.patchFingerprint;
    this.planSerial = message.planSerial || 0;
    this.sessionId = message.sessionId || 0;
    let parameterCount = 0;
    for (const node of Array.isArray(nodes) ? nodes : []) {
      const current = this.nodes.get(node.id);
      if (!current) {
        continue;
      }
      current.params = { ...(node.params || {}) };
      current.paramMeta = { ...(node.paramMeta || {}) };
      parameterCount += Object.keys(current.params || {}).length;
      for (const [key, value] of Object.entries(current.params || {})) {
        const smootherKey = this.parameterKey(node.id, key);
        const metadata = current.paramMeta?.[key];
        if (!this.smoothers.has(smootherKey)) {
          this.smoothers.set(smootherKey, this.createSmoother(value, metadata));
        } else {
          this.updateSmoother(this.smoothers.get(smootherKey), value, metadata);
        }
      }
    }
    this.port.postMessage({
      nodeCount: this.nodes.size,
      order: [...this.order],
      parameterCount,
      patchFingerprint,
      planSerial: this.planSerial,
      sessionId: this.sessionId,
      type: "paramsApplied",
    });
  }

  setMidiKeyboardSignal(signal) {
    const source = signal && typeof signal === "object" ? signal : {};
    const midi = this.clampValue(Math.round(Number(source.midi) || 60), 0, 127);
    const keyIndex = this.clampValue(Number(source.keyIndex) || 0, 0, 24);
    const keyQuantized = this.clampValue(Number(source.keyQuantized) || keyIndex / 24, 0, 1);
    const frequency = Math.max(0, Number(source.frequency) || 440 * (2 ** ((midi - 69) / 12)));
    if (Number(source.gatePulse) > 0) {
      this.midiKeyboardGatePulseSamples = 1;
    }
    this.midiKeyboardSignal = {
      gate: Number(source.gate) > 0 ? 1 : 0,
      gatePulse: Number(source.gatePulse) > 0 ? 1 : 0,
      x: this.clampValue(Number(source.x) || keyQuantized, 0, 1),
      y: this.clampValue(Number(source.y) || 0, 0, 1),
      keyIndex,
      keyQuantized,
      midi,
      pitchValue: this.clampValue(Number(source.pitchValue) || midi, 0, 127),
      midiNormalized: this.clampValue(Number(source.midiNormalized) || midi / 127, 0, 1),
      tenthVoltPerOctave: this.clampValue(Number(source.tenthVoltPerOctave) || midi / 120, 0, 1),
      increment: Math.max(0, Number(source.increment) || frequency / Math.max(1, this.engineSampleRate || sampleRate)),
      frequency,
    };
  }

  setMacroControls(values) {
    this.macroControls = Array.from({ length: 10 }, (_, index) => (
      this.clampValue(Number(values?.[index]) || 0, 0, 1)
    ));
  }

  setPitchModWheelSignal(signal) {
    const source = signal && typeof signal === "object" ? signal : {};
    const pitch = Number(source.pitch);
    this.pitchModWheelSignal = {
      mod: this.clampValue(Number(source.mod) || 0, 0, 1),
      pitch: this.clampValue(Number.isFinite(pitch) ? pitch : 0, -1, 1),
    };
  }

  buildInputConnectionMap(connections, ids) {
    const map = new Map();
    for (const connection of Array.isArray(connections) ? connections : []) {
      if (!ids.has(connection.sourceNode) || !ids.has(connection.destinationNode)) {
        continue;
      }
      const key = this.inputKey(connection.destinationNode, connection.destinationPort);
      const list = map.get(key) || [];
      list.push({ ...connection });
      map.set(key, list);
    }
    return map;
  }

  buildModulationConnectionMap(modulations, ids) {
    const map = new Map();
    for (const modulation of Array.isArray(modulations) ? modulations : []) {
      if (!ids.has(modulation.sourceNode) || !ids.has(modulation.destinationNode)) {
        continue;
      }
      const key = this.parameterKey(modulation.destinationNode, modulation.destinationParam);
      const list = map.get(key) || [];
      list.push({ ...modulation });
      map.set(key, list);
    }
    return map;
  }

  inputKey(node, port) {
    return `${node}.${port}`;
  }

  parameterKey(node, parameter) {
    return `${node}.${parameter}`;
  }

  stableSeed(text) {
    let seed = 0x12345678;
    for (const character of String(text)) {
      seed = (Math.imul(seed ^ character.charCodeAt(0), 16777619)) >>> 0;
    }
    return seed || 0x12345678;
  }

  wrapValue(value, min, max) {
    const range = max - min;
    if (!Number.isFinite(range) || range <= 0) {
      return min;
    }
    return min + ((((value - min) % range) + range) % range);
  }

  clampValue(value, min, max) {
    const number = Number(value);
    const reason = this.badValueReason(number);
    if (reason) {
      this.badNumberCount += 1;
      if (!this.lastBadValueNodeId) {
        this.lastBadValueReason = reason;
        this.lastBadValueSource = "";
      }
      return 0;
    }
    return Math.max(min, Math.min(max, number));
  }

  normalizeGraphNumber(value, fallback = 0, min = 0, max = 1) {
    const number = Number(value);
    return Number.isFinite(number)
      ? Math.max(min, Math.min(max, number))
      : fallback;
  }

  normalizeGraphShape(value) {
    const shape = String(value || "").trim();
    return shape === "linear" || shape === "exponential" || shape === "rational"
      ? shape
      : "rational";
  }

  normalizeGraphNode(value = {}, index = 0) {
    const source = value && typeof value === "object" ? value : {};
    const fallback = index <= 0
      ? { c: 0, shape: "linear", x: 0, y: 0 }
      : { c: 0, shape: "rational", x: 1, y: 1 };
    return {
      c: this.normalizeGraphNumber(source.c, fallback.c, -0.999, 0.999),
      shape: this.normalizeGraphShape(source.shape ?? fallback.shape),
      x: this.normalizeGraphNumber(source.x, fallback.x),
      y: this.normalizeGraphNumber(source.y, fallback.y),
    };
  }

  normalizeGraph(value = {}) {
    const source = value && typeof value === "object" ? value : {};
    const inputNodes = Array.isArray(source.nodes) && source.nodes.length >= 2
      ? source.nodes
      : [{ c: 0, shape: "linear", x: 0, y: 0 }, { c: 0, shape: "rational", x: 1, y: 1 }];
    const nodes = inputNodes
      .slice(0, 32)
      .map((node, index) => this.normalizeGraphNode(node, index))
      .sort((left, right) => left.x - right.x);
    if (nodes.length < 2) {
      nodes.push(
        this.normalizeGraphNode({ c: 0, shape: "linear", x: 0, y: 0 }, 0),
        this.normalizeGraphNode({ c: 0, shape: "rational", x: 1, y: 1 }, 1),
      );
    }
    return { nodes };
  }

  graphRationalCurve(position, contour = 0) {
    const p = this.normalizeGraphNumber(position, 0, 0, 1);
    const c = this.normalizeGraphNumber(contour, 0, -0.999, 0.999);
    if (Math.abs(c) < 0.000001) {
      return p;
    }
    return c < 0
      ? (p * (1 + c)) / (1 + c * p)
      : p / (1 - c + c * p);
  }

  graphExponentialCurve(position, contour = 0) {
    const p = this.normalizeGraphNumber(position, 0, 0, 1);
    const c = this.normalizeGraphNumber(0.5 * (contour + 1), 0.5, 0.001, 0.999);
    const a = 2 * Math.log((1 - c) / c);
    if (!Number.isFinite(a) || Math.abs(a) < 0.000001) {
      return p;
    }
    const denominator = 1 - Math.exp(a);
    return Math.abs(denominator) < 0.000001 ? p : (1 - Math.exp(p * a)) / denominator;
  }

  graphSegmentValue(graph, x, index) {
    const left = graph.nodes[index];
    const right = graph.nodes[index + 1];
    const dx = right.x - left.x;
    if (Math.abs(dx) < 0.000001) {
      return 0.5 * (left.y + right.y);
    }
    const p = this.normalizeGraphNumber((x - left.x) / dx, 0, 0, 1);
    const contour = this.normalizeGraphNumber(right.c, 0, -0.999, 0.999);
    const shaped = right.shape === "exponential"
      ? this.graphExponentialCurve(p, contour)
      : right.shape === "linear"
        ? p
        : this.graphRationalCurve(p, contour);
    return left.y + (right.y - left.y) * shaped;
  }

  graphValueAt(graphValue, xValue) {
    const graph = this.normalizeGraph(graphValue);
    const x = this.normalizeGraphNumber(xValue, 0, -Infinity, Infinity);
    if (!graph.nodes.length) {
      return 0;
    }
    if (x < graph.nodes[0].x) {
      return graph.nodes[0].y;
    }
    for (let index = 0; index < graph.nodes.length - 1; index += 1) {
      if (x <= graph.nodes[index + 1].x) {
        return this.safeFilterNumber(this.graphSegmentValue(graph, x, index), null);
      }
    }
    return graph.nodes[graph.nodes.length - 1].y;
  }

  outputSampleClipped(value) {
    return this.badValueReason(value) || value < -0.95 || value > 0.95;
  }

  badValueReason(value) {
    const number = Number(value);
    if (Number.isNaN(number)) {
      return "NaN";
    }
    if (!Number.isFinite(number)) {
      return "inf";
    }
    if (Math.abs(number) > 999999999) {
      return "exploded";
    }
    if (number !== 0 && Math.abs(number) < 1.1754943508222875e-38) {
      return "denormal";
    }
    return "";
  }

  scopeScalarValue(value) {
    const readNumber = (candidate) => {
      const number = Number(candidate);
      if (this.badValueReason(number)) {
        return null;
      }
      return this.clampValue(number, -1, 1);
    };
    if (typeof value === "number") {
      return readNumber(value) ?? 0;
    }
    if (!value || typeof value !== "object") {
      return 0;
    }
    for (const key of ["Out", "Out X", "Out Y", "Out Z", "Left", "Right", "X", "Y", "Z", "Pulse", "Gate", "Count"]) {
      const number = readNumber(value[key]);
      if (number !== null) {
        return number;
      }
    }
    for (const candidate of Object.values(value)) {
      const number = readNumber(candidate);
      if (number !== null) {
        return number;
      }
    }
    return 0;
  }

  captureModuleScopeFrame() {
    for (const nodeId of this.order) {
      if (!this.nodeOutputs.has(nodeId)) {
        continue;
      }
      this.captureModuleScopeOutput(nodeId, this.nodeOutputs.get(nodeId));
    }
    for (const sink of this.visualSinks || []) {
      const nodeId = String(sink?.nodeId || "");
      if (!nodeId) {
        continue;
      }
      const value = (sink.inputs || [])
        .filter((input) => input?.connected)
        .reduce((inputSum, input) => inputSum + (input.connections || []).reduce(
          (connectionSum, connection) => connectionSum + this.readRuntimePortOutput(
            null,
            connection.sourceNode,
            connection.sourcePort,
            0,
            1,
          ),
          0,
        ), 0);
      const samples = this.scopeBuffers.get(nodeId) || [];
      samples.push(this.scopeScalarValue(value));
      this.scopeBuffers.set(nodeId, samples);
    }
  }

  captureModuleScopeOutput(nodeId, output) {
    const id = String(nodeId || "");
    if (!id) {
      return;
    }
    const samples = this.scopeBuffers.get(id) || [];
    samples.push(this.scopeScalarValue(output));
    this.scopeBuffers.set(id, samples);
    if (!output || typeof output !== "object") {
      return;
    }
    for (const port of ["Left", "Right"]) {
      if (!Number.isFinite(Number(output[port]))) {
        continue;
      }
      const portId = `${id}:${port}`;
      const portSamples = this.scopeBuffers.get(portId) || [];
      portSamples.push(this.scopeScalarValue(output[port]));
      this.scopeBuffers.set(portId, portSamples);
    }
  }

  postModuleScopeSnapshot() {
    const values = [];
    for (const [nodeId, samples] of this.scopeBuffers) {
      if (!samples.length) {
        continue;
      }
      values.push([nodeId, samples]);
    }
    if (!values.length) {
      return;
    }
    this.port.postMessage({
      patchFingerprint: this.patchFingerprint,
      sampleRate: this.engineSampleRate,
      sessionId: this.sessionId,
      type: "scope",
      values,
    });
    this.scopeBuffers = new Map();
  }

  shortestWrapDelta(from, to, min, max) {
    const range = max - min;
    if (!Number.isFinite(range) || range <= 0) {
      return to - from;
    }
    let delta = to - from;
    if (delta > range / 2) {
      delta -= range;
    } else if (delta < -range / 2) {
      delta += range;
    }
    return delta;
  }

  createSmoother(initialValue, metadata = {}) {
    const value = Number(initialValue);
    const safeValue = Number.isFinite(value) ? value : 0;
    return {
      current: safeValue,
      linearSmoothing: metadata?.linearSmoothing !== false,
      max: Number.isFinite(Number(metadata?.max)) ? Number(metadata.max) : 1,
      min: Number.isFinite(Number(metadata?.min)) ? Number(metadata.min) : 0,
      target: safeValue,
      wraparound: Boolean(metadata?.wraparound),
    };
  }

  updateSmoother(smoother, targetValue, metadata = {}) {
    const value = Number(targetValue);
    smoother.target = Number.isFinite(value) ? value : smoother.target;
    smoother.linearSmoothing = metadata?.linearSmoothing !== false;
    smoother.max = Number.isFinite(Number(metadata?.max)) ? Number(metadata.max) : smoother.max;
    smoother.min = Number.isFinite(Number(metadata?.min)) ? Number(metadata.min) : smoother.min;
    smoother.wraparound = Boolean(metadata?.wraparound);
    if (!smoother.linearSmoothing) {
      smoother.current = smoother.target;
    }
  }

  readSmoothedParameter(node, key, fallback, frame, frames) {
    const smoother = this.smoothers.get(this.parameterKey(node?.id, key));
    if (!smoother) {
      const value = Number(node?.params?.[key]);
      return Number.isFinite(value) ? value : fallback;
    }
    if (!smoother.linearSmoothing || frames <= 1) {
      return smoother.target;
    }
    const progress = (frame + 1) / frames;
    const delta = smoother.wraparound
      ? this.shortestWrapDelta(smoother.current, smoother.target, smoother.min, smoother.max)
      : smoother.target - smoother.current;
    const value = smoother.current + delta * progress;
    return smoother.wraparound
      ? this.wrapValue(value, smoother.min, smoother.max)
      : value;
  }

  finishSmoothing() {
    for (const smoother of this.smoothers.values()) {
      smoother.current = smoother.wraparound
        ? this.wrapValue(smoother.target, smoother.min, smoother.max)
        : smoother.target;
    }
    for (const runtime of this.moduleGroupRuntimes?.values?.() || []) {
      runtime.finishSmoothing();
    }
  }

  applyParameterBounds(value, metadata = {}) {
    const min = Number(metadata.min);
    const max = Number(metadata.max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
      return value;
    }
    return metadata.wraparound
      ? this.wrapValue(value, min, max)
      : this.clampValue(value, min, max);
  }

  readRuntimeOutput(frameValues, nodeId, port = "Out") {
    const output = frameValues?.has(nodeId)
      ? frameValues.get(nodeId)
      : this.nodeOutputs.get(nodeId);
    if (output && typeof output === "object") {
      return Number(output[port] ?? output.Out ?? 0);
    }
    return output === undefined || output === null ? 0 : Number(output);
  }

  parameterOutputExists(node, port) {
    return Boolean(node?.params && Object.hasOwn(node.params, port));
  }

  normalizeParameterOutputValue(value, metadata = {}) {
    return this.parameterValueToNormalizedSignal(value, metadata);
  }

  normalizeParameterModulationInput(value, metadata = {}) {
    const number = Number(value) || 0;
    return metadata?.kind === "frequency" && metadata.nonlinearSlider
      ? this.clampValue(number, -1, 1)
      : this.clampValue(number, 0, 1);
  }

  parameterSkewExponent(metadata = {}) {
    if (!metadata.nonlinearSlider) {
      return 1;
    }
    const min = Number(metadata.min);
    const max = Number(metadata.max);
    const mid = Number(metadata.mid);
    const range = max - min;
    if (!Number.isFinite(range) || range <= 0 || !Number.isFinite(mid)) {
      return 1;
    }
    const normalizedMid = this.clampValue((mid - min) / range, 0.000001, 0.999999);
    return Math.log(normalizedMid) / Math.log(0.5);
  }

  parameterValueToNormalizedSignal(value, metadata = {}) {
    const min = Number(metadata.min);
    const max = Number(metadata.max);
    const range = max - min;
    if (!Number.isFinite(range) || range <= 0) {
      return 0;
    }
    const bounded = metadata.wraparound
      ? this.wrapValue(Number(value) || 0, min, max)
      : this.clampValue(Number(value) || 0, min, max);
    const normalizedValue = this.clampValue((bounded - min) / range, 0, 1);
    return this.clampValue(normalizedValue ** (1 / this.parameterSkewExponent(metadata)), 0, 1);
  }

  normalizedSignalToParameterValue(signal, metadata = {}) {
    const min = Number(metadata.min);
    const max = Number(metadata.max);
    const range = max - min;
    if (!Number.isFinite(range) || range <= 0) {
      return Number.isFinite(min) ? min : 0;
    }
    const normalizedSignal = metadata.wraparound
      ? this.wrapValue(Number(signal) || 0, 0, 1)
      : this.clampValue(Number(signal) || 0, 0, 1);
    const normalizedValue = normalizedSignal ** this.parameterSkewExponent(metadata);
    return this.applyParameterBounds(min + range * normalizedValue, metadata);
  }

  applyParameterModulation(base, modulationSignal, metadata = {}) {
    if (metadata?.kind === "frequency" && metadata.nonlinearSlider) {
      const baseFrequency = Math.max(0.000001, Number(base) || 0.000001);
      const octaves = (Number(modulationSignal) || 0) / 0.1;
      return this.applyParameterBounds(baseFrequency * (2 ** octaves), metadata);
    }
    const baseSignal = this.parameterValueToNormalizedSignal(base, metadata);
    return this.normalizedSignalToParameterValue(baseSignal + modulationSignal, metadata);
  }

  readRuntimePortOutput(frameValues, nodeId, port = "Out", frame = 0, frames = 1) {
    const node = this.nodes.get(nodeId);
    if (!this.parameterOutputExists(node, port)) {
      return this.readRuntimeOutput(frameValues, nodeId, port);
    }
    const value = this.readSmoothedParameter(node, port, 0, frame, frames);
    return this.normalizeParameterOutputValue(value, node?.paramMeta?.[port] || {});
  }

  readEffectiveParameter(node, key, fallback, frame, frames, frameValues) {
    const base = this.readSmoothedParameter(node, key, fallback, frame, frames);
    const metadata = node?.paramMeta?.[key] || {};
    const modulations = this.modulationConnections.get(this.parameterKey(node?.id, key)) || [];
    const modulationSignal = modulations.reduce(
      (sum, modulation) => sum + this.normalizeParameterModulationInput(this.readRuntimePortOutput(
        frameValues,
        modulation.sourceNode,
        modulation.sourcePort,
        frame,
        frames,
      ), metadata),
      0,
    );
    return this.applyParameterModulation(base, modulationSignal, metadata);
  }

  phaseRadians(value) {
    return this.wrapValue(Number(value) || 0, 0, 1) * Math.PI * 2;
  }

  nextNoiseSample(nodeId) {
    const seed = (Math.imul(1664525, this.noiseSeeds.get(nodeId) || 0x12345678) + 1013904223) >>> 0;
    this.noiseSeeds.set(nodeId, seed);
    return (seed / 0xffffffff) * 2 - 1;
  }

  currentNoiseSample(nodeId) {
    if (!this.noiseSeeds.has(nodeId)) {
      return this.nextNoiseSample(nodeId);
    }
    return ((this.noiseSeeds.get(nodeId) || 0) / 0xffffffff) * 2 - 1;
  }

  noiseSeedKey(nodeId, seedValue, channel = "") {
    const seed = Math.max(0, Math.min(99999, Math.floor(Number(seedValue) || 0)));
    return `${nodeId}${channel ? `:${channel}` : ""}:seed:${seed}`;
  }

  nextSeededNoiseSample(nodeId, seedValue, channel = "") {
    const noiseId = channel ? `${nodeId}:${channel}` : nodeId;
    const seedKey = this.noiseSeedKey(nodeId, seedValue, channel);
    if (this.noiseSeedKeys.get(noiseId) !== seedKey) {
      this.noiseSeedKeys.set(noiseId, seedKey);
      this.noiseSeeds.set(noiseId, this.stableSeed(seedKey));
    }
    return this.nextNoiseSample(noiseId);
  }

  noiseSampleHoldSample(state, nodeId, seedValue, speed, rate = sampleRate) {
    const safeRate = Math.max(1, Number(rate) || sampleRate || 44100);
    const safeSpeed = this.clampValue(Number(speed) || 0, 0, 1);
    const seedKey = this.noiseSeedKey(nodeId, seedValue);
    if (state.seedKey !== seedKey) {
      state.seedKey = seedKey;
      state.initialized = false;
      state.phase = 0;
    }
    if (!state.initialized) {
      state.held = this.nextSeededNoiseSample(nodeId, seedValue);
      state.initialized = true;
    }
    const clockRate = safeSpeed * safeRate * 0.5;
    if (clockRate <= 0) {
      return state.held;
    }
    state.phase += clockRate / safeRate;
    while (state.phase >= 1) {
      state.phase -= 1;
      state.held = this.nextSeededNoiseSample(nodeId, seedValue);
    }
    return state.held;
  }

  polyBlep(phaseCycle, phaseIncrement) {
    const dt = this.clampValue(Math.abs(Number(phaseIncrement) || 0), 1e-6, 0.5);
    if (phaseCycle < dt) {
      const t = phaseCycle / dt;
      return t + t - t * t - 1;
    }
    if (phaseCycle > 1 - dt) {
      const t = (phaseCycle - 1) / dt;
      return t * t + t + t + 1;
    }
    return 0;
  }

  polyBlepSquare(phaseCycle, phaseIncrement) {
    let value = phaseCycle < 0.5 ? 1 : -1;
    value += this.polyBlep(phaseCycle, phaseIncrement);
    value -= this.polyBlep(this.wrapValue(phaseCycle + 0.5, 0, 1), phaseIncrement);
    return value;
  }

  oscillatorSample(nodeId, phase, phaseIncrement, waveform) {
    const phaseDelta = Number(phaseIncrement) || 0;
    const phaseStopped = Math.abs(phaseDelta) <= 1e-12;
    if (phaseStopped && this.oscillatorStoppedSamples.has(nodeId)) {
      return this.oscillatorStoppedSamples.get(nodeId) || 0;
    }
    const renderPhaseIncrement = phaseStopped
      ? Number(this.oscillatorLastPhaseIncrements.get(nodeId)) || 0
      : phaseDelta;
    const phaseCycle = this.wrapValue(phase / (Math.PI * 2), 0, 1);
    let sample = 0;
    switch (Math.round(Number(waveform) || 0)) {
      case 1:
        sample = this.polyBlepSquare(phaseCycle, renderPhaseIncrement);
        break;
      case 2:
        {
          const triangle = this.triangleStates.get(nodeId) || 0;
          if (phaseStopped) {
            sample = triangle;
            break;
          }
          const nextTriangle = (triangle + this.polyBlepSquare(phaseCycle, renderPhaseIncrement) * phaseDelta * 4) * 0.995;
          this.triangleStates.set(nodeId, this.clampValue(nextTriangle, -1, 1));
          sample = this.clampValue(nextTriangle, -1, 1);
          break;
        }
      case 3:
        sample = Math.sin(phase);
        break;
      case 4:
        sample = phaseStopped ? this.currentNoiseSample(nodeId) : this.nextNoiseSample(nodeId);
        break;
      case 0:
      default:
        sample = 1 - phaseCycle * 2 + this.polyBlep(phaseCycle, renderPhaseIncrement);
        break;
    }
    if (phaseStopped) {
      this.oscillatorStoppedSamples.set(nodeId, sample);
    } else {
      this.oscillatorStoppedSamples.delete(nodeId);
      this.oscillatorLastPhaseIncrements.set(nodeId, phaseDelta);
    }
    return sample;
  }

  forwardBackwardPolyBlepOscillatorSample(nodeId, phase, phaseIncrement, waveform) {
    return this.oscillatorSample(nodeId, phase, phaseIncrement, waveform);
  }

  additiveWaveformHarmonic(waveform, harmonic, modA = 0.5) {
    const n = Math.max(1, Math.floor(Number(harmonic) || 1));
    const h = n;
    const mod = this.clampValue(Number(modA) || 0, 0, 1);
    switch (Math.round(Number(waveform) || 0)) {
      case 0:
        return { amplitude: n === Math.max(1, Math.floor(99 * mod + 1)) ? 1 : 0, phase: 0 };
      case 2:
        return { amplitude: n % 2 === 1 ? 1 / h : 0, phase: mod * 0.5 };
      case 3:
        return { amplitude: n % 2 === 1 ? 1 / (h * h) : 0, phase: n % 4 === 1 ? 0 : 0.5 };
      case 4:
        return { amplitude: n % 2 === 1 ? 1 / h : (1 / h) * (1 - mod), phase: 0 };
      case 5:
        return { amplitude: Math.cos(h * mod * 0.5) / h, phase: 0 };
      case 6:
        {
          const peak = this.clampValue(mod, 0.001, 0.999);
          return { amplitude: (Math.sin(0.5 * h * peak) / (peak * (1 - peak) * h * h)) * 0.2, phase: 0 };
        }
      case 7:
        {
          const octaves = Math.max(2, Math.floor(2 + mod * 11));
          let target = 1;
          while (target < n) {
            target *= octaves;
          }
          return { amplitude: target === n ? 1 / h : 0, phase: 0 };
        }
      case 1:
      default:
        return { amplitude: 1 / h, phase: n % 2 === 1 ? 0.5 : 0 };
    }
  }

  additiveDampingCurveValue(value = 0) {
    return this.clampValue(Number(value) || 0, 0, 1);
  }

  additiveDampingAlgorithmValue(value = 0) {
    return Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  }

  additiveFilterFrequencyValue(value = 20000, rate = this.engineSampleRate || sampleRate || 44100) {
    const nyquist = Math.max(1, (Number(rate) || this.engineSampleRate || sampleRate || 44100) * 0.5);
    return this.clampValue(Number(value) || 20000, 1, nyquist);
  }

  rationalCurveValue(value = 0, skew = 0) {
    const t = this.clampValue(Number(value) || 0, 0, 1);
    if (t <= 0) {
      return 0;
    }
    if (t >= 1) {
      return 1;
    }
    const safeSkew = this.clampValue(Number(skew) || 0, -0.999999, 0.999999);
    return this.clampValue(
      ((1 + safeSkew) * t) / (1 - safeSkew + 2 * safeSkew * t),
      0,
      1,
    );
  }

  additiveHarmonicDamping(harmonic, frequency, rate, curveValue = 0, algorithm = 0, filterFrequency = 20000) {
    const safeRate = Math.max(1, Number(rate) || this.engineSampleRate || sampleRate || 44100);
    const safeFrequency = Math.max(0, Number(frequency) || 0);
    const safeFilterFrequency = this.additiveFilterFrequencyValue(filterFrequency, safeRate);
    if (safeFilterFrequency <= 0 || safeFrequency <= 0) {
      return 1;
    }
    const ratio = this.clampValue((Math.max(1, Number(harmonic) || 1) * safeFrequency) / safeFilterFrequency, 0, 1);
    return this.additiveDampingAmplitude({
      algorithm,
      curveValue,
      harmonic,
      maxHarmonics: Math.max(1, Math.floor(safeFilterFrequency / Math.max(1, safeFrequency))),
      ratio,
    });
  }

  additiveDampingAmplitude({
    algorithm = 0,
    curveValue = 0,
    harmonic = 1,
    maxHarmonics = 1,
    ratio = 0,
  } = {}) {
    const curve = this.additiveDampingCurveValue(curveValue);
    const mode = this.additiveDampingAlgorithmValue(algorithm);
    const t = this.clampValue(Number(ratio) || 0, 0, 1);
    if (t <= 0) {
      return 1;
    }
    if (t >= 1) {
      return 0;
    }
    if (mode === 1) {
      return this.clampValue((1 - t) ** (1 + curve * 7), 0, 1);
    }
    if (mode === 2) {
      const amount = 0.5 + curve * 12;
      const end = Math.exp(-amount);
      return this.clampValue((Math.exp(-t * amount) - end) / Math.max(0.0001, 1 - end), 0, 1);
    }
    if (mode === 3) {
      const cutoff = this.clampValue(0.95 - curve * 0.82, 0.08, 0.95);
      const order = 1 + Math.round(curve * 5);
      const raw = 1 / Math.sqrt(1 + (t / cutoff) ** (2 * order));
      const end = 1 / Math.sqrt(1 + (1 / cutoff) ** (2 * order));
      return this.clampValue((raw - end) / Math.max(0.0001, 1 - end), 0, 1);
    }
    if (mode === 4) {
      const knee = this.clampValue(0.78 - curve * 0.68, 0.04, 0.78);
      if (t <= knee) {
        return 1;
      }
      const local = (t - knee) / Math.max(0.0001, 1 - knee);
      return this.clampValue((1 - local) ** (1 + curve * 7), 0, 1);
    }
    if (mode === 5) {
      const tilt = curve * 4;
      if (tilt <= 0) {
        return 1 - t;
      }
      const h = Math.max(1, Number(harmonic) || 1);
      const maxH = Math.max(h, Number(maxHarmonics) || h);
      const raw = 1 / (h ** tilt);
      const end = 1 / (maxH ** tilt);
      return this.clampValue((raw - end) / Math.max(0.0001, 1 - end), 0, 1);
    }
    return this.clampValue(1 - this.rationalCurveValue(t, curve), 0, 1);
  }

  additiveHarmonicCurveAmount({
    algorithm = 0,
    curveValue = 0,
    harmonic = 1,
    maxHarmonics = 1,
    ratio = 0,
  } = {}) {
    return this.clampValue(1 - this.additiveDampingAmplitude({
      algorithm,
      curveValue,
      harmonic,
      maxHarmonics,
      ratio,
    }), 0, 1);
  }

  additiveOscillatorSample(phase, params = {}, rate = this.engineSampleRate || sampleRate) {
    const safeRate = Math.max(1, Number(rate) || this.engineSampleRate || sampleRate || 44100);
    const frequency = Math.max(0, Number(params.frequency) || 0);
    const maxHarmonics = Math.max(
      1,
      Math.min(nodeLiveAdditiveHardMaxHarmonics, Math.round(Number(params.harmonics) || 32)),
    );
    const waveform = Math.round(Number(params.waveform) || 0);
    const modA = this.clampValue(Number(params.modA) || 0, 0, 1);
    const harmonicPhaseAdd = this.clampValue(Number(params.harmonicPhaseAdd) || 0, 0, 1);
    const harmonicPhaseMultiply = this.clampValue(Number(params.harmonicPhaseMultiply) || 0, 0, 4);
    const harmonicPhaseCurve = this.clampValue(Number(params.harmonicPhaseCurve) || 0, 0, 1);
    const harmonicPhaseAlgorithm = this.additiveDampingAlgorithmValue(params.harmonicPhaseAlgorithm);
    const level = this.clampValue(Number(params.level) || 0, 0, 1);
    const dampingCurve = this.additiveDampingCurveValue(params.dampingCurve);
    const dampingAlgorithm = this.additiveDampingAlgorithmValue(params.dampingAlgorithm);
    const dampingFilterFrequency = this.additiveFilterFrequencyValue(params.dampingFilterFrequency, safeRate);
    const harmonicLimit = Math.max(1, Math.min(maxHarmonics, Math.floor(Math.min(20000, safeRate * 0.45) / Math.max(1, frequency))));
    let total = 0;
    let norm = 0;
    for (let harmonic = 1; harmonic <= harmonicLimit; harmonic += 1) {
      const partial = this.additiveWaveformHarmonic(waveform, harmonic, modA);
      const amplitude = (Number(partial.amplitude) || 0) *
        this.additiveHarmonicDamping(harmonic, frequency, safeRate, dampingCurve, dampingAlgorithm, dampingFilterFrequency);
      if (amplitude === 0) {
        continue;
      }
      const harmonicRatio = harmonicLimit > 1
        ? (harmonic - 1) / (harmonicLimit - 1)
        : 0;
      const phaseCurve = this.additiveHarmonicCurveAmount({
        algorithm: harmonicPhaseAlgorithm,
        curveValue: harmonicPhaseCurve,
        harmonic,
        maxHarmonics: harmonicLimit,
        ratio: harmonicRatio,
      });
      const phaseMultiplier = 1 + phaseCurve * harmonicPhaseMultiply;
      const phaseOffset = (Number(partial.phase) || 0) + phaseCurve * harmonicPhaseAdd;
      total += Math.sin((phase * harmonic * phaseMultiplier) + phaseOffset * Math.PI * 2) * amplitude;
      norm += Math.abs(amplitude);
    }
    if (norm <= 0) {
      return 0;
    }
    return this.clampValue((total / Math.max(1, norm * 0.72)) * level, -1, 1);
  }

  createHighpassState() {
    return {
      inputBuffer: 0,
      outputBuffer: 0,
    };
  }

  createLowpassState() {
    return {
      outputBuffer: 0,
    };
  }

  createBandpassState() {
    return {
      highpass: this.createHighpassState(),
      lowpass: this.createLowpassState(),
    };
  }

  createCookbookFilterState() {
    return {
      lastStages: 2,
      x1: [0, 0, 0, 0, 0],
      x2: [0, 0, 0, 0, 0],
      y1: [0, 0, 0, 0, 0],
      y2: [0, 0, 0, 0, 0],
    };
  }

  createLadderFilterState() {
    return {
      y: [0, 0, 0, 0, 0],
    };
  }

  resetCookbookFilterState(state) {
    for (const key of ["x1", "x2", "y1", "y2"]) {
      if (Array.isArray(state?.[key])) {
        state[key].fill(0);
      }
    }
  }

  createOscResetState() {
    return {
      lastReset: 0,
    };
  }

  createSlewLimiterState() {
    return {
      initialized: false,
      out: 0,
    };
  }

  createClockState() {
    return {
      hasStarted: false,
      phase: 0,
    };
  }

  createRandomClockState() {
    return {
      intervalSamples: 0,
      lastReset: 0,
      phaseSamples: 0,
      randomState: 0,
      remainingTriggerSamples: 0,
      seedKey: "",
    };
  }

  createDelayedTriggerState() {
    return {
      hasTriggered: true,
      lastReset: 0,
      lastTrigger: 0,
      remainingSamples: 0,
      running: false,
      waitSamples: 0,
    };
  }

  createSampleHoldState() {
    return {
      held: 0,
      lastTrigger: 0,
    };
  }

  createStepSequencerState() {
    return {
      gate: 0,
      index: 0,
      lastReset: 0,
      lastTrigger: 0,
      out: 0,
    };
  }

  createTriggerCounterState() {
    return {
      count: 0,
      lastReset: 0,
      lastTrigger: 0,
      remainingSamples: 0,
    };
  }

  createTriggerDividerState() {
    return {
      count: 0,
      lastReset: 0,
      lastTrigger: 0,
      remainingSamples: 0,
    };
  }

  createExpAdsrState() {
    return {
      lastGate: 0,
      out: 0,
      secondsPassed: 0,
      state: "off",
    };
  }

  createLinearEnvelopeState() {
    return {
      lastGate: 0,
      out: 0,
      releaseDecrement: 0,
      secondsPassed: 0,
      state: "off",
    };
  }

  createPluckEnvelopeState() {
    return {
      autoReleasePhasor: 0,
      currentValue: 0,
      decayIncrement: 0,
      lastRelease: 0,
      lastTrigger: 0,
      phasor: 0,
      releaseIncrement: 0,
      secondsPassed: 0,
      state: "off",
    };
  }

  createVactrolEnvelopeState() {
    return {
      out: 0,
      raw: 0,
    };
  }

  createFlowerChildEnvelopeFollowerState() {
    return {
      currentSlewedValue: 0,
      holdCounter: 0,
      out: 0,
    };
  }

  createNoiseGeneratorState() {
    return {
      brown: 0,
      gaussianSpare: null,
      pink: [0, 0, 0, 0, 0, 0, 0],
      seed: 0,
      seedKey: "",
    };
  }

  createNoiseSampleHoldState() {
    return {
      held: 0,
      initialized: false,
      phase: 0,
      seedKey: "",
    };
  }

  createRandomWalkState() {
    return {
      lowpass: this.createLowpassState(),
      out: 0,
      seed: 0,
      seedKey: "",
    };
  }

  createFractalBrownianNoiseState() {
    return {
      axes: {},
    };
  }

  safeFilterNumber(value, state) {
    const number = Number(value);
    const reason = this.badValueReason(number);
    if (!reason) {
      return number;
    }
    if (state) {
      state.inputBuffer = 0;
      state.outputBuffer = 0;
    }
    this.badNumberCount += 1;
    if (!this.lastBadValueNodeId) {
      this.lastBadValueReason = reason;
      this.lastBadValueSource = "";
    }
    return 0;
  }

  validCodeblockIdentifier(name) {
    const value = String(name || "").trim();
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) &&
      !new Set([
        "__context",
        "__ctx",
        "__inputs",
        "__outputs",
        "__state",
        "arguments",
        "await",
        "break",
        "case",
        "catch",
        "class",
        "const",
        "continue",
        "debugger",
        "default",
        "delete",
        "do",
        "document",
        "else",
        "eval",
        "export",
        "extends",
        "false",
        "fetch",
        "finally",
        "frame",
        "frames",
        "for",
        "Function",
        "globalThis",
        "if",
        "import",
        "in",
        "instanceof",
        "let",
        "new",
        "null",
        "return",
        "sampleRate",
        "self",
        "super",
        "switch",
        "state",
        "this",
        "throw",
        "time",
        "true",
        "try",
        "typeof",
        "var",
        "void",
        "while",
        "window",
        "with",
        "yield",
        "dt",
      ]).has(value);
  }

  normalizeCodeblockPortList(value, fallbackPrefix = "In") {
    const raw = Array.isArray(value)
      ? value
      : String(value ?? "").split(/[\s,]+/);
    const ports = [];
    const seen = new Set();
    for (const item of raw) {
      const name = String(item || "").trim();
      if (!this.validCodeblockIdentifier(name) || seen.has(name)) {
        continue;
      }
      seen.add(name);
      ports.push(name.slice(0, 32));
    }
    if (!ports.length) {
      ports.push(`${fallbackPrefix}1`);
    }
    return ports;
  }

  normalizeCodeblock(value = {}) {
    const source = value && typeof value === "object" ? value : {};
    const inputs = this.normalizeCodeblockPortList(source.inputs, "In");
    const reserved = new Set(inputs);
    const outputs = this.normalizeCodeblockPortList(source.outputs, "Out")
      .filter((port) => !reserved.has(port));
    if (!outputs.length) {
      let index = 1;
      let name = "Out1";
      while (reserved.has(name)) {
        index += 1;
        name = `Out${index}`;
      }
      outputs.push(name);
    }
    return {
      code: String(source.code ?? "Out1 = In1;"),
      inputs,
      outputs,
    };
  }

  codeblockFunctionBody(codeblock) {
    const shadows = ["window", "document", "fetch", "Function", "globalThis", "self"]
      .map((name) => `const ${name} = undefined;`)
      .join("\n");
    const context = [
      "const state = __state;",
      "const __ctx = __context || {};",
      "const sampleRate = Number(__ctx.sampleRate) || 44100;",
      "const frame = Number(__ctx.frame) || 0;",
      "const frames = Number(__ctx.frames) || 1;",
      "const time = Number(__ctx.time) || 0;",
      "const dt = 1 / sampleRate;",
    ].join("\n");
    const inputs = codeblock.inputs
      .map((port, index) => `const ${port} = __inputs[${index}] || 0;`)
      .join("\n");
    const outputs = codeblock.outputs.map((port) => `let ${port} = 0;`).join("\n");
    const writes = codeblock.outputs
      .map((port) => `__outputs[${JSON.stringify(port)}] = ${port};`)
      .join("\n");
    return `"use strict";\n${shadows}\n${context}\n${inputs}\n${outputs}\n${codeblock.code}\n${writes}\nreturn __outputs;`;
  }

  codeblockCacheKey(codeblock) {
    return `${codeblock.inputs.join(",")}=>${codeblock.outputs.join(",")}::${codeblock.code}`;
  }

  markCodeblockError(nodeId, reason, source) {
    this.badNumberCount += 1;
    this.lastBadValueReason = reason;
    this.lastBadValueNodeId = nodeId || "";
    this.lastBadValueSource = source || "codeblock";
  }

  safeCodeblockNumber(value, nodeId, port) {
    const number = Number(value);
    const reason = this.badValueReason(number);
    if (!reason) {
      return number;
    }
    this.markCodeblockError(nodeId, reason, `codeblock ${port} output`);
    return 0;
  }

  createCodeblockOutputObject(codeblock) {
    const output = {};
    for (const port of codeblock.outputs) {
      output[port] = 0;
    }
    return output;
  }

  compileCodeblockFunction(node) {
    const codeblock = this.normalizeCodeblock(node.codeblock);
    const key = this.codeblockCacheKey(codeblock);
    const cached = this.codeblockFunctions.get(node.id);
    if (cached?.key === key) {
      return cached;
    }
    const fn = Function(
      "__inputs",
      "__outputs",
      "__state",
      "__context",
      this.codeblockFunctionBody(codeblock),
    );
    const compiled = {
      codeblock,
      fn,
      inputs: new Array(codeblock.inputs.length).fill(0),
      key,
      output: this.createCodeblockOutputObject(codeblock),
      state: Object.create(null),
    };
    this.codeblockFunctions.set(node.id, compiled);
    return compiled;
  }

  evaluateCodeblock(node, mixInput, frame = 0, frames = 1, sampleRate = this.engineSampleRate || 44100, inputFrame = frame) {
    let compiled = null;
    try {
      compiled = this.compileCodeblockFunction(node);
    } catch (error) {
      this.markCodeblockError(node.id, "compile error", `codeblock ${error?.message || ""}`);
      return {};
    }
    const { codeblock, fn, inputs, output, state } = compiled;
    try {
      for (let index = 0; index < codeblock.inputs.length; index += 1) {
        inputs[index] = this.safeFilterNumber(mixInput(node.id, codeblock.inputs[index]), null);
      }
      for (const port of codeblock.outputs) {
        output[port] = 0;
      }
      fn(inputs, output, state, {
        frame,
        frames,
        sampleRate,
        time: (Number(inputFrame) || 0) / (Number(sampleRate) || 44100),
      });
      for (const port of codeblock.outputs) {
        output[port] = this.safeCodeblockNumber(output[port], node.id, port);
      }
      return output;
    } catch (error) {
      this.markCodeblockError(node.id, "runtime error", `codeblock ${error?.message || ""}`);
      for (const port of codeblock.outputs) {
        output[port] = 0;
      }
      return output;
    }
  }

  createNestedRuntime(plan) {
    const runtime = Object.create(NodeLiveAudioProcessor.prototype);
    runtime.inputConnections = new Map();
    runtime.badNumberCount = 0;
    runtime.lastBadValueReason = "";
    runtime.lastBadValueNodeId = "";
    runtime.lastBadValueSource = "";
    runtime.inputMeterPeak = 0;
    runtime.inputMeterSamples = 0;
    runtime.inputMeterSquareSum = 0;
    runtime.meterClipCount = 0;
    runtime.meterCounter = 0;
    runtime.meterPeak = 0;
    runtime.meterProtectionMuteCount = 0;
    runtime.meterSamples = 0;
    runtime.meterSquareSum = 0;
    runtime.macroControls = this.macroControls;
    runtime.pitchModWheelSignal = this.pitchModWheelSignal;
    runtime.midiKeyboardGatePulseSamples = 0;
    runtime.midiKeyboardSignal = null;
    runtime.moduleGroupRuntimes = new Map();
    runtime.modulationConnections = new Map();
    runtime.nodeOutputs = new Map();
    runtime.nodes = new Map();
    runtime.noiseSeedKeys = new Map();
    runtime.noiseSeeds = new Map();
    runtime.order = [];
    runtime.engineSampleRate = this.engineSampleRate;
    runtime.hostSampleRate = this.hostSampleRate;
    runtime.oversamplingRatio = this.oversamplingRatio;
    runtime.bandpassStates = new Map();
    runtime.clockDividerStates = new Map();
    runtime.clockStates = new Map();
    runtime.codeblockFunctions = new Map();
    runtime.cookbookFilterStates = new Map();
    runtime.delayedTriggerStates = new Map();
    runtime.expAdsrStates = new Map();
    runtime.fractalBrownianNoiseStates = new Map();
    runtime.flowerChildEnvelopeFollowerStates = new Map();
    runtime.highpassStates = new Map();
    runtime.ladderFilterStates = new Map();
    runtime.linearEnvelopeStates = new Map();
    runtime.lowpassStates = new Map();
    runtime.noiseGeneratorStates = new Map();
    runtime.noiseSampleHoldStates = new Map();
    runtime.oscResetStates = new Map();
    runtime.outputNode = plan?.outputNode || "output";
    runtime.patchFingerprint = plan?.patchFingerprint || "";
    runtime.phases = new Map();
    runtime.pluckEnvelopeStates = new Map();
    runtime.planSerial = 0;
    runtime.randomClockStates = new Map();
    runtime.sampleHoldStates = new Map();
    runtime.randomWalkStates = new Map();
    runtime.sessionId = this.sessionId;
    runtime.scopeBuffers = new Map();
    runtime.scopeCounter = 0;
    runtime.slewLimiterStates = new Map();
    runtime.smoothers = new Map();
    runtime.spiralStates = new Map();
    runtime.stepSequencerStates = new Map();
    runtime.triggerCounterStates = new Map();
    runtime.triggerDividerStates = new Map();
    runtime.triangleStates = new Map();
    runtime.vactrolEnvelopeStates = new Map();
    runtime.resetVisualControls();
    runtime.setNestedPlan(plan);
    return runtime;
  }

  setNestedPlan(plan) {
    const nodes = Array.isArray(plan?.nodes) ? plan.nodes : [];
    const ids = new Set(nodes.map((node) => node.id));
    this.nodes = new Map(nodes.map((node) => [node.id, {
      id: node.id,
      codeblock: this.normalizeCodeblock(node.codeblock),
      moduleGroup: node.moduleGroup || null,
      moduleGroupPlan: node.moduleGroupPlan || null,
      paramMeta: node.paramMeta || {},
      params: node.params || {},
      type: node.type,
    }]));
    this.order = Array.isArray(plan?.order) ? [...plan.order] : [...ids];
    this.outputNode = plan?.outputNode || "output";
    this.inputConnections = this.buildInputConnectionMap(plan?.connections, ids);
    this.modulationConnections = this.buildModulationConnectionMap(plan?.modulations, ids);
    for (const id of ids) {
      const node = this.nodes.get(id);
      this.nodeOutputs.set(id, 0);
      if (node?.type === "osc" || node?.type === "fbPolyBlepOsc") {
        this.phases.set(id, 0);
        this.oscResetStates.set(id, this.createOscResetState());
        this.triangleStates.set(id, 0);
      }
      if (node?.type === "osc" || node?.type === "fbPolyBlepOsc" || node?.type === "noise") {
        this.noiseSeeds.set(id, this.stableSeed(id));
      }
      if (node?.type === "stereoNoise") {
        this.noiseSeeds.set(`${id}:left`, this.stableSeed(`${id}:left`));
        this.noiseSeeds.set(`${id}:right`, this.stableSeed(`${id}:right`));
      }
      if (node?.type === "spiral") this.spiralStates.set(id, this.createSpiralState());
      if (node?.type === "highpass") this.highpassStates.set(id, this.createHighpassState());
      if (node?.type === "lowpass") this.lowpassStates.set(id, this.createLowpassState());
      if (node?.type === "bandpass") this.bandpassStates.set(id, this.createBandpassState());
      if (node?.type === "cookbookFilter") this.cookbookFilterStates.set(id, this.createCookbookFilterState());
      if (node?.type === "ladderFilter") this.ladderFilterStates.set(id, this.createLadderFilterState());
      if (node?.type === "clock") this.clockStates.set(id, this.createClockState());
      if (node?.type === "clockDivider") this.clockDividerStates.set(id, this.createTriggerDividerState());
      if (node?.type === "delayedTrigger") this.delayedTriggerStates.set(id, this.createDelayedTriggerState());
      if (node?.type === "randomClock") this.randomClockStates.set(id, this.createRandomClockState());
      if (node?.type === "sampleHold") this.sampleHoldStates.set(id, this.createSampleHoldState());
      if (node?.type === "slewLimiter") this.slewLimiterStates.set(id, this.createSlewLimiterState());
      if (node?.type === "expAdsr") this.expAdsrStates.set(id, this.createExpAdsrState());
      if (node?.type === "linearEnvelope") this.linearEnvelopeStates.set(id, this.createLinearEnvelopeState());
      if (node?.type === "noiseGenerator") this.noiseGeneratorStates.set(id, this.createNoiseGeneratorState());
      if (node?.type === "noise") this.noiseSampleHoldStates.set(id, this.createNoiseSampleHoldState());
      if (node?.type === "randomWalk") this.randomWalkStates.set(id, this.createRandomWalkState());
      if (node?.type === "fractalBrownianNoise") this.fractalBrownianNoiseStates.set(id, this.createFractalBrownianNoiseState());
      if (node?.type === "flowerChildEnvelopeFollower") this.flowerChildEnvelopeFollowerStates.set(id, this.createFlowerChildEnvelopeFollowerState());
      if (node?.type === "pluckEnvelope") this.pluckEnvelopeStates.set(id, this.createPluckEnvelopeState());
      if (node?.type === "stepSequencer") this.stepSequencerStates.set(id, this.createStepSequencerState());
      if (node?.type === "triggerCounter") this.triggerCounterStates.set(id, this.createTriggerCounterState());
      if (node?.type === "triggerDivider") this.triggerDividerStates.set(id, this.createTriggerDividerState());
      if (node?.type === "vactrolEnvelope") this.vactrolEnvelopeStates.set(id, this.createVactrolEnvelopeState());
      if (node?.type === "moduleGroup" && node.moduleGroupPlan) {
        this.moduleGroupRuntimes.set(id, this.createNestedRuntime(node.moduleGroupPlan));
      }
      for (const [key, value] of Object.entries(node?.params || {})) {
        this.smoothers.set(this.parameterKey(id, key), this.createSmoother(value, node.paramMeta?.[key]));
      }
    }
  }

  evaluateModuleGroup(node, mixInput, frame, frames, rate, inputFrame) {
    if (!node.moduleGroupPlan) {
      return {};
    }
    let runtime = this.moduleGroupRuntimes.get(node.id);
    if (!runtime) {
      runtime = this.createNestedRuntime(node.moduleGroupPlan);
      this.moduleGroupRuntimes.set(node.id, runtime);
    }
    runtime.engineSampleRate = rate;
    runtime.hostSampleRate = this.hostSampleRate;
    runtime.oversamplingRatio = this.oversamplingRatio;
    runtime.macroControls = this.macroControls;
    runtime.pitchModWheelSignal = this.pitchModWheelSignal;
    runtime.externalGroupInputs = new Map(
      (node.moduleGroup?.inputs || []).map((input) => [input.nodeId, mixInput(node.id, input.name)]),
    );
    const frameOutput = runtime.evaluateFrame(frame, frames, [], rate, inputFrame);
    const output = {};
    for (const endpoint of node.moduleGroup?.outputs || []) {
      output[endpoint.name] = runtime.readRuntimePortOutput(
        frameOutput.frameValues,
        endpoint.nodeId,
        endpoint.port || "Out",
      );
    }
    return output;
  }

  visualControlIntensity(value, nodeId, source = "visual control") {
    const number = Number(value);
    const reason = this.badValueReason(number);
    if (reason) {
      this.badNumberCount += 1;
      if (!this.lastBadValueNodeId) {
        this.lastBadValueReason = reason;
        this.lastBadValueNodeId = nodeId || "";
        this.lastBadValueSource = source;
      }
      return 0;
    }
    return this.clampValue(Math.abs(number), 0, 1);
  }

  visualControlSigned(value, nodeId, source = "visual control") {
    const number = Number(value);
    const reason = this.badValueReason(number);
    if (reason) {
      this.badNumberCount += 1;
      if (!this.lastBadValueNodeId) {
        this.lastBadValueReason = reason;
        this.lastBadValueNodeId = nodeId || "";
        this.lastBadValueSource = source;
      }
      return 0;
    }
    return this.clampValue(number, -1, 1);
  }

  visualHslToRgb(hue, saturation, lightness) {
    const h = ((Number(hue) || 0) % 1 + 1) % 1;
    const s = this.clampValue(Number(saturation) || 0, 0, 1);
    const l = this.clampValue(Number(lightness) || 0, 0, 1);
    if (s <= 0) {
      return [l, l, l];
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (offset) => {
      let t = h + offset;
      if (t < 0) {
        t += 1;
      }
      if (t > 1) {
        t -= 1;
      }
      if (t < 1 / 6) {
        return p + (q - p) * 6 * t;
      }
      if (t < 1 / 2) {
        return q;
      }
      if (t < 2 / 3) {
        return p + (q - p) * (2 / 3 - t) * 6;
      }
      return p;
    };
    return [channel(1 / 3), channel(0), channel(-1 / 3)];
  }

  smoothVisualControl(key, target, rate = sampleRate, seconds = 0.045, min = 0, max = 1) {
    const safeTarget = this.clampValue(Number(target) || 0, min, max);
    const previous = Number(this.visualControlStates.get(key));
    const current = Number.isFinite(previous) ? previous : 0;
    const safeRate = Math.max(1, Number(rate) || sampleRate || 44100);
    const time = Math.max(0, Number(seconds) || 0);
    const coefficient = time <= 0 ? 1 : 1 - Math.exp(-1 / Math.max(1, time * safeRate));
    const next = current + (safeTarget - current) * coefficient;
    const cleaned = Math.abs(next) < 0.000001 ? 0 : this.clampValue(next, min, max);
    this.visualControlStates.set(key, cleaned);
    this.visualControls[key] = cleaned;
    return cleaned;
  }

  postVisualControls() {
    this.port.postMessage({
      patchFingerprint: this.patchFingerprint,
      blue: this.clampValue(this.visualControls.blue, 0, 1),
      chromaAlpha: this.clampValue(this.visualControls.chromaAlpha, 0, 1),
      chromaDrift: this.clampValue(this.visualControls.chromaDrift, 0, 1),
      chromaHue: this.clampValue(this.visualControls.chromaHue, 0, 1),
      chromaLightness: this.clampValue(this.visualControls.chromaLightness, 0, 1),
      chromaSaturation: this.clampValue(this.visualControls.chromaSaturation, 0, 1),
      chromaSpread: this.clampValue(this.visualControls.chromaSpread, 0, 1),
      green: this.clampValue(this.visualControls.green, 0, 1),
      red: this.clampValue(this.visualControls.red, 0, 1),
      scopePaused: this.clampValue(this.visualControls.scopePaused, 0, 1),
      scopeTracesOff: this.clampValue(this.visualControls.scopeTracesOff, 0, 1),
      screenDim: this.clampValue(this.visualControls.screenDim, 0, 1),
      screenShake: this.clampValue(this.visualControls.screenShake, 0, 1),
      sessionId: this.sessionId,
      type: "visualControls",
      visualBloom: this.clampValue(this.visualControls.visualBloom, 0, 1),
      visualBrightness: this.clampValue(this.visualControls.visualBrightness, 0, 1),
      visualGlow: this.clampValue(this.visualControls.visualGlow, 0, 1),
      x: this.clampValue(this.visualControls.x, -1, 1),
      y: this.clampValue(this.visualControls.y, -1, 1),
    });
  }

  monitorBadValueSample(value, nodeId) {
    const number = Number(value);
    const reason = this.badValueReason(number);
    if (reason) {
      this.badNumberCount += 1;
      this.lastBadValueReason = reason;
      this.lastBadValueNodeId = nodeId;
      this.lastBadValueSource = "BADVAL Monitor input";
    }
    return number;
  }

  onePoleHighpassSample(state, input, frequency, rate = sampleRate) {
    const safeRate = Math.max(1, Number(rate) || sampleRate || 44100);
    const safeInput = this.safeFilterNumber(input, state);
    const frequencyValue = Math.max(0, this.safeFilterNumber(frequency, state));
    const w = Math.min((Math.PI * 2) / safeRate, 0.000142475857) * frequencyValue;
    const a1 = Math.exp(-w);
    const b0 = 0.5 * (1 + a1);
    const b1 = -b0;
    state.outputBuffer = this.safeFilterNumber(
      b0 * safeInput + b1 * state.inputBuffer + a1 * state.outputBuffer,
      state,
    );
    state.inputBuffer = safeInput;
    return state.outputBuffer;
  }

  onePoleLowpassSample(state, input, frequency, rate = sampleRate) {
    const safeRate = Math.max(1, Number(rate) || sampleRate || 44100);
    const safeInput = this.safeFilterNumber(input, state);
    const frequencyValue = Math.max(0, this.safeFilterNumber(frequency, state));
    const w = Math.min((Math.PI * 2) / safeRate, 0.000142475857) * frequencyValue;
    const a1 = Math.exp(-w);
    const b0 = 1 - a1;
    state.outputBuffer = this.safeFilterNumber(b0 * safeInput + a1 * state.outputBuffer, state);
    return state.outputBuffer;
  }

  onePoleBandpassSample(state, input, lowFrequency, highFrequency, rate = sampleRate) {
    const lowCut = Math.max(0, this.safeFilterNumber(lowFrequency, state.highpass));
    const highCut = Math.max(0, this.safeFilterNumber(highFrequency, state.lowpass));
    const low = Math.min(lowCut, highCut);
    const high = Math.max(lowCut, highCut);
    const highpassed = this.onePoleHighpassSample(state.highpass, input, low, rate);
    return this.onePoleLowpassSample(state.lowpass, highpassed, high, rate);
  }

  cookbookFilterStageCount(stages) {
    const value = Math.round(Number(stages));
    return Number.isFinite(value) ? this.clampValue(value, 0, 5) : 2;
  }

  cookbookFilterCoefficients(mode, frequency, q, gainDb, rate = sampleRate) {
    const safeMode = Math.round(this.clampValue(Number(mode) || 0, 0, 9));
    if (safeMode === 0) {
      return { a1: 0, a2: 0, b0: 1, b1: 0, b2: 0 };
    }
    const safeRate = Math.max(1, Number(rate) || sampleRate || 44100);
    const freq = this.clampValue(Number(frequency) || 1000, 20, Math.min(20000, safeRate * 0.49));
    const safeQ = Math.max(0.0001, Number(q) || 1);
    const omega = 2 * Math.PI * freq / safeRate;
    const sine = Math.sin(omega);
    const cosine = Math.cos(omega);
    const alpha = sine / (2 * safeQ);
    const amplitude = 10 ** (0.025 * (Number(gainDb) || 0));
    const beta = Math.sqrt(amplitude) / safeQ;
    let a0 = 1 + alpha;
    let a1 = -2 * cosine;
    let a2 = 1 - alpha;
    let b0 = 1;
    let b1 = 0;
    let b2 = 0;
    if (safeMode === 1) {
      b1 = 1 - cosine;
      b0 = b1 * 0.5;
      b2 = b0;
    } else if (safeMode === 2) {
      b1 = -(1 + cosine);
      b0 = -b1 * 0.5;
      b2 = b0;
    } else if (safeMode === 3) {
      b0 = safeQ * alpha;
      b2 = -b0;
    } else if (safeMode === 4) {
      b0 = alpha;
      b2 = -alpha;
    } else if (safeMode === 5) {
      b0 = 1;
      b1 = -2 * cosine;
      b2 = 1;
    } else if (safeMode === 6) {
      b0 = 1 - alpha;
      b1 = -2 * cosine;
      b2 = 1 + alpha;
    } else if (safeMode === 7) {
      a0 = 1 + alpha / amplitude;
      a2 = 1 - alpha / amplitude;
      b0 = 1 + alpha * amplitude;
      b1 = -2 * cosine;
      b2 = 1 - alpha * amplitude;
    } else if (safeMode === 8) {
      a0 = (amplitude + 1) + (amplitude - 1) * cosine + beta * sine;
      a1 = -2 * ((amplitude - 1) + (amplitude + 1) * cosine);
      a2 = (amplitude + 1) + (amplitude - 1) * cosine - beta * sine;
      b0 = amplitude * ((amplitude + 1) - (amplitude - 1) * cosine + beta * sine);
      b1 = 2 * amplitude * ((amplitude - 1) - (amplitude + 1) * cosine);
      b2 = amplitude * ((amplitude + 1) - (amplitude - 1) * cosine - beta * sine);
    } else if (safeMode === 9) {
      a0 = (amplitude + 1) - (amplitude - 1) * cosine + beta * sine;
      a1 = 2 * ((amplitude - 1) - (amplitude + 1) * cosine);
      a2 = (amplitude + 1) - (amplitude - 1) * cosine - beta * sine;
      b0 = amplitude * ((amplitude + 1) + (amplitude - 1) * cosine + beta * sine);
      b1 = -2 * amplitude * ((amplitude - 1) + (amplitude + 1) * cosine);
      b2 = amplitude * ((amplitude + 1) + (amplitude - 1) * cosine - beta * sine);
    }
    const scale = a0 !== 0 ? 1 / a0 : 1;
    return {
      a1: a1 * scale,
      a2: a2 * scale,
      b0: b0 * scale,
      b1: b1 * scale,
      b2: b2 * scale,
    };
  }

  cookbookFilterSample(state, input, mode, frequency, q, gainDb, stages, rate = sampleRate) {
    const stageCount = this.cookbookFilterStageCount(stages);
    if (!state || stageCount <= 0 || Math.round(Number(mode) || 0) === 0) {
      return Number(input) || 0;
    }
    if (state.lastStages !== stageCount) {
      this.resetCookbookFilterState(state);
      state.lastStages = stageCount;
    }
    const coeff = this.cookbookFilterCoefficients(mode, frequency, q, gainDb, rate);
    let value = this.safeFilterNumber(input, state);
    for (let index = 0; index < stageCount; index += 1) {
      const previousInput = value;
      value = coeff.b0 * value + coeff.b1 * state.x1[index] + coeff.b2 * state.x2[index]
        - coeff.a1 * state.y1[index] - coeff.a2 * state.y2[index];
      state.x2[index] = state.x1[index];
      state.x1[index] = previousInput;
      state.y2[index] = state.y1[index];
      state.y1[index] = value;
    }
    return this.safeFilterNumber(value, state);
  }

  ladderFilterStageCount(stages) {
    const value = Math.round(Number(stages));
    return Number.isFinite(value) ? this.clampValue(value, 1, 4) : 4;
  }

  ladderFilterMix(mode, stages) {
    const safeMode = Math.round(this.clampValue(Number(mode) || 0, 0, 3));
    const stageCount = this.ladderFilterStageCount(stages);
    const c = [0, 0, 0, 0, 0];
    let s = 1;
    if (safeMode === 0) {
      c[0] = 1;
      s = 0.125;
    } else if (safeMode === 1) {
      c[stageCount] = 1;
      s = stageCount * 0.25;
    } else if (safeMode === 2) {
      const coefficients = [
        [1, -1],
        [1, -2, 1],
        [1, -3, 3, -1],
        [1, -4, 6, -4, 1],
      ][stageCount - 1];
      for (let index = 0; index < coefficients.length; index += 1) {
        c[index] = coefficients[index];
      }
      s = stageCount * 0.25;
    } else {
      const coefficients = stageCount <= 2
        ? [0, 2, -2, 0, 0]
        : stageCount === 3
          ? [0, 0, 3, -3, 0]
          : [0, 0, 4, -8, 4];
      for (let index = 0; index < coefficients.length; index += 1) {
        c[index] = coefficients[index];
      }
      s = 0.125;
    }
    return { c, mode: safeMode, s, stageCount };
  }

  ladderFilterFeedbackFactor(feedback, cosWc, a) {
    const b = 1 + a;
    const denominator = Math.max(1e-12, 1 + a * a + 2 * a * cosWc);
    const g2 = (b * b) / denominator;
    return feedback / Math.max(1e-12, g2 * g2);
  }

  ladderFilterCoefficients(frequency, resonance, mode, stages, rate = sampleRate, state = null) {
    const safeRate = Math.max(1, Number(rate) || sampleRate || 44100);
    const frequencyValue = Math.max(0, this.safeFilterNumber(frequency, state));
    const safeFrequency = this.clampValue(frequencyValue, 0.000001, Math.min(20000, safeRate * 0.49));
    const feedback = this.clampValue(this.safeFilterNumber(resonance, state), 0, 0.999);
    const wc = this.clampValue((2 * Math.PI * safeFrequency) / safeRate, 1e-9, Math.PI * 0.98);
    const sine = Math.sin(wc);
    const cosine = Math.cos(wc);
    const tangent = Math.tan(0.25 * (wc - Math.PI));
    let a = tangent / Math.max(1e-12, sine - cosine * tangent);
    if (!Number.isFinite(a)) {
      a = -1;
    }
    const mix = this.ladderFilterMix(mode, stages);
    const k = this.ladderFilterFeedbackFactor(feedback, cosine, a);
    const g = 1 + mix.s * k;
    return { ...mix, a, g, k };
  }

  ladderFilterSample(state, input, params, rate = sampleRate) {
    const safeInput = this.safeFilterNumber(input, state);
    const coeff = this.ladderFilterCoefficients(
      params.frequency,
      params.resonance,
      params.mode,
      params.stages,
      rate,
      state,
    );
    const y = Array.isArray(state.y) && state.y.length >= 5 ? state.y : [0, 0, 0, 0, 0];
    state.y = y;
    y[0] = coeff.g * safeInput - coeff.k * y[4];
    y[0] = y[0] / (1 + y[0] * y[0]);
    y[1] = y[0] + coeff.a * (y[0] - y[1]);
    y[2] = y[1] + coeff.a * (y[1] - y[2]);
    y[3] = y[2] + coeff.a * (y[2] - y[3]);
    y[4] = y[3] + coeff.a * (y[3] - y[4]);
    for (let index = 0; index < y.length; index += 1) {
      y[index] = this.safeFilterNumber(y[index], state);
    }
    const output = coeff.c[0] * y[0] + coeff.c[1] * y[1] + coeff.c[2] * y[2] + coeff.c[3] * y[3] + coeff.c[4] * y[4];
    return this.safeFilterNumber(output, state);
  }

  slewLimiterSample(state, input, upTime, downTime, rate = sampleRate) {
    const safeRate = Math.max(1, Number(rate) || sampleRate || 44100);
    const target = this.safeFilterNumber(input, state);
    if (!state.initialized) {
      state.initialized = true;
      state.out = target;
      return target;
    }
    const upSeconds = Math.max(0, this.safeFilterNumber(upTime, state));
    const downSeconds = Math.max(0, this.safeFilterNumber(downTime, state));
    const delta = target - state.out;
    const maxRise = upSeconds <= 0 ? Infinity : 1 / Math.max(1, upSeconds * safeRate);
    const maxFall = downSeconds <= 0 ? Infinity : 1 / Math.max(1, downSeconds * safeRate);
    state.out = this.safeFilterNumber(
      state.out + Math.max(-maxFall, Math.min(maxRise, delta)),
      state,
    );
    return state.out;
  }

  clockAnalogWhipSample(phase, level) {
    const p = this.clampValue(Number(phase) || 0, 0, 1);
    const attack = 1 - Math.pow(1 - Math.min(1, p / 0.035), 4);
    const release = Math.pow(Math.max(0, 1 - p), 1.85);
    const snapEnvelope = attack * release;
    const sweepTurns = (3.15 * (1 - Math.exp(-4.2 * p)) / (1 - Math.exp(-4.2))) + (0.18 * Math.sin(Math.PI * p));
    const liquidBend = 0.075 * Math.sin(Math.PI * 2 * p) * Math.pow(Math.max(0, 1 - p), 1.2);
    const body = Math.sin((sweepTurns + liquidBend) * Math.PI * 2);
    const sheen = Math.sin((sweepTurns * 2.02 + 0.17) * Math.PI * 2) * 0.16 * Math.pow(Math.max(0, 1 - p), 2.8);
    return (body + sheen) * snapEnvelope * level;
  }

  clockSample(state, rate, duty, level, rateHz = sampleRate) {
    const safeRate = Math.max(0, this.safeFilterNumber(rate, null));
    const safeDuty = this.clampValue(this.safeFilterNumber(duty, null), 0, 1);
    const safeLevel = this.safeFilterNumber(level, null);
    const phase = this.wrapValue(Number(state.phase) || 0, 0, 1);
    const digital = phase < safeDuty ? safeLevel : 0;
    const analog = this.clockAnalogWhipSample(phase, safeLevel);
    const nextPhase = this.wrapValue(phase + safeRate / Math.max(1, rateHz), 0, 1);
    const pulse = safeRate > 0 && (!state.hasStarted || nextPhase < phase) ? safeLevel : 0;
    state.hasStarted = true;
    state.phase = nextPhase;
    return {
      "Analog Out": analog,
      "Digital Out": digital,
      Out: digital,
      Pulse: pulse,
    };
  }

  randomClockNextUnit(state, nodeId, seed) {
    const seedKey = `${nodeId}:${Math.round(Number(seed) || 0)}`;
    if (state.seedKey !== seedKey) {
      state.seedKey = seedKey;
      state.randomState = this.stableSeed(seedKey);
      state.intervalSamples = 0;
      state.phaseSamples = 0;
      state.remainingTriggerSamples = 0;
    }
    state.randomState = (Math.imul(state.randomState || 1, 1664525) + 1013904223) >>> 0;
    return state.randomState / 4294967296;
  }

  randomClockChooseIntervalSamples(state, params, rateHz, nodeId) {
    const rate = Math.max(1, rateHz || sampleRate || 44100);
    const minSeconds = Math.max(0, this.safeFilterNumber(params.minSeconds, null));
    const maxSeconds = Math.max(0, this.safeFilterNumber(params.maxSeconds, null));
    const low = Math.min(minSeconds, maxSeconds);
    const high = Math.max(minSeconds, maxSeconds);
    const random = this.randomClockNextUnit(state, nodeId, params.seed);
    return Math.max(1, Math.round((low + (high - low) * random) * rate));
  }

  randomClockSample(state, reset, params, rateHz = sampleRate, nodeId = "") {
    const safeReset = this.safeFilterNumber(reset, null);
    const threshold = this.safeFilterNumber(params.threshold, null);
    const rate = Math.max(1, rateHz || sampleRate || 44100);
    const duty = this.clampValue(this.safeFilterNumber(params.duty, null), 0, 1);
    const triggerTime = Math.max(0, this.safeFilterNumber(params.triggerTime, null));
    const level = this.safeFilterNumber(params.level, null);
    const resetEdge = state.lastReset <= threshold && safeReset > threshold;

    if (resetEdge || state.intervalSamples <= 0) {
      state.intervalSamples = this.randomClockChooseIntervalSamples(state, params, rate, nodeId);
      state.phaseSamples = 0;
      state.remainingTriggerSamples = Math.max(1, Math.round(triggerTime * rate));
    } else if (state.phaseSamples >= state.intervalSamples) {
      state.intervalSamples = this.randomClockChooseIntervalSamples(state, params, rate, nodeId);
      state.phaseSamples = 0;
      state.remainingTriggerSamples = Math.max(1, Math.round(triggerTime * rate));
    }

    const gateSamples = Math.round(state.intervalSamples * duty);
    const trigger = state.remainingTriggerSamples > 0 ? level : 0;
    const gate = state.phaseSamples < gateSamples ? level : 0;
    state.remainingTriggerSamples = Math.max(0, state.remainingTriggerSamples - 1);
    state.phaseSamples += 1;
    state.lastReset = safeReset;
    return {
      Gate: this.safeFilterNumber(gate, null),
      Trigger: this.safeFilterNumber(trigger, null),
    };
  }

  delayedTriggerSample(state, trigger, reset, params, rateHz = sampleRate) {
    const safeTrigger = this.safeFilterNumber(trigger, null);
    const safeReset = this.safeFilterNumber(reset, null);
    const threshold = this.safeFilterNumber(params.threshold, null);
    const delay = Math.max(0, this.safeFilterNumber(params.delay, null));
    const pulseTime = Math.max(0, this.safeFilterNumber(params.pulseTime, null));
    const level = this.safeFilterNumber(params.level, null);
    const rate = Math.max(1, rateHz || sampleRate || 44100);

    if (state.lastReset <= threshold && safeReset > threshold) {
      state.hasTriggered = true;
      state.remainingSamples = 0;
      state.running = false;
      state.waitSamples = 0;
    }
    if (state.lastTrigger <= threshold && safeTrigger > threshold) {
      state.hasTriggered = false;
      state.remainingSamples = 0;
      state.running = true;
      state.waitSamples = Math.max(0, Math.round(delay * rate));
    }

    if (state.running && !state.hasTriggered) {
      if (state.waitSamples <= 0) {
        state.hasTriggered = true;
        state.running = false;
        state.remainingSamples = Math.max(1, Math.round(pulseTime * rate));
      } else {
        state.waitSamples -= 1;
      }
    }

    state.lastTrigger = safeTrigger;
    state.lastReset = safeReset;
    const output = state.remainingSamples > 0 ? level : 0;
    state.remainingSamples = Math.max(0, state.remainingSamples - 1);
    return this.safeFilterNumber(output, null);
  }

  sampleHoldSample(state, input, trigger, threshold) {
    const safeInput = this.safeFilterNumber(input, null);
    const safeTrigger = this.safeFilterNumber(trigger, null);
    const safeThreshold = this.safeFilterNumber(threshold, null);
    if (state.lastTrigger <= safeThreshold && safeTrigger > safeThreshold) {
      state.held = safeInput;
    }
    state.lastTrigger = safeTrigger;
    return this.safeFilterNumber(state.held, null);
  }

  stepSequencerSample(state, trigger, reset, params) {
    const safeTrigger = this.safeFilterNumber(trigger, null);
    const safeReset = this.safeFilterNumber(reset, null);
    const threshold = this.safeFilterNumber(params.threshold, null);
    const stepCount = Math.max(1, Math.min(8, Math.round(this.safeFilterNumber(params.steps, null))));
    const level = this.safeFilterNumber(params.level, null);
    const values = params.values.map((value) => this.safeFilterNumber(value, null));
    if (state.index >= stepCount) {
      state.index %= stepCount;
    }
    if (state.lastReset <= threshold && safeReset > threshold) {
      state.index = 0;
      state.out = values[0] || 0;
    }
    if (state.lastTrigger <= threshold && safeTrigger > threshold) {
      state.out = values[state.index] || 0;
      state.index = (state.index + 1) % stepCount;
    }
    state.gate = safeTrigger > threshold ? 1 : 0;
    state.lastTrigger = safeTrigger;
    state.lastReset = safeReset;
    return {
      Gate: state.gate,
      Out: this.safeFilterNumber(state.out * level, null),
    };
  }

  triggerCounterSample(state, trigger, reset, params, rate = sampleRate) {
    const safeTrigger = this.safeFilterNumber(trigger, null);
    const safeReset = this.safeFilterNumber(reset, null);
    const threshold = this.safeFilterNumber(params.threshold, null);
    const countMax = Math.max(1, this.safeFilterNumber(params.countMax, null));
    const increment = Math.max(0, this.safeFilterNumber(params.increment, null));
    const pulseTime = Math.max(0, this.safeFilterNumber(params.pulseTime, null));
    const level = this.safeFilterNumber(params.level, null);
    if (state.lastReset <= threshold && safeReset > threshold) {
      state.count = 0;
      state.remainingSamples = 0;
    }
    if (state.lastTrigger <= threshold && safeTrigger > threshold) {
      state.count += increment;
      if (state.count >= countMax) {
        state.count = countMax > 0 ? state.count % countMax : 0;
        state.remainingSamples = Math.max(1, Math.round(pulseTime * Math.max(1, rate)));
      }
    }
    state.lastTrigger = safeTrigger;
    state.lastReset = safeReset;
    const pulse = state.remainingSamples > 0 ? level : 0;
    state.remainingSamples = Math.max(0, state.remainingSamples - 1);
    return {
      Count: this.safeFilterNumber(this.clampValue(state.count / countMax, 0, 1) * level, null),
      Pulse: this.safeFilterNumber(pulse, null),
    };
  }

  triggerDividerSample(state, trigger, reset, params, rate = sampleRate) {
    const safeTrigger = this.safeFilterNumber(trigger, null);
    const safeReset = this.safeFilterNumber(reset, null);
    const threshold = this.safeFilterNumber(params.threshold, null);
    const division = Math.max(1, Math.min(64, Math.round(this.safeFilterNumber(params.division, null))));
    const pulseTime = Math.max(0, this.safeFilterNumber(params.pulseTime, null));
    const level = this.safeFilterNumber(params.level, null);
    if (state.lastReset <= threshold && safeReset > threshold) {
      state.count = 0;
      state.remainingSamples = 0;
    }
    if (state.lastTrigger <= threshold && safeTrigger > threshold) {
      state.count = (state.count + 1) % division;
      if (state.count === 0) {
        state.remainingSamples = Math.max(1, Math.round(pulseTime * Math.max(1, rate)));
      }
    }
    state.lastTrigger = safeTrigger;
    state.lastReset = safeReset;
    const output = state.remainingSamples > 0 ? level : 0;
    state.remainingSamples = Math.max(0, state.remainingSamples - 1);
    return this.safeFilterNumber(output, null);
  }

  exponentialCurve(value, skew) {
    const safeValue = this.clampValue(Number(value) || 0, 0, 1);
    const safeSkew = this.clampValue(Number(skew) || 0, -0.99, 0.99);
    if (safeSkew === 0) {
      return safeValue;
    }
    const c = 0.5 * (safeSkew + 1);
    const a = 2 * Math.log10((1 - c) / c);
    const denom = 1 - Math.exp(a);
    return denom === 0 ? safeValue : (1 - Math.exp(safeValue * a)) / denom;
  }

  pluckPrepareForDecay(state, rate, peak) {
    state.phasor = 0;
    state.autoReleasePhasor = 0;
    state.currentValue = peak;
    state.decayIncrement = (state.currentValue - 1) / Math.max(1, rate) / 50;
  }

  pluckTriggerAttack(state, params, rate) {
    const period = 1 / Math.max(1, rate);
    const velocity = this.clampValue(params.velocity, 0, 1);
    const sensitivity = this.clampValue(params.velocitySensitivity, 0, 1);
    const peak = (1 - sensitivity) + velocity * sensitivity;
    state.secondsPassed = 0;
    state.state = "delay";
    if (params.delayTime < period) {
      if (params.attackFeedback <= 1e-8) {
        state.state = "decay";
        this.pluckPrepareForDecay(state, rate, peak);
      } else {
        state.state = "attack";
      }
    }
    state.peak = peak;
  }

  pluckTriggerRelease(state, rate) {
    if (state.state !== "release") {
      state.state = "release";
      state.releaseIncrement = state.currentValue / Math.max(1, rate) / 50;
    }
  }

  pluckDecayFeedback(state, params) {
    let finalDecayMod = params.endingDecay;
    if (state.phasor < 1) {
      const shaped = this.exponentialCurve(state.phasor, params.decayModCurve || -1e-8);
      finalDecayMod = params.decay + params.decayModStart + shaped * (params.decayModEnd - params.decayModStart);
    }
    return Math.min(1 - 1e-6, Math.exp(-finalDecayMod * 10));
  }

  pluckEnvelopeSample(state, trigger, release, params, rate = sampleRate) {
    const safeRate = Math.max(1, Number(rate) || sampleRate || 44100);
    const period = 1 / safeRate;
    const safeTrigger = this.safeFilterNumber(trigger, null);
    const safeRelease = this.safeFilterNumber(release, null);
    const read = (key, fallback, min = -Infinity, max = Infinity) => this.clampValue(
      this.safeFilterNumber(params[key] ?? fallback, null),
      min,
      max,
    );
    const values = {
      attackFeedback: read("attackFeedback", 0.002, 0),
      autoReleaseTime: read("autoReleaseTime", 0.08, 0),
      decay: read("decay", 0.35, 0.1, 1),
      decayModCurve: read("decayModCurve", 0, -1, 1),
      decayModEnd: read("decayModEnd", 0.55, 0.01, 3),
      decayModFrequency: read("decayModFrequency", 1.5, 0, 100),
      decayModStart: read("decayModStart", 0.08, 0.001, 1.8),
      delayTime: read("delayTime", 0, 0),
      endingDecay: read("endingDecay", 0.8, 0, 1.4),
      level: read("level", 1, 0, 1),
      releaseFeedback: read("releaseFeedback", 0.35, 0, 1),
      velocity: read("velocity", 1, 0, 1),
      velocitySensitivity: read("velocitySensitivity", 0, 0, 1),
    };

    if (state.lastTrigger <= 0 && safeTrigger > 0) {
      this.pluckTriggerAttack(state, values, safeRate);
    }
    if (state.lastRelease <= 0 && safeRelease > 0) {
      this.pluckTriggerRelease(state, safeRate);
    }
    state.lastTrigger = safeTrigger;
    state.lastRelease = safeRelease;

    const attackFeedbackAmp = 1 / (Math.max(values.attackFeedback, 1e-8) * safeRate);
    const releaseFeedbackAmp = Math.min(1 - 1e-6, Math.exp(-values.releaseFeedback * 10));
    const autoReleaseIncrement = values.autoReleaseTime <= 1e-8
      ? 0
      : 1 / (Math.max(values.autoReleaseTime, 1e-8) * safeRate);
    const phasorIncrement = values.decayModFrequency / safeRate;

    switch (state.state) {
      case "delay":
        state.secondsPassed += period;
        if (state.secondsPassed >= values.delayTime) {
          state.state = "attack";
        }
        break;
      case "attack":
        state.currentValue += period + state.currentValue * attackFeedbackAmp;
        if (state.currentValue >= state.peak) {
          state.state = "decay";
          this.pluckPrepareForDecay(state, safeRate, state.peak);
        }
        break;
      case "decay":
        state.currentValue -= state.decayIncrement + state.currentValue * state.currentValue * this.pluckDecayFeedback(state, values);
        state.phasor += phasorIncrement;
        state.autoReleasePhasor += autoReleaseIncrement;
        if (autoReleaseIncrement > 0 && state.autoReleasePhasor >= 1) {
          this.pluckTriggerRelease(state, safeRate);
        }
        if (state.currentValue < 0) {
          state.currentValue = 0;
          state.secondsPassed = 0;
          state.phasor = 0;
          state.autoReleasePhasor = 0;
          state.state = "off";
        }
        break;
      case "release":
        state.currentValue -= state.releaseIncrement + state.currentValue * state.currentValue * releaseFeedbackAmp;
        if (state.currentValue <= 0) {
          state.currentValue = 0;
          state.secondsPassed = 0;
          state.phasor = 0;
          state.autoReleasePhasor = 0;
          state.state = "off";
        }
        break;
      case "off":
      default:
        break;
    }
    return this.safeFilterNumber(state.currentValue * values.level, null);
  }

  seededKey(nodeId, seed, salt) {
    return `${nodeId}.${salt}.${Math.max(0, Math.round(Number(seed) || 0))}`;
  }

  resetSeededState(state, nodeId, seed, salt) {
    const key = this.seededKey(nodeId, seed, salt);
    if (state.seedKey !== key) {
      state.seedKey = key;
      state.seed = this.stableSeed(key);
      state.gaussianSpare = null;
      state.brown = 0;
      state.pink = [0, 0, 0, 0, 0, 0, 0];
      if ("out" in state) {
        state.out = 0;
      }
      if (state.lowpass) {
        state.lowpass.outputBuffer = 0;
      }
    }
  }

  nextSeededUnipolar(state) {
    state.seed = (Math.imul(1664525, state.seed || 0x12345678) + 1013904223) >>> 0;
    return state.seed / 0xffffffff;
  }

  nextSeededBipolar(state) {
    return this.nextSeededUnipolar(state) * 2 - 1;
  }

  nextSeededGaussian(state) {
    if (state.gaussianSpare !== null && state.gaussianSpare !== undefined) {
      const spare = state.gaussianSpare;
      state.gaussianSpare = null;
      return spare;
    }
    const u1 = Math.max(1e-12, this.nextSeededUnipolar(state));
    const u2 = this.nextSeededUnipolar(state);
    const magnitude = Math.sqrt(-2 * Math.log(u1));
    const angle = Math.PI * 2 * u2;
    state.gaussianSpare = magnitude * Math.sin(angle);
    return magnitude * Math.cos(angle);
  }

  noiseGeneratorSample(state, params, nodeId) {
    this.resetSeededState(state, nodeId, params.seed, "noiseGenerator");
    const mode = Math.max(0, Math.min(4, Math.round(this.safeFilterNumber(params.mode, null))));
    const mean = this.safeFilterNumber(params.mean, null);
    const deviation = Math.max(0, this.safeFilterNumber(params.deviation, null));
    const level = this.safeFilterNumber(params.level, null);
    const white = this.nextSeededBipolar(state);
    let output = white;
    if (mode === 1) {
      output = mean + this.nextSeededGaussian(state) * deviation;
    } else if (mode === 2) {
      state.brown = this.clampValue(state.brown + white * Math.max(0.001, deviation) * 0.05, -1, 1);
      output = mean + state.brown;
    } else if (mode === 3) {
      state.pink[0] = 0.99886 * state.pink[0] + white * 0.0555179;
      state.pink[1] = 0.99332 * state.pink[1] + white * 0.0750759;
      state.pink[2] = 0.969 * state.pink[2] + white * 0.153852;
      state.pink[3] = 0.8665 * state.pink[3] + white * 0.3104856;
      state.pink[4] = 0.55 * state.pink[4] + white * 0.5329522;
      state.pink[5] = -0.7616 * state.pink[5] - white * 0.016898;
      output = mean + (state.pink[0] + state.pink[1] + state.pink[2] + state.pink[3] + state.pink[4] + state.pink[5] + state.pink[6] + white * 0.5362) * 0.11;
      state.pink[6] = white * 0.115926;
    } else if (mode === 4) {
      output = Math.abs(white) > 0.94 ? mean + Math.sign(white) * deviation : mean;
    } else {
      output = mean + white * deviation;
    }
    return this.safeFilterNumber(this.clampValue(output, -1, 1) * level, null);
  }

  rationalCurve(value, skew) {
    const t = this.clampValue(Number(value) || 0, 0, 1);
    const safeSkew = this.clampValue(Number(skew) || 0, -0.999, 0.999);
    return ((1 + safeSkew) * t) / (1 - safeSkew + 2 * safeSkew * t);
  }

  randomWalkSample(state, params, rate = sampleRate, nodeId = "") {
    this.resetSeededState(state, nodeId, params.seed, "randomWalk");
    const safeRate = Math.max(1, Number(rate) || sampleRate || 44100);
    const method = Math.max(0, Math.min(3, Math.round(this.safeFilterNumber(params.method, null))));
    const frequency = Math.max(0, this.safeFilterNumber(params.frequency, null));
    const jitter = Math.max(0, this.safeFilterNumber(params.jitter, null));
    const level = this.safeFilterNumber(params.level, null);
    const noise = this.nextSeededBipolar(state);
    const increment = this.clampValue(frequency / safeRate, 0, 1);
    const jitterInc = this.clampValue(jitter / safeRate, 0, 1);
    const stepSize = this.clampValue(increment + this.rationalCurve(jitterInc, 0.99), 0, 1);
    const averageIncrement = (jitterInc + increment) * 0.5;
    const whiteNoiseMix = averageIncrement >= 0.9
      ? this.rationalCurve((averageIncrement - 0.9) / 0.1, -0.7)
      : 0;
    const randomMix = 1 - whiteNoiseMix;

    if (method === 0) {
      return this.safeFilterNumber(noise * level, null);
    }
    if (method === 1) {
      return this.onePoleLowpassSample(state.lowpass, noise, frequency, safeRate) * level;
    }
    const step = method === 3 ? (noise > 0 ? stepSize : -stepSize) : noise * stepSize;
    state.out = this.clampValue(state.out + step, -1, 1);
    const mixed = state.out * randomMix + noise * whiteNoiseMix;
    return this.safeFilterNumber(this.onePoleLowpassSample(state.lowpass, mixed, frequency, safeRate) * level, null);
  }

  hashBipolar(index, seed) {
    let value = (Math.trunc(index) ^ Math.trunc(seed)) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 2246822507) >>> 0;
    value = Math.imul(value ^ (value >>> 13), 3266489909) >>> 0;
    value = (value ^ (value >>> 16)) >>> 0;
    return (value / 0xffffffff) * 2 - 1;
  }

  smoothNoise1d(x, seed) {
    const left = Math.floor(x);
    const frac = x - left;
    const smooth = frac * frac * (3 - 2 * frac);
    const a = this.hashBipolar(left, seed);
    const b = this.hashBipolar(left + 1, seed);
    return a + (b - a) * smooth;
  }

  fractalBrownianNoiseAxisState(state, axis) {
    const key = String(axis || "x");
    if (!state.axes || typeof state.axes !== "object") {
      state.axes = {};
    }
    if (!state.axes[key]) {
      state.axes[key] = { seedKey: "", time: 0 };
    }
    return state.axes[key];
  }

  fractalBrownianNoiseSample(state, params, rate = sampleRate, nodeId = "", axis = "x") {
    const axisState = this.fractalBrownianNoiseAxisState(state, axis);
    const safeRate = Math.max(1, Number(rate) || sampleRate || 44100);
    const seed = Math.max(0, Math.round(this.safeFilterNumber(params.seed, null)));
    const seedKey = this.seededKey(nodeId, seed, `fractalBrownianNoise:${axis}`);
    if (axisState.seedKey !== seedKey) {
      axisState.seedKey = seedKey;
      axisState.time = 0;
    }
    const frequency = Math.max(0, this.safeFilterNumber(params.frequency, null));
    const octaves = Math.max(1, Math.min(8, Math.round(this.safeFilterNumber(params.octaves, null))));
    const persistence = this.clampValue(this.safeFilterNumber(params.persistence, null), 0, 0.99);
    const scale = Math.max(0.000001, this.safeFilterNumber(params.scale, null));
    const level = this.safeFilterNumber(params.level, null);
    let total = 0;
    let amplitude = 1;
    let noiseFrequency = 1;
    let maxValue = 0;
    const baseSeed = this.stableSeed(seedKey);
    for (let i = 0; i < octaves; i += 1) {
      total += this.smoothNoise1d(axisState.time * scale * noiseFrequency, baseSeed + i * 1013) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      noiseFrequency *= 2;
    }
    axisState.time += frequency / safeRate;
    const normalized = maxValue > 0 ? total / maxValue : 0;
    return this.safeFilterNumber(normalized * level, null);
  }

  fractalBrownianNoiseVector(state, params, rate = sampleRate, nodeId = "") {
    return {
      "Out X": this.fractalBrownianNoiseSample(state, params, rate, nodeId, "x"),
      "Out Y": this.fractalBrownianNoiseSample(state, params, rate, nodeId, "y"),
      "Out Z": this.fractalBrownianNoiseSample(state, params, rate, nodeId, "z"),
    };
  }

  expAdsrCalcCoef(rate, targetRatio) {
    const safeRate = Math.max(0, Number(rate) || 0);
    const safeRatio = Math.max(0.000000001, Number(targetRatio) || 0.000000001);
    return safeRate <= 0 ? 0 : Math.exp(-Math.log((1 + safeRatio) / safeRatio) / safeRate);
  }

  expAdsrTriggerAttack(state, delay, attack, rate = sampleRate) {
    const period = 1 / Math.max(1, rate);
    if (delay < period) {
      if (attack <= period) {
        state.state = "decay";
        state.out = 1;
      } else {
        state.state = "attack";
      }
      return;
    }
    if (state.out <= 0.000001) {
      state.out = 0;
      state.secondsPassed = 0;
    }
    state.state = "delay";
  }

  expAdsrSample(state, gate, params, rate = sampleRate) {
    const safeGate = this.safeFilterNumber(gate, null);
    const delay = Math.max(0, this.safeFilterNumber(params.delay, null));
    const attack = Math.max(0, this.safeFilterNumber(params.attack, null));
    const decay = Math.max(0, this.safeFilterNumber(params.decay, null));
    const sustain = this.clampValue(this.safeFilterNumber(params.sustain, null), 0, 1);
    const release = Math.max(0, this.safeFilterNumber(params.release, null));
    const attackShape = Math.max(0.000000001, this.safeFilterNumber(params.attackShape, null));
    const releaseShape = Math.max(0.000000001, this.safeFilterNumber(params.releaseShape, null));
    const level = this.safeFilterNumber(params.level, null);
    const looping = this.safeFilterNumber(params.loop, null) >= 0.5;
    const safeRate = Math.max(1, rate || sampleRate || 44100);
    const period = 1 / safeRate;

    if (state.lastGate <= 0 && safeGate > 0) {
      this.expAdsrTriggerAttack(state, delay, attack, safeRate);
    } else if (state.lastGate > 0 && safeGate <= 0) {
      state.state = "release";
    }
    state.lastGate = safeGate;

    const attackCoef = this.expAdsrCalcCoef(attack * safeRate, attackShape);
    const decayCoef = this.expAdsrCalcCoef(decay * safeRate, releaseShape);
    const releaseCoef = this.expAdsrCalcCoef(release * safeRate, releaseShape);
    const attackBase = (1 + attackShape) * (1 - attackCoef);
    const decayBase = (sustain - releaseShape) * (1 - decayCoef);
    const releaseBase = -releaseShape * (1 - releaseCoef);

    switch (state.state) {
      case "delay":
        state.secondsPassed += period;
        if (state.secondsPassed >= delay) {
          state.state = attack <= period ? "decay" : "attack";
          state.secondsPassed = 0;
          if (attack <= period) {
            state.out = 1;
          }
        }
        break;
      case "attack":
        state.out = attackBase + state.out * attackCoef;
        if (state.out >= 1) {
          state.out = 1;
          state.state = "decay";
        }
        break;
      case "decay":
        state.out = decayBase + state.out * decayCoef;
        if (state.out <= sustain) {
          state.out = sustain;
          state.state = "sustain";
        }
        break;
      case "sustain":
        state.out = sustain;
        if (looping) {
          this.expAdsrTriggerAttack(state, delay, attack, safeRate);
        }
        break;
      case "release":
        state.out = releaseBase + state.out * releaseCoef;
        if (state.out <= 0) {
          state.out = 0;
          state.state = "off";
        }
        break;
      case "off":
      default:
        state.out = 0;
        break;
    }

    return this.safeFilterNumber(state.out * level, null);
  }

  linearEnvelopeTriggerAttack(state, delay, attack, rate = sampleRate) {
    const period = 1 / Math.max(1, rate);
    if (delay < period) {
      if (attack <= period) {
        state.state = "decay";
        state.out = 1;
      } else {
        state.state = "attack";
      }
      return;
    }
    if (state.out <= 0.000001) {
      state.out = 0;
      state.secondsPassed = 0;
    }
    state.state = "delay";
  }

  linearEnvelopeSample(state, gate, params, rate = sampleRate) {
    const safeGate = this.safeFilterNumber(gate, null);
    const delay = Math.max(0, this.safeFilterNumber(params.delay, null));
    const attack = Math.max(0, this.safeFilterNumber(params.attack, null));
    const decay = Math.max(0, this.safeFilterNumber(params.decay, null));
    const sustain = this.clampValue(this.safeFilterNumber(params.sustain, null), 0, 1);
    const release = Math.max(0, this.safeFilterNumber(params.release, null));
    const level = this.safeFilterNumber(params.level, null);
    const looping = this.safeFilterNumber(params.loop, null) >= 0.5;
    const safeRate = Math.max(1, rate || sampleRate || 44100);
    const period = 1 / safeRate;

    if (state.lastGate <= 0 && safeGate > 0) {
      this.linearEnvelopeTriggerAttack(state, delay, attack, safeRate);
    } else if (state.lastGate > 0 && safeGate <= 0) {
      state.state = "release";
      state.releaseDecrement = state.out * period / Math.max(release, period);
    }
    state.lastGate = safeGate;

    const attackIncrement = Math.min(period / Math.max(attack, period), 1);
    const decayDecrement = (1 - sustain) * period / Math.max(decay, period);

    switch (state.state) {
      case "delay":
        state.secondsPassed += period;
        if (state.secondsPassed >= delay) {
          state.state = attack <= period ? "decay" : "attack";
          state.secondsPassed = 0;
          if (attack <= period) {
            state.out = 1;
          }
        }
        break;
      case "attack":
        state.out += attackIncrement;
        if (state.out >= 1) {
          state.out = 1;
          state.state = "decay";
        }
        break;
      case "decay":
        state.out -= decayDecrement;
        if (state.out <= sustain) {
          state.out = sustain;
          state.state = "sustain";
        }
        break;
      case "sustain":
        if (looping) {
          state.state = "attack";
        }
        state.out = sustain;
        break;
      case "release":
        state.out -= state.releaseDecrement;
        if (state.out <= 0) {
          state.out = 0;
          state.state = "off";
          state.secondsPassed = 0;
        }
        break;
      case "off":
      default:
        break;
    }

    return this.safeFilterNumber(this.clampValue(state.out, 0, 1) * level, null);
  }

  vactrolEnvelopeCoefficient(seconds, rate = sampleRate) {
    const time = Number(seconds);
    if (!Number.isFinite(time) || time <= 0) {
      return 1;
    }
    const samples = Math.max(1, time * Math.max(1, rate || sampleRate || 44100));
    return 1 - Math.exp(-1 / samples);
  }

  vactrolEnvelopeSample(state, light, params, rate = sampleRate) {
    const safeLight = this.safeFilterNumber(light, null);
    const attack = Math.max(0, this.safeFilterNumber(params.attack, null));
    const release = Math.max(0, this.safeFilterNumber(params.release, null));
    const curve = Math.max(0.001, this.safeFilterNumber(params.curve, null));
    const sensitivity = Math.max(0, this.safeFilterNumber(params.sensitivity, null));
    const lightOffset = this.clampValue(this.safeFilterNumber(params.lightOffset, null), 0, 1);
    const darkCurrent = this.clampValue(this.safeFilterNumber(params.darkCurrent, null), 0, 1);
    const safeRate = Math.max(1, rate || sampleRate || 44100);
    const target = this.clampValue(safeLight * sensitivity + lightOffset, 0, 1);
    const coefficient = target > state.raw
      ? this.vactrolEnvelopeCoefficient(attack, safeRate)
      : this.vactrolEnvelopeCoefficient(release, safeRate);
    state.raw += (target - state.raw) * coefficient;
    const shaped = Math.pow(this.clampValue(state.raw, 0, 1), curve);
    state.out = this.clampValue(darkCurrent + shaped * (1 - darkCurrent), 0, 1);
    return this.safeFilterNumber(state.out, null);
  }

  flowerChildSecondsToSamples(seconds, rate = sampleRate) {
    const time = Number(seconds);
    if (!Number.isFinite(time) || time <= 0) {
      return 1;
    }
    return Math.max(1, time * Math.max(1, rate || sampleRate || 44100));
  }

  flowerChildEnvelopeFollowerSample(state, input, params, rate = sampleRate) {
    const target = this.clampValue(Math.abs(this.safeFilterNumber(input, null)), 0, 1);
    const attackSamples = this.flowerChildSecondsToSamples(this.safeFilterNumber(params.attack, null), rate);
    const holdSamples = this.flowerChildSecondsToSamples(this.safeFilterNumber(params.hold, null), rate);
    const decaySamples = this.flowerChildSecondsToSamples(this.safeFilterNumber(params.decay, null), rate);
    const attackStep = 1 / attackSamples;
    const decayStep = 1 / decaySamples;
    const current = this.clampValue(Number(state.currentSlewedValue) || 0, 0, 1);
    if (target >= current) {
      state.currentSlewedValue = Math.min(target, current + attackStep);
      state.holdCounter = holdSamples;
    } else if ((Number(state.holdCounter) || 0) > 0) {
      state.holdCounter = Math.max(0, (Number(state.holdCounter) || 0) - 1);
      state.currentSlewedValue = current;
    } else {
      state.currentSlewedValue = Math.max(target, current - decayStep);
    }
    state.out = this.safeFilterNumber(this.clampValue(state.currentSlewedValue, 0, 1), null);
    return state.out;
  }

  createSpiralState() {
    return {
      morph: 0,
      phase: 0,
      position: 0,
      rotX: 0,
      rotY: 0,
      zHistory: 0,
    };
  }

  spiralWrap01(value) {
    return value - Math.floor(value);
  }

  spiralFmod(value, divisor) {
    return value - Math.trunc(value / divisor) * divisor;
  }

  spiralTrisaw(phase, sharp) {
    const wrapped = this.spiralWrap01(phase);
    const warp = Math.max(0.001, Math.min(0.999, sharp));
    return wrapped < warp ? wrapped / warp : (1 - wrapped) / (1 - warp);
  }

  spiralNextPhasor(state, key, frequency, offset, sampleRate, bipolar = false) {
    const base = Number(state[key]) || 0;
    const current = this.spiralWrap01(base + offset);
    state[key] = this.spiralWrap01(base + frequency / sampleRate);
    return bipolar ? current * 2 - 1 : current;
  }

  spiralRotate(inX, inY, inZ, rotX, rotY) {
    const cosRotX = Math.cos(rotX);
    const sinRotX = Math.sin(rotX);
    const cosRotY = Math.cos(rotY);
    const sinRotY = Math.sin(rotY);
    const help11 = inX * cosRotX - inY * sinRotX;
    const help12 = inX * sinRotX + inY * cosRotX;
    const help21 = help11 * cosRotY - inZ * sinRotY;
    const help22 = help11 * sinRotY + inZ * cosRotY;
    return { x: help12, y: help21, z: help22 };
  }

  spiralShape(lophas, phasor, dense, div, morph) {
    const tau = Math.PI * 2;
    const piOver2 = Math.PI / 2;
    const piOver4 = Math.PI / 4;
    const clampMorph01 = this.clampValue(morph, 0, 1);
    const clampMorph02 = this.clampValue(morph, 0, 2);
    const formula001 = piOver2 * (lophas - 0.5) * clampMorph02 + piOver4;
    let loSin = Math.sin(formula001);
    let loCos = Math.cos(formula001);
    const formula002 = Math.pow(clampMorph01, 2);
    const oneZDiv = 1 / div;
    const loY = formula002 * (1 - oneZDiv * loSin);
    const loZ = formula002 * (1 - oneZDiv * loCos);
    const formula003 = Math.PI / (2 + 6 * (1 - clampMorph01)) * (lophas - 0.5) * clampMorph02 + piOver4;
    loSin = Math.sin(formula003);
    loCos = Math.cos(formula003);
    const tauPhasor = tau * phasor;
    const sp0Sin = Math.sin(tauPhasor);
    const sp0Cos = Math.cos(tauPhasor);
    const spiral0X = sp0Sin;
    const spiral0Y = sp0Cos * loSin;
    const spiral0Z = sp0Cos * loCos;
    let sp1Sin = Math.sin(dense * tauPhasor - piOver2);
    const sp1Cos = Math.cos(dense * tauPhasor - piOver2);
    sp1Sin *= -1;
    const sp1SinTimesSp0Sin = sp1Sin * sp0Sin;
    const spiral1X = div * sp1SinTimesSp0Sin;
    const spiral1Y = div * ((sp1Sin * sp0Cos) * loSin + sp1Cos * loCos);
    const spiral1Z = div * (sp1Cos * -loSin + (sp1Sin * sp0Cos) * loCos);
    let sp2Cos = Math.sin(dense * dense * tau * phasor);
    const sp2Sin = Math.cos(dense * dense * tau * phasor);
    sp2Cos *= -1;
    const divSquared = div * div;
    const spiral2X = divSquared * (sp2Cos * sp0Cos + sp2Sin * sp1SinTimesSp0Sin);
    const spiral2Y = divSquared * ((sp2Cos * -sp0Sin + sp2Sin * sp1Sin * sp0Cos) * loSin + (sp2Sin * sp1Cos) * loCos);
    const spiral2Z = divSquared * ((sp2Sin * sp1Cos) * -loSin + (sp2Cos * -sp0Sin + sp2Sin * sp1Sin * sp0Cos) * loCos);
    let waveX = spiral0X + spiral1X + spiral2X;
    let waveY = loY + spiral0Y + spiral1Y + spiral2Y;
    let waveZ = loZ + spiral0Z + spiral1Z + spiral2Z;
    let x = Math.exp(morph * Math.log(div));
    waveX *= x;
    waveY *= x;
    waveZ *= x;
    let y = 0;
    const formula004 = Math.exp(morph * Math.log(dense)) / 4;
    if (formula004 < 1) {
      y = Math.pow(1 - formula004, 2);
    }
    x = x * Math.sin(piOver4) * y;
    waveX -= x;
    waveY += x;
    return this.spiralRotate(waveX, waveY, waveZ, 0, 0);
  }

  spiralRender(inX, inY, inZ, zDepth) {
    const formula = zDepth * 1.25 * (inZ / 2 + 0.5);
    const multiplier = 1 + zDepth;
    return {
      left: (inX - formula * inX) * multiplier,
      right: (inY - formula * inY) * multiplier,
    };
  }

  jerobeamSpiralSample(options) {
    const tau = Math.PI * 2;
    const piOver2 = Math.PI / 2;
    const state = options.state;
    const dense = Math.max(Math.abs(options.density), 1e-6);
    const div = Math.max(options.size, 0.1);
    const logDense = Math.log(dense);
    const zDarkness = Math.pow(Math.pow(options.zAmount, 2) * 5 + 1, state.zHistory || 0);
    const mainPhasor = this.spiralNextPhasor(state, "phase", options.frequency * zDarkness, 0, options.sampleRate);
    const fphasEnds = this.spiralTrisaw(mainPhasor, options.sharp);
    const fphasMids = options.sharpCurveMult * (Math.asin((Math.asin(fphasEnds * 2 - 1) / Math.PI + 0.5) * 2 - 1) / Math.PI + 0.5);
    const lophas = options.sharpCurve * fphasMids + (1 - options.sharpCurve) * fphasEnds;
    const morph = this.spiralNextPhasor(state, "morph", options.morphSpeed, options.morph, options.sampleRate, true) + 0.5;
    let morph2 = morph + 1;
    if (morph2 > 1.5) {
      morph2 -= 2;
    }
    const fmodLophas = this.spiralFmod(lophas - 0.5, 1);
    let phas = this.spiralFmod(fmodLophas * Math.exp(morph * logDense) / 4 + 0.375, 1);
    const phas2 = this.spiralFmod(fmodLophas * Math.exp(morph2 * logDense) / 4 + 0.375, 1);
    phas += this.spiralNextPhasor(state, "position", options.positionSpeed, options.position, options.sampleRate);
    const wave1 = this.spiralShape(lophas, phas, dense, div, morph);
    const wave2 = this.spiralShape(lophas, phas2, dense, div, morph2);
    const switchAmount = Math.sin(Math.PI * morph) / 2 + 0.5;
    let waveX = wave1.x * switchAmount + wave2.x * (1 - switchAmount);
    let waveY = wave1.y * switchAmount + wave2.y * (1 - switchAmount);
    let waveZ = wave1.z * switchAmount + wave2.z * (1 - switchAmount);
    let volumeCorrection = 1 / (1 + div + div * div);
    const halfZDepth = options.zDepth / 2;
    volumeCorrection = volumeCorrection + halfZDepth - volumeCorrection * halfZDepth;
    waveX *= volumeCorrection;
    waveY *= volumeCorrection;
    waveZ *= volumeCorrection;
    waveY += 0.25;
    waveZ += 0.36;
    const rotated = this.spiralRotate(
      waveX,
      waveY,
      waveZ,
      -tau * this.spiralNextPhasor(state, "rotX", options.rotXSpeed, options.rotX, options.sampleRate),
      tau * this.spiralNextPhasor(state, "rotY", options.rotYSpeed, options.rotY, options.sampleRate) - piOver2,
    );
    const stereo = this.spiralRender(rotated.x, rotated.y, rotated.z, options.zDepth);
    state.zHistory = rotated.z;
    return { ...stereo, x: rotated.x, y: rotated.y, z: rotated.z };
  }

  evaluateFrame(frame, frames, inputs = [], rate = this.engineSampleRate || sampleRate, inputFrame = frame) {
    const safeRate = Math.max(1, Number(rate) || sampleRate || 44100);
    const frameValues = new Map();
    const mixInput = (nodeId, port = "In") => (
      this.inputConnections.get(this.inputKey(nodeId, port)) || []
    ).reduce((sum, connection) => sum + this.readRuntimePortOutput(
      frameValues,
      connection.sourceNode,
      connection.sourcePort,
      frame,
      frames,
    ), 0);
    const incomingClockRate = (nodeId) => {
      const connection = (this.inputConnections.get(this.inputKey(nodeId, "Clock")) || [])[0];
      const sourceNode = this.nodes.get(connection?.sourceNode);
      return sourceNode?.type === "clock"
        ? Math.max(0, Number(sourceNode.params?.rate) || 0)
        : 0;
    };
    const graphSampleX = (node, nodeId) => {
      const mode = Math.round(this.readEffectiveParameter(node, "mode", 0, frame, frames, frameValues));
      if (mode <= 0) {
        return mixInput(nodeId);
      }
      const rateValue = Math.max(0, this.readEffectiveParameter(node, "rate", 1, frame, frames, frameValues));
      const phaseValue = this.readEffectiveParameter(node, "phase", 0, frame, frames, frameValues);
      return this.wrapValue((Number(inputFrame) / safeRate) * rateValue + phaseValue, 0, 1);
    };

    for (const nodeId of this.order) {
      const node = this.nodes.get(nodeId);
      let value = 0;
      if (node?.type === "groupInput") {
        value = {
          Out: Number(this.externalGroupInputs?.get(nodeId)) || 0,
        };
      } else if (node?.type === "audioInput") {
        const input = inputs[0] || [];
        const leftChannel = input[0] || input[1] || null;
        const rightChannel = input[1] || input[0] || null;
        const left = Number(leftChannel?.[inputFrame]) || 0;
        const right = Number(rightChannel?.[inputFrame]) || left;
        const level = this.readEffectiveParameter(node, "level", 1, frame, frames, frameValues);
        value = {
          Left: left * level,
          Out: ((left + right) * 0.5) * level,
          Right: right * level,
        };
      } else if (node?.type === "osc" || node?.type === "fbPolyBlepOsc") {
        const resetState = this.oscResetStates.get(nodeId) || this.createOscResetState();
        this.oscResetStates.set(nodeId, resetState);
        const resetValue = this.safeFilterNumber(mixInput(nodeId, "Reset"), resetState);
        const resetEdge = resetState.lastReset <= 0 && resetValue > 0;
        resetState.lastReset = resetValue;
        const phase = resetEdge ? 0 : this.phases.get(nodeId) || 0;
        if (resetEdge) {
          this.triangleStates.set(nodeId, 0);
        }
        const phaseOffset = this.phaseRadians(
          this.readEffectiveParameter(node, "phase", 0, frame, frames, frameValues),
        );
        const frequency = this.readEffectiveParameter(
          node,
          "frequency",
          220,
          frame,
          frames,
          frameValues,
        );
        const waveform = this.readEffectiveParameter(
          node,
          "waveform",
          0,
          frame,
          frames,
          frameValues,
        );
        const incrementInput = this.safeFilterNumber(mixInput(nodeId, "Increment"), null);
        const pitchInput = this.clampValue(
          this.safeFilterNumber(mixInput(nodeId, "0.1V/Oct"), null),
          -1,
          1,
        );
        const pitchedFrequency = Math.max(0, frequency * (2 ** (pitchInput / 0.1)));
        const phaseIncrement = (pitchedFrequency / safeRate) + incrementInput;
        const level = this.readEffectiveParameter(node, "level", 1, frame, frames, frameValues);
        const sampleOscillator = (sampleNodeId, sampleWaveform) => (
          node?.type === "fbPolyBlepOsc"
            ? this.forwardBackwardPolyBlepOscillatorSample(sampleNodeId, phase + phaseOffset, phaseIncrement, sampleWaveform)
            : this.oscillatorSample(sampleNodeId, phase + phaseOffset, phaseIncrement, sampleWaveform)
        );
        const selected = sampleOscillator(nodeId, waveform) * level;
        value = {
          Out: selected,
          Saw: sampleOscillator(`${nodeId}:saw`, 0) * level,
          Square: sampleOscillator(`${nodeId}:square`, 1) * level,
          Tri: sampleOscillator(`${nodeId}:tri`, 2) * level,
          Sine: sampleOscillator(`${nodeId}:sine`, 3) * level,
          "Wave Out": selected,
          Noise: selected,
        };
        this.phases.set(
          nodeId,
          this.wrapValue(phase + Math.PI * 2 * phaseIncrement, 0, Math.PI * 2),
        );
      } else if (node?.type === "additiveOsc") {
        const resetState = this.oscResetStates.get(nodeId) || this.createOscResetState();
        this.oscResetStates.set(nodeId, resetState);
        const resetValue = this.safeFilterNumber(mixInput(nodeId, "Reset"), resetState);
        const resetEdge = resetState.lastReset <= 0 && resetValue > 0;
        resetState.lastReset = resetValue;
        const phase = resetEdge ? 0 : this.phases.get(nodeId) || 0;
        const phaseOffset = this.phaseRadians(
          this.readEffectiveParameter(node, "phase", 0, frame, frames, frameValues),
        );
        const frequency = this.readEffectiveParameter(
          node,
          "frequency",
          220,
          frame,
          frames,
          frameValues,
        );
        const pitchInput = this.clampValue(
          this.safeFilterNumber(mixInput(nodeId, "0.1V/Oct"), null),
          -1,
          1,
        );
        const pitchedFrequency = Math.max(0, frequency * (2 ** (pitchInput / 0.1)));
        const incrementInput = this.safeFilterNumber(mixInput(nodeId, "Increment"), null);
        const phaseIncrement = (pitchedFrequency / safeRate) + incrementInput;
        const additiveSample = this.additiveOscillatorSample(
          phase + phaseOffset,
          {
            frequency: pitchedFrequency,
            dampingAlgorithm: this.readEffectiveParameter(node, "dampingAlgorithm", 0, frame, frames, frameValues),
            dampingCurve: this.readEffectiveParameter(node, "dampingCurve", 0, frame, frames, frameValues),
            dampingFilterFrequency: this.readEffectiveParameter(node, "dampingFilterFrequency", 20000, frame, frames, frameValues),
            harmonics: this.readEffectiveParameter(node, "harmonics", 32, frame, frames, frameValues),
            harmonicPhaseAdd: this.readEffectiveParameter(node, "harmonicPhaseAdd", 0, frame, frames, frameValues),
            harmonicPhaseAlgorithm: this.readEffectiveParameter(node, "harmonicPhaseAlgorithm", 0, frame, frames, frameValues),
            harmonicPhaseCurve: this.readEffectiveParameter(node, "harmonicPhaseCurve", 1, frame, frames, frameValues),
            harmonicPhaseMultiply: this.readEffectiveParameter(node, "harmonicPhaseMultiply", 0, frame, frames, frameValues),
            level: this.readEffectiveParameter(node, "level", 0.35, frame, frames, frameValues),
            modA: this.readEffectiveParameter(node, "modA", 0.5, frame, frames, frameValues),
            waveform: this.readEffectiveParameter(node, "waveform", 1, frame, frames, frameValues),
          },
          safeRate,
        );
        value = { Out: additiveSample };
        this.phases.set(
          nodeId,
          this.wrapValue(phase + Math.PI * 2 * phaseIncrement, 0, Math.PI * 2),
        );
      } else if (node?.type === "noise") {
        const state = this.noiseSampleHoldStates.get(nodeId) || this.createNoiseSampleHoldState();
        this.noiseSampleHoldStates.set(nodeId, state);
        value = this.noiseSampleHoldSample(
          state,
          nodeId,
          this.readEffectiveParameter(node, "seed", 1, frame, frames, frameValues),
          this.readEffectiveParameter(node, "speed", 1, frame, frames, frameValues),
          safeRate,
        ) *
          this.readEffectiveParameter(node, "level", 1, frame, frames, frameValues);
      } else if (node?.type === "stereoNoise") {
        const level = this.readEffectiveParameter(node, "level", 1, frame, frames, frameValues);
        const seed = this.readEffectiveParameter(node, "seed", 1, frame, frames, frameValues);
        const left = this.nextSeededNoiseSample(nodeId, seed, "left") * level;
        const right = this.nextSeededNoiseSample(nodeId, seed, "right") * level;
        value = {
          Left: left,
          Out: (left + right) * 0.5,
          Right: right,
        };
      } else if (node?.type === "noiseGenerator") {
        const state = this.noiseGeneratorStates.get(nodeId) || this.createNoiseGeneratorState();
        this.noiseGeneratorStates.set(nodeId, state);
        const read = (key, fallback) => this.readEffectiveParameter(node, key, fallback, frame, frames, frameValues);
        value = this.noiseGeneratorSample(
          state,
          {
            deviation: read("deviation", 0.5),
            level: read("level", 1),
            mean: read("mean", 0),
            mode: read("mode", 0),
            seed: read("seed", 1),
          },
          nodeId,
        );
      } else if (node?.type === "randomWalk") {
        const state = this.randomWalkStates.get(nodeId) || this.createRandomWalkState();
        this.randomWalkStates.set(nodeId, state);
        const read = (key, fallback) => this.readEffectiveParameter(node, key, fallback, frame, frames, frameValues);
        value = this.randomWalkSample(
          state,
          {
            frequency: read("frequency", 2),
            jitter: read("jitter", 0.25),
            level: read("level", 1),
            method: read("method", 3),
            seed: read("seed", 1),
          },
          safeRate,
          nodeId,
        );
      } else if (node?.type === "fractalBrownianNoise") {
        const state = this.fractalBrownianNoiseStates.get(nodeId) || this.createFractalBrownianNoiseState();
        this.fractalBrownianNoiseStates.set(nodeId, state);
        const read = (key, fallback) => this.readEffectiveParameter(node, key, fallback, frame, frames, frameValues);
        value = this.fractalBrownianNoiseVector(
          state,
          {
            frequency: read("frequency", 0.5),
            level: read("level", 1),
            octaves: read("octaves", 4),
            persistence: read("persistence", 0.5),
            scale: read("scale", 1),
            seed: read("seed", 1),
          },
          safeRate,
          nodeId,
        );
      } else if (node?.type === "clock") {
        const state = this.clockStates.get(nodeId) || this.createClockState();
        this.clockStates.set(nodeId, state);
        value = this.clockSample(
          state,
          this.readEffectiveParameter(node, "rate", 2, frame, frames, frameValues),
          this.readEffectiveParameter(node, "duty", 0.5, frame, frames, frameValues),
          this.readEffectiveParameter(node, "level", 1, frame, frames, frameValues),
          safeRate,
        );
      } else if (node?.type === "randomClock") {
        const state = this.randomClockStates.get(nodeId) || this.createRandomClockState();
        this.randomClockStates.set(nodeId, state);
        const read = (key, fallback) => this.readEffectiveParameter(node, key, fallback, frame, frames, frameValues);
        value = this.randomClockSample(
          state,
          mixInput(nodeId, "Reset"),
          {
            duty: read("duty", 0.5),
            level: read("level", 1),
            maxSeconds: read("maxSeconds", 1),
            minSeconds: read("minSeconds", 0.25),
            seed: read("seed", 1),
            threshold: read("threshold", 0),
            triggerTime: read("triggerTime", 0.01),
          },
          safeRate,
          nodeId,
        );
      } else if (node?.type === "clockDivider") {
        const state = this.clockDividerStates.get(nodeId) || this.createTriggerDividerState();
        this.clockDividerStates.set(nodeId, state);
        const read = (key, fallback) => this.readEffectiveParameter(node, key, fallback, frame, frames, frameValues);
        const division = Math.max(1, Math.min(64, Math.round(read("division", 2))));
        const sourceRate = incomingClockRate(nodeId);
        const pulseTime = sourceRate > 0
          ? this.clampValue(read("duty", 0.5), 0.01, 1) * division / sourceRate
          : 0.01;
        value = this.triggerDividerSample(
          state,
          mixInput(nodeId, "Clock"),
          mixInput(nodeId, "Reset"),
          {
            division,
            level: read("level", 1),
            pulseTime,
            threshold: read("threshold", 0),
          },
          safeRate,
        );
      } else if (node?.type === "delayedTrigger") {
        const state = this.delayedTriggerStates.get(nodeId) || this.createDelayedTriggerState();
        this.delayedTriggerStates.set(nodeId, state);
        const read = (key, fallback) => this.readEffectiveParameter(node, key, fallback, frame, frames, frameValues);
        value = this.delayedTriggerSample(
          state,
          mixInput(nodeId, "Trigger"),
          mixInput(nodeId, "Reset"),
          {
            delay: read("delay", 0.1),
            level: read("level", 1),
            pulseTime: read("pulseTime", 0.01),
            threshold: read("threshold", 0),
          },
          safeRate,
        );
      } else if (node?.type === "triggerCounter") {
        const state = this.triggerCounterStates.get(nodeId) || this.createTriggerCounterState();
        this.triggerCounterStates.set(nodeId, state);
        const read = (key, fallback) => this.readEffectiveParameter(node, key, fallback, frame, frames, frameValues);
        value = this.triggerCounterSample(
          state,
          mixInput(nodeId, "Trigger"),
          mixInput(nodeId, "Reset"),
          {
            countMax: read("countMax", 8),
            increment: read("increment", 1),
            level: read("level", 1),
            pulseTime: read("pulseTime", 0.01),
            threshold: read("threshold", 0),
          },
          safeRate,
        );
      } else if (node?.type === "triggerDivider") {
        const state = this.triggerDividerStates.get(nodeId) || this.createTriggerDividerState();
        this.triggerDividerStates.set(nodeId, state);
        const read = (key, fallback) => this.readEffectiveParameter(node, key, fallback, frame, frames, frameValues);
        value = this.triggerDividerSample(
          state,
          mixInput(nodeId, "Trigger"),
          mixInput(nodeId, "Reset"),
          {
            division: read("division", 2),
            level: read("level", 1),
            pulseTime: read("pulseTime", 0.01),
            threshold: read("threshold", 0),
          },
          safeRate,
        );
      } else if (node?.type === "stepSequencer") {
        const state = this.stepSequencerStates.get(nodeId) || this.createStepSequencerState();
        this.stepSequencerStates.set(nodeId, state);
        const read = (key, fallback) => this.readEffectiveParameter(node, key, fallback, frame, frames, frameValues);
        value = this.stepSequencerSample(
          state,
          mixInput(nodeId, "Trigger"),
          mixInput(nodeId, "Reset"),
          {
            level: read("level", 1),
            steps: read("steps", 8),
            threshold: read("threshold", 0),
            values: [
              read("step1", 0),
              read("step2", 0.25),
              read("step3", 0.5),
              read("step4", 0.75),
              read("step5", 1),
              read("step6", 0.75),
              read("step7", 0.5),
              read("step8", 0.25),
            ],
          },
        );
      } else if (node?.type === "spiral") {
        const state = this.spiralStates.get(nodeId) || this.createSpiralState();
        this.spiralStates.set(nodeId, state);
        const read = (key, fallback) => this.readEffectiveParameter(
          node,
          key,
          fallback,
          frame,
          frames,
          frameValues,
        );
        const spiral = this.jerobeamSpiralSample({
          density: read("density", 1),
          frequency: read("frequency", 440),
          morph: read("morph", 0),
          morphSpeed: read("morphSpeed", 0),
          position: read("position", 0),
          positionSpeed: read("positionSpeed", 0),
          rotX: read("rotX", 0),
          rotXSpeed: read("rotXSpeed", 0),
          rotY: read("rotY", 0),
          rotYSpeed: read("rotYSpeed", 0),
          sampleRate: safeRate,
          sharp: read("sharp", 0.5),
          sharpCurve: read("sharpCurve", 0),
          sharpCurveMult: read("sharpCurveMult", 1),
          size: read("size", 0.5),
          state,
          zAmount: read("zAmount", 0),
          zDepth: read("zDepth", 0),
        });
        const level = read("level", 1);
        value = {
          X: spiral.x * level,
          Y: spiral.y * level,
          Z: spiral.z * level,
        };
      } else if (node?.type === "midiOut") {
        const hasMidiInput = this.inputConnections.has(this.inputKey(nodeId, "MIDI Number"));
        const midiNumber = this.clampValue(Math.round(this.readEffectiveParameter(
          node,
          "midiNumber",
          60,
          frame,
          frames,
          frameValues,
        )), 0, 127);
        const outputMidiNumber = hasMidiInput
          ? this.clampValue(Math.round(Number(mixInput(nodeId, "MIDI Number")) || 0), 0, 127)
          : midiNumber;
        value = {
          "Full Value": outputMidiNumber,
          Normalized: outputMidiNumber / 127,
        };
      } else if (node?.type === "midiNotePitch") {
        const pitch = this.clampValue((
          Number(mixInput(nodeId, "MIDI Note")) +
          Number(mixInput(nodeId, "Octave Offset")) * 12 +
          Number(mixInput(nodeId, "Pitch Offset"))
        ) || 0, 0, 127);
        value = {
          Frequency: 440 * (2 ** ((pitch - 69) / 12)),
          "Pitch 0-1": pitch / 127,
          "Pitch 0-127": pitch,
        };
      } else if (node?.type === "keyboardController") {
        const signal = this.midiKeyboardSignal || {};
        const midi = this.clampValue(Math.round(Number(signal.midi) || 60), 0, 127);
        const key = this.clampValue(Number(signal.keyIndex) || 12, 0, 24);
        const frequency = 440 * (2 ** ((midi - 69) / 12));
        const outputFrequency = Math.max(0, Number(signal.frequency) || frequency);
        const increment = Math.max(0, Number(signal.increment) || outputFrequency / safeRate);
        const gatePulse = this.midiKeyboardGatePulseSamples > 0 ? 1 : 0;
        this.midiKeyboardGatePulseSamples = Math.max(0, this.midiKeyboardGatePulseSamples - 1);
        value = {
          "1 Sample Gate": gatePulse,
          "0.1V/Oct": this.clampValue(Number(signal.tenthVoltPerOctave) || midi / 120, 0, 1),
          Double: this.clampValue(Number(signal.midiNormalized) || midi / 127, 0, 1),
          Frequency: outputFrequency,
          Gate: Number(signal.gate) > 0 ? 1 : 0,
          Increment: increment,
          Key: key,
          MIDI: midi,
          Pitch: this.clampValue(Number(signal.pitchValue) || midi, 0, 127),
          Q: this.clampValue(Number(signal.keyQuantized) || key / 24, 0, 1),
          X: this.clampValue(Number(signal.x) || 0, 0, 1),
          Y: this.clampValue(Number(signal.y) || 0, 0, 1),
        };
      } else if (node?.type === "macroControls") {
        value = {};
        for (let index = 0; index < 10; index += 1) {
          value[`M${index + 1}`] = this.clampValue(Number(this.macroControls?.[index]) || 0, 0, 1);
        }
      } else if (node?.type === "pitchModWheel") {
        const pitchWheel = Number(this.pitchModWheelSignal?.pitch);
        value = {
          "Mod Wheel": this.clampValue(Number(this.pitchModWheelSignal?.mod) || 0, 0, 1),
          "Pitch Wheel": this.clampValue(Number.isFinite(pitchWheel) ? pitchWheel : 0, -1, 1),
        };
      } else if (node?.type === "gain") {
        value = mixInput(nodeId) *
          this.readEffectiveParameter(node, "amount", 1, frame, frames, frameValues);
      } else if (node?.type === "led") {
        value = {
          Out: this.safeFilterNumber(mixInput(nodeId, "In"), null),
        };
      } else if (node?.type === "moduleGroup") {
        value = this.evaluateModuleGroup(node, mixInput, frame, frames, safeRate, inputFrame);
      } else if (node?.type === "codeblock") {
        value = this.evaluateCodeblock(node, mixInput, frame, frames, safeRate, inputFrame);
      } else if (node?.type === "graph") {
        value = this.graphValueAt(node.graph, graphSampleX(node, nodeId));
      } else if (node?.type === "bias") {
        value = mixInput(nodeId) +
          this.readEffectiveParameter(node, "offset", 0, frame, frames, frameValues);
      } else if (node?.type === "valueSlider") {
        const offset = this.readEffectiveParameter(node, "offset", 0, frame, frames, frameValues);
        value = { Bias: offset, Out: offset, offset };
      } else if (node?.type === "highpass") {
        const state = this.highpassStates.get(nodeId) || this.createHighpassState();
        this.highpassStates.set(nodeId, state);
        value = this.onePoleHighpassSample(
          state,
          mixInput(nodeId),
          this.readEffectiveParameter(node, "frequency", 1000, frame, frames, frameValues),
          safeRate,
        );
      } else if (node?.type === "lowpass") {
        const state = this.lowpassStates.get(nodeId) || this.createLowpassState();
        this.lowpassStates.set(nodeId, state);
        value = this.onePoleLowpassSample(
          state,
          mixInput(nodeId),
          this.readEffectiveParameter(node, "frequency", 1000, frame, frames, frameValues),
          safeRate,
        );
      } else if (node?.type === "bandpass") {
        const state = this.bandpassStates.get(nodeId) || this.createBandpassState();
        this.bandpassStates.set(nodeId, state);
        value = this.onePoleBandpassSample(
          state,
          mixInput(nodeId),
          this.readEffectiveParameter(node, "lowFrequency", 200, frame, frames, frameValues),
          this.readEffectiveParameter(node, "highFrequency", 2000, frame, frames, frameValues),
          safeRate,
        );
      } else if (node?.type === "cookbookFilter") {
        const state = this.cookbookFilterStates.get(nodeId) || this.createCookbookFilterState();
        this.cookbookFilterStates.set(nodeId, state);
        value = this.cookbookFilterSample(
          state,
          mixInput(nodeId),
          this.readEffectiveParameter(node, "mode", 1, frame, frames, frameValues),
          this.readEffectiveParameter(node, "frequency", 1000, frame, frames, frameValues),
          this.readEffectiveParameter(node, "q", 1, frame, frames, frameValues),
          this.readEffectiveParameter(node, "gain", 0, frame, frames, frameValues),
          this.readEffectiveParameter(node, "stages", 2, frame, frames, frameValues),
          safeRate,
        );
      } else if (node?.type === "ladderFilter") {
        const state = this.ladderFilterStates.get(nodeId) || this.createLadderFilterState();
        this.ladderFilterStates.set(nodeId, state);
        value = this.ladderFilterSample(
          state,
          mixInput(nodeId),
          {
            frequency: this.readEffectiveParameter(node, "frequency", 1000, frame, frames, frameValues),
            mode: this.readEffectiveParameter(node, "mode", 1, frame, frames, frameValues),
            resonance: this.readEffectiveParameter(node, "resonance", 0.2, frame, frames, frameValues),
            stages: this.readEffectiveParameter(node, "stages", 4, frame, frames, frameValues),
          },
          safeRate,
        );
      } else if (node?.type === "slewLimiter") {
        const state = this.slewLimiterStates.get(nodeId) || this.createSlewLimiterState();
        this.slewLimiterStates.set(nodeId, state);
        value = this.slewLimiterSample(
          state,
          mixInput(nodeId),
          this.readEffectiveParameter(node, "upTime", 0.05, frame, frames, frameValues),
          this.readEffectiveParameter(node, "downTime", 0.20, frame, frames, frameValues),
          safeRate,
        );
      } else if (node?.type === "sampleHold") {
        const state = this.sampleHoldStates.get(nodeId) || this.createSampleHoldState();
        this.sampleHoldStates.set(nodeId, state);
        value = this.sampleHoldSample(
          state,
          mixInput(nodeId, "In"),
          mixInput(nodeId, "Trigger"),
          this.readEffectiveParameter(node, "threshold", 0, frame, frames, frameValues),
        );
      } else if (node?.type === "expAdsr") {
        const state = this.expAdsrStates.get(nodeId) || this.createExpAdsrState();
        this.expAdsrStates.set(nodeId, state);
        const read = (key, fallback) => this.readEffectiveParameter(node, key, fallback, frame, frames, frameValues);
        value = this.expAdsrSample(
          state,
          mixInput(nodeId, "Gate"),
          {
            attack: read("attack", 0.08),
            attackShape: read("attackShape", 0.3),
            decay: read("decay", 0.22),
            delay: read("delay", 0),
            level: read("level", 1),
            loop: read("loop", 0),
            release: read("release", 0.45),
            releaseShape: read("releaseShape", 0.0001),
            sustain: read("sustain", 0.55),
          },
          safeRate,
        );
      } else if (node?.type === "linearEnvelope") {
        const state = this.linearEnvelopeStates.get(nodeId) || this.createLinearEnvelopeState();
        this.linearEnvelopeStates.set(nodeId, state);
        const read = (key, fallback) => this.readEffectiveParameter(node, key, fallback, frame, frames, frameValues);
        value = this.linearEnvelopeSample(
          state,
          mixInput(nodeId, "Gate"),
          {
            attack: read("attack", 0.08),
            decay: read("decay", 0.22),
            delay: read("delay", 0),
            level: read("level", 1),
            loop: read("loop", 0),
            release: read("release", 0.45),
            sustain: read("sustain", 0.55),
          },
          safeRate,
        );
      } else if (node?.type === "pluckEnvelope") {
        const state = this.pluckEnvelopeStates.get(nodeId) || this.createPluckEnvelopeState();
        this.pluckEnvelopeStates.set(nodeId, state);
        const read = (key, fallback) => this.readEffectiveParameter(node, key, fallback, frame, frames, frameValues);
        value = this.pluckEnvelopeSample(
          state,
          mixInput(nodeId, "Trigger"),
          mixInput(nodeId, "Release"),
          {
            attackFeedback: read("attackFeedback", 0.002),
            autoReleaseTime: read("autoReleaseTime", 0.08),
            decay: read("decay", 0.35),
            decayModCurve: read("decayModCurve", 0),
            decayModEnd: read("decayModEnd", 0.55),
            decayModFrequency: read("decayModFrequency", 1.5),
            decayModStart: read("decayModStart", 0.08),
            delayTime: read("delayTime", 0),
            endingDecay: read("endingDecay", 0.8),
            level: read("level", 1),
            releaseFeedback: read("releaseFeedback", 0.35),
            velocity: read("velocity", 1),
            velocitySensitivity: read("velocitySensitivity", 0),
          },
          safeRate,
        );
      } else if (node?.type === "vactrolEnvelope") {
        const state = this.vactrolEnvelopeStates.get(nodeId) || this.createVactrolEnvelopeState();
        this.vactrolEnvelopeStates.set(nodeId, state);
        const read = (key, fallback) => this.readEffectiveParameter(node, key, fallback, frame, frames, frameValues);
        value = this.vactrolEnvelopeSample(
          state,
          mixInput(nodeId, "Light"),
          {
            attack: read("attack", 0.01),
            curve: read("curve", 1),
            darkCurrent: read("darkCurrent", 0),
            lightOffset: read("lightOffset", 0),
            release: read("release", 0.45),
            sensitivity: read("sensitivity", 1),
          },
          safeRate,
        );
      } else if (node?.type === "flowerChildEnvelopeFollower") {
        const state = this.flowerChildEnvelopeFollowerStates.get(nodeId) ||
          this.createFlowerChildEnvelopeFollowerState();
        this.flowerChildEnvelopeFollowerStates.set(nodeId, state);
        const read = (key, fallback) => this.readEffectiveParameter(node, key, fallback, frame, frames, frameValues);
        value = this.flowerChildEnvelopeFollowerSample(
          state,
          mixInput(nodeId, "In"),
          {
            attack: read("attack", 0.001),
            decay: read("decay", 0.001),
            hold: read("hold", 0.001),
          },
          safeRate,
        );
      } else if (node?.type === "sandboxVisuals") {
        const screenShake = this.smoothVisualControl(
          "screenShake",
          this.visualControlIntensity(mixInput(nodeId, "Shake"), nodeId, "screen visuals shake"),
          safeRate,
        );
        const x = this.smoothVisualControl(
          "x",
          this.visualControlSigned(mixInput(nodeId, "X"), nodeId, "sandbox visuals x"),
          safeRate,
          0.045,
          -1,
          1,
        );
        const y = this.smoothVisualControl(
          "y",
          this.visualControlSigned(mixInput(nodeId, "Y"), nodeId, "sandbox visuals y"),
          safeRate,
          0.045,
          -1,
          1,
        );
        const screenDim = this.smoothVisualControl(
          "screenDim",
          this.visualControlIntensity(mixInput(nodeId, "Dim"), nodeId, "screen visuals dim"),
          safeRate,
        );
        const red = this.smoothVisualControl(
          "red",
          this.visualControlIntensity(mixInput(nodeId, "Red"), nodeId, "sandbox visuals red"),
          safeRate,
        );
        const green = this.smoothVisualControl(
          "green",
          this.visualControlIntensity(mixInput(nodeId, "Green"), nodeId, "sandbox visuals green"),
          safeRate,
        );
        const blue = this.smoothVisualControl(
          "blue",
          this.visualControlIntensity(mixInput(nodeId, "Blue"), nodeId, "sandbox visuals blue"),
          safeRate,
        );
        const scopeTracesOff = this.smoothVisualControl(
          "scopeTracesOff",
          this.visualControlIntensity(mixInput(nodeId, "Scope Off"), nodeId, "screen visuals scope off"),
          safeRate,
          0,
        );
        const scopePaused = this.smoothVisualControl(
          "scopePaused",
          this.visualControlIntensity(mixInput(nodeId, "Pause"), nodeId, "screen visuals pause"),
          safeRate,
          0,
        );
        value = {
          Blue: blue,
          Green: green,
          Pause: scopePaused,
          Red: red,
          ScopeOff: scopeTracesOff,
          ScreenDim: screenDim,
          ScreenShake: screenShake,
          X: x,
          Y: y,
        };
      } else if (node?.type === "bloomGlow") {
        const read = (key, fallback) => this.readEffectiveParameter(node, key, fallback, frame, frames, frameValues);
        const screenDim = this.smoothVisualControl(
          "screenDim",
          read("screenDim", 0),
          safeRate,
        );
        const visualBrightness = this.smoothVisualControl(
          "visualBrightness",
          read("visualBrightness", 0.55),
          safeRate,
        );
        const visualBloom = this.smoothVisualControl(
          "visualBloom",
          read("visualBloom", 0.45),
          safeRate,
        );
        const visualGlow = this.smoothVisualControl(
          "visualGlow",
          read("visualGlow", 0.6),
          safeRate,
        );
        value = {
          Bloom: visualBloom,
          Brightness: visualBrightness,
          Dim: screenDim,
          Glow: visualGlow,
        };
      } else if (node?.type === "rgbaHsla") {
        const rgbRed = this.visualControlIntensity(mixInput(nodeId, "Red"), nodeId, "rgba hsla red");
        const rgbGreen = this.visualControlIntensity(mixInput(nodeId, "Green"), nodeId, "rgba hsla green");
        const rgbBlue = this.visualControlIntensity(mixInput(nodeId, "Blue"), nodeId, "rgba hsla blue");
        const hue = this.visualControlIntensity(mixInput(nodeId, "Hue"), nodeId, "rgba hsla hue");
        const saturation = this.visualControlIntensity(mixInput(nodeId, "Saturation"), nodeId, "rgba hsla saturation");
        const lightness = this.visualControlIntensity(mixInput(nodeId, "Lightness"), nodeId, "rgba hsla lightness");
        const hslMix = this.visualControlIntensity(mixInput(nodeId, "HSL Mix"), nodeId, "rgba hsla hsl mix");
        const hslRgb = this.visualHslToRgb(hue, saturation, lightness);
        const red = this.smoothVisualControl("red", rgbRed * (1 - hslMix) + hslRgb[0] * hslMix, safeRate);
        const green = this.smoothVisualControl("green", rgbGreen * (1 - hslMix) + hslRgb[1] * hslMix, safeRate);
        const blue = this.smoothVisualControl("blue", rgbBlue * (1 - hslMix) + hslRgb[2] * hslMix, safeRate);
        const alpha = this.smoothVisualControl(
          "screenDim",
          this.visualControlIntensity(mixInput(nodeId, "Alpha"), nodeId, "rgba hsla alpha"),
          safeRate,
        );
        value = { Alpha: alpha, Blue: blue, Green: green, Red: red };
      } else if (node?.type === "chromaColor") {
        const read = (key, fallback) => this.readEffectiveParameter(node, key, fallback, frame, frames, frameValues);
        const chromaHue = this.smoothVisualControl(
          "chromaHue",
          read("chromaHue", 0.58),
          safeRate,
        );
        const chromaSaturation = this.smoothVisualControl(
          "chromaSaturation",
          read("chromaSaturation", 0.82),
          safeRate,
        );
        const chromaLightness = this.smoothVisualControl(
          "chromaLightness",
          read("chromaLightness", 0.52),
          safeRate,
        );
        const chromaAlpha = this.smoothVisualControl(
          "chromaAlpha",
          read("chromaAlpha", 0.35),
          safeRate,
        );
        const chromaDrift = this.smoothVisualControl(
          "chromaDrift",
          read("chromaDrift", 0.25),
          safeRate,
        );
        const chromaSpread = this.smoothVisualControl(
          "chromaSpread",
          read("chromaSpread", 0.4),
          safeRate,
        );
        const visualBrightness = this.smoothVisualControl(
          "visualBrightness",
          read("visualBrightness", 0.55),
          safeRate,
        );
        const visualBloom = this.smoothVisualControl(
          "visualBloom",
          read("visualBloom", 0.45),
          safeRate,
        );
        const visualGlow = this.smoothVisualControl(
          "visualGlow",
          read("visualGlow", 0.6),
          safeRate,
        );
        value = {
          Alpha: chromaAlpha,
          Bloom: visualBloom,
          Chroma: chromaSaturation,
          Drift: chromaDrift,
          Glow: visualGlow,
          Hue: chromaHue,
          Light: chromaLightness,
          Spread: chromaSpread,
          TraceBrightness: visualBrightness,
        };
      } else if (node?.type === "badvalMonitor") {
        value = this.monitorBadValueSample(mixInput(nodeId), nodeId);
      } else if (node?.type === "groupOutput") {
        value = {
          Out: mixInput(nodeId, "In"),
        };
      } else if (node?.type === "clapPlugin") {
        value = {
          Left: 0,
          Right: 0,
        };
      } else if (node?.type === "output") {
        value = mixInput(nodeId, "Mono") + (mixInput(nodeId, "Left") + mixInput(nodeId, "Right")) * 0.5;
      }
      frameValues.set(nodeId, value);
      this.nodeOutputs.set(nodeId, value);
    }

    const outputNode = this.nodes.get(this.outputNode || "output");
    const outputVolume = outputNode
      ? this.readEffectiveParameter(outputNode, "volume", 0.1, frame, frames, frameValues)
      : 1;

    const outputMono = mixInput(this.outputNode || "output", "Mono");
    return {
      left: (outputMono + mixInput(this.outputNode || "output", "Left")) * outputVolume,
      right: (outputMono + mixInput(this.outputNode || "output", "Right")) * outputVolume,
    };
  }

  process(inputs, outputs) {
    const output = outputs[0] || [];
    const frames = output[0]?.length || 128;
    const input = inputs[0] || [];
    const oversamplingRatio = Math.max(1, Math.min(4, Math.round(this.oversamplingRatio) || 1));
    const engineSampleRate = Math.max(1, this.engineSampleRate || sampleRate || 44100);
    const engineFrames = frames * oversamplingRatio;
    if (!this.nodes.size || !this.order.length) {
      for (const channel of output) {
        channel.fill(0);
      }
      return true;
    }

    for (let frame = 0; frame < frames; frame += 1) {
      const inputLeft = Number(input[0]?.[frame]) || 0;
      const inputRight = Number(input[1]?.[frame]) || inputLeft;
      this.inputMeterPeak = Math.max(this.inputMeterPeak, Math.abs(inputLeft), Math.abs(inputRight));
      this.inputMeterSquareSum += (inputLeft * inputLeft + inputRight * inputRight) * 0.5;
      this.inputMeterSamples += 1;
      let leftSum = 0;
      let rightSum = 0;
      let decimatedLeft = 0;
      let decimatedRight = 0;
      const useRaptEllipticDecimator = oversamplingRatio === 4;
      for (let subframe = 0; subframe < oversamplingRatio; subframe += 1) {
        const engineFrame = frame * oversamplingRatio + subframe;
        const subframeOutput = this.evaluateFrame(engineFrame, engineFrames, inputs, engineSampleRate, frame);
        if (useRaptEllipticDecimator) {
          decimatedLeft = this.processRaptEllipticDecimatorSample(
            subframeOutput.left,
            this.raptEllipticDecimatorLeft,
          );
          decimatedRight = this.processRaptEllipticDecimatorSample(
            subframeOutput.right,
            this.raptEllipticDecimatorRight,
          );
        } else {
          leftSum += subframeOutput.left;
          rightSum += subframeOutput.right;
        }
        this.captureModuleScopeFrame();
        this.scopeCounter += 1;
        if (this.scopeCounter >= Math.max(1, Math.floor(engineSampleRate / 30))) {
          this.scopeCounter = 0;
          this.postModuleScopeSnapshot();
        }
        this.visualControlCounter += 1;
        if (this.visualControlCounter >= Math.max(1, Math.floor(engineSampleRate / 30))) {
          this.visualControlCounter = 0;
          this.postVisualControls();
        }
      }
      const frameOutput = {
        left: useRaptEllipticDecimator ? decimatedLeft : leftSum / oversamplingRatio,
        right: useRaptEllipticDecimator ? decimatedRight : rightSum / oversamplingRatio,
      };
      if (this.outputSampleClipped(frameOutput.left)) {
        this.meterClipCount += 1;
      }
      if (this.outputSampleClipped(frameOutput.right)) {
        this.meterClipCount += 1;
      }
      const protectedFrame = this.earProtector.protect(frameOutput.left, frameOutput.right);
      if (protectedFrame.muted) {
        this.meterProtectionMuteCount += 1;
      }
      const left = this.clampValue(protectedFrame.left, -0.95, 0.95);
      const right = this.clampValue(protectedFrame.right, -0.95, 0.95);
      this.meterPeak = Math.max(this.meterPeak, Math.abs(left), Math.abs(right));
      this.meterSquareSum += (left * left + right * right) * 0.5;
      this.meterSamples += 1;
      for (let channelIndex = 0; channelIndex < output.length; channelIndex += 1) {
        output[channelIndex][frame] = channelIndex === 0 ? left : right;
      }
    }
    this.finishSmoothing();
    this.meterCounter += frames;
    if (this.meterCounter >= sampleRate / 10) {
      this.port.postMessage({
        clipCount: this.meterClipCount,
        badNumberCount: this.badNumberCount,
        lastBadValueReason: this.lastBadValueReason,
        lastBadValueNodeId: this.lastBadValueNodeId,
        lastBadValueSource: this.lastBadValueSource,
        inputPeak: this.inputMeterPeak,
        inputRms: Math.sqrt(this.inputMeterSquareSum / Math.max(1, this.inputMeterSamples)),
        peak: this.meterPeak,
        protectionMuteCount: this.meterProtectionMuteCount,
        sessionId: this.sessionId,
        rms: Math.sqrt(this.meterSquareSum / Math.max(1, this.meterSamples)),
        type: "meter",
      });
      this.meterCounter = 0;
      this.inputMeterPeak = 0;
      this.inputMeterSamples = 0;
      this.inputMeterSquareSum = 0;
      this.meterClipCount = 0;
      this.badNumberCount = 0;
      this.lastBadValueReason = "";
      this.lastBadValueNodeId = "";
      this.lastBadValueSource = "";
      this.meterPeak = 0;
      this.meterProtectionMuteCount = 0;
      this.meterSamples = 0;
      this.meterSquareSum = 0;
    }
    return true;
  }
}

registerProcessor("node-live-audio-processor", NodeLiveAudioProcessor);
