const nodeGraphModuleScopeState = {
  animationTime: 0,
  animationDeltaSeconds: 1 / 60,
  animationLastTime: 0,
  buffers: new Map(),
  drawFrame: 0,
  drawFrameHeartbeat: 0,
  drawFrameRequestedAt: 0,
  drawFrameWatchdog: 0,
  enabled: false,
  frames: 0,
  lightDisplayStates: new Map(),
  lightSpriteTextures: new Map(),
  liveFrameCapacity: 16384,
  monitorFingerprint: "",
  modelFrameTimes: new Map(),
  monitors: [],
  mode: "",
  clockPhasors: new Map(),
  oscillatorPhasors: new Map(),
  additiveHarmonicProfiles: new Map(),
  patchFingerprint: "",
  phosphorFrame: {
    key: "",
    lastUpdate: 0,
  },
  renderMetrics: {
    drawCalls: 0,
    fps: 0,
    fpsFrames: 0,
    fpsLastTime: 0,
    points: 0,
    vertices: 0,
  },
  renderDebug: {
    canvasHeight: 0,
    canvasWidth: 0,
    committedFrames: 0,
    debugHistory: [],
    drawAttempts: 0,
    lastDrawMs: 0,
    lastError: "",
    lastFrameEndMs: 0,
    lastFrameStartMs: 0,
    lastHeartbeatMs: 0,
    lastSkipReason: "",
    pendingAgeMs: 0,
    phase: "boot",
    pixelRatio: 1,
    skippedFrames: 0,
    totalSlots: 0,
    visibleItems: 0,
    zoom: 1,
  },
  scanPhasors: new Map(),
  scanHistories: new Map(),
  scopeTracesOffActive: false,
  renderer: null,
  sampleRate: 0,
  slots: new Map(),
  traceDisplayDrawCache: new Map(),
  traceDisplayScratch: new Map(),
  traceImageTexture: {
    dataUrl: "",
    generatedKey: "",
    image: null,
    texture: null,
  },
  versionSerial: 0,
};
const nodeGraphModuleScopeSettingsStorageKey = "soemdsp-sandbox.moduleScopeSettings.v1";
const nodeGraphModuleScopeMaxBackingStoreSize = 4096;
const nodeGraphModuleScopeDefaultSettings = Object.freeze({
  blinkLightShape: "circle",
  brightness: 1,
  cycles: 2,
  gain: 1,
  lineThickness: 1,
  offset: 0,
  oscillatorTraceMode: "frequencyReset",
  outputTraceMode: "scroll",
  pan: 0,
  screenBurn: 0.62,
  sync: true,
  timeMs: 20,
});
const nodeGraphModuleScopeDefaultDotCores = Object.freeze({
  dot1: Object.freeze({
    brightness: 4.5,
    color: "#ffffff",
    size: 3.18,
  }),
  dot2: Object.freeze({
    brightness: 0.45,
    color: "#17002f",
    size: 4,
  }),
  traceColor: "#3de0ff",
});
const nodeGraphModuleScopeMinCycles = 1;
const nodeGraphModuleScopeDiscontinuityThreshold = 0.85;
const nodeGraphModuleScopeUnipolarTypes = new Set([
  "badvalMonitor",
  "clock",
  "clockDivider",
  "delayedTrigger",
  "expAdsr",
  "linearEnvelope",
  "midiNotePitch",
  "midiOut",
  "pluckEnvelope",
  "bloomGlow",
  "chromaColor",
  "rgbaHsla",
  "sandboxVisuals",
  "stepSequencer",
  "triggerCounter",
  "triggerDivider",
  "vactrolEnvelope",
]);

function normalizeNodeGraphModuleScopeSetting(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const cycles = Number(source.cycles);
  const timeMs = Number(source.timeMs);
  const offset = Number(source.offset);
  const pan = Number(source.pan);
  return {
    blinkLightShape: ["circle", "square", "diamond"].includes(source.blinkLightShape)
      ? source.blinkLightShape
      : nodeGraphModuleScopeDefaultSettings.blinkLightShape,
    brightness: nodeGraphModuleScopeDefaultSettings.brightness,
    cycles: Number.isFinite(cycles) && cycles >= 0
      ? clampNodeSliderValue(cycles, nodeGraphModuleScopeMinCycles, 128)
      : nodeGraphModuleScopeDefaultSettings.cycles,
    gain: nodeGraphModuleScopeDefaultSettings.gain,
    lineThickness: nodeGraphModuleScopeDefaultSettings.lineThickness,
    offset: Number.isFinite(offset) ? clampNodeSliderValue(offset, -1, 1) : nodeGraphModuleScopeDefaultSettings.offset,
    oscillatorTraceMode: source.oscillatorTraceMode === "window" ? "window" : "frequencyReset",
    outputTraceMode: source.outputTraceMode === "decay" ? "decay" : "scroll",
    pan: Number.isFinite(pan) ? clampNodeSliderValue(pan, -128, 128) : nodeGraphModuleScopeDefaultSettings.pan,
    screenBurn: nodeGraphModuleScopeDefaultSettings.screenBurn,
    sync: source.sync !== false,
    timeMs: Number.isFinite(timeMs) && timeMs >= 0
      ? clampNodeSliderValue(timeMs, 0, 10000)
      : nodeGraphModuleScopeDefaultSettings.timeMs,
  };
}

function normalizeNodeGraphModuleScopeBrightness(value, fallback = 1) {
  const number = Number(value);
  const safeFallback = Number.isFinite(Number(fallback)) ? Number(fallback) : 1;
  return Number.isFinite(number) ? clampNodeSliderValue(number, 0, 4) : clampNodeSliderValue(safeFallback, 0, 4);
}

function nodeGraphNormalizeScopeTraceColor(value) {
  const color = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color.toLowerCase();
  }
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    const [, r, g, b] = color.toLowerCase();
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return nodeGraphModuleScopeDefaultDotCores.traceColor;
}

function nodeGraphScopeHexColorToRgb(color) {
  const normalized = nodeGraphNormalizeScopeTraceColor(color);
  return [0, 2, 4].map((offset) => parseInt(normalized.slice(offset + 1, offset + 3), 16) / 255);
}

function nodeGraphModuleScopeDefaultDotCore(dotName) {
  return dotName === "dot2"
    ? nodeGraphModuleScopeDefaultDotCores.dot2
    : nodeGraphModuleScopeDefaultDotCores.dot1;
}

function nodeGraphModuleScopeDefaultShaderSourceForNode(node) {
  try {
    const moduleDefault = typeof nodeGraphScopeShaderModuleDefaultSource === "function"
      ? nodeGraphScopeShaderModuleDefaultSource(node)
      : "";
    if (moduleDefault) {
      return moduleDefault;
    }
  } catch {
    // Fall through to the built-in starter shader.
  }
  const builtInSource = typeof nodeGraphScopeShaderDefaultSourceForType === "function"
    ? nodeGraphScopeShaderDefaultSourceForType(node?.type)
    : "";
  return normalizeNodeGraphScopeShader({ source: builtInSource }).source;
}

function nodeGraphModuleScopeExplicitShaderSourceForSlot(slot) {
  const node = nodeGraphModuleScopeNodeForSlot(slot);
  if (!node) {
    return "";
  }
  try {
    const liveState = typeof nodeGraphShaderScriptState !== "undefined" ? nodeGraphShaderScriptState : null;
    const dialog = typeof nodeGraphShaderScriptDialog === "function" ? nodeGraphShaderScriptDialog() : null;
    if (
      liveState?.dialogMode === "scope" &&
      liveState.scopeTargetNodeId === node.id &&
      dialog &&
      !dialog.hidden
    ) {
      return document.getElementById("nodeShaderScriptSource")?.value || "";
    }
  } catch {
    // Scope rendering should survive if the editor is unavailable.
  }
  return Object.hasOwn(node, "scopeShader")
    ? normalizeNodeGraphScopeShader(node.scopeShader).source
    : "";
}

function nodeGraphModuleScopeShaderSourceForSlot(slot) {
  const node = nodeGraphModuleScopeNodeForSlot(slot);
  if (!node) {
    return "";
  }
  return nodeGraphModuleScopeExplicitShaderSourceForSlot(slot) ||
    nodeGraphModuleScopeDefaultShaderSourceForNode(node);
}

function nodeGraphModuleScopeShaderVideoInputForSlot(slot) {
  return normalizeNodeGraphScopeShader({ source: nodeGraphModuleScopeShaderSourceForSlot(slot) }).videoInput;
}

function nodeGraphModuleScopeShaderConfigForSlot(slot) {
  return normalizeNodeGraphScopeShader({ source: nodeGraphModuleScopeShaderSourceForSlot(slot) });
}

function nodeGraphModuleScopeExplicitShaderConfigForSlot(slot) {
  const source = nodeGraphModuleScopeExplicitShaderSourceForSlot(slot);
  return source ? normalizeNodeGraphScopeShader({ source }) : null;
}

function nodeGraphModuleScopeShaderOutputPortForSlot(slot) {
  const videoInput = nodeGraphModuleScopeShaderVideoInputForSlot(slot);
  const match = String(videoInput || "").match(/^output(\d+)$/);
  if (!match) {
    return "";
  }
  const node = nodeGraphModuleScopeNodeForSlot(slot);
  const outputs = node ? nodeGraphPatchNodeOutputPorts(node) : [];
  return outputs[Number(match[1])] || "";
}

function nodeGraphModuleScopeShaderAssignmentValue(source, dotName, key) {
  const safeDotName = dotName === "dot2" ? "dot2" : "dot1";
  const safeKey = String(key || "").replace(/[^\w]/g, "");
  if (!safeKey) {
    return "";
  }
  const match = String(source || "").match(new RegExp(`\\b${safeDotName}\\.${safeKey}\\s*=\\s*([^;]+)\\s*;`));
  return String(match?.[1] || "").trim();
}

function nodeGraphModuleScopeShaderColor(source, dotName, fallback) {
  const value = nodeGraphModuleScopeShaderAssignmentValue(source, dotName, "color");
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) {
    return nodeGraphNormalizeScopeTraceColor(value);
  }
  if (new RegExp(`^${dotName}\\.(?:global|globals)\\.color$`).test(value)) {
    return nodeGraphModuleScopeShaderGlobalColor(dotName);
  }
  return fallback;
}

function nodeGraphModuleScopeShaderGlobalColor(dotName) {
  const defaultCore = nodeGraphModuleScopeDefaultDotCore(dotName);
  return dotName === "dot2"
    ? normalizeNodeGraphModuleScopeDotCoreColor(
      nodeGraphMvp?.moduleScopeDotCore2Color ?? defaultCore.color,
      defaultCore.color,
    )
    : normalizeNodeGraphModuleScopeDotCoreColor(
      nodeGraphMvp?.moduleScopeDotCore1Color ?? defaultCore.color,
      defaultCore.color,
    );
}

function nodeGraphModuleScopeShaderNumber(source, dotName, key, fallback) {
  const value = nodeGraphModuleScopeShaderExpressionValue(
    nodeGraphModuleScopeShaderAssignmentValue(source, dotName, key),
    dotName,
    key,
    fallback,
  );
  return Number.isFinite(value) ? value : fallback;
}

function nodeGraphModuleScopeShaderGlobalValue(dotName, key, fallback) {
  const dotIndex = dotName === "dot2" ? 2 : 1;
  const defaultCore = nodeGraphModuleScopeDefaultDotCore(dotName);
  const enabled = dotIndex === 2
    ? nodeGraphMvp?.moduleScopeDotCore2Enabled !== false
    : nodeGraphMvp?.moduleScopeDotCore1Enabled !== false;
  if (key === "size") {
    const size = dotIndex === 2
      ? normalizeNodeGraphModuleScopeDotCoreSize(
        nodeGraphMvp?.moduleScopeDotCore2Size ?? defaultCore.size,
        defaultCore.size,
      )
      : normalizeNodeGraphModuleScopeDotCoreSize(
        nodeGraphMvp?.moduleScopeDotCore1Size ?? defaultCore.size,
        defaultCore.size,
      );
    return normalizeNodeGraphModuleScopeDotCoreSize(
      (Number(fallback) || 0) * (size / defaultCore.size),
      defaultCore.size,
    );
  }
  if (key === "brightness") {
    if (!enabled) {
      return 0;
    }
    return dotIndex === 2
      ? normalizeNodeGraphModuleScopeDotCoreBrightness(
        nodeGraphMvp?.moduleScopeDotCore2Brightness ?? defaultCore.brightness,
        defaultCore.brightness,
      )
      : normalizeNodeGraphModuleScopeDotCoreBrightness(
        nodeGraphMvp?.moduleScopeDotCore1Brightness ?? defaultCore.brightness,
        defaultCore.brightness,
      );
  }
  if (key === "blur") {
    return Number.isFinite(Number(defaultCore.blur)) ? normalizeNodeGraphModuleScopeDotBlur(defaultCore.blur, 0) : 0;
  }
  return fallback;
}

function nodeGraphModuleScopeShaderExpressionPartValue(part, dotName, key, fallback) {
  const text = String(part || "").trim();
  if (!text) {
    return NaN;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(text)) {
    return Number(text);
  }
  const globalMatch = text.match(/^dot([12])\.(?:global|globals)\.(size|brightness|blur)$/);
  if (globalMatch) {
    return nodeGraphModuleScopeShaderGlobalValue(`dot${globalMatch[1]}`, globalMatch[2], fallback);
  }
  if (text === "globalsize" || text === "global.size") {
    return nodeGraphModuleScopeShaderGlobalValue(dotName, "size", fallback);
  }
  return NaN;
}

function nodeGraphModuleScopeShaderExpressionValue(expression, dotName, key, fallback) {
  const text = String(expression || "").trim();
  if (!text) {
    return fallback;
  }
  const product = text
    .split("*")
    .map((part) => nodeGraphModuleScopeShaderExpressionPartValue(part, dotName, key, fallback));
  if (product.length && product.every((value) => Number.isFinite(value))) {
    return product.reduce((value, part) => value * part, 1);
  }
  return fallback;
}

function nodeGraphModuleScopeShaderSizeRatio(source, dotName, fallback) {
  return clampNodeSliderValue(
    nodeGraphModuleScopeShaderNumber(source, dotName, "size", fallback),
    0,
    1,
  );
}

function normalizeNodeGraphModuleScopeDotBlur(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? clampNodeSliderValue(number, 0, 1) : fallback;
}

function nodeGraphModuleScopeShaderBlurRatio(source, dotName, fallback = 0) {
  return normalizeNodeGraphModuleScopeDotBlur(
    nodeGraphModuleScopeShaderNumber(source, dotName, "blur", fallback),
    fallback,
  );
}

function nodeGraphModuleScopeLightShaderStyle(slot, buffer) {
  const source = nodeGraphModuleScopeShaderSourceForSlot(slot);
  const dotCore1Enabled = nodeGraphMvp?.moduleScopeDotCore1Enabled !== false;
  const dotCore2Enabled = nodeGraphMvp?.moduleScopeDotCore2Enabled !== false;
  const outerFallback = normalizeNodeGraphModuleScopeDotCoreColor(
    buffer.nodeGraphScopeLightOuterColor ?? nodeGraphMvp?.moduleScopeDotCore2Color ?? nodeGraphModuleScopeDefaultDotCores.dot2.color,
    nodeGraphModuleScopeDefaultDotCores.dot2.color,
  );
  const centerFallback = normalizeNodeGraphModuleScopeDotCoreColor(
    buffer.nodeGraphScopeLightCenterColor ?? outerFallback,
    outerFallback,
  );
  return {
    centerBrightness: clampNodeSliderValue(
      (dotCore1Enabled ? 1 : 0) * nodeGraphModuleScopeShaderNumber(
        source,
        "dot1",
        "brightness",
        normalizeNodeGraphModuleScopeDotCoreBrightness(
          nodeGraphMvp?.moduleScopeDotCore1Brightness ?? nodeGraphModuleScopeDefaultDotCores.dot1.brightness,
          nodeGraphModuleScopeDefaultDotCores.dot1.brightness,
        ),
      ),
      0,
      40,
    ),
    centerColor: nodeGraphModuleScopeShaderColor(source, "dot1", centerFallback),
    centerBlur: nodeGraphModuleScopeShaderBlurRatio(source, "dot1", 0),
    centerSize: nodeGraphModuleScopeShaderSizeRatio(
      source,
      "dot1",
      0.035,
    ),
    outerBrightness: clampNodeSliderValue(
      (dotCore2Enabled ? 1 : 0) * nodeGraphModuleScopeShaderNumber(
        source,
        "dot2",
        "brightness",
        normalizeNodeGraphModuleScopeDotCoreBrightness(
          nodeGraphMvp?.moduleScopeDotCore2Brightness ?? nodeGraphModuleScopeDefaultDotCores.dot2.brightness,
          nodeGraphModuleScopeDefaultDotCores.dot2.brightness,
        ),
      ),
      0,
      40,
    ),
    outerColor: nodeGraphModuleScopeShaderColor(source, "dot2", outerFallback),
    outerBlur: nodeGraphModuleScopeShaderBlurRatio(source, "dot2", 0),
    outerSize: nodeGraphModuleScopeShaderSizeRatio(
      source,
      "dot2",
      0.09,
    ),
    source,
    usesShader: Boolean(source),
  };
}

function normalizeNodeGraphModuleScopeSettings(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(
    Object.entries(source)
      .filter(([nodeId]) => Boolean(nodeId))
      .map(([nodeId, setting]) => [nodeId, normalizeNodeGraphModuleScopeSetting(setting)]),
  );
}

function nodeGraphModuleScopeSetting(nodeId) {
  return normalizeNodeGraphModuleScopeSetting(nodeGraphMvp.moduleScopeSettings?.[nodeId]);
}

function nodeGraphModuleScopeEffectiveSettingForSlot(slot) {
  const setting = nodeGraphModuleScopeSetting(slot?.nodeId || "");
  const shader = nodeGraphModuleScopeExplicitShaderConfigForSlot(slot);
  if (!shader) {
    return setting;
  }
  const cycles = Number(shader.cycles);
  const zoom = Number(shader.zoom);
  const syncSpeed = Number(shader.syncSpeed);
  const nextSetting = { ...setting };
  if (Number.isFinite(cycles)) {
    nextSetting.cycles = clampNodeSliderValue(cycles, nodeGraphModuleScopeMinCycles, 128);
  }
  if (Number.isFinite(zoom) && zoom > 0) {
    nextSetting.shaderZoom = clampNodeSliderValue(zoom, 0.01, 50);
  }
  if (Number.isFinite(syncSpeed)) {
    nextSetting.syncSpeed = clampNodeSliderValue(syncSpeed, 0, 50);
  }
  if (shader.sync === "on") {
    return { ...nextSetting, sync: true };
  }
  if (shader.sync === "off") {
    return { ...nextSetting, sync: false };
  }
  return nextSetting;
}

function nodeGraphModuleScopePositiveCycles(setting) {
  const cycles = Number(setting?.cycles);
  if (Number.isFinite(cycles) && cycles > 0) {
    return clampNodeSliderValue(cycles, nodeGraphModuleScopeMinCycles, 128);
  }
  return nodeGraphModuleScopeDefaultSettings.cycles;
}

function nodeGraphModuleScopeVisualGain(setting) {
  const gain = Number.isFinite(Number(setting?.gain))
    ? Number(setting.gain)
    : nodeGraphModuleScopeDefaultSettings.gain;
  const zoom = Number.isFinite(Number(setting?.shaderZoom)) && Number(setting.shaderZoom) > 0
    ? Number(setting.shaderZoom)
    : 1;
  return clampNodeSliderValue(gain * zoom, 0.01, 100);
}

function nodeGraphModuleScopeEffectiveCycles(setting) {
  const cycles = Number(setting?.cycles);
  if (Number.isFinite(cycles) && cycles === 0) {
    return nodeGraphModuleScopeMinCycles;
  }
  const positiveCycles = nodeGraphModuleScopePositiveCycles(setting);
  return setting?.sync === false
    ? positiveCycles
    : Math.max(1, Math.round(positiveCycles));
}

function applyNodeGraphModuleScopeSettings(value = {}) {
  nodeGraphMvp.moduleScopeSettings = normalizeNodeGraphModuleScopeSettings(value);
  renderNodeGraphSceneScopeControls();
  scheduleNodeGraphModuleScopeDraw();
}

function loadNodeGraphModuleScopeSettingsLocal() {
  if (!nodeGraphLocalDefaultPresetAllowed()) {
    return null;
  }
  try {
    const text = window.localStorage.getItem(nodeGraphModuleScopeSettingsStorageKey);
    const settings = text ? normalizeNodeGraphModuleScopeSettings(JSON.parse(text)) : null;
    if (settings) {
      applyNodeGraphModuleScopeSettings(settings);
    }
    return settings;
  } catch {
    return null;
  }
}

function saveNodeGraphModuleScopeSettingsLocal(value = nodeGraphMvp.moduleScopeSettings) {
  if (!nodeGraphLocalDefaultPresetAllowed()) {
    return false;
  }
  try {
    window.localStorage.setItem(
      nodeGraphModuleScopeSettingsStorageKey,
      JSON.stringify(normalizeNodeGraphModuleScopeSettings(value)),
    );
    return true;
  } catch {
    return false;
  }
}

function updateNodeGraphModuleScopeSetting(nodeId, patch = {}) {
  if (!nodeId) {
    return;
  }
  nodeGraphMvp.moduleScopeSettings = {
    ...normalizeNodeGraphModuleScopeSettings(nodeGraphMvp.moduleScopeSettings),
    [nodeId]: normalizeNodeGraphModuleScopeSetting({
      ...nodeGraphModuleScopeSetting(nodeId),
      ...patch,
    }),
  };
  saveNodeGraphModuleScopeSettingsLocal();
  renderNodeGraphSceneScopeControls(nodeId);
  scheduleNodeGraphModuleScopeDraw();
}

function nodeGraphFormatScopeNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "";
  }
  return Number(number.toFixed(4)).toString();
}

function nodeGraphScopeControlTargetNodeId() {
  const scopeNode = nodeGraphMvp.scopeContextTargetNode;
  if (scopeNode && nodeGraphPatchNode(scopeNode)) {
    return scopeNode;
  }
  return nodeGraphModuleActionTargetNodeId();
}

function renderNodeGraphSceneScopeControls(nodeId = nodeGraphScopeControlTargetNodeId()) {
  const setting = nodeGraphModuleScopeEffectiveSettingForSlot({ nodeId });
  const targetNode = nodeGraphPatchNode(nodeId);
  const individualControls = document.getElementById("nodeIndividualScopeControls");
  if (individualControls) {
    individualControls.hidden = !targetNode;
  }
  const timeInput = document.getElementById("nodeSceneScopeTime");
  if (timeInput && document.activeElement !== timeInput) {
    timeInput.value = nodeGraphFormatScopeNumber(setting.cycles);
    timeInput.title = "Scope horizontal window in detected cycles.";
  }
  const scopeFields = document.querySelector("#nodeSceneScopeControls .scene-context-scope-fields");
  if (scopeFields) {
    const showOscillatorMode = nodeGraphModuleScopeIsOscillatorType(targetNode?.type);
    const showOutputMode = targetNode?.type === "output";
    scopeFields.classList.toggle("three", showOscillatorMode || showOutputMode);
    scopeFields.classList.toggle("two", !showOscillatorMode && !showOutputMode);
  }
  const syncButton = document.getElementById("nodeSceneScopeSync");
  if (syncButton) {
    syncButton.textContent = setting.sync ? "sync" : "free";
    syncButton.setAttribute("aria-pressed", String(setting.sync));
    syncButton.title = "Scope rising-edge sync";
  }
  const oscillatorTraceModeButton = document.getElementById("nodeSceneScopeOscillatorTraceMode");
  if (oscillatorTraceModeButton) {
    const isFrequencyResetMode = setting.oscillatorTraceMode !== "window";
    oscillatorTraceModeButton.hidden = !nodeGraphModuleScopeIsOscillatorType(targetNode?.type);
    oscillatorTraceModeButton.textContent = isFrequencyResetMode ? "freq reset" : "window";
    oscillatorTraceModeButton.setAttribute("aria-pressed", String(isFrequencyResetMode));
    oscillatorTraceModeButton.title = "Oscillator scope redraw mode";
  }
  const outputTraceModeButton = document.getElementById("nodeSceneScopeOutputTraceMode");
  if (outputTraceModeButton) {
    const isDecayMode = setting.outputTraceMode === "decay";
    outputTraceModeButton.hidden = targetNode?.type !== "output";
    outputTraceModeButton.textContent = isDecayMode ? "decay" : "scroll";
    outputTraceModeButton.setAttribute("aria-pressed", String(isDecayMode));
    outputTraceModeButton.title = "Output scope draw mode";
  }
  const blinkLightControls = document.getElementById("nodeSceneBlinkLightControls");
  if (blinkLightControls) {
    blinkLightControls.hidden = targetNode?.type !== "clock";
  }
  const blinkLightShape = document.getElementById("nodeSceneBlinkLightShape");
  if (blinkLightShape && document.activeElement !== blinkLightShape) {
    blinkLightShape.value = setting.blinkLightShape;
  }
}

function handleNodeGraphSceneScopeNumericInput(event) {
  const input = event.currentTarget;
  const nodeId = nodeGraphScopeControlTargetNodeId();
  if (!nodeId) {
    return;
  }
  const value = Number(input.value.trim());
  if (!Number.isFinite(value)) {
    renderNodeGraphSceneScopeControls(nodeId);
    return;
  }
  if (input.dataset.scopeInput === "cycles") {
    updateNodeGraphModuleScopeSetting(nodeId, { cycles: value });
  }
}

function handleNodeGraphSceneScopeOptionInput(event) {
  const input = event.currentTarget;
  const nodeId = nodeGraphScopeControlTargetNodeId();
  if (!nodeId) {
    return;
  }
  if (input.dataset.scopeInput === "blinkLightShape") {
    updateNodeGraphModuleScopeSetting(nodeId, {
      blinkLightShape: ["circle", "square", "diamond"].includes(input.value) ? input.value : "circle",
    });
  }
}

function handleNodeGraphSceneScopeNumericKeydown(event) {
  if (event.key === "Enter") {
    event.currentTarget.blur();
  }
}

function nodeGraphScopeNumberInputRange(input) {
  const min = Number(input.min);
  const max = Number(input.max);
  const step = Number(input.step);
  return {
    max: Number.isFinite(max) ? max : 1,
    min: Number.isFinite(min) ? min : 0,
    step: Number.isFinite(step) && step > 0 ? step : 0.01,
  };
}

function nodeGraphScopeNumberInputStepDecimals(input) {
  const stepText = String(input.step || "");
  const decimalPart = stepText.includes(".") ? stepText.split(".").pop() : "";
  return Math.min(6, decimalPart.length);
}

function nodeGraphScopeNumberInputSnapValue(input, value) {
  const { min, max, step } = nodeGraphScopeNumberInputRange(input);
  const decimals = nodeGraphScopeNumberInputStepDecimals(input);
  const clamped = clampNodeSliderValue(Number(value) || 0, min, max);
  const quantized = Math.round(clamped / step) * step;
  const snapped = clampNodeSliderValue(quantized, min, max);
  return Number(snapped.toFixed(decimals));
}

function setNodeGraphScopeNumberInputValue(input, value) {
  input.value = input.dataset.scopeInput === "cycles"
    ? nodeGraphFormatScopeNumber(clampNodeSliderValue(Number(value) || 0, nodeGraphModuleScopeMinCycles, 128))
    : nodeGraphScopeNumberInputSnapValue(input, value).toString();
  if (input.dataset.globalScopeInput === "burn") {
    setNodeGraphModuleScopeBurn(input.value);
  } else if (input.dataset.globalScopeInput === "decay") {
    setNodeGraphModuleScopeDecay(input.value);
  } else if (input.dataset.globalScopeInput === "framesPerSecond") {
    setNodeGraphModuleScopeFramesPerSecond(input.value);
  } else if (input.dataset.timingField) {
    updateNodeGraphPatchTimingFromHeader(input);
  } else if (input.dataset.globalScopeInput === "lineThickness") {
    setNodeGraphModuleScopeLineThickness(input.value);
  } else if (input.dataset.globalScopeInput === "dotCore1Size") {
    setNodeGraphModuleScopeDotCore1Size(input.value);
  } else if (input.dataset.globalScopeInput === "dotCore1Brightness") {
    setNodeGraphModuleScopeDotCore1Brightness(input.value);
  } else if (input.dataset.globalScopeInput === "dotCore2Size") {
    setNodeGraphModuleScopeDotCore2Size(input.value);
  } else if (input.dataset.globalScopeInput === "dotCore2Brightness") {
    setNodeGraphModuleScopeDotCore2Brightness(input.value);
  } else if (input.dataset.globalScopeInput === "discontinuitySkipSamples") {
    setNodeGraphModuleScopeDiscontinuitySkipSamples(input.value);
  } else {
    handleNodeGraphSceneScopeNumericInput({ currentTarget: input });
  }
  if (typeof scheduleNodeGraphModuleScopeDraw === "function") {
    scheduleNodeGraphModuleScopeDraw();
  }
}

function nodeGraphScopeNumberDragInputFromTarget(target) {
  if (target instanceof HTMLInputElement) {
    return target;
  }
  return target?.querySelector?.("input[data-global-scope-number-drag='true']") || null;
}

function nodeGraphSettingsTextControlFromTarget(target) {
  if (!(target instanceof Element)) {
    return null;
  }
  return target.closest?.(
    "input[type='text'], input[type='number'], input[type='search'], input[inputmode], textarea",
  ) || null;
}

function nodeGraphSettingsTextRootFromTarget(target) {
  if (!(target instanceof Element)) {
    return null;
  }
  return target.closest?.("#nodeGlobalScopeMenu, #nodeParameterMetadataPopover, #nodeTraceDisplaySettingsPopover");
}

function preventNodeGraphSettingsTextTransfer(event) {
  if (!nodeGraphSettingsTextControlFromTarget(event.target)) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
}

function beginNodeGraphSettingsTextPointer(event) {
  const input = nodeGraphSettingsTextControlFromTarget(event.target);
  const root = input ? nodeGraphSettingsTextRootFromTarget(input) : null;
  if (!input || !root) {
    return;
  }
  root.dataset.settingsTextPointerActive = "true";
  root.dataset.settingsTextPointerId = String(event.pointerId ?? "mouse");
  root.dataset.settingsTextPointerStartX = String(event.clientX ?? 0);
  root.dataset.settingsTextPointerStartY = String(event.clientY ?? 0);
  root.dataset.settingsTextPointerMoved = "false";
  root.dataset.settingsTextSuppressClick = "false";
  event.stopPropagation();
}

function moveNodeGraphSettingsTextPointer(event) {
  const root = nodeGraphSettingsTextRootFromTarget(event.target);
  if (!root || root.dataset.settingsTextPointerActive !== "true") {
    return;
  }
  const activePointerId = root.dataset.settingsTextPointerId || "";
  const pointerId = String(event.pointerId ?? "mouse");
  if (activePointerId && activePointerId !== pointerId) {
    return;
  }
  const startX = Number(root.dataset.settingsTextPointerStartX) || 0;
  const startY = Number(root.dataset.settingsTextPointerStartY) || 0;
  if (Math.abs((event.clientX ?? 0) - startX) > 2 || Math.abs((event.clientY ?? 0) - startY) > 2) {
    root.dataset.settingsTextPointerMoved = "true";
  }
  event.stopPropagation();
}

function endNodeGraphSettingsTextPointer(event) {
  const root = nodeGraphSettingsTextRootFromTarget(event.target);
  if (!root || root.dataset.settingsTextPointerActive !== "true") {
    return;
  }
  const activePointerId = root.dataset.settingsTextPointerId || "";
  const pointerId = String(event.pointerId ?? "mouse");
  if (activePointerId && activePointerId !== pointerId) {
    return;
  }
  const moved = root.dataset.settingsTextPointerMoved === "true";
  root.dataset.settingsTextPointerActive = "false";
  root.dataset.settingsTextPointerId = "";
  root.dataset.settingsTextPointerMoved = "false";
  root.dataset.settingsTextSuppressClick = moved ? "true" : "false";
  if (moved) {
    window.setTimeout(() => {
      if (root.dataset.settingsTextSuppressClick === "true") {
        root.dataset.settingsTextSuppressClick = "false";
      }
    }, 180);
  }
  event.stopPropagation();
}

function nodeGraphSettingsTextGestureShouldIgnoreClick(event) {
  const root = nodeGraphSettingsTextRootFromTarget(event?.target);
  return Boolean(root && root.dataset.settingsTextSuppressClick === "true");
}

function bindNodeGraphSettingsTextInputProtection(root) {
  if (!root || root.dataset.settingsTextInputProtectionBound === "true") {
    return;
  }
  root.dataset.settingsTextInputProtectionBound = "true";
  root.addEventListener("dragstart", preventNodeGraphSettingsTextTransfer, true);
  root.addEventListener("dragover", preventNodeGraphSettingsTextTransfer, true);
  root.addEventListener("drop", preventNodeGraphSettingsTextTransfer, true);
  root.addEventListener("pointerdown", beginNodeGraphSettingsTextPointer, true);
  root.addEventListener("pointermove", moveNodeGraphSettingsTextPointer, true);
  root.addEventListener("pointerup", endNodeGraphSettingsTextPointer, true);
  root.addEventListener("pointercancel", endNodeGraphSettingsTextPointer, true);
  for (const input of root.querySelectorAll("input[type='text'], input[type='number'], input[type='search'], input[inputmode], textarea")) {
    input.draggable = false;
  }
}

function bindNodeGraphModuleScopeWindowEvents(scopeElement) {
  if (!scopeElement || scopeElement.dataset.scopeWindowEventsBound === "true") {
    return;
  }
  scopeElement.dataset.scopeWindowEventsBound = "true";
  scopeElement.addEventListener("dblclick", beginNodeGraphModuleScopeWindowNumberEdit);
  scopeElement.addEventListener("contextmenu", beginNodeGraphModuleScopeWindowNumberEdit);
}

function beginNodeGraphModuleScopeWindowNumberEdit(event) {
  const scopeElement = event.currentTarget;
  const moduleElement = scopeElement?.closest?.(".dsp-node");
  const nodeId = moduleElement?.dataset?.node || scopeElement?.dataset?.node || "";
  const menu = document.getElementById("nodeGlobalScopeMenu");
  if (!nodeId || !nodeGraphPatchNode(nodeId) || !menu) {
    return;
  }
  if (typeof openNodeGraphTraceDisplaySettings === "function" && openNodeGraphTraceDisplaySettings(nodeId, event)) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  menu.hidden = true;
  event.preventDefault();
  event.stopPropagation();
}

function nodeGraphScopeNumberDragScale(input, event) {
  const { min, max, step } = nodeGraphScopeNumberInputRange(input);
  const multiplier = typeof nodeGraphNumericDragMultiplier === "function"
    ? nodeGraphNumericDragMultiplier(event)
    : 1;
  if (input.dataset.globalScopeInput === "framesPerSecond") {
    return (step / 10) * multiplier;
  }
  if (input.dataset.timingField) {
    return (step / 10) * multiplier;
  }
  if (input.dataset.scopeInput === "cycles") {
    const baseCycles = Math.max(step / 8, (max - min) / 960);
    return baseCycles * multiplier;
  }
  const base = Math.max(step, (max - min) / 160);
  return base * multiplier;
}

function beginNodeGraphScopeNumberDrag(event) {
  if (event.button > 0 || event.detail > 1) {
    return;
  }
  if (typeof nodeGraphNumericModifierReserved === "function" && nodeGraphNumericModifierReserved(event)) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  const input = nodeGraphScopeNumberDragInputFromTarget(event.currentTarget);
  if (!input) {
    return;
  }
  if (input.closest("#nodeGlobalScopeMenu, #nodeParameterMetadataPopover, #nodeTraceDisplaySettingsPopover")) {
    return;
  }
  nodeGraphMvp.scopeNumberDragging = {
    captureTarget: event.currentTarget,
    input,
    pointerId: event.pointerId ?? null,
    scale: nodeGraphScopeNumberDragScale(input, event),
    startValue: Number(input.value) || 0,
    startX: event.clientX,
    startY: event.clientY,
  };
  input.classList.add("value-dragging");
  input.closest(".node-header-timing-field")?.classList.add("value-dragging");
  input.readOnly = true;
  event.currentTarget?.setPointerCapture?.(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function dragNodeGraphScopeNumber(event) {
  const drag = nodeGraphMvp.scopeNumberDragging;
  if (
    !drag ||
    (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)
  ) {
    return;
  }
  const horizontalDelta = event.clientX - drag.startX;
  const verticalDelta = drag.startY - event.clientY;
  setNodeGraphScopeNumberInputValue(
    drag.input,
    drag.startValue + (horizontalDelta + verticalDelta) * drag.scale,
  );
  event.preventDefault();
}

function endNodeGraphScopeNumberDrag(event) {
  const drag = nodeGraphMvp.scopeNumberDragging;
  if (
    !drag ||
    (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)
  ) {
    return;
  }
  drag.input.classList.remove("value-dragging");
  const headerField = drag.input.closest(".node-header-timing-field");
  headerField?.classList.remove("value-dragging");
  drag.input.readOnly = Boolean(headerField);
  const captureTarget = drag.captureTarget || drag.input;
  if (event.pointerId !== undefined && captureTarget.hasPointerCapture?.(event.pointerId)) {
    captureTarget.releasePointerCapture(event.pointerId);
  }
  nodeGraphMvp.scopeNumberDragging = null;
  event.preventDefault();
}

function beginNodeGraphScopeNumberEdit(event) {
  const input = nodeGraphScopeNumberDragInputFromTarget(event.currentTarget);
  if (!input) {
    return;
  }
  input.readOnly = false;
  input.focus();
  input.select();
  event.preventDefault();
  event.stopPropagation();
}

function handleNodeGraphSceneScopeControlClick(event) {
  const button = event.currentTarget;
  const nodeId = nodeGraphScopeControlTargetNodeId();
  const setting = nodeGraphModuleScopeSetting(nodeId);
  if (button.dataset.scopeControl === "sync") {
    updateNodeGraphModuleScopeSetting(nodeId, { sync: !setting.sync });
  } else if (button.dataset.scopeControl === "oscillatorTraceMode") {
    updateNodeGraphModuleScopeSetting(nodeId, {
      oscillatorTraceMode: setting.oscillatorTraceMode === "window" ? "frequencyReset" : "window",
    });
  } else if (button.dataset.scopeControl === "outputTraceMode") {
    updateNodeGraphModuleScopeSetting(nodeId, {
      outputTraceMode: setting.outputTraceMode === "decay" ? "scroll" : "decay",
    });
  }
  event.preventDefault();
  event.stopPropagation();
}

function nodeGraphModuleScopeCanvas() {
  return document.getElementById("nodeModuleScopeCanvas");
}

function nodeGraphModuleScopeLightCanvas() {
  return document.getElementById("nodeModuleScopeLightCanvas");
}

function nodeGraphModuleScopesEnabled() {
  return Boolean(nodeGraphModuleScopeState.enabled);
}

function setNodeGraphModuleScopesEnabled(enabled) {
  nodeGraphModuleScopeState.enabled = Boolean(enabled);
  document.getElementById("nodeGraphWorkspace")
    ?.classList.toggle("module-scopes-enabled", nodeGraphModuleScopesEnabled());
  syncNodeGraphModuleScopeHeartbeat();
  syncNodeGraphModuleScopeCanvas();
}

function syncNodeGraphModuleScopeHeartbeat() {
  if (!nodeGraphModuleScopesEnabled()) {
    if (nodeGraphModuleScopeState.drawFrameHeartbeat) {
      window.clearInterval(nodeGraphModuleScopeState.drawFrameHeartbeat);
      nodeGraphModuleScopeState.drawFrameHeartbeat = 0;
    }
    return;
  }
  if (nodeGraphModuleScopeState.drawFrameHeartbeat) {
    return;
  }
  nodeGraphModuleScopeState.drawFrameHeartbeat = window.setInterval(() => {
    syncNodeGraphScopeGpuDebugDisplay();
    if (nodeGraphMvp?.moduleOscilloscopesVisible === false || nodeGraphModuleScopePaused()) {
      return;
    }
    const pendingFrame = Number(nodeGraphModuleScopeState.drawFrame) || 0;
    const requestedAt = Number(nodeGraphModuleScopeState.drawFrameRequestedAt) || 0;
    const now = (performance.now?.() || Date.now());
    if (pendingFrame && requestedAt > 0 && now - requestedAt <= 250) {
      return;
    }
    if (pendingFrame) {
      window.cancelAnimationFrame(pendingFrame);
      nodeGraphModuleScopeState.drawFrame = 0;
      nodeGraphModuleScopeState.drawFrameRequestedAt = 0;
    }
    if (nodeGraphModuleScopeState.drawFrameWatchdog) {
      window.clearTimeout(nodeGraphModuleScopeState.drawFrameWatchdog);
      nodeGraphModuleScopeState.drawFrameWatchdog = 0;
    }
    scheduleNodeGraphModuleScopeDraw();
  }, 100);
}

function registerNodeGraphModuleScopeSlot(moduleElement, options = {}) {
  const nodeId = moduleElement?.dataset?.node || options.nodeId || "";
  if (!nodeId) {
    return null;
  }
  const scopeElement = options.scopeElement
    || moduleElement?.querySelector?.(".node-module-scope-window")
    || null;
  const slot = {
    element: moduleElement,
    nodeId,
    scopeElement,
    type: options.type || moduleElement?.dataset?.nodeType || "",
  };
  if (options.viewDrag !== false) {
    bindNodeGraphModuleScopeWindowEvents(scopeElement);
  }
  nodeGraphModuleScopeState.slots.set(nodeId, slot);
  scheduleNodeGraphModuleScopeDraw();
  return slot;
}

function unregisterNodeGraphModuleScopeSlot(nodeId) {
  nodeGraphModuleScopeState.slots.delete(nodeId);
  nodeGraphModuleScopeState.lightDisplayStates.delete(nodeId);
  nodeGraphModuleScopeState.modelFrameTimes.delete(nodeId);
  nodeGraphModuleScopeState.clockPhasors.delete(nodeId);
  nodeGraphModuleScopeState.oscillatorPhasors.delete(nodeId);
  nodeGraphModuleScopeState.scanPhasors.delete(nodeId);
  nodeGraphModuleScopeState.scanHistories.delete(nodeId);
}

function nodeGraphModuleScopeSlots() {
  return [...nodeGraphModuleScopeState.slots.values()]
    .filter((slot) => slot.element?.isConnected && !slot.element.hidden && slot.scopeElement);
}

function nodeGraphModuleScopeSlotIgnoresGlobalHide(slot) {
  return [
    "visualOscilloscope",
    "traceDisplay",
    "dotOscilloscope",
    "valueOscilloscope",
    "lineBurnOscilloscope",
    "scope2d",
    "canvas",
  ].includes(slot?.type);
}

function nodeGraphVisibleModuleScopeSlots() {
  const slots = nodeGraphModuleScopeSlots();
  if (nodeGraphMvp.moduleOscilloscopesVisible !== false) {
    return slots;
  }
  return slots.filter(nodeGraphModuleScopeSlotIgnoresGlobalHide);
}

function nodeGraphModuleScopeMonitorFingerprint(monitors = []) {
  return normalizeNodeGraphPatchMonitors(monitors)
    .map(nodeGraphMonitorEndpointKey)
    .sort()
    .join("|");
}

function nodeGraphModuleScopeIsOscillatorType(type) {
  return nodeGraphModuleIsRealtimeOscillatorType(type);
}

function nodeGraphModuleScopeIsAdditiveType(type) {
  return type === "additiveOsc" || type === "gpuAdditiveOsc";
}

function nodeGraphDefaultModuleScopeMonitors(patch = nodeGraphMvp?.patch) {
  return (Array.isArray(patch?.nodes) ? patch.nodes : [])
    .map((node) => {
      if (nodeGraphModuleScopeIsOscillatorType(node?.type)) {
        return {
          io: "output",
          node: node.id,
          port: nodeGraphOscillatorSelectedOutputPort(node),
        };
      }
      const inputs = nodeGraphPatchNodeInputPorts(node);
      if (inputs.length) {
        return {
          io: "input",
          node: node.id,
          port: inputs[0],
        };
      }
      const outputs = nodeGraphPatchNodeOutputPorts(node);
      if (!outputs.length) {
        return null;
      }
      const port = outputs.includes("Out") ? "Out" : outputs[0];
      return {
        io: "output",
        node: node.id,
        port,
      };
    })
    .filter(Boolean);
}

function nodeGraphOscillatorSelectedOutputPort(node) {
  return "Wave Out";
}

function nodeGraphModuleScopeCaptureMonitors(patch = nodeGraphMvp?.patch) {
  const monitors = normalizeNodeGraphPatchMonitors(patch?.monitors, patch);
  return monitors.length ? monitors : nodeGraphDefaultModuleScopeMonitors(patch);
}

function nodeGraphModuleScopeHasModelDisplay() {
  return nodeGraphModuleScopeSlots().some((slot) =>
    slot.type === "clock" ||
    nodeGraphModuleScopeIsOscillatorType(slot.type) ||
    (slot.type === "visualOscilloscope" && (
      nodeGraphModuleScopeConnectionsTo(slot.nodeId, "In").length > 0 ||
      nodeGraphModuleScopeConnectionsTo(slot.nodeId, "X").length > 0 ||
      nodeGraphModuleScopeConnectionsTo(slot.nodeId, "Y").length > 0
    )) ||
    (slot.type === "gain" && nodeGraphModuleScopeConnectionsTo(slot.nodeId, "In").length > 0) ||
    (slot.type === "output" && nodeGraphModuleScopeOutputConnectionList(
      nodeGraphModuleScopeOutputInputConnections(slot.nodeId),
    ).length > 0));
}

function nodeGraphModuleScopeHasRenderableSlots() {
  return nodeGraphModuleScopeSlots().some((slot) => slot?.scopeElement);
}

function resetNodeGraphModuleScopeFrameClocks() {
  nodeGraphModuleScopeState.modelFrameTimes.clear();
  nodeGraphModuleScopeState.clockPhasors.clear();
  nodeGraphModuleScopeState.scanPhasors.clear();
  nodeGraphModuleScopeState.phosphorFrame = {
    key: "",
    lastUpdate: 0,
  };
}

function clearNodeGraphModuleScopeBuffers() {
  if (nodeGraphModuleScopeState.drawFrame) {
    window.cancelAnimationFrame(nodeGraphModuleScopeState.drawFrame);
    nodeGraphModuleScopeState.drawFrame = 0;
  }
  if (nodeGraphModuleScopeState.drawFrameWatchdog) {
    window.clearTimeout(nodeGraphModuleScopeState.drawFrameWatchdog);
    nodeGraphModuleScopeState.drawFrameWatchdog = 0;
  }
  if (nodeGraphModuleScopeState.drawFrameHeartbeat) {
    window.clearInterval(nodeGraphModuleScopeState.drawFrameHeartbeat);
    nodeGraphModuleScopeState.drawFrameHeartbeat = 0;
  }
  nodeGraphModuleScopeState.buffers.clear();
  nodeGraphModuleScopeState.traceDisplayDrawCache.clear();
  nodeGraphModuleScopeState.traceDisplayScratch.clear();
  nodeGraphModuleScopeState.lightDisplayStates.clear();
  nodeGraphModuleScopeState.scanHistories.clear();
  nodeGraphModuleScopeState.frames = 0;
  nodeGraphModuleScopeState.monitorFingerprint = "";
  nodeGraphModuleScopeState.mode = "";
  resetNodeGraphModuleScopeFrameClocks();
  nodeGraphModuleScopeState.oscillatorPhasors.clear();
  nodeGraphModuleScopeState.patchFingerprint = "";
  nodeGraphModuleScopeState.sampleRate = 0;
  nodeGraphModuleScopeState.animationLastTime = 0;
  nodeGraphModuleScopeState.animationTime = 0;
  nodeGraphModuleScopeState.animationDeltaSeconds = 0;
  setNodeGraphModuleScopesEnabled(false);
  clearNodeGraphModuleScopeCanvas();
}

function clearNodeGraphRenderedModuleScopeBuffers() {
  if (nodeGraphModuleScopeState.mode === "live") {
    return;
  }
  if (nodeGraphModuleScopeHasModelDisplay()) {
    nodeGraphModuleScopeState.buffers.clear();
    nodeGraphModuleScopeState.traceDisplayDrawCache.clear();
    nodeGraphModuleScopeState.traceDisplayScratch.clear();
    nodeGraphModuleScopeState.frames = 0;
    nodeGraphModuleScopeState.monitorFingerprint = "";
    nodeGraphModuleScopeState.mode = "model";
    nodeGraphModuleScopeState.patchFingerprint = nodeGraphPatchFingerprint();
    nodeGraphModuleScopeState.sampleRate = nodeGraphMvp.sampleRate || 44100;
    scheduleNodeGraphModuleScopeDraw();
    return;
  }
  clearNodeGraphModuleScopeBuffers();
}

function nodeGraphMonitorEndpointKey(endpoint) {
  return `${endpoint?.node || ""}.${endpoint?.io || ""}.${endpoint?.port || endpoint?.param || ""}`;
}

function nodeGraphMonitorEndpointFromElement(element) {
  if (!element) {
    return null;
  }
  if (element.classList?.contains("node-io-row")) {
    return {
      io: String(element.dataset.io || ""),
      node: String(element.dataset.node || ""),
      port: String(element.dataset.port || ""),
    };
  }
  if (element.classList?.contains("modulation-input")) {
    return {
      io: "modulation",
      node: String(element.dataset.node || ""),
      port: String(element.dataset.param || element.dataset.port || ""),
    };
  }
  if (element.classList?.contains("node-port")) {
    return {
      io: String(element.dataset.io || ""),
      node: String(element.dataset.node || ""),
      port: String(element.dataset.port || ""),
    };
  }
  return null;
}

function nodeGraphMonitorEndpointIsValid(endpoint, nodes = []) {
  const node = nodes.find((candidate) => candidate.id === endpoint?.node);
  const definition = nodeGraphModuleDefinitions[node?.type];
  if (!node || !definition || !endpoint?.port) {
    return false;
  }
  if (endpoint.io === "modulation") {
    return (definition.parameters || []).some((parameter) => parameter.key === endpoint.port);
  }
  if (endpoint.io === "input") {
    return nodeGraphPatchNodeInputPorts(node).includes(nodeGraphCanonicalInputPort(node.type, endpoint.port));
  }
  if (endpoint.io === "output") {
    return nodeGraphPatchNodeOutputPorts(node).includes(nodeGraphCanonicalOutputPort(node.type, endpoint.port));
  }
  return false;
}

function normalizeNodeGraphPatchMonitors(monitors = [], patch = nodeGraphMvp?.patch) {
  const nodes = Array.isArray(patch?.nodes) ? patch.nodes : [];
  const normalized = [];
  const seen = new Set();
  for (const monitor of Array.isArray(monitors) ? monitors : []) {
    const endpoint = {
      io: String(monitor?.io || ""),
      node: String(monitor?.node || ""),
      port: String(monitor?.port || monitor?.param || ""),
    };
    if (!nodeGraphMonitorEndpointIsValid(endpoint, nodes)) {
      continue;
    }
    const key = nodeGraphMonitorEndpointKey(endpoint);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(endpoint);
  }
  return normalized;
}

function nodeGraphMonitorPortSelector(endpoint) {
  if (endpoint?.io === "modulation") {
    return nodeGraphModulationPortSelector(endpoint.node, endpoint.port);
  }
  return nodeGraphPortSelector(endpoint.node, endpoint.port, endpoint.io);
}

function syncNodeGraphMonitorIndicators(patch = nodeGraphMvp?.patch) {
  const workspace = nodeGraphZoomSurface?.();
  if (!workspace || !patch) {
    return;
  }
  const monitors = normalizeNodeGraphPatchMonitors(patch.monitors, patch);
  nodeGraphModuleScopeState.monitors = monitors;
  for (const port of workspace.querySelectorAll(".node-port, .node-param-port")) {
    port.classList.remove("monitored-port");
    port.removeAttribute("data-monitor-state");
  }
  for (const monitor of monitors) {
    const element = workspace.querySelector(nodeGraphMonitorPortSelector(monitor));
    element?.classList.add("monitored-port");
    element?.setAttribute("data-monitor-state", "active");
  }
  scheduleNodeGraphModuleScopeDraw();
}

function toggleNodeGraphMonitorForPort(port) {
  const endpoint = nodeGraphMonitorEndpointFromElement(port);
  if (!endpoint || !nodeGraphMonitorEndpointIsValid(endpoint, nodeGraphMvp.patch.nodes)) {
    return false;
  }
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const monitors = normalizeNodeGraphPatchMonitors(patch.monitors, patch);
  const key = nodeGraphMonitorEndpointKey(endpoint);
  const nextMonitors = monitors.filter((monitor) => nodeGraphMonitorEndpointKey(monitor) !== key);
  const enabled = nextMonitors.length === monitors.length;
  if (enabled) {
    nextMonitors.push(endpoint);
  }
  patch.monitors = nextMonitors;
  commitNodeGraphPatch(patch, {
    status: enabled ? "monitor added" : "monitor removed",
  });
  return true;
}

function toggleNodeGraphMonitorFromPortEvent(event) {
  if (event.button !== 0 || !event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }
  if (toggleNodeGraphMonitorForPort(event.currentTarget)) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }
}

function beginNodeGraphRenderedScopeCapture(options = {}) {
  const patch = options.patch || nodeGraphMvp?.patch;
  const monitors = nodeGraphModuleScopeCaptureMonitors(patch);
  const frames = Math.max(0, Math.floor(Number(options.frames) || 0));
  if (!monitors.length || frames <= 0) {
    clearNodeGraphModuleScopeBuffers();
    return null;
  }

  const groups = new Map();
  for (const monitor of monitors) {
    const group = groups.get(monitor.node) || [];
    group.push(monitor);
    groups.set(monitor.node, group);
  }

  const buffers = new Map(
    [...groups.keys()].map((nodeId) => [nodeId, new Float32Array(frames)]),
  );
  return {
    buffers,
    frames,
    groups,
    monitorFingerprint: nodeGraphModuleScopeMonitorFingerprint(monitors),
    patchFingerprint: String(options.patchFingerprint || ""),
    sampleRate: Number(options.sampleRate) || 0,
  };
}

function nodeGraphRenderedScopeMonitorValue(
  monitor,
  runtime,
  frameValues,
  frame,
  frames,
) {
  if (monitor.io === "output") {
    return readNodeGraphRuntimePortOutput(
      runtime,
      frameValues,
      monitor.node,
      monitor.port,
      frame,
      frames,
    );
  }
  if (monitor.io === "input") {
    return (runtime.inputConnections?.get(`${monitor.node}.${monitor.port}`) || [])
      .reduce((sum, connection) => sum + readNodeGraphRuntimePortOutput(
        runtime,
        frameValues,
        connection.sourceNode,
        connection.sourcePort,
        frame,
        frames,
      ), 0);
  }
  if (monitor.io === "modulation") {
    return (runtime.modulationConnections?.get(nodeGraphParameterKey(monitor.node, monitor.port)) || [])
      .reduce((sum, modulation) => sum + clampNodeSliderValue(readNodeGraphRuntimePortOutput(
        runtime,
        frameValues,
        modulation.sourceNode,
        modulation.sourcePort,
        frame,
        frames,
      ), 0, 1), 0);
  }
  return 0;
}

function captureNodeGraphRenderedScopeFrame(
  capture,
  runtime,
  frameValues,
  bufferFrame,
  evaluationFrame,
  evaluationFrames,
) {
  if (!capture) {
    return;
  }
  for (const [nodeId, monitors] of capture.groups) {
    const buffer = capture.buffers.get(nodeId);
    if (!buffer || bufferFrame < 0 || bufferFrame >= buffer.length) {
      continue;
    }
    const sum = monitors.reduce(
      (total, monitor) => total + nodeGraphRenderedScopeMonitorValue(
        monitor,
        runtime,
        frameValues,
        evaluationFrame,
        evaluationFrames,
      ),
      0,
    );
    buffer[bufferFrame] = sum / Math.max(1, monitors.length);
  }
}

function finishNodeGraphRenderedScopeCapture(capture) {
  if (!capture) {
    return;
  }
  nodeGraphModuleScopeState.buffers = capture.buffers;
  nodeGraphModuleScopeState.traceDisplayDrawCache.clear();
  nodeGraphModuleScopeState.traceDisplayScratch.clear();
  nodeGraphModuleScopeState.frames = capture.frames;
  nodeGraphModuleScopeState.monitorFingerprint = capture.monitorFingerprint;
  nodeGraphModuleScopeState.mode = "rendered";
  nodeGraphModuleScopeState.patchFingerprint = capture.patchFingerprint;
  nodeGraphModuleScopeState.sampleRate = capture.sampleRate;
  scheduleNodeGraphModuleScopeDraw();
}

function nodeGraphLiveModuleScopeFrameCapacity(options = {}) {
  return Math.max(
    32,
    Math.floor(Number(options.frames) || 0),
    nodeGraphModuleScopeState.liveFrameCapacity,
  );
}

function nodeGraphLiveModuleScopeFingerprint(plan = {}) {
  const ids = Array.isArray(plan.order) && plan.order.length
    ? plan.order
    : (Array.isArray(plan.nodes) ? plan.nodes.map((node) => node.id) : []);
  return ids.map((id) => String(id || "")).filter(Boolean).sort().join("|");
}

function beginNodeGraphLiveModuleScopeCapture(plan = {}, options = {}) {
  const ids = Array.isArray(plan.order) && plan.order.length
    ? plan.order
    : (Array.isArray(plan.nodes) ? plan.nodes.map((node) => node.id) : []);
  const frameCapacity = nodeGraphLiveModuleScopeFrameCapacity({ ...options, patch: options.patch || nodeGraphMvp?.patch });
  nodeGraphModuleScopeState.buffers = new Map(
    ids
      .map((id) => String(id || ""))
      .filter(Boolean)
      .map((id) => [id, new Float32Array(frameCapacity)]),
  );
  nodeGraphModuleScopeState.traceDisplayDrawCache.clear();
  nodeGraphModuleScopeState.traceDisplayScratch.clear();
  nodeGraphModuleScopeState.frames = frameCapacity;
  nodeGraphModuleScopeState.monitorFingerprint = nodeGraphLiveModuleScopeFingerprint(plan);
  nodeGraphModuleScopeState.mode = "live";
  nodeGraphModuleScopeState.patchFingerprint = String(plan.patchFingerprint || nodeGraphPatchFingerprint());
  nodeGraphModuleScopeState.sampleRate = Number(options.sampleRate) || 0;
  scheduleNodeGraphModuleScopeDraw();
}

function updateNodeGraphLiveModuleScopeFingerprint(patchFingerprint = nodeGraphPatchFingerprint()) {
  if (nodeGraphModuleScopeState.mode !== "live") {
    return;
  }
  const fingerprint = String(patchFingerprint || "");
  if (!fingerprint || nodeGraphModuleScopeState.patchFingerprint === fingerprint) {
    return;
  }
  nodeGraphModuleScopeState.patchFingerprint = fingerprint;
}

function nodeGraphModuleScopeScalarValue(value) {
  const readNumber = (candidate) => {
    const number = Number(candidate);
    if (!Number.isFinite(number) || Number.isNaN(number)) {
      return null;
    }
    return number;
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

function nodeGraphModuleScopeNodeForSlot(slot) {
  return (Array.isArray(nodeGraphMvp?.patch?.nodes) ? nodeGraphMvp.patch.nodes : [])
    .find((node) => node.id === slot?.nodeId) || null;
}

function nodeGraphModuleScopeNodeParam(node, key, fallback) {
  const value = Number(node?.params?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function nodeGraphModuleScopeAdvanceFixedFrameClock(state, now, fps) {
  const normalizedFps = normalizeNodeGraphModuleScopeFramesPerSecond(fps);
  if (normalizedFps <= 0) {
    const lastUpdate = Number(state?.lastUpdate);
    const stateTime = Number(state?.time);
    return {
      ready: false,
      steps: 0,
      lastUpdate: Number.isFinite(lastUpdate) ? lastUpdate : now,
      time: Number.isFinite(stateTime) ? stateTime : now,
    };
  }
  const frameDuration = 1 / normalizedFps;
  const lastUpdate = Number(state?.lastUpdate);
  const stateTime = Number(state?.time);
  if (!Number.isFinite(lastUpdate) || lastUpdate <= 0 || now <= lastUpdate) {
    return {
      ready: true,
      steps: 1,
      lastUpdate: now,
      time: Number.isFinite(stateTime) ? stateTime : now,
    };
  }
  const elapsed = now - lastUpdate;
  const resyncDuration = Math.max(0.5, frameDuration * 4);
  if (elapsed > resyncDuration) {
    return {
      ready: true,
      steps: 1,
      lastUpdate: now,
      time: now,
    };
  }
  if (elapsed + frameDuration * 0.05 < frameDuration) {
    return {
      ready: false,
      steps: 0,
      lastUpdate,
      time: Number.isFinite(stateTime) ? stateTime : lastUpdate,
    };
  }
  const steps = Math.max(1, Math.floor((elapsed + frameDuration * 0.05) / frameDuration));
  const nextLastUpdate = lastUpdate + steps * frameDuration;
  const nextTime = (Number.isFinite(stateTime) ? stateTime : lastUpdate) + steps * frameDuration;
  return {
    ready: true,
    steps,
    lastUpdate: nextLastUpdate,
    time: nextTime,
  };
}

function nodeGraphModuleScopeModelFrameTime(slot) {
  const nodeId = String(slot?.nodeId || "");
  if (!nodeId) {
    return Math.max(0, Number(nodeGraphModuleScopeState.animationTime) || 0);
  }
  const fps = normalizeNodeGraphModuleScopeFramesPerSecond(nodeGraphMvp?.moduleScopeFramesPerSecond ?? 60);
  if (fps <= 0) {
    return false;
  }
  const now = Math.max(0, Number(nodeGraphModuleScopeState.animationTime) || 0);
  const state = nodeGraphModuleScopeState.modelFrameTimes.get(nodeId);
  if (!state) {
    const initialState = {
      lastUpdate: now,
      time: now,
    };
    nodeGraphModuleScopeState.modelFrameTimes.set(nodeId, initialState);
    return initialState.time;
  }
  const tick = nodeGraphModuleScopeAdvanceFixedFrameClock(state, now, fps);
  if (tick.ready) {
    state.lastUpdate = tick.lastUpdate;
    state.time = tick.time;
  }
  nodeGraphModuleScopeState.modelFrameTimes.set(nodeId, state);
  return state.time;
}

function nodeGraphModuleScopeVisualDisplayTime(slot) {
  if (slot?.type === "visualOscilloscope") {
    return Math.max(0, Number(nodeGraphModuleScopeState.animationTime) || 0);
  }
  return nodeGraphModuleScopeModelFrameTime(slot);
}

function nodeGraphModuleScopeNodeMap() {
  return new Map((Array.isArray(nodeGraphMvp?.patch?.nodes) ? nodeGraphMvp.patch.nodes : [])
    .map((node) => [node.id, node]));
}

function nodeGraphModuleScopeConnectionsTo(nodeId, port = "In") {
  return (Array.isArray(nodeGraphMvp?.patch?.connections) ? nodeGraphMvp.patch.connections : [])
    .filter((connection) => connection.destinationNode === nodeId && connection.destinationPort === port);
}

function nodeGraphModuleScopeStableSeed(text) {
  let seed = 0x12345678;
  for (const character of String(text)) {
    seed = (Math.imul(seed ^ character.charCodeAt(0), 16777619)) >>> 0;
  }
  return seed || 0x12345678;
}

function nodeGraphModuleScopeAdvanceNoiseSeed(seed, steps) {
  let delta = Math.max(0, Math.floor(Number(steps) || 0)) >>> 0;
  let accumulatedMultiplier = 1;
  let accumulatedIncrement = 0;
  let currentMultiplier = 1664525;
  let currentIncrement = 1013904223;
  while (delta > 0) {
    if (delta & 1) {
      accumulatedMultiplier = Math.imul(accumulatedMultiplier, currentMultiplier) >>> 0;
      accumulatedIncrement = (Math.imul(accumulatedIncrement, currentMultiplier) + currentIncrement) >>> 0;
    }
    currentIncrement = (Math.imul(currentMultiplier + 1, currentIncrement)) >>> 0;
    currentMultiplier = Math.imul(currentMultiplier, currentMultiplier) >>> 0;
    delta >>>= 1;
  }
  return (Math.imul(accumulatedMultiplier, seed >>> 0) + accumulatedIncrement) >>> 0;
}

function nodeGraphModuleScopeNoiseSeedToSample(seed) {
  return ((seed >>> 0) / 0xffffffff) * 2 - 1;
}

function nodeGraphModuleScopeNoiseSeedKey(nodeId, seedValue, channel = "") {
  const seed = Math.max(0, Math.min(99999, Math.floor(Number(seedValue) || 0)));
  return `${nodeId}${channel ? `:${channel}` : ""}:seed:${seed}`;
}

function nodeGraphModuleScopeNoiseHoldSample(nodeId, seedValue, speed, sampleIndex, sampleRate) {
  const safeSampleRate = Math.max(1, Number(sampleRate) || nodeGraphMvp.sampleRate || 44100);
  const safeSpeed = clampNodeSliderValue(Number(speed) || 0, 0, 1);
  const clockRate = safeSpeed * safeSampleRate * 0.5;
  const holdIndex = clockRate > 0
    ? Math.floor(Math.max(0, Number(sampleIndex) || 0) / Math.max(1, safeSampleRate / clockRate))
    : 0;
  const seed = nodeGraphModuleScopeAdvanceNoiseSeed(
    nodeGraphModuleScopeStableSeed(nodeGraphModuleScopeNoiseSeedKey(nodeId, seedValue)),
    holdIndex + 1,
  );
  return nodeGraphModuleScopeNoiseSeedToSample(seed);
}

function nodeGraphModuleScopeLinearToDb(value) {
  const amplitude = Math.abs(Number(value) || 0);
  return amplitude > 0.000001 ? 20 * Math.log10(amplitude) : -Infinity;
}

function nodeGraphModuleScopeFormatDb(value) {
  return Number.isFinite(value) ? `${value >= 0 ? "+" : ""}${value.toFixed(1)} dB` : "-inf dB";
}

function nodeGraphModuleScopeBufferStats(buffer) {
  if (!buffer?.length) {
    return {
      peak: 0,
      peakDb: -Infinity,
      rms: 0,
      rmsDb: -Infinity,
    };
  }
  let peak = 0;
  let sumSquares = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    const sample = Number(buffer[index]) || 0;
    const magnitude = Math.abs(sample);
    peak = Math.max(peak, magnitude);
    sumSquares += sample * sample;
  }
  const rms = Math.sqrt(sumSquares / buffer.length);
  return {
    peak,
    peakDb: nodeGraphModuleScopeLinearToDb(peak),
    rms,
    rmsDb: nodeGraphModuleScopeLinearToDb(rms),
  };
}

function renderNodeGraphModuleScopeAnalyzer(slot, buffer = null) {
  const analyzer = slot?.scopeElement?.querySelector?.(".node-module-scope-analyzer");
  if (!analyzer) {
    return;
  }
  analyzer.classList.toggle("gain-scope-analyzer", slot?.type === "gain");
  const metrics = buffer?.nodeGraphScopeAnalyzer;
  if (!metrics) {
    analyzer.hidden = true;
    analyzer.textContent = "";
    return;
  }
  analyzer.hidden = false;
  const rows = [
    ["gain", metrics.gainDb],
    metrics.inputRmsDb === undefined ? null : ["in", metrics.inputRmsDb],
    ["pk", metrics.peakDb],
    ["rms", metrics.rmsDb],
  ].filter(Boolean);
  analyzer.replaceChildren(
    ...rows.map(([label, value]) => {
      const item = document.createElement("span");
      item.dataset.scopeMetric = label;
      item.textContent = `${label} ${nodeGraphModuleScopeFormatDb(value)}`;
      return item;
    }),
  );
}

function nodeGraphModuleScopeOfflineSourceFrequency(nodeId, nodeMap = nodeGraphModuleScopeNodeMap(), visited = new Set()) {
  if (!nodeId || visited.has(nodeId)) {
    return 0;
  }
  visited.add(nodeId);
  const node = nodeMap.get(nodeId);
  if (!node) {
    return 0;
  }
  if (nodeGraphModuleScopeIsOscillatorType(node.type)) {
    const baseFrequency = Math.max(0, nodeGraphModuleScopeNodeParam(node, "frequency", 0));
    const pitchInput = clampNodeSliderValue(
      nodeGraphModuleScopeConnectionsTo(node.id, "0.1V/Oct")
        .reduce((sum, connection) => sum + nodeGraphModuleScopeOfflineSignalSample(
          { nodeMap },
          connection.sourceNode,
          0,
          0,
          connection.sourcePort,
          1,
        ), 0),
      -1,
      1,
    );
    return Math.max(0, baseFrequency * (2 ** (pitchInput / 0.1)));
  }
  if (node.type === "clock") {
    return Math.max(0, nodeGraphModuleScopeNodeParam(node, "rate", 0));
  }
  if (node.type === "gain" || node.type === "bias") {
    return Math.max(
      0,
      ...nodeGraphModuleScopeConnectionsTo(node.id, "In")
        .map((connection) => nodeGraphModuleScopeOfflineSourceFrequency(connection.sourceNode, nodeMap, visited)),
    );
  }
  return 0;
}

function nodeGraphModuleScopeOfflineSignalSample(context, nodeId, localTime, sampleIndex, port = "Out", depth = 0) {
  if (!context || !nodeId || depth > 16) {
    return 0;
  }
  const node = context.nodeMap.get(nodeId);
  if (!node) {
    return 0;
  }
  if (nodeGraphModuleScopeIsOscillatorType(node.type)) {
    const waveformByPort = {
      Saw: 0,
      Ramp: 1,
      Square: 2,
      Tri: 3,
      Sine: 4,
    };
    const waveform = Object.hasOwn(waveformByPort, port)
      ? waveformByPort[port]
      : nodeGraphModuleScopeNodeParam(node, "waveform", 0);
    const baseFrequency = Math.max(0, nodeGraphModuleScopeNodeParam(node, "frequency", 0));
    const pitchInput = clampNodeSliderValue(
      nodeGraphModuleScopeConnectionsTo(node.id, "0.1V/Oct")
        .reduce((sum, connection) => sum + nodeGraphModuleScopeOfflineSignalSample(
          context,
          connection.sourceNode,
          localTime,
          sampleIndex,
          connection.sourcePort,
          depth + 1,
        ), 0),
      -1,
      1,
    );
    const frequency = Math.max(0, baseFrequency * (2 ** (pitchInput / 0.1)));
    const phase = wrapNodeSliderValue(nodeGraphModuleScopeNodeParam(node, "phase", 0), 0, 1);
    const level = nodeGraphModuleScopeNodeParam(node, "level", 0.5);
    const phasor = nodeGraphModuleScopeOscillatorPhasor(
      { nodeId: node.id },
      frequency,
      1,
      nodeGraphModuleScopeModelFrameTime({ nodeId: node.id }),
    );
    const displayFrame = Number(context.zeroFrequencyDisplayFrame);
    const displayFrames = Math.max(1, Number(context.zeroFrequencyDisplayFrames) || 1);
    const displayCycles = Math.max(0.125, Number(context.zeroFrequencyDisplayCycles) || 1);
    const zeroFrequencyDisplayPhase = Number.isFinite(displayFrame)
      ? (displayFrame / Math.max(1, displayFrames - 1)) * displayCycles
      : 0;
    const scopeStartTime = Number(context.scopeStartTime);
    const elapsedTime = Math.max(
      0,
      localTime - (Number.isFinite(scopeStartTime) ? scopeStartTime : localTime),
    );
    const signalPhase = (Number(phasor.signal) || 0) +
      (frequency > 0 ? elapsedTime * frequency : zeroFrequencyDisplayPhase);
    return nodeGraphModuleScopeOfflineOscillatorSample(waveform, phase + signalPhase) * level;
  }
  if (nodeGraphModuleScopeIsAdditiveType(node.type)) {
    const baseFrequency = Math.max(0, nodeGraphModuleScopeNodeParam(node, "frequency", 0));
    const pitchInput = clampNodeSliderValue(
      nodeGraphModuleScopeConnectionsTo(node.id, "0.1V/Oct")
        .reduce((sum, connection) => sum + nodeGraphModuleScopeOfflineSignalSample(
          context,
          connection.sourceNode,
          localTime,
          sampleIndex,
          connection.sourcePort,
          depth + 1,
        ), 0),
      -1,
      1,
    );
    const frequency = Math.max(0, baseFrequency * (2 ** (pitchInput / 0.1)));
    const phase = wrapNodeSliderValue(nodeGraphModuleScopeNodeParam(node, "phase", 0), 0, 1);
    const phasor = nodeGraphModuleScopeOscillatorPhasor(
      { nodeId: node.id },
      frequency,
      1,
      nodeGraphModuleScopeModelFrameTime({ nodeId: node.id }),
    );
    const scopeStartTime = Number(context.scopeStartTime);
    const elapsedTime = Math.max(
      0,
      localTime - (Number.isFinite(scopeStartTime) ? scopeStartTime : localTime),
    );
    const signalPhase = (Number(phasor.signal) || 0) + elapsedTime * frequency;
    return nodeGraphAdditiveOscillatorSample(
      null,
      node.id,
      (phase + signalPhase) * Math.PI * 2,
      {
        frequency,
        harmonics: nodeGraphModuleScopeNodeParam(node, "harmonics", 32),
        level: nodeGraphModuleScopeNodeParam(node, "level", 0.35),
        modA: nodeGraphModuleScopeNodeParam(node, "modA", 0.5),
        waveform: nodeGraphModuleScopeNodeParam(node, "waveform", 1),
      },
      Number(nodeGraphModuleScopeState.sampleRate) || nodeGraphMvp.sampleRate || 44100,
    );
  }
  if (node.type === "noise") {
    const level = clampNodeSliderValue(nodeGraphModuleScopeNodeParam(node, "level", 0.5), 0, 1);
    const seedValue = nodeGraphModuleScopeNodeParam(node, "seed", 1);
    const speed = nodeGraphModuleScopeNodeParam(node, "speed", 1);
    const sampleRate = Number(nodeGraphModuleScopeState.sampleRate) || nodeGraphMvp.sampleRate || 44100;
    return nodeGraphModuleScopeNoiseHoldSample(node.id, seedValue, speed, sampleIndex, sampleRate) * level;
  }
  if (node.type === "clock") {
    const rate = Math.max(0, nodeGraphModuleScopeNodeParam(node, "rate", 0));
    const duty = clampNodeSliderValue(nodeGraphModuleScopeNodeParam(node, "duty", 0.5), 0, 1);
    const level = clampNodeSliderValue(nodeGraphModuleScopeNodeParam(node, "level", 1), 0, 1);
    const sampleRate = Number(nodeGraphModuleScopeState.sampleRate) || nodeGraphMvp.sampleRate || 44100;
    const phase = nodeGraphModuleScopeClockPhaseAt(context, node.id, rate, localTime);
    if (port === "Analog Out") {
      return nodeGraphModuleScopeClockAnalogMonitorSample(phase, level);
    }
    if (port === "Pulse") {
      return rate > 0 && phase < Math.min(1, rate / Math.max(1, sampleRate)) ? level : 0;
    }
    return duty > 0 && level > 0 && phase < duty ? level : 0;
  }
  const input = nodeGraphModuleScopeConnectionsTo(node.id, "In")
    .reduce((sum, connection) => sum + nodeGraphModuleScopeOfflineSignalSample(
      context,
      connection.sourceNode,
      localTime,
      sampleIndex,
      connection.sourcePort,
      depth + 1,
    ), 0);
  if (node.type === "gain") {
    return input * nodeGraphModuleScopeNodeParam(node, "amount", 1);
  }
  if (node.type === "bias") {
    return input + nodeGraphModuleScopeNodeParam(node, "offset", 0);
  }
  return 0;
}

function nodeGraphModuleScopeOfflineOscillatorSample(waveform, phaseCycle) {
  const cycle = wrapNodeSliderValue(phaseCycle, 0, 1);
  switch (Math.round(Number(waveform) || 0)) {
    case 1:
      return cycle < 0.5 ? 1 : -1;
    case 2:
      return cycle < 0.5 ? (cycle * 4 - 1) : (3 - cycle * 4);
    case 3:
      return Math.sin(cycle * Math.PI * 2);
    case 4:
      return Math.tanh(
        Math.sin((cycle * 17.13 + 0.17) * Math.PI * 2) * 0.62 +
        Math.sin((cycle * 37.71 + 0.41) * Math.PI * 2) * 0.38 +
        Math.sin((cycle * 73.19 + 0.73) * Math.PI * 2) * 0.24,
      );
    case 0:
    default:
      return 1 - cycle * 2;
  }
}

function nodeGraphModuleScopeClockPhasor(slot, rate, modelTime = nodeGraphModuleScopeModelFrameTime(slot)) {
  const nodeId = String(slot?.nodeId || "");
  const now = Math.max(0, Number(modelTime) || 0);
  const safeRate = Math.max(0, Number(rate) || 0);
  let phasor = nodeGraphModuleScopeState.clockPhasors.get(nodeId);
  if (!phasor) {
    const phase = wrapNodeSliderValue(now * safeRate, 0, 1);
    phasor = {
      lastTime: now,
      phase,
      previousPhase: phase,
      previousTime: now,
      rate: safeRate,
      renderTime: -1,
      turns: 0,
    };
    nodeGraphModuleScopeState.clockPhasors.set(nodeId, phasor);
  }
  if (phasor.renderTime === now) {
    phasor.rate = safeRate;
    return phasor;
  }

  const lastTime = Math.max(0, Number(phasor.lastTime) || now);
  const advanceRate = Math.max(0, Number(phasor.rate) || 0);
  if (now < lastTime) {
    const phase = wrapNodeSliderValue((Number(phasor.phase) || 0) - advanceRate * (lastTime - now), 0, 1);
    return {
      ...phasor,
      phase,
      previousPhase: phase,
      previousTime: now,
      rate: safeRate,
      turns: 0,
    };
  }
  const dt = clampNodeSliderValue(now - lastTime, 0, 0.25);
  const previousPhase = Number(phasor.phase) || 0;
  if (dt > 0 && advanceRate > 0) {
    phasor.phase = wrapNodeSliderValue(previousPhase + advanceRate * dt, 0, 1);
  }
  phasor.previousPhase = previousPhase;
  phasor.previousTime = lastTime;
  phasor.rate = safeRate;
  phasor.lastTime = now;
  phasor.renderTime = now;
  phasor.turns = Math.max(0, advanceRate * dt);
  return phasor;
}

function nodeGraphModuleScopeClockPhaseAt(context, nodeId, rate, localTime) {
  const safeRate = Math.max(0, Number(rate) || 0);
  const safeTime = Math.max(0, Number(localTime) || 0);
  if (!context.clockPhaseAnchors) {
    context.clockPhaseAnchors = new Map();
  }
  const key = String(nodeId || "");
  let anchor = context.clockPhaseAnchors.get(key);
  if (!anchor) {
    const scopeStartTime = Number(context.scopeStartTime);
    const anchorTime = Number.isFinite(scopeStartTime) ? Math.max(0, scopeStartTime) : safeTime;
    const phasor = nodeGraphModuleScopeClockPhasor({ nodeId: key }, safeRate, anchorTime);
    anchor = {
      phase: Number(phasor.phase) || 0,
      rate: safeRate,
      time: anchorTime,
    };
    context.clockPhaseAnchors.set(key, anchor);
  }
  return wrapNodeSliderValue(
    (Number(anchor.phase) || 0) + Math.max(0, safeTime - (Number(anchor.time) || safeTime)) * safeRate,
    0,
    1,
  );
}

function nodeGraphModuleScopeOscillatorPhasor(slot, frequency, cycles, modelTime = nodeGraphModuleScopeModelFrameTime(slot)) {
  const nodeId = String(slot?.nodeId || "");
  const now = Math.max(0, Number(modelTime) || 0);
  const safeFrequency = Math.max(0, Number(frequency) || 0);
  const safeCycles = Math.max(1e-6, Number(cycles) || 1);
  let phasor = nodeGraphModuleScopeState.oscillatorPhasors.get(nodeId);
  if (!phasor) {
    phasor = {
      frequency: safeFrequency,
      lastTime: now,
      previousSweep: 0,
      renderTime: -1,
      signal: 0,
      sweep: 0,
      sweepDelta: 0,
    };
    nodeGraphModuleScopeState.oscillatorPhasors.set(nodeId, phasor);
  }
  if (phasor.renderTime === now) {
    phasor.frequency = safeFrequency;
    return phasor;
  }

  const dt = clampNodeSliderValue(now - (Number(phasor.lastTime) || now), 0, 0.25);
  const previousSweep = Number(phasor.sweep) || 0;
  phasor.previousSweep = previousSweep;
  phasor.sweepDelta = 0;
  const advanceFrequency = Math.max(0, Number(phasor.frequency) || 0);
  if (dt > 0 && advanceFrequency > 0) {
    const cycleDelta = advanceFrequency * dt;
    const sweepDelta = cycleDelta / safeCycles;
    phasor.signal = wrapNodeSliderValue((Number(phasor.signal) || 0) + cycleDelta, 0, 1);
    phasor.sweep = wrapNodeSliderValue(previousSweep + sweepDelta, 0, 1);
    phasor.sweepDelta = sweepDelta;
  }
  phasor.frequency = safeFrequency;
  phasor.lastTime = now;
  phasor.renderTime = now;
  return phasor;
}

function nodeGraphModuleScopeOfflineOscillatorBuffer(slot) {
  if (!nodeGraphModuleScopeIsOscillatorType(slot?.type)) {
    return null;
  }
  const node = nodeGraphModuleScopeNodeForSlot(slot);
  if (!node) {
    return null;
  }
  const waveform = nodeGraphModuleScopeNodeParam(node, "waveform", 0);
  const baseFrequency = Math.max(0, nodeGraphModuleScopeNodeParam(node, "frequency", 0));
  const nodeMap = nodeGraphModuleScopeNodeMap();
  const pitchInput = clampNodeSliderValue(
    nodeGraphModuleScopeConnectionsTo(node.id, "0.1V/Oct")
      .reduce((sum, connection) => sum + nodeGraphModuleScopeOfflineSignalSample(
        { nodeMap },
        connection.sourceNode,
        0,
        0,
        connection.sourcePort,
        1,
      ), 0),
    -1,
    1,
  );
  const frequency = Math.max(0, baseFrequency * (2 ** (pitchInput / 0.1)));
  const phase = wrapNodeSliderValue(nodeGraphModuleScopeNodeParam(node, "phase", 0), 0, 1);
  const level = nodeGraphModuleScopeNodeParam(node, "level", 0.5);
  const settings = nodeGraphModuleScopeEffectiveSettingForSlot(slot);
  const requestedCycles = nodeGraphModuleScopeEffectiveCycles(settings) || nodeGraphModuleScopeDefaultSettings.cycles;
  const visibleCycles = requestedCycles;
  const sweepCycles = visibleCycles;
  const phasor = nodeGraphModuleScopeOscillatorPhasor(
    slot,
    frequency,
    sweepCycles,
    nodeGraphModuleScopeModelFrameTime(slot),
  );
  const sweepPhase = sweepCycles > 0 ? Number(phasor.sweep) || 0 : 0;
  const windowStartPhase = settings.oscillatorTraceMode === "window"
    ? phase + (Number(phasor.signal) || 0) - (settings.sync ? sweepPhase * visibleCycles : 0)
    : phase;
  const frames = 2048;
  const buffer = new Float32Array(frames);
  for (let index = 0; index < frames; index += 1) {
    const progress = index / Math.max(1, frames - 1);
    const phaseCycle = windowStartPhase + progress * visibleCycles;
    buffer[index] = clampNodeSliderValue(
      nodeGraphModuleScopeOfflineOscillatorSample(waveform, phaseCycle) * level,
      -1,
      1,
    );
  }
  buffer.nodeGraphScopeDrawFullWindow = true;
  buffer.nodeGraphScopeDrawProgress = 1;
  buffer.nodeGraphScopeDrawStartProgress = 0;
  buffer.nodeGraphScopeDrawWrap = false;
  buffer.nodeGraphScopeUseFullWindow = true;
  return buffer;
}

function nodeGraphModuleScopeOfflineAdditiveOscillatorBuffer(slot) {
  if (!nodeGraphModuleScopeIsAdditiveType(slot?.type)) {
    return null;
  }
  const node = nodeGraphModuleScopeNodeForSlot(slot);
  if (!node) {
    return null;
  }
  const baseFrequency = Math.max(0, nodeGraphModuleScopeNodeParam(node, "frequency", 0));
  const nodeMap = nodeGraphModuleScopeNodeMap();
  const pitchInput = clampNodeSliderValue(
    nodeGraphModuleScopeConnectionsTo(node.id, "0.1V/Oct")
      .reduce((sum, connection) => sum + nodeGraphModuleScopeOfflineSignalSample(
        { nodeMap },
        connection.sourceNode,
        0,
        0,
        connection.sourcePort,
        1,
      ), 0),
    -1,
    1,
  );
  const frequency = Math.max(0, baseFrequency * (2 ** (pitchInput / 0.1)));
  const sampleRate = Number(nodeGraphModuleScopeState.sampleRate) || nodeGraphMvp.sampleRate || 44100;
  const harmonicCount = Math.max(
    1,
    Math.min(nodeGraphAdditiveHardMaxHarmonics, Math.round(nodeGraphModuleScopeNodeParam(node, "harmonics", 32))),
  );
  const dampingFilterFrequency = nodeGraphAdditiveFilterFrequencyValue(nodeGraphModuleScopeNodeParam(node, "dampingFilterFrequency", 20000), sampleRate);
  const dampingGraphConnection = (nodeGraphMvp.patch.graphConnections || []).find(
    (connection) =>
      connection.destinationNode === node.id &&
      connection.destinationGraphInput === "Damping Graph",
  );
  const dampingGraphNode = dampingGraphConnection
    ? nodeGraphMvp.patch.nodes.find((candidate) => candidate.id === dampingGraphConnection.sourceNode && nodeGraphModuleIsGraphType(candidate.type))
    : null;
  const dampingGraphKey = dampingGraphNode?.graph
    ? JSON.stringify(dampingGraphNode.graph)
    : "neutral";
  const cacheKey = [
    slot.nodeId,
    frequency.toFixed(6),
    harmonicCount,
    dampingFilterFrequency.toFixed(6),
    dampingGraphConnection?.sourceNode || "",
    dampingGraphKey,
    Math.round(sampleRate),
  ].join(":");
  const cached = nodeGraphModuleScopeState.additiveHarmonicProfiles.get(slot.nodeId);
  if (cached?.key === cacheKey) {
    return cached.buffer;
  }
  const amplitudes = new Float32Array(harmonicCount);
  for (let harmonic = 1; harmonic <= harmonicCount; harmonic += 1) {
    const harmonicRatio = harmonicCount > 1
      ? (harmonic - 1) / (harmonicCount - 1)
      : 0;
    const filterRatio = frequency > 0
      ? clampNodeSliderValue((harmonic * frequency) / dampingFilterFrequency, 0, 1)
      : harmonicRatio;
    const amplitude = dampingGraphNode?.graph
        ? nodeGraphGraphValueAt(nodeGraphGraphForNode(dampingGraphNode), filterRatio, nodeGraphGraphSmoothingModeForNode(dampingGraphNode))
        : 1;
    amplitudes[harmonic - 1] = amplitude;
  }
  const buffer = new Float32Array(harmonicCount);
  for (let index = 0; index < harmonicCount; index += 1) {
    buffer[index] = clampNodeSliderValue(amplitudes[index], 0, 1);
  }
  buffer.nodeGraphScopeSpectrum = true;
  buffer.nodeGraphScopeDrawFullWindow = true;
  buffer.nodeGraphScopeDrawProgress = 1;
  buffer.nodeGraphScopeMinPointSpacingPx = 1;
  buffer.nodeGraphScopeVisualPointLimit = Math.min(32768, Math.max(2, harmonicCount * 2));
  buffer.nodeGraphScopeUseFullWindow = true;
  buffer.nodeGraphScopePeriodSamples = 0;
  buffer.nodeGraphScopeSourceFrequency = frequency;
  nodeGraphModuleScopeState.additiveHarmonicProfiles.set(slot.nodeId, { buffer, key: cacheKey });
  return buffer;
}

function nodeGraphModuleScopeOfflineNoiseBuffer(slot) {
  if (slot?.type !== "noise") {
    return null;
  }
  const node = nodeGraphModuleScopeNodeForSlot(slot);
  if (!node) {
    return null;
  }
  const level = clampNodeSliderValue(nodeGraphModuleScopeNodeParam(node, "level", 0.5), 0, 1);
  const seedValue = nodeGraphModuleScopeNodeParam(node, "seed", 1);
  const speed = nodeGraphModuleScopeNodeParam(node, "speed", 1);
  const sampleRate = Number(nodeGraphModuleScopeState.sampleRate) || nodeGraphMvp.sampleRate || 44100;
  const frames = 2048;
  const currentSample = Math.max(0, Math.floor(nodeGraphModuleScopeModelFrameTime(slot) * sampleRate));
  const startSample = Math.max(0, currentSample - frames);
  const buffer = new Float32Array(frames);
  for (let index = 0; index < frames; index += 1) {
    buffer[index] = clampNodeSliderValue(
      nodeGraphModuleScopeNoiseHoldSample(slot.nodeId, seedValue, speed, startSample + index, sampleRate) * level,
      -1,
      1,
    );
  }
  buffer.nodeGraphScopeDrawProgress = 1;
  buffer.nodeGraphScopeMinPointSpacingPx = 0.5;
  buffer.nodeGraphScopeVisualPointLimit = 16384;
  buffer.nodeGraphScopeUseFullWindow = true;
  return buffer;
}

function nodeGraphModuleScopeOfflineStereoNoiseXyBuffer(slot) {
  if (slot?.type !== "stereoNoise") {
    return null;
  }
  const node = nodeGraphModuleScopeNodeForSlot(slot);
  if (!node) {
    return null;
  }
  const level = clampNodeSliderValue(nodeGraphModuleScopeNodeParam(node, "level", 0.5), 0, 1);
  const seedValue = nodeGraphModuleScopeNodeParam(node, "seed", 1);
  const sampleRate = Number(nodeGraphModuleScopeState.sampleRate) || nodeGraphMvp.sampleRate || 44100;
  const startSample = Math.max(0, Math.floor(nodeGraphModuleScopeModelFrameTime(slot) * sampleRate));
  const frames = nodeGraphModuleScopeXyTraceFrameCount(16384);
  const stride = 8;
  const historySamples = frames * stride;
  const historyStartSample = Math.max(0, startSample - historySamples);
  const x = new Float32Array(frames);
  const y = new Float32Array(frames);
  let leftSeed = nodeGraphModuleScopeAdvanceNoiseSeed(
    nodeGraphModuleScopeStableSeed(nodeGraphModuleScopeNoiseSeedKey(slot.nodeId, seedValue, "left")),
    historyStartSample,
  );
  let rightSeed = nodeGraphModuleScopeAdvanceNoiseSeed(
    nodeGraphModuleScopeStableSeed(nodeGraphModuleScopeNoiseSeedKey(slot.nodeId, seedValue, "right")),
    historyStartSample,
  );
  for (let index = 0; index < frames; index += 1) {
    leftSeed = nodeGraphModuleScopeAdvanceNoiseSeed(leftSeed, stride);
    rightSeed = nodeGraphModuleScopeAdvanceNoiseSeed(rightSeed, stride);
    x[index] = clampNodeSliderValue(nodeGraphModuleScopeNoiseSeedToSample(leftSeed) * level, -1, 1);
    y[index] = clampNodeSliderValue(nodeGraphModuleScopeNoiseSeedToSample(rightSeed) * level, -1, 1);
  }
  return {
    length: frames,
    nodeGraphScopeDrawProgress: 1,
    nodeGraphScopeUseFullWindow: true,
    nodeGraphScopeVisualPointLimit: frames,
    nodeGraphScopeXy: true,
    x,
    y,
  };
}

function nodeGraphModuleScopeCapturedCurrentLightTarget(capturedBuffer) {
  if (!capturedBuffer?.length) {
    return null;
  }
  for (let index = capturedBuffer.length - 1; index >= 0; index -= 1) {
    const sample = Number(capturedBuffer[index]);
    if (Number.isFinite(sample)) {
      return clampNodeSliderValue(Math.abs(sample), 0, 1);
    }
  }
  return null;
}

function nodeGraphModuleScopeCapturedFrameLightTarget(capturedBuffer) {
  if (!capturedBuffer?.length) {
    return null;
  }
  let sum = 0;
  let count = 0;
  for (let index = 0; index < capturedBuffer.length; index += 1) {
    const sample = Number(capturedBuffer[index]);
    if (!Number.isFinite(sample)) {
      continue;
    }
    sum += Math.abs(sample);
    count += 1;
  }
  return count > 0 ? clampNodeSliderValue(sum / count, 0, 1) : null;
}

function nodeGraphModuleScopeCapturedGateLightTarget(capturedBuffer) {
  if (!capturedBuffer?.length) {
    return null;
  }
  let previousState = null;
  let transitions = 0;
  for (let index = 0; index < capturedBuffer.length; index += 1) {
    const sample = Number(capturedBuffer[index]);
    if (!Number.isFinite(sample)) {
      continue;
    }
    const state = Math.abs(sample) >= 0.5;
    if (previousState !== null && state !== previousState) {
      transitions += 1;
    }
    previousState = state;
    if (transitions > 2) {
      return nodeGraphModuleScopeCapturedFrameLightTarget(capturedBuffer);
    }
  }
  return nodeGraphModuleScopeCapturedCurrentLightTarget(capturedBuffer);
}

function nodeGraphModuleScopeCapturedPulseLightTarget(capturedBuffer) {
  if (!capturedBuffer?.length) {
    return null;
  }
  let peak = 0;
  for (let index = 0; index < capturedBuffer.length; index += 1) {
    const sample = Number(capturedBuffer[index]);
    if (Number.isFinite(sample)) {
      peak = Math.max(peak, Math.abs(sample));
    }
  }
  return clampNodeSliderValue(peak, 0, 1);
}

function nodeGraphModuleScopeCapturedBufferForSlot(slot) {
  const nodeId = String(slot?.nodeId || "");
  if (!nodeId) {
    return null;
  }
  if (slot?.type === "scope2d") {
    return nodeGraphModuleScopeCapturedScope2dBuffer(slot);
  }
  if (["traceDisplay", "dotOscilloscope", "valueOscilloscope", "lineBurnOscilloscope"].includes(slot?.type)) {
    return nodeGraphModuleScopeState.buffers.get(`${nodeId}:In`) || null;
  }
  const selectedPort = nodeGraphModuleScopeShaderOutputPortForSlot(slot);
  if (selectedPort) {
    const selectedBuffer = nodeGraphModuleScopeState.buffers.get(`${nodeId}:${selectedPort}`);
    if (selectedBuffer?.length) {
      return selectedBuffer;
    }
  }
  return nodeGraphModuleScopeState.buffers.get(nodeId) || null;
}

const nodeGraphTraceDisplaySettingsDefaults = Object.freeze({
  brightness: 0.92,
  color: "#75ebff",
  dot2Brightness: 0.18,
  dot2Color: "#184fff",
  dot2LineThickness: 4,
  cycles: 2,
  lineThickness: 1.4,
  padding: 0,
  skipSamples: 1,
  sourceSync: true,
  zoomSeconds: 0.05,
});

const nodeGraphTraceDisplayRenderPointBudget = 4096;

function normalizeNodeGraphTraceDisplayColor(value, fallback = nodeGraphTraceDisplaySettingsDefaults.color) {
  const color = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color.toLowerCase();
  }
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    const [, r, g, b] = color.toLowerCase();
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
}

function normalizeNodeGraphTraceDisplayNumber(value, fallback, min, max, integer = false) {
  const number = Number(value);
  const safeFallback = Number.isFinite(Number(fallback)) ? Number(fallback) : 0;
  const safeMin = Number.isFinite(Number(min)) ? Number(min) : -Infinity;
  const safeMax = Number.isFinite(Number(max)) ? Number(max) : Infinity;
  const normalized = Number.isFinite(number)
    ? Math.max(safeMin, Math.min(safeMax, number))
    : Math.max(safeMin, Math.min(safeMax, safeFallback));
  return integer ? Math.round(normalized) : normalized;
}

function normalizeNodeGraphTraceDisplaySkipSamples(value) {
  const number = Number(value);
  return Number.isFinite(number) ? clampNodeSliderValue(Math.round(number), 0, 2) : 1;
}

function normalizeNodeGraphTraceDisplaySettings(settings = {}) {
  const source = settings && typeof settings === "object" ? settings : {};
  const defaults = nodeGraphTraceDisplaySettingsDefaults;
  const legacyWindowMs = source.windowMs === undefined ? undefined : Number(source.windowMs) / 1000;
  const zoomSeconds = source.zoomSeconds ?? source.windowSeconds ?? legacyWindowMs;
  return {
    brightness: normalizeNodeGraphTraceDisplayNumber(
      source.brightness ?? source.dot1Brightness,
      defaults.brightness,
      -Infinity,
      Infinity,
    ),
    color: normalizeNodeGraphTraceDisplayColor(source.color ?? source.dot1Color, defaults.color),
    dot2Brightness: normalizeNodeGraphTraceDisplayNumber(
      source.dot2Brightness,
      defaults.dot2Brightness,
      -Infinity,
      Infinity,
    ),
    dot2Color: normalizeNodeGraphTraceDisplayColor(source.dot2Color, defaults.dot2Color),
    dot2LineThickness: normalizeNodeGraphTraceDisplayNumber(
      source.dot2LineThickness,
      defaults.dot2LineThickness,
      -Infinity,
      Infinity,
    ),
    cycles: normalizeNodeGraphTraceDisplayNumber(source.cycles, defaults.cycles, -Infinity, Infinity),
    lineThickness: normalizeNodeGraphTraceDisplayNumber(source.lineThickness, defaults.lineThickness, -Infinity, Infinity),
    padding: normalizeNodeGraphTraceDisplayNumber(source.padding, defaults.padding, -Infinity, Infinity),
    skipSamples: normalizeNodeGraphTraceDisplaySkipSamples(source.skipSamples ?? defaults.skipSamples),
    sourceSync: source.sourceSync !== false,
    zoomSeconds: normalizeNodeGraphTraceDisplayNumber(zoomSeconds, defaults.zoomSeconds, -Infinity, Infinity),
  };
}

function nodeGraphTraceDisplaySettingsForNode(node) {
  if (!node) {
    return normalizeNodeGraphTraceDisplaySettings();
  }
  const popover = document.getElementById("nodeTraceDisplaySettingsPopover");
  if (
    popover &&
    !popover.hidden &&
    nodeGraphMvp.traceDisplaySettingsTargetNode === node.id &&
    nodeGraphMvp.traceDisplaySettingsDraft
  ) {
    return normalizeNodeGraphTraceDisplaySettings(nodeGraphMvp.traceDisplaySettingsDraft);
  }
  return normalizeNodeGraphTraceDisplaySettings(node.traceDisplaySettings);
}

function nodeGraphGlobalTraceSettings() {
  const popover = document.getElementById("nodeTraceDisplaySettingsPopover");
  if (
    popover &&
    !popover.hidden &&
    nodeGraphTraceDisplaySettingsEditingGlobal() &&
    nodeGraphMvp.traceDisplaySettingsDraft
  ) {
    return normalizeNodeGraphTraceDisplaySettings(nodeGraphMvp.traceDisplaySettingsDraft);
  }
  return normalizeNodeGraphTraceDisplaySettings(nodeGraphMvp?.traceSettings);
}

function nodeGraphTraceDisplaySettingsEditingGlobal() {
  return nodeGraphMvp?.traceDisplaySettingsTargetNode === "__globalTraceSettings";
}

function nodeGraphModuleDisplayTypeForType(type) {
  const declared = nodeGraphModuleDefinitions?.[type]?.displayType;
  if (["trace", "clock", "dot", "value", "lineBurn", "scope2d"].includes(declared)) {
    return declared;
  }
  if (type === "traceDisplay" || type === "audioPlayer") {
    return "trace";
  }
  if (type === "clock") {
    return "clock";
  }
  return "legacy";
}

function nodeGraphModuleDisplayTypeForSlot(slot) {
  return nodeGraphModuleDisplayTypeForType(slot?.type);
}

function nodeGraphTraceDisplaySettingsForSlot(slot) {
  if (nodeGraphModuleDisplayTypeForSlot(slot) === "trace" && slot?.type !== "traceDisplay") {
    return nodeGraphGlobalTraceSettings();
  }
  return nodeGraphTraceDisplaySettingsForNode(nodeGraphModuleScopeNodeForSlot(slot));
}

function prepareNodeGraphTraceDisplayBuffer(buffer, settings = nodeGraphTraceDisplaySettingsDefaults) {
  if (!buffer?.length) {
    return buffer;
  }
  const traceSettings = normalizeNodeGraphTraceDisplaySettings(settings);
  buffer.nodeGraphScopeDrawFullWindow = true;
  buffer.nodeGraphScopeDrawProgress = 1;
  buffer.nodeGraphScopeDrawStartProgress = 0;
  buffer.nodeGraphScopeDrawWrap = false;
  buffer.nodeGraphScopeHoldPoint = false;
  buffer.nodeGraphScopeDiscontinuitySkipSamples = traceSettings.skipSamples;
  buffer.nodeGraphScopeTracePadding = traceSettings.padding;
  buffer.nodeGraphScopeMinPointSpacingPx = 0.5;
  buffer.nodeGraphScopeVisualPointLimit = nodeGraphTraceDisplayRenderPointBudget;
  buffer.nodeGraphScopeScanTrail = false;
  buffer.nodeGraphScopeUseFullWindow = true;
  return buffer;
}

function nodeGraphModuleScopeClockCapturedLightTarget(slot, capturedBuffer) {
  if (!capturedBuffer?.length) {
    return null;
  }
  const selectedPort = nodeGraphModuleScopeShaderOutputPortForSlot(slot);
  if (selectedPort === "Analog Out") {
    return nodeGraphModuleScopeCapturedCurrentLightTarget(capturedBuffer);
  }
  if (selectedPort === "Pulse") {
    return nodeGraphModuleScopeCapturedPulseLightTarget(capturedBuffer);
  }
  return nodeGraphModuleScopeCapturedGateLightTarget(capturedBuffer);
}

function nodeGraphModuleScopeClockAnalogMonitorSample(phase, level) {
  const p = clampNodeSliderValue(Number(phase) || 0, 0, 1);
  const attack = 1 - Math.pow(1 - Math.min(1, p / 0.035), 4);
  const release = Math.pow(Math.max(0, 1 - p), 1.85);
  const snapEnvelope = attack * release;
  const sweepTurns = (3.15 * (1 - Math.exp(-4.2 * p)) / (1 - Math.exp(-4.2))) + (0.18 * Math.sin(Math.PI * p));
  const liquidBend = 0.075 * Math.sin(Math.PI * 2 * p) * Math.pow(Math.max(0, 1 - p), 1.2);
  const body = Math.sin((sweepTurns + liquidBend) * Math.PI * 2);
  const sheen = Math.sin((sweepTurns * 2.02 + 0.17) * Math.PI * 2) * 0.16 * Math.pow(Math.max(0, 1 - p), 2.8);
  return (body + sheen) * snapEnvelope * level;
}

function nodeGraphModuleScopeClockMonitorTargetAtPhase(slot, node, phase, duty, level) {
  const port = nodeGraphModuleScopeShaderOutputPortForSlot(slot) || "Digital Out";
  const safePhase = clampNodeSliderValue(Number(phase) || 0, 0, 1);
  const safeLevel = clampNodeSliderValue(Number(level) || 0, 0, 1);
  if (port === "Analog Out") {
    return clampNodeSliderValue(Math.abs(nodeGraphModuleScopeClockAnalogMonitorSample(safePhase, safeLevel)), 0, 1);
  }
  if (port === "Pulse") {
    const rate = Math.max(0, nodeGraphModuleScopeNodeParam(node, "rate", 0));
    const frameWindow = Math.max(1 / 120, Number(nodeGraphModuleScopeState.animationDeltaSeconds) || (1 / 60));
    return rate > 0 && safePhase < Math.min(1, rate * frameWindow) ? safeLevel : 0;
  }
  return duty > 0 && safeLevel > 0 && safePhase < duty ? safeLevel : 0;
}

function nodeGraphModuleScopeClockGateFrameBrightness(previousPhase, turns, duty, level) {
  const safeDuty = clampNodeSliderValue(Number(duty) || 0, 0, 1);
  const safeLevel = clampNodeSliderValue(Number(level) || 0, 0, 1);
  if (safeDuty <= 0 || safeLevel <= 0) {
    return 0;
  }
  if (safeDuty >= 1) {
    return safeLevel;
  }
  const start = wrapNodeSliderValue(Number(previousPhase) || 0, 0, 1);
  const span = Math.max(0, Number(turns) || 0);
  if (span <= 0) {
    return start < safeDuty ? safeLevel : 0;
  }
  let remaining = span;
  let phase = start;
  let onDuration = 0;
  let guard = 0;
  while (remaining > 1e-9 && guard < 8) {
    guard += 1;
    if (phase <= 1e-9 && remaining >= 1) {
      const fullCycles = Math.floor(remaining);
      onDuration += fullCycles * safeDuty;
      remaining -= fullCycles;
      continue;
    }
    const segmentDuration = Math.min(remaining, 1 - phase);
    const segmentEnd = phase + segmentDuration;
    onDuration += Math.max(0, Math.min(segmentEnd, safeDuty) - Math.max(phase, 0));
    remaining -= segmentDuration;
    phase = 0;
  }
  return clampNodeSliderValue((onDuration / span) * safeLevel, 0, 1);
}

function nodeGraphModuleScopeClockPulseFrameBrightness(previousPhase, turns, rate, level) {
  const safeLevel = clampNodeSliderValue(Number(level) || 0, 0, 1);
  const safeRate = Math.max(0, Number(rate) || 0);
  const span = Math.max(0, Number(turns) || 0);
  if (safeLevel <= 0 || safeRate <= 0 || span <= 0) {
    return 0;
  }
  const start = wrapNodeSliderValue(Number(previousPhase) || 0, 0, 1);
  const pulseCount = Math.max(0, Math.floor(start + span));
  if (pulseCount <= 0) {
    return 0;
  }
  const sampleRate = Math.max(1, Number(nodeGraphModuleScopeState.sampleRate) || nodeGraphMvp.sampleRate || 44100);
  const frameSeconds = span / safeRate;
  const pulseSeconds = pulseCount / sampleRate;
  return clampNodeSliderValue((pulseSeconds / Math.max(1 / sampleRate, frameSeconds)) * safeLevel, 0, 1);
}

function nodeGraphModuleScopeClockAnalogFrameBrightness(previousPhase, turns, level) {
  const safeLevel = clampNodeSliderValue(Number(level) || 0, 0, 1);
  if (safeLevel <= 0) {
    return 0;
  }
  const span = Math.max(0, Number(turns) || 0);
  if (span <= 0) {
    return clampNodeSliderValue(Math.abs(
      nodeGraphModuleScopeClockAnalogMonitorSample(previousPhase, safeLevel),
    ), 0, 1);
  }
  const cycleSpan = span >= 1 ? 1 : span;
  const startPhase = span >= 1 ? 0 : wrapNodeSliderValue(Number(previousPhase) || 0, 0, 1);
  const samples = Math.max(4, Math.min(128, Math.ceil(cycleSpan * 96) + 4));
  let sum = 0;
  for (let index = 0; index < samples; index += 1) {
    const t = samples <= 1 ? 0 : index / (samples - 1);
    const phase = wrapNodeSliderValue(startPhase + cycleSpan * t, 0, 1);
    sum += Math.abs(nodeGraphModuleScopeClockAnalogMonitorSample(phase, safeLevel));
  }
  return clampNodeSliderValue(sum / samples, 0, 1);
}

function nodeGraphModuleScopeClockMonitorTarget(slot, node, phasor, duty, level) {
  const port = nodeGraphModuleScopeShaderOutputPortForSlot(slot) || "Digital Out";
  const previousPhase = Number(phasor?.previousPhase);
  const fallbackPhase = Number(phasor?.phase) || 0;
  const frameStartPhase = Number.isFinite(previousPhase) ? previousPhase : fallbackPhase;
  const turns = Math.max(0, Number(phasor?.turns) || 0);
  if (turns <= 0) {
    return nodeGraphModuleScopeClockMonitorTargetAtPhase(slot, node, fallbackPhase, duty, level);
  }
  if (port === "Analog Out") {
    return nodeGraphModuleScopeClockAnalogFrameBrightness(frameStartPhase, turns, level);
  }
  if (port === "Pulse") {
    return nodeGraphModuleScopeClockPulseFrameBrightness(frameStartPhase, turns, nodeGraphModuleScopeNodeParam(node, "rate", 0), level);
  }
  return nodeGraphModuleScopeClockGateFrameBrightness(frameStartPhase, turns, duty, level);
}

function nodeGraphModuleScopeOfflineClockBlinkBuffer(slot, capturedBuffer = null) {
  if (slot?.type !== "clock") {
    return null;
  }
  const node = nodeGraphModuleScopeNodeForSlot(slot);
  if (!node) {
    return null;
  }
  const rate = Math.max(0, nodeGraphModuleScopeNodeParam(node, "rate", 0));
  const duty = clampNodeSliderValue(nodeGraphModuleScopeNodeParam(node, "duty", 0.5), 0, 1);
  const level = clampNodeSliderValue(nodeGraphModuleScopeNodeParam(node, "level", 1), 0, 1);
  const phasor = nodeGraphModuleScopeClockPhasor(
    slot,
    rate,
    nodeGraphModuleScopeModelFrameTime(slot),
  );
  const modelTarget = nodeGraphModuleScopeClockMonitorTarget(slot, node, phasor, duty, level);
  const capturedTarget = nodeGraphModuleScopeClockCapturedLightTarget(slot, capturedBuffer);
  return {
    length: 1,
    nodeGraphScopeFrameBrightness: true,
    nodeGraphScopeEventFrameTurns: Math.max(0, Number(phasor.turns) || 0),
    nodeGraphScopeLightDisplay: true,
    nodeGraphScopeLightInstant: true,
    nodeGraphScopeLightReleaseSeconds: 0.006,
    nodeGraphScopeLightShape: nodeGraphModuleScopeSetting(slot.nodeId).blinkLightShape,
    nodeGraphScopeLightTarget: capturedTarget ?? (Number.isFinite(modelTarget) ? modelTarget : 0),
  };
}

function nodeGraphModuleScopeOfflineLedBuffer(slot, capturedBuffer = null) {
  if (slot?.type !== "led") {
    return null;
  }
  const node = nodeGraphModuleScopeNodeForSlot(slot);
  const led = normalizeNodeGraphLedLayout(node?.led);
  return {
    length: 1,
    nodeGraphScopeLightDisplay: true,
    nodeGraphScopeLightBaseRatio: 0.78,
    nodeGraphScopeLightCenterColor: nodeGraphLedCenterColor,
    nodeGraphScopeLightCenterAlphaScale: 1,
    nodeGraphScopeLightCenterMinRatio: 0.42,
    nodeGraphScopeLightOuterAlphaScale: 1,
    nodeGraphScopeLightOuterColor: led.color,
    nodeGraphScopeLightInstant: true,
    nodeGraphScopeLightShape: "circle",
    nodeGraphScopeLightTarget: nodeGraphModuleScopeCapturedCurrentLightTarget(capturedBuffer) ?? 0,
  };
}

function nodeGraphModuleScopeDotOscilloscopeLightBuffer(capturedBuffer = null) {
  if (!capturedBuffer?.length) {
    return null;
  }
  capturedBuffer.nodeGraphScopeFrameBrightness = true;
  capturedBuffer.nodeGraphScopeLightBaseRatio = 0.82;
  capturedBuffer.nodeGraphScopeLightDisplay = true;
  capturedBuffer.nodeGraphScopeLightInstant = true;
  capturedBuffer.nodeGraphScopeLightReleaseSeconds = 0.018;
  capturedBuffer.nodeGraphScopeLightShape = "circle";
  capturedBuffer.nodeGraphScopeLightTarget =
    nodeGraphModuleScopeCapturedFrameLightTarget(capturedBuffer) ??
    nodeGraphModuleScopeCapturedCurrentLightTarget(capturedBuffer) ??
    0;
  return capturedBuffer;
}

function nodeGraphModuleScopeOfflineGainAnalyzerBuffer(slot) {
  if (slot?.type !== "gain") {
    return null;
  }
  const node = nodeGraphModuleScopeNodeForSlot(slot);
  if (!node || !nodeGraphModuleScopeConnectionsTo(node.id, "In").length) {
    return null;
  }
  const settings = nodeGraphModuleScopeEffectiveSettingForSlot(slot);
  const sampleRate = Number(nodeGraphModuleScopeState.sampleRate) || nodeGraphMvp.sampleRate || 44100;
  const nodeMap = nodeGraphModuleScopeNodeMap();
  const sourceFrequency = nodeGraphModuleScopeOfflineSourceFrequency(node.id, nodeMap);
  const cycles = nodeGraphModuleScopeEffectiveCycles(settings) || nodeGraphModuleScopeDefaultSettings.cycles;
  const windowSeconds = sourceFrequency > 0
    ? cycles / sourceFrequency
    : Math.max(0.005, (settings.timeMs || nodeGraphModuleScopeDefaultSettings.timeMs) / 1000);
  const time = nodeGraphModuleScopeModelFrameTime(slot);
  const startTime = time;
  const frames = 2048;
  const buffer = new Float32Array(frames);
  const inputBuffer = new Float32Array(frames);
  const context = {
    nodeMap,
    scopeStartTime: startTime,
    zeroFrequencyDisplayCycles: sourceFrequency > 0 ? 0 : cycles,
    zeroFrequencyDisplayFrames: frames,
  };
  const amount = nodeGraphModuleScopeNodeParam(node, "amount", 1);
  const inputConnections = nodeGraphModuleScopeConnectionsTo(node.id, "In");
  for (let index = 0; index < frames; index += 1) {
    const progress = index / Math.max(1, frames - 1);
    const localTime = startTime + progress * windowSeconds;
    const sampleIndex = Math.floor(localTime * sampleRate);
    context.zeroFrequencyDisplayFrame = sourceFrequency > 0 ? null : index;
    inputBuffer[index] = inputConnections.reduce((sum, connection) => sum + nodeGraphModuleScopeOfflineSignalSample(
      context,
      connection.sourceNode,
      localTime,
      sampleIndex,
      connection.sourcePort,
      1,
    ), 0);
    buffer[index] = inputBuffer[index];
  }
  const inputStats = nodeGraphModuleScopeBufferStats(inputBuffer);
  buffer.nodeGraphScopeDrawProgress = 1;
  buffer.nodeGraphScopeAnalyzer = {
    gainDb: nodeGraphModuleScopeLinearToDb(amount),
    inputPeakDb: inputStats.peakDb,
    inputRmsDb: inputStats.rmsDb,
    ...nodeGraphModuleScopeBufferStats(buffer),
  };
  buffer.nodeGraphScopePeriodSamples = sourceFrequency > 0 ? frames / cycles : 0;
  buffer.nodeGraphScopeCurrentSamplePosition = 0;
  buffer.nodeGraphScopeSourceFrequency = sourceFrequency;
  buffer.nodeGraphScopeSyncBuffer = buffer;
  return buffer;
}

function nodeGraphModuleScopeXyTraceFrameCount(length) {
  const safeLength = Math.max(2, Math.floor(Number(length) || 0));
  return safeLength;
}

function nodeGraphModuleScopeCapturedXyTraceFrameCount(slot, length) {
  const frames = nodeGraphModuleScopeXyTraceFrameCount(length);
  return slot?.type === "audioPlayer"
    ? Math.min(frames, 256)
    : frames;
}

function nodeGraphModuleScopeOutputInputConnections(nodeId) {
  return {
    Mono: nodeGraphModuleScopeConnectionsTo(nodeId, "Mono"),
    Left: nodeGraphModuleScopeConnectionsTo(nodeId, "Left"),
    Right: nodeGraphModuleScopeConnectionsTo(nodeId, "Right"),
  };
}

function nodeGraphModuleScopeOutputConnectionList(inputConnections) {
  return [
    ...(inputConnections?.Mono || []),
    ...(inputConnections?.Left || []),
    ...(inputConnections?.Right || []),
  ];
}

function nodeGraphModuleScopeOfflineConnectionsSourceFrequency(connections, nodeMap) {
  return Math.max(
    0,
    ...(connections || [])
      .map((connection) => nodeGraphModuleScopeOfflineSourceFrequency(connection.sourceNode, nodeMap)),
  );
}

function nodeGraphModuleScopeOfflineConnectionSum(context, connections, localTime, sampleIndex) {
  return (connections || []).reduce((sum, connection) => sum + nodeGraphModuleScopeOfflineSignalSample(
    context,
    connection.sourceNode,
    localTime,
    sampleIndex,
    connection.sourcePort,
    1,
  ), 0);
}

function nodeGraphModuleScopeOfflineVisualOscilloscopeBuffer(slot) {
  if (slot?.type !== "visualOscilloscope") {
    return null;
  }
  const node = nodeGraphModuleScopeNodeForSlot(slot);
  if (!node) {
    return null;
  }
  const nodeMap = nodeGraphModuleScopeNodeMap();
  const inConnections = nodeGraphModuleScopeConnectionsTo(node.id, "In");
  const xConnections = nodeGraphModuleScopeConnectionsTo(node.id, "X");
  const yConnections = nodeGraphModuleScopeConnectionsTo(node.id, "Y");
  const hasSignalInput = inConnections.length || xConnections.length || yConnections.length;
  if (!hasSignalInput) {
    return null;
  }
  const sampleRate = Number(nodeGraphModuleScopeState.sampleRate) || nodeGraphMvp.sampleRate || 44100;
  const settings = nodeGraphModuleScopeEffectiveSettingForSlot(slot);
  const sourceFrequency = nodeGraphModuleScopeOfflineConnectionsSourceFrequency(
    [...inConnections, ...xConnections, ...yConnections],
    nodeMap,
  );
  const cycles = nodeGraphModuleScopeEffectiveCycles(settings) || nodeGraphModuleScopeDefaultSettings.cycles;
  const windowSeconds = sourceFrequency > 0
    ? cycles / sourceFrequency
    : Math.max(0.005, (settings.timeMs || nodeGraphModuleScopeDefaultSettings.timeMs) / 1000);
  const frames = 2048;
  const time = nodeGraphModuleScopeVisualDisplayTime(slot);
  const context = {
    nodeMap,
    scopeStartTime: time,
    zeroFrequencyDisplayCycles: sourceFrequency > 0 ? 0 : cycles,
    zeroFrequencyDisplayFrames: frames,
  };
  const shader = nodeGraphModuleScopeShaderConfigForSlot(slot);
  if (shader.mode === "x_y") {
    const x = new Float32Array(frames);
    const y = new Float32Array(frames);
    const useLinearX = !xConnections.length;
    const ySourceConnections = yConnections.length ? yConnections : inConnections;
    for (let index = 0; index < frames; index += 1) {
      const progress = index / Math.max(1, frames - 1);
      const localTime = time + progress * windowSeconds;
      const sampleIndex = Math.floor(localTime * sampleRate);
      context.zeroFrequencyDisplayFrame = sourceFrequency > 0 ? null : index;
      x[index] = useLinearX
        ? progress * 2 - 1
        : nodeGraphModuleScopeOfflineConnectionSum(context, xConnections, localTime, sampleIndex);
      y[index] = nodeGraphModuleScopeOfflineConnectionSum(context, ySourceConnections, localTime, sampleIndex);
    }
    return {
      length: frames,
      nodeGraphScopeAnalyzer: nodeGraphModuleScopeBufferStats(y),
      nodeGraphScopeDrawProgress: 1,
      nodeGraphScopeSourceFrequency: sourceFrequency,
      nodeGraphScopeUseFullWindow: true,
      nodeGraphScopeVisualPointLimit: frames,
      nodeGraphScopeXy: true,
      x,
      y,
    };
  }
  const buffer = new Float32Array(frames);
  const sourceConnections = inConnections.length ? inConnections : (yConnections.length ? yConnections : xConnections);
  for (let index = 0; index < frames; index += 1) {
    const progress = index / Math.max(1, frames - 1);
    const localTime = time + progress * windowSeconds;
    const sampleIndex = Math.floor(localTime * sampleRate);
    context.zeroFrequencyDisplayFrame = sourceFrequency > 0 ? null : index;
    buffer[index] = nodeGraphModuleScopeOfflineConnectionSum(context, sourceConnections, localTime, sampleIndex);
  }
  buffer.nodeGraphScopeAnalyzer = nodeGraphModuleScopeBufferStats(buffer);
  buffer.nodeGraphScopeDrawProgress = 1;
  buffer.nodeGraphScopePeriodSamples = sourceFrequency > 0 ? frames / cycles : 0;
  buffer.nodeGraphScopeSourceFrequency = sourceFrequency;
  buffer.nodeGraphScopeSyncBuffer = buffer;
  buffer.nodeGraphScopeUseFullWindow = true;
  return buffer;
}

function nodeGraphModuleScopeOfflineInputDisplayBuffer(slot) {
  if (!["dotOscilloscope", "valueOscilloscope", "lineBurnOscilloscope", "traceDisplay"].includes(slot?.type)) {
    return null;
  }
  const node = nodeGraphModuleScopeNodeForSlot(slot);
  if (!node) {
    return null;
  }
  const inputConnections = nodeGraphModuleScopeConnectionsTo(node.id, "In");
  if (!inputConnections.length) {
    return null;
  }
  const nodeMap = nodeGraphModuleScopeNodeMap();
  const sampleRate = Number(nodeGraphModuleScopeState.sampleRate) || nodeGraphMvp.sampleRate || 44100;
  const sourceFrequency = nodeGraphModuleScopeOfflineConnectionsSourceFrequency(inputConnections, nodeMap);
  const settings = slot?.type === "traceDisplay"
    ? nodeGraphTraceDisplaySettingsForSlot(slot)
    : nodeGraphTraceDisplaySettingsDefaults;
  const zoomSeconds = Math.max(0.001, Number(settings.zoomSeconds) || Number(settings.windowSeconds) || 0.05);
  const windowSeconds = sourceFrequency > 0
    ? Math.max(zoomSeconds, 1 / sourceFrequency)
    : zoomSeconds;
  const frames = slot?.type === "dotOscilloscope" || slot?.type === "valueOscilloscope"
    ? 256
    : 2048;
  const time = nodeGraphModuleScopeVisualDisplayTime(slot);
  const buffer = new Float32Array(frames);
  const context = {
    nodeMap,
    scopeStartTime: time,
    zeroFrequencyDisplayCycles: sourceFrequency > 0 ? 0 : 1,
    zeroFrequencyDisplayFrames: frames,
  };
  for (let index = 0; index < frames; index += 1) {
    const progress = index / Math.max(1, frames - 1);
    const localTime = time + progress * windowSeconds;
    const sampleIndex = Math.floor(localTime * sampleRate);
    context.zeroFrequencyDisplayFrame = sourceFrequency > 0 ? null : index;
    buffer[index] = nodeGraphModuleScopeOfflineConnectionSum(context, inputConnections, localTime, sampleIndex);
  }
  buffer.nodeGraphScopeAnalyzer = nodeGraphModuleScopeBufferStats(buffer);
  buffer.nodeGraphScopeDrawProgress = 1;
  buffer.nodeGraphScopePeriodSamples = sourceFrequency > 0 ? sampleRate / sourceFrequency : 0;
  buffer.nodeGraphScopeSourceFrequency = sourceFrequency;
  buffer.nodeGraphScopeSyncBuffer = buffer;
  buffer.nodeGraphScopeUseFullWindow = true;
  return buffer;
}

function nodeGraphModuleScopeOfflineOutputAnalyzerBuffer(slot) {
  if (slot?.type !== "output") {
    return null;
  }
  const node = nodeGraphModuleScopeNodeForSlot(slot);
  if (!node) {
    return null;
  }
  const inputConnections = nodeGraphModuleScopeOutputInputConnections(node.id);
  const allConnections = nodeGraphModuleScopeOutputConnectionList(inputConnections);
  if (!allConnections.length) {
    return null;
  }

  const settings = nodeGraphModuleScopeEffectiveSettingForSlot(slot);
  const sampleRate = Number(nodeGraphModuleScopeState.sampleRate) || nodeGraphMvp.sampleRate || 44100;
  const nodeMap = nodeGraphModuleScopeNodeMap();
  const time = nodeGraphModuleScopeModelFrameTime(slot);
  if (settings.outputTraceMode === "decay") {
    const sampleIndex = Math.floor(time * sampleRate);
    const context = {
      nodeMap,
      scopeStartTime: time,
      zeroFrequencyDisplayCycles: 0,
      zeroFrequencyDisplayFrame: null,
      zeroFrequencyDisplayFrames: 1,
    };
    const mono = nodeGraphModuleScopeOfflineConnectionSum(
      context,
      inputConnections.Mono,
      time,
      sampleIndex,
    );
    const left = nodeGraphModuleScopeOfflineConnectionSum(
      context,
      inputConnections.Left,
      time,
      sampleIndex,
    );
    const right = nodeGraphModuleScopeOfflineConnectionSum(
      context,
      inputConnections.Right,
      time,
      sampleIndex,
    );
    const buffer = new Float32Array([mono + (left + right) * 0.5]);
    buffer.nodeGraphScopeAnalyzer = nodeGraphModuleScopeBufferStats(buffer);
    buffer.nodeGraphScopeClassicOutputDecay = true;
    buffer.nodeGraphScopeDrawProgress = 1;
    buffer.nodeGraphScopeHoldPoint = true;
    buffer.nodeGraphScopeHoldPointX = 1;
    buffer.nodeGraphScopeSourceFrequency = 0;
    buffer.nodeGraphScopeUseFullWindow = true;
    return buffer;
  }
  const sourceFrequency = nodeGraphModuleScopeOfflineConnectionsSourceFrequency(allConnections, nodeMap);
  const cycles = nodeGraphModuleScopeEffectiveCycles(settings) || nodeGraphModuleScopeDefaultSettings.cycles;
  const windowSeconds = sourceFrequency > 0
    ? cycles / sourceFrequency
    : Math.max(0.005, (settings.timeMs || nodeGraphModuleScopeDefaultSettings.timeMs) / 1000);
  const frames = 2048;
  const buffer = new Float32Array(frames);
  const context = {
    nodeMap,
    scopeStartTime: time,
    zeroFrequencyDisplayCycles: sourceFrequency > 0 ? 0 : cycles,
    zeroFrequencyDisplayFrames: frames,
  };

  for (let index = 0; index < frames; index += 1) {
    const progress = index / Math.max(1, frames - 1);
    const localTime = time + progress * windowSeconds;
    const sampleIndex = Math.floor(localTime * sampleRate);
    context.zeroFrequencyDisplayFrame = sourceFrequency > 0 ? null : index;
    const mono = nodeGraphModuleScopeOfflineConnectionSum(
      context,
      inputConnections.Mono,
      localTime,
      sampleIndex,
    );
    const left = nodeGraphModuleScopeOfflineConnectionSum(
      context,
      inputConnections.Left,
      localTime,
      sampleIndex,
    );
    const right = nodeGraphModuleScopeOfflineConnectionSum(
      context,
      inputConnections.Right,
      localTime,
      sampleIndex,
    );
    buffer[index] = mono + (left + right) * 0.5;
  }

  buffer.nodeGraphScopeDrawProgress = 1;
  buffer.nodeGraphScopeAnalyzer = nodeGraphModuleScopeBufferStats(buffer);
  buffer.nodeGraphScopePeriodSamples = sourceFrequency > 0 ? frames / cycles : 0;
  buffer.nodeGraphScopeCurrentSamplePosition = 0;
  buffer.nodeGraphScopeSourceFrequency = sourceFrequency;
  buffer.nodeGraphScopeSyncBuffer = buffer;
  return buffer;
}

function nodeGraphModuleScopeCapturedOutputAnalyzerBuffer(slot, capturedBuffer = null) {
  if (slot?.type !== "output" || !capturedBuffer?.length) {
    return null;
  }
  const settings = nodeGraphModuleScopeEffectiveSettingForSlot(slot);
  const node = nodeGraphModuleScopeNodeForSlot(slot);
  const nodeMap = nodeGraphModuleScopeNodeMap();
  const inputConnections = node ? nodeGraphModuleScopeOutputInputConnections(node.id) : null;
  const sourceFrequency = nodeGraphModuleScopeOfflineConnectionsSourceFrequency(
    nodeGraphModuleScopeOutputConnectionList(inputConnections),
    nodeMap,
  );
  const sampleRate = Number(nodeGraphModuleScopeState.sampleRate) || nodeGraphMvp.sampleRate || 44100;
  if (settings.outputTraceMode === "decay") {
    const lastSample = Number(capturedBuffer[capturedBuffer.length - 1]) || 0;
    const buffer = new Float32Array([lastSample]);
    buffer.nodeGraphScopeAnalyzer = nodeGraphModuleScopeBufferStats(capturedBuffer);
    buffer.nodeGraphScopeCapturedOutput = true;
    buffer.nodeGraphScopeClassicOutputDecay = true;
    buffer.nodeGraphScopeDrawProgress = 1;
    buffer.nodeGraphScopeHoldPoint = true;
    buffer.nodeGraphScopeHoldPointX = 1;
    buffer.nodeGraphScopeSourceFrequency = sourceFrequency;
    buffer.nodeGraphScopeUseFullWindow = true;
    return buffer;
  }
  capturedBuffer.nodeGraphScopeAnalyzer = nodeGraphModuleScopeBufferStats(capturedBuffer);
  capturedBuffer.nodeGraphScopeCapturedOutput = true;
  capturedBuffer.nodeGraphScopeDrawProgress = 1;
  capturedBuffer.nodeGraphScopePeriodSamples = sourceFrequency > 0 ? sampleRate / sourceFrequency : 0;
  capturedBuffer.nodeGraphScopeSourceFrequency = sourceFrequency;
  capturedBuffer.nodeGraphScopeSyncBuffer = capturedBuffer;
  return capturedBuffer;
}

function nodeGraphModuleScopeShouldPreferOfflineOutputAnalyzer(slot, buffer) {
  if (slot?.type !== "output" || !buffer?.length) {
    return false;
  }
  const settings = nodeGraphModuleScopeEffectiveSettingForSlot(slot);
  if (!settings.sync || settings.outputTraceMode === "decay") {
    return false;
  }
  const shader = nodeGraphModuleScopeShaderConfigForSlot(slot);
  return shader.mode === "1d_full" &&
    Number.isFinite(Number(buffer.nodeGraphScopePeriodSamples)) &&
    Number(buffer.nodeGraphScopePeriodSamples) > 0;
}

function nodeGraphModuleScopeContinuousScanProgress(slot, speed, time) {
  const key = String(slot?.nodeId || "");
  const now = Math.max(0, Number(time) || 0);
  const safeSpeed = Math.max(0, Number(speed) || 0);
  if (!key) {
    return wrapNodeSliderValue(now * safeSpeed, 0, 1);
  }
  let state = nodeGraphModuleScopeState.scanPhasors.get(key);
  if (!state) {
    state = {
      lastTime: now,
      phase: wrapNodeSliderValue(now * safeSpeed, 0, 1),
      speed: safeSpeed,
    };
    nodeGraphModuleScopeState.scanPhasors.set(key, state);
    return state.phase;
  }
  const lastTime = Math.max(0, Number(state.lastTime) || now);
  const previousSpeed = Math.max(0, Number(state.speed) || 0);
  const phase = Number(state.phase) || 0;
  if (now >= lastTime) {
    const dt = clampNodeSliderValue(now - lastTime, 0, 0.25);
    const nextPhase = wrapNodeSliderValue(phase + previousSpeed * dt, 0, 1);
    state.lastTime = now;
    state.phase = nextPhase;
    state.speed = safeSpeed;
    nodeGraphModuleScopeState.scanPhasors.set(key, state);
    return nextPhase;
  }
  return wrapNodeSliderValue(phase - previousSpeed * Math.max(0, lastTime - now), 0, 1);
}

function nodeGraphModuleScopeShaderScanProgress(slot, buffer, time = nodeGraphModuleScopeState.animationTime) {
  const now = Number(time) || 0;
  const settings = nodeGraphModuleScopeEffectiveSettingForSlot(slot);
  const frequency = Number(buffer?.nodeGraphScopeSourceFrequency);
  if (settings.sync !== false && Number.isFinite(frequency) && frequency > 0) {
    const cycles = nodeGraphModuleScopeEffectiveCycles(settings) || nodeGraphModuleScopeDefaultSettings.cycles;
    const syncSpeed = Number.isFinite(Number(settings.syncSpeed)) ? Math.max(0, Number(settings.syncSpeed)) : 1;
    return nodeGraphModuleScopeContinuousScanProgress(slot, (frequency * syncSpeed) / Math.max(0.001, cycles), now);
  }
  const freeSpeed = Number.isFinite(Number(settings.syncSpeed)) ? Math.max(0, Number(settings.syncSpeed)) : 1;
  return nodeGraphModuleScopeContinuousScanProgress(slot, freeSpeed, now);
}

function nodeGraphModuleScopeCurrentBufferSample(buffer) {
  if (!buffer?.length) {
    return 0;
  }
  const currentSamplePosition = Number(buffer.nodeGraphScopeCurrentSamplePosition);
  const samplePosition = Number.isFinite(currentSamplePosition)
    ? clampNodeSliderValue(currentSamplePosition, 0, Math.max(0, buffer.length - 1))
    : Math.max(0, buffer.length - 1);
  return nodeGraphModuleScopeInterpolatedSample(buffer, samplePosition);
}

function nodeGraphModuleScopeScanHistoryBuffer(slot, buffer) {
  const nodeId = String(slot?.nodeId || "");
  if (!nodeId || !buffer?.length) {
    return buffer;
  }
  const fps = typeof normalizeNodeGraphModuleScopeFramesPerSecond === "function"
    ? normalizeNodeGraphModuleScopeFramesPerSecond(nodeGraphMvp?.moduleScopeFramesPerSecond ?? 60)
    : 60;
  const now = Number(nodeGraphModuleScopeState.animationTime) || 0;
  const tick = Math.floor(now * fps);
  const state = nodeGraphModuleScopeState.scanHistories.get(nodeId) || {
    lastTick: -1,
    samples: [],
  };
  if (state.lastTick !== tick) {
    state.lastTick = tick;
    state.samples.push(nodeGraphModuleScopeCurrentBufferSample(buffer));
    const scanTrailLimit = slot?.type === "visualOscilloscope" ? 128 : 1;
    const limit = Math.max(1, Math.min(2048, scanTrailLimit));
    if (state.samples.length > limit) {
      state.samples.splice(0, state.samples.length - limit);
    }
  }
  nodeGraphModuleScopeState.scanHistories.set(nodeId, state);
  const scanBuffer = new Float32Array(state.samples);
  scanBuffer.nodeGraphScopeAnalyzer = buffer.nodeGraphScopeAnalyzer;
  scanBuffer.nodeGraphScopeCapturedOutput = buffer.nodeGraphScopeCapturedOutput;
  scanBuffer.nodeGraphScopeCurrentSamplePosition = Math.max(0, scanBuffer.length - 1);
  scanBuffer.nodeGraphScopeSourceFrequency = buffer.nodeGraphScopeSourceFrequency;
  scanBuffer.nodeGraphScopeSyncBuffer = scanBuffer;
  return scanBuffer;
}

function nodeGraphModuleScopeApplyShaderDisplayMode(slot, buffer) {
  if (
    !buffer ||
    buffer.nodeGraphScopeClassicOutputDecay ||
    buffer.nodeGraphScopeLightDisplay ||
    buffer.nodeGraphScopeSpectrum ||
    buffer.nodeGraphScopeXy
  ) {
    return buffer;
  }
  const shader = nodeGraphModuleScopeShaderConfigForSlot(slot);
  buffer.nodeGraphScopeShaderMode = shader.mode;
  buffer.nodeGraphScopeShaderPadding = shader.padding;
  if (shader.mode === "one_value") {
    const value = nodeGraphModuleScopeCurrentBufferSample(buffer);
    const lineLength = clampNodeSliderValue(Number(shader.length), 0, 1);
    const lineBuffer = new Float32Array([value, value]);
    lineBuffer.nodeGraphScopeAnalyzer = buffer.nodeGraphScopeAnalyzer;
    lineBuffer.nodeGraphScopeCapturedOutput = buffer.nodeGraphScopeCapturedOutput;
    lineBuffer.nodeGraphScopeCurrentSamplePosition = 1;
    lineBuffer.nodeGraphScopeShaderMode = shader.mode;
    lineBuffer.nodeGraphScopeOneValueLineLength = lineLength;
    lineBuffer.nodeGraphScopeShaderPadding = shader.padding;
    lineBuffer.nodeGraphScopeSourceFrequency = buffer.nodeGraphScopeSourceFrequency;
    lineBuffer.nodeGraphScopeSyncBuffer = lineBuffer;
    lineBuffer.nodeGraphScopeDrawFullWindow = false;
    lineBuffer.nodeGraphScopeDrawProgress = lineLength;
    lineBuffer.nodeGraphScopeDrawStartProgress = 0;
    lineBuffer.nodeGraphScopeDrawWrap = false;
    lineBuffer.nodeGraphScopeHoldPoint = false;
    lineBuffer.nodeGraphScopeScanTrail = false;
    lineBuffer.nodeGraphScopeUseFullWindow = true;
    return lineBuffer;
  }
  if (shader.mode === "1d_scan") {
    if (slot?.type === "visualOscilloscope") {
      const scanProgress = nodeGraphModuleScopeShaderScanProgress(slot, buffer);
      buffer.nodeGraphScopeDrawFullWindow = false;
      buffer.nodeGraphScopeDrawProgress = clampNodeSliderValue(scanProgress, 0.002, 1);
      buffer.nodeGraphScopeDrawStartProgress = 0;
      buffer.nodeGraphScopeDrawWrap = false;
      buffer.nodeGraphScopeHoldPoint = false;
      buffer.nodeGraphScopeScanTrail = false;
      buffer.nodeGraphScopeUseFullWindow = true;
      return buffer;
    }
    buffer = nodeGraphModuleScopeScanHistoryBuffer(slot, buffer);
    buffer.nodeGraphScopeDrawFullWindow = false;
    buffer.nodeGraphScopeDrawProgress = 1;
    buffer.nodeGraphScopeDrawStartProgress = 0;
    buffer.nodeGraphScopeDrawWrap = false;
    buffer.nodeGraphScopeHoldPoint = true;
    buffer.nodeGraphScopeScanTrail = true;
    const currentSamplePosition = Number(buffer.nodeGraphScopeCurrentSamplePosition);
    buffer.nodeGraphScopeHoldPointSamplePosition = Number.isFinite(currentSamplePosition)
      ? clampNodeSliderValue(currentSamplePosition, 0, Math.max(0, (Number(buffer.length) || 1) - 1))
      : Math.max(0, (Number(buffer.length) || 1) - 1);
    buffer.nodeGraphScopeHoldPointX = nodeGraphModuleScopeShaderScanProgress(slot, buffer);
    buffer.nodeGraphScopeUseFullWindow = true;
    return buffer;
  }
  buffer.nodeGraphScopeDrawFullWindow = true;
  buffer.nodeGraphScopeDrawProgress = 1;
  buffer.nodeGraphScopeDrawStartProgress = 0;
  buffer.nodeGraphScopeDrawWrap = false;
  buffer.nodeGraphScopeHoldPoint = false;
  buffer.nodeGraphScopeScanTrail = false;
  buffer.nodeGraphScopeUseFullWindow = false;
  return buffer;
}

function nodeGraphModuleScopeDisplayBuffer(slot, capturedBuffer = null) {
  let buffer = null;
  if (slot?.type === "noise" && capturedBuffer) {
    buffer = capturedBuffer;
  } else if (slot?.type === "stereoNoise") {
    buffer = nodeGraphModuleScopeCapturedStereoNoiseXyBuffer(slot, capturedBuffer) || capturedBuffer;
  } else if (slot?.type === "visualOscilloscope") {
    buffer = nodeGraphModuleScopeCapturedVisualOscilloscopeXyBuffer(slot, capturedBuffer) ||
      capturedBuffer ||
      nodeGraphModuleScopeOfflineVisualOscilloscopeBuffer(slot);
  } else if (slot?.type === "scope2d") {
    buffer = nodeGraphModuleScopeCapturedScope2dBuffer(slot);
  } else if (slot?.type === "valueOscilloscope") {
    buffer = capturedBuffer || nodeGraphModuleScopeOfflineInputDisplayBuffer(slot);
  } else if (slot?.type === "dotOscilloscope") {
    buffer = nodeGraphModuleScopeDotOscilloscopeLightBuffer(
      capturedBuffer || nodeGraphModuleScopeOfflineInputDisplayBuffer(slot),
    );
  } else if (slot?.type === "lineBurnOscilloscope") {
    buffer = prepareNodeGraphTraceDisplayBuffer(
      capturedBuffer || nodeGraphModuleScopeOfflineInputDisplayBuffer(slot),
      nodeGraphTraceDisplaySettingsDefaults,
    );
  } else if (nodeGraphModuleDisplayTypeForSlot(slot) === "trace") {
    buffer = prepareNodeGraphTraceDisplayBuffer(
      capturedBuffer || nodeGraphModuleScopeOfflineInputDisplayBuffer(slot),
      nodeGraphTraceDisplaySettingsForSlot(slot),
    );
  } else if (slot?.type === "spiral" || slot?.type === "ellipsoid" || slot?.type === "lorenzAttractor") {
    buffer = nodeGraphModuleScopeCapturedOutputPairXyBuffer(slot, "X", "Y") || capturedBuffer;
  } else if (slot?.type === "output") {
    const offlineAnalyzer = nodeGraphModuleScopeOfflineOutputAnalyzerBuffer(slot);
    const capturedAnalyzer = nodeGraphModuleScopeCapturedOutputAnalyzerBuffer(slot, capturedBuffer);
    buffer = nodeGraphModuleScopeShouldPreferOfflineOutputAnalyzer(slot, offlineAnalyzer)
      ? offlineAnalyzer
      : capturedAnalyzer || offlineAnalyzer || capturedBuffer;
  } else {
    buffer = nodeGraphModuleScopeOfflineOscillatorBuffer(slot) ||
      nodeGraphModuleScopeOfflineAdditiveOscillatorBuffer(slot) ||
      nodeGraphModuleScopeOfflineClockBlinkBuffer(slot, capturedBuffer) ||
      nodeGraphModuleScopeOfflineLedBuffer(slot, capturedBuffer) ||
      nodeGraphModuleScopeOfflineGainAnalyzerBuffer(slot) ||
      capturedBuffer;
  }
  const displayType = nodeGraphModuleDisplayTypeForSlot(slot);
  return ["trace", "dot", "value", "lineBurn", "scope2d"].includes(displayType)
    ? buffer
    : nodeGraphModuleScopeApplyShaderDisplayMode(slot, buffer);
}

const nodeGraphTraceDisplaySettingsWindowSize = Object.freeze({
  height: 620,
  maxHeight: 820,
  maxWidth: 760,
  minHeight: 260,
  minWidth: 24,
  width: 185,
});

const nodeGraphTraceDisplaySettingFields = Object.freeze([
  ["zoomSeconds", "Zoom (s)"],
  ["padding", "Amp"],
  ["skipSamples", "Skip"],
  ["lineThickness", "Thick"],
  ["brightness", "Light"],
  ["dot2LineThickness", "Dot 2 thick"],
  ["dot2Brightness", "Dot 2 light"],
]);

function formatNodeGraphTraceDisplaySetting(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "0";
  }
  return Number.isInteger(number)
    ? String(number)
    : number.toFixed(4).replace(/\.?0+$/g, "");
}

function nodeGraphTraceDisplaySettingsElement() {
  let popover = document.getElementById("nodeTraceDisplaySettingsPopover");
  if (popover) {
    return popover;
  }
  popover = document.createElement("div");
  popover.id = "nodeTraceDisplaySettingsPopover";
  popover.className = "node-parameter-metadata-popover node-trace-display-settings-popover";
  popover.hidden = true;
  popover.setAttribute("aria-label", "Trace Display drawing settings");
  popover.innerHTML = `
    <div class="scene-context-heading node-trace-display-settings-heading">
      <button
        id="nodeTraceDisplaySettingsDragHandle"
        class="scene-context-drag-handle node-drag-handle"
        type="button"
        aria-label="Move Trace Display drawing settings">&#x2725;</button>
      <div class="scene-context-title">
        <span id="nodeTraceDisplaySettingsTitle">Display</span>
        <small id="nodeTraceDisplaySettingsSubtitle">Settings</small>
      </div>
      <button
        id="nodeTraceDisplaySettingsClose"
        class="panel-close-button"
        type="button"
        aria-label="Close Trace Display drawing settings">
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
    <div class="metadata-popover-grid node-trace-display-settings-grid">
      <div class="metadata-field-actions" aria-label="Trace Display drawing actions">
        <button id="nodeTraceDisplaySettingsSave" type="button">Save</button>
        <button id="nodeTraceDisplaySettingsRestore" type="button">Restore</button>
        <button id="nodeTraceDisplaySettingsDefaults" type="button">Defaults</button>
      </div>
      <div id="nodeTraceDisplayClosePrompt" class="metadata-close-prompt node-trace-display-close-prompt" hidden>
        <span>Save changes before closing?</span>
        <button id="nodeTraceDisplayCloseSave" type="button">Save</button>
        <button id="nodeTraceDisplayCloseDiscard" type="button">Discard</button>
      </div>
      <div class="metadata-section-title">Trace</div>
      <div class="metadata-field-section node-trace-display-trace-section">
        <label class="metadata-checkbox-label">
          <input id="nodeTraceDisplaySourceSync" type="checkbox" data-trace-display-toggle="sourceSync">
          Sync to source
        </label>
        <label>
          <span>Zoom (s)</span>
          <span class="metadata-stepper-control">
            <button type="button" data-trace-display-step-target="zoomSeconds" data-trace-display-step-direction="-1">-</button>
            <input id="nodeTraceDisplayZoomSeconds" type="text" inputmode="decimal" data-trace-display-field="zoomSeconds">
            <button type="button" data-trace-display-step-target="zoomSeconds" data-trace-display-step-direction="1">+</button>
          </span>
        </label>
        <label>
          <span>Amp</span>
          <span class="metadata-stepper-control">
            <button type="button" data-trace-display-step-target="padding" data-trace-display-step-direction="-1">-</button>
            <input id="nodeTraceDisplayPadding" type="text" inputmode="decimal" data-trace-display-field="padding">
            <button type="button" data-trace-display-step-target="padding" data-trace-display-step-direction="1">+</button>
          </span>
        </label>
        <label>
          <span>Skip</span>
          <input id="nodeTraceDisplaySkipSamples" type="text" inputmode="numeric" data-trace-display-field="skipSamples">
        </label>
      </div>
      <div class="metadata-section-title">Dot 1</div>
      <div class="metadata-field-section node-trace-display-dot1-section">
        <label>
          <span>Thick</span>
          <span class="metadata-stepper-control">
            <button type="button" data-trace-display-step-target="lineThickness" data-trace-display-step-direction="-1">-</button>
            <input id="nodeTraceDisplayLineThickness" type="text" inputmode="decimal" data-trace-display-field="lineThickness">
            <button type="button" data-trace-display-step-target="lineThickness" data-trace-display-step-direction="1">+</button>
          </span>
        </label>
        <label>
          <span class="metadata-icon-label" title="Light">&#128161;</span>
          <span class="metadata-stepper-control">
            <button type="button" data-trace-display-step-target="brightness" data-trace-display-step-direction="-1">-</button>
            <input id="nodeTraceDisplayBrightness" type="text" inputmode="decimal" data-trace-display-field="brightness">
            <button type="button" data-trace-display-step-target="brightness" data-trace-display-step-direction="1">+</button>
          </span>
        </label>
        <label><input id="nodeTraceDisplayColor" type="color" data-trace-display-color="color" aria-label="Dot 1 color"></label>
      </div>
      <div class="metadata-section-title">Dot 2</div>
      <div class="metadata-field-section node-trace-display-dot2-section">
        <label>
          <span>Thick</span>
          <span class="metadata-stepper-control">
            <button type="button" data-trace-display-step-target="dot2LineThickness" data-trace-display-step-direction="-1">-</button>
            <input id="nodeTraceDisplayDot2LineThickness" type="text" inputmode="decimal" data-trace-display-field="dot2LineThickness">
            <button type="button" data-trace-display-step-target="dot2LineThickness" data-trace-display-step-direction="1">+</button>
          </span>
        </label>
        <label>
          <span class="metadata-icon-label" title="Light">&#128161;</span>
          <span class="metadata-stepper-control">
            <button type="button" data-trace-display-step-target="dot2Brightness" data-trace-display-step-direction="-1">-</button>
            <input id="nodeTraceDisplayDot2Brightness" type="text" inputmode="decimal" data-trace-display-field="dot2Brightness">
            <button type="button" data-trace-display-step-target="dot2Brightness" data-trace-display-step-direction="1">+</button>
          </span>
        </label>
        <label><input id="nodeTraceDisplayDot2Color" type="color" data-trace-display-color="dot2Color" aria-label="Dot 2 color"></label>
      </div>
    </div>
    <div
      id="nodeTraceDisplaySettingsCornerDrag"
      class="metadata-popover-corner-drag"
      aria-label="Resize Trace Display drawing settings"
      role="button"
      tabindex="0"></div>`;
  (document.querySelector(".node-wiring-panel") || document.body).append(popover);
  bindNodeGraphTraceDisplaySettingsEvents(popover);
  bindNodeGraphSettingsTextInputProtection(popover);
  applyNodeGraphTraceDisplaySettingsTooltips(popover);
  return popover;
}

function applyNodeGraphTraceDisplaySettingsTooltips(popover) {
  if (!popover) {
    return;
  }
  const fieldKeys = {
    brightness: "traceDisplaySettings.brightness",
    dot2Brightness: "traceDisplaySettings.dot2Brightness",
    dot2LineThickness: "traceDisplaySettings.dot2LineThickness",
    zoomSeconds: "traceDisplaySettings.zoomSeconds",
    skipSamples: "traceDisplaySettings.skipSamples",
    padding: "traceDisplaySettings.padding",
    lineThickness: "traceDisplaySettings.lineThickness",
  };
  for (const [field, key] of Object.entries(fieldKeys)) {
    for (const element of popover.querySelectorAll(`[data-trace-display-field="${field}"], [data-trace-display-step-target="${field}"]`)) {
      element.dataset.tooltipKey = key;
    }
  }
  const colorKeys = {
    color: "traceDisplaySettings.color",
    dot2Color: "traceDisplaySettings.dot2Color",
  };
  for (const [field, key] of Object.entries(colorKeys)) {
    popover.querySelector(`[data-trace-display-color="${field}"]`)?.setAttribute("data-tooltip-key", key);
  }
  const toggleKeys = {
    sourceSync: "traceDisplaySettings.sourceSync",
  };
  for (const [field, key] of Object.entries(toggleKeys)) {
    popover.querySelector(`[data-trace-display-toggle="${field}"]`)?.setAttribute("data-tooltip-key", key);
  }
  const keyedControls = {
    nodeTraceDisplaySettingsSave: "traceDisplaySettings.save",
    nodeTraceDisplaySettingsRestore: "traceDisplaySettings.restore",
    nodeTraceDisplaySettingsDefaults: "traceDisplaySettings.defaults",
    nodeTraceDisplayCloseSave: "traceDisplaySettings.closeSave",
    nodeTraceDisplayCloseDiscard: "traceDisplaySettings.closeDiscard",
  };
  for (const [id, key] of Object.entries(keyedControls)) {
    popover.querySelector(`#${id}`)?.setAttribute("data-tooltip-key", key);
  }
  if (typeof applyNodeGraphStaticTooltips === "function") {
    applyNodeGraphStaticTooltips(popover);
  }
}

function applyNodeGraphTraceDisplaySettingsWindowSize(size = {}) {
  const popover = document.getElementById("nodeTraceDisplaySettingsPopover");
  if (!popover) {
    return null;
  }
  const normalized = normalizeNodeGraphFloatingWindowSize(size, nodeGraphTraceDisplaySettingsWindowSize);
  applyNodeGraphFloatingWindowSizeVars(
    popover,
    "metadata-popover",
    nodeGraphTraceDisplaySettingsWindowSize,
    normalized,
  );
  return normalized;
}

function nodeGraphTraceDisplaySettingsWindowSizeFromElement(popover = document.getElementById("nodeTraceDisplaySettingsPopover")) {
  const rect = popover?.getBoundingClientRect?.();
  return normalizeNodeGraphFloatingWindowSize(
    {
      width: rect?.width,
      height: rect?.height,
    },
    nodeGraphTraceDisplaySettingsWindowSize,
  );
}

function rememberNodeGraphTraceDisplaySettingsWindowState(patch = {}, options = {}) {
  const popover = document.getElementById("nodeTraceDisplaySettingsPopover");
  if (typeof rememberNodeGraphWorkspaceWindowState !== "function") {
    return null;
  }
  return rememberNodeGraphWorkspaceWindowState(
    "traceDisplaySettings",
    popover,
    patch,
    { status: false, ...options },
  );
}

function readNodeGraphTraceDisplaySettingsForm() {
  const current = normalizeNodeGraphTraceDisplaySettings(nodeGraphMvp.traceDisplaySettingsDraft);
  const next = { ...current };
  for (const [key] of nodeGraphTraceDisplaySettingFields) {
    const input = document.querySelector(`[data-trace-display-field="${key}"]`);
    if (input) {
      next[key] = input.value;
    }
  }
  for (const key of ["color", "dot2Color"]) {
    const input = document.querySelector(`[data-trace-display-color="${key}"]`);
    if (input) {
      next[key] = input.value;
    }
  }
  for (const key of ["sourceSync"]) {
    const input = document.querySelector(`[data-trace-display-toggle="${key}"]`);
    if (input) {
      next[key] = input.checked;
    }
  }
  return normalizeNodeGraphTraceDisplaySettings(next);
}

function writeNodeGraphTraceDisplaySettingsForm(settings) {
  const normalized = normalizeNodeGraphTraceDisplaySettings(settings);
  for (const [key] of nodeGraphTraceDisplaySettingFields) {
    const input = document.querySelector(`[data-trace-display-field="${key}"]`);
    if (input) {
      input.value = formatNodeGraphTraceDisplaySetting(normalized[key]);
      input.readOnly = true;
      input.classList.toggle("trace-display-field-editing", false);
    }
  }
  for (const key of ["color"]) {
    const input = document.querySelector(`[data-trace-display-color="${key}"]`);
    if (input) {
      input.value = normalized[key];
    }
  }
  for (const key of ["sourceSync"]) {
    const input = document.querySelector(`[data-trace-display-toggle="${key}"]`);
    if (input) {
      input.checked = Boolean(normalized[key]);
    }
  }
}

function setNodeGraphTraceDisplaySettingsDirty(dirty) {
  const saveButton = document.getElementById("nodeTraceDisplaySettingsSave");
  if (saveButton) {
    saveButton.classList.toggle("dirty", Boolean(dirty));
  }
  nodeGraphMvp.traceDisplaySettingsDirty = Boolean(dirty);
  if (!dirty) {
    setNodeGraphTraceDisplayClosePromptVisible(false);
  }
}

function setNodeGraphTraceDisplayClosePromptVisible(visible) {
  const prompt = document.getElementById("nodeTraceDisplayClosePrompt");
  if (prompt) {
    prompt.hidden = !visible;
  }
}

function nodeGraphTraceDisplayStepperQuantum(input) {
  if (!input) {
    return 0.1;
  }
  if (input.dataset.traceDisplayField === "skipSamples") {
    return 1;
  }
  return 0.1;
}

function nodeGraphTraceDisplayFieldFromTarget(target) {
  if (!(target instanceof Element)) {
    return null;
  }
  return target.closest?.("[data-trace-display-field]") || null;
}

function setNodeGraphTraceDisplayFieldEditing(input, editing) {
  if (!input) {
    return;
  }
  input.readOnly = !editing;
  input.classList.toggle("trace-display-field-editing", Boolean(editing));
  if (editing) {
    input.focus();
    input.select?.();
  }
}

function beginNodeGraphTraceDisplayFieldEdit(event) {
  const input = nodeGraphTraceDisplayFieldFromTarget(event.target);
  if (!input) {
    return;
  }
  setNodeGraphTraceDisplayFieldEditing(input, true);
  event.preventDefault();
  event.stopPropagation();
}

function finishNodeGraphTraceDisplayFieldEdit(event) {
  const input = nodeGraphTraceDisplayFieldFromTarget(event.target);
  if (!input) {
    return;
  }
  setNodeGraphTraceDisplayFieldEditing(input, false);
  updateNodeGraphTraceDisplaySettingsDraft();
}

function handleNodeGraphTraceDisplayFieldEditKeydown(event) {
  const input = nodeGraphTraceDisplayFieldFromTarget(event.target);
  if (!input || input.readOnly) {
    return;
  }
  if (event.key === "Enter") {
    input.blur();
    event.preventDefault();
  } else if (event.key === "Escape") {
    writeNodeGraphTraceDisplaySettingsForm(nodeGraphMvp.traceDisplaySettingsDraft);
    input.blur();
    event.preventDefault();
  }
  event.stopPropagation();
}

function beginNodeGraphTraceDisplayFieldDrag(event) {
  if (event.button > 0 || event.detail > 1) {
    return;
  }
  const input = nodeGraphTraceDisplayFieldFromTarget(event.target);
  if (!input || !input.readOnly) {
    return;
  }
  const key = input.dataset.traceDisplayField;
  if (key === "skipSamples") {
    event.stopPropagation();
    return;
  }
  nodeGraphMvp.traceDisplayFieldDragging = {
    input,
    key,
    pointerId: event.pointerId ?? null,
    startValue: Number(input.value),
    startX: event.clientX,
    startY: event.clientY,
    quantum: nodeGraphTraceDisplayStepperQuantum(input),
  };
  input.classList.add("value-dragging");
  input.setPointerCapture?.(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function dragNodeGraphTraceDisplayField(event) {
  const drag = nodeGraphMvp.traceDisplayFieldDragging;
  if (
    !drag ||
    (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)
  ) {
    return;
  }
  const horizontalDelta = event.clientX - drag.startX;
  const verticalDelta = drag.startY - event.clientY;
  const startValue = Number.isFinite(drag.startValue)
    ? drag.startValue
    : Number(nodeGraphTraceDisplaySettingsDefaults[drag.key]) || 0;
  const rawValue = startValue + ((horizontalDelta + verticalDelta) / 8) * drag.quantum;
  const nextValue = drag.key === "skipSamples"
    ? normalizeNodeGraphTraceDisplaySkipSamples(rawValue)
    : rawValue;
  drag.input.value = formatNodeGraphTraceDisplaySetting(nextValue);
  updateNodeGraphTraceDisplaySettingsDraft();
  event.preventDefault();
  event.stopPropagation();
}

function endNodeGraphTraceDisplayFieldDrag(event) {
  const drag = nodeGraphMvp.traceDisplayFieldDragging;
  if (
    !drag ||
    (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)
  ) {
    return;
  }
  drag.input.classList.remove("value-dragging");
  const root = nodeGraphSettingsTextRootFromTarget(drag.input);
  if (root) {
    root.dataset.settingsTextPointerActive = "false";
    root.dataset.settingsTextPointerId = "";
    root.dataset.settingsTextPointerMoved = "false";
    root.dataset.settingsTextSuppressClick = "true";
    window.setTimeout(() => {
      if (root.dataset.settingsTextSuppressClick === "true") {
        root.dataset.settingsTextSuppressClick = "false";
      }
    }, 180);
  }
  if (event.pointerId !== undefined && drag.input.hasPointerCapture?.(event.pointerId)) {
    drag.input.releasePointerCapture(event.pointerId);
  }
  nodeGraphMvp.traceDisplayFieldDragging = null;
  event.preventDefault();
  event.stopPropagation();
}

function stepNodeGraphTraceDisplaySetting(event) {
  if (nodeGraphSettingsTextGestureShouldIgnoreClick(event)) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  const button = event.target.closest("[data-trace-display-step-target]");
  if (!button) {
    return;
  }
  const key = button.dataset.traceDisplayStepTarget;
  const input = document.querySelector(`[data-trace-display-field="${key}"]`);
  if (!input) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const direction = Number(button.dataset.traceDisplayStepDirection) < 0 ? -1 : 1;
  const quantum = nodeGraphTraceDisplayStepperQuantum(input);
  const current = Number(input.value);
  input.value = formatNodeGraphTraceDisplaySetting(
    (Number.isFinite(current) ? current : Number(nodeGraphTraceDisplaySettingsDefaults[key]) || 0) + direction * quantum,
  );
  updateNodeGraphTraceDisplaySettingsDraft();
}

function updateNodeGraphTraceDisplaySettingsDraft() {
  nodeGraphMvp.traceDisplaySettingsDraft = readNodeGraphTraceDisplaySettingsForm();
  setNodeGraphTraceDisplaySettingsDirty(true);
  scheduleNodeGraphModuleScopeDraw();
}

function saveNodeGraphTraceDisplaySettings() {
  if (nodeGraphTraceDisplaySettingsEditingGlobal()) {
    nodeGraphMvp.traceSettings = normalizeNodeGraphTraceDisplaySettings(nodeGraphMvp.traceDisplaySettingsDraft);
    setNodeGraphTraceDisplaySettingsDirty(false);
    if (typeof serializeNodeUiDevSettings === "function" && typeof saveNodeUiDevLocalDefaultSettings === "function") {
      saveNodeUiDevLocalDefaultSettings(serializeNodeUiDevSettings());
    }
    scheduleNodeGraphModuleScopeDraw();
    return;
  }
  const node = nodeGraphPatchNode(nodeGraphMvp.traceDisplaySettingsTargetNode);
  if (!node || node.type !== "traceDisplay") {
    return;
  }
  node.traceDisplaySettings = normalizeNodeGraphTraceDisplaySettings(nodeGraphMvp.traceDisplaySettingsDraft);
  setNodeGraphTraceDisplaySettingsDirty(false);
  markNodeGraphRenderPending("trace display settings saved");
  if (typeof renderNodeGraphExecutionPlanDebug === "function") {
    renderNodeGraphExecutionPlanDebug();
  }
  if (typeof setNodeGraphPatchDirtyState === "function") {
    setNodeGraphPatchDirtyState("edited");
  } else if (typeof saveNodeGraphWorkingPatchToUserSettings === "function") {
    nodeGraphMvp.patchDirtyState = "edited";
    saveNodeGraphWorkingPatchToUserSettings();
  }
  if (typeof renderNodeGraphHistoryControls === "function") {
    renderNodeGraphHistoryControls();
  }
}

function restoreNodeGraphTraceDisplaySettings() {
  if (nodeGraphTraceDisplaySettingsEditingGlobal()) {
    nodeGraphMvp.traceDisplaySettingsDraft = nodeGraphGlobalTraceSettings();
    writeNodeGraphTraceDisplaySettingsForm(nodeGraphMvp.traceDisplaySettingsDraft);
    setNodeGraphTraceDisplaySettingsDirty(false);
    scheduleNodeGraphModuleScopeDraw();
    return;
  }
  const node = nodeGraphPatchNode(nodeGraphMvp.traceDisplaySettingsTargetNode);
  if (!node || node.type !== "traceDisplay") {
    return;
  }
  nodeGraphMvp.traceDisplaySettingsDraft = normalizeNodeGraphTraceDisplaySettings(node.traceDisplaySettings);
  writeNodeGraphTraceDisplaySettingsForm(nodeGraphMvp.traceDisplaySettingsDraft);
  setNodeGraphTraceDisplaySettingsDirty(false);
  scheduleNodeGraphModuleScopeDraw();
}

function setNodeGraphTraceDisplaySettingsDefaults() {
  nodeGraphMvp.traceDisplaySettingsDraft = normalizeNodeGraphTraceDisplaySettings(nodeGraphTraceDisplaySettingsDefaults);
  writeNodeGraphTraceDisplaySettingsForm(nodeGraphMvp.traceDisplaySettingsDraft);
  setNodeGraphTraceDisplaySettingsDirty(true);
  scheduleNodeGraphModuleScopeDraw();
}

function closeNodeGraphTraceDisplaySettings() {
  if (nodeGraphMvp.traceDisplaySettingsDirty) {
    setNodeGraphTraceDisplayClosePromptVisible(true);
    return;
  }
  finishCloseNodeGraphTraceDisplaySettings();
}

function finishCloseNodeGraphTraceDisplaySettings() {
  const popover = document.getElementById("nodeTraceDisplaySettingsPopover");
  if (popover) {
    popover.hidden = true;
  }
  rememberNodeGraphTraceDisplaySettingsWindowState({ open: false }, { status: false });
  setNodeGraphTraceDisplayClosePromptVisible(false);
  nodeGraphMvp.traceDisplaySettingsTargetNode = null;
  nodeGraphMvp.traceDisplaySettingsDraft = null;
  nodeGraphMvp.traceDisplaySettingsDirty = false;
  scheduleNodeGraphModuleScopeDraw();
}

function hideNodeGraphTraceDisplaySettingsForInspectorReplacement() {
  const popover = document.getElementById("nodeTraceDisplaySettingsPopover");
  if (popover) {
    popover.hidden = true;
  }
  rememberNodeGraphTraceDisplaySettingsWindowState({ open: false }, { status: false });
  setNodeGraphTraceDisplayClosePromptVisible(false);
  nodeGraphMvp.traceDisplaySettingsTargetNode = null;
  nodeGraphMvp.traceDisplaySettingsDraft = null;
  nodeGraphMvp.traceDisplaySettingsDirty = false;
}

function nodeGraphTraceDisplaySettingsVisibleRect() {
  const popover = document.getElementById("nodeTraceDisplaySettingsPopover");
  if (!popover || popover.hidden) {
    return null;
  }
  const rect = popover.getBoundingClientRect();
  return {
    height: rect.height,
    left: rect.left,
    top: rect.top,
    width: rect.width,
  };
}

function prepareNodeGraphTraceDisplaySettingsForInspectorReplacement() {
  const rect = nodeGraphTraceDisplaySettingsVisibleRect();
  if (!rect) {
    return null;
  }
  if (nodeGraphMvp.traceDisplaySettingsDirty) {
    closeNodeGraphTraceDisplaySettings();
    return false;
  }
  hideNodeGraphTraceDisplaySettingsForInspectorReplacement();
  return rect;
}

function saveAndCloseNodeGraphTraceDisplaySettings() {
  saveNodeGraphTraceDisplaySettings();
  if (!nodeGraphMvp.traceDisplaySettingsDirty) {
    finishCloseNodeGraphTraceDisplaySettings();
  }
}

function discardAndCloseNodeGraphTraceDisplaySettings() {
  setNodeGraphTraceDisplaySettingsDirty(false);
  finishCloseNodeGraphTraceDisplaySettings();
}

function restoreNodeGraphTraceDisplaySettingsWindowFromState(state = {}) {
  const nodeId = String(state.targetNode || nodeGraphMvp.traceDisplaySettingsTargetNode || "");
  const node = nodeGraphPatchNode(nodeId);
  const popover = nodeGraphTraceDisplaySettingsElement();
  bindNodeGraphTraceDisplaySettingsEvents(popover);
  nodeGraphMvp.sharedInspectorActive = "traceDisplaySettings";
  if (nodeId === "__globalTraceSettings") {
    nodeGraphMvp.traceDisplaySettingsTargetNode = "__globalTraceSettings";
    nodeGraphMvp.traceDisplaySettingsDraft = nodeGraphGlobalTraceSettings();
    document.getElementById("nodeTraceDisplaySettingsTitle").textContent = "Trace";
    document.getElementById("nodeTraceDisplaySettingsSubtitle").textContent = "Settings";
    writeNodeGraphTraceDisplaySettingsForm(nodeGraphMvp.traceDisplaySettingsDraft);
    setNodeGraphTraceDisplaySettingsDirty(false);
    return;
  }
  if (!node || node.type !== "traceDisplay") {
    document.getElementById("nodeTraceDisplaySettingsTitle").textContent = "Display";
    document.getElementById("nodeTraceDisplaySettingsSubtitle").textContent = "Settings";
    nodeGraphMvp.traceDisplaySettingsTargetNode = null;
    nodeGraphMvp.traceDisplaySettingsDraft = normalizeNodeGraphTraceDisplaySettings();
    writeNodeGraphTraceDisplaySettingsForm(nodeGraphMvp.traceDisplaySettingsDraft);
    setNodeGraphTraceDisplaySettingsDirty(false);
    return;
  }
  nodeGraphMvp.traceDisplaySettingsTargetNode = node.id;
  nodeGraphMvp.traceDisplaySettingsDraft = normalizeNodeGraphTraceDisplaySettings(node.traceDisplaySettings);
  document.getElementById("nodeTraceDisplaySettingsTitle").textContent = "Display";
  document.getElementById("nodeTraceDisplaySettingsSubtitle").textContent = "Settings";
  writeNodeGraphTraceDisplaySettingsForm(nodeGraphMvp.traceDisplaySettingsDraft);
  setNodeGraphTraceDisplaySettingsDirty(false);
}

function openNodeGraphGlobalTraceSettings(event = {}) {
  const metadataRect = typeof prepareNodeMetadataPopoverForInspectorReplacement === "function"
    ? prepareNodeMetadataPopoverForInspectorReplacement()
    : null;
  if (metadataRect === false) {
    return true;
  }
  const moduleActionsRect = typeof prepareNodeModuleActionsWindowForInspectorReplacement === "function"
    ? prepareNodeModuleActionsWindowForInspectorReplacement()
    : null;
  const replacementRect = metadataRect || moduleActionsRect;
  const popover = nodeGraphTraceDisplaySettingsElement();
  bindNodeGraphTraceDisplaySettingsEvents(popover);
  nodeGraphMvp.traceDisplaySettingsTargetNode = "__globalTraceSettings";
  nodeGraphMvp.traceDisplaySettingsDraft = nodeGraphGlobalTraceSettings();
  nodeGraphMvp.sharedInspectorActive = "traceDisplaySettings";
  document.getElementById("nodeTraceDisplaySettingsTitle").textContent = "Trace";
  document.getElementById("nodeTraceDisplaySettingsSubtitle").textContent = "Settings";
  writeNodeGraphTraceDisplaySettingsForm(nodeGraphMvp.traceDisplaySettingsDraft);
  setNodeGraphTraceDisplaySettingsDirty(false);
  const sharedInspectorState = typeof normalizeNodeGraphSharedInspectorWindowState === "function"
    ? normalizeNodeGraphSharedInspectorWindowState(nodeGraphMvp.sharedInspectorWindowState, nodeGraphMvp.workspaceWindowStates)
    : (nodeGraphMvp.sharedInspectorWindowState || {});
  const savedPosition = sharedInspectorState.position;
  const hasSavedPosition =
    Number.isFinite(Number(savedPosition?.left)) &&
    Number.isFinite(Number(savedPosition?.top));
  applyNodeGraphTraceDisplaySettingsWindowSize(sharedInspectorState.size);
  popover.hidden = false;
  const rect = popover.getBoundingClientRect();
  const replacementLeft = Number(replacementRect?.left);
  const replacementTop = Number(replacementRect?.top);
  const replacementWidth = Number(replacementRect?.width);
  const eventX = Number(event.clientX);
  const eventY = Number(event.clientY);
  const x = hasSavedPosition
    ? savedPosition.left
    : Number.isFinite(replacementLeft)
    ? replacementLeft + (Number.isFinite(replacementWidth) ? replacementWidth * 0.5 : 0) - rect.width * 0.5
    : Number.isFinite(eventX)
    ? eventX
    : window.innerWidth * 0.5 - rect.width * 0.5;
  const y = hasSavedPosition
    ? savedPosition.top
    : Number.isFinite(replacementTop)
    ? replacementTop
    : Number.isFinite(eventY)
    ? eventY
    : window.innerHeight * 0.25;
  const position = hasSavedPosition
    ? { left: Math.round(Number(savedPosition.left)), top: Math.round(Number(savedPosition.top)) }
    : nodeGraphFloatingWindowPosition(popover, x, y);
  popover.style.position = "fixed";
  if (typeof setNodeGraphFloatingWindowViewportPosition === "function") {
    setNodeGraphFloatingWindowViewportPosition(popover, position.left, position.top);
  } else {
    popover.style.left = `${position.left}px`;
    popover.style.top = `${position.top}px`;
    popover.style.right = "auto";
  }
  rememberNodeGraphTraceDisplaySettingsWindowState(
    { open: true, position, targetNode: "__globalTraceSettings" },
    { status: false },
  );
  scheduleNodeGraphModuleScopeDraw();
  return true;
}

function beginNodeGraphTraceDisplaySettingsDrag(event) {
  beginNodeGraphFloatingWindowDrag(
    event,
    document.getElementById("nodeTraceDisplaySettingsPopover"),
    "traceDisplaySettingsDragging",
  );
}

function dragNodeGraphTraceDisplaySettings(event) {
  dragNodeGraphFloatingWindow(
    event,
    "traceDisplaySettingsDragging",
    document.getElementById("nodeTraceDisplaySettingsPopover"),
    (next) => {
      rememberNodeGraphTraceDisplaySettingsWindowState(
        { open: true, position: next },
        { persist: false },
      );
    },
  );
  dragNodeGraphFloatingWindowResize(
    event,
    "traceDisplaySettingsResizing",
    applyNodeGraphTraceDisplaySettingsWindowSize,
    { width: true, height: true },
  );
}

function endNodeGraphTraceDisplaySettingsDrag(event) {
  const drag = nodeGraphMvp.traceDisplaySettingsDragging;
  endNodeGraphFloatingWindowDrag(event, "traceDisplaySettingsDragging", () => {
    const position = Number.isFinite(Number(drag?.currentLeft)) && Number.isFinite(Number(drag?.currentTop))
      ? { left: drag.currentLeft, top: drag.currentTop }
      : undefined;
    rememberNodeGraphTraceDisplaySettingsWindowState(
      { open: true, ...(position ? { position } : {}) },
      { capturePosition: false, status: false },
    );
  });
  endNodeGraphFloatingWindowResize(event, "traceDisplaySettingsResizing", () => {
    rememberNodeGraphTraceDisplaySettingsWindowState(
      { open: true, size: nodeGraphTraceDisplaySettingsWindowSizeFromElement() },
      { status: false },
    );
  });
}

function beginNodeGraphTraceDisplaySettingsResize(event) {
  beginNodeGraphFloatingWindowResize(
    event,
    document.getElementById("nodeTraceDisplaySettingsPopover"),
    "traceDisplaySettingsResizing",
  );
}

function bindNodeGraphTraceDisplaySettingsEvents(popover) {
  if (!popover || popover.dataset.traceDisplaySettingsBound === "true") {
    return;
  }
  popover.dataset.traceDisplaySettingsBound = "true";
  bindNodeGraphSettingsTextInputProtection(popover);
  popover.addEventListener("input", updateNodeGraphTraceDisplaySettingsDraft);
  popover.addEventListener("click", stepNodeGraphTraceDisplaySetting);
  popover.addEventListener("dblclick", beginNodeGraphTraceDisplayFieldEdit, true);
  popover.addEventListener("blur", finishNodeGraphTraceDisplayFieldEdit, true);
  popover.addEventListener("keydown", handleNodeGraphTraceDisplayFieldEditKeydown, true);
  popover.addEventListener("pointerdown", beginNodeGraphTraceDisplayFieldDrag, true);
  document.getElementById("nodeTraceDisplaySettingsSave")?.addEventListener("click", saveNodeGraphTraceDisplaySettings);
  document.getElementById("nodeTraceDisplaySettingsRestore")?.addEventListener("click", restoreNodeGraphTraceDisplaySettings);
  document.getElementById("nodeTraceDisplaySettingsDefaults")?.addEventListener("click", setNodeGraphTraceDisplaySettingsDefaults);
  document.getElementById("nodeTraceDisplaySettingsClose")?.addEventListener("click", closeNodeGraphTraceDisplaySettings);
  document.getElementById("nodeTraceDisplayCloseSave")?.addEventListener("click", saveAndCloseNodeGraphTraceDisplaySettings);
  document.getElementById("nodeTraceDisplayCloseDiscard")?.addEventListener("click", discardAndCloseNodeGraphTraceDisplaySettings);
  document.getElementById("nodeTraceDisplaySettingsDragHandle")?.addEventListener("pointerdown", beginNodeGraphTraceDisplaySettingsDrag);
  document.querySelector("#nodeTraceDisplaySettingsPopover .node-trace-display-settings-heading")?.addEventListener("pointerdown", beginNodeGraphTraceDisplaySettingsDrag);
  document.getElementById("nodeTraceDisplaySettingsCornerDrag")?.addEventListener("pointerdown", beginNodeGraphTraceDisplaySettingsResize);
  document.addEventListener("pointermove", dragNodeGraphTraceDisplayField, true);
  document.addEventListener("pointerup", endNodeGraphTraceDisplayFieldDrag, true);
  document.addEventListener("pointercancel", endNodeGraphTraceDisplayFieldDrag, true);
  document.addEventListener("pointermove", dragNodeGraphTraceDisplaySettings);
  document.addEventListener("pointerup", endNodeGraphTraceDisplaySettingsDrag);
  document.addEventListener("pointercancel", endNodeGraphTraceDisplaySettingsDrag);
}

function openNodeGraphTraceDisplaySettings(nodeId, event = {}) {
  const node = nodeGraphPatchNode(nodeId);
  if (!node) {
    return false;
  }
  if (node.type !== "traceDisplay") {
    if (nodeGraphModuleDisplayTypeForType(node.type) === "trace") {
      return openNodeGraphGlobalTraceSettings(event);
    }
    return false;
  }
  const metadataRect = typeof prepareNodeMetadataPopoverForInspectorReplacement === "function"
    ? prepareNodeMetadataPopoverForInspectorReplacement()
    : null;
  if (metadataRect === false) {
    return true;
  }
  const moduleActionsRect = typeof prepareNodeModuleActionsWindowForInspectorReplacement === "function"
    ? prepareNodeModuleActionsWindowForInspectorReplacement()
    : null;
  const replacementRect = metadataRect || moduleActionsRect;
  const popover = nodeGraphTraceDisplaySettingsElement();
  bindNodeGraphTraceDisplaySettingsEvents(popover);
  nodeGraphMvp.traceDisplaySettingsTargetNode = node.id;
  nodeGraphMvp.traceDisplaySettingsDraft = normalizeNodeGraphTraceDisplaySettings(node.traceDisplaySettings);
  nodeGraphMvp.sharedInspectorActive = "traceDisplaySettings";
  document.getElementById("nodeTraceDisplaySettingsTitle").textContent = "Display";
  document.getElementById("nodeTraceDisplaySettingsSubtitle").textContent = "Settings";
  writeNodeGraphTraceDisplaySettingsForm(nodeGraphMvp.traceDisplaySettingsDraft);
  setNodeGraphTraceDisplaySettingsDirty(false);
  const sharedInspectorState = typeof normalizeNodeGraphSharedInspectorWindowState === "function"
    ? normalizeNodeGraphSharedInspectorWindowState(nodeGraphMvp.sharedInspectorWindowState, nodeGraphMvp.workspaceWindowStates)
    : (nodeGraphMvp.sharedInspectorWindowState || {});
  const savedPosition = sharedInspectorState.position;
  const hasSavedPosition =
    Number.isFinite(Number(savedPosition?.left)) &&
    Number.isFinite(Number(savedPosition?.top));
  applyNodeGraphTraceDisplaySettingsWindowSize(sharedInspectorState.size);
  popover.hidden = false;
  const rect = popover.getBoundingClientRect();
  const metadataLeft = Number(replacementRect?.left);
  const metadataTop = Number(replacementRect?.top);
  const metadataWidth = Number(replacementRect?.width);
  const eventX = Number(event.clientX);
  const eventY = Number(event.clientY);
  const x = hasSavedPosition
    ? savedPosition.left
    : Number.isFinite(metadataLeft)
    ? metadataLeft + (Number.isFinite(metadataWidth) ? metadataWidth * 0.5 : 0) - rect.width * 0.5
    : Number.isFinite(eventX)
    ? eventX
    : window.innerWidth * 0.5 - rect.width * 0.5;
  const y = hasSavedPosition
    ? savedPosition.top
    : Number.isFinite(metadataTop)
    ? metadataTop
    : Number.isFinite(eventY)
    ? eventY
    : window.innerHeight * 0.25;
  const position = hasSavedPosition
    ? { left: Math.round(Number(savedPosition.left)), top: Math.round(Number(savedPosition.top)) }
    : nodeGraphFloatingWindowPosition(popover, x, y);
  popover.style.position = "fixed";
  if (typeof setNodeGraphFloatingWindowViewportPosition === "function") {
    setNodeGraphFloatingWindowViewportPosition(popover, position.left, position.top);
  } else {
    popover.style.left = `${position.left}px`;
    popover.style.top = `${position.top}px`;
    popover.style.right = "auto";
  }
  rememberNodeGraphTraceDisplaySettingsWindowState(
    { open: true, position, targetNode: node.id },
    { status: false },
  );
  scheduleNodeGraphModuleScopeDraw();
  return true;
}

function nodeGraphModuleScopeCapturedOutputPairXyBuffer(slot, xPort = "X", yPort = "Y") {
  const nodeId = String(slot?.nodeId || "");
  if (!nodeId) {
    return null;
  }
  const shader = nodeGraphModuleScopeShaderConfigForSlot(slot);
  if (shader.mode !== "x_y") {
    return null;
  }
  const xBuffer = nodeGraphModuleScopeState.buffers.get(`${nodeId}:${xPort}`);
  const yBuffer = nodeGraphModuleScopeState.buffers.get(`${nodeId}:${yPort}`);
  const length = Math.min(xBuffer?.length || 0, yBuffer?.length || 0);
  if (length <= 1) {
    return null;
  }
  const frames = nodeGraphModuleScopeCapturedXyTraceFrameCount(slot, length);
  const start = Math.max(0, length - frames);
  const x = new Float32Array(frames);
  const y = new Float32Array(frames);
  for (let index = 0; index < frames; index += 1) {
    x[index] = Number(xBuffer[start + index]) || 0;
    y[index] = Number(yBuffer[start + index]) || 0;
  }
  return {
    length: frames,
    nodeGraphScopeCapturedOutput: true,
    nodeGraphScopeDrawProgress: 1,
    nodeGraphScopeUseFullWindow: true,
    nodeGraphScopeVisualPointLimit: frames,
    nodeGraphScopeXy: true,
    x,
    y,
  };
}

function nodeGraphModuleScopeCapturedVisualOscilloscopeXyBuffer(slot, capturedBuffer = null) {
  if (slot?.type !== "visualOscilloscope") {
    return null;
  }
  const shader = nodeGraphModuleScopeShaderConfigForSlot(slot);
  if (shader.mode !== "x_y") {
    return null;
  }
  const xBuffer = nodeGraphModuleScopeState.buffers.get(`${slot.nodeId}:X`);
  const yBuffer = nodeGraphModuleScopeState.buffers.get(`${slot.nodeId}:Y`);
  let length = Math.min(xBuffer?.length || 0, yBuffer?.length || 0);
  let useLinearX = false;
  let sourceX = xBuffer;
  let sourceY = yBuffer;
  if (length <= 1) {
    sourceY = nodeGraphModuleScopeState.buffers.get(`${slot.nodeId}:In`) || capturedBuffer;
    length = sourceY?.length || 0;
    useLinearX = true;
  }
  if (length <= 1) {
    return null;
  }
  const frames = nodeGraphModuleScopeXyTraceFrameCount(length);
  const start = Math.max(0, length - frames);
  const x = new Float32Array(frames);
  const y = new Float32Array(frames);
  for (let index = 0; index < frames; index += 1) {
    x[index] = useLinearX
      ? (frames <= 1 ? 0 : (index / (frames - 1)) * 2 - 1)
      : Number(sourceX[start + index]) || 0;
    y[index] = Number(sourceY[start + index]) || 0;
  }
  return {
    length: frames,
    nodeGraphScopeCapturedOutput: true,
    nodeGraphScopeDrawProgress: 1,
    nodeGraphScopeUseFullWindow: true,
    nodeGraphScopeVisualPointLimit: frames,
    nodeGraphScopeXy: true,
    x,
    y,
  };
}

function nodeGraphModuleScopeCapturedScope2dBuffer(slot) {
  if (slot?.type !== "scope2d") {
    return null;
  }
  const xBuffer = nodeGraphModuleScopeState.buffers.get(`${slot.nodeId}:X`);
  const yBuffer = nodeGraphModuleScopeState.buffers.get(`${slot.nodeId}:Y`);
  const length = Math.min(xBuffer?.length || 0, yBuffer?.length || 0);
  if (length <= 0) {
    return null;
  }
  const x = new Float32Array(1);
  const y = new Float32Array(1);
  x[0] = Number(xBuffer[length - 1]) || 0;
  y[0] = Number(yBuffer[length - 1]) || 0;
  return {
    length: 1,
    nodeGraphScopeCapturedOutput: true,
    nodeGraphScopeDrawProgress: 1,
    nodeGraphScopeUseFullWindow: true,
    nodeGraphScopeVisualPointLimit: 1,
    nodeGraphScopeXy: true,
    x,
    y,
  };
}

function nodeGraphModuleScopeCapturedStereoNoiseXyBuffer(slot, capturedBuffer = null) {
  if (slot?.type !== "stereoNoise") {
    return null;
  }
  const xBuffer = nodeGraphModuleScopeState.buffers.get(`${slot.nodeId}:X`);
  const yBuffer = nodeGraphModuleScopeState.buffers.get(`${slot.nodeId}:Y`);
  const length = Math.min(xBuffer?.length || 0, yBuffer?.length || 0);
  if (length <= 1) {
    return null;
  }
  const frames = nodeGraphModuleScopeXyTraceFrameCount(length);
  const start = Math.max(0, length - frames);
  const x = new Float32Array(frames);
  const y = new Float32Array(frames);
  for (let index = 0; index < frames; index += 1) {
    x[index] = Number(xBuffer[start + index]) || 0;
    y[index] = Number(yBuffer[start + index]) || 0;
  }
  return {
    length: frames,
    nodeGraphScopeCapturedOutput: true,
    nodeGraphScopeDrawProgress: 1,
    nodeGraphScopeUseFullWindow: true,
    nodeGraphScopeVisualPointLimit: frames,
    nodeGraphScopeXy: true,
    x,
    y,
  };
}

function captureNodeGraphLiveModuleScopeOutput(runtime, nodeId, output) {
  const id = String(nodeId || "");
  if (!id) {
    return;
  }
  const samples = runtime.scopeBuffers.get(id) || [];
  samples.push(nodeGraphModuleScopeScalarValue(output));
  runtime.scopeBuffers.set(id, samples);
  if (!output || typeof output !== "object") {
    return;
  }
  for (const [port, value] of Object.entries(output)) {
    if (!port || !Number.isFinite(Number(value))) {
      continue;
    }
    const portId = `${id}:${port}`;
    const portSamples = runtime.scopeBuffers.get(portId) || [];
    portSamples.push(nodeGraphModuleScopeScalarValue(value));
    runtime.scopeBuffers.set(portId, portSamples);
  }
}

function resizeNodeGraphLiveModuleScopeBuffer(buffer, frameCapacity) {
  const capacity = Math.max(0, Math.floor(Number(frameCapacity) || 0));
  if (capacity <= 0) {
    return new Float32Array(0);
  }
  if (buffer instanceof Float32Array && buffer.length === capacity) {
    return buffer;
  }
  const next = new Float32Array(capacity);
  if (!buffer?.length) {
    return next;
  }
  const sourceStart = Math.max(0, buffer.length - capacity);
  const copyCount = Math.min(capacity, buffer.length - sourceStart);
  const targetStart = capacity - copyCount;
  next.set(buffer.subarray(sourceStart, sourceStart + copyCount), targetStart);
  return next;
}

function pushNodeGraphLiveModuleScopeSamples(nodeId, values) {
  const id = String(nodeId || "");
  if (!id) {
    return;
  }
  const frameCapacity = nodeGraphLiveModuleScopeFrameCapacity();
  nodeGraphModuleScopeState.frames = frameCapacity;
  let buffer = nodeGraphModuleScopeState.buffers.get(id);
  if (!buffer || buffer.length !== frameCapacity) {
    buffer = resizeNodeGraphLiveModuleScopeBuffer(buffer, frameCapacity);
    nodeGraphModuleScopeState.buffers.set(id, buffer);
  }
  const samples = Array.isArray(values) || ArrayBuffer.isView(values)
    ? [...values].map(nodeGraphModuleScopeScalarValue)
    : [nodeGraphModuleScopeScalarValue(values)];
  const count = Math.min(buffer.length, samples.length);
  if (count <= 0) {
    return;
  }
  if (count < buffer.length) {
    buffer.copyWithin(0, count);
  }
  const start = samples.length - count;
  for (let index = 0; index < count; index += 1) {
    buffer[buffer.length - count + index] = samples[start + index] || 0;
  }
  nodeGraphModuleScopeState.versionSerial = (Number(nodeGraphModuleScopeState.versionSerial) || 0) + 1;
  buffer.nodeGraphScopeVersion = nodeGraphModuleScopeState.versionSerial;
}

function pushNodeGraphLiveModuleScopeSnapshot(values, options = {}) {
  if (!values) {
    return;
  }
  const patchFingerprint = String(options.patchFingerprint || nodeGraphPatchFingerprint());
  if (nodeGraphModuleScopeState.mode !== "live") {
    beginNodeGraphLiveModuleScopeCapture({
      nodes: [],
      order: values instanceof Map ? [...values.keys()] : values.map?.((entry) => entry?.[0]) || [],
      patchFingerprint,
    });
  }
  if (nodeGraphModuleScopeState.patchFingerprint !== patchFingerprint) {
    updateNodeGraphLiveModuleScopeFingerprint(patchFingerprint);
  }
  if (Number.isFinite(Number(options.sampleRate)) && Number(options.sampleRate) > 0) {
    nodeGraphModuleScopeState.sampleRate = Number(options.sampleRate);
  }
  const entries = values instanceof Map ? values.entries() : values;
  for (const entry of entries || []) {
    if (!entry) {
      continue;
    }
    pushNodeGraphLiveModuleScopeSamples(entry[0], entry[1]);
  }
  scheduleNodeGraphModuleScopeDraw();
}

function captureNodeGraphLiveModuleScopeFrame(runtime, sampleRate) {
  if (!runtime?.nodeOutputs?.size) {
    return;
  }
  const interval = Math.max(1, Math.floor((Number(sampleRate) || nodeGraphMvp.sampleRate || 44100) / 30));
  runtime.scopeBuffers ||= new Map();
  for (const nodeId of runtime.order || runtime.nodeOutputs.keys()) {
    if (!runtime.nodeOutputs.has(nodeId)) {
      continue;
    }
    captureNodeGraphLiveModuleScopeOutput(runtime, nodeId, runtime.nodeOutputs.get(nodeId));
  }
  for (const sink of runtime.visualSinks || []) {
    const nodeId = String(sink?.nodeId || "");
    if (!nodeId) {
      continue;
    }
    let value = 0;
    for (const input of sink.inputs || []) {
      if (!input?.connected) {
        continue;
      }
      const inputValue = (input.connections || []).reduce(
        (connectionSum, connection) => connectionSum + readNodeGraphRuntimePortOutput(
          runtime,
          null,
          connection.sourceNode,
          connection.sourcePort,
          0,
          1,
        ),
        0,
      );
      value += inputValue;
      const inputPort = String(input.port || "").trim();
      if (input?.buffered && inputPort) {
        writeNodeGraphVisualInputBufferSample(runtime, nodeId, inputPort, inputValue, sink.bufferSampleLimit);
      }
      if (inputPort) {
        const portId = `${nodeId}:${inputPort}`;
        const portSamples = runtime.scopeBuffers.get(portId) || [];
        portSamples.push(nodeGraphModuleScopeScalarValue(inputValue));
        runtime.scopeBuffers.set(portId, portSamples);
      }
    }
    const samples = runtime.scopeBuffers.get(nodeId) || [];
    samples.push(nodeGraphModuleScopeScalarValue(value));
    runtime.scopeBuffers.set(nodeId, samples);
  }
  runtime.scopeCounter = (runtime.scopeCounter || 0) + 1;
  if (runtime.scopeCounter < interval) {
    return;
  }
  runtime.scopeCounter = 0;
  pushNodeGraphLiveModuleScopeSnapshot(runtime.scopeBuffers, {
    patchFingerprint: nodeGraphPatchFingerprint(),
    sampleRate,
  });
  runtime.scopeBuffers = new Map();
}

function createNodeGraphVisualInputBuffer(capacity = nodeGraphBufferedInputSampleLimit) {
  const safeCapacity = Math.max(1, Math.min(1048576, Math.round(Number(capacity) || nodeGraphBufferedInputSampleLimit)));
  return {
    absoluteFrame: 0,
    buffer: new Float32Array(safeCapacity),
    capacity: safeCapacity,
    length: 0,
    writeIndex: 0,
  };
}

function syncNodeGraphVisualInputBuffers(runtime) {
  if (!runtime) {
    return;
  }
  runtime.visualInputBuffers ||= new Map();
  const expected = new Map();
  for (const sink of runtime.visualSinks || []) {
    const nodeId = String(sink?.nodeId || "");
    if (!nodeId) {
      continue;
    }
    for (const input of sink.inputs || []) {
      if (!input?.buffered) {
        continue;
      }
      const port = String(input.port || "").trim();
      if (!port) {
        continue;
      }
      expected.set(`${nodeId}:${port}`, Math.max(1, Math.min(1048576, Math.round(Number(sink.bufferSampleLimit) || nodeGraphBufferedInputSampleLimit))));
    }
  }
  for (const [key, capacity] of expected) {
    const current = runtime.visualInputBuffers.get(key);
    if (!current || current.capacity !== capacity) {
      runtime.visualInputBuffers.set(key, createNodeGraphVisualInputBuffer(capacity));
    }
  }
  for (const key of [...runtime.visualInputBuffers.keys()]) {
    if (!expected.has(key)) {
      runtime.visualInputBuffers.delete(key);
    }
  }
}

function writeNodeGraphVisualInputBufferSample(runtime, nodeId, port, value, capacity = nodeGraphBufferedInputSampleLimit) {
  if (!runtime || !nodeId || !port) {
    return;
  }
  runtime.visualInputBuffers ||= new Map();
  const safeCapacity = Math.max(1, Math.min(1048576, Math.round(Number(capacity) || nodeGraphBufferedInputSampleLimit)));
  const key = `${nodeId}:${port}`;
  let state = runtime.visualInputBuffers.get(key);
  if (!state || state.capacity !== safeCapacity) {
    state = createNodeGraphVisualInputBuffer(safeCapacity);
    runtime.visualInputBuffers.set(key, state);
  }
  state.buffer[state.writeIndex] = nodeGraphModuleScopeScalarValue(value);
  state.writeIndex = (state.writeIndex + 1) % state.capacity;
  state.length = Math.min(state.capacity, state.length + 1);
  state.absoluteFrame += 1;
}

function writeVisualInputBufferSample(runtime, nodeId, port, value, capacity = nodeGraphBufferedInputSampleLimit) {
  writeNodeGraphVisualInputBufferSample(runtime, nodeId, port, value, capacity);
}

function nodeGraphModuleScopeBuffersCurrent() {
  if (nodeGraphModuleScopeHasModelDisplay()) {
    return true;
  }
  if (!nodeGraphModuleScopeState.buffers.size) {
    return false;
  }
  const patch = nodeGraphMvp?.patch;
  if (nodeGraphModuleScopeState.mode === "live") {
    return Boolean(nodeGraphMvp?.live?.node);
  }
  return nodeGraphModuleScopeState.patchFingerprint === nodeGraphPatchFingerprint()
    && nodeGraphModuleScopeState.monitorFingerprint === nodeGraphModuleScopeMonitorFingerprint(
      nodeGraphModuleScopeCaptureMonitors(patch),
    );
}

function clearNodeGraphModuleScopeCanvas() {
  const canvas = nodeGraphModuleScopeCanvas();
  const lightCanvas = nodeGraphModuleScopeLightCanvas();
  if (lightCanvas) {
    const context = lightCanvas.getContext("2d");
    context?.clearRect(0, 0, lightCanvas.width, lightCanvas.height);
  }
  if (!canvas) return;
  if (nodeGraphModuleScopeState.renderer?.kind === "webgl") {
    const gl = nodeGraphModuleScopeState.renderer.gl;
    gl.viewport(0, 0, canvas.width, canvas.height);
    for (const target of nodeGraphModuleScopeState.renderer.phosphorTargets || []) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    nodeGraphModuleScopeState.renderer.phosphorPrimed = false;
    return;
  }
  canvas.width = canvas.width;
}

function nodeGraphModuleScopeTracesOff() {
  const value = Number(nodeGraphMvp?.visualControls?.scopeTracesOff) || 0;
  return value > 0.5;
}

function nodeGraphModuleScopeCircuitRunning() {
  const live = nodeGraphMvp?.live || {};
  const contextState = String(live.context?.state || "");
  return Boolean(
    live.outputEnabled &&
    live.node &&
    live.context &&
    contextState !== "closed" &&
    contextState !== "suspended"
  );
}

function nodeGraphModuleScopePaused() {
  const visualPause = Number(nodeGraphMvp?.visualControls?.scopePaused) || 0;
  if (visualPause > 0.5) {
    return true;
  }
  if (!nodeGraphModuleScopeCircuitRunning()) {
    return true;
  }
  return !nodeGraphModuleScopeHasModelDisplay() && !nodeGraphModuleScopeHasRenderableSlots();
}

function nodeGraphModuleScopeBackingPixelRatio(rect, requestedPixelRatio = window.devicePixelRatio || 1) {
  const width = Math.max(1, Number(rect?.width) || 1);
  const height = Math.max(1, Number(rect?.height) || 1);
  const requested = Math.max(0.25, Number(requestedPixelRatio) || 1);
  const maxSize = Math.max(256, Number(nodeGraphModuleScopeMaxBackingStoreSize) || 4096);
  return Math.max(
    0.25,
    Math.min(
      requested,
      maxSize / width,
      maxSize / height,
    ),
  );
}

function syncNodeGraphModuleScopeCanvas() {
  const canvas = nodeGraphModuleScopeCanvas();
  const lightCanvas = nodeGraphModuleScopeLightCanvas();
  const workspace = document.getElementById("nodeGraphWorkspace");
  if (!canvas || !workspace) {
    return false;
  }

  const rect = workspace.getBoundingClientRect();
  const pixelRatio = nodeGraphModuleScopeBackingPixelRatio(rect);
  const width = Math.max(1, Math.round(rect.width * pixelRatio));
  const height = Math.max(1, Math.round(rect.height * pixelRatio));
  nodeGraphModuleScopeState.backingPixelRatio = pixelRatio;
  if (nodeGraphModuleScopeState.renderer?.canvas === canvas) {
    nodeGraphModuleScopeState.renderer.pixelRatio = pixelRatio;
  }
  if (canvas.width !== width) {
    canvas.width = width;
    if (nodeGraphModuleScopeState.renderer?.canvas === canvas) {
      resizeNodeGraphModuleScopePhosphorTargets(nodeGraphModuleScopeState.renderer);
    }
  }
  if (canvas.height !== height) {
    canvas.height = height;
    if (nodeGraphModuleScopeState.renderer?.canvas === canvas) {
      resizeNodeGraphModuleScopePhosphorTargets(nodeGraphModuleScopeState.renderer);
    }
  }
  if (lightCanvas) {
    if (lightCanvas.width !== width) {
      lightCanvas.width = width;
    }
    if (lightCanvas.height !== height) {
      lightCanvas.height = height;
    }
  }
  return true;
}

function createNodeGraphModuleScopeShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("module scope shader compile failed", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createNodeGraphModuleScopeProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = createNodeGraphModuleScopeShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createNodeGraphModuleScopeShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) {
    return null;
  }
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("module scope shader link failed", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function createNodeGraphModuleScopeTexture(gl, width, height) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    Math.max(1, width),
    Math.max(1, height),
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
  return texture;
}

function createNodeGraphModuleScopeFramebuffer(gl, texture) {
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  return framebuffer;
}

function resizeNodeGraphModuleScopePhosphorTargets(renderer) {
  const { canvas, gl } = renderer;
  if (renderer.targetWidth === canvas.width && renderer.targetHeight === canvas.height) {
    return true;
  }
  for (const target of renderer.phosphorTargets || []) {
    if (target.framebuffer) {
      gl.deleteFramebuffer(target.framebuffer);
    }
    if (target.texture) {
      gl.deleteTexture(target.texture);
    }
  }
  renderer.phosphorTargets = [0, 1].map(() => {
    const texture = createNodeGraphModuleScopeTexture(gl, canvas.width, canvas.height);
    return {
      framebuffer: createNodeGraphModuleScopeFramebuffer(gl, texture),
      texture,
    };
  });
  renderer.phosphorReadIndex = 0;
  renderer.phosphorPrimed = false;
  renderer.targetWidth = canvas.width;
  renderer.targetHeight = canvas.height;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return renderer.phosphorTargets.every((target) => target.framebuffer && target.texture);
}

function createNodeGraphModuleScopeWebGlRenderer(canvas) {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
  }) || canvas.getContext("experimental-webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
  });
  if (!gl) {
    return null;
  }

  const colorProgram = createNodeGraphModuleScopeProgram(gl, `
    attribute vec2 aPosition;
    void main() {
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `, `
    precision mediump float;
    uniform vec4 uColor;
    void main() {
      gl_FragColor = uColor;
    }
  `);
  const textureProgram = createNodeGraphModuleScopeProgram(gl, `
    attribute vec2 aPosition;
    attribute vec2 aTexCoord;
    varying vec2 vTexCoord;
    void main() {
      vTexCoord = aTexCoord;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `, `
    precision mediump float;
    uniform sampler2D uTexture;
    uniform float uDecayFast;
    uniform float uDecaySlow;
    uniform float uFloorFade;
    uniform vec2 uTexelOffset;
    uniform int uMode;
    varying vec2 vTexCoord;
    void main() {
      vec4 color = texture2D(uTexture, vTexCoord + uTexelOffset);
      if (uMode == 1) {
        float energy = max(max(color.r, color.g), color.b);
        float bright = smoothstep(0.12, 0.86, energy);
        float decay = mix(uDecaySlow, uDecayFast, bright);
        color.rgb = max(color.rgb * decay - vec3(uFloorFade), vec3(0.0));
        color.a = max(max(color.r, color.g), color.b);
      }
      gl_FragColor = color;
    }
  `);
  const beamProgram = createNodeGraphModuleScopeProgram(gl, `
    attribute vec2 aStart;
    attribute vec2 aEnd;
    attribute float aCorner;
    attribute float aPointAge;
    uniform vec2 uCanvasSize;
    uniform float uSize;
    varying vec2 vStart;
    varying vec2 vEnd;
    varying vec2 vPosition;
    varying float vPointAge;
    void main() {
      vec2 segment = aEnd - aStart;
      float segmentLength = max(length(segment), 0.0001);
      vec2 tangent = segment / segmentLength;
      vec2 normal = vec2(-tangent.y, tangent.x);
      float side = (aCorner == 0.0 || aCorner == 2.0) ? 1.0 : -1.0;
      float endpointMix = aCorner < 2.0 ? 0.0 : 1.0;
      float cap = aCorner < 2.0 ? -1.0 : 1.0;
      float beamHalfWidth = max(uSize * 1.85, 1.5);
      vec2 endpoint = mix(aStart, aEnd, endpointMix);
      vec2 position = endpoint + normal * side * beamHalfWidth + tangent * cap * beamHalfWidth;
      vStart = aStart;
      vEnd = aEnd;
      vPosition = position;
      vPointAge = aPointAge;
      vec2 clip = vec2(
        (position.x / uCanvasSize.x) * 2.0 - 1.0,
        1.0 - (position.y / uCanvasSize.y) * 2.0
      );
      gl_Position = vec4(clip, 0.0, 1.0);
    }
  `, `
    precision highp float;
    uniform vec3 uColor;
    uniform float uIntensity;
    uniform float uSize;
    varying vec2 vStart;
    varying vec2 vEnd;
    varying vec2 vPosition;
    varying float vPointAge;
    void main() {
      vec2 segment = vEnd - vStart;
      float segmentLengthSquared = max(dot(segment, segment), 0.0001);
      float along = clamp(dot(vPosition - vStart, segment) / segmentLengthSquared, 0.0, 1.0);
      vec2 closest = vStart + segment * along;
      float radius = max(uSize * 0.34, 0.0001);
      float normalizedDistance = length(vPosition - closest) / radius;
      if (normalizedDistance > 5.4) {
        discard;
      }
      float distanceSquared = normalizedDistance * normalizedDistance;
      float halo = exp(-distanceSquared * 0.52);
      float gaussian = exp(-distanceSquared * 3.1);
      float core = exp(-distanceSquared * 18.0);
      float alpha = clamp((halo * 0.12 + gaussian * 0.62 + core * 0.26) * uIntensity, 0.0, 1.0);
      gl_FragColor = vec4(uColor * alpha, alpha);
    }
  `);
  if (!colorProgram || !textureProgram || !beamProgram) {
    if (colorProgram) {
      gl.deleteProgram(colorProgram);
    }
    if (textureProgram) {
      gl.deleteProgram(textureProgram);
    }
    if (beamProgram) {
      gl.deleteProgram(beamProgram);
    }
    return null;
  }

  const renderer = {
    beamBuffer: gl.createBuffer(),
    beamCanvasSizeLocation: gl.getUniformLocation(beamProgram, "uCanvasSize"),
    beamColorLocation: gl.getUniformLocation(beamProgram, "uColor"),
    beamCornerLocation: gl.getAttribLocation(beamProgram, "aCorner"),
    beamEndLocation: gl.getAttribLocation(beamProgram, "aEnd"),
    beamIntensityLocation: gl.getUniformLocation(beamProgram, "uIntensity"),
    beamPointAgeLocation: gl.getAttribLocation(beamProgram, "aPointAge"),
    beamProgram,
    beamSizeLocation: gl.getUniformLocation(beamProgram, "uSize"),
    beamStartLocation: gl.getAttribLocation(beamProgram, "aStart"),
    canvas,
    colorLocation: gl.getUniformLocation(colorProgram, "uColor"),
    colorPositionBuffer: gl.createBuffer(),
    colorPositionLocation: gl.getAttribLocation(colorProgram, "aPosition"),
    colorProgram,
    gl,
    kind: "webgl",
    phosphorPrimed: false,
    phosphorReadIndex: 0,
    phosphorTargets: [],
    quadBuffer: gl.createBuffer(),
    targetHeight: 0,
    targetWidth: 0,
    textureDecayFastLocation: gl.getUniformLocation(textureProgram, "uDecayFast"),
    textureDecaySlowLocation: gl.getUniformLocation(textureProgram, "uDecaySlow"),
    textureFloorFadeLocation: gl.getUniformLocation(textureProgram, "uFloorFade"),
    textureModeLocation: gl.getUniformLocation(textureProgram, "uMode"),
    texturePositionLocation: gl.getAttribLocation(textureProgram, "aPosition"),
    textureProgram,
    textureSamplerLocation: gl.getUniformLocation(textureProgram, "uTexture"),
    textureTexelOffsetLocation: gl.getUniformLocation(textureProgram, "uTexelOffset"),
    textureTexCoordLocation: gl.getAttribLocation(textureProgram, "aTexCoord"),
  };
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  resizeNodeGraphModuleScopePhosphorTargets(renderer);
  return renderer;
}

function nodeGraphModuleScopeRenderer(canvas) {
  const current = nodeGraphModuleScopeState.renderer;
  if (current?.canvas === canvas) {
    return current;
  }
  const renderer = createNodeGraphModuleScopeWebGlRenderer(canvas);
  nodeGraphModuleScopeState.renderer = renderer;
  document.getElementById("nodeGraphWorkspace")
    ?.classList.toggle("module-scopes-webgl-unavailable", !renderer);
  return renderer;
}

function nodeGraphModuleScopeThreshold(buffer, start = 0, end = buffer.length) {
  let min = Infinity;
  let max = -Infinity;
  for (let index = Math.max(0, start); index < Math.min(buffer.length, end); index += 1) {
    const value = Number(buffer[index]) || 0;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || max - min < 1e-5) {
    return null;
  }
  return (min + max) * 0.5;
}

function nodeGraphModuleScopeRisingCrossings(buffer, threshold, start = 1, end = buffer.length) {
  const crossings = [];
  const first = Math.max(1, Math.floor(start));
  const limit = Math.min(buffer.length, Math.ceil(end));
  for (let index = first; index < limit; index += 1) {
    const previous = Number(buffer[index - 1]) || 0;
    const current = Number(buffer[index]) || 0;
    if (previous <= threshold && current > threshold) {
      const delta = current - previous;
      const fraction = Math.abs(delta) > 1e-12
        ? clampNodeSliderValue((threshold - previous) / delta, 0, 1)
        : 0;
      crossings.push((index - 1) + fraction);
    }
  }
  return crossings;
}

function nodeGraphModuleScopeMedianPeriod(crossings) {
  if (!Array.isArray(crossings) || crossings.length < 2) {
    return null;
  }
  const distances = [];
  for (let index = 1; index < crossings.length; index += 1) {
    const distance = crossings[index] - crossings[index - 1];
    if (distance >= 2) {
      distances.push(distance);
    }
  }
  if (!distances.length) {
    return null;
  }
  distances.sort((a, b) => a - b);
  const periodSamples = distances[Math.floor(distances.length / 2)];
  return Number.isFinite(periodSamples) && periodSamples > 0 ? periodSamples : null;
}

function nodeGraphModuleScopeLowpassSyncTrace(buffer, start, end, periodSamples = 0) {
  const first = Math.max(0, Math.floor(start));
  const limit = Math.min(buffer.length, Math.ceil(end));
  if (limit - first < 3) {
    return null;
  }
  const threshold = nodeGraphModuleScopeThreshold(buffer, first, limit);
  if (threshold === null) {
    return null;
  }
  const sampleRate = Number(nodeGraphModuleScopeState.sampleRate) || nodeGraphMvp.sampleRate || 44100;
  const fundamental = periodSamples > 0 ? sampleRate / periodSamples : 120;
  const cutoff = clampNodeSliderValue(fundamental * 4, 20, sampleRate * 0.45);
  const alpha = clampNodeSliderValue(1 - Math.exp((-2 * Math.PI * cutoff) / Math.max(1, sampleRate)), 0.001, 1);
  const trace = new Float32Array(limit - first);
  let y1 = (Number(buffer[first]) || 0) - threshold;
  let y2 = y1;
  let y3 = y1;
  let y4 = y1;
  for (let index = first; index < limit; index += 1) {
    const input = (Number(buffer[index]) || 0) - threshold;
    y1 += (input - y1) * alpha;
    y2 += (y1 - y2) * alpha;
    y3 += (y2 - y3) * alpha;
    y4 += (y3 - y4) * alpha;
    trace[index - first] = y4;
  }
  return {
    start: first,
    threshold,
    trace,
  };
}

function nodeGraphModuleScopeTraceRisingCrossings(trace, start = 1, end = trace?.length || 0, offset = 0) {
  return nodeGraphModuleScopeRisingCrossings(trace || [], 0, start, end)
    .map((crossing) => crossing + offset);
}

function nodeGraphModuleScopeSyncBuffer(buffer) {
  return buffer?.nodeGraphScopeSyncBuffer?.length === buffer?.length
    ? buffer.nodeGraphScopeSyncBuffer
    : buffer;
}

function nodeGraphModuleScopeEstimatedCycle(buffer) {
  const syncBuffer = nodeGraphModuleScopeSyncBuffer(buffer);
  const hintedPeriodSamples = Number(buffer?.nodeGraphScopePeriodSamples);
  if (syncBuffer?.length && Number.isFinite(hintedPeriodSamples) && hintedPeriodSamples > 0) {
    const searchStart = Math.max(0, syncBuffer.length - Math.min(syncBuffer.length, 8192));
    return {
      periodSamples: hintedPeriodSamples,
      threshold: nodeGraphModuleScopeThreshold(syncBuffer, searchStart, syncBuffer.length),
    };
  }
  const searchStart = Math.max(0, syncBuffer.length - Math.min(syncBuffer.length, 8192));
  const threshold = nodeGraphModuleScopeThreshold(syncBuffer, searchStart, syncBuffer.length);
  if (threshold === null) {
    return null;
  }
  const crossings = nodeGraphModuleScopeRisingCrossings(syncBuffer, threshold, searchStart + 1, syncBuffer.length);
  const rawPeriodSamples = nodeGraphModuleScopeMedianPeriod(crossings);
  if (!rawPeriodSamples) {
    return null;
  }
  const syncTrace = nodeGraphModuleScopeLowpassSyncTrace(syncBuffer, searchStart, syncBuffer.length, rawPeriodSamples);
  const syncCrossings = nodeGraphModuleScopeTraceRisingCrossings(syncTrace?.trace, 1, syncTrace?.trace?.length || 0, searchStart);
  const periodSamples = nodeGraphModuleScopeMedianPeriod(syncCrossings) || rawPeriodSamples;
  return { periodSamples, threshold };
}

function nodeGraphModuleScopeTriggeredStart(syncBuffer, cycleEstimate, visibleSamples) {
  const periodSamples = Number(cycleEstimate?.periodSamples) || 0;
  if (!syncBuffer?.length || !Number.isFinite(periodSamples) || periodSamples <= 0) {
    return null;
  }
  const searchSpan = Math.min(
    syncBuffer.length,
    Math.max(visibleSamples + periodSamples * 6, 1024),
  );
  const searchStart = Math.max(1, syncBuffer.length - Math.ceil(searchSpan));
  const searchEnd = syncBuffer.length;
  const syncTrace = nodeGraphModuleScopeLowpassSyncTrace(
    syncBuffer,
    searchStart,
    searchEnd,
    periodSamples,
  );
  let crossings = nodeGraphModuleScopeTraceRisingCrossings(
    syncTrace?.trace,
    1,
    syncTrace?.trace?.length || 0,
    syncTrace?.start || 0,
  );
  if (!crossings.length && cycleEstimate.threshold !== null) {
    crossings = nodeGraphModuleScopeRisingCrossings(
      syncBuffer,
      cycleEstimate.threshold,
      searchStart,
      searchEnd,
    );
  }
  for (let index = crossings.length - 1; index >= 0; index -= 1) {
    const crossing = crossings[index];
    const start = crossing - visibleSamples;
    if (Number.isFinite(start) && start >= 0 && crossing < syncBuffer.length - 1) {
      return start;
    }
  }
  return null;
}

function nodeGraphModuleScopeVisibleSamples(buffer, settings, cycleEstimate) {
  const cycles = nodeGraphModuleScopeEffectiveCycles(settings);
  if (cycleEstimate?.periodSamples) {
    return Math.min(buffer.length, Math.max(8, cycleEstimate.periodSamples * cycles));
  }
  const sampleRate = Number(nodeGraphModuleScopeState.sampleRate) || nodeGraphMvp.sampleRate || 44100;
  const cycleRatio = Math.max(
    0.001,
    (Number(cycles) || nodeGraphModuleScopeDefaultSettings.cycles) /
      Math.max(0.001, nodeGraphModuleScopeDefaultSettings.cycles),
  );
  return settings.timeMs > 0
    ? Math.min(buffer.length, Math.max(8, Math.round((settings.timeMs / 1000) * sampleRate * cycleRatio)))
    : buffer.length;
}

function nodeGraphTraceDisplayVisibleSamples(buffer, settings) {
  const safeSettings = normalizeNodeGraphTraceDisplaySettings(settings);
  const sampleRate = Number(nodeGraphModuleScopeState.sampleRate) || nodeGraphMvp.sampleRate || 44100;
  const requestedSamples = safeSettings.zoomSeconds * sampleRate;
  if (requestedSamples === Infinity) {
    return buffer.length;
  }
  if (!Number.isFinite(requestedSamples)) {
    return 0;
  }
  return Math.max(0, Math.min(buffer.length, Math.round(requestedSamples)));
}

function nodeGraphTraceDisplayBufferView(buffer, slot) {
  const settings = nodeGraphTraceDisplaySettingsForSlot(slot);
  const syncBuffer = nodeGraphModuleScopeSyncBuffer(buffer);
  const estimatedCycle = settings.sourceSync
    ? nodeGraphModuleScopeEstimatedCycle(buffer)
    : null;
  const visibleSamples = nodeGraphTraceDisplayVisibleSamples(buffer, settings);
  let start = Math.max(0, buffer.length - visibleSamples);
  if (settings.sourceSync && estimatedCycle && visibleSamples < buffer.length) {
    const triggeredStart = nodeGraphModuleScopeTriggeredStart(syncBuffer || buffer, estimatedCycle, visibleSamples);
    if (triggeredStart !== null) {
      start = triggeredStart;
    }
  }
  return {
    end: Math.min(buffer.length, start + visibleSamples),
    gain: Math.max(0, Number(nodeGraphModuleScopeNodeParam(nodeGraphModuleScopeNodeForSlot(slot), "gain", 1)) || 0),
    offset: clampNodeSliderValue(
      Number(nodeGraphModuleScopeNodeParam(nodeGraphModuleScopeNodeForSlot(slot), "offset", 0)) || 0,
      -1,
      1,
    ),
    start,
  };
}

function nodeGraphModuleScopeBufferView(buffer, slot) {
  const settings = nodeGraphModuleScopeEffectiveSettingForSlot(slot);
  if (slot?.type === "traceDisplay") {
    return nodeGraphTraceDisplayBufferView(buffer, slot);
  }
  if (buffer?.nodeGraphScopeUseFullWindow) {
    return {
      end: buffer.length,
      gain: nodeGraphModuleScopeVisualGain(settings),
      offset: settings.offset,
      start: 0,
    };
  }
  const estimatedCycle = nodeGraphModuleScopeEstimatedCycle(buffer);
  const cycleEstimate = settings.sync ? estimatedCycle : null;
  const visibleSamples = nodeGraphModuleScopeVisibleSamples(buffer, settings, estimatedCycle);
  const syncBuffer = nodeGraphModuleScopeSyncBuffer(buffer);
  const defaultStart = Math.max(0, buffer.length - visibleSamples);
  let start = defaultStart;
  if (settings.sync && cycleEstimate && visibleSamples < buffer.length) {
    const triggeredStart = nodeGraphModuleScopeTriggeredStart(syncBuffer, cycleEstimate, visibleSamples);
    if (triggeredStart !== null) {
      start = triggeredStart;
    } else {
      const searchStart = Math.max(1, defaultStart - Math.round(cycleEstimate.periodSamples * 2));
      const searchEnd = Math.min(buffer.length, defaultStart + Math.round(cycleEstimate.periodSamples * 2));
      const fallbackCrossings = nodeGraphModuleScopeRisingCrossings(
        syncBuffer,
        cycleEstimate.threshold,
        searchStart,
        searchEnd,
      );
      if (fallbackCrossings.length) {
        start = fallbackCrossings.reduce((best, crossing) =>
          Math.abs(crossing - defaultStart) < Math.abs(best - defaultStart) ? crossing : best);
      }
    }
  }
  const rawPanCycles = Number(settings.pan) || 0;
  const panCycles = settings.sync && cycleEstimate
    ? Math.round(rawPanCycles)
    : rawPanCycles;
  const panSamples = panCycles
    ? (cycleEstimate?.periodSamples || visibleSamples) * panCycles
    : 0;
  start = clampNodeSliderValue(start - panSamples, 0, Math.max(0, buffer.length - visibleSamples));
  return {
    end: Math.min(buffer.length, start + visibleSamples),
    gain: nodeGraphModuleScopeVisualGain(settings),
    offset: settings.offset,
    start,
  };
}

function nodeGraphModuleScopeInterpolatedSample(buffer, position) {
  const samplePosition = clampNodeSliderValue(Number(position) || 0, 0, Math.max(0, buffer.length - 1));
  const leftIndex = Math.floor(samplePosition);
  const rightIndex = Math.min(buffer.length - 1, leftIndex + 1);
  const blend = samplePosition - leftIndex;
  const left = Number(buffer[leftIndex]) || 0;
  const right = Number(buffer[rightIndex]) || left;
  return left + (right - left) * blend;
}

function nodeGraphModuleScopeSampleInfo(buffer, position) {
  const samplePosition = clampNodeSliderValue(Number(position) || 0, 0, Math.max(0, buffer.length - 1));
  const leftIndex = Math.floor(samplePosition);
  const rightIndex = Math.min(buffer.length - 1, leftIndex + 1);
  const blend = samplePosition - leftIndex;
  const left = Number(buffer[leftIndex]) || 0;
  const right = Number(buffer[rightIndex]) || left;
  const discontinuity = rightIndex !== leftIndex &&
    Math.abs(right - left) > nodeGraphModuleScopeDiscontinuityThreshold;
  return {
    blend,
    discontinuity,
    left,
    right,
    value: left + (right - left) * blend,
  };
}

function nodeGraphModuleScopeBufferValue(buffer, position, view) {
  return clampNodeSliderValue((nodeGraphModuleScopeInterpolatedSample(buffer, position) * view.gain) + view.offset, -1, 1);
}

function nodeGraphModuleScopeMixColor(left, right, amount) {
  const mix = clampNodeSliderValue(Number(amount) || 0, 0, 1);
  return [
    left[0] + (right[0] - left[0]) * mix,
    left[1] + (right[1] - left[1]) * mix,
    left[2] + (right[2] - left[2]) * mix,
  ];
}

function nodeGraphModuleScopeTraceColors(slot) {
  const source = nodeGraphModuleScopeShaderSourceForSlot(slot);
  const core = nodeGraphScopeHexColorToRgb(
    nodeGraphModuleScopeShaderColor(
      source,
      "dot1",
      nodeGraphModuleScopeShaderGlobalColor("dot1"),
    ),
  );
  const haloBase = nodeGraphScopeHexColorToRgb(
    nodeGraphModuleScopeShaderColor(
      source,
      "dot2",
      nodeGraphModuleScopeShaderGlobalColor("dot2"),
    ),
  );
  const halo = nodeGraphModuleScopeMixColor(haloBase, [0, 0, 0], 0.15);
  return {
    core,
    halo,
  };
}

function nodeGraphModuleScopeHeatmapTraceColors() {
  return {
    core: [1, 1, 1],
    halo: [0.42, 0.42, 0.42],
  };
}

function nodeGraphModuleScopeDotStyle(slot, buffer) {
  const source = nodeGraphModuleScopeShaderSourceForSlot(slot);
  const coreFallback = nodeGraphModuleScopeShaderGlobalColor("dot1");
  const haloFallback = nodeGraphModuleScopeShaderGlobalColor("dot2");
  const coreSize = nodeGraphMvp?.moduleScopeDotCore1Enabled === false
    ? 0
    : nodeGraphModuleScopeShaderNumber(
      source,
      "dot1",
      "size",
      normalizeNodeGraphModuleScopeDotCoreSize(
        nodeGraphMvp?.moduleScopeDotCore1Size ?? nodeGraphModuleScopeDefaultDotCores.dot1.size,
        nodeGraphModuleScopeDefaultDotCores.dot1.size,
      ),
    );
  const haloSize = nodeGraphMvp?.moduleScopeDotCore2Enabled === false
    ? 0
    : nodeGraphModuleScopeShaderNumber(
      source,
      "dot2",
      "size",
      normalizeNodeGraphModuleScopeDotCoreSize(
        nodeGraphMvp?.moduleScopeDotCore2Size ?? nodeGraphModuleScopeDefaultDotCores.dot2.size,
        nodeGraphModuleScopeDefaultDotCores.dot2.size,
      ),
    );
  const coreBrightness = nodeGraphMvp?.moduleScopeDotCore1Enabled === false
    ? 0
    : nodeGraphModuleScopeShaderNumber(
      source,
      "dot1",
      "brightness",
      normalizeNodeGraphModuleScopeDotCoreBrightness(
        nodeGraphMvp?.moduleScopeDotCore1Brightness ?? nodeGraphModuleScopeDefaultDotCores.dot1.brightness,
        nodeGraphModuleScopeDefaultDotCores.dot1.brightness,
      ),
    );
  const haloBrightness = nodeGraphMvp?.moduleScopeDotCore2Enabled === false
    ? 0
    : nodeGraphModuleScopeShaderNumber(
      source,
      "dot2",
      "brightness",
      normalizeNodeGraphModuleScopeDotCoreBrightness(
        nodeGraphMvp?.moduleScopeDotCore2Brightness ?? nodeGraphModuleScopeDefaultDotCores.dot2.brightness,
        nodeGraphModuleScopeDefaultDotCores.dot2.brightness,
      ),
    );
  return {
    coreBrightness: clampNodeSliderValue(coreBrightness, 0, 40),
    coreColor: nodeGraphScopeHexColorToRgb(
      nodeGraphModuleScopeShaderColor(source, "dot1", coreFallback),
    ),
    coreSize: normalizeNodeGraphModuleScopeDotCoreSize(coreSize, nodeGraphModuleScopeDefaultDotCores.dot1.size),
    haloBrightness: clampNodeSliderValue(haloBrightness, 0, 40),
    haloColor: nodeGraphModuleScopeMixColor(
      nodeGraphScopeHexColorToRgb(
        nodeGraphModuleScopeShaderColor(source, "dot2", haloFallback),
      ),
      [0, 0, 0],
      0.15,
    ),
    haloSize: normalizeNodeGraphModuleScopeDotCoreSize(haloSize, nodeGraphModuleScopeDefaultDotCores.dot2.size),
  };
}

function nodeGraphModuleScopeZoomScale() {
  const zoom = typeof nodeGraphZoom === "function"
    ? nodeGraphZoom()
    : Number(nodeGraphMvp?.zoom);
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

function nodeGraphModuleScopeStrokeZoomScale() {
  return clampNodeSliderValue(nodeGraphModuleScopeZoomScale(), 0.35, 4);
}

function nodeGraphModuleScopeUnzoomedLength(value, zoomScale = nodeGraphModuleScopeZoomScale()) {
  const length = Number(value);
  const zoom = Number(zoomScale);
  if (!Number.isFinite(length) || length <= 0) {
    return 1;
  }
  if (!Number.isFinite(zoom) || zoom <= 0) {
    return length;
  }
  return Math.max(1, length / zoom);
}

function nodeGraphModuleScopeRenderedSampleWidth(rect, zoomScale = nodeGraphModuleScopeZoomScale()) {
  const width = Number(rect?.width);
  const sampleWidth = Number(rect?.sampleWidth);
  const zoom = Number(zoomScale);
  const renderedWidth = Number.isFinite(width) && width > 0 ? width : 0;
  const zoomedSampleWidth = Number.isFinite(sampleWidth) && sampleWidth > 0 && Number.isFinite(zoom) && zoom > 0
    ? sampleWidth * zoom
    : 0;
  return Math.max(1, renderedWidth, zoomedSampleWidth);
}

function nodeGraphModuleScopeVisibleMetricRect(rect, options = {}) {
  const visibleRect = options?.visibleRect;
  return visibleRect && Number(visibleRect.width) > 1 && Number(visibleRect.height) > 1
    ? visibleRect
    : rect;
}

function nodeGraphModuleScopePhosphorFrameReady(slot) {
  const key = String(slot?.nodeId || "__default");
  const fps = normalizeNodeGraphModuleScopeFramesPerSecond(nodeGraphMvp?.moduleScopeFramesPerSecond ?? 60);
  const now = Math.max(0, Number(nodeGraphModuleScopeState.animationTime) || 0);
  const state = nodeGraphModuleScopeState.phosphorFrame || {
    key: "",
    lastUpdate: 0,
  };
  if (state.key !== key || !Number.isFinite(Number(state.lastUpdate))) {
    nodeGraphModuleScopeState.phosphorFrame = {
      key,
      lastUpdate: now,
    };
    return true;
  }
  const tick = nodeGraphModuleScopeAdvanceFixedFrameClock(state, now, fps);
  if (!tick.ready) {
    return false;
  }
  nodeGraphModuleScopeState.phosphorFrame = {
    key,
    lastUpdate: tick.lastUpdate,
  };
  return true;
}

function beginNodeGraphModuleScopeRenderMetricsFrame() {
  const metrics = nodeGraphModuleScopeState.renderMetrics || {};
  metrics.drawCalls = 0;
  metrics.points = 0;
  metrics.vertices = 0;
  nodeGraphModuleScopeState.renderMetrics = metrics;
  return metrics;
}

function recordNodeGraphModuleScopeRenderMetrics(pointCount = 0, vertexCount = 0) {
  const metrics = nodeGraphModuleScopeState.renderMetrics || beginNodeGraphModuleScopeRenderMetricsFrame();
  metrics.drawCalls = (Number(metrics.drawCalls) || 0) + 1;
  metrics.points += Math.max(0, Math.floor(Number(pointCount) || 0));
  metrics.vertices += Math.max(0, Math.floor(Number(vertexCount) || 0));
}

function nodeGraphModuleScopeNowMs() {
  return performance.now?.() || Date.now();
}

function nodeGraphTraceDisplayTimingEnabled() {
  if (typeof window === "undefined") {
    return false;
  }
  return window.nodeGraphTraceDisplayTimingEnabled === true ||
    window.localStorage?.getItem?.("nodeGraphTraceDisplayTiming") === "1";
}

function nodeGraphTraceDisplayTimingObject(slot) {
  if (!nodeGraphTraceDisplayTimingEnabled()) {
    return null;
  }
  return {
    bufferViewMs: 0,
    drawArraysMs: 0,
    frameStartMs: nodeGraphModuleScopeNowMs(),
    glBufferDataMs: 0,
    nodeId: String(slot?.nodeId || ""),
    passes: 0,
    pointGenerationMs: 0,
    points: 0,
    totalMs: 0,
    vertexGenerationMs: 0,
    vertices: 0,
  };
}

function nodeGraphTraceDisplayDrawSignature(slot, item, buffer, settings) {
  return [
    Number(buffer?.nodeGraphScopeVersion) || 0,
    Math.round(Number(item?.scopeRect?.left) || 0),
    Math.round(Number(item?.scopeRect?.top) || 0),
    Math.round(Number(item?.scopeRect?.width) || 0),
    Math.round(Number(item?.scopeRect?.height) || 0),
    Math.round((Number(item?.visibleProgressRange?.[0]) || 0) * 10000),
    Math.round((Number(item?.visibleProgressRange?.[1]) || 0) * 10000),
    settings.zoomSeconds,
    settings.padding,
    settings.skipSamples,
    settings.lineThickness,
    settings.brightness,
    settings.color,
    settings.dot2LineThickness,
    settings.dot2Brightness,
    settings.dot2Color,
    settings.sourceSync === false ? 0 : 1,
  ].join("|");
}

function nodeGraphTraceDisplaySignatureUnchanged(slot, item, buffer, settings) {
  const nodeId = String(slot?.nodeId || "");
  if (!nodeId) {
    return false;
  }
  const signature = nodeGraphTraceDisplayDrawSignature(slot, item, buffer, settings);
  return nodeGraphModuleScopeState.traceDisplayDrawCache.get(nodeId) === signature;
}

function rememberNodeGraphTraceDisplaySignature(slot, item, buffer, settings) {
  const nodeId = String(slot?.nodeId || "");
  if (!nodeId) {
    return;
  }
  nodeGraphModuleScopeState.traceDisplayDrawCache.set(
    nodeId,
    nodeGraphTraceDisplayDrawSignature(slot, item, buffer, settings),
  );
}

function finishNodeGraphTraceDisplayTiming(timing) {
  if (!timing) {
    return;
  }
  timing.totalMs = Math.max(0, nodeGraphModuleScopeNowMs() - timing.frameStartMs);
  const debug = nodeGraphModuleScopeDebugState();
  debug.traceDisplayTiming = {
    bufferViewMs: Number(timing.bufferViewMs.toFixed(3)),
    drawArraysMs: Number(timing.drawArraysMs.toFixed(3)),
    glBufferDataMs: Number(timing.glBufferDataMs.toFixed(3)),
    nodeId: timing.nodeId,
    passes: timing.passes,
    pointGenerationMs: Number(timing.pointGenerationMs.toFixed(3)),
    points: timing.points,
    totalMs: Number(timing.totalMs.toFixed(3)),
    vertexGenerationMs: Number(timing.vertexGenerationMs.toFixed(3)),
    vertices: timing.vertices,
  };
  const now = nodeGraphModuleScopeNowMs();
  if (typeof console !== "undefined" && now - (Number(debug.traceDisplayTimingLastLogMs) || 0) > 500) {
    debug.traceDisplayTimingLastLogMs = now;
    console.table([debug.traceDisplayTiming]);
  }
}

function nodeGraphModuleScopeDebugState() {
  const debug = nodeGraphModuleScopeState.renderDebug || {};
  nodeGraphModuleScopeState.renderDebug = debug;
  return debug;
}

function setNodeGraphModuleScopeDebugPhase(phase, extra = {}) {
  const debug = nodeGraphModuleScopeDebugState();
  debug.phase = String(phase || "idle");
  Object.assign(debug, extra);
  return debug;
}

function markNodeGraphModuleScopeDebugSkip(reason) {
  const debug = setNodeGraphModuleScopeDebugPhase("skip", {
    lastSkipReason: String(reason || "unknown"),
  });
  debug.skippedFrames = (Number(debug.skippedFrames) || 0) + 1;
  pushNodeGraphModuleScopeDebugHistory(`skip:${debug.lastSkipReason}`);
  syncNodeGraphScopeGpuDebugDisplay();
}

function markNodeGraphModuleScopeDebugError(error) {
  const message = error?.message || String(error || "unknown error");
  setNodeGraphModuleScopeDebugPhase("error", {
    lastError: message.slice(0, 160),
    lastFrameEndMs: nodeGraphModuleScopeNowMs(),
  });
  pushNodeGraphModuleScopeDebugHistory("error");
  syncNodeGraphScopeGpuDebugDisplay();
}

function pushNodeGraphModuleScopeDebugHistory(reason = "frame") {
  const debug = nodeGraphModuleScopeDebugState();
  const history = Array.isArray(debug.debugHistory) ? debug.debugHistory : [];
  const now = nodeGraphModuleScopeNowMs();
  const entry = {
    ageMs: Math.max(0, now - (Number(debug.lastFrameEndMs) || now)),
    canvasHeight: Math.max(0, Math.floor(Number(debug.canvasHeight) || 0)),
    canvasWidth: Math.max(0, Math.floor(Number(debug.canvasWidth) || 0)),
    drawMs: Math.max(0, Number(debug.lastDrawMs) || 0),
    error: debug.lastError || "",
    phase: debug.phase || "idle",
    pixelRatio: Number(debug.pixelRatio) || 0,
    points: Math.max(0, Math.floor(Number(nodeGraphModuleScopeState.renderMetrics?.points) || 0)),
    reason: String(reason || "frame"),
    skippedFrames: Math.max(0, Math.floor(Number(debug.skippedFrames) || 0)),
    timeMs: now,
    totalSlots: Math.max(0, Math.floor(Number(debug.totalSlots) || 0)),
    vertices: Math.max(0, Math.floor(Number(nodeGraphModuleScopeState.renderMetrics?.vertices) || 0)),
    visibleItems: Math.max(0, Math.floor(Number(debug.visibleItems) || 0)),
    zoom: Number(debug.zoom) || 0,
  };
  history.push(entry);
  if (history.length > 120) {
    history.splice(0, history.length - 120);
  }
  debug.debugHistory = history;
  if (typeof window !== "undefined") {
    window.nodeGraphScopeDebugSnapshot = () => ({
      current: { ...nodeGraphModuleScopeDebugState() },
      metrics: { ...(nodeGraphModuleScopeState.renderMetrics || {}) },
      history: [...(nodeGraphModuleScopeDebugState().debugHistory || [])],
    });
  }
  return entry;
}

function commitNodeGraphModuleScopeRenderMetricsFrame(nowSeconds = (performance.now?.() || Date.now()) / 1000) {
  const metrics = nodeGraphModuleScopeState.renderMetrics || beginNodeGraphModuleScopeRenderMetricsFrame();
  const debug = nodeGraphModuleScopeDebugState();
  const now = Math.max(0, Number(nowSeconds) || 0);
  metrics.fpsFrames = (Number(metrics.fpsFrames) || 0) + 1;
  debug.committedFrames = (Number(debug.committedFrames) || 0) + 1;
  debug.lastFrameEndMs = nodeGraphModuleScopeNowMs();
  debug.lastDrawMs = Math.max(0, debug.lastFrameEndMs - (Number(debug.lastFrameStartMs) || debug.lastFrameEndMs));
  const last = Number(metrics.fpsLastTime) || 0;
  if (!last) {
    metrics.fpsLastTime = now;
  } else if (now - last >= 0.5) {
    metrics.fps = metrics.fpsFrames / Math.max(0.001, now - last);
    metrics.fpsFrames = 0;
    metrics.fpsLastTime = now;
  }
  pushNodeGraphModuleScopeDebugHistory("commit");
  syncNodeGraphScopeGpuMetricsDisplay();
}

function formatNodeGraphScopeGpuMetricFixedNumber(value, digits = 6) {
  const count = Math.max(0, Math.floor(Number(value) || 0));
  const width = Math.max(1, Math.floor(Number(digits) || 1));
  const max = (10 ** width) - 1;
  return String(Math.min(count, max)).padStart(width, "0");
}

function formatNodeGraphScopeGpuMetricFps(value) {
  const fps = Number(value);
  if (!Number.isFinite(fps) || fps <= 0) {
    return "---.-";
  }
  return Math.min(999.9, Math.max(0, fps)).toFixed(1).padStart(5, "0");
}

function syncNodeGraphScopeGpuMetricsDisplay() {
  const root = document.getElementById("nodeScopeGpuMetrics");
  if (!root) {
    return;
  }
  const metrics = nodeGraphModuleScopeState.renderMetrics || {};
  const fps = Number(metrics.fps);
  const points = Math.max(0, Math.floor(Number(metrics.points) || 0));
  const vertices = Math.max(0, Math.floor(Number(metrics.vertices) || 0));
  const fpsElement = root.querySelector("[data-scope-gpu-metric='fps']");
  const pointsElement = root.querySelector("[data-scope-gpu-metric='points']");
  if (fpsElement) {
    fpsElement.textContent = formatNodeGraphScopeGpuMetricFps(fps);
  }
  if (pointsElement) {
    pointsElement.textContent = formatNodeGraphScopeGpuMetricFixedNumber(points, 6);
  }
  root.dataset.scopePoints = String(points);
  root.dataset.scopeVertices = String(vertices);
  root.title = `scope vertices ${formatNodeGraphScopeGpuMetricFixedNumber(vertices, 6)}`;
  syncNodeGraphScopeGpuDebugDisplay();
}

function nodeGraphScopeGpuMetricsVisible(root = document.getElementById("nodeScopeGpuMetrics")) {
  return Boolean(root && document.body.classList.contains("node-constraint-gpu-active"));
}

function formatNodeGraphScopeGpuDebugNumber(value, digits = 3) {
  const number = Math.max(0, Math.floor(Number(value) || 0));
  return String(number).padStart(Math.max(1, digits), "0");
}

function formatNodeGraphScopeGpuDebugMs(value) {
  const number = Math.max(0, Number(value) || 0);
  return Math.min(9999, number).toFixed(number >= 100 ? 0 : 1).padStart(5, "0");
}

function syncNodeGraphScopeGpuDebugDisplay() {
  const root = document.getElementById("nodeScopeGpuMetrics");
  const debugElement = root?.querySelector("[data-scope-gpu-debug='summary']");
  if (!root || !debugElement) {
    return;
  }
  const debug = nodeGraphModuleScopeDebugState();
  const now = nodeGraphModuleScopeNowMs();
  const pendingAt = Number(nodeGraphModuleScopeState.drawFrameRequestedAt) || 0;
  const pendingAge = nodeGraphModuleScopeState.drawFrame && pendingAt > 0 ? Math.max(0, now - pendingAt) : 0;
  const lastEnd = Number(debug.lastFrameEndMs) || 0;
  const frameAge = lastEnd > 0 ? Math.max(0, now - lastEnd) : 0;
  debug.pendingAgeMs = pendingAge;
  debug.lastHeartbeatMs = now;
  const error = debug.lastError ? ` err:${debug.lastError}` : "";
  if (!nodeGraphScopeGpuMetricsVisible(root)) {
    root.dataset.debugSnapshot = "";
    debugElement.textContent = "debug --";
    return;
  }
  const snapshot = {
    canvas: `${Math.max(0, Math.floor(Number(debug.canvasWidth) || 0))}x${Math.max(0, Math.floor(Number(debug.canvasHeight) || 0))}`,
    drawMs: Math.max(0, Number(debug.lastDrawMs) || 0),
    error: debug.lastError || "",
    frameAgeMs: frameAge,
    historyTail: (Array.isArray(debug.debugHistory) ? debug.debugHistory : []).slice(-12),
    pendingAgeMs: pendingAge,
    phase: debug.phase || "idle",
    pixelRatio: Number(debug.pixelRatio) || 0,
    points: Math.max(0, Math.floor(Number(nodeGraphModuleScopeState.renderMetrics?.points) || 0)),
    slots: `${Math.max(0, Math.floor(Number(debug.visibleItems) || 0))}/${Math.max(0, Math.floor(Number(debug.totalSlots) || 0))}`,
    vertices: Math.max(0, Math.floor(Number(nodeGraphModuleScopeState.renderMetrics?.vertices) || 0)),
    zoom: Number(debug.zoom) || 0,
  };
  root.dataset.debugSnapshot = JSON.stringify(snapshot);
  debugElement.textContent = [
    `z${(Number(debug.zoom) || 0).toFixed(2)}`,
    `age${formatNodeGraphScopeGpuDebugMs(frameAge)}ms`,
    `draw${formatNodeGraphScopeGpuDebugMs(debug.lastDrawMs)}ms`,
    `pend${formatNodeGraphScopeGpuDebugMs(pendingAge)}ms`,
    `slots${formatNodeGraphScopeGpuDebugNumber(debug.visibleItems, 2)}/${formatNodeGraphScopeGpuDebugNumber(debug.totalSlots, 2)}`,
    `cv${formatNodeGraphScopeGpuDebugNumber(debug.canvasWidth, 4)}x${formatNodeGraphScopeGpuDebugNumber(debug.canvasHeight, 4)}`,
    `pr${(Number(debug.pixelRatio) || 0).toFixed(2)}`,
    `phase:${debug.phase || "idle"}`,
    debug.lastSkipReason ? `skip:${debug.lastSkipReason}` : "",
  ].filter(Boolean).join(" ") + error;
}

function runNodeGraphModuleScopeDrawFrame(source = "raf") {
  try {
    drawNodeGraphModuleScopes();
  } catch (error) {
    markNodeGraphModuleScopeDebugError(error);
    console.error(`node graph module scope ${source} draw failed`, error);
    scheduleNodeGraphModuleScopeDraw();
  }
}

function nodeGraphModuleScopeBufferProgressRanges(buffer) {
  if (buffer?.nodeGraphScopeShaderMode === "one_value") {
    const lineLength = Number.isFinite(Number(buffer.nodeGraphScopeOneValueLineLength))
      ? clampNodeSliderValue(Number(buffer.nodeGraphScopeOneValueLineLength), 0, 1)
      : 1;
    return lineLength > 0 ? [[0, lineLength]] : [];
  }
  const drawProgress = Number.isFinite(Number(buffer?.nodeGraphScopeDrawProgress))
    ? clampNodeSliderValue(Number(buffer.nodeGraphScopeDrawProgress), 0.002, 1)
    : 1;
  if (buffer?.nodeGraphScopeDrawFullWindow) {
    return [[0, 1]];
  }
  const startProgress = Number(buffer?.nodeGraphScopeDrawStartProgress);
  if (!Number.isFinite(startProgress)) {
    return [[0, drawProgress]];
  }
  const start = clampNodeSliderValue(startProgress, 0, 1);
  if (buffer?.nodeGraphScopeDrawWrap) {
    return [
      [start, 1],
      [0, drawProgress],
    ].filter(([from, to]) => to - from > 0.001);
  }
  const end = Math.max(start + 0.002, drawProgress);
  return [[start, clampNodeSliderValue(end, 0.002, 1)]];
}

function nodeGraphModuleScopeProgressRangeIntersection(range, clipRange) {
  const start = clampNodeSliderValue(Number(range?.[0]) || 0, 0, 1);
  const end = clampNodeSliderValue(Number(range?.[1]) || 0, 0, 1);
  if (!Array.isArray(clipRange)) {
    return end - start > 0.001 ? [start, end] : null;
  }
  const clipStart = clampNodeSliderValue(Number(clipRange[0]) || 0, 0, 1);
  const clipEnd = clampNodeSliderValue(Number(clipRange[1]) || 0, 0, 1);
  const clippedStart = Math.max(start, clipStart);
  const clippedEnd = Math.min(end, clipEnd);
  return clippedEnd - clippedStart > 0.001 ? [clippedStart, clippedEnd] : null;
}

function nodeGraphModuleScopeDiscontinuitySkipSamplesForSlot(slot, buffer) {
  if (slot?.type === "visualOscilloscope" || buffer?.nodeGraphScopeDisableDiscontinuitySkip === true) {
    return 0;
  }
  if (slot?.type === "traceDisplay") {
    return normalizeNodeGraphTraceDisplaySkipSamples(
      buffer?.nodeGraphScopeDiscontinuitySkipSamples ?? nodeGraphTraceDisplaySettingsForSlot(slot).skipSamples,
    );
  }
  return typeof normalizeNodeGraphModuleScopeDiscontinuitySkipSamples === "function"
    ? normalizeNodeGraphModuleScopeDiscontinuitySkipSamples(nodeGraphMvp?.moduleScopeDiscontinuitySkipSamples ?? 1)
    : 1;
}

function nodeGraphModuleScopeDiscontinuitySkipSamplesForPoints(points) {
  if (points?.nodeGraphScopeDisableDiscontinuitySkip === true) {
    return 0;
  }
  if (Number.isFinite(Number(points?.nodeGraphScopeDiscontinuitySkipSamples))) {
    return normalizeNodeGraphTraceDisplaySkipSamples(points.nodeGraphScopeDiscontinuitySkipSamples);
  }
  return typeof normalizeNodeGraphModuleScopeDiscontinuitySkipSamples === "function"
    ? normalizeNodeGraphModuleScopeDiscontinuitySkipSamples(nodeGraphMvp?.moduleScopeDiscontinuitySkipSamples ?? 1)
    : 1;
}

function nodeGraphModuleScopeTraceHalfHeightRatio(slot, buffer) {
  if (slot?.type !== "traceDisplay") {
    return 0.42;
  }
  const amplitude = Number(buffer?.nodeGraphScopeTracePadding ?? nodeGraphTraceDisplaySettingsForSlot(slot).padding) || 0;
  return 0.5 + amplitude;
}

function nodeGraphModuleScopeBufferSegmentPoints(
  buffer,
  rect,
  canvas,
  pixelRatio,
  slot,
  startProgress,
  endProgress,
  options = {},
) {
  const points = [];
  if (!buffer?.length || rect.width <= 1 || rect.height <= 1) {
    return points;
  }
  const clippedRange = nodeGraphModuleScopeProgressRangeIntersection(
    [startProgress, endProgress],
    options.visibleProgressRange,
  );
  if (!clippedRange) {
    return points;
  }
  const [start, end] = clippedRange;
  const drawSpan = end - start;
  if (drawSpan <= 0.001) {
    return points;
  }
  const timing = slot?.type === "traceDisplay" ? options.traceTiming : null;
  const bufferViewStartMs = timing ? nodeGraphModuleScopeNowMs() : 0;
  const view = nodeGraphModuleScopeBufferView(buffer, slot);
  if (timing) {
    timing.bufferViewMs += Math.max(0, nodeGraphModuleScopeNowMs() - bufferViewStartMs);
  }
  if (slot?.type === "traceDisplay" && view.end <= view.start) {
    return points;
  }
  const visibleSamples = Math.max(1, view.end - view.start);
  const spectrumMode = buffer?.nodeGraphScopeSpectrum === true;
  const holdPointMode = buffer?.nodeGraphScopeHoldPoint === true;
  const scanTrailMode = buffer?.nodeGraphScopeScanTrail === true;
  const fullTraceMode = buffer?.nodeGraphScopeShaderMode === "1d_full" &&
    !spectrumMode &&
    !holdPointMode &&
    !scanTrailMode;
  const midY = spectrumMode
    ? rect.top + rect.height
    : rect.top + rect.height * 0.5;
  const halfHeight = spectrumMode
    ? rect.height
    : rect.height * nodeGraphModuleScopeTraceHalfHeightRatio(slot, buffer);
  const metricRect = nodeGraphModuleScopeVisibleMetricRect(rect, options);
  const sampleWidth = nodeGraphModuleScopeRenderedSampleWidth(metricRect);
  const metricDrawSpan = metricRect === rect ? drawSpan : 1;
  const visibleSampleWidth = sampleWidth * metricDrawSpan;
  const minPointSpacingPx = clampNodeSliderValue(Number(buffer.nodeGraphScopeMinPointSpacingPx) || 0.5, 0.25, 32);
  const visualPointLimit = Math.max(2, Math.min(32768, Math.floor(Number(buffer.nodeGraphScopeVisualPointLimit) || 32768)));
  const liveTracePointLimit = slot?.type === "visualOscilloscope" && fullTraceMode
    ? Math.min(visualPointLimit, 2048)
    : visualPointLimit;
  const scanTrailPointLimit = scanTrailMode
    ? slot?.type === "visualOscilloscope" ? 128 : 1
    : 1;
  const fullTraceOversample = fullTraceMode ? 4 : 1;
  const pointCount = spectrumMode
    ? Math.max(2, Math.min(visualPointLimit, Math.ceil(visibleSamples)))
    : holdPointMode
      ? scanTrailMode
        ? Math.max(2, Math.min(liveTracePointLimit, scanTrailPointLimit, buffer.length))
        : 1
      : Math.max(2, Math.min(
      liveTracePointLimit,
      Math.ceil((visibleSampleWidth * fullTraceOversample) / minPointSpacingPx),
    ));
  const rawValues = [];
  const skippedPoints = [];
  const discontinuitySkipDisabled = slot?.type === "visualOscilloscope" ||
    buffer?.nodeGraphScopeDisableDiscontinuitySkip === true;
  const skipSamples = nodeGraphModuleScopeDiscontinuitySkipSamplesForSlot(slot, buffer);
  const scanFramesPerSecond = typeof normalizeNodeGraphModuleScopeFramesPerSecond === "function"
    ? normalizeNodeGraphModuleScopeFramesPerSecond(nodeGraphMvp?.moduleScopeFramesPerSecond ?? 60)
    : 60;
  const scanTime = Number(nodeGraphModuleScopeState.animationTime) || 0;
  const holdPointX = clampNodeSliderValue(Number(buffer.nodeGraphScopeHoldPointX) || 0.5, 0, 1);
  const holdPointSamplePosition = Number(buffer.nodeGraphScopeHoldPointSamplePosition);
  const holdSample = Number.isFinite(holdPointSamplePosition)
    ? clampNodeSliderValue(holdPointSamplePosition, 0, Math.max(0, buffer.length - 1))
    : view.start;
  const pointGenerationStartMs = timing ? nodeGraphModuleScopeNowMs() : 0;
  for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
    const scanHistoryIndex = scanTrailMode ? Math.max(0, pointCount - 1 - pointIndex) : 0;
    const progress = holdPointMode
      ? scanTrailMode
        ? nodeGraphModuleScopeShaderScanProgress(slot, buffer, scanTime - (scanHistoryIndex / scanFramesPerSecond))
        : holdPointX
      : spectrumMode
      ? start + (pointIndex / Math.max(1, pointCount - 1)) * drawSpan
      : start + ((pointIndex + 0.5) / pointCount) * drawSpan;
    const samplePosition = holdPointMode
      ? clampNodeSliderValue(holdSample - scanHistoryIndex, 0, Math.max(0, buffer.length - 1))
      : spectrumMode
      ? view.start + progress * Math.max(0, visibleSamples - 1)
      : view.start + progress * visibleSamples;
    const x = rect.left + progress * rect.width;
    const sampleInfo = nodeGraphModuleScopeSampleInfo(buffer, samplePosition);
    const rawValue = sampleInfo.value;
    const value = spectrumMode
      ? clampNodeSliderValue(rawValue, 0, 1)
      : clampNodeSliderValue((rawValue * view.gain) + view.offset, -1, 1);
    const y = midY - value * halfHeight;
    rawValues.push(Number.isFinite(Number(rawValue)) ? Number(rawValue) : 0);
    skippedPoints.push(!spectrumMode && skipSamples > 0 && sampleInfo.discontinuity);
    points.push(
      ((x * pixelRatio) / canvas.width) * 2 - 1,
      1 - ((y * pixelRatio) / canvas.height) * 2,
    );
  }
  if (timing) {
    timing.pointGenerationMs += Math.max(0, nodeGraphModuleScopeNowMs() - pointGenerationStartMs);
  }
  if (!spectrumMode) {
    points.nodeGraphScopeRawValues = rawValues;
    points.nodeGraphScopeSkippedPoints = skippedPoints;
    points.nodeGraphScopeUniformAge = buffer?.nodeGraphScopeShaderMode === "one_value";
    points.nodeGraphScopeDisableDiscontinuitySkip = discontinuitySkipDisabled;
    points.nodeGraphScopeDiscontinuitySkipSamples = skipSamples;
  }
  return points;
}

function nodeGraphModuleScopeBufferPoints(buffer, rect, canvas, pixelRatio, slot) {
  const range = nodeGraphModuleScopeBufferProgressRanges(buffer)[0] || [0, 1];
  return nodeGraphModuleScopeBufferSegmentPoints(buffer, rect, canvas, pixelRatio, slot, range[0], range[1]);
}

function nodeGraphModuleScopeCenteredSquareRect(rect) {
  const size = Math.max(1, Math.min(Number(rect?.width) || 0, Number(rect?.height) || 0));
  return {
    height: size,
    left: (Number(rect?.left) || 0) + ((Number(rect?.width) || size) - size) * 0.5,
    top: (Number(rect?.top) || 0) + ((Number(rect?.height) || size) - size) * 0.5,
    width: size,
  };
}

function nodeGraphModuleScopePaddedRect(rect, padding = 0) {
  const width = Math.max(1, Number(rect?.width) || 0);
  const height = Math.max(1, Number(rect?.height) || 0);
  const safePadding = clampNodeSliderValue(Number(padding) || 0, 0, 0.45);
  const inset = Math.min(width, height) * safePadding;
  return {
    height: Math.max(1, height - inset * 2),
    left: (Number(rect?.left) || 0) + inset,
    top: (Number(rect?.top) || 0) + inset,
    width: Math.max(1, width - inset * 2),
  };
}

function nodeGraphModuleScopeDrawingRect(rect, buffer = null, slot = null) {
  const shaderPadding = Number.isFinite(Number(buffer?.nodeGraphScopeShaderPadding))
    ? Number(buffer.nodeGraphScopeShaderPadding)
    : Number(nodeGraphModuleScopeShaderConfigForSlot(slot).padding);
  const paddedRect = nodeGraphModuleScopePaddedRect(rect, shaderPadding);
  if (buffer?.nodeGraphScopeXy) {
    return nodeGraphModuleScopeCenteredSquareRect(paddedRect);
  }
  return paddedRect;
}

function nodeGraphModuleScopeRectIntersection(rect, bounds) {
  const left = Math.max(Number(rect?.left) || 0, Number(bounds?.left) || 0);
  const top = Math.max(Number(rect?.top) || 0, Number(bounds?.top) || 0);
  const right = Math.min(
    (Number(rect?.left) || 0) + (Number(rect?.width) || 0),
    (Number(bounds?.left) || 0) + (Number(bounds?.width) || 0),
  );
  const bottom = Math.min(
    (Number(rect?.top) || 0) + (Number(rect?.height) || 0),
    (Number(bounds?.top) || 0) + (Number(bounds?.height) || 0),
  );
  const width = right - left;
  const height = bottom - top;
  return width > 0 && height > 0
    ? { height, left, top, width }
    : null;
}

function nodeGraphModuleScopeVisibleDrawGeometry(screenRect, drawRect, viewportRect, zoomScale = nodeGraphModuleScopeZoomScale()) {
  if (
    !nodeGraphModuleScopeRectIntersection(screenRect, viewportRect) ||
    !Number.isFinite(Number(drawRect?.width)) ||
    !Number.isFinite(Number(drawRect?.height))
  ) {
    return null;
  }
  const visibleDrawRect = nodeGraphModuleScopeRectIntersection(drawRect, viewportRect);
  if (!visibleDrawRect) {
    return null;
  }
  const leftProgress = ((visibleDrawRect.left - drawRect.left) / Math.max(1, drawRect.width));
  const rightProgress = (((visibleDrawRect.left + visibleDrawRect.width) - drawRect.left) / Math.max(1, drawRect.width));
  const visibleProgressRange = [
    clampNodeSliderValue(leftProgress, 0, 1),
    clampNodeSliderValue(rightProgress, 0, 1),
  ];
  if (visibleProgressRange[1] - visibleProgressRange[0] <= 0.001) {
    return null;
  }
  return {
    visibleDrawRect,
    visibleProgressRange,
    visibleScopeRect: {
      height: visibleDrawRect.height,
      left: visibleDrawRect.left,
      sampleHeight: nodeGraphModuleScopeUnzoomedLength(visibleDrawRect.height, zoomScale),
      sampleWidth: nodeGraphModuleScopeUnzoomedLength(visibleDrawRect.width, zoomScale),
      top: visibleDrawRect.top,
      width: visibleDrawRect.width,
    },
  };
}

function nodeGraphModuleScopeXyPoints(buffer, rect, canvas, pixelRatio, slot) {
  const points = [];
  if (!buffer?.nodeGraphScopeXy || !buffer.x?.length || !buffer.y?.length || rect.width <= 1 || rect.height <= 1) {
    return points;
  }
  const settings = nodeGraphModuleScopeEffectiveSettingForSlot(slot);
  const gain = nodeGraphModuleScopeVisualGain(settings);
  const length = Math.min(buffer.x.length, buffer.y.length);
  const square = nodeGraphModuleScopeCenteredSquareRect(rect);
  const centerX = square.left + square.width * 0.5;
  const centerY = square.top + square.height * 0.5;
  const radius = Math.max(1, square.width * 0.44);
  for (let index = 0; index < length; index += 1) {
    const x = centerX + clampNodeSliderValue((Number(buffer.x[index]) || 0) * gain, -1, 1) * radius;
    const y = centerY - clampNodeSliderValue((Number(buffer.y[index]) || 0) * gain, -1, 1) * radius;
    points.push(
      ((x * pixelRatio) / canvas.width) * 2 - 1,
      1 - ((y * pixelRatio) / canvas.height) * 2,
    );
  }
  return points;
}

function nodeGraphModuleScopePixelPoints(points, canvas) {
  const pixelPoints = [];
  for (let index = 0; index + 1 < points.length; index += 2) {
    pixelPoints.push(
      ((points[index] + 1) * 0.5) * canvas.width,
      ((1 - points[index + 1]) * 0.5) * canvas.height,
    );
  }
  return pixelPoints;
}

function appendNodeGraphModuleScopeVertices(target, source) {
  if (!Array.isArray(target) || !source?.length) {
    return target;
  }
  for (let index = 0; index < source.length; index += 1) {
    target.push(source[index]);
  }
  return target;
}

function nodeGraphModuleScopeBeamVertices(points, canvas) {
  const pixelPoints = nodeGraphModuleScopePixelPoints(points, canvas);
  const vertices = [];
  const segmentCount = Math.max(1, (pixelPoints.length / 2) - 1);
  const corners = [0, 1, 2, 2, 1, 3];
  const rawValues = Array.isArray(points?.nodeGraphScopeRawValues)
    ? points.nodeGraphScopeRawValues
    : null;
  const skippedPoints = Array.isArray(points?.nodeGraphScopeSkippedPoints)
    ? points.nodeGraphScopeSkippedPoints
    : null;
  const skipSamples = nodeGraphModuleScopeDiscontinuitySkipSamplesForPoints(points);
  let skipThroughSegment = -1;
  for (let index = 0; index + 3 < pixelPoints.length; index += 2) {
    const segmentIndex = index / 2;
    if (skippedPoints?.[segmentIndex] || skippedPoints?.[segmentIndex + 1]) {
      continue;
    }
    if (skipSamples > 0 && rawValues && segmentIndex + 1 < rawValues.length) {
      const previousRaw = Number(rawValues[segmentIndex]);
      const currentRaw = Number(rawValues[segmentIndex + 1]);
      if (
        Number.isFinite(previousRaw) &&
        Number.isFinite(currentRaw) &&
        Math.abs(currentRaw - previousRaw) > nodeGraphModuleScopeDiscontinuityThreshold
      ) {
        skipThroughSegment = Math.max(skipThroughSegment, segmentIndex + skipSamples - 1);
      }
    }
    if (segmentIndex <= skipThroughSegment) {
      continue;
    }
    const x1 = pixelPoints[index];
    const y1 = pixelPoints[index + 1];
    const x2 = pixelPoints[index + 2];
    const y2 = pixelPoints[index + 3];
    const lengthPx = Math.hypot(x2 - x1, y2 - y1);
    if (lengthPx < 0.001) {
      continue;
    }
    const segmentProgress = points?.nodeGraphScopeUniformAge === true ? 1 : (index / 2) / segmentCount;
    for (const corner of corners) {
      vertices.push(x1, y1, x2, y2, corner, segmentProgress);
    }
  }
  return vertices;
}

function nodeGraphTraceDisplayScratchForSlot(slot, requiredFloats) {
  const nodeId = String(slot?.nodeId || "traceDisplay");
  const scratch = nodeGraphModuleScopeState.traceDisplayScratch;
  let entry = scratch.get(nodeId);
  const required = Math.max(0, Math.floor(Number(requiredFloats) || 0));
  if (!entry || entry.vertices.length < required) {
    let capacity = Math.max(1024, entry?.vertices?.length || 0);
    while (capacity < required) {
      capacity *= 2;
    }
    entry = {
      vertices: new Float32Array(capacity),
    };
    scratch.set(nodeId, entry);
  }
  return entry;
}

function appendNodeGraphTraceDisplayBeamSegment(vertices, offset, x1, y1, x2, y2, age) {
  const corners = [0, 1, 2, 2, 1, 3];
  let cursor = offset;
  for (let index = 0; index < corners.length; index += 1) {
    vertices[cursor] = x1;
    vertices[cursor + 1] = y1;
    vertices[cursor + 2] = x2;
    vertices[cursor + 3] = y2;
    vertices[cursor + 4] = corners[index];
    vertices[cursor + 5] = age;
    cursor += 6;
  }
  return cursor;
}

function nodeGraphTraceDisplayVisualPointCount(rect, buffer) {
  const visualWidth = Math.max(1, Number(rect?.width) || 0);
  const visualPointLimit = Math.max(
    2,
    Math.min(32768, Math.floor(Number(buffer?.nodeGraphScopeVisualPointLimit) || 32768)),
  );
  return Math.max(2, Math.min(visualPointLimit, Math.ceil(visualWidth * 2)));
}

function buildNodeGraphTraceDisplayVertices(buffer, rect, canvas, pixelRatio, slot, options = {}) {
  const clippedRange = nodeGraphModuleScopeProgressRangeIntersection([0, 1], options.visibleProgressRange);
  if (!buffer?.length || rect.width <= 1 || rect.height <= 1 || !clippedRange) {
    return null;
  }
  const timing = options.traceTiming || null;
  const [start, end] = clippedRange;
  const drawSpan = end - start;
  if (drawSpan <= 0.001) {
    return null;
  }
  const bufferViewStartMs = timing ? nodeGraphModuleScopeNowMs() : 0;
  const view = nodeGraphModuleScopeBufferView(buffer, slot);
  if (timing) {
    timing.bufferViewMs += Math.max(0, nodeGraphModuleScopeNowMs() - bufferViewStartMs);
  }
  if (view.end <= view.start) {
    return null;
  }
  const visibleSamples = Math.max(1, view.end - view.start);
  const midY = rect.top + rect.height * 0.5;
  const halfHeight = rect.height * nodeGraphModuleScopeTraceHalfHeightRatio(slot, buffer);
  const metricRect = nodeGraphModuleScopeVisibleMetricRect(rect, options);
  const pointCount = nodeGraphTraceDisplayVisualPointCount(metricRect, buffer);
  const scratch = nodeGraphTraceDisplayScratchForSlot(slot, Math.max(0, pointCount - 1) * 36);
  const vertices = scratch.vertices;
  const skipSamples = nodeGraphModuleScopeDiscontinuitySkipSamplesForSlot(slot, buffer);
  const pointGenerationStartMs = timing ? nodeGraphModuleScopeNowMs() : 0;
  let previousX = 0;
  let previousY = 0;
  let previousRaw = 0;
  let hasPrevious = false;
  let skipThroughSegment = -1;
  let vertexOffset = 0;
  let segmentCount = 0;
  for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
    const progress = start + ((pointIndex + 0.5) / pointCount) * drawSpan;
    const samplePosition = view.start + progress * visibleSamples;
    const x = rect.left + progress * rect.width;
    const sampleInfo = nodeGraphModuleScopeSampleInfo(buffer, samplePosition);
    const rawValue = Number.isFinite(Number(sampleInfo.value)) ? Number(sampleInfo.value) : 0;
    const value = clampNodeSliderValue((rawValue * view.gain) + view.offset, -1, 1);
    const y = midY - value * halfHeight;
    if (hasPrevious) {
      const segmentIndex = pointIndex - 1;
      if (skipSamples > 0 && (sampleInfo.discontinuity || Math.abs(rawValue - previousRaw) > nodeGraphModuleScopeDiscontinuityThreshold)) {
        skipThroughSegment = Math.max(skipThroughSegment, segmentIndex + skipSamples - 1);
      }
      if (segmentIndex > skipThroughSegment) {
        const x1 = previousX * pixelRatio;
        const y1 = previousY * pixelRatio;
        const x2 = x * pixelRatio;
        const y2 = y * pixelRatio;
        if (Math.hypot(x2 - x1, y2 - y1) >= 0.001) {
          const age = segmentIndex / Math.max(1, pointCount - 1);
          vertexOffset = appendNodeGraphTraceDisplayBeamSegment(vertices, vertexOffset, x1, y1, x2, y2, age);
          segmentCount += 1;
        }
      }
    }
    previousX = x;
    previousY = y;
    previousRaw = rawValue;
    hasPrevious = true;
  }
  if (timing) {
    timing.pointGenerationMs += Math.max(0, nodeGraphModuleScopeNowMs() - pointGenerationStartMs);
  }
  if (vertexOffset < 36) {
    return null;
  }
  return {
    pointCount,
    vertexCount: vertexOffset / 6,
    vertices,
    vertexFloatCount: vertexOffset,
  };
}

function nodeGraphModuleScopeXyBeamVertices(points, canvas, sparkSizePx = 2) {
  const pixelPoints = nodeGraphModuleScopePixelPoints(points, canvas);
  const vertices = [];
  const radius = clampNodeSliderValue(Number(sparkSizePx) || 2, 1, 10) * 0.5;
  for (let index = 0; index + 1 < pixelPoints.length; index += 2) {
    const x = pixelPoints[index];
    const y = pixelPoints[index + 1];
    appendNodeGraphModuleScopeVertices(vertices, nodeGraphModuleScopeBeamVertices([
      (((x - radius) / canvas.width) * 2) - 1,
      1 - ((y / canvas.height) * 2),
      (((x + radius) / canvas.width) * 2) - 1,
      1 - ((y / canvas.height) * 2),
    ], canvas));
  }
  return vertices;
}

function nodeGraphModuleScopeDotVertices(points, canvas, ageStart = 0, ageEnd = 1) {
  const pixelPoints = nodeGraphModuleScopePixelPoints(points, canvas);
  const vertices = [];
  const count = Math.max(1, (pixelPoints.length / 2) - 1);
  const start = clampNodeSliderValue(Number(ageStart) || 0, 0, 1);
  const end = clampNodeSliderValue(Number(ageEnd) || 0, 0, 1);
  const skippedPoints = Array.isArray(points?.nodeGraphScopeSkippedPoints)
    ? points.nodeGraphScopeSkippedPoints
    : null;
  for (let index = 0; index + 1 < pixelPoints.length; index += 2) {
    const pointIndex = index / 2;
    if (skippedPoints?.[pointIndex]) {
      continue;
    }
    const progress = pointIndex / count;
    const age = start + (end - start) * progress;
    vertices.push(pixelPoints[index], pixelPoints[index + 1], clampNodeSliderValue(age, 0, 1));
  }
  return vertices;
}

function nodeGraphModuleScopeBufferDotVertices(buffer, rect, canvas, pixelRatio, slot, options = {}) {
  const vertices = [];
  const xyPoints = nodeGraphModuleScopeXyPoints(buffer, rect, canvas, pixelRatio, slot);
  if (xyPoints.length >= 2) {
    appendNodeGraphModuleScopeVertices(vertices, nodeGraphModuleScopeDotVertices(xyPoints, canvas, 0.72, 1));
    return vertices;
  }
  for (const [start, end] of nodeGraphModuleScopeBufferProgressRanges(buffer)) {
    const points = nodeGraphModuleScopeBufferSegmentPoints(buffer, rect, canvas, pixelRatio, slot, start, end, options);
    if (points.length >= 2) {
      appendNodeGraphModuleScopeVertices(vertices, nodeGraphModuleScopeDotVertices(points, canvas, start, end));
    }
  }
  return vertices;
}

function nodeGraphModuleScopeSpectrumBarVertices(buffer, rect, canvas, options = {}) {
  const vertices = [];
  const length = Math.max(0, buffer?.length || 0);
  if (!buffer?.nodeGraphScopeSpectrum || length <= 0 || rect.width <= 1 || rect.height <= 1) {
    return vertices;
  }
  const visibleRange = Array.isArray(options.visibleProgressRange)
    ? [
      clampNodeSliderValue(Number(options.visibleProgressRange[0]) || 0, 0, 1),
      clampNodeSliderValue(Number(options.visibleProgressRange[1]) || 0, 0, 1),
    ]
    : [0, 1];
  if (visibleRange[1] - visibleRange[0] <= 0.001) {
    return vertices;
  }
  const left = Number(rect.left) || 0;
  const right = left + (Number(rect.width) || 0);
  const bottom = (Number(rect.top) || 0) + (Number(rect.height) || 0);
  const top = Number(rect.top) || 0;
  const pushVertex = (x, y) => {
    vertices.push(
      ((x / canvas.width) * 2) - 1,
      1 - ((y / canvas.height) * 2),
    );
  };
  const firstIndex = Math.max(0, Math.floor(length * visibleRange[0]));
  const lastIndex = Math.min(length, Math.ceil(length * visibleRange[1]));
  for (let index = firstIndex; index < lastIndex; index += 1) {
    const value = clampNodeSliderValue(Number(buffer[index]) || 0, 0, 1);
    const x1 = left + (index / length) * (right - left);
    const x2 = left + ((index + 1) / length) * (right - left);
    const y = bottom - value * (bottom - top);
    pushVertex(x1, bottom);
    pushVertex(x1, y);
    pushVertex(x2, y);
    pushVertex(x1, bottom);
    pushVertex(x2, y);
    pushVertex(x2, bottom);
  }
  return vertices;
}

function nodeGraphModuleScopeBurnDecaySettings(settings) {
  const masterBurn = typeof normalizeNodeGraphModuleScopeBurn === "function"
    ? normalizeNodeGraphModuleScopeBurn(nodeGraphMvp?.moduleScopeBurn ?? 0)
    : 0;
  const decayAmount = typeof normalizeNodeGraphModuleScopeDecay === "function"
    ? normalizeNodeGraphModuleScopeDecay(nodeGraphMvp?.moduleScopeDecay ?? 0)
    : 0;
  const burn = clampNodeSliderValue((Number(settings?.screenBurn) || 0) * masterBurn, 0, 1);
  if (burn <= 0) {
    return {
      fast: 0,
      floor: 1,
      slow: 0,
    };
  }
  const fast = 0.88 - decayAmount * 0.42 + burn * 0.12;
  const slow = 0.91 + burn * 0.08;
  const floor = 0.0012 + (1 - burn) * 0.018 + decayAmount * 0.002;
  return {
    fast,
    floor,
    slow,
  };
}

function nodeGraphModuleScopeBloomEnabled() {
  return Boolean(nodeGraphMvp?.scopeBloomEnabled);
}

function applyNodeGraphModuleScopeTraceBlendMode(gl, blendMode = "laser") {
  switch (String(blendMode || "laser").trim().toLowerCase()) {
    case "solid":
      gl.blendFunc(gl.ONE, gl.ZERO);
      break;
    case "paint":
    case "led":
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      break;
    case "light":
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      break;
    case "heatmap":
    case "laser":
    default:
      gl.blendFunc(gl.ONE, gl.ONE);
      break;
  }
}

function nodeGraphModuleScopeTraceBlendMode(slot) {
  return nodeGraphModuleScopeShaderConfigForSlot(slot).blendMode || "laser";
}

function nodeGraphModuleScopeHeatmapEnabled(slot) {
  return nodeGraphModuleScopeTraceBlendMode(slot) === "heatmap";
}

function nodeGraphModuleScopeTraceBrightness(slot, settings) {
  const brightness = nodeGraphModuleScopeDefaultSettings.brightness;
  return clampNodeSliderValue(brightness, 0, 16);
}

function nodeGraphModuleScopeTraceLineThickness(slot, settings) {
  const masterLineThickness = normalizeNodeGraphModuleScopeLineThickness(
    nodeGraphMvp?.moduleScopeLineThickness ?? nodeGraphModuleScopeDefaultSettings.lineThickness,
  );
  const lineThickness = nodeGraphModuleScopeDefaultSettings.lineThickness;
  return clampNodeSliderValue(lineThickness * masterLineThickness, 0.25, 32);
}

function nodeGraphModuleScopeTraceBurn(settings) {
  const masterBurn = typeof normalizeNodeGraphModuleScopeBurn === "function"
    ? normalizeNodeGraphModuleScopeBurn(nodeGraphMvp?.moduleScopeBurn ?? 0)
    : 0;
  return clampNodeSliderValue((Number(settings?.screenBurn) || 0) * masterBurn, 0, 1);
}

function invalidateNodeGraphModuleScopeTraceImageTexture() {
  const state = nodeGraphModuleScopeState.traceImageTexture;
  state.dataUrl = "";
  state.generatedKey = "";
  state.image = null;
}

function nodeGraphModuleScopeDotTextureOptions(
  core1SizeValue,
  core1BrightnessValue,
  size = 64,
  core1ColorValue = nodeGraphModuleScopeDefaultDotCores.dot1.color,
  core1BlurValue = 0,
  core2SizeValue = nodeGraphMvp?.moduleScopeDotCore2Size,
  core2BrightnessValue = nodeGraphMvp?.moduleScopeDotCore2Brightness,
  core2ColorValue = nodeGraphModuleScopeDefaultDotCores.dot2.color,
  core2BlurValue = 0,
  lineThicknessValue = nodeGraphMvp?.moduleScopeLineThickness,
) {
  if (core1SizeValue && typeof core1SizeValue === "object" && !Array.isArray(core1SizeValue)) {
    return core1SizeValue;
  }
  return {
    core1Blur: core1BlurValue,
    core1Brightness: core1BrightnessValue,
    core1Color: core1ColorValue,
    core1Size: core1SizeValue,
    core2Blur: core2BlurValue,
    core2Brightness: core2BrightnessValue,
    core2Color: core2ColorValue,
    core2Size: core2SizeValue,
    lineThickness: lineThicknessValue,
    size,
  };
}

function nodeGraphModuleScopeGeneratedDotTextureData(...args) {
  const options = nodeGraphModuleScopeDotTextureOptions(...args);
  const core1Size = normalizeNodeGraphModuleScopeDotCoreSize(options.core1Size, nodeGraphModuleScopeDefaultDotCores.dot1.size);
  const core1Brightness = normalizeNodeGraphModuleScopeDotCoreBrightness(options.core1Brightness, nodeGraphModuleScopeDefaultDotCores.dot1.brightness);
  const core1Color = nodeGraphScopeHexColorToRgb(
    normalizeNodeGraphModuleScopeDotCoreColor(
      options.core1Color ?? nodeGraphModuleScopeDefaultDotCores.dot1.color,
      nodeGraphModuleScopeDefaultDotCores.dot1.color,
    ),
  );
  const core2Size = normalizeNodeGraphModuleScopeDotCoreSize(options.core2Size, nodeGraphModuleScopeDefaultDotCores.dot2.size);
  const core2Brightness = normalizeNodeGraphModuleScopeDotCoreBrightness(options.core2Brightness, nodeGraphModuleScopeDefaultDotCores.dot2.brightness);
  const core2Color = nodeGraphScopeHexColorToRgb(
    normalizeNodeGraphModuleScopeDotCoreColor(
      options.core2Color ?? nodeGraphModuleScopeDefaultDotCores.dot2.color,
      nodeGraphModuleScopeDefaultDotCores.dot2.color,
    ),
  );
  const core1Blur = normalizeNodeGraphModuleScopeDotBlur(options.core1Blur, 0);
  const core2Blur = normalizeNodeGraphModuleScopeDotBlur(options.core2Blur, 0);
  const lineThickness = normalizeNodeGraphModuleScopeLineThickness(
    options.lineThickness ?? nodeGraphModuleScopeDefaultSettings.lineThickness,
  );
  const size = Math.max(1, Math.min(512, Math.round(Number(options.size) || 64)));
  const finalCore1Size = core1Size * lineThickness;
  const finalCore2Size = core2Size * lineThickness;
  const pixels = new Uint8Array(size * size * 4);
  const center = (size - 1) * 0.5;
  const dotDiameterPx = Math.max(1, core1Size, core2Size);
  const core1Radius = clampNodeSliderValue(finalCore1Size * 0.5, 0.005, 20);
  const core2Radius = clampNodeSliderValue(finalCore2Size * 0.5, 0.005, 20);
  const core1Falloff = 2.6 / Math.max(0.0001, core1Radius * core1Radius);
  const core2Falloff = 1.15 / Math.max(0.0001, core2Radius * core2Radius);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = ((x - center) / center) * dotDiameterPx * 0.5;
      const dy = ((y - center) / center) * dotDiameterPx * 0.5;
      const distanceSquared = dx * dx + dy * dy;
      const core1Mask = nodeGraphModuleScopeDotBlurMask(distanceSquared, core1Radius, core1Blur);
      const core2Mask = nodeGraphModuleScopeDotBlurMask(distanceSquared, core2Radius, core2Blur);
      const core1Energy = Math.exp(-distanceSquared * core1Falloff) * core1Brightness * core1Mask;
      const core2Energy = Math.exp(-distanceSquared * core2Falloff) * core2Brightness * core2Mask;
      const energy = clampNodeSliderValue(core1Energy + core2Energy, 0, 1);
      const colorEnergy = Math.max(0.0001, core1Energy + core2Energy);
      const core1Mix = core1Energy / colorEnergy;
      const core2Mix = core2Energy / colorEnergy;
      const red = clampNodeSliderValue(core1Color[0] * core1Mix + core2Color[0] * core2Mix, 0, 1);
      const green = clampNodeSliderValue(core1Color[1] * core1Mix + core2Color[1] * core2Mix, 0, 1);
      const blue = clampNodeSliderValue(core1Color[2] * core1Mix + core2Color[2] * core2Mix, 0, 1);
      const alpha = Math.round(energy * 255);
      const index = (y * size + x) * 4;
      pixels[index] = Math.round(red * 255);
      pixels[index + 1] = Math.round(green * 255);
      pixels[index + 2] = Math.round(blue * 255);
      pixels[index + 3] = alpha;
    }
  }
  return pixels;
}

function nodeGraphModuleScopeGeneratedDotTexture(renderer) {
  const state = nodeGraphModuleScopeState.traceImageTexture;
  const core1Enabled = nodeGraphMvp?.moduleScopeDotCore1Enabled !== false;
  const core1Size = normalizeNodeGraphModuleScopeDotCoreSize(
    nodeGraphMvp?.moduleScopeDotCore1Size ?? nodeGraphModuleScopeDefaultDotCores.dot1.size,
    nodeGraphModuleScopeDefaultDotCores.dot1.size,
  );
  const core1Brightness = normalizeNodeGraphModuleScopeDotCoreBrightness(
    nodeGraphMvp?.moduleScopeDotCore1Brightness ?? nodeGraphModuleScopeDefaultDotCores.dot1.brightness,
    nodeGraphModuleScopeDefaultDotCores.dot1.brightness,
  );
  const core1Color = normalizeNodeGraphModuleScopeDotCoreColor(
    nodeGraphMvp?.moduleScopeDotCore1Color ?? nodeGraphModuleScopeDefaultDotCores.dot1.color,
    nodeGraphModuleScopeDefaultDotCores.dot1.color,
  );
  const core2Enabled = nodeGraphMvp?.moduleScopeDotCore2Enabled !== false;
  const core2Size = normalizeNodeGraphModuleScopeDotCoreSize(
    nodeGraphMvp?.moduleScopeDotCore2Size ?? nodeGraphModuleScopeDefaultDotCores.dot2.size,
    nodeGraphModuleScopeDefaultDotCores.dot2.size,
  );
  const core2Brightness = normalizeNodeGraphModuleScopeDotCoreBrightness(
    nodeGraphMvp?.moduleScopeDotCore2Brightness ?? nodeGraphModuleScopeDefaultDotCores.dot2.brightness,
    nodeGraphModuleScopeDefaultDotCores.dot2.brightness,
  );
  const core2Color = normalizeNodeGraphModuleScopeDotCoreColor(
    nodeGraphMvp?.moduleScopeDotCore2Color ?? nodeGraphModuleScopeDefaultDotCores.dot2.color,
    nodeGraphModuleScopeDefaultDotCores.dot2.color,
  );
  const lineThickness = normalizeNodeGraphModuleScopeLineThickness(
    nodeGraphMvp?.moduleScopeLineThickness ?? nodeGraphModuleScopeDefaultSettings.lineThickness,
  );
  const core1Blur = 0;
  const core2Blur = 0;
  const key = `generated:${core1Enabled}:${core1Size.toFixed(3)}:${core1Brightness.toFixed(3)}:${core1Color}:${core1Blur.toFixed(3)}:${core2Enabled}:${core2Size.toFixed(3)}:${core2Brightness.toFixed(3)}:${core2Color}:${core2Blur.toFixed(3)}:${lineThickness.toFixed(3)}`;
  if (state.generatedKey === key && state.texture) {
    return state.texture;
  }
  const { gl } = renderer;
  if (!state.texture) {
    state.texture = gl.createTexture();
  }
  state.dataUrl = "";
  state.generatedKey = key;
  state.image = null;
  gl.bindTexture(gl.TEXTURE_2D, state.texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    64,
    64,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    nodeGraphModuleScopeGeneratedDotTextureData({
      core1Blur,
      core1Brightness: core1Enabled ? core1Brightness : 0,
      core1Color,
      core1Size,
      core2Blur,
      core2Brightness: core2Enabled ? core2Brightness : 0,
      core2Color,
      core2Size,
      lineThickness,
      size: 64,
    }),
  );
  return state.texture;
}

function nodeGraphModuleScopeTraceImageTexture(renderer) {
  const dataUrl = typeof nodeGraphTraceImageDataUrl === "function" ? nodeGraphTraceImageDataUrl() : "";
  const state = nodeGraphModuleScopeState.traceImageTexture;
  if (!dataUrl) {
    return nodeGraphModuleScopeGeneratedDotTexture(renderer);
  }
  const { gl } = renderer;
  state.generatedKey = "";
  if (state.dataUrl === dataUrl && state.texture && state.image?.complete) {
    return state.texture;
  }
  if (state.dataUrl !== dataUrl) {
    state.dataUrl = dataUrl;
    state.image = new Image();
    state.image.onload = () => {
      if (state.dataUrl !== dataUrl) {
        return;
      }
      if (!state.texture) {
        state.texture = gl.createTexture();
      }
      gl.bindTexture(gl.TEXTURE_2D, state.texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, state.image);
      scheduleNodeGraphModuleScopeDraw();
    };
    state.image.src = dataUrl;
  }
  return state.image?.complete ? state.texture : null;
}

function nodeGraphModuleScopeDotSizeScale() {
  const core1Size = normalizeNodeGraphModuleScopeDotCoreSize(
    nodeGraphMvp?.moduleScopeDotCore1Size ?? nodeGraphModuleScopeDefaultDotCores.dot1.size,
    nodeGraphModuleScopeDefaultDotCores.dot1.size,
  );
  const core2Size = normalizeNodeGraphModuleScopeDotCoreSize(
    nodeGraphMvp?.moduleScopeDotCore2Size ?? nodeGraphModuleScopeDefaultDotCores.dot2.size,
    nodeGraphModuleScopeDefaultDotCores.dot2.size,
  );
  const lineThickness = normalizeNodeGraphModuleScopeLineThickness(
    nodeGraphMvp?.moduleScopeLineThickness ?? nodeGraphModuleScopeDefaultSettings.lineThickness,
  );
  return clampNodeSliderValue(Math.max(core1Size, core2Size) * lineThickness, 0.01, 40);
}

function nodeGraphModuleScopeTraceDotSizeScale(dotSize, fallback = 1) {
  const size = normalizeNodeGraphModuleScopeDotCoreSize(dotSize, fallback);
  const lineThickness = normalizeNodeGraphModuleScopeLineThickness(
    nodeGraphMvp?.moduleScopeLineThickness ?? nodeGraphModuleScopeDefaultSettings.lineThickness,
  );
  return clampNodeSliderValue(size * lineThickness, 0.01, 40);
}

function nodeGraphModuleScopeDotBlurMask(distanceSquared, radius, blurValue = 0) {
  const radiusValue = Math.max(0.0001, Number(radius) || 0.0001);
  const blur = normalizeNodeGraphModuleScopeDotBlur(blurValue, 0);
  const normalizedDistance = Math.sqrt(Math.max(0, Number(distanceSquared) || 0)) / radiusValue;
  if (normalizedDistance >= 1) {
    return 0;
  }
  if (blur <= 0) {
    return 1;
  }
  const crispEdge = Math.max(0.0001, blur * 0.35);
  const crispStart = 1 - crispEdge;
  const edgeProgress = clampNodeSliderValue((normalizedDistance - crispStart) / crispEdge, 0, 1);
  const crisp = 1 - (edgeProgress * edgeProgress * (3 - 2 * edgeProgress));
  const gaussianSharpness = 2.2 + (1 - blur) * 10;
  const edgeEnergy = Math.exp(-gaussianSharpness);
  const gaussian = clampNodeSliderValue(
    (Math.exp(-gaussianSharpness * normalizedDistance * normalizedDistance) - edgeEnergy) /
      Math.max(0.0001, 1 - edgeEnergy),
    0,
    1,
  );
  return crisp * (1 - blur) + gaussian * blur;
}

function nodeGraphModuleScopeClippedPixelRect(canvas, rect, pixelRatio = window.devicePixelRatio || 1) {
  const rectLeft = Number(rect?.left) || 0;
  const rectTop = Number(rect?.top) || 0;
  const rectRight = rectLeft + (Number(rect?.width) || 0);
  const rectBottom = rectTop + (Number(rect?.height) || 0);
  const left = Math.max(0, Math.min(canvas.width, Math.floor(rectLeft * pixelRatio)));
  const top = Math.max(0, Math.min(canvas.height, Math.floor(rectTop * pixelRatio)));
  const right = Math.max(0, Math.min(canvas.width, Math.ceil(rectRight * pixelRatio)));
  const bottom = Math.max(0, Math.min(canvas.height, Math.ceil(rectBottom * pixelRatio)));
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) {
    return null;
  }
  return {
    bottom,
    height,
    left,
    right,
    top,
    width,
  };
}

function drawNodeGraphModuleScopeBufferWebGl(renderer, rect, buffer, pixelRatio, slot, options = {}) {
  const { canvas, gl } = renderer;
  const visibleRect = nodeGraphModuleScopeVisibleMetricRect(rect, options);
  const clipRect = nodeGraphModuleScopeClippedPixelRect(canvas, visibleRect, pixelRatio);
  if (!clipRect) {
    return;
  }
  if (buffer?.nodeGraphScopeSpectrum) {
    drawNodeGraphModuleScopeSpectrumBarsWebGl(renderer, rect, buffer, pixelRatio, options);
    return;
  }
  const traceThicknessPx = Math.max(1, Number(options.thicknessPx) || 1);
  const fixedDotSizeRatio = Number(buffer?.nodeGraphScopeFixedDotSizeRatio);
  const fixedDotSizePx = Number.isFinite(fixedDotSizeRatio) && fixedDotSizeRatio > 0
    ? Math.max(1, Math.min(visibleRect.width, visibleRect.height) * clampNodeSliderValue(fixedDotSizeRatio, 0.01, 1))
    : 0;
  const requestedDotSizeScale = Number(options.dotSizeScale);
  const dotSizeScale = Number.isFinite(requestedDotSizeScale) && requestedDotSizeScale > 0
    ? requestedDotSizeScale
    : nodeGraphModuleScopeDotSizeScale();
  const dotThicknessPx = Math.max(
    1,
    fixedDotSizePx || (traceThicknessPx * dotSizeScale),
  );
  const safeDotThicknessPx = Math.min(512, dotThicknessPx * pixelRatio);
  if (slot?.type === "traceDisplay" && !buffer?.nodeGraphScopeXy && !buffer?.nodeGraphScopeSpectrum) {
    const traceGeometry = buildNodeGraphTraceDisplayVertices(buffer, rect, canvas, pixelRatio, slot, options);
    if (!traceGeometry) {
      return;
    }
    recordNodeGraphModuleScopeRenderMetrics(traceGeometry.pointCount, traceGeometry.vertexCount);
    if (options.traceTiming) {
      options.traceTiming.passes += 1;
      options.traceTiming.points += traceGeometry.pointCount;
      options.traceTiming.vertices += traceGeometry.vertexCount;
    }
    gl.scissor(clipRect.left, canvas.height - clipRect.bottom, clipRect.width, clipRect.height);
    gl.useProgram(renderer.beamProgram);
    gl.uniform2f(renderer.beamCanvasSizeLocation, canvas.width, canvas.height);
    gl.uniform1f(renderer.beamSizeLocation, safeDotThicknessPx);
    const intensity = Number(options.intensity);
    gl.uniform1f(renderer.beamIntensityLocation, Number.isFinite(intensity) ? Math.max(0, intensity) : 0.1);
    const color = Array.isArray(options.color) ? options.color : [0.7, 1, 0.9];
    gl.uniform3f(renderer.beamColorLocation, color[0], color[1], color[2]);
    gl.bindBuffer(gl.ARRAY_BUFFER, renderer.beamBuffer);
    const glBufferDataStartMs = options.traceTiming ? nodeGraphModuleScopeNowMs() : 0;
    gl.bufferData(
      gl.ARRAY_BUFFER,
      traceGeometry.vertices.subarray(0, traceGeometry.vertexFloatCount),
      gl.STREAM_DRAW,
    );
    if (options.traceTiming) {
      options.traceTiming.glBufferDataMs += Math.max(0, nodeGraphModuleScopeNowMs() - glBufferDataStartMs);
    }
    gl.vertexAttribPointer(renderer.beamStartLocation, 2, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(renderer.beamStartLocation);
    gl.vertexAttribPointer(renderer.beamEndLocation, 2, gl.FLOAT, false, 24, 8);
    gl.enableVertexAttribArray(renderer.beamEndLocation);
    gl.vertexAttribPointer(renderer.beamCornerLocation, 1, gl.FLOAT, false, 24, 16);
    gl.enableVertexAttribArray(renderer.beamCornerLocation);
    gl.vertexAttribPointer(renderer.beamPointAgeLocation, 1, gl.FLOAT, false, 24, 20);
    gl.enableVertexAttribArray(renderer.beamPointAgeLocation);
    const drawArraysStartMs = options.traceTiming ? nodeGraphModuleScopeNowMs() : 0;
    gl.drawArrays(gl.TRIANGLES, 0, traceGeometry.vertexCount);
    if (options.traceTiming) {
      options.traceTiming.drawArraysMs += Math.max(0, nodeGraphModuleScopeNowMs() - drawArraysStartMs);
    }
    return;
  }
  const vertices = [];
  let pointCount = 0;
  const xyPoints = nodeGraphModuleScopeXyPoints(buffer, rect, canvas, pixelRatio, slot);
  if (xyPoints.length >= 4) {
    pointCount += xyPoints.length / 2;
    const vertexStartMs = options.traceTiming ? nodeGraphModuleScopeNowMs() : 0;
    appendNodeGraphModuleScopeVertices(vertices, nodeGraphModuleScopeBeamVertices(xyPoints, canvas));
    if (options.traceTiming) {
      options.traceTiming.vertexGenerationMs += Math.max(0, nodeGraphModuleScopeNowMs() - vertexStartMs);
    }
  } else {
    for (const [start, end] of nodeGraphModuleScopeBufferProgressRanges(buffer)) {
      const points = nodeGraphModuleScopeBufferSegmentPoints(
        buffer,
        rect,
        canvas,
        pixelRatio,
        slot,
        start,
        end,
        options,
      );
      if (points.length >= 4) {
        pointCount += points.length / 2;
        const vertexStartMs = options.traceTiming ? nodeGraphModuleScopeNowMs() : 0;
        appendNodeGraphModuleScopeVertices(vertices, nodeGraphModuleScopeBeamVertices(points, canvas));
        if (options.traceTiming) {
          options.traceTiming.vertexGenerationMs += Math.max(0, nodeGraphModuleScopeNowMs() - vertexStartMs);
        }
      }
    }
  }
  if (vertices.length < 36) {
    return;
  }
  if (options.traceTiming) {
    options.traceTiming.passes += 1;
    options.traceTiming.points += pointCount;
    options.traceTiming.vertices += vertices.length / 6;
  }
  recordNodeGraphModuleScopeRenderMetrics(pointCount, vertices.length / 6);
  gl.scissor(clipRect.left, canvas.height - clipRect.bottom, clipRect.width, clipRect.height);
  gl.useProgram(renderer.beamProgram);
  gl.uniform2f(renderer.beamCanvasSizeLocation, canvas.width, canvas.height);
  gl.uniform1f(renderer.beamSizeLocation, safeDotThicknessPx);
  const intensity = Number(options.intensity);
  gl.uniform1f(renderer.beamIntensityLocation, Number.isFinite(intensity) ? Math.max(0, intensity) : 0.1);
  const color = Array.isArray(options.color) ? options.color : [0.7, 1, 0.9];
  gl.uniform3f(renderer.beamColorLocation, color[0], color[1], color[2]);
  gl.bindBuffer(gl.ARRAY_BUFFER, renderer.beamBuffer);
  const glBufferDataStartMs = options.traceTiming ? nodeGraphModuleScopeNowMs() : 0;
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
  if (options.traceTiming) {
    options.traceTiming.glBufferDataMs += Math.max(0, nodeGraphModuleScopeNowMs() - glBufferDataStartMs);
  }
  gl.vertexAttribPointer(renderer.beamStartLocation, 2, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(renderer.beamStartLocation);
  gl.vertexAttribPointer(renderer.beamEndLocation, 2, gl.FLOAT, false, 24, 8);
  gl.enableVertexAttribArray(renderer.beamEndLocation);
  gl.vertexAttribPointer(renderer.beamCornerLocation, 1, gl.FLOAT, false, 24, 16);
  gl.enableVertexAttribArray(renderer.beamCornerLocation);
  gl.vertexAttribPointer(renderer.beamPointAgeLocation, 1, gl.FLOAT, false, 24, 20);
  gl.enableVertexAttribArray(renderer.beamPointAgeLocation);
  const drawArraysStartMs = options.traceTiming ? nodeGraphModuleScopeNowMs() : 0;
  gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 6);
  if (options.traceTiming) {
    options.traceTiming.drawArraysMs += Math.max(0, nodeGraphModuleScopeNowMs() - drawArraysStartMs);
  }
}

function drawNodeGraphModuleScopeSpectrumBarsWebGl(renderer, rect, buffer, pixelRatio, options = {}) {
  const { canvas, gl } = renderer;
  const visibleRect = nodeGraphModuleScopeVisibleMetricRect(rect, options);
  const clipRect = nodeGraphModuleScopeClippedPixelRect(canvas, visibleRect, pixelRatio);
  if (!clipRect) {
    return;
  }
  const vertices = nodeGraphModuleScopeSpectrumBarVertices(buffer, {
    height: rect.height * pixelRatio,
    left: rect.left * pixelRatio,
    top: rect.top * pixelRatio,
    width: rect.width * pixelRatio,
  }, canvas, options);
  if (vertices.length < 6) {
    return;
  }
  recordNodeGraphModuleScopeRenderMetrics(vertices.length / 12, vertices.length / 2);
  gl.scissor(clipRect.left, canvas.height - clipRect.bottom, clipRect.width, clipRect.height);
  gl.useProgram(renderer.colorProgram);
  const color = Array.isArray(options.color) ? options.color : [0.7, 1, 0.9];
  const intensity = clampNodeSliderValue(Number(options.intensity) || 0.1, 0, 4);
  gl.uniform4f(
    renderer.colorLocation,
    color[0] * intensity,
    color[1] * intensity,
    color[2] * intensity,
    intensity,
  );
  gl.bindBuffer(gl.ARRAY_BUFFER, renderer.colorPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
  gl.vertexAttribPointer(renderer.colorPositionLocation, 2, gl.FLOAT, false, 8, 0);
  gl.enableVertexAttribArray(renderer.colorPositionLocation);
  gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2);
}

function drawNodeGraphModuleScopeTexturedQuad(renderer, texture, mode = 0, decay = {}, quad = null) {
  const { canvas, gl } = renderer;
  gl.useProgram(renderer.textureProgram);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(renderer.textureSamplerLocation, 0);
  gl.uniform1i(renderer.textureModeLocation, mode);
  const decayFast = Number(decay.fast);
  const decaySlow = Number(decay.slow);
  const decayFloor = Number(decay.floor);
  gl.uniform1f(renderer.textureDecayFastLocation, Number.isFinite(decayFast) ? decayFast : 0.94);
  gl.uniform1f(renderer.textureDecaySlowLocation, Number.isFinite(decaySlow) ? decaySlow : 0.985);
  gl.uniform1f(renderer.textureFloorFadeLocation, Number.isFinite(decayFloor) ? decayFloor : 0.004);
  const texelOffset = Array.isArray(quad?.texelOffset) ? quad.texelOffset : [0, 0];
  gl.uniform2f(
    renderer.textureTexelOffsetLocation,
    Number.isFinite(Number(texelOffset[0])) ? Number(texelOffset[0]) : 0,
    Number.isFinite(Number(texelOffset[1])) ? Number(texelOffset[1]) : 0,
  );
  const vertices = Array.isArray(quad?.vertices) && quad.vertices.length >= 16
    ? quad.vertices
    : [
      -1, -1, 0, 0,
      1, -1, 1, 0,
      -1, 1, 0, 1,
      1, 1, 1, 1,
    ];
  gl.bindBuffer(gl.ARRAY_BUFFER, renderer.quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  gl.vertexAttribPointer(renderer.texturePositionLocation, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(renderer.texturePositionLocation);
  gl.vertexAttribPointer(renderer.textureTexCoordLocation, 2, gl.FLOAT, false, 16, 8);
  gl.enableVertexAttribArray(renderer.textureTexCoordLocation);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function nodeGraphModuleScopeTextureQuadForRect(canvas, rect, pixelRatio = window.devicePixelRatio || 1) {
  const clipRect = nodeGraphModuleScopeClippedPixelRect(canvas, rect, pixelRatio);
  if (!clipRect) {
    return [
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
    ];
  }
  const clipLeft = (clipRect.left / canvas.width) * 2 - 1;
  const clipRight = (clipRect.right / canvas.width) * 2 - 1;
  const clipTop = 1 - (clipRect.top / canvas.height) * 2;
  const clipBottom = 1 - (clipRect.bottom / canvas.height) * 2;
  const texLeft = clipRect.left / canvas.width;
  const texRight = clipRect.right / canvas.width;
  const texTop = 1 - (clipRect.top / canvas.height);
  const texBottom = 1 - (clipRect.bottom / canvas.height);
  return [
    clipLeft, clipBottom, texLeft, texBottom,
    clipRight, clipBottom, texRight, texBottom,
    clipLeft, clipTop, texLeft, texTop,
    clipRight, clipTop, texRight, texTop,
  ];
}

function nodeGraphModuleScopeScissorRect(gl, canvas, rect, pixelRatio = window.devicePixelRatio || 1) {
  const clipRect = nodeGraphModuleScopeClippedPixelRect(canvas, rect, pixelRatio);
  if (!clipRect) {
    return false;
  }
  gl.scissor(clipRect.left, canvas.height - clipRect.bottom, clipRect.width, clipRect.height);
  return true;
}

function nodeGraphModuleScopeShouldDecaySlot(slot, buffer, settings) {
  if (nodeGraphModuleScopeTraceBurn(settings) <= 0) {
    return true;
  }
  const isFrequencyResetOscillator =
    nodeGraphModuleScopeIsOscillatorType(slot?.type) &&
    settings?.oscillatorTraceMode !== "window" &&
    !buffer?.nodeGraphScopeXy;
  if (!isFrequencyResetOscillator) {
    return true;
  }
  return Boolean(buffer?.nodeGraphScopeDrawWrap || buffer?.nodeGraphScopeDrawFullWindow);
}

function nodeGraphModuleScopeDecayRegions(items) {
  return (items || [])
    .filter((item) => nodeGraphModuleScopeShouldDecaySlot(item.slot, item.buffer, item.settings))
    .map((item) => ({
      rect: item.visibleDrawRect || item.displayRect || item.scopeRect,
      scrollPixels: item.buffer?.nodeGraphScopeClassicOutputDecay ? 1 : 0,
      settings: item.settings,
    }));
}

function drawNodeGraphModuleScopePhosphorFade(renderer, settings = nodeGraphModuleScopeDefaultSettings, regions = null) {
  const { canvas, gl } = renderer;
  if (!resizeNodeGraphModuleScopePhosphorTargets(renderer) || renderer.phosphorTargets.length < 2) {
    return null;
  }
  const masterBurn = typeof normalizeNodeGraphModuleScopeBurn === "function"
    ? normalizeNodeGraphModuleScopeBurn(nodeGraphMvp?.moduleScopeBurn ?? 0)
    : 0;
  const read = renderer.phosphorTargets[renderer.phosphorReadIndex];
  const writeIndex = 1 - renderer.phosphorReadIndex;
  const write = renderer.phosphorTargets[writeIndex];
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.disable(gl.SCISSOR_TEST);
  gl.disable(gl.BLEND);
  gl.bindFramebuffer(gl.FRAMEBUFFER, write.framebuffer);
  if (masterBurn <= 0) {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    renderer.phosphorPrimed = true;
  } else if (!renderer.phosphorPrimed) {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    renderer.phosphorPrimed = true;
  } else if (Array.isArray(regions)) {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (regions.length) {
      const pixelRatio = Number(renderer.pixelRatio) ||
        Number(nodeGraphModuleScopeState.backingPixelRatio) ||
        (window.devicePixelRatio || 1);
      gl.enable(gl.SCISSOR_TEST);
      for (const region of regions) {
        if (!nodeGraphModuleScopeScissorRect(gl, canvas, region.rect, pixelRatio)) {
          continue;
        }
        const scrollPixels = Math.max(0, Number(region.scrollPixels) || 0) * pixelRatio;
        drawNodeGraphModuleScopeTexturedQuad(
          renderer,
          read.texture,
          1,
          nodeGraphModuleScopeBurnDecaySettings(region.settings),
          scrollPixels > 0
            ? {
              texelOffset: [scrollPixels / canvas.width, 0],
              vertices: nodeGraphModuleScopeTextureQuadForRect(canvas, region.rect, pixelRatio),
            }
            : null,
        );
        if (scrollPixels > 0) {
          const clipRect = nodeGraphModuleScopeClippedPixelRect(canvas, region.rect, pixelRatio);
          if (!clipRect) {
            continue;
          }
          const stripWidth = Math.max(1, Math.ceil(scrollPixels + nodeGraphModuleScopeDotSizeScale() * pixelRatio));
          gl.scissor(
            Math.max(0, Math.min(canvas.width - 1, clipRect.right - stripWidth)),
            canvas.height - clipRect.bottom,
            Math.max(1, Math.min(stripWidth, clipRect.width)),
            clipRect.height,
          );
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
      }
      gl.disable(gl.SCISSOR_TEST);
    }
  } else {
    drawNodeGraphModuleScopeTexturedQuad(
      renderer,
      read.texture,
      1,
      nodeGraphModuleScopeBurnDecaySettings(settings),
    );
  }
  renderer.phosphorReadIndex = writeIndex;
  return write;
}

function compositeNodeGraphModuleScopePhosphor(renderer) {
  const { canvas, gl } = renderer;
  const target = renderer.phosphorTargets[renderer.phosphorReadIndex];
  if (!target) {
    return;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.disable(gl.SCISSOR_TEST);
  gl.disable(gl.BLEND);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  drawNodeGraphModuleScopeTexturedQuad(renderer, target.texture, 0);
}

function drawNodeGraphModuleScopeLightShape(context, shape, centerX, centerY, radius) {
  context.beginPath();
  if (shape === "square") {
    context.rect(centerX - radius, centerY - radius, radius * 2, radius * 2);
  } else if (shape === "diamond") {
    context.moveTo(centerX, centerY - radius);
    context.lineTo(centerX + radius, centerY);
    context.lineTo(centerX, centerY + radius);
    context.lineTo(centerX - radius, centerY);
    context.closePath();
  } else {
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  }
}

function nodeGraphModuleScopeLightFillStyle(context, centerX, centerY, radius, rgb, alpha, blurValue = 0) {
  const alphaValue = clampNodeSliderValue(Number(alpha) || 0, 0, 1);
  const blur = normalizeNodeGraphModuleScopeDotBlur(blurValue, 0);
  if (blur <= 0) {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alphaValue})`;
  }
  const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(0.0001, radius));
  const middleStop = clampNodeSliderValue(0.22 + (1 - blur) * 0.58, 0.22, 0.8);
  gradient.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alphaValue})`);
  gradient.addColorStop(middleStop, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alphaValue})`);
  gradient.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0)`);
  return gradient;
}

function nodeGraphModuleScopeLocalFallbackCanvas(slot) {
  const screenElement = slot?.scopeElement;
  if (!screenElement) {
    return null;
  }
  let canvas = screenElement.querySelector(":scope > .node-module-scope-local-fallback-canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.className = "node-module-scope-local-fallback-canvas";
    canvas.setAttribute("aria-hidden", "true");
    screenElement.appendChild(canvas);
  }
  return canvas;
}

function syncNodeGraphModuleScopeLocalFallbackCanvas(canvas, screenElement, pixelRatio) {
  if (!canvas || !screenElement) {
    return false;
  }
  const width = Math.max(1, Math.round(screenElement.clientWidth * pixelRatio));
  const height = Math.max(1, Math.round(screenElement.clientHeight * pixelRatio));
  if (canvas.width !== width) {
    canvas.width = width;
  }
  if (canvas.height !== height) {
    canvas.height = height;
  }
  return true;
}

function clearNodeGraphModuleScopeLocalFallback(slot) {
  const canvas = slot?.scopeElement?.querySelector?.(":scope > .node-module-scope-local-fallback-canvas");
  const context = canvas?.getContext?.("2d");
  if (canvas && context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function applyNodeGraphModuleScopeCanvasAnalogFade(context, canvas, settings) {
  const burn = nodeGraphModuleScopeTraceBurn(settings);
  const decay = typeof normalizeNodeGraphModuleScopeDecay === "function"
    ? normalizeNodeGraphModuleScopeDecay(nodeGraphMvp?.moduleScopeDecay ?? 0)
    : 0;
  if (!canvas?.width || !canvas?.height || !context) {
    return;
  }
  if (burn <= 0) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  const fadeAlpha = clampNodeSliderValue(0.018 + decay * 0.13 - burn * 0.065, 0.006, 0.18);
  context.save();
  context.globalCompositeOperation = "destination-out";
  context.fillStyle = `rgba(0, 0, 0, ${fadeAlpha.toFixed(4)})`;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.restore();
}

function nodeGraphModuleScopeFallbackBufferView(buffer, limit = 2048) {
  if (!buffer || buffer.nodeGraphScopeShaderMode === "one_value") {
    return buffer;
  }
  const safeLimit = Math.max(16, Math.min(1024, Math.floor(Number(limit) || 384)));
  if (buffer.nodeGraphScopeXy) {
    return {
      ...buffer,
      nodeGraphScopeVisualPointLimit: Math.min(
        safeLimit,
        Math.max(2, Math.floor(Number(buffer.nodeGraphScopeVisualPointLimit) || safeLimit)),
      ),
    };
  }
  buffer.nodeGraphScopeVisualPointLimit = Math.min(
    safeLimit,
    Math.max(2, Math.floor(Number(buffer.nodeGraphScopeVisualPointLimit) || safeLimit)),
  );
  return buffer;
}

function nodeGraphModuleScopeCanvasDotSprite(heatmapMode = false) {
  const dataUrl = typeof nodeGraphTraceImageDataUrl === "function" ? nodeGraphTraceImageDataUrl() : "";
  if (dataUrl && !heatmapMode) {
    const imageKey = `canvas-dot-image:${dataUrl}`;
    const cachedImage = nodeGraphModuleScopeState.lightSpriteTextures.get(imageKey);
    if (cachedImage?.image?.complete) {
      return cachedImage;
    }
    if (!cachedImage) {
      const image = new Image();
      image.onload = () => scheduleNodeGraphModuleScopeDraw();
      image.src = dataUrl;
      nodeGraphModuleScopeState.lightSpriteTextures.set(imageKey, { canvas: image, image, size: 64 });
      nodeGraphModuleScopeTrimLightSpriteCache();
    }
  }

  const core1Enabled = nodeGraphMvp?.moduleScopeDotCore1Enabled !== false;
  const core2Enabled = nodeGraphMvp?.moduleScopeDotCore2Enabled !== false;
  const core1Size = normalizeNodeGraphModuleScopeDotCoreSize(
    nodeGraphMvp?.moduleScopeDotCore1Size ?? nodeGraphModuleScopeDefaultDotCores.dot1.size,
    nodeGraphModuleScopeDefaultDotCores.dot1.size,
  );
  const core1Brightness = normalizeNodeGraphModuleScopeDotCoreBrightness(
    nodeGraphMvp?.moduleScopeDotCore1Brightness ?? nodeGraphModuleScopeDefaultDotCores.dot1.brightness,
    nodeGraphModuleScopeDefaultDotCores.dot1.brightness,
  );
  const core1Color = normalizeNodeGraphModuleScopeDotCoreColor(
    nodeGraphMvp?.moduleScopeDotCore1Color ?? nodeGraphModuleScopeDefaultDotCores.dot1.color,
    nodeGraphModuleScopeDefaultDotCores.dot1.color,
  );
  const core2Size = normalizeNodeGraphModuleScopeDotCoreSize(
    nodeGraphMvp?.moduleScopeDotCore2Size ?? nodeGraphModuleScopeDefaultDotCores.dot2.size,
    nodeGraphModuleScopeDefaultDotCores.dot2.size,
  );
  const core2Brightness = normalizeNodeGraphModuleScopeDotCoreBrightness(
    nodeGraphMvp?.moduleScopeDotCore2Brightness ?? nodeGraphModuleScopeDefaultDotCores.dot2.brightness,
    nodeGraphModuleScopeDefaultDotCores.dot2.brightness,
  );
  const core2Color = normalizeNodeGraphModuleScopeDotCoreColor(
    nodeGraphMvp?.moduleScopeDotCore2Color ?? nodeGraphModuleScopeDefaultDotCores.dot2.color,
    nodeGraphModuleScopeDefaultDotCores.dot2.color,
  );
  const lineThickness = normalizeNodeGraphModuleScopeLineThickness(
    nodeGraphMvp?.moduleScopeLineThickness ?? nodeGraphModuleScopeDefaultSettings.lineThickness,
  );
  const key = [
    "canvas-dot-generated",
    heatmapMode ? "heatmap" : "color",
    core1Enabled ? "core1-on" : "core1-off",
    core1Size.toFixed(3),
    core1Brightness.toFixed(3),
    heatmapMode ? "#ffffff" : core1Color,
    core2Enabled ? "core2-on" : "core2-off",
    core2Size.toFixed(3),
    core2Brightness.toFixed(3),
    heatmapMode ? "#ffffff" : core2Color,
    lineThickness.toFixed(3),
  ].join(":");
  const cached = nodeGraphModuleScopeState.lightSpriteTextures.get(key);
  if (cached) {
    return cached;
  }

  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  const pixels = nodeGraphModuleScopeGeneratedDotTextureData({
    core1Blur: heatmapMode ? 0.72 : 0.58,
    core1Brightness: core1Enabled
      ? heatmapMode ? Math.max(0.55, core1Brightness) : core1Brightness
      : 0,
    core1Color: heatmapMode ? "#ffffff" : core1Color,
    core1Size,
    core2Blur: 0.95,
    core2Brightness: core2Enabled
      ? heatmapMode ? Math.max(0.18, core2Brightness * 0.65) : core2Brightness
      : 0,
    core2Color: heatmapMode ? "#ffffff" : core2Color,
    core2Size,
    lineThickness,
    size,
  });
  context.putImageData(new ImageData(new Uint8ClampedArray(pixels), size, size), 0, 0);
  const sprite = { canvas, size };
  nodeGraphModuleScopeState.lightSpriteTextures.set(key, sprite);
  nodeGraphModuleScopeTrimLightSpriteCache();
  return sprite;
}

function nodeGraphModuleScopeCanvasRgba(rgb, alpha) {
  const color = Array.isArray(rgb) ? rgb : [1, 1, 1];
  const opacity = clampNodeSliderValue(Number(alpha) || 0, 0, 1);
  return `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, ${opacity})`;
}

function drawNodeGraphModuleScopeCanvasDotPath(context, points, proxyCanvas, pixelRatio, heatmapMode = false, slot = null) {
  const pixelPoints = nodeGraphModuleScopePixelPoints(points, proxyCanvas);
  if (pixelPoints.length < 4) {
    return false;
  }
  const lineThickness = normalizeNodeGraphModuleScopeLineThickness(
    nodeGraphMvp?.moduleScopeLineThickness ?? nodeGraphModuleScopeDefaultSettings.lineThickness,
  );
  const strokeUnit = Math.max(1, lineThickness * Math.max(1, pixelRatio));
  const rawValues = Array.isArray(points?.nodeGraphScopeRawValues)
    ? points.nodeGraphScopeRawValues
    : null;
  const skippedPoints = Array.isArray(points?.nodeGraphScopeSkippedPoints)
    ? points.nodeGraphScopeSkippedPoints
    : null;
  const skipSamples = nodeGraphModuleScopeDiscontinuitySkipSamplesForPoints(points);
  const colors = heatmapMode ? nodeGraphModuleScopeHeatmapTraceColors() : nodeGraphModuleScopeDotStyle(slot, null);
  const haloBrightness = heatmapMode
    ? (nodeGraphMvp?.moduleScopeDotCore2Enabled === false ? 0 : 1)
    : colors.haloBrightness / nodeGraphModuleScopeDefaultDotCores.dot2.brightness;
  const coreBrightness = heatmapMode
    ? (nodeGraphMvp?.moduleScopeDotCore1Enabled === false ? 0 : 1)
    : colors.coreBrightness / nodeGraphModuleScopeDefaultDotCores.dot1.brightness;
  let segmentCount = 0;

  context.save();
  context.globalCompositeOperation = "lighter";
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const drawConnectedStroke = (lineWidth, shadowBlur, rgb, alpha) => {
    context.beginPath();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = lineWidth;
    context.shadowBlur = shadowBlur;
    context.shadowColor = nodeGraphModuleScopeCanvasRgba(rgb, alpha * 0.65);
    context.strokeStyle = nodeGraphModuleScopeCanvasRgba(rgb, alpha);
    let pathOpen = false;
    let localSkipThroughSegment = -1;
    for (let index = 0; index + 3 < pixelPoints.length; index += 2) {
      const segmentIndex = index / 2;
      if (skippedPoints?.[segmentIndex] || skippedPoints?.[segmentIndex + 1]) {
        pathOpen = false;
        continue;
      }
      if (skipSamples > 0 && rawValues && segmentIndex + 1 < rawValues.length) {
        const previousRaw = Number(rawValues[segmentIndex]);
        const currentRaw = Number(rawValues[segmentIndex + 1]);
        if (
          Number.isFinite(previousRaw) &&
          Number.isFinite(currentRaw) &&
          Math.abs(currentRaw - previousRaw) > nodeGraphModuleScopeDiscontinuityThreshold
        ) {
          localSkipThroughSegment = Math.max(localSkipThroughSegment, segmentIndex + skipSamples - 1);
        }
      }
      if (segmentIndex <= localSkipThroughSegment) {
        pathOpen = false;
        continue;
      }
      const x1 = pixelPoints[index];
      const y1 = pixelPoints[index + 1];
      const x2 = pixelPoints[index + 2];
      const y2 = pixelPoints[index + 3];
      if (Math.hypot(x2 - x1, y2 - y1) < 0.001) {
        continue;
      }
      if (!pathOpen) {
        context.moveTo(x1, y1);
        pathOpen = true;
      }
      context.lineTo(x2, y2);
      segmentCount += 1;
    }
    context.stroke();
  };

  if (haloBrightness > 0) {
    drawConnectedStroke(
      strokeUnit * 5.5,
      strokeUnit * 4.5,
      colors.haloColor ?? colors.halo,
      (heatmapMode ? 0.14 : 0.18) * haloBrightness,
    );
  }
  if (coreBrightness > 0) {
    drawConnectedStroke(
      strokeUnit * 1.65,
      strokeUnit * 1.25,
      colors.coreColor ?? colors.core,
      (heatmapMode ? 0.5 : 0.76) * coreBrightness,
    );
  }
  context.restore();
  recordNodeGraphModuleScopeRenderMetrics(points.length / 2, segmentCount);
  return segmentCount > 0;
}

function drawNodeGraphVisualOscilloscopeLocalFallback(screenItem, pixelRatio) {
  const { buffer, drawRect, screenRect, settings, slot, visibleDrawRect, visibleProgressRange } = screenItem || {};
  if (slot?.type !== "visualOscilloscope" || !buffer || !drawRect || !screenRect) {
    clearNodeGraphModuleScopeLocalFallback(slot);
    return;
  }
  const canvas = nodeGraphModuleScopeLocalFallbackCanvas(slot);
  if (!syncNodeGraphModuleScopeLocalFallbackCanvas(canvas, slot.scopeElement, pixelRatio)) {
    return;
  }
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  const fallbackBuffer = nodeGraphModuleScopeFallbackBufferView(buffer);
  applyNodeGraphModuleScopeCanvasAnalogFade(context, canvas, settings);
  const localScaleX = screenRect.width > 0
    ? canvas.clientWidth / screenRect.width
    : 1;
  const localScaleY = screenRect.height > 0
    ? canvas.clientHeight / screenRect.height
    : 1;
  const localRect = {
    height: drawRect.height * localScaleY,
    left: (drawRect.left - screenRect.left) * localScaleX,
    sampleHeight: screenItem.scopeRect?.sampleHeight || drawRect.height,
    sampleWidth: screenItem.scopeRect?.sampleWidth || drawRect.width,
    top: (drawRect.top - screenRect.top) * localScaleY,
    width: drawRect.width * localScaleX,
  };
  const localVisibleRect = visibleDrawRect
    ? {
      height: visibleDrawRect.height * localScaleY,
      left: (visibleDrawRect.left - screenRect.left) * localScaleX,
      sampleHeight: screenItem.visibleScopeRect?.sampleHeight || visibleDrawRect.height,
      sampleWidth: screenItem.visibleScopeRect?.sampleWidth || visibleDrawRect.width,
      top: (visibleDrawRect.top - screenRect.top) * localScaleY,
      width: visibleDrawRect.width * localScaleX,
    }
    : localRect;
  const localVisibleOptions = {
    visibleProgressRange,
    visibleRect: localVisibleRect,
  };
  const proxyCanvas = {
    height: canvas.height,
    width: canvas.width,
  };
  const heatmapMode = nodeGraphModuleScopeHeatmapEnabled(slot);
  const xyPoints = nodeGraphModuleScopeXyPoints(fallbackBuffer, localRect, proxyCanvas, pixelRatio, slot);
  let drewTrace = false;
  if (xyPoints.length >= 4) {
    drewTrace = drawNodeGraphModuleScopeCanvasDotPath(context, xyPoints, proxyCanvas, pixelRatio, heatmapMode, slot);
  } else {
    for (const [start, end] of nodeGraphModuleScopeBufferProgressRanges(fallbackBuffer)) {
      drewTrace = drawNodeGraphModuleScopeCanvasDotPath(
        context,
        nodeGraphModuleScopeBufferSegmentPoints(
          fallbackBuffer,
          localRect,
          proxyCanvas,
          pixelRatio,
          slot,
          start,
          end,
          localVisibleOptions,
        ),
        proxyCanvas,
        pixelRatio,
        heatmapMode,
        slot,
      ) || drewTrace;
    }
  }
  if (!drewTrace) {
    recordNodeGraphModuleScopeRenderMetrics(0, 0);
  }
}

function nodeGraphModuleScopeLightSpriteKey(options) {
  return [
    options.shape,
    Math.round(options.radius * 1000) / 1000,
    Math.round(options.centerRatio * 1000) / 1000,
    options.outerRgb.join(","),
    options.centerRgb.join(","),
    Math.round(options.outerAlphaFactor * 1000) / 1000,
    Math.round(options.centerAlphaFactor * 1000) / 1000,
    Math.round(options.outerBlur * 1000) / 1000,
    Math.round(options.centerBlur * 1000) / 1000,
    options.usesShader ? "shader" : "normal",
  ].join("|");
}

function nodeGraphModuleScopeTrimLightSpriteCache() {
  const cache = nodeGraphModuleScopeState.lightSpriteTextures;
  const maxSprites = 96;
  while (cache.size > maxSprites) {
    const firstKey = cache.keys().next().value;
    if (!firstKey) {
      break;
    }
    cache.delete(firstKey);
  }
}

function nodeGraphModuleScopeLightSpriteTexture(options) {
  const radius = Math.max(0.5, Number(options.radius) || 0.5);
  const size = Math.max(2, Math.ceil(radius * 2));
  const key = nodeGraphModuleScopeLightSpriteKey({ ...options, radius });
  const cached = nodeGraphModuleScopeState.lightSpriteTextures.get(key);
  if (cached) {
    return cached;
  }

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  const center = size * 0.5;
  const drawRadius = Math.max(0.5, Math.min(center, radius));
  context.save();
  context.globalCompositeOperation = options.usesShader ? "source-over" : "lighter";
  context.fillStyle = nodeGraphModuleScopeLightFillStyle(
    context,
    center,
    center,
    drawRadius,
    options.outerRgb,
    options.outerAlphaFactor,
    options.outerBlur,
  );
  drawNodeGraphModuleScopeLightShape(context, options.shape, center, center, drawRadius);
  context.fill();
  context.globalCompositeOperation = "lighter";
  context.fillStyle = nodeGraphModuleScopeLightFillStyle(
    context,
    center,
    center,
    drawRadius * options.centerRatio,
    options.centerRgb,
    options.centerAlphaFactor,
    options.centerBlur,
  );
  drawNodeGraphModuleScopeLightShape(context, options.shape, center, center, drawRadius * options.centerRatio);
  context.fill();
  context.restore();

  const sprite = { canvas, size };
  nodeGraphModuleScopeState.lightSpriteTextures.set(key, sprite);
  nodeGraphModuleScopeTrimLightSpriteCache();
  return sprite;
}

function nodeGraphModuleScopeEmissiveShaderRgb(rgb, brightness) {
  const values = (rgb || []).map((component) => Math.round(clampNodeSliderValue(component, 0, 255)));
  const maxChannel = Math.max(0, ...values);
  if (maxChannel <= 0) {
    return values;
  }
  const targetMax = clampNodeSliderValue(72 + Math.max(0, Number(brightness) || 0) * 144, 72, 255);
  const scale = Math.max(1, targetMax / maxChannel);
  return values.map((component) => Math.round(clampNodeSliderValue(component * scale, 0, 255)));
}

function drawNodeGraphModuleScopeLightDisplay(context, rect, buffer, pixelRatio, slot) {
  if (!context || !buffer?.nodeGraphScopeLightDisplay) {
    return;
  }
  const nodeId = String(slot?.nodeId || "");
  const settings = nodeGraphModuleScopeSetting(nodeId);
  const dt = clampNodeSliderValue(Number(nodeGraphModuleScopeState.animationDeltaSeconds) || (1 / 60), 1 / 240, 1 / 15);
  const target = clampNodeSliderValue(Number(buffer.nodeGraphScopeLightTarget) || 0, 0, 1);
  const releaseSeconds = Number(buffer.nodeGraphScopeLightReleaseSeconds);
  const hasRelease = Number.isFinite(releaseSeconds) && releaseSeconds > 0;
  let brightness = target;
  if (hasRelease) {
    const state = nodeGraphModuleScopeState.lightDisplayStates.get(nodeId) || { brightness: 0 };
    if (target >= state.brightness) {
      state.brightness = target;
    } else {
      const coefficient = 1 - Math.exp(-dt / Math.max(0.001, releaseSeconds));
      state.brightness = clampNodeSliderValue(state.brightness + (target - state.brightness) * coefficient, 0, 1);
    }
    nodeGraphModuleScopeState.lightDisplayStates.set(nodeId, state);
    brightness = state.brightness;
  } else if (!buffer.nodeGraphScopeLightInstant) {
    const state = nodeGraphModuleScopeState.lightDisplayStates.get(nodeId) || { brightness: 0 };
    const burn = nodeGraphModuleScopeTraceBurn(settings);
    const tau = target > state.brightness ? 0.008 : 0.018 + burn * 0.72;
    const coefficient = tau <= 0 ? 1 : 1 - Math.exp(-dt / tau);
    state.brightness = clampNodeSliderValue(state.brightness + (target - state.brightness) * coefficient, 0, 1);
    nodeGraphModuleScopeState.lightDisplayStates.set(nodeId, state);
    brightness = state.brightness;
  } else {
    nodeGraphModuleScopeState.lightDisplayStates.delete(nodeId);
  }
  if (brightness <= 0.002) {
    return;
  }

  const lightStyle = nodeGraphModuleScopeLightShaderStyle(slot, buffer);
  const outerColor = lightStyle.outerColor;
  const centerColor = lightStyle.centerColor;
  const outerRgb = nodeGraphScopeHexColorToRgb(outerColor)
    .map((component) => Math.round(clampNodeSliderValue(component, 0, 1) * 255));
  const centerRgb = nodeGraphScopeHexColorToRgb(centerColor)
    .map((component) => Math.round(clampNodeSliderValue(component, 0, 1) * 255));
  const core1Size = lightStyle.centerSize;
  const core1Brightness = lightStyle.centerBrightness;
  const core1Blur = lightStyle.centerBlur;
  const core2Size = lightStyle.outerSize;
  const core2Brightness = lightStyle.outerBrightness;
  const core2Blur = lightStyle.outerBlur;
  const availableSize = Math.max(1, Math.min(rect.width, rect.height));
  const outerSizeRatio = clampNodeSliderValue(core2Size, 0, 1);
  const centerSizeRatio = clampNodeSliderValue(core1Size, 0, 1);
  const size = Math.max(1, availableSize * outerSizeRatio);
  const centerX = (rect.left + rect.width * 0.5) * pixelRatio;
  const centerY = (rect.top + rect.height * 0.5) * pixelRatio;
  const radius = size * pixelRatio * 0.5;
  const masterBrightness = nodeGraphModuleScopeTraceBrightness(slot, settings);
  const alpha = clampNodeSliderValue(brightness * masterBrightness, 0, 1);
  const frameBrightnessMode = buffer.nodeGraphScopeFrameBrightness === true;
  const shape = ["circle", "square", "diamond"].includes(buffer.nodeGraphScopeLightShape)
    ? buffer.nodeGraphScopeLightShape
    : "circle";
  const centerRatio = Math.max(
    Number(buffer.nodeGraphScopeLightCenterMinRatio) || 0,
    outerSizeRatio > 0
      ? clampNodeSliderValue(centerSizeRatio / outerSizeRatio, 0, 1)
      : 0,
  );
  const outerAlphaScale = Number.isFinite(Number(buffer.nodeGraphScopeLightOuterAlphaScale))
    ? clampNodeSliderValue(Number(buffer.nodeGraphScopeLightOuterAlphaScale), 0, 4)
    : lightStyle.usesShader ? 1 : 0.38;
  const centerAlphaScale = Number.isFinite(Number(buffer.nodeGraphScopeLightCenterAlphaScale))
    ? clampNodeSliderValue(Number(buffer.nodeGraphScopeLightCenterAlphaScale), 0, 4)
    : lightStyle.usesShader ? 1 : 0.5;
  const sharedFrameAlphaFactor = frameBrightnessMode ? 1 : null;
  const outerAlphaFactor = sharedFrameAlphaFactor ?? clampNodeSliderValue(core2Brightness * outerAlphaScale, 0, 1);
  const centerAlphaFactor = sharedFrameAlphaFactor ?? clampNodeSliderValue(core1Brightness * centerAlphaScale, 0, 1);
  const visibleOuterRgb = lightStyle.usesShader
    ? nodeGraphModuleScopeEmissiveShaderRgb(outerRgb, core2Brightness)
    : outerRgb;
  const visibleCenterRgb = lightStyle.usesShader
    ? nodeGraphModuleScopeEmissiveShaderRgb(centerRgb, core1Brightness)
    : centerRgb;
  const sprite = nodeGraphModuleScopeLightSpriteTexture({
    centerAlphaFactor,
    centerBlur: core1Blur,
    centerRatio,
    centerRgb: visibleCenterRgb,
    outerAlphaFactor,
    outerBlur: core2Blur,
    outerRgb: visibleOuterRgb,
    radius,
    shape,
    usesShader: lightStyle.usesShader,
  });
  if (!sprite) {
    return;
  }

  context.save();
  context.globalCompositeOperation = lightStyle.usesShader ? "source-over" : "lighter";
  context.globalAlpha = alpha;
  context.drawImage(sprite.canvas, centerX - sprite.size * 0.5, centerY - sprite.size * 0.5);
  context.restore();
}

function drawNodeGraphModuleScopeLightDisplays(items, pixelRatio) {
  const canvas = nodeGraphModuleScopeLightCanvas();
  if (!canvas) {
    return;
  }
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  for (const item of items || []) {
    drawNodeGraphModuleScopeLightDisplay(context, item.scopeRect, item.buffer, pixelRatio, item.slot);
  }
}

function nodeGraphModuleScopeScreenItems(workspace, canvas, pixelRatio) {
  const workspaceRect = workspace.getBoundingClientRect();
  const viewportRect = {
    height: workspaceRect.height,
    left: 0,
    top: 0,
    width: workspaceRect.width,
  };
  return nodeGraphVisibleModuleScopeSlots()
    .map((slot) => {
      const buffer = nodeGraphModuleScopeDisplayBuffer(
        slot,
        nodeGraphModuleScopeCapturedBufferForSlot(slot),
      );
      if (!buffer) {
        renderNodeGraphModuleScopeAnalyzer(slot, null);
        clearNodeGraphModuleScopeLocalFallback(slot);
        return null;
      }
      const rect = slot.scopeElement.getBoundingClientRect();
      const screenRect = {
        height: rect.height,
        left: rect.left - workspaceRect.left,
        top: rect.top - workspaceRect.top,
        width: rect.width,
      };
      const drawRect = nodeGraphModuleScopeDrawingRect(screenRect, buffer, slot);
      const zoomScale = nodeGraphModuleScopeZoomScale();
      const visibleGeometry = nodeGraphModuleScopeVisibleDrawGeometry(screenRect, drawRect, viewportRect, zoomScale);
      if (!visibleGeometry) {
        renderNodeGraphModuleScopeAnalyzer(slot, null);
        clearNodeGraphModuleScopeLocalFallback(slot);
        return null;
      }
      return {
        buffer,
        displayRect: screenRect,
        drawRect,
        fullDrawRect: drawRect,
        nodeId: slot.nodeId,
        screenElement: slot.scopeElement,
        screenRect,
        scopeRect: {
          height: drawRect.height,
          left: drawRect.left,
          sampleHeight: nodeGraphModuleScopeUnzoomedLength(drawRect.height, zoomScale),
          sampleWidth: nodeGraphModuleScopeUnzoomedLength(drawRect.width, zoomScale),
          top: drawRect.top,
          width: drawRect.width,
        },
        settings: nodeGraphModuleScopeEffectiveSettingForSlot(slot),
        slot,
        type: slot.type,
        visibleDrawRect: visibleGeometry.visibleDrawRect,
        visibleProgressRange: visibleGeometry.visibleProgressRange,
        visibleScopeRect: visibleGeometry.visibleScopeRect,
      };
    })
    .filter(Boolean);
}

function nodeGraphModuleScopeTraceDisplayFrameUnchanged(visibleItems) {
  if (!Array.isArray(visibleItems) || !visibleItems.length) {
    return false;
  }
  let traceCount = 0;
  for (const item of visibleItems) {
    const slot = item?.slot;
    if (nodeGraphModuleDisplayTypeForSlot(slot) !== "trace") {
      return false;
    }
    traceCount += 1;
    const settings = nodeGraphTraceDisplaySettingsForSlot(slot);
    if (!nodeGraphTraceDisplaySignatureUnchanged(slot, item, item.buffer, settings)) {
      return false;
    }
  }
  return traceCount > 0;
}

function drawNodeGraphTraceDisplayItem(renderer, item, pixelRatio) {
  const slot = item?.slot;
  const buffer = item?.buffer;
  if (!slot || !buffer?.length) {
    return;
  }
  const settings = nodeGraphTraceDisplaySettingsForSlot(slot);
  const traceTiming = nodeGraphTraceDisplayTimingObject(slot);
  renderNodeGraphModuleScopeAnalyzer(slot, buffer);
  clearNodeGraphModuleScopeLocalFallback(slot);
  renderer.gl.enable(renderer.gl.SCISSOR_TEST);
  applyNodeGraphModuleScopeTraceBlendMode(renderer.gl, "normal");
  if (settings.dot2Brightness > 0 && settings.dot2LineThickness > 0) {
    drawNodeGraphModuleScopeBufferWebGl(renderer, item.scopeRect, buffer, pixelRatio, slot, {
      color: nodeGraphScopeHexColorToRgb(settings.dot2Color),
      dotSizeScale: 1,
      intensity: settings.dot2Brightness,
      thicknessPx: settings.dot2LineThickness,
      traceTiming,
      visibleProgressRange: item.visibleProgressRange,
      visibleRect: item.visibleScopeRect,
    });
  }
  if (settings.brightness > 0 && settings.lineThickness > 0) {
    drawNodeGraphModuleScopeBufferWebGl(renderer, item.scopeRect, buffer, pixelRatio, slot, {
      color: nodeGraphScopeHexColorToRgb(settings.color),
      dotSizeScale: 1,
      intensity: settings.brightness,
      thicknessPx: settings.lineThickness,
      traceTiming,
      visibleProgressRange: item.visibleProgressRange,
      visibleRect: item.visibleScopeRect,
    });
  }
  rememberNodeGraphTraceDisplaySignature(slot, item, buffer, settings);
  finishNodeGraphTraceDisplayTiming(traceTiming);
}

function nodeGraphOscilloscopeLatestSample(buffer, fallback = 0) {
  if (buffer?.nodeGraphScopeXy) {
    return fallback;
  }
  for (let index = (buffer?.length || 0) - 1; index >= 0; index -= 1) {
    const sample = Number(buffer[index]);
    if (Number.isFinite(sample)) {
      return sample;
    }
  }
  return fallback;
}

function drawNodeGraphOscilloscopeBeam(renderer, item, pixelRatio, x1, y1, x2, y2, options = {}) {
  const { canvas, gl } = renderer;
  const clipRect = nodeGraphModuleScopeClippedPixelRect(
    canvas,
    item.visibleScopeRect || item.scopeRect,
    pixelRatio,
  );
  if (!clipRect) {
    return;
  }
  const vertices = new Float32Array(36);
  appendNodeGraphTraceDisplayBeamSegment(
    vertices,
    0,
    x1 * pixelRatio,
    y1 * pixelRatio,
    x2 * pixelRatio,
    y2 * pixelRatio,
    1,
  );
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(clipRect.left, canvas.height - clipRect.bottom, clipRect.width, clipRect.height);
  gl.useProgram(renderer.beamProgram);
  gl.uniform2f(renderer.beamCanvasSizeLocation, canvas.width, canvas.height);
  gl.uniform1f(renderer.beamSizeLocation, Math.max(1, (Number(options.thicknessPx) || 1) * pixelRatio));
  gl.uniform1f(renderer.beamIntensityLocation, Math.max(0, Number(options.intensity) || 0));
  const color = Array.isArray(options.color) ? options.color : [0.45, 0.92, 1];
  gl.uniform3f(renderer.beamColorLocation, color[0], color[1], color[2]);
  gl.bindBuffer(gl.ARRAY_BUFFER, renderer.beamBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STREAM_DRAW);
  gl.vertexAttribPointer(renderer.beamStartLocation, 2, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(renderer.beamStartLocation);
  gl.vertexAttribPointer(renderer.beamEndLocation, 2, gl.FLOAT, false, 24, 8);
  gl.enableVertexAttribArray(renderer.beamEndLocation);
  gl.vertexAttribPointer(renderer.beamCornerLocation, 1, gl.FLOAT, false, 24, 16);
  gl.enableVertexAttribArray(renderer.beamCornerLocation);
  gl.vertexAttribPointer(renderer.beamPointAgeLocation, 1, gl.FLOAT, false, 24, 20);
  gl.enableVertexAttribArray(renderer.beamPointAgeLocation);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  recordNodeGraphModuleScopeRenderMetrics(1, 6);
}

function drawNodeGraphDotOscilloscopeItem(renderer, item, pixelRatio) {
  const buffer = item?.buffer;
  const rect = item?.scopeRect;
  if (!buffer || !rect) {
    return;
  }
  renderNodeGraphModuleScopeAnalyzer(item.slot, buffer);
  clearNodeGraphModuleScopeLocalFallback(item.slot);
  const frameTarget = nodeGraphModuleScopeCapturedFrameLightTarget(buffer);
  const brightness = clampNodeSliderValue(
    frameTarget ?? (Number(buffer.nodeGraphScopeLightTarget) || 0),
    0,
    1,
  );
  if (brightness <= 0.002) {
    return;
  }
  const square = nodeGraphModuleScopeCenteredSquareRect(rect);
  const centerX = square.left + square.width * 0.5;
  const centerY = square.top + square.height * 0.5;
  const outerThickness = Math.max(4, Math.min(square.width, square.height) * 0.16);
  const innerThickness = Math.max(2, outerThickness * 0.42);
  const radius = Math.max(outerThickness * 0.5, Math.min(square.width, square.height) * 0.055);
  drawNodeGraphOscilloscopeBeam(renderer, item, pixelRatio, centerX - radius, centerY, centerX + radius, centerY, {
    color: [0.08, 0.66, 1],
    intensity: 0.22 + brightness * 0.58,
    thicknessPx: outerThickness,
  });
  drawNodeGraphOscilloscopeBeam(renderer, item, pixelRatio, centerX - radius, centerY, centerX + radius, centerY, {
    color: [0.72, 0.98, 1],
    intensity: 0.42 + brightness * 0.58,
    thicknessPx: innerThickness,
  });
}

function drawNodeGraphValueOscilloscopeItem(renderer, item, pixelRatio) {
  const rect = item?.scopeRect;
  if (!rect) {
    return;
  }
  renderNodeGraphModuleScopeAnalyzer(item.slot, item.buffer);
  clearNodeGraphModuleScopeLocalFallback(item.slot);
  const value = clampNodeSliderValue(nodeGraphOscilloscopeLatestSample(item?.buffer, 0), -1, 1);
  const y = rect.top + rect.height * 0.5 - value * rect.height * 0.44;
  drawNodeGraphOscilloscopeBeam(renderer, item, pixelRatio, rect.left, y, rect.left + rect.width, y, {
    color: [0.45, 0.92, 1],
    intensity: 0.72,
    thicknessPx: 1.5,
  });
}

function drawNodeGraphLineBurnOscilloscopeItem(renderer, item, pixelRatio) {
  if (!item?.buffer?.length) {
    return;
  }
  renderNodeGraphModuleScopeAnalyzer(item.slot, item.buffer);
  clearNodeGraphModuleScopeLocalFallback(item.slot);
  renderer.gl.enable(renderer.gl.SCISSOR_TEST);
  applyNodeGraphModuleScopeTraceBlendMode(renderer.gl, "normal");
  drawNodeGraphModuleScopeBufferWebGl(renderer, item.scopeRect, item.buffer, pixelRatio, item.slot, {
    color: [0.06, 0.72, 1],
    dotSizeScale: 1,
    intensity: 0.24,
    thicknessPx: 6,
    visibleProgressRange: item.visibleProgressRange,
    visibleRect: item.visibleScopeRect,
  });
  drawNodeGraphModuleScopeBufferWebGl(renderer, item.scopeRect, item.buffer, pixelRatio, item.slot, {
    color: [0.75, 0.98, 1],
    dotSizeScale: 1,
    intensity: 0.82,
    thicknessPx: 1.4,
    visibleProgressRange: item.visibleProgressRange,
    visibleRect: item.visibleScopeRect,
  });
}

function drawNodeGraphScope2dItem(renderer, item, pixelRatio) {
  const rect = item?.scopeRect;
  const buffer = item?.buffer;
  if (!rect || !buffer?.nodeGraphScopeXy || !buffer.x?.length || !buffer.y?.length) {
    return;
  }
  renderNodeGraphModuleScopeAnalyzer(item.slot, buffer);
  clearNodeGraphModuleScopeLocalFallback(item.slot);
  const square = nodeGraphModuleScopeCenteredSquareRect(rect);
  const x = clampNodeSliderValue(Number(buffer.x[buffer.x.length - 1]) || 0, -1, 1);
  const y = clampNodeSliderValue(Number(buffer.y[buffer.y.length - 1]) || 0, -1, 1);
  const centerX = square.left + square.width * 0.5 + x * square.width * 0.44;
  const centerY = square.top + square.height * 0.5 - y * square.height * 0.44;
  const radius = Math.max(2, square.width * 0.035);
  drawNodeGraphOscilloscopeBeam(renderer, item, pixelRatio, centerX - radius, centerY, centerX + radius, centerY, {
    color: [0.45, 0.92, 1],
    intensity: 0.95,
    thicknessPx: Math.max(2, square.width * 0.018),
  });
}

function drawNodeGraphModuleScopes() {
  const debug = setNodeGraphModuleScopeDebugPhase("enter", {
    drawAttempts: (Number(nodeGraphModuleScopeState.renderDebug?.drawAttempts) || 0) + 1,
    lastFrameStartMs: nodeGraphModuleScopeNowMs(),
    zoom: nodeGraphModuleScopeZoomScale(),
  });
  const canvas = nodeGraphModuleScopeCanvas();
  const workspace = document.getElementById("nodeGraphWorkspace");
  if (nodeGraphMvp.moduleOscilloscopesVisible === false && !nodeGraphVisibleModuleScopeSlots().length) {
    setNodeGraphModuleScopesEnabled(false);
    markNodeGraphModuleScopeDebugSkip("hidden");
    return;
  }
  if (!canvas || !workspace || !nodeGraphModuleScopeBuffersCurrent()) {
    markNodeGraphModuleScopeDebugSkip(!canvas ? "no-canvas" : !workspace ? "no-workspace" : "stale-buffers");
    return;
  }
  debug.canvasWidth = canvas.width;
  debug.canvasHeight = canvas.height;
  debug.totalSlots = nodeGraphModuleScopeSlots().length;
  setNodeGraphModuleScopesEnabled(true);
  setNodeGraphModuleScopeDebugPhase("sync-canvas");
  if (!syncNodeGraphModuleScopeCanvas()) {
    markNodeGraphModuleScopeDebugSkip("canvas-sync");
    return;
  }
  debug.canvasWidth = canvas.width;
  debug.canvasHeight = canvas.height;
  const renderer = nodeGraphModuleScopeRenderer(canvas);
  if (!renderer) {
    setNodeGraphModuleScopesEnabled(false);
    markNodeGraphModuleScopeDebugSkip("no-renderer");
    return;
  }
  setNodeGraphModuleScopeDebugPhase("ready");
  if (nodeGraphModuleScopeTracesOff()) {
    if (!nodeGraphModuleScopeState.scopeTracesOffActive) {
      clearNodeGraphModuleScopeCanvas();
    }
    nodeGraphModuleScopeState.scopeTracesOffActive = true;
    markNodeGraphModuleScopeDebugSkip("traces-off");
    scheduleNodeGraphModuleScopeDraw();
    return;
  }
  nodeGraphModuleScopeState.scopeTracesOffActive = false;
  if (nodeGraphModuleScopePaused()) {
    nodeGraphModuleScopeState.animationLastTime = (performance.now?.() || Date.now()) / 1000;
    markNodeGraphModuleScopeDebugSkip("paused");
    return;
  }
  const animationTime = (performance.now?.() || Date.now()) / 1000;
  const previousAnimationTime = Number(nodeGraphModuleScopeState.animationLastTime) || animationTime;
  nodeGraphModuleScopeState.animationDeltaSeconds = clampNodeSliderValue(
    animationTime - previousAnimationTime,
    1 / 240,
    1 / 15,
  );
  nodeGraphModuleScopeState.animationLastTime = animationTime;
  nodeGraphModuleScopeState.animationTime = animationTime;
  beginNodeGraphModuleScopeRenderMetricsFrame();
  const pixelRatio = Number(renderer.pixelRatio) ||
    Number(nodeGraphModuleScopeState.backingPixelRatio) ||
    nodeGraphModuleScopeBackingPixelRatio(workspace.getBoundingClientRect());
  debug.pixelRatio = pixelRatio;
  debug.canvasWidth = canvas.width;
  debug.canvasHeight = canvas.height;
  const gl = renderer.gl;
  setNodeGraphModuleScopeDebugPhase("collect");
  const visibleItems = nodeGraphModuleScopeScreenItems(workspace, canvas, pixelRatio);
  debug.visibleItems = visibleItems.length;
  for (const item of visibleItems) {
    if (item.slot?.type === "visualOscilloscope") {
      clearNodeGraphModuleScopeLocalFallback(item.slot);
    }
  }
  const firstVisibleSlot = visibleItems.find((item) => item.slot?.type !== "visualOscilloscope")?.slot;
  if (nodeGraphModuleScopeTraceDisplayFrameUnchanged(visibleItems)) {
    setNodeGraphModuleScopeDebugPhase("trace-unchanged");
    commitNodeGraphModuleScopeRenderMetricsFrame(animationTime);
    return;
  }
  if (!nodeGraphModuleScopePhosphorFrameReady(firstVisibleSlot)) {
    setNodeGraphModuleScopeDebugPhase("fps-gate");
    commitNodeGraphModuleScopeRenderMetricsFrame(animationTime);
    scheduleNodeGraphModuleScopeDraw();
    return;
  }
  setNodeGraphModuleScopeDebugPhase("clear-current-frame");
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.disable(gl.SCISSOR_TEST);
  gl.disable(gl.BLEND);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  setNodeGraphModuleScopeDebugPhase("webgl-setup");
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.ONE, gl.ONE);
  for (const item of visibleItems) {
    const {
      buffer,
      scopeRect,
      settings: scopeSettings,
      slot,
      visibleProgressRange,
      visibleScopeRect,
    } = item;
    const displayType = nodeGraphModuleDisplayTypeForSlot(slot);
    if (displayType === "trace") {
      drawNodeGraphTraceDisplayItem(renderer, item, pixelRatio);
      continue;
    }
    if (displayType === "dot") {
      drawNodeGraphDotOscilloscopeItem(renderer, item, pixelRatio);
      continue;
    }
    if (displayType === "value") {
      drawNodeGraphValueOscilloscopeItem(renderer, item, pixelRatio);
      continue;
    }
    if (displayType === "lineBurn") {
      drawNodeGraphLineBurnOscilloscopeItem(renderer, item, pixelRatio);
      continue;
    }
    if (displayType === "scope2d") {
      drawNodeGraphScope2dItem(renderer, item, pixelRatio);
      continue;
    }
    renderNodeGraphModuleScopeAnalyzer(slot, buffer);
    if (buffer?.nodeGraphScopeLightDisplay) {
      continue;
    }
    gl.enable(gl.SCISSOR_TEST);
    const bloomEnabled = nodeGraphModuleScopeBloomEnabled();
    const burn = bloomEnabled ? nodeGraphModuleScopeTraceBurn(scopeSettings) : 0;
    const brightness = nodeGraphModuleScopeTraceBrightness(slot, scopeSettings);
    const lineThickness = nodeGraphModuleScopeTraceLineThickness(slot, scopeSettings);
    const zoomScale = nodeGraphModuleScopeStrokeZoomScale();
    const blendMode = nodeGraphModuleScopeTraceBlendMode(slot);
    const heatmapMode = blendMode === "heatmap";
    const colors = heatmapMode
      ? nodeGraphModuleScopeHeatmapTraceColors()
      : nodeGraphModuleScopeDotStyle(slot, buffer);
    const haloBrightness = heatmapMode
      ? (nodeGraphMvp?.moduleScopeDotCore2Enabled === false ? 0 : 1)
      : colors.haloBrightness / nodeGraphModuleScopeDefaultDotCores.dot2.brightness;
    const coreBrightness = heatmapMode
      ? (nodeGraphMvp?.moduleScopeDotCore1Enabled === false ? 0 : 1)
      : colors.coreBrightness / nodeGraphModuleScopeDefaultDotCores.dot1.brightness;
    if (haloBrightness > 0) {
      setNodeGraphModuleScopeDebugPhase(`draw-halo:${slot.type}`);
      applyNodeGraphModuleScopeTraceBlendMode(gl, blendMode);
      drawNodeGraphModuleScopeBufferWebGl(renderer, scopeRect, buffer, pixelRatio, slot, {
        color: colors.haloColor ?? colors.halo,
        dotSizeScale: heatmapMode
          ? undefined
          : nodeGraphModuleScopeTraceDotSizeScale(colors.haloSize, nodeGraphModuleScopeDefaultDotCores.dot2.size),
        intensity: (heatmapMode ? 0.05 : 0.028 + (bloomEnabled ? burn * 0.016 : 0.006)) * brightness * haloBrightness,
        thicknessPx: 3.25 * zoomScale,
        visibleProgressRange,
        visibleRect: visibleScopeRect,
      });
    }
    if (coreBrightness > 0) {
      setNodeGraphModuleScopeDebugPhase(`draw-core:${slot.type}`);
      applyNodeGraphModuleScopeTraceBlendMode(gl, blendMode);
      drawNodeGraphModuleScopeBufferWebGl(renderer, scopeRect, buffer, pixelRatio, slot, {
        color: colors.coreColor ?? colors.core,
        dotSizeScale: heatmapMode
          ? undefined
          : nodeGraphModuleScopeTraceDotSizeScale(colors.coreSize, nodeGraphModuleScopeDefaultDotCores.dot1.size),
        intensity: (heatmapMode ? 0.34 : 1.0 + (bloomEnabled ? burn * 0.08 : 0)) * brightness * coreBrightness,
        thicknessPx: 1.25 * zoomScale,
        visibleProgressRange,
        visibleRect: visibleScopeRect,
      });
    }
  }
  setNodeGraphModuleScopeDebugPhase("current-frame-ready");
  gl.disable(gl.SCISSOR_TEST);
  gl.disable(gl.BLEND);
  setNodeGraphModuleScopeDebugPhase("lights");
  drawNodeGraphModuleScopeLightDisplays(visibleItems, pixelRatio);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  setNodeGraphModuleScopeDebugPhase("commit");
  commitNodeGraphModuleScopeRenderMetricsFrame(animationTime);
  if (visibleItems.length || nodeGraphModuleScopeHasModelDisplay()) {
    setNodeGraphModuleScopeDebugPhase("schedule-next");
    scheduleNodeGraphModuleScopeDraw();
  } else {
    setNodeGraphModuleScopeDebugPhase("idle");
  }
}

function scheduleNodeGraphModuleScopeDraw() {
  if (nodeGraphMvp?.moduleOscilloscopesVisible === false) {
    return;
  }
  if (nodeGraphModuleScopePaused()) {
    return;
  }
  if (nodeGraphModuleScopeState.drawFrame) {
    const now = (performance.now?.() || Date.now());
    const requestedAt = Number(nodeGraphModuleScopeState.drawFrameRequestedAt) || 0;
    if (requestedAt > 0 && now - requestedAt > 250) {
      window.cancelAnimationFrame(nodeGraphModuleScopeState.drawFrame);
      nodeGraphModuleScopeState.drawFrame = 0;
      nodeGraphModuleScopeState.drawFrameRequestedAt = 0;
      if (nodeGraphModuleScopeState.drawFrameWatchdog) {
        window.clearTimeout(nodeGraphModuleScopeState.drawFrameWatchdog);
        nodeGraphModuleScopeState.drawFrameWatchdog = 0;
      }
    } else {
      return;
    }
  }
  setNodeGraphModuleScopeDebugPhase("request-raf");
  const frameId = window.requestAnimationFrame(() => {
    if (nodeGraphModuleScopeState.drawFrameWatchdog) {
      window.clearTimeout(nodeGraphModuleScopeState.drawFrameWatchdog);
      nodeGraphModuleScopeState.drawFrameWatchdog = 0;
    }
    nodeGraphModuleScopeState.drawFrame = 0;
    nodeGraphModuleScopeState.drawFrameRequestedAt = 0;
    runNodeGraphModuleScopeDrawFrame("raf");
  });
  nodeGraphModuleScopeState.drawFrame = frameId;
  nodeGraphModuleScopeState.drawFrameRequestedAt = (performance.now?.() || Date.now());
  nodeGraphModuleScopeState.drawFrameWatchdog = window.setTimeout(() => {
    if (nodeGraphModuleScopeState.drawFrame !== frameId) {
      return;
    }
    window.cancelAnimationFrame(frameId);
    nodeGraphModuleScopeState.drawFrame = 0;
    nodeGraphModuleScopeState.drawFrameRequestedAt = 0;
    nodeGraphModuleScopeState.drawFrameWatchdog = 0;
    setNodeGraphModuleScopeDebugPhase("watchdog");
    runNodeGraphModuleScopeDrawFrame("watchdog");
  }, 100);
}
