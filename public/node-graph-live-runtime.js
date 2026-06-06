function setNodeGraphLiveProcessorError(message = "AudioWorklet processor error") {
  setNodeGraphLiveOutputMuted(true);
  nodeGraphMvp.live.runtime = null;
  setNodeGraphLiveEvidence("processor-error", {
    message,
    patchFingerprint: nodeGraphPatchFingerprint(),
  });
  setNodeGraphLiveStatus("error", "warn");
  setNodeGraphLiveEngineStatus("engine error", "warn");
  setNodeGraphLiveEngineTitle(message);
  setNodeGraphLivePlanStatus("plan blocked", "warn");
  setNodeGraphLiveInputMeter();
  setNodeGraphLiveMeter();
  setNodeGraphLiveScheduleStatus(`processor error: ${message}`, "warn");
  document.getElementById("nodeLiveStatus").title = message;
  renderNodeGraphLiveControls(Boolean(nodeGraphMvp.live.node));
}

function setNodeGraphLiveOutputMuted(muted) {
  const outputGain = nodeGraphMvp.live.outputGain;
  const context = nodeGraphMvp.live.context;
  if (!outputGain?.gain) {
    return;
  }
  const value = muted ? 0 : 1;
  const time = context?.currentTime || 0;
  try {
    outputGain.gain.cancelScheduledValues(time);
    outputGain.gain.setValueAtTime(value, time);
  } catch (_error) {
    outputGain.gain.value = value;
  }
}

async function refreshNodeGraphLiveMicrophonePermissionState() {
  if (!navigator.permissions?.query) {
    nodeGraphMvp.live.inputPermissionStatus = "unsupported";
    updateNodeGraphLiveInputTestStatus();
    return "unsupported";
  }
  try {
    const permission = await navigator.permissions.query({ name: "microphone" });
    const updatePermissionState = () => {
      nodeGraphMvp.live.inputPermissionStatus = permission.state || "unknown";
      if (
        nodeGraphMvp.live.inputActive &&
        !nodeGraphMvp.live.inputStream &&
        permission.state === "denied"
      ) {
        const message = "Microphone permission is blocked in the browser.";
        setNodeGraphLiveInputStatus("blocked", message);
        setNodeGraphLiveMicStatus("blocked", message);
      } else if (
        nodeGraphMvp.live.inputActive &&
        !nodeGraphMvp.live.inputStream &&
        nodeGraphMvp.live.micStatus === "blocked"
      ) {
        const routeState = nodeGraphLiveInputRouteState();
        setNodeGraphLiveInputStatus(routeState.state, routeState.message);
        setNodeGraphLiveMicStatus(
          "armed",
          permission.state === "granted"
            ? "Microphone permission is allowed. Start OUTPUT to connect it."
            : "Start OUTPUT to request browser microphone permission.",
        );
      } else {
        updateNodeGraphLiveInputTestStatus();
      }
    };
    updatePermissionState();
    permission.onchange = updatePermissionState;
    return nodeGraphMvp.live.inputPermissionStatus;
  } catch (_error) {
    nodeGraphMvp.live.inputPermissionStatus = "unsupported";
    updateNodeGraphLiveInputTestStatus();
    return "unsupported";
  }
}

async function refreshNodeGraphLiveInputDevices() {
  const select = document.getElementById("nodeLiveInputDeviceSelect");
  if (!select) {
    return;
  }
  const selectedDeviceId = nodeGraphMvp.live.inputDeviceId || "";
  select.replaceChildren(new Option("default input", ""));
  select.value = "";
  select.disabled = !navigator.mediaDevices?.enumerateDevices;
  if (select.disabled) {
    select.title = nodeGraphTooltipText("audio.inputDeviceUnavailable");
    return;
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputDevices = devices.filter((device) => device.kind === "audioinput");
    inputDevices.forEach((device, index) => {
      const label = device.label || `input ${index + 1}`;
      select.append(new Option(label, device.deviceId));
    });
    const hasSelectedDevice = selectedDeviceId &&
      inputDevices.some((device) => device.deviceId === selectedDeviceId);
    select.value = hasSelectedDevice ? selectedDeviceId : "";
    if (!hasSelectedDevice) {
      nodeGraphMvp.live.inputDeviceId = "";
    }
    select.title = inputDevices.length
      ? nodeGraphTooltipText("audio.inputDevice")
      : nodeGraphTooltipText("audio.inputDeviceMissing");
  } catch (error) {
    select.disabled = true;
    select.title = error.message || nodeGraphTooltipText("audio.inputDeviceUnavailable");
  }
}

async function handleNodeGraphLiveInputDeviceChange(event) {
  nodeGraphMvp.live.inputDeviceId = event.target.value || "";
  if (!nodeGraphMvp.live.inputActive || !nodeGraphMvp.live.context || !nodeGraphMvp.live.node) {
    return;
  }
  stopNodeGraphLiveInputSource();
  try {
    await startNodeGraphLiveInputSource();
  } catch (error) {
    setNodeGraphLiveBlockedError("input", error, { schedule: false });
  }
}

function nodeGraphLiveInputErrorMessage(error) {
  const name = error?.name || "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone permission was blocked. Allow microphone access in the browser, then press Output again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No browser audio input device was found.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The selected audio input is busy or unavailable.";
  }
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return "The selected audio input is unavailable.";
  }
  return error?.message || "Browser audio input unavailable.";
}

function cleanupNodeGraphMockInputStream() {
  try {
    nodeGraphMvp.live.mockInputOscillator?.stop();
  } catch (_error) {
    // Mock input may already be stopped by live shutdown.
  }
  try {
    nodeGraphMvp.live.mockInputOscillator?.disconnect();
    nodeGraphMvp.live.mockInputGain?.disconnect();
    nodeGraphMvp.live.mockInputDestination?.disconnect?.();
  } catch (_error) {
    // Disconnected mock graph nodes are harmless.
  }
  nodeGraphMvp.live.mockInputDestination = null;
  nodeGraphMvp.live.mockInputGain = null;
  nodeGraphMvp.live.mockInputOscillator = null;
}

function setNodeGraphMockInputFactory(options = {}) {
  const frequency = Number.isFinite(Number(options.frequency))
    ? Math.max(20, Math.min(20000, Number(options.frequency)))
    : 220;
  const gain = Number.isFinite(Number(options.gain))
    ? Math.max(0, Math.min(1, Number(options.gain)))
    : 0.25;
  nodeGraphMvp.live.inputStreamFactory = async ({ context }) => {
    if (!context?.createMediaStreamDestination) {
      throw new Error("Mock browser input needs MediaStreamDestination support.");
    }
    cleanupNodeGraphMockInputStream();
    const oscillator = context.createOscillator();
    const inputGain = context.createGain();
    const destination = context.createMediaStreamDestination();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    inputGain.gain.value = gain;
    oscillator.connect(inputGain);
    inputGain.connect(destination);
    oscillator.start();
    nodeGraphMvp.live.mockInputDestination = destination;
    nodeGraphMvp.live.mockInputGain = inputGain;
    nodeGraphMvp.live.mockInputOscillator = oscillator;
    return destination.stream;
  };
}

function stopNodeGraphMockInput() {
  const hadMockInput = Boolean(
    nodeGraphMvp.live.mockInputOscillator ||
    nodeGraphMvp.live.mockInputGain ||
    nodeGraphMvp.live.mockInputDestination
  );
  nodeGraphMvp.live.inputStreamFactory = null;
  if (hadMockInput && nodeGraphMvp.live.inputStream) {
    stopNodeGraphLiveInputSource();
  } else {
    cleanupNodeGraphMockInputStream();
  }
}

async function startNodeGraphMockInput(options = {}) {
  setNodeGraphMockInputFactory(options);
  nodeGraphMvp.live.inputActive = true;
  ensureNodeGraphLiveInputModule();
  if (!nodeGraphMvp.live.node || !nodeGraphMvp.live.context) {
    nodeGraphMvp.live.outputEnabled = true;
    await startNodeGraphLiveAudio();
  } else {
    await syncNodeGraphLiveInputSource();
  }
  return nodeGraphLiveDebug();
}

function nodeGraphLiveInputDeviceIsUnavailable(error) {
  return [
    "ConstraintNotSatisfiedError",
    "DevicesNotFoundError",
    "NotFoundError",
    "OverconstrainedError",
  ].includes(error?.name || "");
}

async function requestNodeGraphLiveInputStream(deviceId = nodeGraphMvp.live.inputDeviceId) {
  if (typeof nodeGraphMvp.live.inputStreamFactory === "function") {
    return nodeGraphMvp.live.inputStreamFactory({
      context: nodeGraphMvp.live.context,
      deviceId,
    });
  }
  return navigator.mediaDevices.getUserMedia({
    audio: {
      autoGainControl: false,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      echoCancellation: false,
      noiseSuppression: false,
    },
  });
}

function nodeGraphLiveOutputStartCancelled(serial) {
  return serial !== nodeGraphMvp.live.outputToggleSerial || !nodeGraphMvp.live.outputEnabled;
}

function nodeGraphLiveInputIsUnderConstruction() {
  return true;
}

function toggleNodeGraphLiveInput() {
  if (nodeGraphLiveInputIsUnderConstruction()) {
    nodeGraphMvp.live.inputActive = false;
    stopNodeGraphLiveInputSource();
    setNodeGraphLiveInputStatus("off", "Live INPUT is under construction.");
    setNodeGraphLiveMicStatus("off", "Live INPUT is under construction.");
    renderNodeGraphLiveControls();
    return;
  }
  nodeGraphMvp.live.inputActive = !nodeGraphMvp.live.inputActive;
  const addedInputModule = nodeGraphMvp.live.inputActive
    ? ensureNodeGraphLiveInputModule()
    : false;
  if (nodeGraphMvp.live.inputActive) {
    const routeState = nodeGraphLiveInputRouteState();
    setNodeGraphLiveInputStatus(routeState.state, routeState.message);
    refreshNodeGraphLiveMicrophonePermissionState();
  } else {
    setNodeGraphLiveInputStatus("off");
    setNodeGraphLiveMicStatus("off");
  }
  if (!addedInputModule) {
    applyNodeGraphPatchToDom();
    drawNodeGraphWires();
    scheduleNodeGraphLivePlanSync();
  }
  renderNodeGraphLiveControls();
  if (nodeGraphMvp.live.context && nodeGraphMvp.live.node) {
    syncNodeGraphLiveInputSource().catch((error) => {
      nodeGraphMvp.live.inputActive = false;
      stopNodeGraphLiveInputSource();
      setNodeGraphLiveInputStatus("blocked", error.message);
      applyNodeGraphPatchToDom();
      drawNodeGraphWires();
      renderNodeGraphLiveControls();
      setNodeGraphLiveBlockedError("input", error, { schedule: false });
    });
  }
}

async function setNodeGraphLiveOutputEnabled(enabled) {
  if (enabled && nodeGraphEarProtectionIsTripped()) {
    nodeGraphMvp.live.outputEnabled = false;
    nodeGraphTripEarProtection({ source: "live" });
    renderNodeGraphLiveControls(false);
    renderNodeGraphExecutionPlanDebug();
    return;
  }
  const outputEnabled = Boolean(enabled);
  const serial = nodeGraphMvp.live.outputToggleSerial + 1;
  nodeGraphMvp.live.outputToggleSerial = serial;
  nodeGraphMvp.live.outputEnabled = outputEnabled;
  renderNodeGraphLiveControls(Boolean(nodeGraphMvp.live.node));
  renderNodeGraphExecutionPlanDebug();

  if (!outputEnabled) {
    if (nodeGraphMvp.live.node || nodeGraphMvp.live.context) {
      await stopNodeGraphLiveAudio();
    }
    renderNodeGraphExecutionPlanDebug();
    return;
  }

  if (nodeGraphMvp.live.node || nodeGraphMvp.live.context) {
    await stopNodeGraphLiveAudio();
  }
  if (serial !== nodeGraphMvp.live.outputToggleSerial || !nodeGraphMvp.live.outputEnabled) {
    return;
  }
  renderNodeGraphLiveControls();
  renderNodeGraphExecutionPlanDebug();
  await startNodeGraphLiveAudio(serial);
  if (serial === nodeGraphMvp.live.outputToggleSerial) {
    renderNodeGraphExecutionPlanDebug();
  }
}

function toggleNodeGraphLiveOutput() {
  if (nodeGraphEarProtectionIsTripped()) {
    nodeGraphTripEarProtection({ source: "live" });
    return;
  }
  setNodeGraphLiveOutputEnabled(!nodeGraphMvp.live.outputEnabled);
}

function renderNodeGraphLiveScriptBlock(event) {
  const output = event.outputBuffer;
  const frames = output.length;
  const runtime = nodeGraphMvp.live.runtime;
  if (!runtime) {
    for (let channel = 0; channel < output.numberOfChannels; channel += 1) {
      output.getChannelData(channel).fill(0);
    }
    return;
  }
  const sampleRate = event.playbackTime !== undefined
    ? output.sampleRate
    : nodeGraphMvp.live.context?.sampleRate || nodeGraphMvp.sampleRate;
  runtime.externalInput = {
    left: event.inputBuffer?.numberOfChannels > 0
      ? event.inputBuffer.getChannelData(0)
      : null,
    right: event.inputBuffer?.numberOfChannels > 1
      ? event.inputBuffer.getChannelData(1)
      : null,
  };
  const blockStartFrame = Number.isFinite(runtime.absoluteFrameCursor)
    ? runtime.absoluteFrameCursor
    : 0;
  for (let frame = 0; frame < frames; frame += 1) {
    runtime.absoluteFrame = blockStartFrame + frame;
    const inputLeft = Number(runtime.externalInput.left?.[frame]) || 0;
    const inputRight = Number(runtime.externalInput.right?.[frame]) || inputLeft;
    nodeGraphMvp.live.inputMeterPeak = Math.max(
      nodeGraphMvp.live.inputMeterPeak,
      Math.abs(inputLeft),
      Math.abs(inputRight),
    );
    nodeGraphMvp.live.inputMeterSquareSum += (inputLeft * inputLeft + inputRight * inputRight) * 0.5;
    nodeGraphMvp.live.inputMeterSamples += 1;
    const frameOutput = evaluateNodeGraphPlanFrame(runtime, sampleRate, frame, frames);
    captureNodeGraphLiveModuleScopeFrame(runtime, sampleRate);
    if (nodeGraphOutputSampleClipped(frameOutput.left)) {
      runtime.meterClipCount += 1;
    }
    if (nodeGraphOutputSampleClipped(frameOutput.right)) {
      runtime.meterClipCount += 1;
    }
    const protectedFrame = runtime.earProtector?.protect(frameOutput.left, frameOutput.right) || {
      left: frameOutput.left,
      muted: false,
      right: frameOutput.right,
    };
    if (protectedFrame.muted) {
      runtime.meterProtectionMuteCount = (runtime.meterProtectionMuteCount || 0) + 1;
      nodeGraphTripEarProtection({
        source: "live",
        protectionMuteCount: runtime.meterProtectionMuteCount,
      });
    }
    const left = nodeGraphClampOutputSample(protectedFrame.left);
    const right = nodeGraphClampOutputSample(protectedFrame.right);
    const value = Math.max(Math.abs(left), Math.abs(right));
    runtime.meterPeak = Math.max(runtime.meterPeak, Math.abs(value));
    runtime.meterSquareSum += (left * left + right * right) * 0.5;
    runtime.meterSamples += 1;
    for (let channel = 0; channel < output.numberOfChannels; channel += 1) {
      output.getChannelData(channel)[frame] = channel === 0 ? left : right;
    }
  }
  runtime.absoluteFrameCursor = blockStartFrame + frames;
  runtime.externalInput = null;
  nodeGraphSetVisualControls(runtime.visualControls || { screenShake: 0 });
  if (nodeGraphMvp.live.lastEvidence) {
    nodeGraphMvp.live.lastEvidence.visualControls = {
      ...(nodeGraphMvp.live.lastEvidence.visualControls || {}),
      blue: Number(runtime.visualControls?.blue) || 0,
      chromaAlpha: Number(runtime.visualControls?.chromaAlpha) || 0,
      chromaDrift: Number(runtime.visualControls?.chromaDrift) || 0,
      chromaHue: Number(runtime.visualControls?.chromaHue) || 0,
      chromaLightness: Number(runtime.visualControls?.chromaLightness) || 0,
      chromaSaturation: Number(runtime.visualControls?.chromaSaturation) || 0,
      chromaSpread: Number(runtime.visualControls?.chromaSpread) || 0,
      green: Number(runtime.visualControls?.green) || 0,
      red: Number(runtime.visualControls?.red) || 0,
      scopePaused: Number(runtime.visualControls?.scopePaused) || 0,
      scopeTracesOff: Number(runtime.visualControls?.scopeTracesOff) || 0,
      screenDim: Number(runtime.visualControls?.screenDim) || 0,
      screenShake: Number(runtime.visualControls?.screenShake) || 0,
      visualBloom: Number(runtime.visualControls?.visualBloom) || 0,
      visualBrightness: Number(runtime.visualControls?.visualBrightness) || 0,
      visualGlow: Number(runtime.visualControls?.visualGlow) || 0,
      x: Number(runtime.visualControls?.x) || 0,
      y: Number(runtime.visualControls?.y) || 0,
    };
  }
  finishNodeGraphParameterSmoothing(runtime.smoothers);
  runtime.meterCounter += frames;
  if (runtime.meterCounter >= sampleRate / 10) {
    setNodeGraphLiveInputMeter(
      nodeGraphMvp.live.inputMeterPeak,
      Math.sqrt(nodeGraphMvp.live.inputMeterSquareSum / Math.max(1, nodeGraphMvp.live.inputMeterSamples)),
    );
    setNodeGraphLiveMeter(
      runtime.meterPeak,
      Math.sqrt(runtime.meterSquareSum / Math.max(1, runtime.meterSamples)),
      runtime.meterClipCount,
      runtime.meterProtectionMuteCount || 0,
      runtime.badNumberCount || 0,
    );
    runtime.meterCounter = 0;
    nodeGraphMvp.live.inputMeterPeak = 0;
    nodeGraphMvp.live.inputMeterSamples = 0;
    nodeGraphMvp.live.inputMeterSquareSum = 0;
    runtime.meterClipCount = 0;
    runtime.meterProtectionMuteCount = 0;
    runtime.badNumberCount = 0;
    runtime.meterPeak = 0;
    runtime.meterSamples = 0;
    runtime.meterSquareSum = 0;
  }
}

function nodeGraphStopGpuAdditiveProducer() {
  const state = nodeGraphMvp.live.gpuAdditive;
  if (!state) {
    return;
  }
  if (state.timer) {
    clearInterval(state.timer);
  }
  state.nodes = new Map();
  state.timer = 0;
}

function nodeGraphGpuAdditiveNodeParam(node, key, fallback) {
  const value = Number(node?.params?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function nodeGraphGpuAdditiveNodeVersion(node, sampleRate) {
  const keys = [
    "frequency",
    "harmonics",
    "level",
    "waveform",
    "modA",
    "harmonicPhaseAdd",
    "harmonicPhaseAlgorithm",
    "harmonicPhaseCurve",
    "harmonicPhaseMultiply",
    "dampingAlgorithm",
    "dampingCurve",
    "dampingFilterFrequency",
  ];
  return [
    node?.id || "",
    Math.round(Number(sampleRate) || 0),
    ...keys.map((key) => `${key}:${nodeGraphGpuAdditiveNodeParam(node, key, "")}`),
  ].join("|");
}

function nodeGraphGpuAdditiveChunkSafe(plan, node) {
  const nodeId = String(node?.id || "");
  if (!nodeId) {
    return false;
  }
  const hasSignalInput = (plan.connections || []).some((connection) =>
    connection.destinationNode === nodeId ||
    connection.toNode === nodeId ||
    connection.targetNode === nodeId
  );
  const hasModulationInput = (plan.modulations || []).some((modulation) =>
    modulation.destinationNode === nodeId ||
    modulation.toNode === nodeId ||
    modulation.targetNode === nodeId
  );
  return !hasSignalInput && !hasModulationInput;
}

function nodeGraphGpuAdditiveParams(node) {
  return {
    dampingAlgorithm: nodeGraphGpuAdditiveNodeParam(node, "dampingAlgorithm", 0),
    dampingCurve: nodeGraphGpuAdditiveNodeParam(node, "dampingCurve", 0),
    dampingFilterFrequency: nodeGraphGpuAdditiveNodeParam(node, "dampingFilterFrequency", 20000),
    frequency: Math.max(0, nodeGraphGpuAdditiveNodeParam(node, "frequency", 220)),
    harmonicPhaseAdd: nodeGraphGpuAdditiveNodeParam(node, "harmonicPhaseAdd", 0),
    harmonicPhaseAlgorithm: nodeGraphGpuAdditiveNodeParam(node, "harmonicPhaseAlgorithm", 0),
    harmonicPhaseCurve: nodeGraphGpuAdditiveNodeParam(node, "harmonicPhaseCurve", 1),
    harmonicPhaseMultiply: nodeGraphGpuAdditiveNodeParam(node, "harmonicPhaseMultiply", 0),
    harmonics: nodeGraphGpuAdditiveNodeParam(node, "harmonics", 256),
    level: nodeGraphGpuAdditiveNodeParam(node, "level", 0.35),
    modA: nodeGraphGpuAdditiveNodeParam(node, "modA", 0.5),
    phase: nodeGraphPhaseRadians(nodeGraphGpuAdditiveNodeParam(node, "phase", 0)),
    waveform: nodeGraphGpuAdditiveNodeParam(node, "waveform", 1),
  };
}

function nodeGraphStartGpuAdditiveProducer(plan, audio) {
  nodeGraphStopGpuAdditiveProducer();
  if (!nodeGraphMvp.live.usesWorklet || !nodeGraphMvp.live.node?.port) {
    return;
  }
  const sampleRate = Math.max(1, Number(audio?.clampedEngineSampleRate) || nodeGraphMvp.sampleRate || 44100);
  const nodes = (plan.nodes || [])
    .filter((node) => node?.type === "gpuAdditiveOsc" && nodeGraphGpuAdditiveChunkSafe(plan, node));
  if (!nodes.length || typeof nodeGraphGpuAdditiveCpuRender !== "function") {
    return;
  }
  const producer = nodeGraphMvp.live.gpuAdditive;
  const chunkFrames = 1024;
  const targetChunks = 8;
  producer.nodes = new Map(nodes.map((node) => [node.id, {
    phase: nodeGraphPhaseRadians(nodeGraphGpuAdditiveNodeParam(node, "phase", 0)),
    queueChunks: 0,
    rendering: false,
    version: nodeGraphGpuAdditiveNodeVersion(node, sampleRate),
  }]));

  const produce = () => {
    if (!nodeGraphMvp.live.node?.port || nodeGraphMvp.live.sessionId <= 0) {
      nodeGraphStopGpuAdditiveProducer();
      return;
    }
    for (const node of nodes) {
      const state = producer.nodes.get(node.id);
      if (!state || state.rendering || state.queueChunks >= targetChunks) {
        continue;
      }
      const version = nodeGraphGpuAdditiveNodeVersion(node, sampleRate);
      if (state.version !== version) {
        state.version = version;
        state.phase = nodeGraphPhaseRadians(nodeGraphGpuAdditiveNodeParam(node, "phase", 0));
        state.queueChunks = 0;
      }
      state.rendering = true;
      try {
        const params = {
          ...nodeGraphGpuAdditiveParams(node),
          phase: state.phase,
        };
        const samples = nodeGraphGpuAdditiveCpuRender(params, chunkFrames, sampleRate);
        state.phase = wrapNodeSliderValue(
          state.phase + Math.PI * 2 * params.frequency * (chunkFrames / sampleRate),
          0,
          Math.PI * 2,
        );
        state.queueChunks += 1;
        nodeGraphMvp.live.node.port.postMessage({
          nodeId: node.id,
          planSerial: nodeGraphMvp.live.planSerial,
          samples,
          sessionId: nodeGraphMvp.live.sessionId,
          type: "gpuAdditiveChunk",
          version,
        }, [samples.buffer]);
      } finally {
        state.rendering = false;
      }
    }
  };

  produce();
  producer.timer = setInterval(produce, 25);
}

function handleNodeGraphLiveWorkletMessage(event) {
  const message = event.data || {};
  if (message.type === "meter") {
    if (message.sessionId !== nodeGraphMvp.live.sessionId || !nodeGraphMvp.live.node) {
      return;
    }
    setNodeGraphLiveInputMeter(
      Number(message.inputPeak) || 0,
      Number(message.inputRms) || 0,
    );
    setNodeGraphLiveMeter(
      Number(message.peak) || 0,
      Number(message.rms) || 0,
      Number(message.clipCount) || 0,
      Number(message.protectionMuteCount) || 0,
      Number(message.badNumberCount) || 0,
    );
    if (Number(message.badNumberCount) > 0) {
      nodeGraphRecordBadValueEvent({
        count: Number(message.badNumberCount) || 1,
        engine: "worklet",
        force: Boolean(message.lastBadValueNodeId),
        nodeId: message.lastBadValueNodeId || "",
        reason: message.lastBadValueReason || "bad",
        source: message.lastBadValueSource || "worklet meter",
      });
    }
    if (Number(message.protectionMuteCount) > 0) {
      nodeGraphTripEarProtection({
        source: "worklet",
        protectionMuteCount: Number(message.protectionMuteCount) || 0,
      });
    }
  } else if (message.type === "planApplied") {
    if (
      message.sessionId !== nodeGraphMvp.live.sessionId ||
      message.planSerial !== nodeGraphMvp.live.planSerial ||
      !nodeGraphMvp.live.node
    ) {
      return;
    }
    setNodeGraphLiveEvidence("plan-applied", message);
    setNodeGraphLivePlanStatus(nodeGraphLivePlanAppliedStatusText(message), "good");
    setNodeGraphLivePlanTitle(nodeGraphLivePlanScheduleTitle(message.order));
  } else if (message.type === "scope") {
    if (message.sessionId !== nodeGraphMvp.live.sessionId || !nodeGraphMvp.live.node) {
      return;
    }
    pushNodeGraphLiveModuleScopeSnapshot(message.values || [], {
      patchFingerprint: message.patchFingerprint || nodeGraphPatchFingerprint(),
      sampleRate: message.sampleRate || nodeGraphMvp.live.context?.sampleRate || nodeGraphMvp.sampleRate,
    });
  } else if (message.type === "visualControls") {
    if (message.sessionId !== nodeGraphMvp.live.sessionId || !nodeGraphMvp.live.node) {
      return;
    }
    nodeGraphSetVisualControls({
      blue: Number(message.blue) || 0,
      chromaAlpha: Number(message.chromaAlpha) || 0,
      chromaDrift: Number(message.chromaDrift) || 0,
      chromaHue: Number(message.chromaHue) || 0,
      chromaLightness: Number(message.chromaLightness) || 0,
      chromaSaturation: Number(message.chromaSaturation) || 0,
      chromaSpread: Number(message.chromaSpread) || 0,
      green: Number(message.green) || 0,
      red: Number(message.red) || 0,
      scopePaused: Number(message.scopePaused) || 0,
      scopeTracesOff: Number(message.scopeTracesOff) || 0,
      screenDim: Number(message.screenDim) || 0,
      screenShake: Number(message.screenShake) || 0,
      visualBloom: Number(message.visualBloom) || 0,
      visualBrightness: Number(message.visualBrightness) || 0,
      visualGlow: Number(message.visualGlow) || 0,
      x: Number(message.x) || 0,
      y: Number(message.y) || 0,
    });
    if (nodeGraphMvp.live.lastEvidence) {
      nodeGraphMvp.live.lastEvidence.visualControls = {
        ...(nodeGraphMvp.live.lastEvidence.visualControls || {}),
        blue: Number(message.blue) || 0,
        chromaAlpha: Number(message.chromaAlpha) || 0,
        chromaDrift: Number(message.chromaDrift) || 0,
        chromaHue: Number(message.chromaHue) || 0,
        chromaLightness: Number(message.chromaLightness) || 0,
        chromaSaturation: Number(message.chromaSaturation) || 0,
        chromaSpread: Number(message.chromaSpread) || 0,
        green: Number(message.green) || 0,
        red: Number(message.red) || 0,
        scopePaused: Number(message.scopePaused) || 0,
        scopeTracesOff: Number(message.scopeTracesOff) || 0,
        screenDim: Number(message.screenDim) || 0,
        screenShake: Number(message.screenShake) || 0,
        visualBloom: Number(message.visualBloom) || 0,
        visualBrightness: Number(message.visualBrightness) || 0,
        visualGlow: Number(message.visualGlow) || 0,
        x: Number(message.x) || 0,
        y: Number(message.y) || 0,
      };
    }
  } else if (message.type === "gpuAdditiveStatus") {
    if (message.sessionId !== nodeGraphMvp.live.sessionId || !nodeGraphMvp.live.node) {
      return;
    }
    const producer = nodeGraphMvp.live.gpuAdditive;
    for (const queue of message.queues || []) {
      const state = producer?.nodes?.get?.(queue.nodeId);
      if (state) {
        state.queueChunks = Math.max(0, Number(queue.chunks) || 0);
      }
    }
    if (nodeGraphMvp.live.lastEvidence) {
      nodeGraphMvp.live.lastEvidence.gpuAdditive = {
        queues: message.queues || [],
        underruns: Number(message.underruns) || 0,
      };
    }
  } else if (message.type === "paramsApplied") {
    if (
      message.sessionId !== nodeGraphMvp.live.sessionId ||
      message.planSerial !== nodeGraphMvp.live.planSerial ||
      !nodeGraphMvp.live.node
    ) {
      return;
    }
    setNodeGraphLiveEvidence("params-applied", message);
    setNodeGraphLivePlanStatus(nodeGraphLiveParametersAppliedStatusText(message), "good");
    setNodeGraphLivePlanTitle(nodeGraphLivePlanScheduleTitle(message.order));
  }
}

function nodeGraphLiveClapNodes(plan = {}) {
  return (plan.nodes || []).filter((node) => node?.type === "clapPlugin");
}

function nodeGraphLiveClapNodeTitle(node) {
  return nodeGraphPatchNodeTitle(nodeGraphPatchNode(node?.id) || node);
}

function assertNodeGraphLivePlanSupportsClap(plan = {}) {
  const clapNodes = nodeGraphLiveClapNodes(plan);
  if (!clapNodes.length) {
    return;
  }
  const names = clapNodes.map((node) => nodeGraphLiveClapNodeTitle(node)).join(", ");
  const error = new Error(`Live Audio does not route CLAP Plugin nodes yet. Use Render Sample for CLAP processing: ${names}`);
  error.issues = clapNodes.map((node) => `Live Audio CLAP routing unavailable: ${nodeGraphLiveClapNodeTitle(node)}`);
  throw error;
}

function sendNodeGraphLivePlan() {
  if (!nodeGraphMvp.live.node && !nodeGraphMvp.live.context) {
    return;
  }

  try {
    const plan = nodeGraphBuildLivePlan();
    assertNodeGraphLivePlanSupportsClap(plan);
    const audio = nodeGraphAudioDerivation(nodeGraphMvp.patch);
    nodeGraphMvp.live.activeNodeIds = new Set(plan.order);
    beginNodeGraphLiveModuleScopeCapture(plan, {
      sampleRate: nodeGraphMvp.live.usesWorklet
        ? audio.clampedEngineSampleRate
        : nodeGraphMvp.live.context?.sampleRate || nodeGraphMvp.sampleRate,
    });
    nodeGraphMvp.live.planSerial += 1;
    nodeGraphMvp.live.planEvidence = nodeGraphLivePlanEvidenceDetails(plan, {
      engineSampleRate: audio.clampedEngineSampleRate,
      oversamplingRatio: audio.oversamplingRatio,
      planSerial: nodeGraphMvp.live.planSerial,
      sampleRate: nodeGraphMvp.live.context?.sampleRate || nodeGraphMvp.sampleRate,
    });
    if (nodeGraphMvp.live.usesWorklet) {
      setNodeGraphLiveEvidence("plan-sent", nodeGraphMvp.live.planEvidence);
      setNodeGraphLivePlanStatus(nodeGraphLivePlanSentStatusText(), "warn");
      setNodeGraphLivePlanTitle(nodeGraphLivePlanScheduleTitle(plan.order));
      nodeGraphMvp.live.node?.port?.postMessage({
        engineSampleRate: audio.clampedEngineSampleRate,
        oversamplingRatio: audio.oversamplingRatio,
        plan,
        patchFingerprint: plan.patchFingerprint,
        planSerial: nodeGraphMvp.live.planSerial,
        sampleRate: nodeGraphMvp.live.context?.sampleRate || nodeGraphMvp.sampleRate,
        sessionId: nodeGraphMvp.live.sessionId,
        type: "setPlan",
      });
      nodeGraphStartGpuAdditiveProducer(plan, audio);
    } else if (nodeGraphMvp.live.runtime) {
      updateNodeGraphLiveRuntimePlan(nodeGraphMvp.live.runtime, plan);
      setNodeGraphLiveEvidence("plan-applied", nodeGraphMvp.live.planEvidence);
      setNodeGraphLivePlanStatus(nodeGraphLivePlanStatusText(plan), "good");
      setNodeGraphLivePlanTitle(nodeGraphLivePlanScheduleTitle(plan.order));
    } else {
      nodeGraphMvp.live.runtime = createNodeGraphLiveRuntime(plan);
      setNodeGraphLiveEvidence("plan-applied", nodeGraphMvp.live.planEvidence);
      setNodeGraphLivePlanStatus(nodeGraphLivePlanStatusText(plan), "good");
      setNodeGraphLivePlanTitle(nodeGraphLivePlanScheduleTitle(plan.order));
    }
    setNodeGraphLiveOutputMuted(false);
    setNodeGraphLiveStatus("running", "good");
    clearNodeGraphLiveStatusTitle();
    setNodeGraphLiveScheduleStatus(
      nodeGraphScheduleText(
        plan.order,
        [],
        plan.feedbackConnections,
        plan.feedbackModulations,
      ),
      "good",
    );
    renderNodeGraphLiveControls(true);
  } catch (error) {
    setNodeGraphLiveOutputMuted(true);
    nodeGraphMvp.live.runtime = null;
    nodeGraphMvp.live.node?.port?.postMessage({ type: "stop" });
    setNodeGraphLiveBlockedError("plan", error);
  }
}

function sendNodeGraphLiveParameterUpdate() {
  if (!nodeGraphMvp.live.node && !nodeGraphMvp.live.context) {
    return;
  }

  try {
    const nodes = nodeGraphBuildLiveParameterNodes(nodeGraphMvp.live.activeNodeIds);
    const patchFingerprint = nodeGraphPatchFingerprint();
    updateNodeGraphLiveModuleScopeFingerprint(patchFingerprint);
    nodeGraphMvp.live.planSerial += 1;
    if (nodeGraphMvp.live.usesWorklet) {
      setNodeGraphLiveEvidence("params-sent", {
        nodeCount: nodes.length,
        parameterCount: nodeGraphLiveParameterCount(nodes),
        patchFingerprint,
        planSerial: nodeGraphMvp.live.planSerial,
      });
      setNodeGraphLivePlanStatus(nodeGraphLiveParametersSentStatusText(nodes), "warn");
      nodeGraphMvp.live.node?.port?.postMessage({
        nodes,
        patchFingerprint,
        planSerial: nodeGraphMvp.live.planSerial,
        sessionId: nodeGraphMvp.live.sessionId,
        type: "setParams",
      });
      sendNodeGraphLivePlan();
      return;
    } else if (nodeGraphMvp.live.runtime) {
      updateNodeGraphLiveRuntimeParameters(nodeGraphMvp.live.runtime, nodes);
      setNodeGraphLiveEvidence("params-applied", {
        nodeCount: nodes.length,
        parameterCount: nodeGraphLiveParameterCount(nodes),
        patchFingerprint,
        planSerial: nodeGraphMvp.live.planSerial,
      });
      setNodeGraphLivePlanStatus(
        nodeGraphLiveParametersAppliedStatusText({
          nodeCount: nodes.length,
          parameterCount: nodeGraphLiveParameterCount(nodes),
          patchFingerprint,
          planSerial: nodeGraphMvp.live.planSerial,
        }),
        "good",
      );
    }
    setNodeGraphLiveStatus("running", "good");
    clearNodeGraphLiveStatusTitle();
  } catch (error) {
    setNodeGraphLiveBlockedError("params", error, { schedule: false });
  }
}

function sendNodeGraphLiveMidiKeyboardSignal(signal = nodeGraphMvp.midiKeyboardSignal) {
  const payload = signal && typeof signal === "object" ? { ...signal } : null;
  if (nodeGraphMvp.live.runtime) {
    nodeGraphMvp.live.runtime.midiKeyboardSignal = payload;
  }
  if (nodeGraphMvp.live.usesWorklet && nodeGraphMvp.live.node?.port) {
    nodeGraphMvp.live.node.port.postMessage({
      signal: payload,
      type: "setMidiKeyboardSignal",
    });
  }
}

function sendNodeGraphLiveMacroControls(values = nodeGraphMvp.macroControls) {
  const payload = Array.from({ length: 10 }, (_, index) => (
    Math.max(0, Math.min(1, Number(values?.[index]) || 0))
  ));
  if (nodeGraphMvp.live.runtime) {
    nodeGraphMvp.live.runtime.macroControls = payload;
  }
  if (nodeGraphMvp.live.usesWorklet && nodeGraphMvp.live.node?.port) {
    nodeGraphMvp.live.node.port.postMessage({
      values: payload,
      type: "setMacroControls",
    });
  }
}

function nodeGraphPitchModWheelPayload() {
  return {
    mod: Math.max(0, Math.min(1, Number(nodeGraphMvp.modWheelSignal) || 0)),
    pitch: Math.max(-1, Math.min(1, Number(nodeGraphMvp.pitchWheelSignal) || 0)),
  };
}

function sendNodeGraphLivePitchModWheelSignal(signal = nodeGraphPitchModWheelPayload()) {
  const source = signal && typeof signal === "object" ? signal : {};
  const pitch = Number(source.pitch);
  const payload = {
    mod: Math.max(0, Math.min(1, Number(source.mod) || 0)),
    pitch: Math.max(-1, Math.min(1, Number.isFinite(pitch) ? pitch : 0)),
  };
  if (nodeGraphMvp.live.runtime) {
    nodeGraphMvp.live.runtime.pitchModWheelSignal = payload;
  }
  if (nodeGraphMvp.live.usesWorklet && nodeGraphMvp.live.node?.port) {
    nodeGraphMvp.live.node.port.postMessage({
      signal: payload,
      type: "setPitchModWheelSignal",
    });
  }
}

function scheduleNodeGraphLiveSync(mode = "plan") {
  if (!nodeGraphMvp.live.node || nodeGraphMvp.live.syncFrame || nodeGraphMvp.live.syncTimer) {
    if (mode === "plan") {
      nodeGraphMvp.live.syncMode = "plan";
    }
    return;
  }
  nodeGraphMvp.live.syncMode = mode;
  const flush = () => flushNodeGraphLivePlanSync();
  nodeGraphMvp.live.syncFrame = window.requestAnimationFrame(flush);
  nodeGraphMvp.live.syncTimer = window.setTimeout(flush, 50);
}

function scheduleNodeGraphLivePlanSync() {
  scheduleNodeGraphLiveSync("plan");
}

function scheduleNodeGraphLiveParameterSync() {
  scheduleNodeGraphLiveSync("params");
}

function clearNodeGraphLivePlanSync() {
  if (nodeGraphMvp.live.syncFrame) {
    window.cancelAnimationFrame(nodeGraphMvp.live.syncFrame);
    nodeGraphMvp.live.syncFrame = 0;
  }
  if (nodeGraphMvp.live.syncTimer) {
    window.clearTimeout(nodeGraphMvp.live.syncTimer);
    nodeGraphMvp.live.syncTimer = 0;
  }
}

function flushNodeGraphLivePlanSync() {
  const mode = nodeGraphMvp.live.syncMode || "plan";
  nodeGraphMvp.live.syncMode = "";
  clearNodeGraphLivePlanSync();
  if (mode === "params") {
    sendNodeGraphLiveParameterUpdate();
  } else {
    sendNodeGraphLivePlan();
  }
}

async function stopNodeGraphLiveAudio() {
  clearNodeGraphLivePlanSync();
  stopNodeGraphLiveInputSource();
  const liveNode = nodeGraphMvp.live.node;
  const liveContext = nodeGraphMvp.live.context;
  const scriptNode = nodeGraphMvp.live.scriptNode;
  nodeGraphMvp.live.node = null;
  nodeGraphMvp.live.context = null;
  nodeGraphMvp.live.meterGain = null;
  nodeGraphMvp.live.outputGain = null;
  nodeGraphMvp.live.activeNodeIds = new Set();
  nodeGraphMvp.live.lastEvidence = null;
  nodeGraphMvp.live.planEvidence = null;
  nodeGraphMvp.live.planSerial = 0;
  nodeGraphMvp.live.runtime = null;
  nodeGraphMvp.live.scriptNode = null;
  nodeGraphMvp.live.sessionId += 1;
  nodeGraphMvp.live.syncMode = "";
  nodeGraphMvp.live.usesWorklet = false;
  if (typeof clearNodeGraphModuleScopeBuffers === "function") {
    clearNodeGraphModuleScopeBuffers();
  }
  nodeGraphClearVisualControls();

  try {
    liveNode?.port?.postMessage({ type: "stop" });
    liveNode?.disconnect();
    scriptNode?.disconnect();
  } catch (_error) {
    // Live shutdown is best effort; a disconnected worklet is already silent.
  }
  if (liveContext && liveContext.state !== "closed") {
    await liveContext.close();
  }
  setNodeGraphLiveStatus("stopped");
  setNodeGraphLiveEvidence("stopped");
  setNodeGraphLiveEngineStatus();
  setNodeGraphLiveEngineTitle();
  setNodeGraphLivePlanStatus();
  setNodeGraphLivePlanTitle();
  setNodeGraphLiveInputMeter();
  setNodeGraphLiveMeter();
  setNodeGraphLiveScheduleStatus("schedule stopped");
  clearNodeGraphLiveStatusTitle();
  renderNodeGraphLiveControls(false);
}

async function createNodeGraphLiveWorkletNode(context) {
  if (!context.audioWorklet || typeof AudioWorkletNode === "undefined") {
    throw new Error("AudioWorklet unavailable");
  }
  await context.audioWorklet.addModule("./public/node-live-audio-worklet.js?v=editable-graph-smooth-shape-1");
  const workletNode = new AudioWorkletNode(
    context,
    "node-live-audio-processor",
    {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    },
  );
  workletNode.port.onmessage = handleNodeGraphLiveWorkletMessage;
  workletNode.onprocessorerror = () => {
    setNodeGraphLiveProcessorError("AudioWorklet processor crashed");
  };
  return workletNode;
}

function createNodeGraphLiveScriptProcessorNode(context, plan) {
  const scriptNode = context.createScriptProcessor(nodeGraphAudioBlockSize, 2, 2);
  scriptNode.onaudioprocess = renderNodeGraphLiveScriptBlock;
  nodeGraphMvp.live.runtime = createNodeGraphLiveRuntime(plan);
  nodeGraphMvp.live.runtime.earProtector = createNodeGraphEarProtector(context.sampleRate);
  nodeGraphMvp.live.scriptNode = scriptNode;
  return scriptNode;
}

function stopNodeGraphLiveInputSource() {
  const source = nodeGraphMvp.live.inputSource;
  const stream = nodeGraphMvp.live.inputStream;
  nodeGraphMvp.live.inputSource = null;
  nodeGraphMvp.live.inputStream = null;
  cleanupNodeGraphMockInputStream();
  try {
    source?.disconnect();
  } catch (_error) {
    // Already disconnected input sources are harmless.
  }
  for (const track of stream?.getTracks?.() || []) {
    track.stop();
  }
  setNodeGraphLiveInputStatus(
    nodeGraphMvp.live.inputActive ? nodeGraphLiveInputRouteState().state : "off",
    nodeGraphMvp.live.inputActive
      ? nodeGraphLiveInputRouteState().message
      : ""
  );
  setNodeGraphLiveMicStatus(
    nodeGraphMvp.live.inputActive ? "armed" : "off",
    nodeGraphMvp.live.inputActive
      ? "Start OUTPUT to request browser microphone permission."
      : ""
  );
}

async function startNodeGraphLiveInputSource() {
  const context = nodeGraphMvp.live.context;
  const liveNode = nodeGraphMvp.live.node;
  if (!context || !liveNode || nodeGraphMvp.live.inputStream) {
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    const message = window.isSecureContext
      ? "Browser audio input unavailable."
      : "Browser audio input needs HTTPS or localhost.";
    setNodeGraphLiveInputStatus("blocked", message);
    setNodeGraphLiveMicStatus("blocked", message);
    const error = new Error(message);
    error.nodeGraphInputError = true;
    throw error;
  }
  setNodeGraphLiveInputStatus("requesting", "Requesting browser microphone permission.");
  setNodeGraphLiveMicStatus("requesting", "Requesting browser microphone permission.");
  try {
    let stream = null;
    try {
      stream = await requestNodeGraphLiveInputStream();
    } catch (error) {
      if (!nodeGraphMvp.live.inputDeviceId || !nodeGraphLiveInputDeviceIsUnavailable(error)) {
        throw error;
      }
      nodeGraphMvp.live.inputDeviceId = "";
      setNodeGraphLiveInputStatus("requesting", "Selected input unavailable; retrying default input.");
      setNodeGraphLiveMicStatus("requesting", "Selected input unavailable; retrying default input.");
      await refreshNodeGraphLiveInputDevices();
      stream = await requestNodeGraphLiveInputStream("");
    }
    const source = context.createMediaStreamSource(stream);
    source.connect(liveNode);
    nodeGraphMvp.live.inputStream = stream;
    nodeGraphMvp.live.inputSource = source;
    nodeGraphMvp.live.inputPermissionStatus = "granted";
    setNodeGraphLiveInputStatus("connected", "Live INPUT is connected to the browser audio engine.");
    setNodeGraphLiveMicStatus("connected", "Browser microphone stream is connected.");
    refreshNodeGraphLiveInputDevices();
  } catch (error) {
    const message = nodeGraphLiveInputErrorMessage(error);
    if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
      nodeGraphMvp.live.inputPermissionStatus = "denied";
    }
    setNodeGraphLiveInputStatus("blocked", message);
    setNodeGraphLiveMicStatus("blocked", message);
    error.nodeGraphInputError = true;
    throw error;
  }
}

async function syncNodeGraphLiveInputSource() {
  if (nodeGraphMvp.live.inputActive) {
    await startNodeGraphLiveInputSource();
  } else {
    stopNodeGraphLiveInputSource();
  }
}

async function startNodeGraphLiveAudio(outputSerial = nodeGraphMvp.live.outputToggleSerial) {
  if (nodeGraphEarProtectionIsTripped()) {
    nodeGraphTripEarProtection({ source: "live" });
    renderNodeGraphLiveControls(false);
    renderNodeGraphExecutionPlanDebug();
    return;
  }
  if (nodeGraphLiveOutputStartCancelled(outputSerial)) {
    renderNodeGraphLiveControls(false);
    renderNodeGraphExecutionPlanDebug();
    return;
  }
  try {
    if (!nodeGraphScriptReadyForGraphAction("live audio")) {
      markNodeGraphLiveScriptBlocked();
      renderNodeGraphLiveControls(false);
      return;
    }
    setNodeGraphLiveStatus("starting", "warn");
    renderNodeGraphLiveControls(false);
    stopNodeGraphRenderedPlayback();
    if (nodeGraphMvp.live.node || nodeGraphMvp.live.context) {
      await stopNodeGraphLiveAudio();
      if (nodeGraphLiveOutputStartCancelled(outputSerial)) {
        renderNodeGraphLiveControls(false);
        renderNodeGraphExecutionPlanDebug();
        return;
      }
      setNodeGraphLiveStatus("starting", "warn");
      renderNodeGraphLiveControls(false);
    }

    const plan = nodeGraphBuildLivePlan();
    assertNodeGraphLivePlanSupportsClap(plan);
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) {
      throw new Error("Web Audio API unavailable");
    }
    const context = new AudioContextConstructor();
    nodeGraphMvp.live.sessionId += 1;
    nodeGraphMvp.live.planSerial = 0;
    if (context.state === "suspended") {
      await context.resume();
    }
    if (nodeGraphLiveOutputStartCancelled(outputSerial)) {
      await context.close();
      renderNodeGraphLiveControls(false);
      renderNodeGraphExecutionPlanDebug();
      return;
    }
    const outputGain = context.createGain();
    outputGain.gain.value = 1;
    let liveNode = null;
    let usesWorklet = false;
    try {
      liveNode = await createNodeGraphLiveWorkletNode(context);
      usesWorklet = true;
    } catch (error) {
      liveNode = createNodeGraphLiveScriptProcessorNode(context, plan);
      setNodeGraphLiveEngineStatus("engine fallback", "warn");
      setNodeGraphLiveEngineTitle(error.message);
    }
    if (nodeGraphLiveOutputStartCancelled(outputSerial)) {
      try {
        liveNode?.disconnect();
      } catch (_error) {
        // A not-yet-connected live node is already silent.
      }
      await context.close();
      renderNodeGraphLiveControls(false);
      renderNodeGraphExecutionPlanDebug();
      return;
    }
    nodeGraphMvp.live.context = context;
    nodeGraphMvp.live.meterGain = null;
    nodeGraphMvp.live.node = liveNode;
    nodeGraphMvp.live.outputGain = outputGain;
    nodeGraphMvp.live.usesWorklet = usesWorklet;
    liveNode.connect(outputGain);
    outputGain.connect(context.destination);
    await syncNodeGraphLiveInputSource();
    if (nodeGraphLiveOutputStartCancelled(outputSerial)) {
      await stopNodeGraphLiveAudio();
      renderNodeGraphExecutionPlanDebug();
      return;
    }
    sendNodeGraphLivePlan();
    sendNodeGraphLiveMacroControls();
    sendNodeGraphLivePitchModWheelSignal();
    if (usesWorklet) {
      setNodeGraphLiveEngineStatus("engine worklet", "good");
      setNodeGraphLiveEngineTitle();
    }
    await context.resume();
    clearNodeGraphLiveStatusTitle();
    renderNodeGraphLiveControls(true);
  } catch (error) {
    const inputError = Boolean(error.nodeGraphInputError);
    const inputErrorMessage = inputError ? nodeGraphLiveInputErrorMessage(error) : "";
    await stopNodeGraphLiveAudio();
    if (inputError) {
      nodeGraphMvp.live.outputEnabled = false;
      setNodeGraphLiveInputStatus("blocked", inputErrorMessage);
      setNodeGraphLiveMicStatus("blocked", inputErrorMessage);
      setNodeGraphLiveBlockedError("input", error, { schedule: false });
    } else {
      setNodeGraphLiveBlockedError("plan", error);
    }
    renderNodeGraphLiveControls(false);
  }
}
