const state = {
  response: null,
  waveform: null,
  playheadFrame: 0,
  waveformProbeFrame: null,
  waveformProbeSource: null,
  waveformPointerActive: false,
  scrubberPointerActive: false,
  phaseJumpPreviewIndex: null,
  lastSeekSource: null,
  lastSeekFrame: null,
  lastSeekFollowAudio: null,
  followAudio: true,
  reports: [],
  activeReportIndex: 0,
  signalLagMs: 1,
  signalPlotProbe: null,
  signalPhaseFocusIndex: null,
  signalPhaseFocusName: "all",
  signalPlotMode: "trace",
  signalPlotScale: 1,
  signalPlotWindow: "full",
  signalPlotWindowMs: 80,
  manifestLoading: false,
};

function resetSharedProbeState() {
  state.waveformProbeFrame = null;
  state.waveformProbeSource = null;
  state.signalPlotProbe = null;
}

function resetWaveformTransientState() {
  state.waveformPointerActive = false;
  state.scrubberPointerActive = false;
  resetSharedProbeState();
  state.phaseJumpPreviewIndex = null;
  state.lastSeekSource = null;
  state.lastSeekFrame = null;
  state.lastSeekFollowAudio = null;
}

const requiredFlags = [
  ["callerOwnsProcessingOrder", true],
  ["callerOwnsDspObjects", true],
  ["circuitOwnsDspObjects", false],
  ["dspObjectsKnowCircuit", false],
  ["serializesPatch", false],
  ["ownsAudioEngine", false],
  ["ownsScheduler", false],
];

const expectedContract = "soemdsp-demo-local-sandbox-handoff";
const expectedContractVersion = 1;
const expectedInspectionMode = "mouse-and-ears";
const phaseAudioFrequencyToleranceHz = 0.5;
const phaseAudioAmplitudeTolerance = 0.001;
const phaseAudioRmsTolerance = 0.001;
const signalPlotSettingsKey = "soemdsp-sandbox.signalPlotSettings";
const inspectionSources = Object.freeze({
  waveform: "waveform",
  scrubber: "scrubber",
  levelEnvelope: "level envelope",
  signalPlot: "signal plot",
  parameterTimeline: "parameter timeline",
  phaseAudioStats: "phase audio stats",
  phaseList: "phase list",
  phaseJump: "phase jump",
});
const inspectionModes = Object.freeze({
  none: "none",
  transport: "transport",
  hover: "hover",
  probe: "probe",
});
const statusStripLabels = Object.freeze({
  manifestStatus: "Manifest",
  contractStatus: "Contract",
  inspectionMode: "Mode",
  frameCount: "Frames",
  checklistStatus: "Checklist",
});

function artifactUrl(path) {
  return `/artifact?path=${encodeURIComponent(path)}`;
}

function artifactRowLabel(link) {
  return `${link.path ? "Open" : "Missing"} ${link.kind || "artifact"} artifact: ${
    link.label || link.path || "unknown"
  }`;
}

function loadSignalPlotSettings() {
  try {
    const settings = JSON.parse(
      window.localStorage.getItem(signalPlotSettingsKey) || "{}",
    );
    if ([1, 2, 5, 10].includes(settings.signalLagMs)) {
      state.signalLagMs = settings.signalLagMs;
    }
    if (typeof settings.signalPhaseFocusName === "string") {
      state.signalPhaseFocusName = settings.signalPhaseFocusName;
    }
    if ([1, 2, 4].includes(settings.signalPlotScale)) {
      state.signalPlotScale = settings.signalPlotScale;
    }
    if (["trace", "points"].includes(settings.signalPlotMode)) {
      state.signalPlotMode = settings.signalPlotMode;
    }
    if (["full", "cursor"].includes(settings.signalPlotWindow)) {
      state.signalPlotWindow = settings.signalPlotWindow;
    }
    if ([40, 80, 160].includes(settings.signalPlotWindowMs)) {
      state.signalPlotWindowMs = settings.signalPlotWindowMs;
    }
  } catch (_error) {
    window.localStorage.removeItem(signalPlotSettingsKey);
  }
}

function saveSignalPlotSettings() {
  window.localStorage.setItem(
    signalPlotSettingsKey,
    JSON.stringify({
      signalLagMs: state.signalLagMs,
      signalPhaseFocusName: state.signalPhaseFocusName,
      signalPlotMode: state.signalPlotMode,
      signalPlotScale: state.signalPlotScale,
      signalPlotWindow: state.signalPlotWindow,
      signalPlotWindowMs: state.signalPlotWindowMs,
    }),
  );
}

function resetSignalPlotSettings() {
  state.signalLagMs = 1;
  state.signalPhaseFocusIndex = null;
  state.signalPhaseFocusName = "all";
  state.signalPlotMode = "trace";
  state.signalPlotScale = 1;
  state.signalPlotWindow = "full";
  state.signalPlotWindowMs = 80;
  window.localStorage.removeItem(signalPlotSettingsKey);
}

function clampFrame(frame, waveform) {
  return Math.max(0, Math.min(waveform.frames, frame));
}

function setText(id, value) {
  const element = document.getElementById(id);
  element.textContent = value;
  if (statusStripLabels[id]) {
    const valueText = String(value);
    const ok =
      valueText !== "Loading" &&
      valueText !== "Unavailable" &&
      valueText !== "0";
    labelStatusStripValue(element, statusStripLabels[id], valueText, ok);
  }
}

function setSourceText(id, key, value, expected = "present", ok = true) {
  const element = document.getElementById(id);
  const valueText = String(value);
  const expectedText = String(expected);
  element.textContent = valueText;
  element.dataset.sourceKey = key;
  element.dataset.sourceValue = valueText;
  element.dataset.sourceExpected = expectedText;
  element.dataset.sourceState = ok ? "ok" : "check";
  element.setAttribute("aria-label", `${key}: ${valueText}`);
  element.title =
    expected === "none" || expected === "present"
      ? `${key}: ${valueText}`
      : `${key}: ${valueText} / expected ${expectedText}`;
}

function clearElement(id) {
  document.getElementById(id).replaceChildren();
}

function setStatus(id, value, ok) {
  const element = document.getElementById(id);
  const isPill = element.classList.contains("pill");
  element.textContent = value;
  element.className = isPill ? `pill ${ok ? "good" : "warn"}` : ok ? "" : "warn";
  if (statusStripLabels[id]) {
    labelStatusStripValue(element, statusStripLabels[id], value, ok);
  }
}

function labelStatusStripValue(element, label, value, ok) {
  const valueText = String(value);
  const stateName = ok ? "ok" : "check";
  element.dataset.statusLabel = label;
  element.dataset.statusValue = valueText;
  element.dataset.statusState = stateName;
  element.setAttribute("role", "status");
  element.setAttribute("aria-label", `${label}: ${valueText}`);
  element.title = `${label}: ${valueText} / ${stateName}`;
}

function labelPrimaryAudio(path, ok) {
  const audio = document.getElementById("audioPlayer");
  const pathText = path || "unavailable";
  const stateName = ok ? "ok" : "check";
  audio.dataset.audioLabel = "Primary Audio";
  audio.dataset.audioPath = pathText;
  audio.dataset.audioState = stateName;
  audio.setAttribute("aria-label", `Primary Audio: ${pathText}`);
  audio.title = `Primary Audio: ${pathText} / ${stateName}`;
}

function labelPrimaryAudioTitle(path, ok) {
  const title = document.getElementById("audioTitle");
  const pathText = path || "unavailable";
  const stateName = ok ? "ok" : "check";
  title.textContent = pathText;
  title.dataset.audioTitleLabel = "Primary Audio";
  title.dataset.audioTitlePath = pathText;
  title.dataset.audioTitleState = stateName;
  title.setAttribute("aria-label", `Primary Audio title: ${pathText}`);
  title.title = `Primary Audio title: ${pathText} / ${stateName}`;
}

function labelWaveformHeaderPill(element, label, value, ok) {
  const valueText = String(value);
  const stateName = ok ? "ok" : "check";
  element.textContent = valueText;
  element.dataset.waveformHeaderLabel = label;
  element.dataset.waveformHeaderValue = valueText;
  element.dataset.waveformHeaderState = stateName;
  element.setAttribute("aria-label", `${label}: ${valueText}`);
  element.title = `${label}: ${valueText} / ${stateName}`;
}

function labelWaveformControlButton(button, label, value, stateName) {
  const valueText = String(value);
  button.dataset.waveformControlLabel = label;
  button.dataset.waveformControlValue = valueText;
  button.dataset.waveformControlState = stateName;
  button.setAttribute("aria-label", `${label}: ${valueText}`);
  button.title = `${label}: ${valueText} / ${stateName}`;
}

function labelInspectionCursorPill(element, label, value, stateName) {
  element.setAttribute("aria-label", `${label}: ${value}`);
  element.title = `${label}: ${value}`;
  element.dataset.inspectionPill = label;
  element.dataset.inspectionValue = value;
  element.dataset.inspectionState = stateName;
}

function labelInspectionCursorSurface(cursor, value, stateName) {
  cursor.dataset.inspectionCursorLabel = "inspection cursor";
  cursor.dataset.inspectionCursorValue = value;
  cursor.dataset.inspectionCursorState = stateName;
  cursor.setAttribute("role", "group");
  cursor.setAttribute("aria-label", `inspection cursor: ${value}`);
  cursor.title = `inspection cursor: ${value} / ${stateName}`;
}

function setInspectionCursorSource(sourceName, mode) {
  const source = document.getElementById("inspectionCursorSource");
  const value = `source ${sourceName}`;
  source.textContent = value;
  source.className = `pill inspection-source ${mode}`;
  labelInspectionCursorPill(source, "inspection source", value, mode);
}

function formatInspectionDelta(deltaFrame, sampleRate) {
  if (deltaFrame === null) {
    return "none";
  }

  const sign = deltaFrame >= 0 ? "+" : "";
  return `${sign}${deltaFrame} frames / ${sign}${formatSeconds(deltaFrame / sampleRate)}`;
}

function setInspectionCursorDelta(deltaFrame, sampleRate) {
  const delta = document.getElementById("inspectionCursorDelta");
  const stateName = deltaFrame === null ? inspectionModes.none : inspectionModes.hover;
  const value = `delta ${formatInspectionDelta(deltaFrame, sampleRate)}`;
  delta.textContent = value;
  delta.className = `pill inspection-delta ${stateName}`;
  labelInspectionCursorPill(delta, "inspection delta", value, stateName);
}

function formatAudioDuration(duration) {
  return Number.isFinite(duration) && duration > 0 ? formatSeconds(duration) : "unknown";
}

function setInspectionCursorAudio(time, duration) {
  const audio = document.getElementById("inspectionCursorAudio");
  const value = `audio ${formatSeconds(Number.isFinite(time) ? time : 0)} / ${formatAudioDuration(duration)}`;
  audio.textContent = value;
  labelInspectionCursorPill(
    audio,
    "inspection audio",
    value,
    Number.isFinite(duration) && duration > 0 ? "known" : "unknown",
  );
}

function setInspectionCursorPlayback(audio) {
  const playback = document.getElementById("inspectionCursorPlayback");
  const stateName = audio?.ended ? "ended" : audio?.paused === false ? "playing" : "paused";
  const value = `playback ${stateName}`;
  playback.textContent = value;
  playback.className = `pill inspection-playback ${stateName}`;
  labelInspectionCursorPill(playback, "inspection playback", value, stateName);
}

function setInspectionCursorView(followAudio) {
  const view = document.getElementById("inspectionCursorView");
  const stateName = followAudio ? "follow" : "free";
  const value = `view ${stateName}`;
  view.textContent = value;
  view.className = `pill inspection-view ${stateName}`;
  labelInspectionCursorPill(view, "inspection view", value, stateName);
}

function setInspectionCursorPreview(active) {
  const preview = document.getElementById("inspectionCursorPreview");
  const stateName = active ? "active" : "idle";
  const value = active ? "preview only" : "preview idle";
  preview.textContent = value;
  preview.className = `pill inspection-preview ${stateName}`;
  labelInspectionCursorPill(preview, "inspection preview", value, stateName);
}

function setInspectionCursorSeek(sourceName) {
  const seek = document.getElementById("inspectionCursorSeek");
  const stateName = sourceName ? "active" : "idle";
  const value = sourceName ? `seek ${sourceName}` : "seek idle";
  seek.textContent = value;
  seek.className = `pill inspection-seek ${stateName}`;
  labelInspectionCursorPill(seek, "inspection seek", value, stateName);
}

function setInspectionCursorSeekTarget(region, frame, sampleRate) {
  const target = document.getElementById("inspectionCursorSeekTarget");
  const hasTarget = region && frame !== null && Number.isFinite(sampleRate) && sampleRate > 0;
  const value = hasTarget
    ? `seek target ${region.name} / ${formatSeconds(frame / sampleRate)} / frame ${frame}`
    : "seek target none";
  target.textContent = value;
  target.className = `pill inspection-seek-target ${hasTarget ? "active" : "none"}`;
  labelInspectionCursorPill(
    target,
    "inspection seek target",
    value,
    hasTarget ? "active" : "none",
  );
}

function setInspectionCursorSeekSync(match) {
  const sync = document.getElementById("inspectionCursorSeekSync");
  const value =
    match === "aligned"
      ? "seek aligned"
      : match === "diverged"
        ? "seek drift"
        : "seek sync idle";
  sync.textContent = value;
  sync.className = `pill inspection-seek-sync ${match}`;
  labelInspectionCursorPill(sync, "inspection seek sync", value, match);
}

function setInspectionCursorTarget(region, frame, sampleRate) {
  const target = document.getElementById("inspectionCursorTarget");
  const hasTarget = region && frame !== null && Number.isFinite(sampleRate) && sampleRate > 0;
  const value = hasTarget
    ? `target ${region.name} / ${formatSeconds(frame / sampleRate)} / frame ${frame}`
    : "target none";
  target.textContent = value;
  target.className = `pill inspection-target ${hasTarget ? "active" : "none"}`;
  labelInspectionCursorPill(target, "inspection target", value, hasTarget ? "active" : "none");
}

function setInspectionCursorTransport(region, frame, sampleRate) {
  const transport = document.getElementById("inspectionCursorTransport");
  const hasTransport = region && frame !== null && Number.isFinite(sampleRate) && sampleRate > 0;
  const value = hasTransport
    ? `transport ${region.name} / ${formatSeconds(frame / sampleRate)} / frame ${frame}`
    : "transport none";
  transport.textContent = value;
  transport.className = `pill inspection-transport ${hasTransport ? "active" : "none"}`;
  labelInspectionCursorPill(
    transport,
    "inspection transport",
    value,
    hasTransport ? "active" : "none",
  );
}

function setInspectionCursorDivergence(transportRegion, targetRegion) {
  const divergence = document.getElementById("inspectionCursorDivergence");
  const diverged = Boolean(
    transportRegion &&
      targetRegion &&
      transportRegion.name !== targetRegion.name,
  );
  const value = diverged
    ? `phase diverged ${transportRegion.name} -> ${targetRegion.name}`
    : "phase aligned";
  divergence.textContent = value;
  divergence.className = `pill inspection-divergence ${diverged ? "diverged" : "aligned"}`;
  labelInspectionCursorPill(
    divergence,
    "inspection divergence",
    value,
    diverged ? "diverged" : "aligned",
  );
}

function boolText(value) {
  return value ? "true" : "false";
}

function statusText(ok) {
  return ok ? "OK" : "Check";
}

function formatHttpStatus(status, text = "") {
  const code = Number(status);
  if (!Number.isFinite(code) || code <= 0) {
    return "Unavailable";
  }

  return text ? `${code} ${text}` : String(code);
}

function formatSeconds(seconds) {
  return `${seconds.toFixed(3)}s`;
}

function probeSourceText() {
  const source = currentProbeSource();
  return source === inspectionModes.probe ? inspectionModes.probe : `${inspectionModes.probe} ${source}`;
}

function currentProbeSource() {
  return state.waveformProbeSource || inspectionModes.probe;
}

function formatProbeFrame(frame, waveform, region = waveformRegionAtFrameFor(waveform, frame)) {
  return `${formatSeconds(frame / waveform.sampleRate)} / frame ${frame} / ${
    region?.name || "phase"
  }`;
}

function probeFrameLabelsReady() {
  const waveform = state.waveform;
  if (!waveform || !Number.isFinite(waveform.sampleRate) || waveform.sampleRate <= 0) {
    return false;
  }

  const label = formatProbeFrame(0, waveform);
  return (
    label.includes("0.000s") &&
    label.includes("frame 0") &&
    label.includes(waveformRegionAtFrameFor(waveform, 0)?.name || "phase")
  );
}

function formatPhaseRange(span, sampleRate) {
  if (!sampleRate) {
    return "unavailable";
  }

  return `${formatSeconds(span.startFrame / sampleRate)}-${formatSeconds(
    span.endFrame / sampleRate,
  )}`;
}

function formatPercent(value) {
  return `${Number(value.toFixed(1)).toString()}%`;
}

function readAscii(view, offset, length) {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(view.getUint8(offset + index));
  }
  return value;
}

function parsePcm16Wav(buffer) {
  const view = new DataView(buffer);
  if (readAscii(view, 0, 4) !== "RIFF" || readAscii(view, 8, 4) !== "WAVE") {
    throw new Error("Expected RIFF/WAVE data");
  }

  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let audioFormat = 0;
  let dataOffset = 0;
  let dataSize = 0;
  let offset = 12;

  while (offset + 8 <= view.byteLength) {
    const id = readAscii(view, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const dataStart = offset + 8;

    if (id === "fmt ") {
      audioFormat = view.getUint16(dataStart, true);
      channels = view.getUint16(dataStart + 2, true);
      sampleRate = view.getUint32(dataStart + 4, true);
      bitsPerSample = view.getUint16(dataStart + 14, true);
    }

    if (id === "data") {
      dataOffset = dataStart;
      dataSize = size;
    }

    offset = dataStart + size + (size % 2);
  }

  if (audioFormat !== 1 || bitsPerSample !== 16 || channels < 1 || dataSize === 0) {
    throw new Error("Expected PCM 16-bit WAV data");
  }

  const frames = Math.floor(dataSize / (channels * 2));
  const samples = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame += 1) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      const sampleOffset = dataOffset + (frame * channels + channel) * 2;
      sum += view.getInt16(sampleOffset, true) / 32768;
    }
    samples[frame] = sum / channels;
  }

  return {
    bitsPerSample,
    channels,
    dataBytes: dataSize,
    fileBytes: buffer.byteLength,
    frames,
    sampleRate,
    samples,
  };
}

function analyzeWaveform(samples) {
  if (!samples.length) {
    return {
      dcOffset: 0,
      max: 0,
      min: 0,
      peak: 0,
      rms: 0,
    };
  }

  let max = -Infinity;
  let min = Infinity;
  let sum = 0;
  let squareSum = 0;
  for (const sample of samples) {
    max = Math.max(max, sample);
    min = Math.min(min, sample);
    sum += sample;
    squareSum += sample * sample;
  }

  return {
    dcOffset: sum / samples.length,
    max,
    min,
    peak: Math.max(Math.abs(min), Math.abs(max)),
    rms: Math.sqrt(squareSum / samples.length),
  };
}

function analyzeSampleRange(samples, startFrame, endFrame) {
  const start = Math.max(0, Math.min(samples.length, startFrame));
  const end = Math.max(start, Math.min(samples.length, endFrame));
  if (end <= start) {
    return {
      dcOffset: 0,
      max: 0,
      min: 0,
      peak: 0,
      rms: 0,
    };
  }

  let max = -Infinity;
  let min = Infinity;
  let sum = 0;
  let squareSum = 0;
  for (let frame = start; frame < end; frame += 1) {
    const sample = samples[frame] || 0;
    max = Math.max(max, sample);
    min = Math.min(min, sample);
    sum += sample;
    squareSum += sample * sample;
  }

  const frames = end - start;
  return {
    dcOffset: sum / frames,
    max,
    min,
    peak: Math.max(Math.abs(min), Math.abs(max)),
    rms: Math.sqrt(squareSum / frames),
  };
}

function estimateZeroCrossingFrequency(samples, startFrame, endFrame, sampleRate) {
  const start = Math.max(0, Math.min(samples.length, startFrame));
  const end = Math.max(start, Math.min(samples.length, endFrame));
  if (end - start < 2 || sampleRate <= 0) {
    return null;
  }

  const crossings = [];
  let previous = samples[start] || 0;
  for (let frame = start + 1; frame < end; frame += 1) {
    const current = samples[frame] || 0;
    if (previous < 0 && current >= 0) {
      const span = current - previous;
      const offset = span === 0 ? 0 : -previous / span;
      crossings.push(frame - 1 + offset);
    }
    previous = current;
  }

  if (crossings.length < 2) {
    return null;
  }

  const first = crossings[0];
  const last = crossings[crossings.length - 1];
  const seconds = (last - first) / sampleRate;
  return seconds > 0 ? (crossings.length - 1) / seconds : null;
}

function buildLevelEnvelope(waveform) {
  const windowFrames = Math.max(1, Math.round(waveform.sampleRate * 0.01));
  const windows = [];
  let peak = 0;
  let squareSum = 0;
  let totalFrames = 0;

  for (let startFrame = 0; startFrame < waveform.frames; startFrame += windowFrames) {
    const endFrame = Math.min(waveform.frames, startFrame + windowFrames);
    let windowPeak = 0;
    let windowSquareSum = 0;

    for (let frame = startFrame; frame < endFrame; frame += 1) {
      const value = waveform.samples[frame] || 0;
      const abs = Math.abs(value);
      windowPeak = Math.max(windowPeak, abs);
      windowSquareSum += value * value;
    }

    const frames = Math.max(1, endFrame - startFrame);
    const rms = Math.sqrt(windowSquareSum / frames);
    windows.push({
      endFrame,
      peak: windowPeak,
      rms,
      startFrame,
    });
    peak = Math.max(peak, windowPeak);
    squareSum += windowSquareSum;
    totalFrames += frames;
  }

  return {
    peak,
    rms: totalFrames ? Math.sqrt(squareSum / totalFrames) : 0,
    windowFrames,
    windowMs: (windowFrames / waveform.sampleRate) * 1000,
    windows,
  };
}

function phaseDisplayRange(phase, fallbackStartFrame, totalFrames) {
  const frames = Number(phase.samplesProcessed || 0);
  const explicitStart = Number(phase.startFrame);
  const explicitEnd = Number(phase.endFrame);
  const hasExplicitRange =
    Number.isFinite(explicitStart) &&
    Number.isFinite(explicitEnd) &&
    explicitStart >= 0 &&
    explicitEnd >= explicitStart;
  const startFrame = Math.min(
    totalFrames,
    hasExplicitRange ? explicitStart : fallbackStartFrame,
  );
  const endFrame = Math.min(
    totalFrames,
    hasExplicitRange ? explicitEnd : fallbackStartFrame + frames,
  );

  return {
    endFrame,
    frames: Math.max(0, endFrame - startFrame),
    startFrame,
  };
}

function buildPhaseRegions(phases, totalFrames) {
  let startFrame = 0;
  return phases.map((phase) => {
    const range = phaseDisplayRange(phase, startFrame, totalFrames);
    const region = {
      endFrame: range.endFrame,
      name: phase.name || "phase",
      startFrame: range.startFrame,
    };
    startFrame = range.endFrame;
    return region;
  });
}

function buildPhaseSpans(phases, totalFrames) {
  let startFrame = 0;
  return phases.map((phase) => {
    const span = phaseDisplayRange(phase, startFrame, totalFrames);
    startFrame = span.endFrame;
    return span;
  });
}

function phaseFrameTotal(phases) {
  return phases.reduce(
    (total, phase) => total + Number(phase.samplesProcessed || 0),
    0,
  );
}

function renderKeyValue(container, rows) {
  container.replaceChildren();
  for (const [key, value, expected] of rows) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    const valueText = String(value);
    dt.textContent = key;
    dd.textContent = valueText;
    const expectedText =
      typeof expected === "boolean" ? boolText(expected) : String(expected);
    const stateName = expected !== undefined && value !== expectedText ? "check" : "ok";
    dt.dataset.kvKey = key;
    dt.title = key;
    dd.dataset.kvKey = key;
    dd.dataset.kvValue = valueText;
    dd.dataset.kvExpected = expected === undefined ? "none" : expectedText;
    dd.dataset.kvState = stateName;
    dd.setAttribute("aria-label", `${key}: ${valueText}`);
    dd.title =
      expected === undefined
        ? `${key}: ${valueText}`
        : `${key}: ${valueText} / expected ${expectedText}`;
    if (expected !== undefined && value !== expectedText) {
      dd.className = "warn";
    }
    container.append(dt, dd);
  }
}

function drawWaveform() {
  const canvas = document.getElementById("waveformCanvas");
  const waveform = state.waveform;
  if (!waveform) {
    return;
  }

  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(canvas.clientWidth * pixelRatio));
  const height = Math.max(120, Math.floor(canvas.clientHeight * pixelRatio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext("2d");
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#14171a";
  context.fillRect(0, 0, width, height);

  const regions = waveform.regions || [];
  for (const [index, region] of regions.entries()) {
    const startX = Math.round((region.startFrame / waveform.frames) * width);
    const endX = Math.round((region.endFrame / waveform.frames) * width);
    const regionWidth = Math.max(1, endX - startX);
    context.fillStyle =
      index % 2 === 0 ? "rgba(127,199,217,0.10)" : "rgba(226,168,109,0.12)";
    context.fillRect(startX, 0, regionWidth, height);

    context.strokeStyle = "rgba(243,241,236,0.20)";
    context.lineWidth = Math.max(1, pixelRatio);
    context.beginPath();
    context.moveTo(startX, 0);
    context.lineTo(startX, height);
    context.stroke();

    context.fillStyle = "rgba(243,241,236,0.82)";
    context.font = `${Math.max(11, Math.floor(12 * pixelRatio))}px Segoe UI, Arial`;
    context.fillText(region.name, startX + 10 * pixelRatio, 18 * pixelRatio);
  }

  const center = height / 2;
  const scale = height * 0.42;
  context.strokeStyle = "#343a40";
  context.lineWidth = Math.max(1, pixelRatio);
  context.beginPath();
  context.moveTo(0, center);
  context.lineTo(width, center);
  context.stroke();

  const samples = waveform.samples;
  const framesPerPixel = Math.max(1, Math.floor(samples.length / width));
  context.strokeStyle = "#7fc7d9";
  context.lineWidth = Math.max(1, pixelRatio);
  context.beginPath();

  for (let x = 0; x < width; x += 1) {
    const start = x * framesPerPixel;
    const end = Math.min(samples.length, start + framesPerPixel);
    let min = 1;
    let max = -1;

    for (let index = start; index < end; index += 1) {
      const value = samples[index];
      if (value < min) {
        min = value;
      }
      if (value > max) {
        max = value;
      }
    }

    context.moveTo(x, center - max * scale);
    context.lineTo(x, center - min * scale);
  }

  context.stroke();

  const playheadRatio = waveform.frames > 0 ? state.playheadFrame / waveform.frames : 0;
  const playheadX = Math.max(0, Math.min(width, playheadRatio * width));
  context.strokeStyle = "#f3f1ec";
  context.lineWidth = Math.max(1, pixelRatio);
  context.beginPath();
  context.moveTo(playheadX, 0);
  context.lineTo(playheadX, height);
  context.stroke();

  if (state.waveformProbeFrame !== null) {
    const probeRatio =
      waveform.frames > 0 ? clampFrame(state.waveformProbeFrame, waveform) / waveform.frames : 0;
    const probeX = Math.max(0, Math.min(width, probeRatio * width));
    context.strokeStyle = "#f6c96d";
    context.lineWidth = Math.max(2, 2 * pixelRatio);
    context.beginPath();
    context.moveTo(probeX, 0);
    context.lineTo(probeX, height);
    context.stroke();
    context.fillStyle = "#f6c96d";
    context.beginPath();
    context.arc(probeX, center, Math.max(4, 4 * pixelRatio), 0, Math.PI * 2);
    context.fill();
  }
}

function drawLevelEnvelope() {
  const canvas = document.getElementById("levelEnvelopeCanvas");
  const waveform = state.waveform;
  const envelope = waveform?.envelope;
  if (!waveform || !envelope) {
    return;
  }

  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(canvas.clientWidth * pixelRatio));
  const height = Math.max(100, Math.floor(canvas.clientHeight * pixelRatio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext("2d");
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#111418";
  context.fillRect(0, 0, width, height);

  const regions = waveform.regions || [];
  for (const [index, region] of regions.entries()) {
    const startX = Math.round((region.startFrame / waveform.frames) * width);
    const endX = Math.round((region.endFrame / waveform.frames) * width);
    context.fillStyle =
      index % 2 === 0 ? "rgba(127,199,217,0.09)" : "rgba(226,168,109,0.10)";
    context.fillRect(startX, 0, Math.max(1, endX - startX), height);
  }

  const pad = 12 * pixelRatio;
  const top = pad;
  const bottom = height - pad;
  const graphHeight = Math.max(1, bottom - top);
  context.strokeStyle = "rgba(243,241,236,0.16)";
  context.lineWidth = Math.max(1, pixelRatio);
  for (const level of [0, 0.5, 1]) {
    const y = bottom - level * graphHeight;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  const windows = envelope.windows;
  if (windows.length) {
    const columnWidth = Math.max(1, width / windows.length);
    context.fillStyle = "rgba(127,199,217,0.30)";
    for (const [index, entry] of windows.entries()) {
      const x = Math.floor(index * columnWidth);
      const y = bottom - Math.min(1, entry.rms) * graphHeight;
      context.fillRect(x, y, Math.ceil(columnWidth), bottom - y);
    }

    context.strokeStyle = "#e2a86d";
    context.lineWidth = Math.max(1.5, 1.5 * pixelRatio);
    context.beginPath();
    for (const [index, entry] of windows.entries()) {
      const x = index * columnWidth + columnWidth / 2;
      const y = bottom - Math.min(1, entry.peak) * graphHeight;
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.stroke();
  }

  const playheadRatio = waveform.frames > 0 ? state.playheadFrame / waveform.frames : 0;
  const playheadX = Math.max(0, Math.min(width, playheadRatio * width));
  context.strokeStyle = "#f3f1ec";
  context.lineWidth = Math.max(1, pixelRatio);
  context.beginPath();
  context.moveTo(playheadX, 0);
  context.lineTo(playheadX, height);
  context.stroke();

  if (state.waveformProbeFrame !== null) {
    const probeFrame = clampFrame(state.waveformProbeFrame, waveform);
    const probeRatio = waveform.frames > 0 ? probeFrame / waveform.frames : 0;
    const probeX = Math.max(0, Math.min(width, probeRatio * width));
    const probeWindow = levelEnvelopeWindowAtFrame(probeFrame);
    const probeY = probeWindow
      ? bottom - Math.min(1, probeWindow.rms) * graphHeight
      : centerYForEnvelope(top, bottom);
    context.strokeStyle = "#f6c96d";
    context.lineWidth = Math.max(2, 2 * pixelRatio);
    context.beginPath();
    context.moveTo(probeX, 0);
    context.lineTo(probeX, height);
    context.stroke();
    context.fillStyle = "#f6c96d";
    context.beginPath();
    context.arc(probeX, probeY, Math.max(4, 4 * pixelRatio), 0, Math.PI * 2);
    context.fill();
  }
}

function centerYForEnvelope(top, bottom) {
  return top + (bottom - top) / 2;
}

function levelEnvelopeWindowAtFrame(frame) {
  const windows = state.waveform?.envelope?.windows || [];
  if (windows.length === 0) {
    return null;
  }

  return (
    windows.find((entry) => frame >= entry.startFrame && frame < entry.endFrame) ||
    windows.at(-1)
  );
}

function setProbePillMetadata(probe, source, frame, title) {
  probe.dataset.probeSource = source;
  probe.dataset.probeFrame = frame === null || frame === undefined ? "none" : String(frame);
  probe.title = title;
}

function resetProbePill(id, text, title) {
  const probe = document.getElementById(id);
  if (!probe) {
    return;
  }

  probe.textContent = text;
  setProbePillMetadata(probe, inspectionModes.none, null, title);
}

function resetIdleProbePill(id, title) {
  resetProbePill(id, inspectionModes.probe, title);
}

function renderLevelEnvelopeProbe() {
  const probe = document.getElementById("levelEnvelopeProbe");
  const waveform = state.waveform;
  if (!waveform || state.waveformProbeFrame === null) {
    resetIdleProbePill("levelEnvelopeProbe", "Level envelope probe idle");
    return;
  }

  const frame = clampFrame(state.waveformProbeFrame, waveform);
  const entry = levelEnvelopeWindowAtFrame(frame);
  const region = waveformRegionAtFrame(frame);
  const source = currentProbeSource();
  probe.textContent = entry
    ? `${probeSourceText()} ${formatProbeFrame(frame, waveform, region)} / peak ${formatCompactNumber(
        entry.peak,
      )} / rms ${formatCompactNumber(entry.rms)}`
    : "probe";
  setProbePillMetadata(
    probe,
    source,
    frame,
    entry
      ? `Level envelope probe ${source} / ${formatProbeFrame(frame, waveform, region)} / peak ${formatCompactNumber(
          entry.peak,
        )} / rms ${formatCompactNumber(entry.rms)}`
      : `Level envelope probe ${source} / ${formatProbeFrame(frame, waveform, region)} / no envelope window`,
  );
}

function renderLevelEnvelope() {
  const status = document.getElementById("levelEnvelopeStatus");
  const meta = document.getElementById("levelEnvelopeMeta");
  const peak = document.getElementById("levelEnvelopePeak");
  const rms = document.getElementById("levelEnvelopeRms");
  const canvas = document.getElementById("levelEnvelopeCanvas");
  const waveform = state.waveform;
  const envelope = waveform?.envelope;

  if (!waveform || !envelope) {
    canvas.dataset.envelopeSource = "unavailable";
    canvas.dataset.envelopeWindowMs = "unavailable";
    canvas.dataset.envelopeWindowFrames = "unavailable";
    canvas.dataset.envelopeWindows = "unavailable";
    canvas.dataset.envelopePeak = "unavailable";
    canvas.dataset.envelopeRms = "unavailable";
    canvas.dataset.envelopeFrames = "unavailable";
    canvas.title = "Primary WAV level envelope unavailable";
    peak.textContent = "peak 0";
    rms.textContent = "rms 0";
    renderLevelEnvelopeProbe();
    status.textContent = "Check";
    status.className = "pill warn";
    renderUnavailableLevelEnvelopeMeta();
    return;
  }

  peak.textContent = `peak ${formatCompactNumber(envelope.peak)}`;
  rms.textContent = `rms ${formatCompactNumber(envelope.rms)}`;
  canvas.dataset.envelopeSource = "decoded primary WAV";
  canvas.dataset.envelopeWindowMs = String(envelope.windowMs);
  canvas.dataset.envelopeWindowFrames = String(envelope.windowFrames);
  canvas.dataset.envelopeWindows = String(envelope.windows.length);
  canvas.dataset.envelopePeak = formatCompactNumber(envelope.peak);
  canvas.dataset.envelopeRms = formatCompactNumber(envelope.rms);
  canvas.dataset.envelopeFrames = String(waveform.frames);
  canvas.title =
    `Primary WAV level envelope / ${formatCompactNumber(envelope.windowMs)} ms window / ` +
    `${envelope.windows.length} windows / peak ${formatCompactNumber(envelope.peak)} / rms ${formatCompactNumber(envelope.rms)}`;
  renderLevelEnvelopeProbe();
  renderKeyValue(meta, [
    ["window", `${formatCompactNumber(envelope.windowMs)} ms`],
    ["window frames", String(envelope.windowFrames)],
    ["windows", String(envelope.windows.length)],
    ["peak", formatCompactNumber(envelope.peak)],
    ["rms", formatCompactNumber(envelope.rms)],
    ["source", "decoded primary WAV"],
  ]);
  drawLevelEnvelope();
  status.textContent = "Drawn";
  status.className = "pill good";
}

function renderUnavailableLevelEnvelopeMeta() {
  renderKeyValue(document.getElementById("levelEnvelopeMeta"), [
    ["window", "unavailable", "present"],
    ["windows", "unavailable", "present"],
    ["peak", "unavailable", "present"],
    ["rms", "unavailable", "present"],
    ["source", "manifest/audio required", "decoded primary WAV"],
  ]);
}

function updatePhaseAudioStatsActive(region) {
  for (const item of document.querySelectorAll(".phase-stat")) {
    item.classList.toggle("active", item.dataset.phaseName === region?.name);
  }
}

function updatePhaseProbeTargets() {
  const region =
    state.waveform && state.waveformProbeFrame !== null
      ? waveformRegionAtFrame(clampFrame(state.waveformProbeFrame, state.waveform))
      : null;

  for (const item of document.querySelectorAll(".phase, .phase-stat")) {
    item.classList.toggle("preview", item.dataset.phaseName === region?.name);
  }
}

function renderPhaseAudioStatsProbe() {
  const probe = document.getElementById("phaseAudioStatsProbe");
  const waveform = state.waveform;
  if (!waveform || state.waveformProbeFrame === null) {
    resetIdleProbePill("phaseAudioStatsProbe", "Phase audio stats probe idle");
    updatePhaseProbeTargets();
    return;
  }

  const frame = clampFrame(state.waveformProbeFrame, waveform);
  const region = waveformRegionAtFrame(frame);
  const source = currentProbeSource();
  probe.textContent = region
    ? `${probeSourceText()} ${formatProbeFrame(frame, waveform, region)}`
    : "probe";
  setProbePillMetadata(
    probe,
    source,
    frame,
    region
      ? `Phase audio stats probe ${source} / ${formatProbeFrame(frame, waveform, region)}`
      : `Phase audio stats probe ${source} / ${formatProbeFrame(
          frame,
          waveform,
          region,
        )} / no phase`,
  );
  updatePhaseProbeTargets();
}

function probePhaseAudioStats(event) {
  const waveform = state.waveform;
  if (!waveform) {
    return;
  }

  const startFrame = Number(event.currentTarget.dataset.startFrame);
  const endFrame = Number(event.currentTarget.dataset.endFrame);
  if (!Number.isFinite(startFrame) || !Number.isFinite(endFrame) || endFrame <= startFrame) {
    return;
  }

  state.waveformProbeFrame = clampFrame(Math.round(startFrame + (endFrame - startFrame) / 2), waveform);
  state.waveformProbeSource = inspectionSources.phaseAudioStats;
  state.signalPlotProbe = signalPlotProbeAtFrame(state.waveformProbeFrame);
  renderWaveformProbe();
  renderLevelEnvelopeProbe();
  renderPhaseAudioStatsProbe();
  renderParameterTimelineProbe();
  drawWaveform();
  drawLevelEnvelope();
  drawSignalPlot();
  renderSignalPlotProbe();
}

function clearPhaseAudioStatsProbe() {
  if (state.waveformPointerActive) {
    return;
  }

  resetSharedProbeState();
  renderWaveformProbe();
  renderLevelEnvelopeProbe();
  renderPhaseAudioStatsProbe();
  renderParameterTimelineProbe();
  drawWaveform();
  drawLevelEnvelope();
  drawSignalPlot();
  renderSignalPlotProbe();
}

function renderPhaseAudioStats() {
  const status = document.getElementById("phaseAudioStatsStatus");
  const list = document.getElementById("phaseAudioStats");
  list.replaceChildren();

  const waveform = state.waveform;
  const regions = waveform?.regions || [];
  if (!waveform || !regions.length) {
    renderUnavailablePhaseAudioStats();
    renderPhaseAudioStatsProbe();
    status.textContent = "Check";
    status.className = "pill warn";
    return;
  }

  let allOk = true;
  for (const region of regions) {
    const stats = analyzeSampleRange(
      waveform.samples,
      region.startFrame,
      region.endFrame,
    );
    const frequencyValue = activeParameterValue("frequency", region);
    const amplitudeValue = activeParameterValue("amplitude", region);
    const biasValue = activeParameterValue("bias", region) ?? 0;
    const targetPeak = targetPeakFor(amplitudeValue, biasValue);
    const measuredFrequency = estimateZeroCrossingFrequency(
      waveform.samples,
      region.startFrame,
      region.endFrame,
      waveform.sampleRate,
    );
    const producerMeasurement = producerPhaseAudioMeasurement(region);
    const producerFrequency = Number(producerMeasurement?.measuredFrequency);
    const producerPeak = Number(producerMeasurement?.peak);
    const producerRms = Number(producerMeasurement?.rms);
    const producerFrequencyDelta =
      measuredFrequency === null || !Number.isFinite(producerFrequency)
        ? null
        : measuredFrequency - producerFrequency;
    const producerPeakDelta = !Number.isFinite(producerPeak)
      ? null
      : stats.peak - producerPeak;
    const producerRmsDelta = !Number.isFinite(producerRms)
      ? null
      : stats.rms - producerRms;
    const producerOk =
      producerMeasurement &&
      producerFrequencyDelta !== null &&
      Math.abs(producerFrequencyDelta) <= phaseAudioFrequencyToleranceHz &&
      producerPeakDelta !== null &&
      Math.abs(producerPeakDelta) <= phaseAudioAmplitudeTolerance &&
      producerRmsDelta !== null &&
      Math.abs(producerRmsDelta) <= phaseAudioRmsTolerance;
    allOk = allOk && producerOk;
    const targetFrequencyText =
      frequencyValue === null ? "missing" : `${formatCompactNumber(frequencyValue)} Hz`;
    const measuredFrequencyText =
      measuredFrequency === null ? "missing" : `${formatCompactNumber(measuredFrequency)} Hz`;
    const targetAmplitudeText =
      amplitudeValue === null ? "missing" : formatCompactNumber(amplitudeValue);
    const targetPeakText =
      targetPeak === null ? "missing" : formatCompactNumber(targetPeak);
    const peakText = formatCompactNumber(stats.peak);
    const rmsText = formatCompactNumber(stats.rms);
    const startTime = formatSeconds(region.startFrame / waveform.sampleRate);
    const endTime = formatSeconds(region.endFrame / waveform.sampleRate);
    const itemLabel =
      `Phase audio stats ${region.name} from frame ${region.startFrame} to ${region.endFrame}`;

    const item = document.createElement("div");
    item.className = producerOk ? "phase-stat" : "phase-stat warn-row";
    item.dataset.phaseName = region.name;
    item.dataset.startFrame = String(region.startFrame);
    item.dataset.endFrame = String(region.endFrame);
    item.dataset.startTime = startTime;
    item.dataset.endTime = endTime;
    item.dataset.targetFrequency = targetFrequencyText;
    item.dataset.measuredFrequency = measuredFrequencyText;
    item.dataset.targetAmplitude = targetPeakText;
    item.dataset.peak = peakText;
    item.dataset.rms = rmsText;
    item.dataset.producerMatch = String(Boolean(producerOk));
    item.setAttribute("aria-label", itemLabel);
    item.setAttribute("role", "group");
    item.title =
      `${itemLabel} / target ${targetFrequencyText} / measured ${measuredFrequencyText} / ` +
      `peak ${peakText} / producer ${producerOk ? "match" : "check"}`;
    item.addEventListener("pointermove", probePhaseAudioStats);
    item.addEventListener("pointerleave", clearPhaseAudioStatsProbe);

    const name = document.createElement("h3");
    name.textContent = region.name;

    const body = document.createElement("dl");
    body.className = "kv compact";
    const frequencyDelta =
      measuredFrequency === null || frequencyValue === null
        ? "missing"
        : formatSignedNumber(measuredFrequency - frequencyValue);
    const producerFrequencyDeltaText =
      producerFrequencyDelta === null
        ? "missing"
        : formatSignedNumber(producerFrequencyDelta);
    const peakDelta =
      targetPeak === null ? "missing" : formatSignedNumber(stats.peak - targetPeak);
    const producerPeakDeltaText =
      producerPeakDelta === null
        ? "missing"
        : formatSignedNumber(producerPeakDelta);
    const producerRmsDeltaText =
      producerRmsDelta === null ? "missing" : formatSignedNumber(producerRmsDelta);
    renderKeyValue(body, [
      ["target freq", targetFrequencyText],
      ["measured freq", measuredFrequencyText],
      ["freq delta", frequencyDelta],
      ["producer freq", Number.isFinite(producerFrequency) ? `${formatCompactNumber(producerFrequency)} Hz` : "missing"],
      ["producer freq delta", producerFrequencyDeltaText],
      ["target amp", targetAmplitudeText],
      ["target bias", formatCompactNumber(biasValue)],
      ["target peak", targetPeakText],
      ["peak", peakText],
      ["peak delta", peakDelta],
      ["producer peak", Number.isFinite(producerPeak) ? formatCompactNumber(producerPeak) : "missing"],
      ["producer peak delta", producerPeakDeltaText],
      ["rms", rmsText],
      ["producer rms", Number.isFinite(producerRms) ? formatCompactNumber(producerRms) : "missing"],
      ["producer rms delta", producerRmsDeltaText],
      ["min", formatCompactNumber(stats.min)],
      ["max", formatCompactNumber(stats.max)],
      ["dc offset", formatCompactNumber(stats.dcOffset)],
    ]);

    item.append(name, body);
    list.append(item);
  }

  status.textContent = allOk ? "Verified" : "Check";
  status.className = `pill ${allOk ? "good" : "warn"}`;
  updatePhaseAudioStatsActive(activeWaveformRegion());
  renderPhaseAudioStatsProbe();
}

function renderUnavailablePhaseAudioStats() {
  const list = document.getElementById("phaseAudioStats");
  list.replaceChildren();

  const item = document.createElement("div");
  item.className = "phase-stat warn-row";
  item.dataset.phaseName = "unavailable";
  item.dataset.startFrame = "none";
  item.dataset.endFrame = "none";
  item.dataset.startTime = "unavailable";
  item.dataset.endTime = "unavailable";
  item.dataset.targetFrequency = "unavailable";
  item.dataset.measuredFrequency = "unavailable";
  item.dataset.targetAmplitude = "unavailable";
  item.dataset.peak = "unavailable";
  item.dataset.rms = "unavailable";
  item.dataset.producerMatch = "false";
  item.setAttribute("aria-label", "Phase audio stats unavailable: manifest required");
  item.setAttribute("role", "group");
  item.title = "Phase audio stats unavailable: manifest required";

  const name = document.createElement("h3");
  name.textContent = "Phase audio stats unavailable";

  const body = document.createElement("dl");
  body.className = "kv compact";
  renderKeyValue(body, [
    ["decoded waveform", "unavailable", "present"],
    ["phase ranges", "unavailable", "present"],
    ["producer compare", "unavailable", "present"],
  ]);

  item.append(name, body);
  list.append(item);
}

function signalPlotLagFrames(waveform) {
  return Math.max(1, Math.round((waveform.sampleRate * state.signalLagMs) / 1000));
}

function signalPlotWindowFrameRange(waveform, drawableFrames) {
  if (state.signalPlotWindow === "full") {
    return {
      endFrame: drawableFrames,
      startFrame: 0,
    };
  }

  const windowFrames = Math.max(
    1,
    Math.round((waveform.sampleRate * state.signalPlotWindowMs) / 1000),
  );
  const startFrame = Math.max(
    0,
    Math.min(drawableFrames, state.playheadFrame - Math.floor(windowFrames / 2)),
  );
  const endFrame = Math.max(
    startFrame,
    Math.min(drawableFrames, startFrame + windowFrames),
  );

  return {
    endFrame,
    startFrame,
  };
}

function signalPlotWindowName(waveform, drawableFrames) {
  if (state.signalPlotWindow === "full") {
    return "full";
  }

  const range = signalPlotWindowFrameRange(waveform, drawableFrames);
  return `${formatSeconds(range.startFrame / waveform.sampleRate)}-${formatSeconds(
    range.endFrame / waveform.sampleRate,
  )}`;
}

function signalPlotRegions(waveform, drawableFrames) {
  const regions = waveform.regions?.length
    ? waveform.regions
    : [{ name: "all", startFrame: 0, endFrame: drawableFrames }];
  const focusedRegions =
    state.signalPhaseFocusIndex === null
      ? regions
      : [regions[state.signalPhaseFocusIndex]].filter(Boolean);
  const windowRange = signalPlotWindowFrameRange(waveform, drawableFrames);

  return focusedRegions
    .map((region) => ({
      ...region,
      endFrame: Math.min(region.endFrame, windowRange.endFrame),
      startFrame: Math.max(region.startFrame, windowRange.startFrame),
    }))
    .filter((region) => region.endFrame > region.startFrame);
}

function signalPlotFocusName(waveform) {
  if (!waveform || state.signalPhaseFocusIndex === null) {
    return "all";
  }

  return waveform.regions?.[state.signalPhaseFocusIndex]?.name || "all";
}

function restoreSignalPlotFocusIndex() {
  if (state.signalPhaseFocusName === "all") {
    state.signalPhaseFocusIndex = null;
    return;
  }

  const index = (state.waveform?.regions || []).findIndex(
    (region) => region.name === state.signalPhaseFocusName,
  );
  state.signalPhaseFocusIndex = index >= 0 ? index : null;
}

function signalPlotPointCount(waveform, drawableFrames) {
  return signalPlotRegions(waveform, drawableFrames).reduce((total, region) => {
    const startFrame = Math.max(0, Math.min(drawableFrames, region.startFrame));
    const endFrame = Math.max(startFrame, Math.min(drawableFrames, region.endFrame));
    return total + Math.max(0, endFrame - startFrame);
  }, 0);
}

function signalPlotFocusStats(waveform, drawableFrames) {
  const regions = signalPlotRegions(waveform, drawableFrames);
  let max = -Infinity;
  let min = Infinity;
  let squareSum = 0;
  let count = 0;

  for (const region of regions) {
    const startFrame = Math.max(0, Math.min(drawableFrames, region.startFrame));
    const endFrame = Math.max(startFrame, Math.min(drawableFrames, region.endFrame));
    for (let frame = startFrame; frame < endFrame; frame += 1) {
      const sample = waveform.samples[frame] || 0;
      max = Math.max(max, sample);
      min = Math.min(min, sample);
      squareSum += sample * sample;
      count += 1;
    }
  }

  if (count === 0) {
    return {
      max: 0,
      min: 0,
      peak: 0,
      rms: 0,
    };
  }

  return {
    max,
    min,
    peak: Math.max(Math.abs(min), Math.abs(max)),
    rms: Math.sqrt(squareSum / count),
  };
}

function signalPlotRegionColor(index) {
  return index % 2 === 0 ? "rgba(127,199,217,0.76)" : "rgba(226,168,109,0.72)";
}

function drawSignalPlot() {
  const canvas = document.getElementById("signalPlotCanvas");
  const waveform = state.waveform;
  if (!waveform) {
    return;
  }

  const samples = waveform.samples;
  const lagFrames = signalPlotLagFrames(waveform);
  const drawableFrames = Math.max(0, samples.length - lagFrames);
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(canvas.clientWidth * pixelRatio));
  const height = Math.max(240, Math.floor(canvas.clientHeight * pixelRatio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext("2d");
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#111418";
  context.fillRect(0, 0, width, height);

  const centerX = width / 2;
  const centerY = height / 2;
  const scale = Math.min(width, height) * 0.44 * state.signalPlotScale;

  context.strokeStyle = "rgba(243,241,236,0.16)";
  context.lineWidth = Math.max(1, pixelRatio);
  context.beginPath();
  context.moveTo(centerX, 0);
  context.lineTo(centerX, height);
  context.moveTo(0, centerY);
  context.lineTo(width, centerY);
  context.stroke();

  if (drawableFrames === 0) {
    return;
  }

  const stride = Math.max(1, Math.floor(drawableFrames / 4200));
  const regions = signalPlotRegions(waveform, drawableFrames);

  for (const [regionIndex, region] of regions.entries()) {
    const startFrame = Math.max(0, Math.min(drawableFrames, region.startFrame));
    const endFrame = Math.max(startFrame, Math.min(drawableFrames, region.endFrame));
    context.strokeStyle = signalPlotRegionColor(regionIndex);
    context.fillStyle = signalPlotRegionColor(regionIndex);
    context.lineWidth = Math.max(1, pixelRatio);
    if (state.signalPlotMode === "trace") {
      context.beginPath();
    }
    let started = false;

    for (let frame = startFrame; frame < endFrame; frame += stride) {
      const x = centerX + samples[frame] * scale;
      const y = centerY - samples[frame + lagFrames] * scale;

      if (state.signalPlotMode === "points") {
        context.fillRect(x, y, Math.max(1, pixelRatio), Math.max(1, pixelRatio));
      } else {
        if (!started) {
          context.moveTo(x, y);
          started = true;
        } else {
          context.lineTo(x, y);
        }
      }
    }

    if (state.signalPlotMode === "trace") {
      context.stroke();
    }
  }

  const pointFrame = Math.max(
    0,
    Math.min(drawableFrames - 1, state.playheadFrame),
  );
  context.fillStyle = "#f3f1ec";
  context.beginPath();
  context.arc(
    centerX + samples[pointFrame] * scale,
    centerY - samples[pointFrame + lagFrames] * scale,
    Math.max(3, 3 * pixelRatio),
    0,
    Math.PI * 2,
  );
  context.fill();

  const nearestProbe = state.signalPlotProbe?.nearest;
  if (nearestProbe) {
    const probeFrame = Math.max(
      0,
      Math.min(drawableFrames - 1, nearestProbe.frame),
    );
    const probeX = centerX + samples[probeFrame] * scale;
    const probeY = centerY - samples[probeFrame + lagFrames] * scale;
    const radius = Math.max(7, 7 * pixelRatio);
    context.strokeStyle = "#f6c96d";
    context.lineWidth = Math.max(2, 2 * pixelRatio);
    context.beginPath();
    context.arc(probeX, probeY, radius, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.moveTo(probeX - radius * 1.35, probeY);
    context.lineTo(probeX + radius * 1.35, probeY);
    context.moveTo(probeX, probeY - radius * 1.35);
    context.lineTo(probeX, probeY + radius * 1.35);
    context.stroke();
  }
}

function signalPlotProbeAtClientPoint(clientX, clientY) {
  const canvas = document.getElementById("signalPlotCanvas");
  const waveform = state.waveform;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const scale = Math.min(width, height) * 0.44 * state.signalPlotScale;
  const x = (clientX - rect.left - width / 2) / scale;
  const y = -(clientY - rect.top - height / 2) / scale;
  const normalizedX = Math.max(-1, Math.min(1, x));
  const normalizedY = Math.max(-1, Math.min(1, y));

  if (!waveform) {
    return {
      x: normalizedX,
      y: normalizedY,
      nearest: null,
    };
  }

  const lagFrames = signalPlotLagFrames(waveform);
  const drawableFrames = Math.max(0, waveform.samples.length - lagFrames);
  const stride = Math.max(1, Math.floor(drawableFrames / 4200));
  let nearest = null;

  for (const region of signalPlotRegions(waveform, drawableFrames)) {
    const startFrame = Math.max(0, Math.min(drawableFrames, region.startFrame));
    const endFrame = Math.max(startFrame, Math.min(drawableFrames, region.endFrame));
    for (let frame = startFrame; frame < endFrame; frame += stride) {
      const sampleX = waveform.samples[frame] || 0;
      const sampleY = waveform.samples[frame + lagFrames] || 0;
      const distance =
        (sampleX - normalizedX) * (sampleX - normalizedX) +
        (sampleY - normalizedY) * (sampleY - normalizedY);
      if (!nearest || distance < nearest.distance) {
        nearest = {
          frame,
          phase: waveformRegionAtFrame(frame)?.name || "phase",
          seconds: frame / waveform.sampleRate,
          distance,
        };
      }
    }
  }

  return {
    x: normalizedX,
    y: normalizedY,
    nearest,
  };
}

function signalPlotProbeAtFrame(frame) {
  const waveform = state.waveform;
  if (!waveform) {
    return null;
  }

  const lagFrames = signalPlotLagFrames(waveform);
  const drawableFrames = Math.max(0, waveform.samples.length - lagFrames);
  const probeFrame = Math.max(0, Math.min(drawableFrames - 1, frame));
  return {
    x: waveform.samples[probeFrame] || 0,
    y: waveform.samples[probeFrame + lagFrames] || 0,
    nearest: {
      frame: probeFrame,
      phase: waveformRegionAtFrame(probeFrame)?.name || "phase",
      seconds: probeFrame / waveform.sampleRate,
      distance: 0,
    },
  };
}

function renderSignalPlotProbe() {
  const probe = document.getElementById("signalPlotProbe");
  const source = document.getElementById("signalPlotProbeSource");
  if (!state.waveform || !state.signalPlotProbe) {
    resetIdleProbePill("signalPlotProbe", "Signal plot probe idle");
    resetProbePill("signalPlotProbeSource", "near frame", "Signal plot source probe idle");
    return;
  }

  const nearest = state.signalPlotProbe.nearest;
  const probeSource = state.waveformProbeSource || inspectionSources.signalPlot;
  const pointText = `x ${formatCompactNumber(
    state.signalPlotProbe.x,
  )} / y ${formatCompactNumber(state.signalPlotProbe.y)}`;
  probe.textContent = nearest
    ? `probe ${formatProbeFrame(nearest.frame, state.waveform)} / ${pointText}`
    : `probe ${pointText}`;
  setProbePillMetadata(
    probe,
    probeSource,
    nearest?.frame,
    nearest
      ? `Signal plot probe ${probeSource} / ${formatProbeFrame(
          nearest.frame,
          state.waveform,
        )} / ${pointText}`
      : `Signal plot probe ${probeSource} / ${pointText}`,
  );
  source.textContent = nearest
    ? `${probeSourceText()} / near frame ${nearest.frame} / ${formatSeconds(
        nearest.seconds,
      )} / ${nearest.phase}`
    : "near frame";
  setProbePillMetadata(
    source,
    probeSource,
    nearest?.frame,
    nearest
      ? `Signal plot source ${probeSource} / near frame ${nearest.frame} / ${formatSeconds(
          nearest.seconds,
        )} / ${nearest.phase}`
      : `Signal plot source ${probeSource} / no nearest frame`,
  );
}

function probeSignalPlot(event) {
  if (!state.waveform) {
    return;
  }

  state.signalPlotProbe = signalPlotProbeAtClientPoint(event.clientX, event.clientY);
  state.waveformProbeFrame = state.signalPlotProbe.nearest?.frame ?? null;
  state.waveformProbeSource =
    state.waveformProbeFrame === null ? null : inspectionSources.signalPlot;
  drawSignalPlot();
  renderSignalPlotProbe();
  drawWaveform();
  renderWaveformProbe();
  drawLevelEnvelope();
  renderLevelEnvelopeProbe();
}

function clearSignalPlotProbe() {
  resetSharedProbeState();
  drawSignalPlot();
  renderSignalPlotProbe();
  drawWaveform();
  renderWaveformProbe();
  drawLevelEnvelope();
  renderLevelEnvelopeProbe();
}

function renderSignalPlot() {
  const status = document.getElementById("signalPlotStatus");
  const meta = document.getElementById("signalPlotMeta");
  const canvas = document.getElementById("signalPlotCanvas");
  const waveform = state.waveform;
  renderSignalPlotControls();
  renderSignalPlotSummary();
  renderSignalPlotPoint();
  renderSignalPlotProbe();
  if (!waveform) {
    canvas.dataset.signalSource = "unavailable";
    canvas.dataset.signalFocus = "unavailable";
    canvas.dataset.signalMode = state.signalPlotMode;
    canvas.dataset.signalScale = String(state.signalPlotScale);
    canvas.dataset.signalWindow = "unavailable";
    canvas.dataset.signalWindowMs = String(state.signalPlotWindowMs);
    canvas.dataset.signalLagMs = String(state.signalLagMs);
    canvas.dataset.signalLagFrames = "unavailable";
    canvas.dataset.signalPoints = "unavailable";
    canvas.title = "Primary WAV signal plot unavailable";
    status.textContent = "Check";
    status.className = "pill warn";
    renderUnavailableSignalPlotMeta();
    return;
  }

  const lagFrames = signalPlotLagFrames(waveform);
  const drawableFrames = Math.max(0, waveform.samples.length - lagFrames);
  const focusStats = signalPlotFocusStats(waveform, drawableFrames);
  const focusName = signalPlotFocusName(waveform);
  const windowName = signalPlotWindowName(waveform, drawableFrames);
  const pointCount = signalPlotPointCount(waveform, drawableFrames);
  canvas.dataset.signalSource = "decoded primary WAV";
  canvas.dataset.signalFocus = focusName;
  canvas.dataset.signalMode = state.signalPlotMode;
  canvas.dataset.signalScale = String(state.signalPlotScale);
  canvas.dataset.signalWindow = windowName;
  canvas.dataset.signalWindowMs = String(state.signalPlotWindowMs);
  canvas.dataset.signalLagMs = String(state.signalLagMs);
  canvas.dataset.signalLagFrames = String(lagFrames);
  canvas.dataset.signalPoints = String(pointCount);
  canvas.dataset.signalFocusPeak = formatCompactNumber(focusStats.peak);
  canvas.dataset.signalFocusRms = formatCompactNumber(focusStats.rms);
  canvas.title =
    `Primary WAV signal plot / ${focusName} / ${state.signalPlotMode} / ` +
    `x${state.signalPlotScale} / ${windowName} / lag ${state.signalLagMs} ms / ${pointCount} points`;
  drawSignalPlot();
  renderKeyValue(meta, [
    ["focus", focusName],
    ["mode", state.signalPlotMode],
    ["scale", `x${state.signalPlotScale}`],
    ["window", windowName],
    ["window size", `${state.signalPlotWindowMs} ms`],
    ["x", "sample[n]"],
    ["y", "sample[n + lag]"],
    ["lag", `${state.signalLagMs} ms`],
    ["lag frames", String(lagFrames)],
    ["lag time", formatSeconds(lagFrames / waveform.sampleRate)],
    ["points", String(pointCount)],
    ["focus peak", formatCompactNumber(focusStats.peak)],
    ["focus rms", formatCompactNumber(focusStats.rms)],
    ["focus min", formatCompactNumber(focusStats.min)],
    ["focus max", formatCompactNumber(focusStats.max)],
  ]);
  status.textContent = "Drawn";
  status.className = "pill good";
}

function renderUnavailableSignalPlotMeta() {
  renderKeyValue(document.getElementById("signalPlotMeta"), [
    ["focus", "unavailable", "present"],
    ["mode", state.signalPlotMode],
    ["window", "unavailable", "present"],
    ["lag", `${state.signalLagMs} ms`],
    ["points", "unavailable", "present"],
    ["source", "manifest/audio required", "decoded primary WAV"],
  ]);
}

function renderSignalPlotSummary() {
  const waveform = state.waveform;
  const mode = document.getElementById("signalPlotModeSummary");
  const window = document.getElementById("signalPlotWindowSummary");
  const lag = document.getElementById("signalPlotLagSummary");
  const drawableFrames = waveform
    ? Math.max(0, waveform.samples.length - signalPlotLagFrames(waveform))
    : 0;

  mode.textContent = `${signalPlotFocusName(waveform)} / ${state.signalPlotMode} / x${state.signalPlotScale}`;
  window.textContent = waveform
    ? `window ${signalPlotWindowName(waveform, drawableFrames)}`
    : "window full";
  lag.textContent = `lag ${state.signalLagMs} ms`;
}

function renderSignalPlotPoint() {
  const point = document.getElementById("signalPlotPoint");
  const waveform = state.waveform;
  if (!waveform) {
    point.textContent = "frame 0 / phase none / x 0 / y 0";
    return;
  }

  const lagFrames = signalPlotLagFrames(waveform);
  const drawableFrames = Math.max(0, waveform.samples.length - lagFrames);
  const pointFrame = Math.max(
    0,
    Math.min(drawableFrames - 1, state.playheadFrame),
  );
  const x = waveform.samples[pointFrame] || 0;
  const y = waveform.samples[pointFrame + lagFrames] || 0;
  const region = waveformRegionAtFrame(pointFrame);
  point.textContent = `frame ${pointFrame} / ${formatSeconds(pointFrame / waveform.sampleRate)} / ${region?.name || "phase"} / x ${formatCompactNumber(x)} / y ${formatCompactNumber(y)}`;
}

function labelSignalPlotButton(button, label, active = false) {
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", String(active));
  button.title = label;
  button.classList.toggle("active", active);
}

function renderSignalPlotControls() {
  const container = document.getElementById("signalPlotControls");
  container.replaceChildren();
  restoreSignalPlotFocusIndex();

  const focusGroup = document.createElement("div");
  focusGroup.className = "control-group";
  focusGroup.setAttribute("aria-label", "Signal plot focus");
  const modeGroup = document.createElement("div");
  modeGroup.className = "control-group";
  modeGroup.setAttribute("aria-label", "Signal plot mode");
  const scaleGroup = document.createElement("div");
  scaleGroup.className = "control-group";
  scaleGroup.setAttribute("aria-label", "Signal plot scale");
  const windowGroup = document.createElement("div");
  windowGroup.className = "control-group";
  windowGroup.setAttribute("aria-label", "Signal plot window");
  const windowSizeGroup = document.createElement("div");
  windowSizeGroup.className = "control-group";
  windowSizeGroup.setAttribute("aria-label", "Signal plot window size");
  const lagGroup = document.createElement("div");
  lagGroup.className = "control-group";
  lagGroup.setAttribute("aria-label", "Signal plot lag");
  const resetGroup = document.createElement("div");
  resetGroup.className = "control-group";
  resetGroup.setAttribute("aria-label", "Signal plot reset");

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = "phase-button";
  allButton.dataset.signalFocus = "all";
  allButton.textContent = "all";
  labelSignalPlotButton(
    allButton,
    "Signal plot focus all",
    state.signalPhaseFocusIndex === null,
  );
  allButton.addEventListener("click", () => {
    state.signalPhaseFocusIndex = null;
    state.signalPhaseFocusName = "all";
    saveSignalPlotSettings();
    renderSignalPlot();
  });
  focusGroup.append(allButton);

  for (const [index, region] of (state.waveform?.regions || []).entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "phase-button";
    button.dataset.signalFocus = region.name;
    button.textContent = region.name;
    labelSignalPlotButton(
      button,
      `Signal plot focus ${region.name}`,
      index === state.signalPhaseFocusIndex,
    );
    button.addEventListener("click", () => {
      state.signalPhaseFocusIndex = index;
      state.signalPhaseFocusName = region.name;
      saveSignalPlotSettings();
      renderSignalPlot();
    });
    focusGroup.append(button);
  }

  for (const mode of ["trace", "points"]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "phase-button";
    button.dataset.signalMode = mode;
    button.textContent = mode;
    labelSignalPlotButton(button, `Signal plot mode ${mode}`, mode === state.signalPlotMode);
    button.addEventListener("click", () => {
      state.signalPlotMode = mode;
      saveSignalPlotSettings();
      renderSignalPlot();
    });
    modeGroup.append(button);
  }

  for (const scale of [1, 2, 4]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "phase-button";
    button.dataset.signalScale = String(scale);
    button.textContent = `x${scale}`;
    labelSignalPlotButton(
      button,
      `Signal plot scale x${scale}`,
      scale === state.signalPlotScale,
    );
    button.addEventListener("click", () => {
      state.signalPlotScale = scale;
      saveSignalPlotSettings();
      renderSignalPlot();
    });
    scaleGroup.append(button);
  }

  for (const windowMode of ["full", "cursor"]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "phase-button";
    button.dataset.signalWindow = windowMode;
    button.textContent = windowMode;
    labelSignalPlotButton(
      button,
      `Signal plot window ${windowMode}`,
      windowMode === state.signalPlotWindow,
    );
    button.addEventListener("click", () => {
      state.signalPlotWindow = windowMode;
      saveSignalPlotSettings();
      renderSignalPlot();
    });
    windowGroup.append(button);
  }

  for (const windowMs of [40, 80, 160]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "phase-button";
    button.dataset.signalWindowMs = String(windowMs);
    button.textContent = `${windowMs} ms`;
    labelSignalPlotButton(
      button,
      `Signal plot window size ${windowMs} ms`,
      windowMs === state.signalPlotWindowMs,
    );
    button.addEventListener("click", () => {
      state.signalPlotWindowMs = windowMs;
      saveSignalPlotSettings();
      renderSignalPlot();
    });
    windowSizeGroup.append(button);
  }

  for (const lagMs of [1, 2, 5, 10]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "phase-button";
    button.dataset.signalLagMs = String(lagMs);
    button.textContent = `${lagMs} ms`;
    labelSignalPlotButton(button, `Signal plot lag ${lagMs} ms`, lagMs === state.signalLagMs);
    button.addEventListener("click", () => {
      state.signalLagMs = lagMs;
      saveSignalPlotSettings();
      renderSignalPlot();
    });
    lagGroup.append(button);
  }

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "phase-button";
  resetButton.dataset.signalReset = "settings";
  resetButton.textContent = "reset";
  labelSignalPlotButton(resetButton, "Signal plot reset settings");
  resetButton.addEventListener("click", () => {
    resetSignalPlotSettings();
    renderSignalPlot();
  });
  resetGroup.append(resetButton);

  container.append(
    focusGroup,
    modeGroup,
    scaleGroup,
    windowGroup,
    windowSizeGroup,
    lagGroup,
    resetGroup,
  );
}

function renderWaveformPhaseControls() {
  const container = document.getElementById("waveformPhaseControls");
  container.replaceChildren();

  const waveform = state.waveform;
  if (!waveform) {
    return;
  }

  for (const [index, region] of (waveform.regions || []).entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "phase-button";
    button.dataset.phaseIndex = String(index);
    button.dataset.phaseName = region.name || "";
    button.dataset.phaseStartFrame = String(region.startFrame);
    button.dataset.phaseEndFrame = String(region.endFrame);
    button.dataset.phaseStartTime = formatSeconds(region.startFrame / waveform.sampleRate);
    button.dataset.phaseEndTime = formatSeconds(region.endFrame / waveform.sampleRate);
    button.setAttribute(
      "aria-label",
      `Jump waveform to ${region.name} phase from frame ${region.startFrame} to ${region.endFrame}`,
    );
    button.title =
      `Jump to ${region.name} from ${button.dataset.phaseStartTime} to ${button.dataset.phaseEndTime}`;
    button.textContent = region.name;
    button.classList.toggle("preview", index === state.phaseJumpPreviewIndex);
    button.addEventListener("pointermove", () => probePhaseButton(index));
    button.addEventListener("pointerleave", clearPhaseButtonProbe);
    button.addEventListener("focus", () => probePhaseButton(index));
    button.addEventListener("blur", clearPhaseButtonProbe);
    button.addEventListener("click", () => {
      seekPrimaryAudioToFrame(region.startFrame, inspectionSources.phaseJump);
    });
    container.append(button);
  }
}

function setSharedProbeFrame(frame, source = inspectionModes.probe) {
  const waveform = state.waveform;
  if (!waveform) {
    return;
  }

  state.waveformProbeFrame = clampFrame(frame, waveform);
  state.waveformProbeSource = source;
  state.signalPlotProbe = signalPlotProbeAtFrame(state.waveformProbeFrame);
  renderWaveformProbe();
  renderLevelEnvelopeProbe();
  renderPhaseProbe();
  renderPhaseAudioStatsProbe();
  renderParameterTimelineProbe();
  drawWaveform();
  drawLevelEnvelope();
  drawSignalPlot();
  renderSignalPlotProbe();
}

function clearSharedProbeFrame() {
  resetSharedProbeState();
  renderWaveformProbe();
  renderLevelEnvelopeProbe();
  renderPhaseProbe();
  renderPhaseAudioStatsProbe();
  renderParameterTimelineProbe();
  drawWaveform();
  drawLevelEnvelope();
  drawSignalPlot();
  renderSignalPlotProbe();
}

function probePhaseButton(index) {
  const region = state.waveform?.regions?.[index];
  if (!region) {
    return;
  }

  state.phaseJumpPreviewIndex = index;
  updateActivePhaseButtons(activeWaveformRegion());
  setSharedProbeFrame(region.startFrame, inspectionSources.phaseJump);
}

function clearPhaseButtonProbe() {
  if (state.waveformPointerActive) {
    return;
  }

  state.phaseJumpPreviewIndex = null;
  updateActivePhaseButtons(activeWaveformRegion());
  clearSharedProbeFrame();
}

function clearPhaseButtonProbeFromOutside(event) {
  if (state.phaseJumpPreviewIndex === null || state.waveformPointerActive) {
    return;
  }

  const target = event.target;
  if (target instanceof Element && target.closest("#waveformPhaseControls")) {
    return;
  }

  clearPhaseButtonProbe();
}

function activeWaveformRegion() {
  const waveform = state.waveform;
  if (!waveform) {
    return null;
  }

  return waveformRegionAtFrame(state.playheadFrame);
}

function waveformRegionAtFrame(frame) {
  return waveformRegionAtFrameFor(state.waveform, frame);
}

function waveformRegionAtFrameFor(waveform, frame) {
  if (!waveform) {
    return null;
  }

  return (
    (waveform.regions || []).find(
      (region) =>
        frame >= region.startFrame &&
        frame < region.endFrame,
    ) || waveform.regions?.at(-1) || null
  );
}

function activeParameterValue(name, region) {
  const resync = state.response?.manifest?.parameterResync || {};
  const values = resync[name] || {};
  const number = Number(values[region?.name]);
  return Number.isFinite(number) ? number : null;
}

function producerPhaseAudioMeasurement(region) {
  const measurements = state.response?.manifest?.phaseAudioMeasurements || [];
  if (!Array.isArray(measurements) || !region) {
    return null;
  }

  return (
    measurements.find((measurement) => measurement?.name === region.name) || null
  );
}

function measuredPhaseAudio(region) {
  const waveform = state.waveform;
  if (!waveform || !region) {
    return null;
  }

  const stats = analyzeSampleRange(
    waveform.samples,
    region.startFrame,
    region.endFrame,
  );
  return {
    frequency: estimateZeroCrossingFrequency(
      waveform.samples,
      region.startFrame,
      region.endFrame,
      waveform.sampleRate,
    ),
    peak: stats.peak,
    dcOffset: stats.dcOffset,
  };
}

function targetPeakFor(targetAmplitude, targetBias) {
  if (targetAmplitude === null) {
    return null;
  }
  return targetAmplitude + Math.abs(targetBias || 0);
}

function measuredPhaseAudioMatches(measurement, targetFrequency, targetAmplitude, targetBias = 0) {
  const targetPeak = targetPeakFor(targetAmplitude, targetBias);
  return (
    measurement !== null &&
    Number.isFinite(measurement.frequency) &&
    Number.isFinite(measurement.peak) &&
    Number.isFinite(measurement.dcOffset) &&
    targetFrequency !== null &&
    targetPeak !== null &&
    Math.abs(measurement.frequency - targetFrequency) <= phaseAudioFrequencyToleranceHz &&
    Math.abs(measurement.peak - targetPeak) <= phaseAudioAmplitudeTolerance &&
    Math.abs(measurement.dcOffset - (targetBias || 0)) <= phaseAudioAmplitudeTolerance
  );
}

function measuredPhaseDelta(measuredValue, targetValue) {
  if (!Number.isFinite(measuredValue) || targetValue === null) {
    return null;
  }

  return measuredValue - targetValue;
}

function renderCurrentParameters(region) {
  const frequency = document.getElementById("currentFrequency");
  const amplitude = document.getElementById("currentAmplitude");
  const measuredFrequency = document.getElementById("currentMeasuredFrequency");
  const measuredPeak = document.getElementById("currentMeasuredPeak");
  const measuredFrequencyDelta = document.getElementById("currentMeasuredFrequencyDelta");
  const measuredPeakDelta = document.getElementById("currentMeasuredPeakDelta");
  const measuredStatus = document.getElementById("currentMeasuredStatus");
  const status = document.getElementById("currentParameterStatus");
  const frequencyValue = activeParameterValue("frequency", region);
  const amplitudeValue = activeParameterValue("amplitude", region);
  const biasValue = activeParameterValue("bias", region) ?? 0;
  const targetPeak = targetPeakFor(amplitudeValue, biasValue);
  const measurement = measuredPhaseAudio(region);
  const frequencyDelta = measuredPhaseDelta(measurement?.frequency, frequencyValue);
  const peakDelta = measuredPhaseDelta(measurement?.peak, targetPeak);
  const ok = frequencyValue !== null && amplitudeValue !== null;
  const measurementOk = measuredPhaseAudioMatches(
    measurement,
    frequencyValue,
    amplitudeValue,
    biasValue,
  );

  const frequencyText =
    frequencyValue === null ? "freq" : `freq ${formatCompactNumber(frequencyValue)} Hz`;
  const amplitudeText =
    amplitudeValue === null ? "amp" : `amp ${formatCompactNumber(amplitudeValue)}`;
  const measuredFrequencyText =
    measurement?.frequency === null || measurement?.frequency === undefined
      ? "measured freq"
      : `measured ${formatCompactNumber(measurement.frequency)} Hz`;
  const measuredPeakText =
    measurement ? `peak ${formatCompactNumber(measurement.peak)}` : "peak";
  const measuredFrequencyDeltaText =
    frequencyDelta === null ? "freq delta" : `freq delta ${formatSignedNumber(frequencyDelta)}`;
  const measuredPeakDeltaText =
    peakDelta === null ? "peak delta" : `peak delta ${formatSignedNumber(peakDelta)}`;
  const measuredStatusText = measurementOk
    ? "measured ok"
    : measurement
      ? "measured mismatch"
      : "measured missing";
  const statusText = ok ? `params ${region?.name || "synced"}` : "params missing";

  labelWaveformHeaderPill(frequency, "current frequency", frequencyText, frequencyValue !== null);
  labelWaveformHeaderPill(amplitude, "current amplitude", amplitudeText, amplitudeValue !== null);
  labelWaveformHeaderPill(
    measuredFrequency,
    "current measured frequency",
    measuredFrequencyText,
    Boolean(measurement),
  );
  labelWaveformHeaderPill(measuredPeak, "current measured peak", measuredPeakText, Boolean(measurement));
  labelWaveformHeaderPill(
    measuredFrequencyDelta,
    "current measured frequency delta",
    measuredFrequencyDeltaText,
    frequencyDelta !== null,
  );
  labelWaveformHeaderPill(
    measuredPeakDelta,
    "current measured peak delta",
    measuredPeakDeltaText,
    peakDelta !== null,
  );
  labelWaveformHeaderPill(measuredStatus, "current measured status", measuredStatusText, measurementOk);
  measuredStatus.className = `pill ${measurementOk ? "good" : "warn"}`;
  labelWaveformHeaderPill(status, "current parameter status", statusText, ok);
  status.className = `pill ${ok ? "good" : "warn"}`;
}

function formatRegionRange(region, sampleRate) {
  if (!region || !sampleRate) {
    return "range";
  }

  const frames = Math.max(0, region.endFrame - region.startFrame);
  return `${formatSeconds(region.startFrame / sampleRate)}-${formatSeconds(
    region.endFrame / sampleRate,
  )} / ${frames} frames`;
}

function renderPhaseJumpTarget() {
  const target = document.getElementById("waveformPhaseJumpTarget");
  const waveform = state.waveform;
  const region =
    state.phaseJumpPreviewIndex === null
      ? null
      : waveform?.regions?.[state.phaseJumpPreviewIndex];

  const targetText =
    waveform && region
      ? `jump ${region.name} / ${formatSeconds(
          region.startFrame / waveform.sampleRate,
        )} / frame ${region.startFrame}`
      : "jump idle";
  labelWaveformHeaderPill(target, "phase jump target", targetText, Boolean(waveform));
}

function setPlayheadFrame(frame) {
  const waveform = state.waveform;
  if (!waveform) {
    state.playheadFrame = 0;
    return;
  }

  state.playheadFrame = Math.min(waveform.frames, Math.max(0, frame));
  renderWaveformPosition();
  drawWaveform();
  drawLevelEnvelope();
  drawSignalPlot();
  renderSignalPlotPoint();
}

async function renderWaveform(path) {
  const status = document.getElementById("waveformStatus");
  const meta = document.getElementById("waveformMeta");
  const canvas = document.getElementById("waveformCanvas");
  status.textContent = "Loading";
  status.className = "pill";

  try {
    const response = await fetch(artifactUrl(path), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`WAV fetch failed: ${response.status}`);
    }

    state.waveform = parsePcm16Wav(await response.arrayBuffer());
    resetWaveformTransientState();
    state.waveform.stats = analyzeWaveform(state.waveform.samples);
    state.waveform.envelope = buildLevelEnvelope(state.waveform);
    state.waveform.regions = buildPhaseRegions(
      state.response?.manifest?.phases || [],
      state.waveform.frames,
    );
    setPlayheadFrame(0);
    drawWaveform();
    renderLevelEnvelope();
    renderPhaseAudioStats();
    renderSignalPlot();
    renderWaveformPhaseControls();
    renderHandsOnReadiness(state.response?.manifest, true);
    const wav = state.response?.manifest?.wav || {};
    const stats = state.waveform.stats;
    canvas.dataset.waveformSource = "decoded primary WAV";
    canvas.dataset.waveformSampleRate = String(state.waveform.sampleRate);
    canvas.dataset.waveformChannels = String(state.waveform.channels);
    canvas.dataset.waveformBitDepth = String(state.waveform.bitsPerSample);
    canvas.dataset.waveformFrames = String(state.waveform.frames);
    canvas.dataset.waveformDataBytes = String(state.waveform.dataBytes);
    canvas.dataset.waveformFileBytes = String(state.waveform.fileBytes);
    canvas.dataset.waveformPeak = formatCompactNumber(stats.peak);
    canvas.dataset.waveformRms = formatCompactNumber(stats.rms);
    canvas.title =
      `Primary WAV waveform / ${state.waveform.frames} frames / ` +
      `${state.waveform.sampleRate} Hz / peak ${formatCompactNumber(stats.peak)} / rms ${formatCompactNumber(stats.rms)}`;
    renderKeyValue(meta, [
      ["sample rate", String(state.waveform.sampleRate), manifestNumberText(wav.sampleRate)],
      ["channels", String(state.waveform.channels), manifestNumberText(wav.channels)],
      ["bit depth", String(state.waveform.bitsPerSample), manifestNumberText(wav.bitDepth)],
      ["frames", String(state.waveform.frames), manifestNumberText(wav.frames)],
      ["data bytes", formatBytes(state.waveform.dataBytes), manifestBytesText(wav.dataBytes)],
      ["file bytes", formatBytes(state.waveform.fileBytes), manifestBytesText(wav.fileBytes)],
      ["peak", formatCompactNumber(stats.peak)],
      ["rms", formatCompactNumber(stats.rms)],
      ["min", formatCompactNumber(stats.min)],
      ["max", formatCompactNumber(stats.max)],
      ["dc offset", formatCompactNumber(stats.dcOffset)],
    ]);
    status.textContent = "Drawn";
    status.className = "pill good";
    renderWaveformPosition();
    renderFollowAudioControl();
  } catch (error) {
    state.waveform = null;
    resetWaveformTransientState();
    state.playheadFrame = 0;
    canvas.dataset.waveformSource = "unavailable";
    canvas.dataset.waveformSampleRate = "unavailable";
    canvas.dataset.waveformChannels = "unavailable";
    canvas.dataset.waveformBitDepth = "unavailable";
    canvas.dataset.waveformFrames = "unavailable";
    canvas.dataset.waveformDataBytes = "unavailable";
    canvas.dataset.waveformFileBytes = "unavailable";
    canvas.dataset.waveformPeak = "unavailable";
    canvas.dataset.waveformRms = "unavailable";
    canvas.title = "Primary WAV waveform unavailable";
    renderUnavailableWaveformMeta();
    renderWaveformPhaseControls();
    renderLevelEnvelope();
    renderPhaseAudioStats();
    renderSignalPlot();
    renderHandsOnReadiness(state.response?.manifest, false);
    status.textContent = "Check";
    status.className = "pill warn";
    renderWaveformPosition();
    renderFollowAudioControl();
    console.error(error);
  }
}

function renderUnavailableWaveformMeta() {
  renderKeyValue(document.getElementById("waveformMeta"), [
    ["sample rate", "unavailable", "present"],
    ["channels", "unavailable", "present"],
    ["bit depth", "unavailable", "present"],
    ["frames", "unavailable", "present"],
    ["data bytes", "unavailable", "present"],
    ["source", "manifest/audio required", "decoded primary WAV"],
  ]);
}

function renderWaveformPosition() {
  const position = document.getElementById("waveformPosition");
  const sample = document.getElementById("waveformSample");
  const phase = document.getElementById("waveformPhase");
  const phaseRange = document.getElementById("waveformPhaseRange");
  const phaseJumpTarget = document.getElementById("waveformPhaseJumpTarget");
  const scrubber = document.getElementById("waveformScrubber");
  const waveform = state.waveform;
  if (!waveform) {
    labelWaveformHeaderPill(position, "waveform position", "0.000s / unknown", false);
    labelWaveformHeaderPill(sample, "waveform sample", "frame 0 / unknown / sample 0", false);
    resetIdleProbePill("waveformProbe", "Waveform probe idle");
    labelWaveformHeaderPill(phase, "waveform phase", "phase", false);
    labelWaveformHeaderPill(phaseRange, "waveform phase range", "range", false);
    phaseJumpTarget.textContent = "jump idle";
    scrubber.value = "0";
    updateWaveformScrubberLabel(scrubber, null, null);
    renderCurrentParameters(null);
    updateParameterTimelinePlayhead(null);
    updatePhaseAudioStatsActive(null);
    updateActivePhaseButtons(null);
    renderInspectionCursor();
    renderParameterTimelineProbe();
    renderPhaseAudioStatsProbe();
    return;
  }

  const activeRegion = activeWaveformRegion();
  const sampleFrame = Math.max(
    0,
    Math.min(waveform.samples.length - 1, state.playheadFrame),
  );
  const sampleValue = waveform.samples[sampleFrame] || 0;
  const positionText = `${formatSeconds(
    state.playheadFrame / waveform.sampleRate,
  )} / ${formatAudioDuration(waveform.frames / waveform.sampleRate)}`;
  const sampleText = `frame ${state.playheadFrame} / ${waveform.frames} / sample ${formatCompactNumber(
    sampleValue,
  )}`;
  const phaseText = activeRegion ? activeRegion.name : "phase";
  const phaseRangeText = formatRegionRange(activeRegion, waveform.sampleRate);
  labelWaveformHeaderPill(position, "waveform position", positionText, true);
  labelWaveformHeaderPill(sample, "waveform sample", sampleText, true);
  labelWaveformHeaderPill(phase, "waveform phase", phaseText, Boolean(activeRegion));
  labelWaveformHeaderPill(
    phaseRange,
    "waveform phase range",
    phaseRangeText,
    Boolean(activeRegion),
  );
  renderCurrentParameters(activeRegion);
  updateParameterTimelinePlayhead(activeRegion);
  updatePhaseAudioStatsActive(activeRegion);
  scrubber.value = String(
    waveform.frames > 0 ? state.playheadFrame / waveform.frames : 0,
  );
  updateWaveformScrubberLabel(scrubber, waveform, activeRegion);
  updateActivePhaseButtons(activeRegion);
  renderWaveformProbe();
}

function updateWaveformScrubberLabel(scrubber, waveform, activeRegion) {
  const followText = state.followAudio ? "follow" : "free";
  const followTitle = state.followAudio ? "Follow Audio" : "Free View";
  if (!waveform) {
    scrubber.setAttribute("aria-valuetext", `0.000s / unknown / phase unknown / ${followText}`);
    scrubber.dataset.followMode = followText;
    scrubber.title = `Waveform position 0.000s / unknown / phase unknown / ${followTitle}`;
    return;
  }

  const timeText = formatSeconds(state.playheadFrame / waveform.sampleRate);
  const durationText = formatAudioDuration(waveform.frames / waveform.sampleRate);
  const phaseText = activeRegion?.name || "phase unknown";
  scrubber.setAttribute(
    "aria-valuetext",
    `${timeText} / ${durationText} / frame ${state.playheadFrame} / ${phaseText} / ${followText}`,
  );
  scrubber.dataset.followMode = followText;
  scrubber.title = `Waveform position ${timeText} / frame ${state.playheadFrame} / ${phaseText} / ${followTitle}`;
}

function renderWaveformProbe() {
  const probe = document.getElementById("waveformProbe");
  const waveform = state.waveform;
  if (!waveform || state.waveformProbeFrame === null) {
    resetIdleProbePill("waveformProbe", "Waveform probe idle");
    renderInspectionCursor();
    renderParameterTimelineProbe();
    renderPhaseAudioStatsProbe();
    renderPhaseProbe();
    return;
  }

  const frame = clampFrame(state.waveformProbeFrame, waveform);
  const sampleFrame = Math.max(0, Math.min(waveform.samples.length - 1, frame));
  const sampleValue = waveform.samples[sampleFrame] || 0;
  const region = waveformRegionAtFrame(frame);
  const source = currentProbeSource();
  probe.textContent = `${probeSourceText()} ${formatSeconds(
    frame / waveform.sampleRate,
  )} / frame ${frame} / ${formatCompactNumber(sampleValue)} / ${
    region?.name || "phase"
  }`;
  setProbePillMetadata(
    probe,
    source,
    frame,
    `Waveform probe ${source} / ${formatSeconds(
      frame / waveform.sampleRate,
    )} / frame ${frame} / ${region?.name || "phase"}`,
  );
  renderInspectionCursor();
  renderParameterTimelineProbe();
  renderPhaseAudioStatsProbe();
  renderPhaseProbe();
}

function renderInspectionCursor() {
  const status = document.getElementById("inspectionCursorStatus");
  const cursor = document.getElementById("inspectionCursor");
  const waveform = state.waveform;
  if (!waveform) {
    setStatus("inspectionCursorStatus", "Check", false);
    setInspectionCursorSource(inspectionModes.none, inspectionModes.none);
    setInspectionCursorDelta(null, 1);
    setInspectionCursorPreview(false);
    setInspectionCursorSeek(null);
    setInspectionCursorSeekTarget(null, null, 1);
    setInspectionCursorSeekSync("none");
    setInspectionCursorTransport(null, null, 1);
    setInspectionCursorTarget(null, null, 1);
    setInspectionCursorDivergence(null, null);
    renderKeyValue(cursor, [
      ["transport frame", "0"],
      ["transport time", "0.000s"],
      ["transport phase", "phase"],
      ["last seek source", "none"],
      ["last seek mode", "none"],
      ["last seek frame", "none"],
      ["last seek time", "none"],
      ["last seek phase", "none"],
      ["last seek transport match", "none"],
      ["last seek transport delta", "none"],
      ["last seek hover match", "none"],
      ["last seek hover delta", "none"],
      ["hover source", "none"],
      ["hover frame", "none"],
      ["hover signal", "none"],
    ]);
    labelInspectionCursorSurface(cursor, "unavailable", "check");
    return;
  }

  const transportFrame = clampFrame(state.playheadFrame, waveform);
  const transportSample =
    waveform.samples[Math.max(0, Math.min(waveform.samples.length - 1, transportFrame))] || 0;
  const transportRegion = waveformRegionAtFrame(transportFrame);
  const hoverFrame =
    state.waveformProbeFrame ??
    state.signalPlotProbe?.nearest?.frame ??
    null;
  const hoverRegion = hoverFrame !== null ? waveformRegionAtFrame(hoverFrame) : null;
  const hoverSample =
    hoverFrame !== null
      ? waveform.samples[Math.max(0, Math.min(waveform.samples.length - 1, hoverFrame))] || 0
      : null;
  const hoverSignal = hoverFrame !== null ? signalPlotProbeAtFrame(hoverFrame) : null;
  const hoverEnvelope = hoverFrame !== null ? levelEnvelopeWindowAtFrame(hoverFrame) : null;
  const hoverFrequency = activeParameterValue("frequency", hoverRegion);
  const hoverAmplitude = activeParameterValue("amplitude", hoverRegion);
  const hoverSource =
    hoverFrame === null
      ? inspectionModes.transport
      : state.waveformProbeSource || inspectionModes.probe;
  const hoverDeltaFrame = hoverFrame === null ? null : hoverFrame - transportFrame;
  const lastSeekFrame =
    state.lastSeekFrame === null ? null : clampFrame(state.lastSeekFrame, waveform);
  const lastSeekRegion =
    lastSeekFrame === null ? null : waveformRegionAtFrame(lastSeekFrame);
  const lastSeekTransportDeltaFrame =
    lastSeekFrame === null ? null : transportFrame - lastSeekFrame;
  const lastSeekTransportMatch =
    lastSeekTransportDeltaFrame === null
      ? "none"
      : lastSeekTransportDeltaFrame === 0
        ? "aligned"
        : "diverged";
  const lastSeekHoverDeltaFrame =
    lastSeekFrame === null || hoverFrame === null ? null : hoverFrame - lastSeekFrame;
  const lastSeekHoverMatch =
    lastSeekHoverDeltaFrame === null
      ? "none"
      : lastSeekHoverDeltaFrame === 0
        ? "aligned"
        : "diverged";

  setStatus("inspectionCursorStatus", hoverFrame === null ? "Transport" : "Hover", true);
  setInspectionCursorSource(
    hoverSource,
    hoverFrame === null ? inspectionModes.transport : inspectionModes.hover,
  );
  setInspectionCursorDelta(hoverDeltaFrame, waveform.sampleRate);
  setInspectionCursorPreview(hoverFrame !== null);
  setInspectionCursorSeek(state.lastSeekSource);
  setInspectionCursorSeekTarget(lastSeekRegion, lastSeekFrame, waveform.sampleRate);
  setInspectionCursorSeekSync(lastSeekTransportMatch);
  setInspectionCursorTransport(transportRegion, transportFrame, waveform.sampleRate);
  setInspectionCursorTarget(hoverRegion, hoverFrame, waveform.sampleRate);
  setInspectionCursorDivergence(transportRegion, hoverRegion);
  renderKeyValue(cursor, [
    ["transport frame", String(transportFrame)],
    ["transport time", formatSeconds(transportFrame / waveform.sampleRate)],
    ["transport phase", transportRegion?.name || "phase"],
    ["transport sample", formatCompactNumber(transportSample)],
    ["last seek source", state.lastSeekSource || "none"],
    [
      "last seek mode",
      state.lastSeekFollowAudio === null
        ? "none"
        : state.lastSeekFollowAudio
          ? "follow audio"
          : "free view",
    ],
    ["last seek frame", lastSeekFrame === null ? "none" : String(lastSeekFrame)],
    [
      "last seek time",
      lastSeekFrame === null ? "none" : formatSeconds(lastSeekFrame / waveform.sampleRate),
    ],
    ["last seek phase", lastSeekRegion?.name || "none"],
    ["last seek transport match", lastSeekTransportMatch],
    [
      "last seek transport delta",
      formatInspectionDelta(lastSeekTransportDeltaFrame, waveform.sampleRate),
    ],
    ["last seek hover match", lastSeekHoverMatch],
    [
      "last seek hover delta",
      formatInspectionDelta(lastSeekHoverDeltaFrame, waveform.sampleRate),
    ],
    ["hover source", hoverFrame === null ? "none" : hoverSource],
    ["hover frame", hoverFrame === null ? "none" : String(hoverFrame)],
    [
      "hover time",
      hoverFrame === null ? "none" : formatSeconds(hoverFrame / waveform.sampleRate),
    ],
    [
      "hover delta",
      formatInspectionDelta(hoverDeltaFrame, waveform.sampleRate),
    ],
    ["hover phase", hoverRegion?.name || "none"],
    ["hover sample", hoverSample === null ? "none" : formatCompactNumber(hoverSample)],
    [
      "hover frequency",
      hoverFrequency === null ? "none" : `${formatCompactNumber(hoverFrequency)} Hz`,
    ],
    [
      "hover amplitude",
      hoverAmplitude === null ? "none" : formatCompactNumber(hoverAmplitude),
    ],
    [
      "hover envelope peak",
      hoverEnvelope ? formatCompactNumber(hoverEnvelope.peak) : "none",
    ],
    [
      "hover envelope rms",
      hoverEnvelope ? formatCompactNumber(hoverEnvelope.rms) : "none",
    ],
    [
      "hover signal",
      hoverSignal
        ? `x ${formatCompactNumber(hoverSignal.x)} / y ${formatCompactNumber(hoverSignal.y)}`
        : "none",
    ],
  ]);
  labelInspectionCursorSurface(
    cursor,
    hoverFrame === null ? "transport inspection" : "hover inspection",
    "ok",
  );
}

function renderAudioPosition() {
  const audio = document.getElementById("audioPlayer");
  const position = document.getElementById("audioPosition");
  const time = Number(audio.currentTime);
  const duration = Number(audio.duration);
  const positionText = `audio ${formatSeconds(Number.isFinite(time) ? time : 0)} / ${formatAudioDuration(duration)}`;
  labelWaveformHeaderPill(
    position,
    "primary audio position",
    positionText,
    Boolean(audio.getAttribute("src")),
  );
  setInspectionCursorAudio(time, duration);
  setInspectionCursorPlayback(audio);
  renderWaveformPlayControl(audio);
}

function renderWaveformPlayControl(audio = document.getElementById("audioPlayer")) {
  const button = document.getElementById("waveformPlayButton");
  const ready = Boolean(audio?.getAttribute("src"));
  const playing = ready && !audio.paused && !audio.ended;
  const ended = ready && audio.ended;
  const value = playing ? "Pause Audio" : ended ? "Replay Audio" : "Play Audio";
  const actionValue = playing
    ? "Pause primary audio"
    : ended
      ? "Replay primary audio from start"
      : "Play primary audio";
  const stateName = !ready ? "disabled" : playing ? "playing" : ended ? "ended" : "idle";
  button.disabled = !ready;
  button.textContent = value;
  button.setAttribute("aria-pressed", String(playing));
  button.classList.toggle("active", playing);
  labelWaveformControlButton(button, "waveform playback", actionValue, stateName);
}

async function togglePrimaryAudioPlayback() {
  const audio = document.getElementById("audioPlayer");
  if (!audio.getAttribute("src")) {
    renderWaveformPlayControl(audio);
    return;
  }

  try {
    if (audio.paused || audio.ended) {
      if (audio.ended) {
        audio.currentTime = 0;
        if (state.followAudio && state.waveform) {
          setPlayheadFrame(0);
        }
      }
      await audio.play();
    } else {
      audio.pause();
    }
  } catch (error) {
    console.error(error);
  }

  renderAudioPosition();
}

function setFollowAudio(enabled, syncNow) {
  state.followAudio = enabled;
  renderFollowAudioControl();
  if (enabled && syncNow) {
    syncWaveformToAudio();
  } else {
    renderWaveformPosition();
  }
}

function renderFollowAudioControl() {
  const button = document.getElementById("followAudioButton");
  const value = state.followAudio ? "Follow Audio" : "Free View";
  const actionValue = state.followAudio
    ? "Waveform view follows primary audio"
    : "Waveform view is independent of primary audio";
  const stateName = state.followAudio ? "follow" : "free";
  button.textContent = value;
  button.setAttribute("aria-pressed", String(state.followAudio));
  button.classList.toggle("active", state.followAudio);
  labelWaveformControlButton(button, "waveform view mode", actionValue, stateName);
  setInspectionCursorView(state.followAudio);
}

function updateActivePhaseButtons(activeRegion) {
  for (const button of document.querySelectorAll("#waveformPhaseControls button")) {
    button.classList.toggle("active", button.textContent === activeRegion?.name);
    button.classList.toggle(
      "preview",
      button.dataset.phaseIndex === String(state.phaseJumpPreviewIndex),
    );
  }
  renderPhaseJumpTarget();
}

function syncWaveformToAudio() {
  const audio = document.getElementById("audioPlayer");
  renderAudioPosition();
  if (
    !state.followAudio ||
    !state.waveform ||
    state.scrubberPointerActive ||
    Number.isNaN(audio.currentTime)
  ) {
    return;
  }

  setPlayheadFrame(Math.round(audio.currentTime * state.waveform.sampleRate));
}

function syncWaveformToAudioEnd() {
  const audio = document.getElementById("audioPlayer");
  renderAudioPosition();
  if (!state.followAudio || !state.waveform || Number.isNaN(audio.duration)) {
    return;
  }

  setPlayheadFrame(state.waveform.frames);
}

function seekPrimaryAudioToFrame(frame, source = inspectionSources.waveform) {
  const waveform = state.waveform;
  if (!waveform) {
    return;
  }

  const targetFrame = clampFrame(frame, waveform);
  state.lastSeekSource = source;
  state.lastSeekFrame = targetFrame;
  state.lastSeekFollowAudio = state.followAudio;
  if (state.followAudio) {
    const audio = document.getElementById("audioPlayer");
    const targetTime = targetFrame / waveform.sampleRate;
    if (Number.isFinite(targetTime)) {
      audio.currentTime = targetTime;
      renderAudioPosition();
    }
  }

  setPlayheadFrame(targetFrame);
}

function seekWaveformAtClientX(clientX) {
  const waveform = state.waveform;
  if (!waveform) {
    return;
  }

  seekPrimaryAudioToFrame(waveformFrameAtClientX(clientX), inspectionSources.waveform);
}

function waveformFrameAtClientX(clientX) {
  return waveformFrameAtClientXForCanvas(clientX, "waveformCanvas");
}

function waveformFrameAtClientXForCanvas(clientX, canvasId) {
  const waveform = state.waveform;
  if (!waveform) {
    return 0;
  }

  const canvas = document.getElementById(canvasId);
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  return clampFrame(Math.round(ratio * waveform.frames), waveform);
}

function probeWaveformAtClientX(clientX) {
  if (!state.waveform) {
    return;
  }

  state.waveformProbeFrame = waveformFrameAtClientX(clientX);
  state.waveformProbeSource = inspectionSources.waveform;
  state.signalPlotProbe = signalPlotProbeAtFrame(state.waveformProbeFrame);
  renderWaveformProbe();
  drawSignalPlot();
  renderSignalPlotProbe();
  drawLevelEnvelope();
}

function probeLevelEnvelopeAtClientX(clientX) {
  if (!state.waveform) {
    return;
  }

  state.waveformProbeFrame = waveformFrameAtClientXForCanvas(clientX, "levelEnvelopeCanvas");
  state.waveformProbeSource = inspectionSources.levelEnvelope;
  state.signalPlotProbe = signalPlotProbeAtFrame(state.waveformProbeFrame);
  renderWaveformProbe();
  drawWaveform();
  drawLevelEnvelope();
  drawSignalPlot();
  renderSignalPlotProbe();
  renderLevelEnvelopeProbe();
}

function seekWaveform(event) {
  probeWaveformAtClientX(event.clientX);
  seekWaveformAtClientX(event.clientX);
}

function beginWaveformDrag(event) {
  state.waveformPointerActive = true;
  event.currentTarget.classList.add("dragging");
  event.currentTarget.setPointerCapture(event.pointerId);
  probeWaveformAtClientX(event.clientX);
  seekWaveformAtClientX(event.clientX);
}

function dragWaveform(event) {
  probeWaveformAtClientX(event.clientX);
  if (!state.waveformPointerActive) {
    return;
  }

  seekWaveformAtClientX(event.clientX);
}

function endWaveformDrag(event) {
  state.waveformPointerActive = false;
  event.currentTarget.classList.remove("dragging");
  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
}

function clearWaveformProbe() {
  if (state.waveformPointerActive) {
    return;
  }

  resetSharedProbeState();
  renderWaveformProbe();
  drawSignalPlot();
  renderSignalPlotProbe();
  drawLevelEnvelope();
  renderLevelEnvelopeProbe();
}

function clearLevelEnvelopeProbe() {
  if (state.waveformPointerActive) {
    return;
  }

  resetSharedProbeState();
  renderWaveformProbe();
  renderLevelEnvelopeProbe();
  drawWaveform();
  drawLevelEnvelope();
  drawSignalPlot();
  renderSignalPlotProbe();
}

function scrubWaveform(event) {
  const waveform = state.waveform;
  if (!waveform) {
    return;
  }

  const ratio = Number(event.currentTarget.value);
  seekPrimaryAudioToFrame(Math.round(ratio * waveform.frames), inspectionSources.scrubber);
}

function beginScrubberDrag(event) {
  state.scrubberPointerActive = true;
  event.currentTarget.setPointerCapture(event.pointerId);
}

function endScrubberDrag(event) {
  state.scrubberPointerActive = false;
  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
}

function toggleFollowAudio() {
  setFollowAudio(!state.followAudio, true);
}

function hasArtifactKind(links, kind) {
  return links.some((link) => link.kind === kind && Boolean(link.path));
}

function findArtifactPath(links, kind) {
  const link = links.find((item) => item.kind === kind && Boolean(item.path));
  return link ? link.path : "";
}

function countArtifactKind(links, kind) {
  return links.filter((link) => link.kind === kind && Boolean(link.path)).length;
}

function parseSummaryText(text) {
  const pairs = new Map();
  for (const line of text.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 0) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key) {
      pairs.set(key, value);
    }
  }

  return pairs;
}

function reportLinks(links) {
  return links.filter((link) =>
    ["manifest", "text-summary", "wav-report", "phase-report"].includes(
      link.kind,
    ),
  );
}

function setActiveReport(index) {
  state.activeReportIndex = index;
  renderReportControls();
  renderActiveReport();
}

function renderReportControls() {
  const container = document.getElementById("reportControls");
  container.replaceChildren();

  for (const [index, report] of state.reports.entries()) {
    const button = document.createElement("button");
    const active = index === state.activeReportIndex;
    const label = `Show report ${report.label}`;
    button.type = "button";
    button.className = "report-button";
    button.classList.toggle("active", active);
    button.dataset.reportIndex = String(index);
    button.dataset.reportKind = report.kind;
    button.dataset.reportPath = report.path || "";
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(active));
    button.title = label;
    button.textContent = report.label;
    button.addEventListener("click", () => setActiveReport(index));
    container.append(button);
  }
}

function renderActiveReport() {
  const viewer = document.getElementById("reportViewer");
  const report = state.reports[state.activeReportIndex];
  if (!report) {
    viewer.textContent = "";
    viewer.dataset.reportLabel = "none";
    viewer.dataset.reportKind = "none";
    viewer.dataset.reportPath = "";
    viewer.dataset.reportState = "unavailable";
    viewer.setAttribute("role", "region");
    viewer.setAttribute("aria-label", "Report viewer unavailable");
    viewer.title = "Report viewer unavailable";
    return;
  }

  const stateName = report.ok ? "ok" : "check";
  viewer.dataset.reportLabel = report.label || "";
  viewer.dataset.reportKind = report.kind || "";
  viewer.dataset.reportPath = report.path || "";
  viewer.dataset.reportState = stateName;
  viewer.setAttribute("role", "region");
  viewer.setAttribute("aria-label", `Report viewer ${report.label}: ${stateName}`);
  viewer.title = `Report viewer ${report.label} / ${report.kind} / ${
    report.path || "missing"
  } / ${stateName}`;
  viewer.textContent = report.ok
    ? report.text
    : `${report.label}\n${report.error || "Report unavailable"}`;
}

async function renderReports(links) {
  const status = document.getElementById("reportStatus");
  const linksToLoad = reportLinks(links);
  status.textContent = "Loading";
  status.className = "pill";
  state.reports = [];
  state.activeReportIndex = 0;
  renderReportControls();
  renderActiveReport();

  if (linksToLoad.length === 0) {
    status.textContent = "Check";
    status.className = "pill warn";
    return;
  }

  state.reports = await Promise.all(
    linksToLoad.map(async (link) => {
      try {
        const response = await fetch(artifactUrl(link.path), {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Report fetch failed: ${response.status}`);
        }

        const text = await response.text();
        return {
          kind: link.kind,
          label: link.label || link.kind,
          ok: true,
          path: link.path,
          text: link.kind === "manifest" ? formatJsonDocument(text) : text,
        };
      } catch (error) {
        return {
          kind: link.kind,
          label: link.label || link.kind,
          ok: false,
          path: link.path,
          error: error instanceof Error ? error.message : String(error),
          text: "",
        };
      }
    }),
  );

  const ok = state.reports.every((report) => report.ok);
  status.textContent = ok
    ? `${state.reports.length} Loaded`
    : `${state.reports.filter((report) => report.ok).length}/${
        state.reports.length
      } Loaded`;
  status.className = ok ? "pill good" : "pill warn";
  renderReportControls();
  renderActiveReport();
  renderHandsOnReadiness(state.response?.manifest, Boolean(state.waveform));
}

function formatJsonDocument(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch (_error) {
    return text;
  }
}

function renderParameterSummaryCards(pairs) {
  const container = document.getElementById("parameterSummary");
  container.replaceChildren();

  const firstFrequency = parseSummaryNumber(pairs.get("first half frequency"));
  const firstAmplitude = parseSummaryNumber(pairs.get("first half amplitude"));
  const firstBias = parseSummaryNumber(pairs.get("first half bias"));
  const secondFrequency = parseSummaryNumber(pairs.get("second half frequency"));
  const secondAmplitude = parseSummaryNumber(pairs.get("second half amplitude"));
  const secondBias = parseSummaryNumber(pairs.get("second half bias"));
  const hasBias = pairs.has("first half bias") || pairs.has("second half bias");
  const values = [
    [
      "First Frequency",
      pairs.get("first half frequency"),
      "",
      isPositiveNumber(firstFrequency),
    ],
    [
      "First Amplitude",
      pairs.get("first half amplitude"),
      "",
      isPositiveNumber(firstAmplitude),
    ],
    [
      "Second Frequency",
      pairs.get("second half frequency"),
      "",
      isPositiveNumber(secondFrequency),
    ],
    [
      "Second Amplitude",
      pairs.get("second half amplitude"),
      "",
      isPositiveNumber(secondAmplitude),
    ],
    ...(hasBias
      ? [
          [
            "First Bias",
            pairs.get("first half bias"),
            "",
            Number.isFinite(firstBias),
          ],
          [
            "Second Bias",
            pairs.get("second half bias"),
            "",
            Number.isFinite(secondBias),
          ],
        ]
      : []),
    [
      "Frequency Change",
      formatSummaryChange(firstFrequency, secondFrequency),
      "comparison",
      isUpwardChange(firstFrequency, secondFrequency),
    ],
    [
      "Amplitude Change",
      formatSummaryChange(firstAmplitude, secondAmplitude),
      "comparison",
      isUpwardChange(firstAmplitude, secondAmplitude),
    ],
    ...(hasBias
      ? [
          [
            "Bias Change",
            formatSummaryChange(firstBias, secondBias),
            "comparison",
            Number.isFinite(firstBias) && Number.isFinite(secondBias) && firstBias !== secondBias,
          ],
        ]
      : []),
  ];

  for (const [label, value, kind, ok] of values) {
    const valueText = value || "missing";
    const stateName = ok === true ? "ok" : "check";
    const item = document.createElement("div");
    item.className = "summary-card";
    if (kind === "comparison") {
      item.classList.add("comparison");
    }
    item.dataset.summaryLabel = label;
    item.dataset.summaryValue = valueText;
    item.dataset.summaryKind = kind || "value";
    item.dataset.summaryState = stateName;
    item.setAttribute("role", "group");
    item.setAttribute("aria-label", `${label}: ${valueText}`);
    item.title = `${label}: ${valueText} / ${stateName}`;

    const title = document.createElement("span");
    title.textContent = label.toUpperCase();

    const body = document.createElement("strong");
    body.textContent = valueText;
    if (!value || ok !== true) {
      body.className = "warn";
    }

    item.append(title, body);
    container.append(item);
  }
}

function renderUnavailableParameterSummary() {
  renderParameterSummaryCards(
    new Map([
      ["first half frequency", "unavailable"],
      ["first half amplitude", "unavailable"],
      ["second half frequency", "unavailable"],
      ["second half amplitude", "unavailable"],
    ]),
  );
}

function parameterTimelineRows(manifest) {
  const resync = manifest?.parameterResync || {};
  return Object.entries(resync)
    .filter(([_name, values]) => values && typeof values === "object")
    .map(([name, values]) => [name, values]);
}

function updateParameterTimelinePlayhead(region) {
  const timeline = document.getElementById("parameterTimeline");
  const phase = document.getElementById("parameterTimelinePhase");
  const marker = document.getElementById("parameterTimelinePlayhead");
  const waveform = state.waveform;

  const frequency = activeParameterValue("frequency", region);
  const amplitude = activeParameterValue("amplitude", region);
  phase.textContent = region
    ? `phase ${region.name} / freq ${
        frequency === null ? "missing" : `${formatCompactNumber(frequency)} Hz`
      } / amp ${amplitude === null ? "missing" : formatCompactNumber(amplitude)}`
    : "phase";
  for (const segment of timeline.querySelectorAll(".parameter-segment")) {
    segment.classList.toggle("active", segment.dataset.phaseName === region?.name);
  }

  if (!marker || !waveform || waveform.frames <= 0) {
    return;
  }

  const labelWidth = timeline.querySelector(".parameter-track-label")?.offsetWidth || 0;
  const trackGap = 12;
  const timelinePadding = 12;
  const railLeft = timelinePadding + labelWidth + trackGap;
  const railWidth = Math.max(1, timeline.clientWidth - railLeft - timelinePadding);
  const ratio = Math.max(0, Math.min(1, state.playheadFrame / waveform.frames));
  marker.style.left = `${railLeft + ratio * railWidth}px`;
}

function updateParameterTimelinePreview(region) {
  for (const segment of document.querySelectorAll(".parameter-segment")) {
    segment.classList.toggle("preview", segment.dataset.phaseName === region?.name);
  }
}

function updateParameterTimelineProbeMarker() {
  const timeline = document.getElementById("parameterTimeline");
  const marker = document.getElementById("parameterTimelineProbeMarker");
  const waveform = state.waveform;
  if (!marker) {
    return;
  }

  if (!waveform || waveform.frames <= 0 || state.waveformProbeFrame === null) {
    marker.hidden = true;
    return;
  }

  const labelWidth = timeline.querySelector(".parameter-track-label")?.offsetWidth || 0;
  const trackGap = 12;
  const timelinePadding = 12;
  const railLeft = timelinePadding + labelWidth + trackGap;
  const railWidth = Math.max(1, timeline.clientWidth - railLeft - timelinePadding);
  const ratio = Math.max(
    0,
    Math.min(1, clampFrame(state.waveformProbeFrame, waveform) / waveform.frames),
  );
  marker.hidden = false;
  marker.style.left = `${railLeft + ratio * railWidth}px`;
}

function renderParameterTimelineProbe() {
  const probe = document.getElementById("parameterTimelineProbe");
  const waveform = state.waveform;
  if (!waveform || state.waveformProbeFrame === null) {
    resetIdleProbePill("parameterTimelineProbe", "Parameter timeline probe idle");
    updateParameterTimelinePreview(null);
    updateParameterTimelineProbeMarker();
    return;
  }

  const frame = clampFrame(state.waveformProbeFrame, waveform);
  const region = waveformRegionAtFrame(frame);
  const frequency = activeParameterValue("frequency", region);
  const amplitude = activeParameterValue("amplitude", region);
  const source = currentProbeSource();
  const frequencyText = frequency === null ? "missing" : `${formatCompactNumber(frequency)} Hz`;
  const amplitudeText = amplitude === null ? "missing" : formatCompactNumber(amplitude);
  probe.textContent = `${probeSourceText()} ${formatProbeFrame(frame, waveform, region)} / freq ${
    frequencyText
  } / amp ${amplitudeText}`;
  setProbePillMetadata(
    probe,
    source,
    frame,
    `Parameter timeline probe ${source} / ${formatProbeFrame(
      frame,
      waveform,
      region,
    )} / freq ${frequencyText} / amp ${amplitudeText}`,
  );
  updateParameterTimelinePreview(region);
  updateParameterTimelineProbeMarker();
}

function probeParameterTimelineSegment(event) {
  const waveform = state.waveform;
  if (!waveform) {
    return;
  }

  const startFrame = Number(event.currentTarget.dataset.startFrame);
  const endFrame = Number(event.currentTarget.dataset.endFrame);
  if (!Number.isFinite(startFrame) || !Number.isFinite(endFrame) || endFrame <= startFrame) {
    return;
  }

  const rect = event.currentTarget.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  state.waveformProbeFrame = clampFrame(Math.round(startFrame + (endFrame - startFrame) * ratio), waveform);
  state.waveformProbeSource = inspectionSources.parameterTimeline;
  state.signalPlotProbe = signalPlotProbeAtFrame(state.waveformProbeFrame);
  renderWaveformProbe();
  renderLevelEnvelopeProbe();
  renderParameterTimelineProbe();
  drawWaveform();
  drawLevelEnvelope();
  drawSignalPlot();
  renderSignalPlotProbe();
}

function clearParameterTimelineProbe() {
  if (state.waveformPointerActive) {
    return;
  }

  resetSharedProbeState();
  renderWaveformProbe();
  renderLevelEnvelopeProbe();
  renderParameterTimelineProbe();
  drawWaveform();
  drawLevelEnvelope();
  drawSignalPlot();
  renderSignalPlotProbe();
}

function renderParameterTimeline(manifest) {
  const timeline = document.getElementById("parameterTimeline");
  const status = document.getElementById("parameterTimelineStatus");
  timeline.replaceChildren();

  const phases = manifest?.phases || [];
  const totalFrames = Number(manifest?.wav?.frames || 0);
  const spans = buildPhaseSpans(phases, totalFrames);
  const rows = parameterTimelineRows(manifest);
  if (!phases.length || totalFrames <= 0 || !rows.length) {
    status.textContent = "Check";
    status.className = "pill warn";
    updateParameterTimelinePlayhead(null);
    return;
  }

  for (const [name, values] of rows) {
    const track = document.createElement("div");
    track.className = "parameter-track";

    const label = document.createElement("div");
    label.className = "parameter-track-label";
    label.textContent = name;

    const rail = document.createElement("div");
    rail.className = "parameter-track-rail";

    for (const [index, phase] of phases.entries()) {
      const frames = Number(phase.samplesProcessed || 0);
      const span = spans[index] || { startFrame: 0, endFrame: frames };
      const valueText = manifestValueText(values[phase.name]) || "missing";
      const startTime = formatSeconds(span.startFrame / manifest.wav.sampleRate);
      const endTime = formatSeconds(span.endFrame / manifest.wav.sampleRate);
      const segmentLabel =
        `Parameter ${name} ${phase.name || "phase"} value ${valueText} ` +
        `from frame ${span.startFrame} to ${span.endFrame}`;
      const segment = document.createElement("div");
      segment.className = "parameter-segment";
      segment.dataset.phaseName = phase.name || "";
      segment.dataset.parameterName = name;
      segment.dataset.parameterValue = valueText;
      segment.dataset.startFrame = String(span.startFrame);
      segment.dataset.endFrame = String(span.endFrame);
      segment.dataset.startTime = startTime;
      segment.dataset.endTime = endTime;
      segment.setAttribute("aria-label", segmentLabel);
      segment.setAttribute("role", "group");
      segment.title = `${segmentLabel} / ${startTime} to ${endTime}`;
      segment.style.flexBasis = `${Math.max(1, (frames / totalFrames) * 100)}%`;
      segment.addEventListener("pointermove", probeParameterTimelineSegment);
      segment.addEventListener("pointerleave", clearParameterTimelineProbe);

      const phaseLabel = document.createElement("span");
      phaseLabel.textContent = phase.name || "phase";

      const value = document.createElement("strong");
      value.textContent = valueText;

      segment.append(phaseLabel, value);
      rail.append(segment);
    }

    track.append(label, rail);
    timeline.append(track);
  }

  const marker = document.createElement("div");
  marker.id = "parameterTimelinePlayhead";
  marker.className = "parameter-timeline-marker";
  timeline.append(marker);
  const probeMarker = document.createElement("div");
  probeMarker.id = "parameterTimelineProbeMarker";
  probeMarker.className = "parameter-timeline-marker probe";
  probeMarker.hidden = true;
  timeline.append(probeMarker);
  status.textContent = `${rows.length} params`;
  status.className = "pill good";
  updateParameterTimelinePlayhead(activeWaveformRegion());
  renderParameterTimelineProbe();
}

function renderUnavailableParameterTimeline() {
  const timeline = document.getElementById("parameterTimeline");
  timeline.replaceChildren();

  const track = document.createElement("div");
  track.className = "parameter-track";

  const label = document.createElement("div");
  label.className = "parameter-track-label";
  label.textContent = "resync";

  const rail = document.createElement("div");
  rail.className = "parameter-track-rail";

  const segment = document.createElement("div");
  segment.className = "parameter-segment warn-row";
  segment.dataset.phaseName = "unavailable";
  segment.dataset.parameterName = "resync";
  segment.dataset.parameterValue = "manifest required";
  segment.dataset.startFrame = "none";
  segment.dataset.endFrame = "none";
  segment.dataset.startTime = "unavailable";
  segment.dataset.endTime = "unavailable";
  segment.setAttribute("aria-label", "Parameter resync unavailable: manifest required");
  segment.setAttribute("role", "group");
  segment.title = "Parameter resync unavailable: manifest required";

  const phase = document.createElement("span");
  phase.textContent = "unavailable";

  const value = document.createElement("strong");
  value.textContent = "manifest required";

  segment.append(phase, value);
  rail.append(segment);
  track.append(label, rail);
  timeline.append(track);
}

function parameterResyncPairs(manifest) {
  const resync = manifest?.parameterResync || {};
  const frequency = resync.frequency || {};
  const amplitude = resync.amplitude || {};
  const bias = resync.bias || {};
  const pairs = new Map([
    ["first half frequency", manifestValueText(frequency.first)],
    ["first half amplitude", manifestValueText(amplitude.first)],
    ["second half frequency", manifestValueText(frequency.second)],
    ["second half amplitude", manifestValueText(amplitude.second)],
  ]);
  if (resync.bias && typeof resync.bias === "object") {
    pairs.set("first half bias", manifestValueText(resync.bias.first));
    pairs.set("second half bias", manifestValueText(resync.bias.second));
  }

  return [...pairs.values()].every(Boolean) ? pairs : null;
}

function manifestValueText(value) {
  const number = Number(value);
  return Number.isFinite(number) ? formatCompactNumber(number) : "";
}

function parseSummaryNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isPositiveFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function isPositiveNumber(value) {
  return value !== null && value > 0;
}

function isUpwardChange(first, second) {
  return first !== null && second !== null && second > first;
}

function formatSummaryChange(first, second) {
  if (first === null || second === null) {
    return "";
  }

  const delta = second - first;
  const ratio = first === 0 ? null : second / first;
  if (ratio === null) {
    return `${formatSignedNumber(delta)} / ratio unavailable`;
  }

  return `${formatSignedNumber(delta)} / x${formatCompactNumber(ratio)}`;
}

function formatSignedNumber(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatCompactNumber(value)}`;
}

function formatCompactNumber(value) {
  return Number(value.toFixed(3)).toString();
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return "";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${formatCompactNumber(bytes / 1024)} KB`;
}

function manifestNumberText(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? String(number) : "missing";
}

function manifestBytesText(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? formatBytes(number) : "missing";
}

function formatTimestamp(value) {
  if (!value) {
    return "missing";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "invalid";
  }

  return date.toLocaleString();
}

async function renderParameterSummary(manifest, links) {
  const status = document.getElementById("parameterSummaryStatus");
  const manifestPairs = parameterResyncPairs(manifest);
  if (manifestPairs) {
    renderParameterSummaryCards(manifestPairs);
    status.textContent = "Manifest";
    status.className = "pill good";
    return;
  }

  const path = findArtifactPath(links, "text-summary");
  status.textContent = "Loading";
  status.className = "pill";

  if (!path) {
    status.textContent = "Check";
    status.className = "pill warn";
    renderParameterSummaryCards(new Map());
    return;
  }

  try {
    const response = await fetch(artifactUrl(path), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Summary fetch failed: ${response.status}`);
    }

    const pairs = parseSummaryText(await response.text());
    renderParameterSummaryCards(pairs);
    status.textContent = "Loaded";
    status.className = "pill good";
  } catch (error) {
    status.textContent = "Check";
    status.className = "pill warn";
    renderParameterSummaryCards(new Map());
    console.error(error);
  }
}

function validateConsumerChecklist(manifest) {
  const handoff = manifest.sandboxHandoff || {};
  const links = manifest.artifactLinks || [];
  const phases = manifest.phases || [];
  const phaseAudioIssues = phaseAudioMeasurementIssues(manifest);
  const phaseReportIssue = phaseReportCoverageIssue(manifest);
  const parameterResyncIssue = parameterResyncContractIssue(manifest);
  const callerProcessingIssue = callerProcessingOrderIssue(manifest);
  const entryPointPath = findArtifactPath(links, "entry-point");
  const primaryAudioPath = findArtifactPath(links, "audio");
  const checks = [
    ["allOk", manifest.allOk === true],
    ["contract", handoff.contract === expectedContract],
    ["contractVersion", handoff.contractVersion === expectedContractVersion],
    ["inspectionMode", handoff.inspectionMode === expectedInspectionMode],
    ["entryPoint", Boolean(handoff.entryPoint)],
    ["primaryAudioArtifact", Boolean(handoff.primaryAudioArtifact)],
    ...requiredFlags.map(([key, expected]) => [
      key,
      handoff[key] === expected,
    ]),
    ["entry-point link", hasArtifactKind(links, "entry-point")],
    ["entry-point matches handoff", entryPointPath === handoff.entryPoint],
    ["audio link", hasArtifactKind(links, "audio")],
    ["audio matches handoff", primaryAudioPath === handoff.primaryAudioArtifact],
    ["phase report", phases.length > 0],
    ["phase report coverage", phaseReportIssue === ""],
    ["parameter resync", parameterResyncIssue === ""],
    ["phase audio measurements", phaseAudioIssues.length === 0],
    ["caller processing order", callerProcessingIssue === ""],
  ];

  return {
    accepted: checks.every(([, ok]) => ok),
    checks,
  };
}

function renderChecklist(result) {
  const list = document.getElementById("checklist");
  renderCheckRows(list, result.checks);
}

function renderUnavailableChecklist() {
  renderCheckRows(document.getElementById("checklist"), [
    ["manifest loaded", false],
    ["sandbox handoff", false],
    ["artifact links", false],
  ]);
}

function renderCheckRows(container, rows) {
  container.replaceChildren();
  for (const [label, ok] of rows) {
    const stateName = ok ? "ok" : "check";
    const item = document.createElement("div");
    item.className = ok ? "check-row" : "check-row warn-row";
    item.dataset.checkLabel = label;
    item.dataset.checkState = stateName;
    item.setAttribute("role", "group");
    item.setAttribute("aria-label", `${label}: ${stateName}`);
    item.title = `${label}: ${stateName}`;

    const marker = document.createElement("strong");
    marker.textContent = ok ? "OK" : "Check";

    const text = document.createElement("span");
    text.textContent = label;

    item.append(marker, text);
    container.append(item);
  }
}

function phaseJumpButtonsLabeled(manifest) {
  const phases = Array.isArray(manifest?.phases) ? manifest.phases : [];
  const buttons = [...document.querySelectorAll("#waveformPhaseControls button")];
  if (!phases.length || buttons.length !== phases.length) {
    return false;
  }

  return buttons.every((button) => {
    const label = button.getAttribute("aria-label") || "";
    return (
      button.dataset.phaseIndex !== undefined &&
      button.dataset.phaseName !== undefined &&
      button.dataset.phaseStartFrame !== undefined &&
      button.dataset.phaseEndFrame !== undefined &&
      button.dataset.phaseStartTime !== undefined &&
      button.dataset.phaseEndTime !== undefined &&
      label.startsWith("Jump waveform to ") &&
      label.includes(" phase from frame ") &&
      label.includes(" to ") &&
      button.title.startsWith("Jump to ") &&
      button.title.includes(" from ") &&
      button.title.includes(" to ")
    );
  });
}

function waveformControlsLabeled() {
  return waveformControlButtonsLabeled(["waveformPlayButton", "followAudioButton"]);
}

function waveformPlayControlLabeled() {
  return waveformControlButtonsLabeled(["waveformPlayButton"]);
}

function followAudioControlLabeled() {
  return waveformControlButtonsLabeled(["followAudioButton"]);
}

function waveformControlButtonsLabeled(ids) {
  return ids.every((id) => {
    const button = document.getElementById(id);
    const label = button?.dataset.waveformControlLabel;
    const value = button?.dataset.waveformControlValue;
    const stateName = button?.dataset.waveformControlState;
    const ariaLabel = button?.getAttribute("aria-label") || "";
    const title = button?.title || "";
    return (
      Boolean(label) &&
      Boolean(value) &&
      Boolean(stateName) &&
      ariaLabel === `${label}: ${value}` &&
      title === `${label}: ${value} / ${stateName}` &&
      ["true", "false"].includes(button?.getAttribute("aria-pressed"))
    );
  });
}

function waveformScrubberLabeled() {
  const scrubber = document.getElementById("waveformScrubber");
  return (
    scrubber?.getAttribute("aria-label") === "Waveform position" &&
    Boolean(scrubber.getAttribute("aria-valuetext")) &&
    Boolean(scrubber.title) &&
    ["follow", "free"].includes(scrubber.dataset.followMode || "") &&
    scrubber.getAttribute("min") === "0" &&
    scrubber.getAttribute("max") === "1" &&
    scrubber.getAttribute("step") === "0.001"
  );
}

function waveformCanvasLabeled() {
  const canvas = document.getElementById("waveformCanvas");
  return (
    canvas?.getAttribute("aria-label") === "Primary WAV waveform" &&
    canvas.dataset.waveformSource === "decoded primary WAV" &&
    canvas.dataset.waveformSampleRate !== undefined &&
    canvas.dataset.waveformChannels !== undefined &&
    canvas.dataset.waveformBitDepth !== undefined &&
    canvas.dataset.waveformFrames !== undefined &&
    canvas.dataset.waveformDataBytes !== undefined &&
    canvas.dataset.waveformFileBytes !== undefined &&
    canvas.dataset.waveformPeak !== undefined &&
    canvas.dataset.waveformRms !== undefined &&
    Boolean(canvas.title)
  );
}

function levelEnvelopeCanvasLabeled() {
  const canvas = document.getElementById("levelEnvelopeCanvas");
  return (
    canvas?.getAttribute("aria-label") === "Primary WAV level envelope" &&
    canvas.dataset.envelopeSource === "decoded primary WAV" &&
    canvas.dataset.envelopeWindowMs !== undefined &&
    canvas.dataset.envelopeWindowFrames !== undefined &&
    canvas.dataset.envelopeWindows !== undefined &&
    canvas.dataset.envelopePeak !== undefined &&
    canvas.dataset.envelopeRms !== undefined &&
    canvas.dataset.envelopeFrames !== undefined &&
    Boolean(canvas.title)
  );
}

function reportControlsLabeled() {
  const buttons = [...document.querySelectorAll("#reportControls button")];
  return (
    buttons.length > 0 &&
    buttons.every((button) => {
      const label = button.getAttribute("aria-label") || "";
      return (
        button.dataset.reportIndex !== undefined &&
        button.dataset.reportKind !== undefined &&
        button.dataset.reportPath !== undefined &&
        label.startsWith("Show report ") &&
        button.title === label &&
        ["true", "false"].includes(button.getAttribute("aria-pressed"))
      );
    })
  );
}

function reportViewerLabeled() {
  const viewer = document.getElementById("reportViewer");
  const label = viewer?.getAttribute("aria-label") || "";
  return (
    viewer?.dataset.reportLabel &&
    viewer.dataset.reportKind &&
    viewer.dataset.reportPath !== undefined &&
    viewer.dataset.reportState === "ok" &&
    viewer.getAttribute("role") === "region" &&
    label === `Report viewer ${viewer.dataset.reportLabel}: ok` &&
    viewer.title ===
      `Report viewer ${viewer.dataset.reportLabel} / ${viewer.dataset.reportKind} / ${
        viewer.dataset.reportPath || "missing"
      } / ok`
  );
}

function statusStripItemsLabeled() {
  return Object.entries(statusStripLabels).every(([id, labelText]) => {
    const element = document.getElementById(id);
    const label = element?.getAttribute("aria-label") || "";
    return (
      element?.dataset.statusLabel === labelText &&
      Boolean(element.dataset.statusValue) &&
      element.dataset.statusState === "ok" &&
      element.getAttribute("role") === "status" &&
      label === `${labelText}: ${element.dataset.statusValue}` &&
      element.title === `${label} / ok`
    );
  });
}

function primaryAudioLabeled(manifest) {
  const audio = document.getElementById("audioPlayer");
  const path = manifest?.sandboxHandoff?.primaryAudioArtifact || "";
  return (
    Boolean(path) &&
    audio.dataset.audioLabel === "Primary Audio" &&
    audio.dataset.audioPath === path &&
    audio.dataset.audioState === "ok" &&
    audio.getAttribute("aria-label") === `Primary Audio: ${path}` &&
    audio.title === `Primary Audio: ${path} / ok` &&
    audio.getAttribute("src") === artifactUrl(path)
  );
}

function primaryAudioTitleLabeled(manifest) {
  const title = document.getElementById("audioTitle");
  const path = manifest?.sandboxHandoff?.primaryAudioArtifact || "";
  return (
    Boolean(path) &&
    title.dataset.audioTitleLabel === "Primary Audio" &&
    title.dataset.audioTitlePath === path &&
    title.dataset.audioTitleState === "ok" &&
    title.getAttribute("aria-label") === `Primary Audio title: ${path}` &&
    title.title === `Primary Audio title: ${path} / ok` &&
    title.textContent === path
  );
}

function primaryAudioPositionLabeled() {
  return waveformHeaderPillsLabeled(["audioPosition"]);
}

function reloadManifestControlLabeled() {
  const button = document.getElementById("refreshButton");
  const label = button?.getAttribute("aria-label") || "";
  return (
    button?.dataset.loading !== undefined &&
    ["true", "false"].includes(button.getAttribute("aria-busy")) &&
    ["true", "false"].includes(button.dataset.loading) &&
    ["Reload manifest", "Loading manifest"].includes(label) &&
    Boolean(button.title) &&
    (button.dataset.loading === "true"
      ? button.disabled && label === "Loading manifest"
      : !button.disabled && label === "Reload manifest")
  );
}

function waveformHeaderPillsLabeled(ids) {
  return ids.every((id) => {
    const pill = document.getElementById(id);
    const label = pill?.getAttribute("aria-label") || "";
    return (
      pill?.dataset.waveformHeaderLabel !== undefined &&
      pill.dataset.waveformHeaderValue !== undefined &&
      pill.dataset.waveformHeaderState === "ok" &&
      label === `${pill.dataset.waveformHeaderLabel}: ${pill.dataset.waveformHeaderValue}` &&
      pill.title === `${label} / ok`
    );
  });
}

function currentParameterPillsLabeled() {
  return (
    waveformHeaderPillsLabeled(["currentFrequency", "currentAmplitude", "currentParameterStatus"]) &&
    currentMeasuredAudioPillsLabeled()
  );
}

function currentMeasuredAudioPillsLabeled() {
  return waveformHeaderPillsLabeled([
    "currentMeasuredFrequency",
    "currentMeasuredPeak",
    "currentMeasuredFrequencyDelta",
    "currentMeasuredPeakDelta",
    "currentMeasuredStatus",
  ]);
}

function waveformTransportPillsLabeled() {
  return waveformHeaderPillsLabeled([
    "waveformPosition",
    "waveformSample",
    "waveformPhase",
    "waveformPhaseRange",
  ]);
}

function phaseJumpTargetLabeled() {
  return waveformHeaderPillsLabeled(["waveformPhaseJumpTarget"]);
}

function artifactRowsLabeled(manifest) {
  const links = Array.isArray(manifest?.artifactLinks) ? manifest.artifactLinks : [];
  const rows = [...document.querySelectorAll("#artifactList .artifact-row")];
  return (
    links.length > 0 &&
    rows.length === links.length &&
    rows.every((row, index) => {
      const link = links[index];
      const label = row.getAttribute("aria-label") || "";
      return (
        row.dataset.artifactKind === (link.kind || "") &&
        row.dataset.artifactPath === (link.path || "") &&
        row.dataset.artifactLabel === (link.label || "") &&
        label === artifactRowLabel(link) &&
        row.title === label &&
        (link.path
          ? row.tagName === "A" &&
            row.getAttribute("href") === artifactUrl(link.path) &&
            row.getAttribute("target") === "_blank" &&
            row.getAttribute("rel") === "noreferrer"
          : row.tagName === "DIV" && row.getAttribute("role") === "group")
      );
    })
  );
}

function sandboxContractRowsLabeled() {
  const rows = [...document.querySelectorAll("#sandboxContract .contract-row")];
  return (
    rows.length === 9 &&
    rows.every(
      (row) =>
        row.dataset.contractKind !== undefined &&
        row.dataset.contractLabel !== undefined &&
        row.dataset.contractState === "ok" &&
        row.getAttribute("role") === "group" &&
        row.getAttribute("aria-label") ===
          `${row.dataset.contractKind}: ${row.dataset.contractLabel} / ok` &&
        row.title === row.getAttribute("aria-label"),
    )
  );
}

function keyValueRowsLabeled(containerId, expectedRows) {
  const container = document.getElementById(containerId);
  const terms = [...(container?.querySelectorAll("dt") || [])];
  const values = [...(container?.querySelectorAll("dd") || [])];
  return (
    terms.length === expectedRows &&
    values.length === expectedRows &&
    values.every((value, index) => {
      const term = terms[index];
      return (
        term?.dataset.kvKey === value.dataset.kvKey &&
        value.dataset.kvKey !== undefined &&
        value.dataset.kvValue !== undefined &&
        value.dataset.kvExpected !== undefined &&
        value.dataset.kvState !== undefined &&
        value.getAttribute("aria-label") === `${value.dataset.kvKey}: ${value.dataset.kvValue}` &&
        Boolean(value.title)
      );
    })
  );
}

function producerProofRowsLabeled() {
  return (
    keyValueRowsLabeled("producerProof", 9) ||
    keyValueRowsLabeled("producerProof", 10)
  );
}

function boundaryFlagRowsLabeled() {
  return keyValueRowsLabeled("boundaryFlags", requiredFlags.length);
}

function phaseCoverageRowsLabeled() {
  return keyValueRowsLabeled("phaseCoverage", 5);
}

function artifactCoverageRowsLabeled() {
  return keyValueRowsLabeled("artifactCoverage", 12);
}

function sourceRowsLabeled() {
  const ids = [
    "manifestPath",
    "sourceError",
    "sourceDetail",
    "manifestHttpStatus",
    "manifestBytes",
    "manifestModified",
    "manifestLoadedAt",
    "manifestCacheControl",
    "manifestPragma",
    "manifestExpires",
    "artifactRoot",
  ];
  return ids.every((id) => {
    const value = document.getElementById(id);
    return (
      value &&
      value.dataset.sourceKey !== undefined &&
      value.dataset.sourceValue !== undefined &&
      value.dataset.sourceExpected !== undefined &&
      value.dataset.sourceState === "ok" &&
      value.getAttribute("aria-label") === `${value.dataset.sourceKey}: ${value.dataset.sourceValue}` &&
      Boolean(value.title)
    );
  });
}

function parameterSummaryCardsLabeled() {
  const cards = [...document.querySelectorAll("#parameterSummary .summary-card")];
  return (
    (cards.length === 6 || cards.length === 9) &&
    cards.every((card) => {
      const label = card.getAttribute("aria-label") || "";
      return (
        card.dataset.summaryLabel !== undefined &&
        card.dataset.summaryValue !== undefined &&
        card.dataset.summaryKind !== undefined &&
        card.dataset.summaryState === "ok" &&
        card.getAttribute("role") === "group" &&
        label === `${card.dataset.summaryLabel}: ${card.dataset.summaryValue}` &&
        card.title === `${label} / ok`
      );
    })
  );
}

function checkRowsLabeled(containerId, expectedRows) {
  const rows = [...document.querySelectorAll(`#${containerId} .check-row`)];
  return (
    rows.length === expectedRows &&
    rows.every((row) => {
      const label = row.getAttribute("aria-label") || "";
      return (
        row.dataset.checkLabel !== undefined &&
        row.dataset.checkState === "ok" &&
        row.getAttribute("role") === "group" &&
        label === `${row.dataset.checkLabel}: ok` &&
        row.title === label
      );
    })
  );
}

function checkRowsHaveUniqueLabels(rows) {
  const labels = rows.map(([label]) => label);
  return (
    labels.length > 0 &&
    labels.every((label) => typeof label === "string" && label.trim().length > 0) &&
    new Set(labels).size === labels.length
  );
}

function consumerChecklistRowsLabeled() {
  return checkRowsLabeled("checklist", 22);
}

function signalPlotControlsLabeled() {
  const groups = [...document.querySelectorAll("#signalPlotControls .control-group")];
  const buttons = [...document.querySelectorAll("#signalPlotControls button")];
  return (
    groups.length === 7 &&
    groups.every((group) => (group.getAttribute("aria-label") || "").startsWith("Signal plot ")) &&
    buttons.length > 0 &&
    buttons.every((button) => {
      const label = button.getAttribute("aria-label") || "";
      return (
        label.startsWith("Signal plot ") &&
        button.title === label &&
        ["true", "false"].includes(button.getAttribute("aria-pressed"))
      );
    })
  );
}

function signalPlotCanvasLabeled() {
  const canvas = document.getElementById("signalPlotCanvas");
  return (
    canvas?.getAttribute("aria-label") === "Primary WAV signal plot" &&
    canvas.dataset.signalSource === "decoded primary WAV" &&
    canvas.dataset.signalFocus !== undefined &&
    canvas.dataset.signalMode !== undefined &&
    canvas.dataset.signalScale !== undefined &&
    canvas.dataset.signalWindow !== undefined &&
    canvas.dataset.signalWindowMs !== undefined &&
    canvas.dataset.signalLagMs !== undefined &&
    canvas.dataset.signalLagFrames !== undefined &&
    canvas.dataset.signalPoints !== undefined &&
    canvas.dataset.signalFocusPeak !== undefined &&
    canvas.dataset.signalFocusRms !== undefined &&
    Boolean(canvas.title)
  );
}

const inspectionCursorPillIds = [
  "inspectionCursorSource",
  "inspectionCursorDelta",
  "inspectionCursorAudio",
  "inspectionCursorPlayback",
  "inspectionCursorView",
  "inspectionCursorPreview",
  "inspectionCursorSeek",
  "inspectionCursorSeekTarget",
  "inspectionCursorSeekSync",
  "inspectionCursorTransport",
  "inspectionCursorTarget",
  "inspectionCursorDivergence",
];

function inspectionCursorPillLabeled(id) {
  const pill = document.getElementById(id);
  return (
    pill &&
    pill.dataset.inspectionPill !== undefined &&
    pill.dataset.inspectionValue !== undefined &&
    pill.dataset.inspectionState !== undefined &&
    pill.getAttribute("aria-label")?.startsWith(`${pill.dataset.inspectionPill}: `) &&
    pill.title === pill.getAttribute("aria-label")
  );
}

function inspectionCursorPillsLabeled() {
  return inspectionCursorPillIds.every((id) => inspectionCursorPillLabeled(id));
}

function inspectionCursorKeyValueLabeled(key) {
  const values = [...document.querySelectorAll("#inspectionCursor dd")];
  const value = values.find((row) => row.dataset.kvKey === key);
  return (
    value &&
    value.dataset.kvValue !== undefined &&
    value.dataset.kvExpected !== undefined &&
    value.dataset.kvState === "ok" &&
    value.getAttribute("aria-label") === `${key}: ${value.dataset.kvValue}` &&
    value.title === value.getAttribute("aria-label")
  );
}

function inspectionCursorHoverDeltaLabeled() {
  return inspectionCursorKeyValueLabeled("hover delta");
}

function inspectionCursorLabeled() {
  const cursor = document.getElementById("inspectionCursor");
  const label = cursor?.getAttribute("aria-label") || "";
  return (
    cursor?.dataset.inspectionCursorLabel === "inspection cursor" &&
    Boolean(cursor.dataset.inspectionCursorValue) &&
    cursor.dataset.inspectionCursorState === "ok" &&
    cursor.getAttribute("role") === "group" &&
    label === `inspection cursor: ${cursor.dataset.inspectionCursorValue}` &&
    cursor.title === `${label} / ok` &&
    inspectionCursorKeyValueLabeled("transport frame") &&
    inspectionCursorKeyValueLabeled("hover signal")
  );
}

function parameterTimelineSegmentsLabeled() {
  const segments = [...document.querySelectorAll("#parameterTimeline .parameter-segment")];
  return (
    segments.length > 0 &&
    segments.every((segment) => {
      const label = segment.getAttribute("aria-label") || "";
      return (
        segment.dataset.phaseName !== undefined &&
        segment.dataset.parameterName !== undefined &&
        segment.dataset.parameterValue !== undefined &&
        segment.dataset.startFrame !== undefined &&
        segment.dataset.endFrame !== undefined &&
        segment.dataset.startTime !== undefined &&
        segment.dataset.endTime !== undefined &&
        label.startsWith("Parameter ") &&
        label.includes(" from frame ") &&
        label.includes(" to ") &&
        segment.getAttribute("role") === "group" &&
        segment.title.startsWith(label)
      );
    })
  );
}

function parameterTimelinePreviewAvailable() {
  return parameterTimelineSegmentsLabeled();
}

function phaseListItemsLabeled() {
  const items = [...document.querySelectorAll("#phaseList .phase")];
  return (
    items.length > 0 &&
    items.every((item) => {
      const label = item.getAttribute("aria-label") || "";
      return (
        item.dataset.phaseIndex !== undefined &&
        item.dataset.phaseName !== undefined &&
        item.dataset.startFrame !== undefined &&
        item.dataset.endFrame !== undefined &&
        item.dataset.startTime !== undefined &&
        item.dataset.endTime !== undefined &&
        item.dataset.duration !== undefined &&
        item.dataset.wavShare !== undefined &&
        label.startsWith("Phase ") &&
        item.getAttribute("role") === "group" &&
        item.title.startsWith(label)
      );
    })
  );
}

function phasePreviewTargetAvailable() {
  return phaseListItemsLabeled() && phaseAudioStatsItemsLabeled();
}

function phaseAudioStatsItemsLabeled() {
  const items = [...document.querySelectorAll("#phaseAudioStats .phase-stat")];
  return (
    items.length > 0 &&
    items.every((item) => {
      const label = item.getAttribute("aria-label") || "";
      return (
        item.dataset.phaseName !== undefined &&
        item.dataset.startFrame !== undefined &&
        item.dataset.endFrame !== undefined &&
        item.dataset.startTime !== undefined &&
        item.dataset.endTime !== undefined &&
        item.dataset.targetFrequency !== undefined &&
        item.dataset.measuredFrequency !== undefined &&
        item.dataset.targetAmplitude !== undefined &&
        item.dataset.peak !== undefined &&
        item.dataset.rms !== undefined &&
        item.dataset.producerMatch !== undefined &&
        label.startsWith("Phase audio stats ") &&
        item.getAttribute("role") === "group" &&
        item.title.startsWith(label)
      );
    })
  );
}

function probePillLabeled(id) {
  const probe = document.getElementById(id);
  return (
    Boolean(probe?.dataset.probeSource) &&
    Boolean(probe?.dataset.probeFrame) &&
    Boolean(probe?.title)
  );
}

function probePillsLabeled(ids) {
  return ids.every((id) => probePillLabeled(id));
}

function waveformProbeLabeled() {
  return probePillLabeled("waveformProbe");
}

function levelEnvelopeProbeLabeled() {
  return probePillLabeled("levelEnvelopeProbe");
}

function parameterTimelineProbeLabeled() {
  return probePillLabeled("parameterTimelineProbe");
}

function phaseAudioStatsProbeLabeled() {
  return probePillLabeled("phaseAudioStatsProbe");
}

function phaseListProbeLabeled() {
  return probePillLabeled("phaseProbe");
}

function signalPlotPointProbeLabeled() {
  return probePillLabeled("signalPlotProbe");
}

function signalPlotSourceProbeLabeled() {
  return probePillLabeled("signalPlotProbeSource");
}

function signalPlotProbeLabeled() {
  return probePillsLabeled(["signalPlotProbe", "signalPlotProbeSource"]);
}

function waveformToSignalProbeAvailable() {
  const probe = signalPlotProbeAtFrame(0);
  return (
    Boolean(probe) &&
    Number.isFinite(probe.x) &&
    Number.isFinite(probe.y) &&
    probe.nearest?.frame === 0 &&
    probe.nearest.distance === 0
  );
}

function signalToWaveformProbeAvailable() {
  return waveformProbeLabeled();
}

function circuitChainRowsLabeled() {
  const rows = [...document.querySelectorAll("#circuitChain .chain-row")];
  if (!rows.length) {
    return false;
  }
  return rows.every((row, index) => {
    const label = row.getAttribute("aria-label") || "";
    return (
      row.dataset.chainIndex === String(index) &&
      row.dataset.circuitConnection !== undefined &&
      row.dataset.callerStep !== undefined &&
      row.dataset.chainState === "ok" &&
      row.getAttribute("role") === "group" &&
      label.includes(row.dataset.circuitConnection) &&
      label.includes(row.dataset.callerStep) &&
      row.title === label
    );
  });
}

function renderHandsOnReadiness(manifest, waveformReady = Boolean(state.waveform)) {
  const rows = [
    [
      "native audio",
      hasArtifactKind(manifest?.artifactLinks || [], "audio") &&
        Boolean(manifest?.sandboxHandoff?.primaryAudioArtifact),
    ],
    ["primary audio labels", primaryAudioLabeled(manifest)],
    ["primary audio title labels", primaryAudioTitleLabeled(manifest)],
    ["primary audio position labels", primaryAudioPositionLabeled()],
    ["reload manifest labels", reloadManifestControlLabeled()],
    ["waveform play control", waveformPlayControlLabeled()],
    ["waveform control labels", waveformControlsLabeled()],
    ["status strip labels", statusStripItemsLabeled()],
    ["report control labels", reportControlsLabeled()],
    ["report viewer labels", state.reports.length > 0 && reportViewerLabeled()],
    ["artifact row labels", artifactRowsLabeled(manifest)],
    ["artifact coverage row labels", artifactCoverageRowsLabeled()],
    ["source row labels", sourceRowsLabeled()],
    ["producer proof row labels", producerProofRowsLabeled()],
    ["circuit chain rows", circuitChainRowsLabeled()],
    ["boundary flag row labels", boundaryFlagRowsLabeled()],
    ["decoded waveform", waveformReady],
    ["waveform seek", waveformReady && Number(manifest?.wav?.frames) > 0],
    ["waveform transport labels", waveformReady && waveformTransportPillsLabeled()],
    ["waveform canvas labels", waveformReady && waveformCanvasLabeled()],
    ["waveform scrubber labels", waveformReady && waveformScrubberLabeled()],
    ["waveform hover probe", waveformReady && waveformProbeLabeled()],
    ["waveform probe labels", waveformReady && waveformProbeLabeled()],
    ["level envelope probe", waveformReady && levelEnvelopeProbeLabeled()],
    ["level envelope probe labels", waveformReady && levelEnvelopeProbeLabeled()],
    ["level envelope canvas labels", waveformReady && levelEnvelopeCanvasLabeled()],
    ["parameter timeline probe", waveformReady && parameterTimelineProbeLabeled()],
    ["parameter timeline probe labels", waveformReady && parameterTimelineProbeLabeled()],
    ["parameter timeline segment labels", waveformReady && parameterTimelineSegmentsLabeled()],
    ["parameter timeline preview", waveformReady && parameterTimelinePreviewAvailable()],
    ["probe frame labels", waveformReady && probeFrameLabelsReady()],
    ["follow/free view", followAudioControlLabeled()],
    ["current measured audio", waveformReady && currentMeasuredAudioPillsLabeled()],
    ["current parameter labels", waveformReady && currentParameterPillsLabeled()],
    [
      "phase jump controls",
      Array.isArray(manifest?.phases) &&
        manifest.phases.length > 0 &&
        phaseReportCoverageIssue(manifest) === "",
    ],
    ["phase coverage row labels", phaseCoverageRowsLabeled()],
    ["phase jump preview", waveformReady && phaseJumpButtonsLabeled(manifest)],
    ["phase jump labels", waveformReady && phaseJumpButtonsLabeled(manifest)],
    ["phase jump target", waveformReady && phaseJumpTargetLabeled()],
    ["phase jump target labels", waveformReady && phaseJumpTargetLabeled()],
    ["phase list probe", waveformReady && phaseListProbeLabeled()],
    ["phase list probe labels", waveformReady && phaseListProbeLabeled()],
    ["phase list item labels", waveformReady && phaseListItemsLabeled()],
    ["phase preview target", waveformReady && phasePreviewTargetAvailable()],
    ["phase parameter readout", parameterResyncContractIssue(manifest) === ""],
    ["parameter summary card labels", parameterResyncContractIssue(manifest) === "" && parameterSummaryCardsLabeled()],
    ["producer measurement compare", phaseAudioMeasurementIssues(manifest).length === 0],
    ["phase audio stats probe", waveformReady && phaseAudioStatsProbeLabeled()],
    ["phase audio stats probe labels", waveformReady && phaseAudioStatsProbeLabeled()],
    ["phase audio stats item labels", waveformReady && phaseAudioStatsItemsLabeled()],
    ["signal inspection", waveformReady && signalPlotCanvasLabeled()],
    ["signal plot probe", waveformReady && signalPlotPointProbeLabeled()],
    ["signal plot source probe", waveformReady && signalPlotSourceProbeLabeled()],
    ["signal plot probe labels", waveformReady && signalPlotProbeLabeled()],
    ["signal plot control labels", waveformReady && signalPlotControlsLabeled()],
    ["signal plot canvas labels", waveformReady && signalPlotCanvasLabeled()],
    ["waveform-to-signal probe", waveformReady && waveformToSignalProbeAvailable()],
    ["signal-to-waveform probe", waveformReady && signalToWaveformProbeAvailable()],
    ["inspection cursor", waveformReady && inspectionCursorLabeled()],
    ["inspection source pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorSource")],
    ["inspection delta pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorDelta")],
    ["inspection audio pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorAudio")],
    ["inspection playback pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorPlayback")],
    ["inspection view pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorView")],
    ["inspection preview pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorPreview")],
    ["inspection seek pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorSeek")],
    ["inspection seek target pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorSeekTarget")],
    ["inspection seek sync pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorSeekSync")],
    ["inspection transport pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorTransport")],
    ["inspection target pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorTarget")],
    ["inspection divergence pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorDivergence")],
    ["inspection pill labels", waveformReady && inspectionCursorPillsLabeled()],
    ["inspection hover delta", waveformReady && inspectionCursorHoverDeltaLabeled()],
    ["read-only boundary", validateConsumerChecklist(manifest).accepted],
    ["consumer checklist row labels", validateConsumerChecklist(manifest).accepted && consumerChecklistRowsLabeled()],
    ["sandbox contract row labels", validateConsumerChecklist(manifest).accepted && sandboxContractRowsLabeled()],
  ];
  rows.push([
    "readiness row labels",
    checkRowsHaveUniqueLabels([...rows, ["readiness row labels", true]]),
  ]);
  const ok = rows.every(([_label, rowOk]) => rowOk);

  setStatus("handsOnReadinessStatus", ok ? "Ready" : "Check", ok);
  renderCheckRows(document.getElementById("handsOnReadiness"), rows);
}

function renderUnavailableHandsOnReadiness() {
  renderCheckRows(document.getElementById("handsOnReadiness"), [
    ["manifest loaded", false],
    ["decoded waveform", false],
    ["read-only boundary", false],
  ]);
}

function renderProducerProof(manifest) {
  const status = document.getElementById("producerStatus");
  const setters = manifest.parameterSetters || {};
  const phaseAudioIssues = phaseAudioMeasurementIssues(manifest);
  const callerProcessingIssue = callerProcessingOrderIssue(manifest);
  const rows = [
    ["demo", manifest.demo || "missing"],
    ["kind", manifest.kind || "missing"],
    ["runtime API", boolText(Boolean(manifest.runtimeApi)), false],
    ["scheduler", boolText(Boolean(manifest.scheduler)), false],
    ["audio engine", boolText(Boolean(manifest.audioEngine)), false],
    ["frequency setter", boolText(Boolean(setters.frequency)), true],
    ["amplitude setter", boolText(Boolean(setters.amplitude)), true],
    ...(setters.bias !== undefined
      ? [["bias setter", boolText(Boolean(setters.bias)), true]]
      : []),
    ["phase measurements", boolText(phaseAudioIssues.length === 0), true],
    ["caller processing order", boolText(callerProcessingIssue === ""), true],
  ];
  const ok = rows.every(([, value, expected]) => {
    if (expected === undefined) {
      return value !== "missing";
    }
    return value === boolText(expected);
  });

  setStatus("producerStatus", ok ? "Verified" : "Check", ok);
  renderKeyValue(document.getElementById("producerProof"), rows);
}

function renderUnavailableProducerProof() {
  renderKeyValue(document.getElementById("producerProof"), [
    ["demo", "unavailable", "present"],
    ["runtime API", "unavailable", boolText(false)],
    ["scheduler", "unavailable", boolText(false)],
    ["audio engine", "unavailable", boolText(false)],
    ["phase measurements", "unavailable", boolText(true)],
    ["caller processing order", "unavailable", boolText(true)],
  ]);
}

function formatCircuitStep(step) {
  return `${step.sourceNode}.${step.sourcePort} -> ${step.destinationNode}.${step.destinationPort}`;
}

function renderCircuitChain(manifest) {
  const list = document.getElementById("circuitChain");
  const issue = callerProcessingOrderIssue(manifest);
  const order = manifest.callerProcessingOrder || {};
  const steps = Array.isArray(order.steps) ? order.steps : [];
  const ok = issue === "" && steps.length > 0;

  list.replaceChildren();
  for (const [index, step] of steps.entries()) {
    const circuitConnection = formatCircuitStep(step);
    const callerStep = String(step.callerStep || "missing");
    const rowOk = ok && Number(step.index) === index;
    const row = document.createElement("div");
    row.className = rowOk ? "chain-row" : "chain-row warn-row";
    row.dataset.chainIndex = String(index);
    row.dataset.circuitConnection = circuitConnection;
    row.dataset.callerStep = callerStep;
    row.dataset.chainState = rowOk ? "ok" : "check";
    row.setAttribute("role", "group");
    row.setAttribute(
      "aria-label",
      `Circuit connection ${index + 1}: ${circuitConnection}; caller step: ${callerStep}; ${row.dataset.chainState}`,
    );
    row.title = row.getAttribute("aria-label");

    const badge = document.createElement("strong");
    badge.className = "chain-index";
    badge.textContent = String(index + 1);

    const circuit = document.createElement("div");
    circuit.className = "chain-cell";
    const circuitLabel = document.createElement("span");
    circuitLabel.textContent = "Circuit connection";
    const circuitText = document.createElement("strong");
    circuitText.textContent = circuitConnection;
    circuit.append(circuitLabel, circuitText);

    const caller = document.createElement("div");
    caller.className = "chain-cell";
    const callerLabel = document.createElement("span");
    callerLabel.textContent = "Caller processing step";
    const callerText = document.createElement("strong");
    callerText.textContent = callerStep;
    caller.append(callerLabel, callerText);

    row.append(badge, circuit, caller);
    list.append(row);
  }

  if (!steps.length) {
    const row = document.createElement("div");
    row.className = "chain-row warn-row";
    row.dataset.chainIndex = "none";
    row.dataset.circuitConnection = "unavailable";
    row.dataset.callerStep = "unavailable";
    row.dataset.chainState = "check";
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", "Circuit chain unavailable");
    row.title = "Circuit chain unavailable";
    row.textContent = issue || "circuit chain unavailable";
    list.append(row);
  }

  setStatus("circuitChainStatus", ok ? "Aligned" : "Check", ok);
}

function renderUnavailableCircuitChain() {
  const list = document.getElementById("circuitChain");
  list.replaceChildren();
  const row = document.createElement("div");
  row.className = "chain-row warn-row";
  row.dataset.chainIndex = "none";
  row.dataset.circuitConnection = "unavailable";
  row.dataset.callerStep = "unavailable";
  row.dataset.chainState = "unavailable";
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", "Circuit chain unavailable");
  row.title = "Circuit chain unavailable";
  row.textContent = "manifest required";
  list.append(row);
}

function renderSandboxContract(manifest) {
  const status = document.getElementById("sandboxContractStatus");
  const list = document.getElementById("sandboxContract");
  const handoff = manifest.sandboxHandoff || {};
  const rows = [
    ["allowed", "display manifest artifacts", Boolean(handoff.entryPoint)],
    ["allowed", "play browser-native WAV", Boolean(handoff.primaryAudioArtifact)],
    ["allowed", "inspect decoded WAV data", handoff.inspectionMode === expectedInspectionMode],
    ["forbidden", "own DSP objects", handoff.circuitOwnsDspObjects === false],
    ["forbidden", "make DSP know Circuit", handoff.dspObjectsKnowCircuit === false],
    ["forbidden", "own scheduler", handoff.ownsScheduler === false],
    ["forbidden", "own audio engine", handoff.ownsAudioEngine === false],
    ["forbidden", "serialize patches", handoff.serializesPatch === false],
    ["required", "caller owns processing order", handoff.callerOwnsProcessingOrder === true],
  ];
  const ok = rows.every(([_kind, _label, rowOk]) => rowOk);

  list.replaceChildren();
  for (const [kind, label, rowOk] of rows) {
    const item = document.createElement("div");
    item.className = rowOk ? "contract-row" : "contract-row warn-row";
    item.dataset.contractKind = kind;
    item.dataset.contractLabel = label;
    item.dataset.contractState = rowOk ? "ok" : "check";
    item.setAttribute("role", "group");
    item.setAttribute("aria-label", `${kind}: ${label} / ${item.dataset.contractState}`);
    item.title = `${kind}: ${label} / ${item.dataset.contractState}`;

    const marker = document.createElement("strong");
    marker.textContent = rowOk ? kind : "check";

    const text = document.createElement("span");
    text.textContent = label;

    item.append(marker, text);
    list.append(item);
  }

  setStatus("sandboxContractStatus", ok ? "Bounded" : "Check", ok);
}

function renderUnavailableSandboxContract() {
  const list = document.getElementById("sandboxContract");
  const rows = [
    ["check", "sandbox handoff"],
    ["check", "read-only boundary"],
    ["check", "caller-owned processing order"],
  ];

  list.replaceChildren();
  for (const [kind, label] of rows) {
    const item = document.createElement("div");
    item.className = "contract-row warn-row";
    item.dataset.contractKind = kind;
    item.dataset.contractLabel = label;
    item.dataset.contractState = "unavailable";
    item.setAttribute("role", "group");
    item.setAttribute("aria-label", `${kind}: ${label} / unavailable`);
    item.title = `${kind}: ${label} / unavailable`;

    const marker = document.createElement("strong");
    marker.textContent = kind;

    const text = document.createElement("span");
    text.textContent = label;

    item.append(marker, text);
    list.append(item);
  }
}

function renderUnavailableBoundaryFlags() {
  renderKeyValue(
    document.getElementById("boundaryFlags"),
    requiredFlags.map(([key, expected]) => [
      key,
      "unavailable",
      expected,
    ]),
  );
}

function renderArtifactCoverage(manifest) {
  const links = manifest.artifactLinks || [];
  const phases = manifest.phases || [];
  const handoff = manifest.sandboxHandoff || {};
  const phaseReportCount = countArtifactKind(links, "phase-report");
  const missingPathCount = links.filter((link) => !link.path).length;
  const entryPointPath = findArtifactPath(links, "entry-point");
  const primaryAudioPath = findArtifactPath(links, "audio");
  const entryPointMatches = entryPointPath === handoff.entryPoint;
  const primaryAudioMatches = primaryAudioPath === handoff.primaryAudioArtifact;
  const phaseReportIssue = phaseReportCoverageIssue(manifest);
  const rows = [
    ["total links", String(links.length)],
    ["missing paths", String(missingPathCount), 0],
    ["reachability method", "HEAD", "HEAD"],
    ["entry point", String(countArtifactKind(links, "entry-point")), 1],
    ["entry point path", entryPointMatches ? "match" : "mismatch", "match"],
    ["audio", String(countArtifactKind(links, "audio")), 1],
    ["audio path", primaryAudioMatches ? "match" : "mismatch", "match"],
    ["manifest", String(countArtifactKind(links, "manifest")), 1],
    ["text summary", String(countArtifactKind(links, "text-summary")), 1],
    ["wav report", String(countArtifactKind(links, "wav-report")), 1],
    ["phase reports", String(phaseReportCount), phases.length],
    ["phase report coverage", phaseReportIssue === "" ? "match" : phaseReportIssue, "match"],
  ];
  const ok =
    links.length > 0 &&
    missingPathCount === 0 &&
    countArtifactKind(links, "entry-point") === 1 &&
    countArtifactKind(links, "audio") === 1 &&
    entryPointMatches &&
    primaryAudioMatches &&
    countArtifactKind(links, "manifest") === 1 &&
    countArtifactKind(links, "text-summary") === 1 &&
    countArtifactKind(links, "wav-report") === 1 &&
    phaseReportCount === phases.length &&
    phaseReportIssue === "";

  setStatus("artifactCoverageStatus", ok ? "Complete" : "Check", ok);
  renderKeyValue(document.getElementById("artifactCoverage"), rows);
}

function renderUnavailableArtifactCoverage() {
  renderKeyValue(document.getElementById("artifactCoverage"), [
    ["artifact links", "unavailable", "available"],
    ["entry point", "unavailable", "present"],
    ["audio", "unavailable", "present"],
    ["phase reports", "unavailable", "present"],
  ]);
}

function renderSource(response) {
  const info = response.manifestInfo || {};
  const hasPath = Boolean(response.manifestPath);
  const hasRoot = Boolean(response.artifactRoot);
  const bytes = Number(info.bytes);
  const hasBytes = Number.isFinite(bytes) && bytes > 0;
  const modified = formatTimestamp(info.modifiedUtc);
  const hasModified = modified !== "missing" && modified !== "invalid";
  const headers = response.responseHeaders || {};
  const cacheControl = headers.cacheControl || "missing";
  const pragma = headers.pragma || "missing";
  const expires = headers.expires || "missing";
  const cacheOk =
    cacheControl.includes("no-store") &&
    pragma === "no-cache" &&
    expires === "0";
  const ok = hasPath && hasRoot && hasBytes && hasModified && cacheOk;
  const httpStatus = formatHttpStatus(response.responseStatus, response.responseStatusText);
  const loadedAt = formatTimestamp(new Date().toISOString());

  setStatus("sourceStatus", ok ? "Loaded" : "Check", ok);
  setSourceText("manifestPath", "Manifest", response.manifestPath || "missing", "present", hasPath);
  setSourceText("sourceError", "Source Error", "none", "none", true);
  setSourceText("sourceDetail", "Source Detail", "none", "none", true);
  setSourceText("manifestHttpStatus", "HTTP Status", httpStatus, "200 OK", response.responseStatus === 200);
  setSourceText("artifactRoot", "Artifact Root", response.artifactRoot || "missing", "present", hasRoot);
  setSourceText("manifestBytes", "Manifest Bytes", hasBytes ? formatBytes(bytes) : "missing", "positive", hasBytes);
  setSourceText("manifestModified", "Manifest Modified", modified, "valid timestamp", hasModified);
  setSourceText("manifestLoadedAt", "Response Loaded", loadedAt, "valid timestamp", loadedAt !== "missing" && loadedAt !== "invalid");
  setSourceText("manifestCacheControl", "Cache Control", cacheControl, "no-store", cacheControl.includes("no-store"));
  setSourceText("manifestPragma", "Pragma", pragma, "no-cache", pragma === "no-cache");
  setSourceText("manifestExpires", "Expires", expires, "0", expires === "0");
}

function renderArtifacts(links) {
  const packetStatus = document.getElementById("artifactStatus");
  const list = document.getElementById("artifactList");
  list.replaceChildren();
  packetStatus.textContent = links.length > 0 ? "Checking" : "Check";
  packetStatus.className = links.length > 0 ? "pill" : "pill warn";

  if (links.length === 0) {
    return;
  }

  const heading = document.createElement("div");
  heading.className = "artifact-heading";
  for (const text of ["Label", "Kind", "Path", "Modified", "Status"]) {
    const item = document.createElement("span");
    item.textContent = text;
    heading.append(item);
  }
  list.append(heading);

  const checks = [];
  for (const link of links) {
    const row = document.createElement(link.path ? "a" : "div");
    const rowLabel = artifactRowLabel(link);
    row.className = "artifact-row";
    row.dataset.artifactKind = link.kind || "";
    row.dataset.artifactPath = link.path || "";
    row.dataset.artifactLabel = link.label || "";
    row.setAttribute("aria-label", rowLabel);
    row.title = rowLabel;
    if (link.path) {
      row.href = artifactUrl(link.path);
      row.target = "_blank";
      row.rel = "noreferrer";
    } else {
      row.setAttribute("role", "group");
    }

    const label = document.createElement("span");
    label.textContent = link.label || "missing";

    const kind = document.createElement("strong");
    kind.textContent = link.kind || "missing";

    const path = document.createElement("code");
    path.textContent = link.path || "missing";

    const status = document.createElement("span");
    status.className = "artifact-status";
    status.textContent = "Checking";

    const modified = document.createElement("span");
    modified.className = "artifact-modified";
    modified.textContent = "Modified";

    row.append(label, kind, path, modified, status);
    list.append(row);
    checks.push(checkArtifactAvailability(link, status, modified));
  }

  Promise.all(checks)
    .then((results) => renderArtifactPacketStatus(results))
    .catch((error) => {
      packetStatus.textContent = "Check";
      packetStatus.className = "pill warn";
      console.error(error);
    });
}

function renderUnavailableArtifacts() {
  const list = document.getElementById("artifactList");
  list.replaceChildren();

  const heading = document.createElement("div");
  heading.className = "artifact-heading";
  for (const text of ["Label", "Kind", "Path", "Modified", "Status"]) {
    const item = document.createElement("span");
    item.textContent = text;
    heading.append(item);
  }
  list.append(heading);

  const row = document.createElement("div");
  row.className = "artifact-row warn-row";
  row.dataset.artifactKind = "unavailable";
  row.dataset.artifactPath = "";
  row.dataset.artifactLabel = "Artifact packet";
  row.setAttribute("aria-label", "Missing artifact packet (unavailable)");
  row.setAttribute("role", "group");
  row.title = "Missing artifact packet (unavailable)";

  const label = document.createElement("span");
  label.textContent = "Artifact packet";

  const kind = document.createElement("strong");
  kind.textContent = "unavailable";

  const path = document.createElement("code");
  path.textContent = "manifest required";

  const modified = document.createElement("span");
  modified.className = "artifact-modified";
  modified.textContent = "Unavailable";

  const status = document.createElement("span");
  status.className = "artifact-status warn";
  status.textContent = "Check";

  row.append(label, kind, path, modified, status);
  list.append(row);
}

async function checkArtifactAvailability(link, status, modified) {
  if (!link.path) {
    status.textContent = "Check";
    status.className = "artifact-status warn";
    modified.textContent = "Unavailable";
    return { ok: false };
  }

  try {
    const response = await fetch(artifactUrl(link.path), {
      cache: "no-store",
      method: "HEAD",
    });
    if (!response.ok) {
      status.textContent = `Check ${response.status}`;
      status.className = "artifact-status warn";
      modified.textContent = "Unavailable";
      return { ok: false };
    }

    const bytes = Number(response.headers.get("content-length"));
    const size = formatBytes(bytes);
    const modifiedValue = formatTimestamp(response.headers.get("last-modified"));
    status.textContent = size ? `OK ${size}` : "OK";
    status.className = "artifact-status good";
    modified.textContent = modifiedValue;
    modified.className =
      modifiedValue === "missing" || modifiedValue === "invalid"
        ? "artifact-modified warn"
        : "artifact-modified";
    return { ok: true, bytes, modified: modifiedValue };
  } catch (error) {
    status.textContent = "Check";
    status.className = "artifact-status warn";
    modified.textContent = "Unavailable";
    console.error(error);
    return { ok: false };
  }
}

function renderArtifactPacketStatus(results) {
  const status = document.getElementById("artifactStatus");
  const okCount = results.filter((result) => result.ok).length;
  const byteCount = results.reduce(
    (total, result) =>
      total + (Number.isFinite(result.bytes) ? result.bytes : 0),
    0,
  );
  const allOk = okCount === results.length;
  status.textContent = allOk
    ? `${okCount}/${results.length} OK ${formatBytes(byteCount)}`
    : `${okCount}/${results.length} OK`;
  status.className = allOk ? "pill good" : "pill warn";
}

function renderPhaseCoverage(phases, wav) {
  const status = document.getElementById("phaseCoverageStatus");
  const totalFrames = Number(wav?.frames || 0);
  const totalPhaseFrames = phaseFrameTotal(phases);
  const delta = totalPhaseFrames - totalFrames;
  const coverage = totalFrames > 0 ? totalPhaseFrames / totalFrames : 0;
  const ok = phases.length > 0 && totalFrames > 0 && delta === 0;

  setStatus("phaseCoverageStatus", ok ? "Complete" : "Check", ok);
  renderKeyValue(document.getElementById("phaseCoverage"), [
    ["phase count", String(phases.length)],
    ["phase frames", String(totalPhaseFrames)],
    ["wav frames", String(totalFrames)],
    ["coverage", formatPercent(coverage * 100)],
    ["delta", formatSignedNumber(delta), 0],
  ]);
}

function renderUnavailablePhaseCoverage() {
  renderKeyValue(document.getElementById("phaseCoverage"), [
    ["phase count", "unavailable", "present"],
    ["phase frames", "unavailable", "present"],
    ["wav frames", "unavailable", "present"],
    ["delta", "unavailable", "0"],
  ]);
}

function renderPhaseProbe() {
  const probe = document.getElementById("phaseProbe");
  const waveform = state.waveform;
  if (!waveform || state.waveformProbeFrame === null) {
    resetIdleProbePill("phaseProbe", "Phase list probe idle");
    updatePhaseProbeTargets();
    return;
  }

  const frame = clampFrame(state.waveformProbeFrame, waveform);
  const region = waveformRegionAtFrame(frame);
  const source = currentProbeSource();
  probe.textContent = region
    ? `${probeSourceText()} ${formatProbeFrame(frame, waveform, region)}`
    : "probe";
  setProbePillMetadata(
    probe,
    source,
    frame,
    region
      ? `Phase list probe ${source} / ${formatProbeFrame(frame, waveform, region)}`
      : `Phase list probe ${source} / ${formatProbeFrame(frame, waveform, region)} / no phase`,
  );
  updatePhaseProbeTargets();
}

function probePhaseList(event) {
  const waveform = state.waveform;
  if (!waveform) {
    return;
  }

  const startFrame = Number(event.currentTarget.dataset.startFrame);
  const endFrame = Number(event.currentTarget.dataset.endFrame);
  if (!Number.isFinite(startFrame) || !Number.isFinite(endFrame) || endFrame <= startFrame) {
    return;
  }

  state.waveformProbeFrame = clampFrame(Math.round(startFrame + (endFrame - startFrame) / 2), waveform);
  state.waveformProbeSource = inspectionSources.phaseList;
  state.signalPlotProbe = signalPlotProbeAtFrame(state.waveformProbeFrame);
  renderWaveformProbe();
  renderLevelEnvelopeProbe();
  renderPhaseProbe();
  renderPhaseAudioStatsProbe();
  renderParameterTimelineProbe();
  drawWaveform();
  drawLevelEnvelope();
  drawSignalPlot();
  renderSignalPlotProbe();
}

function clearPhaseListProbe() {
  if (state.waveformPointerActive) {
    return;
  }

  resetSharedProbeState();
  renderWaveformProbe();
  renderLevelEnvelopeProbe();
  renderPhaseProbe();
  renderPhaseAudioStatsProbe();
  renderParameterTimelineProbe();
  drawWaveform();
  drawLevelEnvelope();
  drawSignalPlot();
  renderSignalPlotProbe();
}

function renderPhases(phases, wav) {
  const status = document.getElementById("phaseStatus");
  const list = document.getElementById("phaseList");
  list.replaceChildren();
  const sampleRate = Number(wav?.sampleRate || 0);
  const totalFrames = Number(wav?.frames || 0);
  const spans = buildPhaseSpans(phases, totalFrames);
  const totalPhaseFrames = phaseFrameTotal(phases);
  const ok = phases.length > 0 && totalFrames > 0 && totalPhaseFrames === totalFrames;
  setStatus("phaseStatus", ok ? `${phases.length} OK` : "Check", ok);

  for (const [index, phase] of phases.entries()) {
    const span = spans[index];
    const duration =
      sampleRate > 0 ? formatSeconds(span.frames / sampleRate) : "unavailable";
    const startTime =
      sampleRate > 0 ? formatSeconds(span.startFrame / sampleRate) : "unavailable";
    const endTime =
      sampleRate > 0 ? formatSeconds(span.endFrame / sampleRate) : "unavailable";
    const share =
      totalFrames > 0
        ? formatPercent((span.frames / totalFrames) * 100)
        : "unavailable";
    const itemLabel =
      `Phase ${phase.name || "phase"} from frame ${span.startFrame} to ${span.endFrame}`;
    const item = document.createElement("div");
    item.className = "phase";
    item.dataset.phaseIndex = String(index);
    item.dataset.phaseName = phase.name || "";
    item.dataset.startFrame = String(span.startFrame);
    item.dataset.endFrame = String(span.endFrame);
    item.dataset.startTime = startTime;
    item.dataset.endTime = endTime;
    item.dataset.duration = duration;
    item.dataset.wavShare = share;
    item.setAttribute("aria-label", itemLabel);
    item.setAttribute("role", "group");
    item.title = `${itemLabel} / ${startTime} to ${endTime} / ${duration}`;
    item.addEventListener("pointermove", probePhaseList);
    item.addEventListener("pointerleave", clearPhaseListProbe);

    const name = document.createElement("h3");
    name.textContent = phase.name;

    const body = document.createElement("dl");
    body.className = "kv compact";
    renderKeyValue(body, [
      ["preflight", boolText(phase.preflightOk), true],
      ["apply", boolText(phase.applyOk), true],
      ["process", boolText(phase.processOk), true],
      ["bindings", String(phase.bindingsChecked)],
      ["parameters", String(phase.parametersApplied)],
      ["samples", String(phase.samplesProcessed)],
      ["time range", formatPhaseRange(span, sampleRate)],
      ["duration", duration],
      ["wav share", share],
    ]);

    item.append(name, body);
    list.append(item);
  }
  renderPhaseProbe();
}

function renderUnavailablePhases() {
  const list = document.getElementById("phaseList");
  list.replaceChildren();

  const item = document.createElement("div");
  item.className = "phase warn-row";
  item.dataset.phaseIndex = "none";
  item.dataset.phaseName = "unavailable";
  item.dataset.startFrame = "none";
  item.dataset.endFrame = "none";
  item.dataset.startTime = "unavailable";
  item.dataset.endTime = "unavailable";
  item.dataset.duration = "unavailable";
  item.dataset.wavShare = "unavailable";
  item.setAttribute("aria-label", "Phase list unavailable: manifest required");
  item.setAttribute("role", "group");
  item.title = "Phase list unavailable: manifest required";

  const name = document.createElement("h3");
  name.textContent = "Phases unavailable";

  const body = document.createElement("dl");
  body.className = "kv compact";
  renderKeyValue(body, [
    ["phase count", "unavailable", "present"],
    ["frame ranges", "unavailable", "present"],
    ["resync proof", "unavailable", "present"],
  ]);

  item.append(name, body);
  list.append(item);
  renderPhaseProbe();
}

function render(response) {
  state.response = response;
  const manifest = response.manifest;
  const handoff = manifest.sandboxHandoff;
  const checklist = validateConsumerChecklist(manifest);

  setStatus("manifestStatus", statusText(manifest.allOk), manifest.allOk);
  setStatus(
    "contractStatus",
    `${handoff.contract} v${handoff.contractVersion}`,
    handoff.contract === expectedContract &&
      handoff.contractVersion === expectedContractVersion,
  );
  setStatus(
    "inspectionMode",
    handoff.inspectionMode,
    handoff.inspectionMode === expectedInspectionMode,
  );
  setText("frameCount", String(manifest.wav.frames));
  setStatus(
    "checklistStatus",
    checklist.accepted ? "Accepted" : "Check",
    checklist.accepted,
  );
  labelPrimaryAudioTitle(handoff.primaryAudioArtifact, true);
  renderSource(response);
  renderHandsOnReadiness(manifest, false);

  const audio = document.getElementById("audioPlayer");
  audio.src = artifactUrl(handoff.primaryAudioArtifact);
  labelPrimaryAudio(handoff.primaryAudioArtifact, true);
  renderAudioPosition();
  renderWaveform(handoff.primaryAudioArtifact);

  renderKeyValue(
    document.getElementById("boundaryFlags"),
    requiredFlags.map(([key, expected]) => [
      key,
      boolText(handoff[key]),
      expected,
    ]),
  );
  renderProducerProof(manifest);
  renderCircuitChain(manifest);
  renderSandboxContract(manifest);
  renderParameterTimeline(manifest);
  renderPhaseCoverage(manifest.phases || [], manifest.wav);
  renderPhases(manifest.phases || [], manifest.wav);
  renderChecklist(checklist);
  renderArtifactCoverage(manifest);
  renderParameterSummary(manifest, manifest.artifactLinks || []);
  renderReports(manifest.artifactLinks || []);
  renderArtifacts(manifest.artifactLinks || []);
}

function manifestShapeError(payload) {
  const manifest = payload.manifest;
  if (!manifest || typeof manifest !== "object") {
    return "manifest object missing";
  }

  const handoff = manifest.sandboxHandoff;
  if (!handoff || typeof handoff !== "object") {
    return "sandbox handoff missing";
  }

  if (typeof handoff.entryPoint !== "string" || !handoff.entryPoint) {
    return "sandbox entry point missing";
  }

  if (
    typeof handoff.primaryAudioArtifact !== "string" ||
    !handoff.primaryAudioArtifact
  ) {
    return "primary audio artifact missing";
  }

  if (!manifest.wav || typeof manifest.wav !== "object") {
    return "wav metadata missing";
  }

  if (!isPositiveFiniteNumber(manifest.wav.frames)) {
    return "wav frame count missing";
  }

  for (const [key, message] of [
    ["sampleRate", "wav sample rate missing"],
    ["channels", "wav channel count missing"],
    ["bitDepth", "wav bit depth missing"],
    ["dataBytes", "wav data byte count missing"],
    ["fileBytes", "wav file byte count missing"],
  ]) {
    if (!isPositiveFiniteNumber(manifest.wav[key])) {
      return message;
    }
  }

  if (!Array.isArray(manifest.artifactLinks)) {
    return "artifact links missing";
  }

  for (const kind of ["entry-point", "audio", "manifest", "text-summary", "wav-report"]) {
    if (countArtifactKind(manifest.artifactLinks, kind) !== 1) {
      return `${kind} artifact link count mismatch`;
    }
  }

  if (findArtifactPath(manifest.artifactLinks, "entry-point") !== handoff.entryPoint) {
    return "entry-point link mismatch";
  }

  if (
    findArtifactPath(manifest.artifactLinks, "audio") !==
    handoff.primaryAudioArtifact
  ) {
    return "audio link mismatch";
  }

  if (!Array.isArray(manifest.phases)) {
    return "phases missing";
  }

  const phaseReportIssue = phaseReportCoverageIssue(manifest);
  if (phaseReportIssue) {
    return phaseReportIssue;
  }

  const parameterResyncIssue = parameterResyncContractIssue(manifest);
  if (parameterResyncIssue) {
    return parameterResyncIssue;
  }

  const phaseAudioIssues = phaseAudioMeasurementIssues(manifest);
  if (phaseAudioIssues.length) {
    return phaseAudioIssues[0];
  }

  const callerProcessingIssue = callerProcessingOrderIssue(manifest);
  if (callerProcessingIssue) {
    return callerProcessingIssue;
  }

  return "";
}

function callerProcessingOrderIssue(manifest) {
  const expectedByDemo = {
    runtime_dsp_object_circuit_connected_wav_demo: [
      {
        sourceNode: "Tiny Oscillator",
        sourcePort: "Out",
        destinationNode: "Tiny Gain",
        destinationPort: "A",
        callerStep: "oscillator.processSample -> gain.processSample",
      },
      {
        sourceNode: "Tiny Gain",
        sourcePort: "Out",
        destinationNode: "Audio Out",
        destinationPort: "In",
        callerStep: "gain.processSample -> output sample",
      },
    ],
    runtime_dsp_object_circuit_connected_bias_wav_demo: [
      {
        sourceNode: "Tiny Oscillator",
        sourcePort: "Out",
        destinationNode: "Tiny Gain",
        destinationPort: "A",
        callerStep: "oscillator.processSample -> gain.processSample",
      },
      {
        sourceNode: "Tiny Gain",
        sourcePort: "Out",
        destinationNode: "Tiny Bias",
        destinationPort: "A",
        callerStep: "gain.processSample -> bias.processSample",
      },
      {
        sourceNode: "Tiny Bias",
        sourcePort: "Out",
        destinationNode: "Audio Out",
        destinationPort: "In",
        callerStep: "bias.processSample -> output sample",
      },
    ],
  };
  const expectedSteps = expectedByDemo[manifest?.demo];
  if (!expectedSteps) {
    return "";
  }

  const connections = manifest.circuitConnections;
  if (!connections || typeof connections !== "object") {
    return "circuit connections missing";
  }
  if (Number(connections.count) !== expectedSteps.length) {
    return "circuit connection count mismatch";
  }
  if (connections.describesProcessingChain !== true) {
    return "circuit connection chain flag missing";
  }

  const proof = manifest.callerProcessingOrderProof;
  if (!proof || typeof proof !== "object") {
    return "caller processing proof missing";
  }
  if (proof.matchesCircuitConnections !== true) {
    return "caller processing order mismatch";
  }

  const order = manifest.callerProcessingOrder;
  if (!order || typeof order !== "object") {
    return "caller processing order missing";
  }
  if (order.matchesCircuitConnections !== true) {
    return "caller processing order match flag missing";
  }
  if (order.callerOwnsProcessingOrder !== true) {
    return "caller processing ownership missing";
  }

  const steps = order.steps;
  if (!Array.isArray(steps) || steps.length !== expectedSteps.length) {
    return "caller processing step count mismatch";
  }

  for (const [index, expected] of expectedSteps.entries()) {
    const step = steps[index];
    if (!step || typeof step !== "object") {
      return "caller processing step invalid";
    }
    if (Number(step.index) !== index) {
      return "caller processing step index mismatch";
    }
    for (const key of ["sourceNode", "sourcePort", "destinationNode", "destinationPort", "callerStep"]) {
      if (step[key] !== expected[key]) {
        return "caller processing step mismatch";
      }
    }
  }

  return "";
}

function parameterResyncContractIssue(manifest) {
  const resync = manifest?.parameterResync;
  if (!resync || typeof resync !== "object") {
    return "parameter resync missing";
  }

  for (const key of ["frequency", "amplitude"]) {
    const values = resync[key];
    if (!values || typeof values !== "object") {
      return `${key} resync missing`;
    }
    if (values.changed !== true) {
      return `${key} resync changed flag missing`;
    }

    const first = Number(values.first);
    const second = Number(values.second);
    if (!Number.isFinite(first) || first <= 0) {
      return `${key} first value invalid`;
    }
    if (!Number.isFinite(second) || second <= 0) {
      return `${key} second value invalid`;
    }
    if (second <= first) {
      return `${key} did not resync upward`;
    }
  }

  return "";
}

function phaseReportCoverageIssue(manifest) {
  const phases = Array.isArray(manifest?.phases) ? manifest.phases : [];
  const links = Array.isArray(manifest?.artifactLinks) ? manifest.artifactLinks : [];
  const phaseReports = links.filter(
    (link) => link?.kind === "phase-report" && Boolean(link.path),
  );

  if (phaseReports.length !== phases.length) {
    return "phase report count mismatch";
  }

  const phaseNames = new Set();
  for (const phase of phases) {
    if (typeof phase?.name !== "string" || !phase.name) {
      return "phase name missing";
    }
    phaseNames.add(phase.name);
  }

  const reportPhases = new Set();
  for (const link of phaseReports) {
    if (typeof link.phase !== "string" || !link.phase) {
      return "phase report phase missing";
    }
    if (!phaseNames.has(link.phase)) {
      return "phase report phase unknown";
    }
    if (reportPhases.has(link.phase)) {
      return "phase report phase duplicate";
    }
    reportPhases.add(link.phase);
  }

  for (const name of phaseNames) {
    if (!reportPhases.has(name)) {
      return "phase report phase missing";
    }
  }

  return "";
}

function phaseAudioMeasurementIssues(manifest) {
  const phases = Array.isArray(manifest?.phases) ? manifest.phases : [];
  const measurements = manifest?.phaseAudioMeasurements;
  const resync = manifest?.parameterResync || {};
  const frequency = resync.frequency || {};
  const amplitude = resync.amplitude || {};
  const bias = resync.bias || {};

  if (!Array.isArray(measurements)) {
    return ["phase audio measurements missing"];
  }

  if (measurements.length !== phases.length) {
    return ["phase audio measurement count mismatch"];
  }

  const measurementsByName = new Map();
  for (const measurement of measurements) {
    if (!measurement || typeof measurement !== "object") {
      return ["phase audio measurement invalid"];
    }
    if (typeof measurement.name !== "string" || !measurement.name) {
      return ["phase audio measurement name missing"];
    }
    measurementsByName.set(measurement.name, measurement);
  }

  for (const phase of phases) {
    const name = phase?.name;
    if (typeof name !== "string" || !name) {
      return ["phase name missing"];
    }

    const measurement = measurementsByName.get(name);
    if (!measurement) {
      return [`${name} phase audio measurement missing`];
    }

    const measuredFrequency = Number(measurement.measuredFrequency);
    const peak = Number(measurement.peak);
    const rms = Number(measurement.rms);
    const min = Number(measurement.min);
    const max = Number(measurement.max);
    const dcOffset = Number(measurement.dcOffset);
    if (
      !Number.isFinite(measuredFrequency) ||
      !Number.isFinite(peak) ||
      !Number.isFinite(rms) ||
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      !Number.isFinite(dcOffset)
    ) {
      return [`${name} phase audio measurement values missing`];
    }

    if (measuredFrequency <= 0 || peak <= 0 || rms <= 0) {
      return [`${name} phase audio measurement values invalid`];
    }

    const targetFrequency = Number(frequency[name]);
    const targetAmplitude = Number(amplitude[name]);
    const targetBias =
      bias[name] === undefined || bias[name] === null ? 0 : Number(bias[name]);
    const targetPeak =
      targetAmplitude + (Number.isFinite(targetBias) ? Math.abs(targetBias) : 0);
    if (
      !Number.isFinite(targetFrequency) ||
      Math.abs(measuredFrequency - targetFrequency) > phaseAudioFrequencyToleranceHz
    ) {
      return [`${name} phase audio frequency mismatch`];
    }
    if (
      !Number.isFinite(targetAmplitude) ||
      !Number.isFinite(targetPeak) ||
      Math.abs(peak - targetPeak) > phaseAudioAmplitudeTolerance
    ) {
      return [`${name} phase audio peak mismatch`];
    }
    if (
      !Number.isFinite(targetBias) ||
      Math.abs(dcOffset - targetBias) > phaseAudioAmplitudeTolerance
    ) {
      return [`${name} phase audio dc offset mismatch`];
    }
  }

  return [];
}

function renderError(message, details = {}) {
  state.response = null;
  state.waveform = null;
  state.playheadFrame = 0;
  resetWaveformTransientState();
  state.reports = [];
  state.activeReportIndex = 0;

  setStatus("manifestStatus", "Check", false);
  setStatus("contractStatus", message, false);
  setStatus("inspectionMode", "Unavailable", false);
  setText("frameCount", "0");
  setStatus("checklistStatus", "Check", false);
  setStatus("producerStatus", "Check", false);
  setStatus("circuitChainStatus", "Check", false);
  setStatus("handsOnReadinessStatus", "Check", false);
  setInspectionCursorSource("none", "none");
  setInspectionCursorDelta(null, 1);
  setInspectionCursorAudio(0, Number.NaN);
  setInspectionCursorPlayback(null);
  setInspectionCursorPreview(false);
  setInspectionCursorSeek(null);
  setInspectionCursorSeekTarget(null, null, 1);
  setInspectionCursorSeekSync("none");
  setInspectionCursorTransport(null, null, 1);
  setInspectionCursorTarget(null, null, 1);
  setInspectionCursorDivergence(null, null);
  setStatus("sandboxContractStatus", "Check", false);
  setStatus("parameterSummaryStatus", "Check", false);
  setStatus("parameterTimelineStatus", "Check", false);
  setText("parameterTimelinePhase", "phase");
  resetIdleProbePill("parameterTimelineProbe", "Parameter timeline probe idle");
  setStatus("waveformStatus", "Check", false);
  resetIdleProbePill("waveformProbe", "Waveform probe idle");
  setStatus("levelEnvelopeStatus", "Check", false);
  setText("levelEnvelopePeak", "peak 0");
  setText("levelEnvelopeRms", "rms 0");
  resetIdleProbePill("levelEnvelopeProbe", "Level envelope probe idle");
  setStatus("currentParameterStatus", "Check", false);
  setText("currentFrequency", "freq");
  setText("currentAmplitude", "amp");
  setText("currentMeasuredFrequency", "measured freq");
  setText("currentMeasuredPeak", "peak");
  setText("currentMeasuredFrequencyDelta", "freq delta");
  setText("currentMeasuredPeakDelta", "peak delta");
  setStatus("currentMeasuredStatus", "measured", false);
  setText("waveformPhaseJumpTarget", "jump idle");
  setStatus("signalPlotStatus", "Check", false);
  setText("signalPlotModeSummary", "all / trace / x1");
  setText("signalPlotWindowSummary", "window full");
  setText("signalPlotLagSummary", "lag 1 ms");
  setText("signalPlotPoint", "frame 0 / phase none / x 0 / y 0");
  resetIdleProbePill("signalPlotProbe", "Signal plot probe idle");
  resetProbePill("signalPlotProbeSource", "near frame", "Signal plot source probe idle");
  setStatus("phaseCoverageStatus", "Check", false);
  setStatus("phaseAudioStatsStatus", "Check", false);
  resetIdleProbePill("phaseAudioStatsProbe", "Phase audio stats probe idle");
  resetIdleProbePill("phaseProbe", "Phase list probe idle");
  setStatus("phaseStatus", "Check", false);
  setStatus("artifactCoverageStatus", "Check", false);
  setStatus("reportStatus", "Check", false);
  setStatus("artifactStatus", "Check", false);
  setStatus("sourceStatus", "Check", false);
  labelPrimaryAudioTitle("", false);
  setSourceText(
    "manifestPath",
    "Manifest",
    details.path || details.manifestPath || "Unavailable",
    "present",
    false,
  );
  setSourceText(
    "sourceError",
    "Source Error",
    message || details.message || "Unavailable",
    "none",
    false,
  );
  setSourceText("sourceDetail", "Source Detail", details.message || "none", "none", false);
  setSourceText(
    "manifestHttpStatus",
    "HTTP Status",
    formatHttpStatus(details.responseStatus, details.responseStatusText),
    "200 OK",
    false,
  );
  setSourceText("manifestBytes", "Manifest Bytes", "Unavailable", "positive", false);
  setSourceText("manifestModified", "Manifest Modified", "Unavailable", "valid timestamp", false);
  setSourceText("manifestLoadedAt", "Response Loaded", "Unavailable", "valid timestamp", false);
  setSourceText("manifestCacheControl", "Cache Control", "Unavailable", "no-store", false);
  setSourceText("manifestPragma", "Pragma", "Unavailable", "no-cache", false);
  setSourceText("manifestExpires", "Expires", "Unavailable", "0", false);
  setSourceText("artifactRoot", "Artifact Root", details.artifactRoot || "Unavailable", "present", false);

  const audio = document.getElementById("audioPlayer");
  audio.removeAttribute("src");
  labelPrimaryAudio("", false);
  audio.load();
  renderAudioPosition();

  renderUnavailableProducerProof();
  renderUnavailableCircuitChain();
  renderUnavailableHandsOnReadiness();
  renderUnavailableSandboxContract();
  renderUnavailableParameterSummary();
  renderUnavailableParameterTimeline();
  renderReportControls();
  renderActiveReport();
  renderWaveformPhaseControls();
  renderWaveformPosition();
  renderUnavailableWaveformMeta();
  renderUnavailableLevelEnvelopeMeta();
  renderLevelEnvelopeProbe();
  renderUnavailablePhaseAudioStats();
  renderSignalPlotControls();
  clearSignalPlotProbe();
  renderUnavailableSignalPlotMeta();
  renderUnavailableBoundaryFlags();
  renderUnavailablePhaseCoverage();
  renderUnavailablePhases();
  renderUnavailableChecklist();
  renderUnavailableArtifactCoverage();
  renderUnavailableArtifacts();
}

function renderRefreshButton(loading = state.manifestLoading) {
  const button = document.getElementById("refreshButton");
  const label = loading ? "Loading manifest" : "Reload manifest";
  button.disabled = loading;
  button.textContent = loading ? "Loading Manifest" : "Reload Manifest";
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-busy", String(loading));
  button.dataset.loading = String(loading);
  button.title = loading ? "Manifest reload in progress" : "Reload manifest and artifacts";
}

async function loadManifest() {
  if (state.manifestLoading) {
    return;
  }

  state.manifestLoading = true;
  renderRefreshButton();
  try {
    const response = await fetch("/api/manifest", { cache: "no-store" });
    const payload = await response.json();
    payload.responseStatus = response.status;
    payload.responseStatusText = response.statusText;
    payload.responseHeaders = {
      cacheControl: response.headers.get("cache-control") || "",
      expires: response.headers.get("expires") || "",
      pragma: response.headers.get("pragma") || "",
    };
    if (!response.ok || !payload.ok) {
      renderError(payload.error || "Manifest failed", payload);
      return;
    }
    const shapeError = manifestShapeError(payload);
    if (shapeError) {
      renderError(shapeError, payload);
      return;
    }
    render(payload);
  } catch (error) {
    renderError(error instanceof Error ? error.message : String(error));
  } finally {
    state.manifestLoading = false;
    renderRefreshButton();
  }
}

document
  .getElementById("refreshButton")
  .addEventListener("click", loadManifest);

document
  .getElementById("waveformCanvas")
  .addEventListener("click", seekWaveform);

document
  .getElementById("waveformCanvas")
  .addEventListener("pointerdown", beginWaveformDrag);

document
  .getElementById("waveformCanvas")
  .addEventListener("pointermove", dragWaveform);

document
  .getElementById("waveformCanvas")
  .addEventListener("pointerleave", clearWaveformProbe);

document
  .getElementById("waveformCanvas")
  .addEventListener("pointerup", endWaveformDrag);

document
  .getElementById("waveformCanvas")
  .addEventListener("pointercancel", endWaveformDrag);

document
  .getElementById("waveformScrubber")
  .addEventListener("input", scrubWaveform);

document
  .getElementById("waveformScrubber")
  .addEventListener("pointerdown", beginScrubberDrag);

document
  .getElementById("waveformScrubber")
  .addEventListener("pointerup", endScrubberDrag);

document
  .getElementById("waveformScrubber")
  .addEventListener("pointercancel", endScrubberDrag);

document
  .getElementById("waveformScrubber")
  .addEventListener("lostpointercapture", endScrubberDrag);

document
  .getElementById("levelEnvelopeCanvas")
  .addEventListener("pointermove", (event) => probeLevelEnvelopeAtClientX(event.clientX));

document
  .getElementById("levelEnvelopeCanvas")
  .addEventListener("pointerleave", clearLevelEnvelopeProbe);

document
  .getElementById("signalPlotCanvas")
  .addEventListener("pointermove", probeSignalPlot);

document
  .getElementById("signalPlotCanvas")
  .addEventListener("pointerleave", clearSignalPlotProbe);

document.addEventListener("pointermove", clearPhaseButtonProbeFromOutside);

document
  .getElementById("followAudioButton")
  .addEventListener("click", toggleFollowAudio);

document
  .getElementById("waveformPlayButton")
  .addEventListener("click", togglePrimaryAudioPlayback);

document
  .getElementById("audioPlayer")
  .addEventListener("timeupdate", syncWaveformToAudio);

document
  .getElementById("audioPlayer")
  .addEventListener("seeked", syncWaveformToAudio);

document
  .getElementById("audioPlayer")
  .addEventListener("loadedmetadata", renderAudioPosition);

document
  .getElementById("audioPlayer")
  .addEventListener("play", renderAudioPosition);

document
  .getElementById("audioPlayer")
  .addEventListener("pause", renderAudioPosition);

document
  .getElementById("audioPlayer")
  .addEventListener("ended", syncWaveformToAudioEnd);

window.addEventListener("resize", () => {
  drawWaveform();
  drawLevelEnvelope();
  drawSignalPlot();
  updateParameterTimelinePlayhead(activeWaveformRegion());
  drawNodeGraphWires();
  drawNodeRenderedAudio();
});

const nodeGraphNodeLabels = Object.freeze({
  osc: "Osc",
  noise: "Noise",
  gain: "Gain",
  bias: "Bias",
  output: "Output",
});

const nodeGraphModuleDefinitions = Object.freeze({
  osc: {
    outputs: ["Out"],
    parameters: [
      {
        choices: ["Saw", "Square", "Triangle", "Sine", "Noise"],
        defaultValue: "0",
        displayChoices: true,
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
        defaultValue: "220",
        key: "frequency",
        label: "Frequency",
        max: "880",
        mid: "220",
        min: "80",
        step: "1",
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
        label: "Level",
        max: "0.8",
        mid: "0.35",
        min: "0",
        step: "0.01",
      },
    ],
  },
  noise: {
    outputs: ["Out"],
    parameters: [
      {
        defaultValue: "0.12",
        key: "level",
        label: "Level",
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
  output: {
    inputs: ["Left", "Right"],
    output: true,
    parameters: [],
  },
});

const nodeGraphOutputInputPorts = Object.freeze(["Left", "Right"]);
const nodeGraphAudioBlockSize = 512;

const nodeGraphGrid = Object.freeze({
  sizePx: 28,
});

const nodeGraphDefaultNodeConfigs = Object.freeze([
  { id: "osc", type: "osc", gx: 2, gy: 1 },
  { id: "noise", type: "noise", gx: 2, gy: 12 },
  { id: "gain", type: "gain", gx: 16, gy: 7 },
  { id: "bias", type: "bias", gx: 27, gy: 7 },
  { id: "output", type: "output", gx: 36, gy: 8 },
]);

const nodeGraphDefaultConnections = Object.freeze([
  { sourceNode: "osc", sourcePort: "Out", destinationNode: "gain", destinationPort: "In" },
  { sourceNode: "gain", sourcePort: "Out", destinationNode: "bias", destinationPort: "In" },
  { sourceNode: "bias", sourcePort: "Out", destinationNode: "output", destinationPort: "Left" },
  { sourceNode: "bias", sourcePort: "Out", destinationNode: "output", destinationPort: "Right" },
]);

const nodeGraphDefaultPatch = Object.freeze({
  info: {
    author: "",
    description: "",
    name: "Patch name",
    tags: "tags",
  },
  grid: { ...nodeGraphGrid },
  nodes: nodeGraphDefaultNodeConfigs.map((node) => ({ ...node })),
  connections: nodeGraphDefaultConnections.map((connection) => ({ ...connection })),
  modulations: [],
});

const fallbackNodeMetadataKindTemplates = Object.freeze({
  decimal: { def: 0, label: "Decimal", linearSmoothing: true, max: 1, mid: 0.5, min: 0, step: 0.01, unit: "" },
  decimal_bipolar: {
    def: 0,
    label: "Decimal Bipolar",
    linearSmoothing: true,
    max: 1,
    mid: 0,
    min: -1,
    showPlusMinus: true,
    step: 0.01,
    unit: "",
  },
  amplitude: { def: 1, label: "Amplitude", linearSmoothing: true, max: 3, mid: 1, min: 0, step: 0.01, unit: "amp" },
  decibels: {
    def: 0,
    label: "Decibels",
    linearSmoothing: true,
    max: 12,
    mid: 0,
    min: -60,
    step: 0.1,
    unit: "dB",
  },
  frequency: { def: 1000, label: "Frequency", linearSmoothing: true, max: 20000, mid: 1000, min: 0, step: 1, unit: "Hz" },
  phase: {
    def: 0,
    label: "Phase",
    linearSmoothing: true,
    max: 1,
    mid: 0.5,
    min: 0,
    step: 0.01,
    unit: "cycle",
    wraparound: true,
  },
  pitch: {
    def: 0,
    label: "Pitch",
    linearSmoothing: true,
    max: 12,
    mid: 0,
    min: -12,
    step: 0.1,
    unit: "st",
  },
  seconds: { def: 0, label: "Seconds", linearSmoothing: true, max: 5, mid: 2.5, min: 0, step: 0.01, unit: "s" },
  sustain: { def: 1, label: "Sustain", linearSmoothing: true, max: 1, mid: 0.7, min: 0, step: 0.01, unit: "amp" },
  descrete: { def: 0, label: "Descrete", linearSmoothing: false, max: 9, mid: 4, min: 0, step: 1, unit: "idx" },
  integer_bipolar: {
    def: 0,
    label: "Integer Bipolar",
    linearSmoothing: false,
    max: 9,
    mid: 0,
    min: -9,
    showPlusMinus: true,
    step: 1,
    unit: "idx",
  },
  waveform: {
    choices: ["Saw", "Square", "Triangle", "Sine", "Noise"],
    def: 0,
    displayChoices: true,
    label: "Waveform",
    linearSmoothing: false,
    max: 9,
    mid: 4,
    min: 0,
    step: 1,
    unit: "",
  },
  bypass: {
    choices: ["active", "BYPASSED"],
    def: 0,
    displayChoices: true,
    label: "Bypass",
    linearSmoothing: false,
    max: 1,
    mid: 0.5,
    min: 0,
    step: 1,
    unit: "bypass",
  },
  plusminus: {
    choices: ["-", "+"],
    def: -1,
    displayChoices: true,
    label: "Plus Minus",
    linearSmoothing: false,
    max: 1,
    mid: 0,
    min: -1,
    showPlusMinus: true,
    step: 1,
    unit: "plusminus",
  },
  onoff: {
    choices: ["off", "on"],
    def: 1,
    displayChoices: true,
    label: "On Off",
    linearSmoothing: false,
    max: 1,
    mid: 0.5,
    min: 0,
    step: 1,
    unit: "onoff",
  },
  momentary: {
    choices: ["idle", "on"],
    def: 0,
    displayChoices: true,
    label: "Momentary",
    linearSmoothing: false,
    max: 1,
    mid: 0.5,
    min: 0,
    step: 1,
    unit: "momentary",
  },
});
const nodeMetadataKindAliases = Object.freeze({
  bipolar: "decimal_bipolar",
  gain: "amplitude",
});
let nodeMetadataKindTemplates = fallbackNodeMetadataKindTemplates;

function nodeGraphOneLineText(value) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim();
}

function normalizeNodeGraphPatchInfo(info = {}) {
  return {
    author: nodeGraphOneLineText(info.author),
    description: String(info.description ?? "").trim(),
    name: nodeGraphOneLineText(info.name),
    tags: nodeGraphOneLineText(info.tags),
  };
}

function cloneNodeGraphPatch(patch) {
  return {
    connections: (patch.connections || []).map((connection) => ({ ...connection })),
    grid: { sizePx: Number(patch.grid?.sizePx) || nodeGraphGrid.sizePx },
    info: normalizeNodeGraphPatchInfo(patch.info),
    modulations: (patch.modulations || []).map((modulation) => ({ ...modulation })),
    nodes: (patch.nodes || []).map((node) => ({ ...node })),
  };
}

const nodeGraphMvp = {
  activeNodes: new Set(nodeGraphDefaultPatch.nodes.map((node) => node.id)),
  audioContext: null,
  bufferSource: null,
  connections: nodeGraphDefaultPatch.connections.map((connection) => ({ ...connection })),
  dragging: null,
  historyIndex: -1,
  historyLimit: 100,
  historySnapshots: [],
  live: {
    context: null,
    inputActive: false,
    meterGain: null,
    node: null,
    outputGain: null,
    runtime: null,
    scriptNode: null,
    syncFrame: 0,
    syncTimer: 0,
  },
  marqueeSelection: null,
  metadataDragging: null,
  metadataEditorTarget: null,
  metadataPopoverPosition: null,
  modulations: nodeGraphDefaultPatch.modulations.map((modulation) => ({ ...modulation })),
  nodeDragging: null,
  nodeTypeCounts: {
    bias: 1,
    gain: 1,
    noise: 1,
    osc: 1,
  },
  patch: cloneNodeGraphPatch(nodeGraphDefaultPatch),
  rendered: null,
  sceneContextPoint: null,
  sceneContextTargetNode: null,
  selected: null,
  sampleRate: 44100,
  seconds: 2,
  sliderDragging: null,
  zoom: 1,
};

const nodeGraphZoomLimits = Object.freeze({
  max: 1.8,
  min: 0.55,
  step: 0.08,
});

function nodeGraphGridSize() {
  const size = Number(nodeGraphMvp.patch?.grid?.sizePx);
  return Number.isFinite(size) && size > 0 ? size : nodeGraphGrid.sizePx;
}

function nodeGraphGridSnapOffset() {
  return 6;
}

function nodeGraphGridToPixel(point) {
  const size = nodeGraphGridSize();
  const offset = nodeGraphGridSnapOffset();
  return {
    x: point.gx * size + offset,
    y: point.gy * size + offset,
  };
}

function nodeGraphPixelToGrid(point) {
  const size = nodeGraphGridSize();
  const offset = nodeGraphGridSnapOffset();
  return {
    gx: Math.round((point.x - offset) / size),
    gy: Math.round((point.y - offset) / size),
  };
}

function snapNodeGraphPointToGrid(point) {
  return nodeGraphGridToPixel(nodeGraphPixelToGrid(point));
}

function nodeGraphPatchNode(id) {
  return nodeGraphMvp.patch.nodes.find((node) => node.id === id) || null;
}

function nodeGraphPatchNodeType(id) {
  return nodeGraphPatchNode(id)?.type || id;
}

function nextNodeGraphTypeCounts(nodes = nodeGraphMvp.patch.nodes) {
  const counts = {};
  for (const node of nodes) {
    const match = node.id.match(new RegExp(`^${node.type}-(\\d+)$`));
    const count = match ? Number(match[1]) : node.id === node.type ? 1 : 0;
    counts[node.type] = Math.max(counts[node.type] || 0, count);
  }
  return {
    bias: counts.bias || 0,
    gain: counts.gain || 0,
    noise: counts.noise || 0,
    osc: counts.osc || 0,
  };
}

function syncNodeGraphRuntimeFromPatch() {
  nodeGraphMvp.activeNodes = new Set(nodeGraphMvp.patch.nodes.map((node) => node.id));
  nodeGraphMvp.connections = nodeGraphMvp.patch.connections.map((connection) => ({ ...connection }));
  nodeGraphMvp.modulations = nodeGraphMvp.patch.modulations.map((modulation) => ({ ...modulation }));
  nodeGraphMvp.nodeTypeCounts = nextNodeGraphTypeCounts();
}

function serializeNodeGraphPatch(patch = nodeGraphMvp.patch) {
  return JSON.stringify(
    {
      connections: patch.connections,
      grid: patch.grid,
      info: normalizeNodeGraphPatchInfo(patch.info),
      modulations: patch.modulations || [],
      nodes: patch.nodes,
    },
    null,
    2,
  );
}

function validateNodeGraphPatch(patch) {
  if (!patch || typeof patch !== "object") {
    throw new Error("patch must be an object");
  }

  const gridSize = Number(patch.grid?.sizePx);
  if (!Number.isFinite(gridSize) || gridSize <= 0) {
    throw new Error("grid.sizePx must be a positive number");
  }

  if (!Array.isArray(patch.nodes) || patch.nodes.length === 0) {
    throw new Error("nodes must be a non-empty array");
  }

  const ids = new Set();
  const nodes = patch.nodes.map((node) => {
    const id = String(node.id || "").trim();
    const type = String(node.type || "").trim();
    if (!id) {
      throw new Error("node id missing");
    }
    if (ids.has(id)) {
      throw new Error(`duplicate node id ${id}`);
    }
    if (!Object.hasOwn(nodeGraphModuleDefinitions, type)) {
      throw new Error(`unknown node type ${type}`);
    }
    const gx = Math.round(Number(node.gx));
    const gy = Math.round(Number(node.gy));
    if (!Number.isFinite(gx) || !Number.isFinite(gy)) {
      throw new Error(`node ${id} grid position invalid`);
    }
    ids.add(id);
    return { gx, gy, id, type };
  });

  if (!ids.has("output")) {
    throw new Error("output node missing");
  }

  const connections = Array.isArray(patch.connections) ? patch.connections.map((connection) => {
    const sourceNode = String(connection.sourceNode || "").trim();
    const sourcePort = String(connection.sourcePort || "").trim();
    const destinationNode = String(connection.destinationNode || "").trim();
    let destinationPort = String(connection.destinationPort || "").trim();
    const sourceType = nodes.find((node) => node.id === sourceNode)?.type;
    const destinationType = nodes.find((node) => node.id === destinationNode)?.type;
    if (!sourceType || !destinationType) {
      throw new Error("connection references missing node");
    }
    if (!(nodeGraphModuleDefinitions[sourceType].outputs || []).includes(sourcePort)) {
      throw new Error(`connection source port invalid: ${sourceNode}.${sourcePort}`);
    }
    if (destinationType === "output" && destinationPort === "In") {
      destinationPort = "Left";
    }
    if (!(nodeGraphModuleDefinitions[destinationType].inputs || []).includes(destinationPort)) {
      throw new Error(`connection destination port invalid: ${destinationNode}.${destinationPort}`);
    }
    return { destinationNode, destinationPort, sourceNode, sourcePort };
  }) : [];

  const modulations = Array.isArray(patch.modulations) ? patch.modulations.map((modulation) => {
    const sourceNode = String(modulation.sourceNode || "").trim();
    const sourcePort = String(modulation.sourcePort || "").trim();
    const destinationNode = String(modulation.destinationNode || "").trim();
    const destinationParam = String(modulation.destinationParam || "").trim();
    if (!sourceNode || !sourcePort || !destinationNode || !destinationParam) {
      throw new Error("modulation entries require sourceNode, sourcePort, destinationNode, destinationParam");
    }
    const sourceType = nodes.find((node) => node.id === sourceNode)?.type;
    const destinationType = nodes.find((node) => node.id === destinationNode)?.type;
    if (!sourceType || !destinationType) {
      throw new Error("modulation references missing node");
    }
    if (!(nodeGraphModuleDefinitions[sourceType].outputs || []).includes(sourcePort)) {
      throw new Error(`modulation source port invalid: ${sourceNode}.${sourcePort}`);
    }
    if (!(nodeGraphModuleDefinitions[destinationType].parameters || []).some((parameter) => parameter.key === destinationParam)) {
      throw new Error(`modulation destination parameter invalid: ${destinationNode}.${destinationParam}`);
    }
    return { destinationNode, destinationParam, sourceNode, sourcePort };
  }) : [];

  return {
    connections,
    grid: { sizePx: gridSize },
    info: normalizeNodeGraphPatchInfo(patch.info),
    modulations,
    nodes,
  };
}

function loadNodeGraphPatchFromScript(text) {
  return validateNodeGraphPatch(JSON.parse(text));
}

function setNodeGraphScriptStatus(message, ok = true) {
  const status = document.getElementById("nodeScriptStatus");
  if (!status) {
    return;
  }
  status.textContent = message;
  status.className = `pill ${ok ? "good" : "warn"}`;
}

function syncNodeGraphScriptView(message = "script synced", ok = true) {
  const script = document.getElementById("nodePatchScript");
  if (script && document.activeElement !== script) {
    script.value = serializeNodeGraphPatch();
  }
  setNodeGraphScriptStatus(message, ok);
}

function setNodeGraphSettingsField(id, value) {
  const field = document.getElementById(id);
  if (field && document.activeElement !== field) {
    field.value = value;
  }
}

function syncNodeGraphSettingsView() {
  const info = normalizeNodeGraphPatchInfo(nodeGraphMvp.patch.info);
  document.getElementById("nodePatchNameHeader").textContent = info.name;
  document.getElementById("nodePatchTagsHeader").textContent = info.tags;
  setNodeGraphSettingsField("patchNameValue", info.name);
  setNodeGraphSettingsField("patchAuthorValue", info.author);
  setNodeGraphSettingsField("patchTagsValue", info.tags);
  setNodeGraphSettingsField("patchDescriptionValue", info.description);
}

function readNodeGraphSettingsView() {
  return normalizeNodeGraphPatchInfo({
    author: document.getElementById("patchAuthorValue")?.value,
    description: document.getElementById("patchDescriptionValue")?.value,
    name: document.getElementById("patchNameValue")?.value,
    tags: document.getElementById("patchTagsValue")?.value,
  });
}

function handleNodeGraphSettingsInput() {
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  patch.info = readNodeGraphSettingsView();
  commitNodeGraphPatch(patch, {
    markPending: false,
    record: false,
    status: "settings synced",
  });
}

function renderNodeGraphHistoryControls() {
  const undo = document.getElementById("nodeUndoButton");
  const redo = document.getElementById("nodeRedoButton");
  if (!undo || !redo) {
    return;
  }
  undo.disabled = nodeGraphMvp.historyIndex <= 0;
  redo.disabled = nodeGraphMvp.historyIndex >= nodeGraphMvp.historySnapshots.length - 1;
}

function recordNodeGraphHistory() {
  const snapshot = serializeNodeGraphPatch();
  if (nodeGraphMvp.historySnapshots[nodeGraphMvp.historyIndex] === snapshot) {
    renderNodeGraphHistoryControls();
    return;
  }
  nodeGraphMvp.historySnapshots = nodeGraphMvp.historySnapshots.slice(0, nodeGraphMvp.historyIndex + 1);
  nodeGraphMvp.historySnapshots.push(snapshot);
  if (nodeGraphMvp.historySnapshots.length > nodeGraphMvp.historyLimit) {
    nodeGraphMvp.historySnapshots.shift();
  }
  nodeGraphMvp.historyIndex = nodeGraphMvp.historySnapshots.length - 1;
  renderNodeGraphHistoryControls();
}

function applyNodeGraphPatchToDom() {
  const container = document.getElementById("nodeGraphNodes");
  if (!container) {
    return;
  }

  const workspace = document.getElementById("nodeGraphWorkspace");
  workspace?.style.setProperty("--node-grid-size", `${nodeGraphGridSize()}px`);

  for (const element of [...container.querySelectorAll(".dsp-node")]) {
    if (!nodeGraphPatchNode(element.dataset.node)) {
      element.remove();
    }
  }

  for (const patchNode of nodeGraphMvp.patch.nodes) {
    let element = nodeGraphNodeElement(patchNode.id);
    if (element && element.dataset.nodeType !== patchNode.type) {
      element.remove();
      element = null;
    }
    if (!element) {
      element = createNodeGraphModuleElement(patchNode.type, patchNode.id);
      container.append(element);
    }
    const point = nodeGraphGridToPixel(patchNode);
    positionNodeGraphNode(element, point, { clamp: false, snap: false });
    element.dataset.gridX = String(patchNode.gx);
    element.dataset.gridY = String(patchNode.gy);
  }
}

function commitNodeGraphPatch(patch, options = {}) {
  nodeGraphMvp.patch = cloneNodeGraphPatch(validateNodeGraphPatch(patch));
  syncNodeGraphRuntimeFromPatch();
  applyNodeGraphPatchToDom();
  if (nodeGraphSelectedNodeIds().size) {
    const selectedNodeIds = nodeGraphSelectedNodeIds();
    const activeSelectedNodes = [...selectedNodeIds].filter((id) =>
      nodeGraphMvp.activeNodes.has(id),
    );
    if (activeSelectedNodes.length !== selectedNodeIds.size) {
      setNodeGraphNodeSelection(activeSelectedNodes);
    }
  }
  renderNodePalette();
  renderNodeGraphConnectionList();
  syncNodeGraphSettingsView();
  syncNodeGraphScriptView(options.status || "script synced", options.ok ?? true);
  if (options.record !== false) {
    recordNodeGraphHistory();
  } else {
    renderNodeGraphHistoryControls();
  }
  if (options.markPending !== false) {
    markNodeGraphRenderPending();
  }
  scheduleNodeGraphLivePlanSync();
}

function commitNodeGraphScript(text) {
  try {
    commitNodeGraphPatch(loadNodeGraphPatchFromScript(text), {
      status: "script synced",
    });
  } catch (error) {
    setNodeGraphScriptStatus(error.message, false);
  }
}

function undoNodeGraphPatch() {
  if (nodeGraphMvp.historyIndex <= 0) {
    return;
  }
  nodeGraphMvp.historyIndex -= 1;
  commitNodeGraphPatch(loadNodeGraphPatchFromScript(nodeGraphMvp.historySnapshots[nodeGraphMvp.historyIndex]), {
    record: false,
    status: "undo",
  });
}

function redoNodeGraphPatch() {
  if (nodeGraphMvp.historyIndex >= nodeGraphMvp.historySnapshots.length - 1) {
    return;
  }
  nodeGraphMvp.historyIndex += 1;
  commitNodeGraphPatch(loadNodeGraphPatchFromScript(nodeGraphMvp.historySnapshots[nodeGraphMvp.historyIndex]), {
    record: false,
    status: "redo",
  });
}

function nodeGraphLabel(node, port) {
  return `${nodeGraphNodeDisplayName(node)}.${port}`;
}

function nodeGraphReadNumber(id) {
  const value = Number(document.getElementById(id).value);
  return Number.isFinite(value) ? value : 0;
}

function nodeGraphNodeSelector(node) {
  return `.dsp-node[data-node="${CSS.escape(node)}"]`;
}

function nodeGraphNodeElement(node) {
  return document.querySelector(nodeGraphNodeSelector(node));
}

function nodeGraphNodeType(node) {
  return nodeGraphNodeElement(node)?.dataset.nodeType || nodeGraphPatchNodeType(node);
}

function nodeGraphNodeDisplayName(node) {
  const element = nodeGraphNodeElement(node);
  const title = element?.querySelector(".dsp-node-title span")?.textContent?.trim();
  return title || nodeGraphNodeLabels[nodeGraphNodeType(node)] || node;
}

function nodeGraphReadNodeNumber(node, key) {
  const input = nodeGraphNodeElement(node)?.querySelector(
    `input[data-param="${CSS.escape(key)}"]`,
  );
  const value = Number(input?.value);
  return Number.isFinite(value)
    ? value
    : nodeGraphParameterFallback(nodeGraphNodeType(node), key);
}

function nodeGraphParameterFallback(type, key) {
  const parameter = nodeGraphModuleDefinitions[type]?.parameters?.find(
    (candidate) => candidate.key === key,
  );
  const value = Number(parameter?.defaultValue);
  return Number.isFinite(value) ? value : 0;
}

function nodeGraphReadNodeParameterMetadata(node, key) {
  const input = nodeGraphNodeElement(node)?.querySelector(
    `input[data-param="${CSS.escape(key)}"]`,
  );
  if (!input) {
    const definition = nodeGraphModuleDefinitions[nodeGraphPatchNodeType(node)];
    const parameter = definition?.parameters?.find((candidate) => candidate.key === key);
    return {
      linearSmoothing: parameter?.linearSmoothing !== false,
      max: Number(parameter?.max ?? 1),
      min: Number(parameter?.min ?? 0),
      wraparound: Boolean(parameter?.wraparound),
    };
  }
  return {
    linearSmoothing: nodeSliderShouldUseLinearSmoothing(input),
    max: Number(input.max),
    min: Number(input.min),
    wraparound: nodeSliderShouldWraparound(input),
  };
}

function nodeGraphParameterKey(node, parameter) {
  return `${node}.${parameter}`;
}

function formatNodeSliderNumber(value, options = {}) {
  const number = Number(value);
  const text = number.toFixed(6);
  if (options.showSign && number >= 0) {
    return `+${text}`;
  }
  return options.reserveSignSpace && number >= 0 ? ` ${text}` : text;
}

function nodeSliderShouldShowSign(slider) {
  return slider.dataset.showSign === "true";
}

function nodeSliderShouldDisplayChoices(slider) {
  return slider.dataset.displayChoices === "true";
}

function nodeSliderShouldWraparound(slider) {
  return slider.dataset.wraparound === "true";
}

function nodeSliderShouldUseLinearSmoothing(slider) {
  return slider.dataset.linearSmoothing !== "false";
}

function formatNodeSliderCompactNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(6)).toString() : "";
}

function parseNodeMetadataNumber(value, fallback) {
  const number = Number(String(value).trim());
  return Number.isFinite(number) ? number : fallback;
}

function formatNodeMetadataStep(value) {
  return value > 0 ? formatNodeSliderCompactNumber(value) : "any";
}

function parseNodeMetadataChoices(value) {
  return String(value)
    .split(",")
    .map((choice) => choice.trim())
    .filter(Boolean);
}

function formatNodeMetadataChoices(choices) {
  return choices.join(", ");
}

function nodeSliderChoiceLabel(slider) {
  const metadata = nodeSliderMetadata(slider);
  if (!metadata.displayChoices || !metadata.choices.length) {
    return null;
  }

  const index = Math.round(Number(slider.value));
  if (!Number.isFinite(index)) {
    return null;
  }

  return metadata.choices[Math.max(0, Math.min(metadata.choices.length - 1, index))] ?? null;
}

function nodeSliderChoiceIndexFromText(slider, value) {
  const metadata = nodeSliderMetadata(slider);
  if (!metadata.displayChoices || !metadata.choices.length) {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  const exactIndex = metadata.choices.findIndex(
    (choice) => choice.toLowerCase() === normalized,
  );
  if (exactIndex >= 0) {
    return exactIndex;
  }

  const prefixMatches = metadata.choices
    .map((choice, index) => ({ choice: choice.toLowerCase(), index }))
    .filter((choice) => choice.choice.startsWith(normalized));
  return prefixMatches.length === 1 ? prefixMatches[0].index : null;
}

function nodeSliderMetadata(slider) {
  const min = Number(slider.min);
  const mid = Number(slider.dataset.mid);
  const max = Number(slider.max);
  const def = Number(slider.dataset.default);
  const cur = Number(slider.value);
  const step =
    slider.dataset.step && slider.dataset.step !== "any"
      ? Number(slider.dataset.step)
      : 0;
  return {
    choices: parseNodeMetadataChoices(slider.dataset.choices || ""),
    cur,
    def,
    displayChoices: nodeSliderShouldDisplayChoices(slider),
    linearSmoothing: nodeSliderShouldUseLinearSmoothing(slider),
    showSign: nodeSliderShouldShowSign(slider),
    wraparound: nodeSliderShouldWraparound(slider),
    unit: slider.dataset.unit ?? "",
    kind: slider.dataset.kind || "decimal",
    max,
    mid,
    min,
    step,
  };
}

function formatNodeSliderMetadataTooltip(slider) {
  const metadata = nodeSliderMetadata(slider);
  const stepText = metadata.step > 0 ? formatNodeSliderNumber(metadata.step) : "any";
  return [
    `current ${formatNodeSliderNumber(metadata.cur)}`,
    `default ${formatNodeSliderNumber(metadata.def)}`,
    `min ${formatNodeSliderNumber(metadata.min)}`,
    `mid ${formatNodeSliderNumber(metadata.mid)}`,
    `max ${formatNodeSliderNumber(metadata.max)}`,
    `step ${stepText}`,
    `kind ${metadata.kind}`,
    `unit ${metadata.unit}`,
    `choices ${metadata.choices.length ? formatNodeMetadataChoices(metadata.choices) : "none"}`,
    `display choices ${metadata.displayChoices}`,
    `linear smoothing ${metadata.linearSmoothing}`,
    `show sign ${metadata.showSign}`,
    `wraparound ${metadata.wraparound}`,
  ].join(" / ");
}

function syncNodeSliderMetadataTooltip(slider) {
  const tooltip = formatNodeSliderMetadataTooltip(slider);
  slider.title = tooltip;
  slider.setAttribute("aria-valuetext", tooltip);
  slider.closest(".node-slider-drag-surface")?.setAttribute("title", tooltip);
}

function clampNodeSliderValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrapNodeSliderValue(value, min, max) {
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) {
    return min;
  }
  return min + ((((value - min) % range) + range) % range);
}

function shortestNodeGraphWrapDelta(from, to, min, max) {
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

function createNodeGraphParameterSmoother(initialValue, metadata = {}) {
  const value = Number(initialValue);
  const safeValue = Number.isFinite(value) ? value : 0;
  return {
    current: safeValue,
    linearSmoothing: metadata.linearSmoothing !== false,
    max: Number.isFinite(Number(metadata.max)) ? Number(metadata.max) : 1,
    min: Number.isFinite(Number(metadata.min)) ? Number(metadata.min) : 0,
    target: safeValue,
    wraparound: Boolean(metadata.wraparound),
  };
}

function updateNodeGraphParameterSmoother(smoother, targetValue, metadata = {}) {
  const value = Number(targetValue);
  smoother.target = Number.isFinite(value) ? value : smoother.target;
  smoother.linearSmoothing = metadata.linearSmoothing !== false;
  smoother.max = Number.isFinite(Number(metadata.max)) ? Number(metadata.max) : smoother.max;
  smoother.min = Number.isFinite(Number(metadata.min)) ? Number(metadata.min) : smoother.min;
  smoother.wraparound = Boolean(metadata.wraparound);
  if (!smoother.linearSmoothing) {
    smoother.current = smoother.target;
  }
}

function readNodeGraphSmoothedParameter(smoother, frame, frames) {
  if (!smoother || !smoother.linearSmoothing || frames <= 1) {
    return smoother?.target ?? 0;
  }
  const progress = (frame + 1) / frames;
  const delta = smoother.wraparound
    ? shortestNodeGraphWrapDelta(
      smoother.current,
      smoother.target,
      smoother.min,
      smoother.max,
    )
    : smoother.target - smoother.current;
  const value = smoother.current + delta * progress;
  return smoother.wraparound
    ? wrapNodeSliderValue(value, smoother.min, smoother.max)
    : value;
}

function finishNodeGraphParameterSmoothing(smoothers) {
  for (const smoother of smoothers.values()) {
    smoother.current = smoother.wraparound
      ? wrapNodeSliderValue(smoother.target, smoother.min, smoother.max)
      : smoother.target;
  }
}

function normalizeNodeSliderValue(slider, value, min = Number(slider.min), max = Number(slider.max)) {
  if (!Number.isFinite(value)) {
    return Number.isFinite(min) ? min : 0;
  }
  return nodeSliderShouldWraparound(slider)
    ? wrapNodeSliderValue(value, min, max)
    : clampNodeSliderValue(value, min, max);
}

function normalizedNodeSliderMid(slider) {
  const min = Number(slider.min);
  const max = Number(slider.max);
  const mid = clampNodeSliderValue(Number(slider.dataset.mid), min, max);
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) {
    return 0.5;
  }

  return clampNodeSliderValue((mid - min) / range, 0.000001, 0.999999);
}

function nodeSliderSkewExponent(slider) {
  return Math.log(normalizedNodeSliderMid(slider)) / Math.log(0.5);
}

function nodeSliderValueFromTravel(slider, travel) {
  const min = Number(slider.min);
  const max = Number(slider.max);
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) {
    return min;
  }

  const exponent = nodeSliderSkewExponent(slider);
  const normalizedTravel = nodeSliderShouldWraparound(slider)
    ? wrapNodeSliderValue(travel, 0, 1)
    : clampNodeSliderValue(travel, 0, 1);
  return min + range * normalizedTravel ** exponent;
}

function nodeSliderTravelFromValue(slider, value) {
  const min = Number(slider.min);
  const max = Number(slider.max);
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) {
    return 0;
  }

  const exponent = nodeSliderSkewExponent(slider);
  const normalizedValue = clampNodeSliderValue((value - min) / range, 0, 1);
  return normalizedValue ** (1 / exponent);
}

function setNodeSliderMetadata(slider, metadata) {
  slider.min = String(metadata.min);
  slider.max = String(metadata.max);
  slider.dataset.mid = String(clampNodeSliderValue(metadata.mid, metadata.min, metadata.max));
  slider.dataset.default = String(
    clampNodeSliderValue(metadata.def, metadata.min, metadata.max),
  );
  slider.dataset.step = metadata.step > 0 ? String(metadata.step) : "any";
  slider.dataset.kind = metadata.kind || "decimal";
  slider.dataset.unit = metadata.unit ?? "";
  slider.dataset.choices = formatNodeMetadataChoices(metadata.choices || []);
  slider.dataset.displayChoices = metadata.displayChoices ? "true" : "false";
  slider.dataset.linearSmoothing = metadata.linearSmoothing ? "true" : "false";
  slider.dataset.showSign = metadata.showSign ? "true" : "false";
  slider.dataset.wraparound = metadata.wraparound ? "true" : "false";
  slider.value = String(normalizeNodeSliderValue(slider, Number(slider.value), metadata.min, metadata.max));
  syncNodeSliderReadout(slider);
}

function quantizeNodeSliderDragValue(slider, value) {
  const step = Number(slider.dataset.step);
  if (!Number.isFinite(step) || step <= 0) {
    return value;
  }

  const min = Number(slider.min);
  const origin = Number.isFinite(min) ? min : 0;
  return origin + Math.round((value - origin) / step) * step;
}

function syncNodeSliderReadout(slider) {
  const readout = slider.closest("label")?.querySelector(".node-slider-readout");
  if (!readout) {
    return;
  }

  if (!readout.querySelector(".node-slider-readout-value")) {
    readout.textContent = "";
    populateNodeSliderReadoutShell(readout);
  }
  const valueText = readout.querySelector(".node-slider-readout-value");
  const unitText = readout.querySelector(".node-slider-readout-unit");
  const position = nodeSliderTravelFromValue(slider, Number(slider.value)) * 100;
  const unit = (slider.dataset.unit || "").trim();
  const choiceLabel = nodeSliderChoiceLabel(slider);
  valueText.textContent = choiceLabel ?? formatNodeSliderNumber(slider.value, {
    reserveSignSpace: true,
    showSign: nodeSliderShouldShowSign(slider),
  });
  unitText.textContent = unit;
  unitText.classList.toggle("is-empty", !unit);
  unitText.setAttribute("aria-hidden", unit ? "false" : "true");
  readout.dataset.value = slider.value;
  readout.dataset.unit = unit;
  readout.title = `${formatNodeSliderMetadataTooltip(slider)} / double-click to type`;
  readout.style.setProperty(
    "--value-position",
    `${Math.max(0, Math.min(100, position))}%`,
  );
  syncNodeSliderMetadataTooltip(slider);
}

function nodeSliderLabelText(slider) {
  const label = slider.closest("label");
  if (!label) {
    return slider.id;
  }
  for (const node of label.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (text) {
        return text;
      }
    }
  }
  return slider.id;
}

function nodeSliderDebugPath(slider) {
  const node = slider.closest(".dsp-node");
  const nodeName = node ? nodeGraphNodeDisplayName(node.dataset.node) : "Node";
  return `${nodeName} : ${nodeSliderLabelText(slider)} : Metadata`;
}

function positionNodeMetadataPopover(popover, x, y, remember = false) {
  const margin = 12;
  popover.hidden = false;
  const rect = popover.getBoundingClientRect();
  const left = Math.max(margin, Math.min(window.innerWidth - rect.width - margin, x));
  const top = Math.max(margin, Math.min(window.innerHeight - rect.height - margin, y));
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  if (remember) {
    nodeGraphMvp.metadataPopoverPosition = { left, top };
  }
}

function beginNodeMetadataPopoverDrag(event) {
  if (event.button > 0) {
    return;
  }

  const popover = document.getElementById("nodeParameterMetadataPopover");
  if (popover.hidden) {
    return;
  }

  const rect = popover.getBoundingClientRect();
  nodeGraphMvp.metadataDragging = {
    handle: event.currentTarget,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    pointerId: event.pointerId ?? null,
  };
  event.currentTarget.classList.add("dragging");
  if (event.pointerId !== undefined) {
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  event.preventDefault();
}

function dragNodeMetadataPopover(event) {
  const drag = nodeGraphMvp.metadataDragging;
  if (
    !drag ||
    (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)
  ) {
    return;
  }

  positionNodeMetadataPopover(
    document.getElementById("nodeParameterMetadataPopover"),
    event.clientX - drag.offsetX,
    event.clientY - drag.offsetY,
    true,
  );
  event.preventDefault();
}

function endNodeMetadataPopoverDrag(event) {
  const drag = nodeGraphMvp.metadataDragging;
  if (
    !drag ||
    (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)
  ) {
    return;
  }

  drag.handle.classList.remove("dragging");
  if (event.pointerId !== undefined && drag.handle.hasPointerCapture?.(event.pointerId)) {
    drag.handle.releasePointerCapture(event.pointerId);
  }
  nodeGraphMvp.metadataDragging = null;
}

function populateNodeMetadataKindChoices() {
  const select = document.getElementById("metadataKindValue");
  if (select.options.length) {
    return;
  }
  for (const [kind, template] of Object.entries(nodeMetadataKindTemplates)) {
    const option = document.createElement("option");
    option.value = kind;
    option.textContent = template.label;
    select.append(option);
  }
}

function normalizeNodeMetadataKind(kind) {
  return nodeMetadataKindAliases[kind] || kind || "decimal";
}

function applyNodeMetadataKindTemplates(templates) {
  if (!templates || typeof templates !== "object") {
    return;
  }

  nodeMetadataKindTemplates = Object.freeze(templates);
  const select = document.getElementById("metadataKindValue");
  if (select) {
    select.replaceChildren();
    populateNodeMetadataKindChoices();
  }
  if (nodeGraphMvp.metadataEditorTarget) {
    const slider = document.getElementById(nodeGraphMvp.metadataEditorTarget);
    if (slider) {
      fillNodeMetadataPopover(slider);
    }
  }
}

async function loadNodeMetadataKindTemplates() {
  try {
    const response = await fetch("/api/node-metadata-kinds", { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const payload = await response.json();
    if (payload?.ok === true) {
      applyNodeMetadataKindTemplates(payload.templates);
    }
  } catch (_error) {
    nodeMetadataKindTemplates = fallbackNodeMetadataKindTemplates;
  }
}

function fillNodeMetadataPopover(slider) {
  populateNodeMetadataKindChoices();
  const metadata = nodeSliderMetadata(slider);
  document.getElementById("metadataPopoverTitle").textContent = nodeSliderDebugPath(slider);
  document.getElementById("metadataMinValue").value = formatNodeSliderCompactNumber(metadata.min);
  document.getElementById("metadataMidValue").value = formatNodeSliderCompactNumber(metadata.mid);
  document.getElementById("metadataMaxValue").value = formatNodeSliderCompactNumber(metadata.max);
  document.getElementById("metadataDefaultValue").value =
    formatNodeSliderCompactNumber(metadata.def);
  document.getElementById("metadataStepValue").value = formatNodeMetadataStep(metadata.step);
  document.getElementById("metadataKindValue").value = normalizeNodeMetadataKind(metadata.kind);
  document.getElementById("metadataUnitValue").value = metadata.unit;
  document.getElementById("metadataChoicesValue").value =
    formatNodeMetadataChoices(metadata.choices);
  document.getElementById("metadataDisplayChoicesValue").checked = metadata.displayChoices;
  document.getElementById("metadataLinearSmoothingValue").checked = metadata.linearSmoothing;
  document.getElementById("metadataShowSignValue").checked = metadata.showSign;
  document.getElementById("metadataWraparoundValue").checked = metadata.wraparound;
  document.getElementById("metadataSetDefaultButton").classList.remove("armed");
}

function openNodeMetadataPopover(event, readout) {
  event.preventDefault();
  event.stopPropagation();
  const slider = document.getElementById(readout.dataset.sliderTarget);
  if (!slider) {
    return;
  }

  nodeGraphMvp.metadataEditorTarget = slider.id;
  fillNodeMetadataPopover(slider);
  const savedPosition = nodeGraphMvp.metadataPopoverPosition;
  positionNodeMetadataPopover(
    document.getElementById("nodeParameterMetadataPopover"),
    savedPosition?.left ?? event.clientX,
    savedPosition?.top ?? event.clientY,
  );
}

function closeNodeMetadataPopover() {
  const popover = document.getElementById("nodeParameterMetadataPopover");
  popover.hidden = true;
  if (nodeGraphMvp.metadataDragging?.handle) {
    nodeGraphMvp.metadataDragging.handle.classList.remove("dragging");
  }
  nodeGraphMvp.metadataDragging = null;
  nodeGraphMvp.metadataEditorTarget = null;
}

function closeNodeSceneContextMenu() {
  const menu = document.getElementById("nodeSceneContextMenu");
  menu.hidden = true;
  nodeGraphMvp.sceneContextPoint = null;
  nodeGraphMvp.sceneContextTargetNode = null;
}

function markNodeGraphRenderPending() {
  nodeGraphMvp.rendered = null;
  document.getElementById("nodePlayButton").disabled = true;
  document.getElementById("nodeGraphRenderStatus").textContent = "render pending";
  document.getElementById("nodeGraphRenderStatus").className = "pill warn";
}

function readNodeMetadataEditorValues(slider) {
  const current = nodeSliderMetadata(slider);
  let min = parseNodeMetadataNumber(document.getElementById("metadataMinValue").value, current.min);
  let max = parseNodeMetadataNumber(document.getElementById("metadataMaxValue").value, current.max);
  if (min > max) {
    [min, max] = [max, min];
  }
  const stepInput = document.getElementById("metadataStepValue").value.trim();
  return {
    def: parseNodeMetadataNumber(document.getElementById("metadataDefaultValue").value, current.def),
    kind: normalizeNodeMetadataKind(document.getElementById("metadataKindValue").value),
    max,
    mid: parseNodeMetadataNumber(document.getElementById("metadataMidValue").value, current.mid),
    min,
    choices: parseNodeMetadataChoices(document.getElementById("metadataChoicesValue").value),
    displayChoices: document.getElementById("metadataDisplayChoicesValue").checked,
    linearSmoothing: document.getElementById("metadataLinearSmoothingValue").checked,
    step: stepInput.toLowerCase() === "any"
      ? 0
      : Math.max(0, parseNodeMetadataNumber(stepInput, current.step)),
    showSign: document.getElementById("metadataShowSignValue").checked,
    wraparound: document.getElementById("metadataWraparoundValue").checked,
    unit: document.getElementById("metadataUnitValue").value.trim(),
  };
}

function applyNodeMetadataEditor() {
  const slider = document.getElementById(nodeGraphMvp.metadataEditorTarget);
  if (!slider) {
    return;
  }

  setNodeSliderMetadata(slider, readNodeMetadataEditorValues(slider));
  markNodeGraphRenderPending();
}

function setNodeMetadataDefaultsFromKind() {
  const slider = document.getElementById(nodeGraphMvp.metadataEditorTarget);
  if (!slider) {
    return;
  }
  const kind = normalizeNodeMetadataKind(document.getElementById("metadataKindValue").value);
  const template = nodeMetadataKindTemplates[kind] || nodeMetadataKindTemplates.decimal;
  const choices = template.choices || [];
  const hasChoices = choices.length > 0;
  const min = hasChoices ? 0 : template.min;
  const max = hasChoices ? choices.length - 1 : template.max;
  const mid = hasChoices ? (min + max) / 2 : template.mid;
  const def = clampNodeSliderValue(template.def, min, max);
  document.getElementById("metadataMinValue").value = formatNodeSliderCompactNumber(min);
  document.getElementById("metadataMidValue").value = formatNodeSliderCompactNumber(mid);
  document.getElementById("metadataMaxValue").value = formatNodeSliderCompactNumber(max);
  document.getElementById("metadataDefaultValue").value =
    formatNodeSliderCompactNumber(def);
  document.getElementById("metadataStepValue").value = formatNodeMetadataStep(template.step);
  document.getElementById("metadataUnitValue").value = template.unit;
  document.getElementById("metadataChoicesValue").value = formatNodeMetadataChoices(choices);
  document.getElementById("metadataDisplayChoicesValue").checked = Boolean(template.displayChoices);
  document.getElementById("metadataLinearSmoothingValue").checked = template.linearSmoothing !== false;
  document.getElementById("metadataShowSignValue").checked = Boolean(template.showPlusMinus);
  document.getElementById("metadataWraparoundValue").checked = Boolean(template.wraparound);
  applyNodeMetadataEditor();
  document.getElementById("metadataSetDefaultButton").classList.remove("armed");
}

function handleNodeMetadataKindChange() {
  applyNodeMetadataEditor();
  document.getElementById("metadataSetDefaultButton").classList.add("armed");
}

function handleNodeMetadataEditorInput() {
  if (!nodeGraphMvp.metadataEditorTarget) {
    return;
  }
  applyNodeMetadataEditor();
}

function updateNodeSliderCurrentValue(slider, rawValue) {
  if (!slider) {
    return;
  }

  const normalizedValue = String(rawValue).trim();
  const choiceIndex = nodeSliderChoiceIndexFromText(slider, normalizedValue);
  const value = choiceIndex ?? Number(normalizedValue);
  if (!Number.isFinite(value)) {
    syncNodeSliderReadout(slider);
    return;
  }

  slider.value = String(normalizeNodeSliderValue(slider, value));
  syncNodeSliderReadout(slider);
  if (nodeGraphMvp.metadataEditorTarget === slider.id) {
    fillNodeMetadataPopover(slider);
  }
  markNodeGraphRenderPending();
  scheduleNodeGraphLivePlanSync();
}

function setNodeSliderValue(slider, value) {
  slider.value = String(
    normalizeNodeSliderValue(slider, value),
  );
  syncNodeSliderReadout(slider);
  markNodeGraphRenderPending();
  scheduleNodeGraphLivePlanSync();
}

function beginNodeSliderDrag(event) {
  if (nodeGraphMvp.sliderDragging || event.button > 0 || event.detail > 1) {
    return;
  }

  const surface = event.currentTarget;
  const slider = document.getElementById(surface.dataset.sliderTarget);
  if (!slider) {
    return;
  }

  const rect = surface.getBoundingClientRect();
  nodeGraphMvp.sliderDragging = {
    pointerId: event.pointerId ?? null,
    slider,
    surface,
    startTravel: nodeSliderTravelFromValue(slider, Number(slider.value)),
    startX: event.clientX,
    startY: event.clientY,
    width: Math.max(1, rect.width),
  };
  surface.classList.add("value-dragging");
  if (event.pointerId !== undefined) {
    surface.setPointerCapture(event.pointerId);
  }
  event.preventDefault();
}

function dragNodeSlider(event) {
  const drag = nodeGraphMvp.sliderDragging;
  if (
    !drag ||
    (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)
  ) {
    return;
  }

  const horizontalDelta = event.clientX - drag.startX;
  const verticalDelta = drag.startY - event.clientY;
  const travelDelta = (horizontalDelta + verticalDelta) / drag.width;
  setNodeSliderValue(
    drag.slider,
    quantizeNodeSliderDragValue(
      drag.slider,
      nodeSliderValueFromTravel(drag.slider, drag.startTravel + travelDelta),
    ),
  );
  event.preventDefault();
}

function endNodeSliderDrag(event) {
  const drag = nodeGraphMvp.sliderDragging;
  if (
    !drag ||
    (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)
  ) {
    return;
  }

  drag.surface.classList.remove("value-dragging");
  if (event.pointerId !== undefined && drag.surface.hasPointerCapture?.(event.pointerId)) {
    drag.surface.releasePointerCapture(event.pointerId);
  }
  nodeGraphMvp.sliderDragging = null;
}

function populateNodeSliderReadoutShell(readout) {
  const valueText = document.createElement("span");
  valueText.className = "node-slider-readout-value";
  const unitText = document.createElement("span");
  unitText.className = "node-slider-readout-unit";
  readout.append(valueText, unitText);
}

function commitNodeSliderReadoutEdit(input) {
  updateNodeSliderCurrentValue(document.getElementById(input.dataset.sliderTarget), input.value);
  const readout = document.createElement("button");
  readout.type = "button";
  readout.className = "node-slider-readout";
  readout.dataset.sliderTarget = input.dataset.sliderTarget;
  readout.setAttribute("aria-label", input.getAttribute("aria-label"));
  populateNodeSliderReadoutShell(readout);
  input.replaceWith(readout);
  attachNodeSliderReadoutEvents(readout);
  syncNodeSliderReadout(document.getElementById(readout.dataset.sliderTarget));
}

function cancelNodeSliderReadoutEdit(input) {
  const slider = document.getElementById(input.dataset.sliderTarget);
  const readout = document.createElement("button");
  readout.type = "button";
  readout.className = "node-slider-readout";
  readout.dataset.sliderTarget = input.dataset.sliderTarget;
  readout.setAttribute("aria-label", input.getAttribute("aria-label"));
  populateNodeSliderReadoutShell(readout);
  input.replaceWith(readout);
  attachNodeSliderReadoutEvents(readout);
  syncNodeSliderReadout(slider);
}

function beginNodeSliderReadoutEdit(readout) {
  const slider = document.getElementById(readout.dataset.sliderTarget);
  if (!slider) {
    return;
  }

  const input = document.createElement("input");
  input.type = "text";
  input.className = "node-slider-readout-input";
  input.inputMode = nodeSliderShouldDisplayChoices(slider) ? "text" : "decimal";
  input.value = nodeSliderChoiceLabel(slider) ?? formatNodeSliderNumber(slider.value, {
    reserveSignSpace: true,
    showSign: nodeSliderShouldShowSign(slider),
  });
  input.dataset.sliderTarget = slider.id;
  input.setAttribute("aria-label", readout.getAttribute("aria-label"));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      commitNodeSliderReadoutEdit(input);
    }
    if (event.key === "Escape") {
      cancelNodeSliderReadoutEdit(input);
    }
  });
  input.addEventListener("blur", () => commitNodeSliderReadoutEdit(input));
  readout.replaceWith(input);
  input.focus();
  input.select();
}

function attachNodeSliderReadoutEvents(readout) {
  readout.addEventListener("dblclick", () => beginNodeSliderReadoutEdit(readout));
  readout.addEventListener("contextmenu", (event) => openNodeMetadataPopover(event, readout));
  readout.addEventListener("pointerdown", beginNodeSliderDrag);
  readout.addEventListener("lostpointercapture", endNodeSliderDrag);
  readout.addEventListener("mousedown", beginNodeSliderDrag);
}

function createNodeSliderReadout(slider) {
  const label = slider.closest("label");
  if (!label || label.querySelector(".node-slider-readout, .node-slider-readout-input")) {
    return;
  }

  slider.dataset.mid ||= String((Number(slider.min) + Number(slider.max)) / 2);
  slider.dataset.default ||= slider.value;
  slider.dataset.step ||= slider.step || "any";
  slider.step = "any";
  slider.dataset.kind ||= "decimal";
  slider.dataset.unit ??= "";
  slider.dataset.choices ??= "";
  slider.dataset.displayChoices ??= "false";
  slider.dataset.linearSmoothing ??= "true";
  slider.dataset.showSign ??= "false";
  slider.dataset.wraparound ??= "false";

  const readout = document.createElement("button");
  readout.type = "button";
  readout.className = "node-slider-readout";
  readout.dataset.sliderTarget = slider.id;
  readout.setAttribute("aria-label", `${slider.id} current value`);
  readout.setAttribute("title", formatNodeSliderMetadataTooltip(slider));
  populateNodeSliderReadoutShell(readout);
  attachNodeSliderReadoutEvents(readout);
  label.append(readout);
  syncNodeSliderReadout(slider);
}

function ensureNodeGraphDragHandle(node) {
  const title = node.querySelector(".dsp-node-title");
  if (!title || title.querySelector(".node-drag-handle")) {
    return;
  }

  const handle = document.createElement("button");
  handle.className = "node-drag-handle";
  handle.type = "button";
  handle.setAttribute("aria-label", `Move ${nodeGraphNodeDisplayName(node.dataset.node)} module`);
  handle.setAttribute("title", "Move module");
  handle.innerHTML = "&#x2725;";
  title.prepend(handle);
}

function attachNodeGraphNodeEvents(node) {
  ensureNodeGraphDragHandle(node);
  node.querySelector(".node-drag-handle")?.addEventListener("pointerdown", beginNodeGraphNodeDrag);
  node.querySelector(".node-action-button")?.addEventListener("click", openNodeModuleActionMenu);
  node.addEventListener("pointermove", dragNodeGraphNode);
  node.addEventListener("pointerup", endNodeGraphNodeDrag);
  node.addEventListener("pointercancel", endNodeGraphNodeDrag);
  node.addEventListener("lostpointercapture", endNodeGraphNodeDrag);
  for (const port of node.querySelectorAll(".node-port.output")) {
    port.addEventListener("pointerdown", beginNodeGraphWireDrag);
  }
  for (const slider of node.querySelectorAll('input[type="range"]')) {
    createNodeSliderReadout(slider);
    slider.addEventListener("input", () => {
      syncNodeSliderReadout(slider);
      markNodeGraphRenderPending();
      scheduleNodeGraphLivePlanSync();
    });
  }
}

function createNodeGraphPort(node, type, port, io) {
  const button = document.createElement("button");
  button.className = `node-port ${io}`;
  button.type = "button";
  button.dataset.node = node;
  button.dataset.port = port;
  button.dataset.io = io;
  const label = `${nodeGraphNodeLabels[type]} ${io} port ${port}`;
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  return button;
}

function createNodeGraphPortRail(node, type, ports, io) {
  if (!ports?.length) {
    return null;
  }

  const rail = document.createElement("div");
  rail.className = `node-port-rail ${io}`;
  for (const port of ports) {
    rail.append(createNodeGraphPort(node, type, port, io));
  }
  return rail;
}

function createNodeParameterModulationPort(node, type, parameter) {
  const button = document.createElement("button");
  button.className = "node-param-port modulation-input";
  button.type = "button";
  button.dataset.node = node;
  button.dataset.param = parameter.key;
  button.dataset.port = parameter.key;
  button.dataset.io = "modulation";
  const label = `${nodeGraphNodeLabels[type]} ${parameter.label} modulation input`;
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  return button;
}

function createNodeGraphParameter(node, type, parameter) {
  const row = document.createElement("div");
  row.className = "node-parameter-row";
  row.dataset.param = parameter.key;
  row.append(createNodeParameterModulationPort(node, type, parameter));

  const label = document.createElement("label");
  label.className = "node-parameter-control";
  label.append(document.createTextNode(parameter.label));
  const input = document.createElement("input");
  const legacyIds = {
    "bias.offset": "nodeBiasAmount",
    "gain.amount": "nodeGainAmount",
    "noise.level": "nodeNoiseLevel",
    "osc.frequency": "nodeOscFrequency",
    "osc.level": "nodeOscLevel",
    "osc.phase": "nodeOscPhase",
    "osc.waveform": "nodeOscWaveform",
  };
  input.id = legacyIds[`${node}.${parameter.key}`] || `node-${node}-${parameter.key}`;
  input.dataset.param = parameter.key;
  input.type = "range";
  input.min = parameter.min;
  input.max = parameter.max;
  input.step = "any";
  input.value = parameter.defaultValue;
  input.dataset.step = parameter.step;
  input.dataset.mid = parameter.mid;
  input.dataset.default = parameter.defaultValue;
  input.dataset.kind = parameter.kind || "decimal";
  input.dataset.unit = parameter.unit ?? "";
  input.dataset.choices = formatNodeMetadataChoices(parameter.choices || []);
  input.dataset.displayChoices = parameter.displayChoices ? "true" : "false";
  input.dataset.linearSmoothing = parameter.linearSmoothing === false ? "false" : "true";
  input.dataset.showSign = parameter.showSign ? "true" : "false";
  input.dataset.wraparound = parameter.wraparound ? "true" : "false";
  input.setAttribute("aria-label", `${nodeGraphNodeLabels[type]} ${parameter.label}`);
  label.append(input);
  row.append(label);
  return row;
}

function createNodeGraphModuleElement(type, node) {
  const definition = nodeGraphModuleDefinitions[type];
  const article = document.createElement("article");
  article.className = `dsp-node${definition.output ? " output-node" : ""}`;
  article.dataset.node = node;
  article.dataset.nodeType = type;
  const bodyRowCount = definition.parameters.length + (definition.output ? 1 : 0);
  article.style.setProperty("--node-grid-width-units", definition.output ? "6" : "7");
  article.style.setProperty("--node-grid-height-units", String(2 + Math.max(1, bodyRowCount) * 2));

  const header = document.createElement("div");
  header.className = "dsp-node-header dsp-node-title";
  const handle = document.createElement("button");
  handle.className = "node-drag-handle";
  handle.type = "button";
  handle.setAttribute("aria-label", `Move ${nodeGraphNodeLabels[type]} module`);
  handle.setAttribute("title", "Move module");
  handle.innerHTML = "&#x2725;";
  header.append(handle);
  const titleText = document.createElement("span");
  titleText.textContent = node === type ? nodeGraphNodeLabels[type] : `${nodeGraphNodeLabels[type]} ${node.split("-").at(-1)}`;
  header.append(titleText);
  const actionButton = document.createElement("button");
  actionButton.className = "node-action-button";
  actionButton.type = "button";
  actionButton.dataset.node = node;
  actionButton.setAttribute("aria-label", `${nodeGraphNodeLabels[type]} module actions`);
  actionButton.setAttribute("title", "Module actions");
  actionButton.textContent = "⚙";
  header.append(actionButton);
  const inputRail = createNodeGraphPortRail(node, type, definition.inputs, "input");
  const outputRail = createNodeGraphPortRail(node, type, definition.outputs, "output");
  if (inputRail) {
    header.append(inputRail);
  }
  if (outputRail) {
    header.append(outputRail);
  }
  article.append(header);

  const body = document.createElement("div");
  body.className = "dsp-node-body";

  for (const parameter of definition.parameters) {
    body.append(createNodeGraphParameter(node, type, parameter));
  }
  if (definition.output) {
    const summary = document.createElement("p");
    summary.id = "nodeOutputSummary";
    summary.textContent = "waiting for render";
    body.append(summary);
  }
  article.append(body);

  attachNodeGraphNodeEvents(article);
  return article;
}

function registerExistingNodeGraphNodes() {
  nodeGraphMvp.activeNodes = new Set();
  for (const node of document.querySelectorAll(".dsp-node")) {
    node.dataset.nodeType ||= node.dataset.node;
    nodeGraphMvp.activeNodes.add(node.dataset.node);
    attachNodeGraphNodeEvents(node);
  }
}

function nodeGraphInputKey(node, port) {
  return `${node}.${port}`;
}

function nodeGraphFindInputConnections(node, port) {
  return nodeGraphMvp.connections.filter(
    (connection) =>
      nodeGraphMvp.activeNodes.has(connection.sourceNode) &&
      nodeGraphMvp.activeNodes.has(connection.destinationNode) &&
      connection.destinationNode === node && connection.destinationPort === port,
  );
}

function nodeGraphBuildDependencyMap(patch = nodeGraphMvp.patch) {
  const issues = [];
  const nodeList = Array.isArray(patch.nodes) ? patch.nodes.map((node) => ({ ...node })) : [];
  const nodeMap = new Map(nodeList.map((node) => [node.id, node]));
  const dependencies = new Map(nodeList.map((node) => [node.id, new Set()]));
  const inputConnections = new Map();
  const modulationConnections = new Map();

  function addDependency(destinationNode, sourceNode) {
    if (!dependencies.has(destinationNode)) {
      dependencies.set(destinationNode, new Set());
    }
    dependencies.get(destinationNode).add(sourceNode);
  }

  for (const node of nodeList) {
    if (!nodeGraphModuleDefinitions[node.type]) {
      issues.push(`unsupported source ${node.id}`);
    }
  }

  for (const connection of patch.connections || []) {
    const source = nodeMap.get(connection.sourceNode);
    const destination = nodeMap.get(connection.destinationNode);
    if (!source || !destination) {
      issues.push("connection references missing node");
      continue;
    }
    const sourceOutputs = nodeGraphModuleDefinitions[source.type]?.outputs || [];
    const destinationInputs = nodeGraphModuleDefinitions[destination.type]?.inputs || [];
    if (!sourceOutputs.includes(connection.sourcePort)) {
      issues.push(`connection source port invalid: ${connection.sourceNode}.${connection.sourcePort}`);
      continue;
    }
    if (!destinationInputs.includes(connection.destinationPort)) {
      issues.push(`connection destination port invalid: ${connection.destinationNode}.${connection.destinationPort}`);
      continue;
    }
    const key = nodeGraphInputKey(connection.destinationNode, connection.destinationPort);
    const connections = inputConnections.get(key) || [];
    connections.push({ ...connection });
    inputConnections.set(key, connections);
    addDependency(connection.destinationNode, connection.sourceNode);
  }

  for (const modulation of patch.modulations || []) {
    const source = nodeMap.get(modulation.sourceNode);
    const destination = nodeMap.get(modulation.destinationNode);
    if (!source || !destination) {
      issues.push("modulation references missing node");
      continue;
    }
    const sourceOutputs = nodeGraphModuleDefinitions[source.type]?.outputs || [];
    const destinationParameters = nodeGraphModuleDefinitions[destination.type]?.parameters || [];
    if (!sourceOutputs.includes(modulation.sourcePort)) {
      issues.push(`modulation source port invalid: ${modulation.sourceNode}.${modulation.sourcePort}`);
      continue;
    }
    if (!destinationParameters.some((parameter) => parameter.key === modulation.destinationParam)) {
      issues.push(`modulation destination parameter invalid: ${modulation.destinationNode}.${modulation.destinationParam}`);
      continue;
    }
    const key = nodeGraphParameterKey(modulation.destinationNode, modulation.destinationParam);
    const modulations = modulationConnections.get(key) || [];
    modulations.push({ ...modulation });
    modulationConnections.set(key, modulations);
    addDependency(modulation.destinationNode, modulation.sourceNode);
  }

  return {
    dependencies,
    inputConnections,
    issues,
    modulationConnections,
    nodeMap,
    nodes: nodeList,
  };
}

function nodeGraphTopologicalOrder(nodes, dependencies, reachableNodes) {
  const issues = [];
  const order = [];
  const visiting = new Set();
  const visited = new Set();

  function visit(nodeId) {
    if (!reachableNodes.has(nodeId)) {
      return;
    }
    if (visiting.has(nodeId)) {
      issues.push(`cycle detected at ${nodeGraphNodeDisplayName(nodeId)}`);
      return;
    }
    if (visited.has(nodeId)) {
      return;
    }

    visiting.add(nodeId);
    for (const dependency of dependencies.get(nodeId) || []) {
      visit(dependency);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    if (!order.includes(nodeId)) {
      order.push(nodeId);
    }
  }

  for (const node of nodes) {
    visit(node.id);
  }

  return { issues, order };
}

function compileNodeGraphExecutionPlan(patch = nodeGraphMvp.patch) {
  const graph = nodeGraphBuildDependencyMap(patch);
  const issues = [...graph.issues];
  const outputNode = "output";
  const reachableNodes = new Set();

  function markReachable(nodeId) {
    if (reachableNodes.has(nodeId) || !graph.nodeMap.has(nodeId)) {
      return;
    }
    reachableNodes.add(nodeId);
    for (const dependency of graph.dependencies.get(nodeId) || []) {
      markReachable(dependency);
    }
  }

  if (!graph.nodeMap.has(outputNode)) {
    issues.push("output node missing");
  } else {
    markReachable(outputNode);
  }

  const hasOutputSpeakerInput = nodeGraphOutputInputPorts.some(
    (port) => (graph.inputConnections.get(nodeGraphInputKey(outputNode, port)) || []).length > 0,
  );
  if (!hasOutputSpeakerInput) {
    issues.push("missing Output speaker input");
  }

  for (const nodeId of reachableNodes) {
    const type = graph.nodeMap.get(nodeId)?.type;
    if (type === "gain" || type === "bias") {
      const inputCount = (graph.inputConnections.get(nodeGraphInputKey(nodeId, "In")) || []).length;
      if (!inputCount) {
        issues.push(`missing ${nodeGraphNodeDisplayName(nodeId)} input`);
      }
    } else if (type !== "osc" && type !== "noise" && type !== "output") {
      issues.push(`unsupported source ${nodeId}`);
    }
  }

  const topology = nodeGraphTopologicalOrder(graph.nodes, graph.dependencies, reachableNodes);
  issues.push(...topology.issues);
  const order = topology.order.filter((nodeId) => reachableNodes.has(nodeId));
  const sourceNodes = order.filter((nodeId) => {
    const type = graph.nodeMap.get(nodeId)?.type;
    return type === "osc" || type === "noise";
  });

  const uniqueIssues = [...new Set(issues)];
  if (!sourceNodes.length && !uniqueIssues.length) {
    uniqueIssues.push("missing renderable source");
  }

  return {
    dependencies: graph.dependencies,
    inputConnections: graph.inputConnections,
    issues: uniqueIssues,
    modulationConnections: graph.modulationConnections,
    nodeMap: graph.nodeMap,
    nodes: graph.nodes,
    order,
    outputNode,
    sourceNodes,
    valid: uniqueIssues.length === 0,
  };
}

function nodeGraphScheduleText(order, issues = []) {
  if (issues.length) {
    return `schedule blocked: ${issues.join(", ")}`;
  }
  return order.length
    ? `schedule: ${order.map((node) => nodeGraphNodeDisplayName(node)).join(" -> ")}`
    : "schedule missing";
}

function nodeGraphValidate() {
  const plan = compileNodeGraphExecutionPlan();
  return {
    issues: plan.issues,
    order: plan.order,
    route: plan.order,
    scheduleText: nodeGraphScheduleText(plan.order, plan.issues),
    sourceNode: plan.sourceNodes[0] || "",
    sourceNodes: plan.sourceNodes,
    valid: plan.valid,
  };
}

function nodeGraphExecutionParameterSnapshot(order) {
  const parametersByNode = {};
  for (const nodeId of order) {
    const type = nodeGraphNodeType(nodeId);
    const definition = nodeGraphModuleDefinitions[type];
    const parameters = {};
    for (const parameter of definition?.parameters || []) {
      const slider = nodeGraphNodeElement(nodeId)?.querySelector(
        `input[data-param="${CSS.escape(parameter.key)}"]`,
      );
      const value = nodeGraphReadNodeNumber(nodeId, parameter.key);
      parameters[parameter.key] = {
        display: slider
          ? nodeSliderChoiceLabel(slider) ?? formatNodeSliderCompactNumber(value)
          : formatNodeSliderCompactNumber(value),
        value,
      };
    }
    if (Object.keys(parameters).length) {
      parametersByNode[nodeId] = parameters;
    }
  }
  return parametersByNode;
}

function serializeNodeGraphExecutionPlanDebug(plan) {
  const signalInputs = {};
  for (const [key, connections] of plan.inputConnections.entries()) {
    signalInputs[key] = connections.map((connection) =>
      `${connection.sourceNode}.${connection.sourcePort}`,
    );
  }

  const modulationInputs = {};
  for (const [key, modulations] of plan.modulationConnections.entries()) {
    modulationInputs[key] = modulations.map((modulation) =>
      `${modulation.sourceNode}.${modulation.sourcePort}`,
    );
  }

  return JSON.stringify(
    {
      issues: plan.issues,
      modulationInputs,
      order: plan.order,
      outputNode: plan.outputNode,
      parameters: nodeGraphExecutionParameterSnapshot(plan.order),
      signalInputs,
      sourceNodes: plan.sourceNodes,
      valid: plan.valid,
    },
    null,
    2,
  );
}

function renderNodeGraphExecutionPlanDebug(plan = compileNodeGraphExecutionPlan()) {
  const status = document.getElementById("nodeExecutionPlanStatus");
  const debug = document.getElementById("nodeExecutionPlanDebug");
  if (!status || !debug) {
    return;
  }
  status.textContent = plan.valid ? "compiled" : "blocked";
  status.className = `pill ${plan.valid ? "good" : "warn"}`;
  debug.textContent = serializeNodeGraphExecutionPlanDebug(plan);
}

function nodeGraphPortSelector(node, port, io) {
  return `.node-port.${io}[data-node="${CSS.escape(node)}"][data-port="${CSS.escape(port)}"]`;
}

function nodeGraphModulationPortSelector(node, parameter) {
  return `.node-param-port.modulation-input[data-node="${CSS.escape(node)}"][data-param="${CSS.escape(parameter)}"]`;
}

function nodeGraphZoom() {
  return Number.isFinite(nodeGraphMvp.zoom) ? nodeGraphMvp.zoom : 1;
}

function nodeGraphZoomSurface() {
  return document.getElementById("nodeGraphZoomSurface");
}

function nodeGraphGraphRect() {
  const workspace = document.getElementById("nodeGraphWorkspace");
  const workspaceRect = workspace.getBoundingClientRect();
  const zoom = nodeGraphZoom();
  return {
    height: workspaceRect.height / zoom,
    width: workspaceRect.width / zoom,
  };
}

function applyNodeGraphZoom() {
  const workspace = document.getElementById("nodeGraphWorkspace");
  if (!workspace) {
    return;
  }
  workspace.style.setProperty("--node-graph-zoom", String(nodeGraphZoom()));
  workspace.dataset.zoom = nodeGraphZoom().toFixed(2);
  const zoomOutButton = document.getElementById("nodeZoomOutButton");
  const zoomInButton = document.getElementById("nodeZoomInButton");
  if (zoomOutButton) {
    zoomOutButton.disabled = nodeGraphZoom() <= nodeGraphZoomLimits.min + 0.001;
  }
  if (zoomInButton) {
    zoomInButton.disabled = nodeGraphZoom() >= nodeGraphZoomLimits.max - 0.001;
  }
  drawNodeGraphWires();
}

function setNodeGraphZoom(nextZoom) {
  const zoom = Math.max(
    nodeGraphZoomLimits.min,
    Math.min(nodeGraphZoomLimits.max, nextZoom),
  );
  if (Math.abs(zoom - nodeGraphZoom()) < 0.001) {
    return;
  }
  nodeGraphMvp.zoom = zoom;
  applyNodeGraphZoom();
}

function zoomNodeGraphBy(delta) {
  setNodeGraphZoom(nodeGraphZoom() + delta);
}

function nodeGraphPortCenter(node, port, io) {
  const surface = nodeGraphZoomSurface();
  const element = surface.querySelector(nodeGraphPortSelector(node, port, io));
  return nodeGraphElementCenter(element);
}

function nodeGraphModulationPortCenter(node, parameter) {
  const surface = nodeGraphZoomSurface();
  const element = surface.querySelector(nodeGraphModulationPortSelector(node, parameter));
  return nodeGraphElementCenter(element);
}

function nodeGraphElementCenter(element) {
  const surface = nodeGraphZoomSurface();
  if (!element) {
    return { x: 0, y: 0 };
  }

  const surfaceRect = surface.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const zoom = nodeGraphZoom();
  return {
    x: (elementRect.left + elementRect.width / 2 - surfaceRect.left) / zoom,
    y: (elementRect.top + elementRect.height / 2 - surfaceRect.top) / zoom,
  };
}

function setNodeGraphSelection(selection) {
  nodeGraphMvp.selected = selection;
  renderNodeGraphSelection();
}

function nodeGraphSelectedNodeIds(selection = nodeGraphMvp.selected) {
  if (selection?.type === "node" && selection.id) {
    return new Set([selection.id]);
  }
  if (selection?.type === "nodes" && Array.isArray(selection.ids)) {
    return new Set(selection.ids);
  }
  return new Set();
}

function setNodeGraphNodeSelection(ids) {
  const uniqueIds = [...new Set(ids)].filter((id) => nodeGraphMvp.activeNodes.has(id));
  if (!uniqueIds.length) {
    setNodeGraphSelection(null);
    return;
  }
  if (uniqueIds.length === 1) {
    setNodeGraphSelection({ type: "node", id: uniqueIds[0] });
    return;
  }
  setNodeGraphSelection({ type: "nodes", ids: uniqueIds });
}

function sameNodeGraphSelection(a, b) {
  if (a?.type !== b?.type) {
    return false;
  }
  if (a?.type === "wire") {
    return (
      (a.kind || "signal") === (b.kind || "signal") &&
      a.index === b.index
    );
  }
  if (a?.type === "nodes") {
    return (
      Array.isArray(a.ids) &&
      Array.isArray(b.ids) &&
      a.ids.length === b.ids.length &&
      a.ids.every((id, index) => id === b.ids[index])
    );
  }
  return a?.id === b?.id && a?.index === b?.index;
}

function renderNodeGraphSelection() {
  const selectedNodeIds = nodeGraphSelectedNodeIds();
  for (const node of document.querySelectorAll(".dsp-node")) {
    node.classList.toggle("selected", selectedNodeIds.has(node.dataset.node));
  }

  for (const path of document.querySelectorAll(".node-wire-path")) {
    path.classList.toggle(
      "selected",
      sameNodeGraphSelection(nodeGraphMvp.selected, {
        type: "wire",
        kind: path.dataset.connectionKind || "signal",
        index: Number(path.dataset.connectionIndex),
      }),
    );
  }

  for (const item of document.querySelectorAll("[data-connection-row-index]")) {
    item.classList.toggle(
      "selected",
      sameNodeGraphSelection(nodeGraphMvp.selected, {
        type: "wire",
        kind: item.dataset.connectionRowKind || "signal",
        index: Number(item.dataset.connectionRowIndex),
      }),
    );
  }

  const button = document.getElementById("nodeDeleteButton");
  button.disabled = !nodeGraphMvp.selected;
}

function nodeGraphPath(from, to) {
  const horizontalDistance = Math.abs(to.x - from.x);
  const verticalDistance = Math.abs(to.y - from.y);
  const span = Math.min(96, horizontalDistance * 0.48 + verticalDistance * 0.12);
  return `M ${from.x} ${from.y} C ${from.x + span} ${from.y}, ${to.x - span} ${to.y}, ${to.x} ${to.y}`;
}

function createNodeGraphWireGradient(svg, id, from, to, stopClass = "node-wire-gradient-stop") {
  const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
  gradient.id = id;
  gradient.setAttribute("gradientUnits", "userSpaceOnUse");
  gradient.setAttribute("x1", String(from.x));
  gradient.setAttribute("y1", String(from.y));
  gradient.setAttribute("x2", String(to.x));
  gradient.setAttribute("y2", String(to.y));

  for (const [offset, opacity] of [
    ["0%", "1"],
    ["50%", "0.16"],
    ["100%", "1"],
  ]) {
    const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop.setAttribute("class", stopClass);
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-opacity", opacity);
    gradient.append(stop);
  }

  svg.querySelector("defs")?.append(gradient);
  return `url(#${id})`;
}

function selectNodeGraphWire(event, index, kind = "signal") {
  event.stopPropagation();
  setNodeGraphSelection({ type: "wire", kind, index });
}

function drawNodeGraphWirePath(svg, options) {
  const {
    from,
    gradientClass = "node-wire-gradient-stop",
    gradientId,
    index,
    kind = "signal",
    pathClass = "node-wire-path",
    to,
  } = options;
  const pathData = nodeGraphPath(from, to);
  const stroke = createNodeGraphWireGradient(svg, gradientId, from, to, gradientClass);
  const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  hitPath.setAttribute("class", "node-wire-hit-path");
  hitPath.dataset.connectionIndex = String(index);
  hitPath.dataset.connectionKind = kind;
  hitPath.setAttribute("d", pathData);
  hitPath.addEventListener("click", (event) => selectNodeGraphWire(event, index, kind));
  svg.append(hitPath);

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", pathClass);
  path.dataset.connectionIndex = String(index);
  path.dataset.connectionKind = kind;
  path.setAttribute("d", pathData);
  path.setAttribute("stroke", stroke);
  svg.append(path);
}

function drawNodeGraphWires() {
  const workspace = nodeGraphZoomSurface();
  const svg = document.getElementById("nodeWireSvg");
  if (!workspace || !svg) {
    return;
  }

  const graphRect = nodeGraphGraphRect();
  svg.setAttribute("viewBox", `0 0 ${graphRect.width} ${graphRect.height}`);
  svg.replaceChildren();
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  svg.append(defs);

  for (const node of workspace.querySelectorAll(".dsp-node")) {
    node.classList.remove("connected");
  }

  for (const [index, connection] of nodeGraphMvp.connections.entries()) {
    if (
      !nodeGraphMvp.activeNodes.has(connection.sourceNode) ||
      !nodeGraphMvp.activeNodes.has(connection.destinationNode)
    ) {
      continue;
    }

    const from = nodeGraphPortCenter(connection.sourceNode, connection.sourcePort, "output");
    const to = nodeGraphPortCenter(
      connection.destinationNode,
      connection.destinationPort,
      "input",
    );
    drawNodeGraphWirePath(svg, {
      from,
      gradientId: `node-wire-gradient-${index}`,
      index,
      kind: "signal",
      to,
    });

    nodeGraphNodeElement(connection.sourceNode)?.classList.add("connected");
    nodeGraphNodeElement(connection.destinationNode)?.classList.add("connected");
  }

  for (const [index, modulation] of nodeGraphMvp.modulations.entries()) {
    if (
      !nodeGraphMvp.activeNodes.has(modulation.sourceNode) ||
      !nodeGraphMvp.activeNodes.has(modulation.destinationNode)
    ) {
      continue;
    }

    const from = nodeGraphPortCenter(modulation.sourceNode, modulation.sourcePort, "output");
    const to = nodeGraphModulationPortCenter(
      modulation.destinationNode,
      modulation.destinationParam,
    );
    drawNodeGraphWirePath(svg, {
      from,
      gradientClass: "node-modulation-wire-gradient-stop",
      gradientId: `node-modulation-wire-gradient-${index}`,
      index,
      kind: "modulation",
      pathClass: "node-wire-path node-modulation-wire-path",
      to,
    });

    nodeGraphNodeElement(modulation.sourceNode)?.classList.add("connected");
    nodeGraphNodeElement(modulation.destinationNode)?.classList.add("connected");
  }

  if (nodeGraphMvp.dragging) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const stroke = createNodeGraphWireGradient(
      svg,
      "node-wire-gradient-temp",
      nodeGraphMvp.dragging.from,
      nodeGraphMvp.dragging.to,
    );
    path.setAttribute("class", "node-wire-path temp");
    path.setAttribute("stroke", stroke);
    path.setAttribute(
      "d",
      nodeGraphPath(nodeGraphMvp.dragging.from, nodeGraphMvp.dragging.to),
    );
    svg.append(path);
  }

  renderNodeGraphSelection();
}

function renderNodeGraphConnectionList() {
  const plan = compileNodeGraphExecutionPlan();
  const validation = {
    issues: plan.issues,
    scheduleText: nodeGraphScheduleText(plan.order, plan.issues),
    sourceNodes: plan.sourceNodes,
    valid: plan.valid,
  };
  const list = document.getElementById("nodeConnectionList");
  const status = document.getElementById("nodeGraphStatus");
  const source = document.getElementById("nodeGraphSource");
  const validationPill = document.getElementById("nodeGraphValidation");

  list.replaceChildren();
  let renderedWireCount = 0;
  for (const [index, connection] of nodeGraphMvp.connections.entries()) {
    if (
      !nodeGraphMvp.activeNodes.has(connection.sourceNode) ||
      !nodeGraphMvp.activeNodes.has(connection.destinationNode)
    ) {
      continue;
    }

    const item = document.createElement("li");
    item.dataset.connectionRowIndex = String(index);
    item.dataset.connectionRowKind = "signal";
    item.classList.toggle(
      "selected",
      sameNodeGraphSelection(nodeGraphMvp.selected, { type: "wire", kind: "signal", index }),
    );
    item.addEventListener("click", () => setNodeGraphSelection({ type: "wire", kind: "signal", index }));
    const label = document.createElement("span");
    label.textContent = `${nodeGraphLabel(connection.sourceNode, connection.sourcePort)} -> ${nodeGraphLabel(
      connection.destinationNode,
      connection.destinationPort,
    )}`;
    const button = document.createElement("button");
    button.className = "disconnect-wire-button";
    button.type = "button";
    button.textContent = "Disconnect";
    button.dataset.connectionIndex = String(index);
    button.dataset.connectionKind = "signal";
    button.setAttribute("aria-label", `Disconnect ${label.textContent}`);
    button.addEventListener("click", () => disconnectNodeGraphConnection(index, "signal"));
    item.append(label, button);
    list.append(item);
    renderedWireCount += 1;
  }

  for (const [index, modulation] of nodeGraphMvp.modulations.entries()) {
    if (
      !nodeGraphMvp.activeNodes.has(modulation.sourceNode) ||
      !nodeGraphMvp.activeNodes.has(modulation.destinationNode)
    ) {
      continue;
    }

    const item = document.createElement("li");
    item.dataset.connectionRowIndex = String(index);
    item.dataset.connectionRowKind = "modulation";
    item.classList.toggle(
      "selected",
      sameNodeGraphSelection(nodeGraphMvp.selected, { type: "wire", kind: "modulation", index }),
    );
    item.addEventListener("click", () => setNodeGraphSelection({ type: "wire", kind: "modulation", index }));
    const label = document.createElement("span");
    label.textContent = `${nodeGraphLabel(modulation.sourceNode, modulation.sourcePort)} -> ${nodeGraphNodeDisplayName(
      modulation.destinationNode,
    )}.${modulation.destinationParam} mod`;
    const button = document.createElement("button");
    button.className = "disconnect-wire-button";
    button.type = "button";
    button.textContent = "Disconnect";
    button.dataset.connectionIndex = String(index);
    button.dataset.connectionKind = "modulation";
    button.setAttribute("aria-label", `Disconnect ${label.textContent}`);
    button.addEventListener("click", () => disconnectNodeGraphConnection(index, "modulation"));
    item.append(label, button);
    list.append(item);
    renderedWireCount += 1;
  }

  if (!renderedWireCount) {
    const item = document.createElement("li");
    item.className = "warn-row";
    item.textContent = "No wires connected";
    list.append(item);
  }

  status.textContent = validation.valid ? "Graph Valid" : "Graph Incomplete";
  status.className = `pill ${validation.valid ? "good" : "warn"}`;
  source.textContent = validation.scheduleText;
  validationPill.textContent = validation.valid
    ? "valid"
    : validation.issues.join(", ");
  validationPill.className = `pill ${validation.valid ? "good" : "warn"}`;

  document.getElementById("nodeRenderButton").disabled = !validation.valid;
  renderNodeGraphExecutionPlanDebug(plan);
  drawNodeGraphWires();
}

function disconnectNodeGraphConnection(index, kind = "signal") {
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  if (kind === "modulation") {
    patch.modulations = patch.modulations.filter(
      (_modulation, modulationIndex) => modulationIndex !== index,
    );
  } else {
    patch.connections = patch.connections.filter(
      (_connection, connectionIndex) => connectionIndex !== index,
    );
  }
  if (sameNodeGraphSelection(nodeGraphMvp.selected, { type: "wire", kind, index })) {
    setNodeGraphSelection(null);
  }
  commitNodeGraphPatch(patch, { status: "wire disconnected" });
}

function connectNodeGraphPorts(sourceNode, sourcePort, destinationNode, destinationPort) {
  if (
    !nodeGraphInputKey(destinationNode, destinationPort) ||
    !nodeGraphMvp.activeNodes.has(sourceNode) ||
    !nodeGraphMvp.activeNodes.has(destinationNode)
  ) {
    return false;
  }

  const duplicate = nodeGraphMvp.patch.connections.some(
    (connection) =>
      connection.sourceNode === sourceNode &&
      connection.sourcePort === sourcePort &&
      connection.destinationNode === destinationNode &&
      connection.destinationPort === destinationPort,
  );
  if (duplicate) {
    return false;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  patch.connections.push({
    sourceNode,
    sourcePort,
    destinationNode,
    destinationPort,
  });
  commitNodeGraphPatch(patch, { status: "wire connected" });
  return true;
}

function connectNodeGraphModulation(sourceNode, sourcePort, destinationNode, destinationParam) {
  if (
    !nodeGraphMvp.activeNodes.has(sourceNode) ||
    !nodeGraphMvp.activeNodes.has(destinationNode)
  ) {
    return false;
  }

  const duplicate = nodeGraphMvp.patch.modulations.some(
    (modulation) =>
      modulation.sourceNode === sourceNode &&
      modulation.sourcePort === sourcePort &&
      modulation.destinationNode === destinationNode &&
      modulation.destinationParam === destinationParam,
  );
  if (duplicate) {
    return false;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  patch.modulations.push({
    sourceNode,
    sourcePort,
    destinationNode,
    destinationParam,
  });
  commitNodeGraphPatch(patch, { status: "modulation connected" });
  return true;
}

function beginNodeGraphWireDrag(event) {
  const port = event.currentTarget;
  const from = nodeGraphPortCenter(port.dataset.node, port.dataset.port, "output");
  const to = nodeGraphClientPoint(event);
  nodeGraphMvp.dragging = {
    from,
    sourceNode: port.dataset.node,
    sourcePort: port.dataset.port,
    to,
  };
  port.classList.add("dragging");
  port.setPointerCapture(event.pointerId);
  drawNodeGraphWires();
}

function dragNodeGraphWire(event) {
  if (!nodeGraphMvp.dragging) {
    return;
  }

  nodeGraphMvp.dragging.to = nodeGraphClientPoint(event);
  drawNodeGraphWires();
}

function endNodeGraphWireDrag(event) {
  if (!nodeGraphMvp.dragging) {
    return;
  }

  const dragging = nodeGraphMvp.dragging;
  const target = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest?.(".node-port.input, .node-param-port.modulation-input");
  document
    .querySelector(nodeGraphPortSelector(dragging.sourceNode, dragging.sourcePort, "output"))
    ?.classList.remove("dragging");
  nodeGraphMvp.dragging = null;

  if (target?.classList?.contains("modulation-input") && target?.dataset.node && target?.dataset.param) {
    connectNodeGraphModulation(
      dragging.sourceNode,
      dragging.sourcePort,
      target.dataset.node,
      target.dataset.param,
    );
  } else if (target?.dataset.node && target?.dataset.port) {
    connectNodeGraphPorts(
      dragging.sourceNode,
      dragging.sourcePort,
      target.dataset.node,
      target.dataset.port,
    );
  } else {
    drawNodeGraphWires();
  }
}

function nodeGraphClientPoint(event) {
  const surface = nodeGraphZoomSurface();
  const surfaceRect = surface.getBoundingClientRect();
  const zoom = nodeGraphZoom();
  return {
    x: (event.clientX - surfaceRect.left) / zoom,
    y: (event.clientY - surfaceRect.top) / zoom,
  };
}

function positionNodeGraphNode(node, point, options = {}) {
  const graphRect = nodeGraphGraphRect();
  const maxX = Math.max(0, graphRect.width - node.offsetWidth - 10);
  const maxY = Math.max(0, graphRect.height - node.offsetHeight - 10);
  const positionedPoint = options.snap === false ? point : snapNodeGraphPointToGrid(point);
  const x = options.clamp === false
    ? positionedPoint.x
    : Math.max(0, Math.min(maxX, positionedPoint.x));
  const y = options.clamp === false
    ? positionedPoint.y
    : Math.max(0, Math.min(maxY, positionedPoint.y));
  node.style.setProperty("--node-x", `${x}px`);
  node.style.setProperty("--node-y", `${y}px`);
}

function nodeGraphRectFromPoints(a, b) {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x, b.x);
  const bottom = Math.max(a.y, b.y);
  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  };
}

function nodeGraphNodeBounds(node) {
  const x = Number.parseFloat(node.style.getPropertyValue("--node-x")) || 0;
  const y = Number.parseFloat(node.style.getPropertyValue("--node-y")) || 0;
  return {
    bottom: y + node.offsetHeight,
    left: x,
    right: x + node.offsetWidth,
    top: y,
  };
}

function nodeGraphRectsIntersect(a, b) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function renderNodeGraphMarqueeSelection() {
  const marquee = document.getElementById("nodeSelectionMarquee");
  const drag = nodeGraphMvp.marqueeSelection;
  if (!marquee || !drag) {
    if (marquee) {
      marquee.hidden = true;
    }
    return;
  }

  const rect = nodeGraphRectFromPoints(drag.start, drag.current);
  marquee.hidden = false;
  marquee.style.left = `${rect.left}px`;
  marquee.style.top = `${rect.top}px`;
  marquee.style.width = `${rect.width}px`;
  marquee.style.height = `${rect.height}px`;
}

function nodeGraphNodesInsideRect(rect) {
  const ids = [];
  for (const node of document.querySelectorAll(".dsp-node:not(.removed)")) {
    if (nodeGraphRectsIntersect(rect, nodeGraphNodeBounds(node))) {
      ids.push(node.dataset.node);
    }
  }
  return ids;
}

function updateNodeGraphMarqueeSelection() {
  const drag = nodeGraphMvp.marqueeSelection;
  if (!drag) {
    return;
  }

  const rect = nodeGraphRectFromPoints(drag.start, drag.current);
  const ids = nodeGraphNodesInsideRect(rect);
  setNodeGraphNodeSelection(ids);
  renderNodeGraphMarqueeSelection();
}

function beginNodeGraphMarqueeSelection(event) {
  if (
    event.button !== 0 ||
    event.target.closest(
      ".dsp-node, .node-port, .node-slider-readout, .node-wire-hit-path, button, input, textarea, select",
    )
  ) {
    return;
  }

  const workspace = event.currentTarget;
  const point = nodeGraphClientPoint(event);
  nodeGraphMvp.marqueeSelection = {
    current: point,
    moved: false,
    pointerId: event.pointerId,
    start: point,
  };
  setNodeGraphSelection(null);
  renderNodeGraphMarqueeSelection();
  workspace.setPointerCapture(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function dragNodeGraphMarqueeSelection(event) {
  const drag = nodeGraphMvp.marqueeSelection;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }

  drag.current = nodeGraphClientPoint(event);
  drag.moved ||=
    Math.abs(drag.current.x - drag.start.x) > 3 ||
    Math.abs(drag.current.y - drag.start.y) > 3;
  if (drag.moved) {
    updateNodeGraphMarqueeSelection();
  } else {
    renderNodeGraphMarqueeSelection();
  }
  event.preventDefault();
  event.stopPropagation();
}

function endNodeGraphMarqueeSelection(event) {
  const drag = nodeGraphMvp.marqueeSelection;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }

  if (drag.moved) {
    updateNodeGraphMarqueeSelection();
  } else {
    setNodeGraphSelection(null);
  }
  nodeGraphMvp.marqueeSelection = null;
  renderNodeGraphMarqueeSelection();
  if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
  event.preventDefault();
  event.stopPropagation();
}

function positionNodeSceneContextMenu(menu, x, y) {
  const margin = 12;
  menu.hidden = false;
  const rect = menu.getBoundingClientRect();
  const left = Math.max(margin, Math.min(window.innerWidth - rect.width - margin, x));
  const top = Math.max(margin, Math.min(window.innerHeight - rect.height - margin, y));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function configureNodeSceneContextMenu(mode) {
  const menu = document.getElementById("nodeSceneContextMenu");
  const title = menu.querySelector(".scene-context-title");
  const addGroup = menu.querySelector(".scene-context-add-group");
  const deleteButton = document.getElementById("nodeSceneDeleteModule");
  const moduleMode = mode === "module";
  title.textContent = moduleMode ? "Module" : "Add Module";
  addGroup.hidden = moduleMode;
  deleteButton.hidden = !moduleMode;
  if (moduleMode) {
    const deletableIds = [...nodeGraphSelectedNodeIds()].filter((id) => id !== "output");
    deleteButton.disabled = !deletableIds.length;
  } else {
    deleteButton.disabled = true;
  }
}

function openNodeModuleActionMenu(event) {
  const button = event.currentTarget;
  const node = button.closest(".dsp-node");
  if (!node) {
    return;
  }

  const selectedNodeIds = nodeGraphSelectedNodeIds();
  if (!selectedNodeIds.has(node.dataset.node)) {
    setNodeGraphSelection({ type: "node", id: node.dataset.node });
  }
  nodeGraphMvp.sceneContextPoint = null;
  nodeGraphMvp.sceneContextTargetNode = node.dataset.node;
  configureNodeSceneContextMenu("module");
  const rect = button.getBoundingClientRect();
  positionNodeSceneContextMenu(
    document.getElementById("nodeSceneContextMenu"),
    rect.right,
    rect.bottom,
  );
  event.preventDefault();
  event.stopPropagation();
}

function openNodeSceneContextMenu(event) {
  if (event.target.closest(".dsp-node")) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (event.target.closest(".node-port, .node-param-port, .node-slider-readout")) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  nodeGraphMvp.sceneContextPoint = nodeGraphClientPoint(event);
  nodeGraphMvp.sceneContextTargetNode = null;
  configureNodeSceneContextMenu("add");
  positionNodeSceneContextMenu(
    document.getElementById("nodeSceneContextMenu"),
    event.clientX,
    event.clientY,
  );
}

function beginNodeGraphNodeDrag(event) {
  const handle = event.currentTarget.closest(".node-drag-handle");
  if (!handle) {
    return;
  }

  const node = handle.closest(".dsp-node");
  if (!node) {
    return;
  }

  const selectedNodeIds = nodeGraphSelectedNodeIds();
  if (!selectedNodeIds.has(node.dataset.node)) {
    setNodeGraphSelection({ type: "node", id: node.dataset.node });
  }
  const point = nodeGraphClientPoint(event);
  const draggedNodeIds = nodeGraphSelectedNodeIds();
  const draggedNodes = [...draggedNodeIds]
    .map((id) => nodeGraphNodeElement(id))
    .filter(Boolean)
    .map((element) => {
      const x = Number.parseFloat(element.style.getPropertyValue("--node-x")) || 0;
      const y = Number.parseFloat(element.style.getPropertyValue("--node-y")) || 0;
      return {
        element,
        id: element.dataset.node,
        startX: x,
        startY: y,
      };
    });

  nodeGraphMvp.nodeDragging = {
    draggedNodes,
    handle,
    node,
    startPoint: point,
  };
  for (const dragged of draggedNodes) {
    dragged.element.classList.add("dragging");
  }
  handle.classList.add("dragging");
  handle.setPointerCapture(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function dragNodeGraphNode(event) {
  if (!nodeGraphMvp.nodeDragging) {
    return;
  }

  const { draggedNodes, startPoint } = nodeGraphMvp.nodeDragging;
  const point = nodeGraphClientPoint(event);
  const deltaX = point.x - startPoint.x;
  const deltaY = point.y - startPoint.y;
  for (const dragged of draggedNodes) {
    positionNodeGraphNode(dragged.element, {
      x: dragged.startX + deltaX,
      y: dragged.startY + deltaY,
    }, { snap: false });
  }
  drawNodeGraphWires();
}

function endNodeGraphNodeDrag(event) {
  if (!nodeGraphMvp.nodeDragging) {
    return;
  }

  const { draggedNodes, handle } = nodeGraphMvp.nodeDragging;
  for (const dragged of draggedNodes) {
    dragged.element.classList.remove("dragging");
  }
  handle.classList.remove("dragging");
  if (handle.hasPointerCapture?.(event.pointerId)) {
    handle.releasePointerCapture(event.pointerId);
  }
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  for (const dragged of draggedNodes) {
    const x = Number.parseFloat(dragged.element.style.getPropertyValue("--node-x")) || 0;
    const y = Number.parseFloat(dragged.element.style.getPropertyValue("--node-y")) || 0;
    const gridPoint = nodeGraphPixelToGrid({ x, y });
    const patchNode = patch.nodes.find((candidate) => candidate.id === dragged.id);
    if (patchNode) {
      patchNode.gx = gridPoint.gx;
      patchNode.gy = gridPoint.gy;
    }
  }
  nodeGraphMvp.nodeDragging = null;
  commitNodeGraphPatch(patch, { status: "layout snapped" });
}

function restoreDefaultNodeGraph() {
  setNodeGraphSelection(null);
  commitNodeGraphPatch(cloneNodeGraphPatch(nodeGraphDefaultPatch), {
    status: "default chain",
  });
  loadNodeMetadataKindTemplates();
}

function clearNodeGraphWires() {
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  patch.connections = [];
  patch.modulations = [];
  setNodeGraphSelection(null);
  nodeGraphMvp.rendered = null;
  document.getElementById("nodePlayButton").disabled = true;
  document.getElementById("nodeGraphRenderStatus").textContent = "render pending";
  document.getElementById("nodeGraphRenderStatus").className = "pill warn";
  document.getElementById("nodeOutputSummary").textContent = "waiting for render";
  commitNodeGraphPatch(patch, { status: "wires cleared" });
  drawNodeRenderedAudio();
}

function renderNodeVisibility() {
  for (const node of document.querySelectorAll(".dsp-node")) {
    node.classList.toggle("removed", !nodeGraphMvp.activeNodes.has(node.dataset.node));
  }
  drawNodeGraphWires();
}

function renderNodePalette() {
  for (const button of document.querySelectorAll("[data-palette-node]")) {
    button.classList.remove("active");
    button.setAttribute("aria-pressed", "false");
  }
}

function defaultNodeGraphModuleGridPoint(type) {
  const count = nodeGraphMvp.nodeTypeCounts[type] || 1;
  return {
    gx: 3 + count * 2,
    gy: 3 + count * 2,
  };
}

function showNodeGraphModule(node, point = null) {
  const type = node;
  if (type === "output" || !Object.hasOwn(nodeGraphModuleDefinitions, type)) {
    return;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const counts = nextNodeGraphTypeCounts(patch.nodes);
  counts[type] = (counts[type] || 0) + 1;
  const id = `${type}-${counts[type]}`;
  const gridPoint = point ? nodeGraphPixelToGrid(point) : defaultNodeGraphModuleGridPoint(type);
  patch.nodes.push({
    gx: gridPoint.gx,
    gy: gridPoint.gy,
    id,
    type,
  });
  commitNodeGraphPatch(patch, { status: "module added" });
  setNodeGraphSelection({ type: "node", id });
}

function showPaletteNode(node) {
  showNodeGraphModule(node);
}

function addNodeGraphModuleFromContext(event) {
  showNodeGraphModule(event.currentTarget.dataset.contextModule, nodeGraphMvp.sceneContextPoint);
  closeNodeSceneContextMenu();
}

function deleteNodeGraphModuleFromContext() {
  deleteSelectedNodeGraphItem();
  closeNodeSceneContextMenu();
}

function setNodeGraphViewMode(mode) {
  const settingsMode = mode === "settings";
  const scriptMode = mode === "script";
  const modularMode = !settingsMode && !scriptMode;
  document.getElementById("nodeGraphWorkspace").hidden = !modularMode;
  document.getElementById("nodeScriptView").hidden = !scriptMode;
  document.getElementById("nodeSettingsView").hidden = !settingsMode;
  document.getElementById("nodeSettingsViewButton").classList.toggle("active", settingsMode);
  document.getElementById("nodeModularViewButton").classList.toggle("active", modularMode);
  document.getElementById("nodeScriptViewButton").classList.toggle("active", scriptMode);
  document.getElementById("nodeSettingsViewButton").setAttribute("aria-pressed", String(settingsMode));
  document.getElementById("nodeModularViewButton").setAttribute("aria-pressed", String(modularMode));
  document.getElementById("nodeScriptViewButton").setAttribute("aria-pressed", String(scriptMode));
  if (scriptMode) {
    syncNodeGraphScriptView();
  } else if (settingsMode) {
    syncNodeGraphSettingsView();
  } else {
    drawNodeGraphWires();
  }
}

function handleNodePatchScriptInput(event) {
  commitNodeGraphScript(event.currentTarget.value);
}

function nodeGraphPatchFileName() {
  const info = normalizeNodeGraphPatchInfo(nodeGraphMvp.patch.info);
  const baseName = info.name || "soemdsp-patch";
  const safeName = baseName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${safeName || "soemdsp-patch"}.json`;
}

function saveNodeGraphScript() {
  const blob = new Blob([`${serializeNodeGraphPatch()}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nodeGraphPatchFileName();
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  setNodeGraphScriptStatus("script saved", true);
}

function loadNodeGraphScript() {
  document.getElementById("nodePatchScriptFileInput")?.click();
}

function handleNodeGraphScriptFileLoad(event) {
  const [file] = event.currentTarget.files || [];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      commitNodeGraphPatch(loadNodeGraphPatchFromScript(String(reader.result || "")), {
        status: "script loaded",
      });
    } catch (error) {
      setNodeGraphScriptStatus(error.message, false);
    } finally {
      event.currentTarget.value = "";
    }
  });
  reader.addEventListener("error", () => {
    setNodeGraphScriptStatus("script file read failed", false);
    event.currentTarget.value = "";
  });
  reader.readAsText(file);
}

function deleteSelectedNodeGraphItem() {
  const selection = nodeGraphMvp.selected;
  if (!selection) {
    return;
  }

  if (selection.type === "wire") {
    disconnectNodeGraphConnection(selection.index, selection.kind || "signal");
    return;
  }

  const selectedNodeIds = nodeGraphSelectedNodeIds(selection);
  if (selectedNodeIds.size) {
    selectedNodeIds.delete("output");
  }
  if (selectedNodeIds.size) {
    const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
    patch.nodes = patch.nodes.filter((node) => !selectedNodeIds.has(node.id));
    patch.connections = patch.connections.filter(
      (connection) =>
        !selectedNodeIds.has(connection.sourceNode) &&
        !selectedNodeIds.has(connection.destinationNode),
    );
    patch.modulations = patch.modulations.filter(
      (modulation) =>
        !selectedNodeIds.has(modulation.sourceNode) &&
        !selectedNodeIds.has(modulation.destinationNode),
    );
    setNodeGraphSelection(null);
    commitNodeGraphPatch(patch, {
      status: selectedNodeIds.size === 1 ? "module deleted" : "modules deleted",
    });
  }
}

function handleNodeGraphKeydown(event) {
  if (event.key === "Escape" && !document.getElementById("nodeSceneContextMenu").hidden) {
    closeNodeSceneContextMenu();
    return;
  }
  if (event.target.closest("input, textarea, select")) {
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
    event.preventDefault();
    undoNodeGraphPatch();
    return;
  }
  if (
    (event.ctrlKey || event.metaKey) &&
    (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"))
  ) {
    event.preventDefault();
    redoNodeGraphPatch();
    return;
  }
  if (event.key !== "Delete" && event.key !== "Backspace") {
    return;
  }

  deleteSelectedNodeGraphItem();
}

function nodeInteractionHelpText(target) {
  if (!(target instanceof Element)) {
    return "";
  }
  const helpTarget = target.closest(
    "[data-interaction-help], button, input, textarea, select, .node-slider-readout, .node-port, .node-param-port",
  );
  if (!helpTarget) {
    return "";
  }
  return nodeInteractionMouseHint(helpTarget);
}

function nodeInteractionMouseHint(element) {
  if (element.classList.contains("node-drag-handle")) {
    return "Mouse: drag to move selected module(s).";
  }
  if (element.classList.contains("node-action-button")) {
    return "Mouse: click to open module actions.";
  }
  if (element.classList.contains("node-slider-readout")) {
    return "Mouse: drag adjusts, double-click types, right-click edits metadata.";
  }
  if (element.classList.contains("node-port")) {
    return "Mouse: drag to connect signal wire.";
  }
  if (element.classList.contains("node-param-port")) {
    return "Mouse: reserved modulation input.";
  }
  if (element.matches("input, textarea, select")) {
    return "Mouse: click to edit, drag to select text.";
  }
  if (element.id === "nodeZoomOutButton" || element.id === "nodeZoomInButton") {
    return "Mouse: click to zoom modular view.";
  }
  if (element.id === "nodeSettingsViewButton" || element.id === "nodeModularViewButton" || element.id === "nodeScriptViewButton") {
    return "Mouse: click to switch view.";
  }
  if (element.id === "nodeUndoButton" || element.id === "nodeRedoButton") {
    return "Mouse: click to step patch history.";
  }
  if (element.dataset.paletteNode) {
    return "Mouse: click to add or show module.";
  }
  if (element.id === "nodeRenderButton") {
    return "Mouse: click to render sample.";
  }
  if (element.id === "nodePlayButton") {
    return "Mouse: click to play rendered sample.";
  }
  if (element.id === "nodeDeleteButton") {
    return "Mouse: click to delete selected item.";
  }
  if (element.matches("button")) {
    return "Mouse: click to activate.";
  }
  return "Mouse: interact for details.";
}

function setNodeInteractionHelp(text = "") {
  const help = document.getElementById("nodeInteractionHelp");
  if (help) {
    help.textContent = text;
  }
}

function handleNodeInteractionHelp(event) {
  setNodeInteractionHelp(nodeInteractionHelpText(event.target));
}

function attachNodeInteractionHelpTarget(element) {
  element.dataset.interactionHelpReady = "true";
  const showHelp = () => setNodeInteractionHelp(nodeInteractionHelpText(element));
  element.addEventListener("pointerover", showHelp);
  element.addEventListener("mouseover", showHelp);
  element.addEventListener("pointerdown", showHelp);
  element.addEventListener("click", showHelp);
  element.addEventListener("focus", showHelp);
}

function toggleDebugSections() {
  const collapsed = !document.body.classList.contains("debug-collapsed");
  document.body.classList.toggle("debug-collapsed", collapsed);
  const button = document.getElementById("toggleDebugButton");
  button.textContent = collapsed ? "Show Evidence" : "Hide Evidence";
  button.setAttribute("aria-pressed", String(!collapsed));
}

function nodeGraphStableSeed(text) {
  let seed = 0x12345678;
  for (const character of text) {
    seed = (Math.imul(seed ^ character.charCodeAt(0), 16777619)) >>> 0;
  }
  return seed || 0x12345678;
}

function setNodeGraphLiveStatus(text, state = "") {
  const status = document.getElementById("nodeLiveStatus");
  if (!status) {
    return;
  }
  status.textContent = text;
  status.className = `pill ${state}`.trim();
}

function setNodeGraphLiveMeter(peak = 0, rms = 0) {
  const meter = document.getElementById("nodeLiveMeter");
  if (!meter) {
    return;
  }
  meter.textContent = `live peak ${peak.toFixed(3)} / rms ${rms.toFixed(3)}`;
  meter.className = `pill ${peak > 0.001 ? "good" : ""}`.trim();
}

function setNodeGraphLiveRouteStatus(text, state = "") {
  const status = document.getElementById("nodeLiveRouteStatus");
  if (!status) {
    return;
  }
  status.textContent = text;
  status.className = `pill ${state}`.trim();
}

function renderNodeGraphLiveControls(running = Boolean(nodeGraphMvp.live.node)) {
  const starting = document.getElementById("nodeLiveStatus")?.textContent === "starting";
  const inputButton = document.getElementById("nodeLiveInputButton");
  const outputButton = document.getElementById("nodeLiveOutputButton");
  if (inputButton) {
    inputButton.classList.toggle("active", Boolean(nodeGraphMvp.live.inputActive));
    inputButton.setAttribute("aria-pressed", nodeGraphMvp.live.inputActive ? "true" : "false");
  }
  if (outputButton) {
    outputButton.disabled = starting;
    outputButton.classList.toggle("active", running || starting);
    outputButton.setAttribute("aria-pressed", running || starting ? "true" : "false");
  }
}

function toggleNodeGraphLiveInput() {
  nodeGraphMvp.live.inputActive = !nodeGraphMvp.live.inputActive;
  renderNodeGraphLiveControls();
}

function toggleNodeGraphLiveOutput() {
  if (document.getElementById("nodeLiveStatus")?.textContent === "starting") {
    return;
  }
  if (nodeGraphMvp.live.node || nodeGraphMvp.live.context) {
    stopNodeGraphLiveAudio();
  } else {
    startNodeGraphLiveAudio();
  }
}

function nodeGraphBuildLivePlan() {
  const compiled = compileNodeGraphExecutionPlan();
  if (!compiled.valid) {
    throw new Error(compiled.issues.join(", "));
  }

  return {
    connections: nodeGraphMvp.patch.connections.map((connection) => ({ ...connection })),
    modulations: nodeGraphMvp.patch.modulations.map((modulation) => ({ ...modulation })),
    nodes: nodeGraphMvp.patch.nodes.map((node) => {
      const definition = nodeGraphModuleDefinitions[node.type];
      const params = {};
      const paramMeta = {};
      for (const parameter of definition.parameters || []) {
        const value = nodeGraphReadNodeNumber(node.id, parameter.key);
        params[parameter.key] = Number.isFinite(value)
          ? value
          : nodeGraphParameterFallback(node.type, parameter.key);
        paramMeta[parameter.key] = nodeGraphReadNodeParameterMetadata(node.id, parameter.key);
      }
      return {
        id: node.id,
        paramMeta,
        params,
        type: node.type,
      };
    }),
    order: [...compiled.order],
    outputNode: compiled.outputNode,
    sourceNodes: [...compiled.sourceNodes],
  };
}

function createNodeGraphLiveRuntime(plan) {
  const nodes = new Map((plan.nodes || []).map((node) => [node.id, node]));
  const inputConnections = new Map();
  for (const connection of plan.connections || []) {
    const key = `${connection.destinationNode}.${connection.destinationPort}`;
    const connections = inputConnections.get(key) || [];
    connections.push(connection);
    inputConnections.set(key, connections);
  }
  const modulationConnections = new Map();
  for (const modulation of plan.modulations || []) {
    const key = nodeGraphParameterKey(modulation.destinationNode, modulation.destinationParam);
    const modulations = modulationConnections.get(key) || [];
    modulations.push(modulation);
    modulationConnections.set(key, modulations);
  }
  const phases = new Map();
  const noiseSeeds = new Map();
  const smoothers = new Map();
  for (const node of plan.nodes || []) {
    if (node.type === "osc") {
      phases.set(node.id, 0);
    }
    if (node.type === "osc" || node.type === "noise") {
      noiseSeeds.set(node.id, nodeGraphStableSeed(node.id));
    }
    for (const [key, value] of Object.entries(node.params || {})) {
      smoothers.set(
        nodeGraphParameterKey(node.id, key),
        createNodeGraphParameterSmoother(value, node.paramMeta?.[key]),
      );
    }
  }
  return {
    inputConnections,
    meterCounter: 0,
    meterPeak: 0,
    meterSamples: 0,
    meterSquareSum: 0,
    modulationConnections,
    nodes,
    noiseSeeds,
    order: [...(plan.order || [])],
    outputNode: plan.outputNode || "output",
    phases,
    smoothers,
  };
}

function updateNodeGraphLiveRuntimePlan(runtime, plan) {
  runtime.nodes = new Map((plan.nodes || []).map((node) => [node.id, node]));
  runtime.inputConnections = new Map();
  for (const connection of plan.connections || []) {
    const key = `${connection.destinationNode}.${connection.destinationPort}`;
    const connections = runtime.inputConnections.get(key) || [];
    connections.push(connection);
    runtime.inputConnections.set(key, connections);
  }
  runtime.modulationConnections = new Map();
  for (const modulation of plan.modulations || []) {
    const key = nodeGraphParameterKey(modulation.destinationNode, modulation.destinationParam);
    const modulations = runtime.modulationConnections.get(key) || [];
    modulations.push(modulation);
    runtime.modulationConnections.set(key, modulations);
  }
  runtime.order = [...(plan.order || [])];
  runtime.outputNode = plan.outputNode || "output";
  const nodeIds = new Set(runtime.nodes.keys());
  for (const node of plan.nodes || []) {
    if (node.type === "osc" && !runtime.phases.has(node.id)) {
      runtime.phases.set(node.id, 0);
    }
    if ((node.type === "osc" || node.type === "noise") && !runtime.noiseSeeds.has(node.id)) {
      runtime.noiseSeeds.set(node.id, nodeGraphStableSeed(node.id));
    }
    for (const [key, value] of Object.entries(node.params || {})) {
      const smootherKey = nodeGraphParameterKey(node.id, key);
      const metadata = node.paramMeta?.[key];
      if (!runtime.smoothers.has(smootherKey)) {
        runtime.smoothers.set(
          smootherKey,
          createNodeGraphParameterSmoother(value, metadata),
        );
      } else {
        updateNodeGraphParameterSmoother(runtime.smoothers.get(smootherKey), value, metadata);
      }
    }
  }
  for (const id of [...runtime.phases.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.phases.delete(id);
    }
  }
  for (const id of [...runtime.noiseSeeds.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.noiseSeeds.delete(id);
    }
  }
  for (const key of [...runtime.smoothers.keys()]) {
    const [nodeId, parameter] = key.split(".");
    if (!nodeIds.has(nodeId) || !runtime.nodes.get(nodeId)?.params || !(parameter in runtime.nodes.get(nodeId).params)) {
      runtime.smoothers.delete(key);
    }
  }
}

function readNodeGraphLiveParam(node, key, fallback = 0) {
  const value = Number(node?.params?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function readNodeGraphLiveSmoothedParam(runtime, node, key, fallback, frame, frames) {
  const smoother = runtime.smoothers.get(nodeGraphParameterKey(node?.id, key));
  if (!smoother) {
    return readNodeGraphLiveParam(node, key, fallback);
  }
  return readNodeGraphSmoothedParameter(smoother, frame, frames);
}

function nodeGraphApplyParameterBounds(value, metadata = {}) {
  const min = Number(metadata.min);
  const max = Number(metadata.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return value;
  }
  return metadata.wraparound
    ? wrapNodeSliderValue(value, min, max)
    : clampNodeSliderValue(value, min, max);
}

function readNodeGraphLiveEffectiveParam(
  runtime,
  node,
  key,
  fallback,
  frame,
  frames,
  frameValues,
) {
  const base = readNodeGraphLiveSmoothedParam(runtime, node, key, fallback, frame, frames);
  const metadata = node?.paramMeta?.[key] || {};
  const min = Number(metadata.min);
  const max = Number(metadata.max);
  const depth = Number.isFinite(min) && Number.isFinite(max) ? (max - min) * 0.5 : 0;
  const modulations = runtime.modulationConnections?.get(nodeGraphParameterKey(node?.id, key)) || [];
  const modulationValue = modulations.reduce(
    (sum, modulation) =>
      sum + (frameValues.get(modulation.sourceNode) || 0) * depth,
    0,
  );
  return nodeGraphApplyParameterBounds(base + modulationValue, metadata);
}

function nodeGraphPhaseRadians(value) {
  return wrapNodeSliderValue(Number(value) || 0, 0, 1) * Math.PI * 2;
}

function nextNodeGraphNoiseSample(runtime, nodeId) {
  const seed = (Math.imul(1664525, runtime.noiseSeeds.get(nodeId) || 0x12345678) + 1013904223) >>> 0;
  runtime.noiseSeeds.set(nodeId, seed);
  return (seed / 0xffffffff) * 2 - 1;
}

function nodeGraphOscillatorWaveformSample(runtime, nodeId, phase, waveform) {
  const phaseCycle = wrapNodeSliderValue(phase / (Math.PI * 2), 0, 1);
  switch (Math.round(Number(waveform) || 0)) {
    case 1:
      return phaseCycle < 0.5 ? 1 : -1;
    case 2:
      return 1 - Math.abs(phaseCycle - 0.5) * 4;
    case 3:
      return Math.sin(phase);
    case 4:
      return nextNodeGraphNoiseSample(runtime, nodeId);
    case 0:
    default:
      return phaseCycle * 2 - 1;
  }
}

function evaluateNodeGraphPlanFrame(runtime, sampleRate, frame, frames) {
  const frameValues = new Map();
  const mixInput = (nodeId, port = "In") => (runtime.inputConnections.get(`${nodeId}.${port}`) || []).reduce(
    (sum, connection) => sum + (frameValues.get(connection.sourceNode) || 0),
    0,
  );

  for (const nodeId of runtime.order || []) {
    const node = runtime.nodes.get(nodeId);
    let value = 0;

    if (node?.type === "osc") {
      const phase = runtime.phases.get(nodeId) || 0;
      const phaseOffset = nodeGraphPhaseRadians(
        readNodeGraphLiveEffectiveParam(
          runtime,
          node,
          "phase",
          0,
          frame,
          frames,
          frameValues,
        ),
      );
      const frequency = readNodeGraphLiveEffectiveParam(
        runtime,
        node,
        "frequency",
        220,
        frame,
        frames,
        frameValues,
      );
      const waveform = readNodeGraphLiveEffectiveParam(
        runtime,
        node,
        "waveform",
        0,
        frame,
        frames,
        frameValues,
      );
      value = nodeGraphOscillatorWaveformSample(
        runtime,
        nodeId,
        phase + phaseOffset,
        waveform,
      ) * readNodeGraphLiveEffectiveParam(
        runtime,
        node,
        "level",
        0.35,
        frame,
        frames,
        frameValues,
      );
      runtime.phases.set(
        nodeId,
        (phase + (Math.PI * 2 * frequency) / sampleRate) % (Math.PI * 2),
      );
    } else if (node?.type === "noise") {
      value = nextNodeGraphNoiseSample(runtime, nodeId) * readNodeGraphLiveEffectiveParam(
        runtime,
        node,
        "level",
        0.12,
        frame,
        frames,
        frameValues,
      );
    } else if (node?.type === "gain") {
      value = mixInput(nodeId) * readNodeGraphLiveEffectiveParam(
        runtime,
        node,
        "amount",
        1,
        frame,
        frames,
        frameValues,
      );
    } else if (node?.type === "bias") {
      value = mixInput(nodeId) + readNodeGraphLiveEffectiveParam(
        runtime,
        node,
        "offset",
        0,
        frame,
        frames,
        frameValues,
      );
    } else if (node?.type === "output") {
      const left = mixInput(nodeId, "Left");
      const right = mixInput(nodeId, "Right");
      value = (left + right) * 0.5;
    }

    frameValues.set(nodeId, value);
  }

  return {
    frameValues,
    left: mixInput(runtime.outputNode || "output", "Left"),
    right: mixInput(runtime.outputNode || "output", "Right"),
  };
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
  for (let frame = 0; frame < frames; frame += 1) {
    const frameOutput = evaluateNodeGraphPlanFrame(runtime, sampleRate, frame, frames);
    const left = Math.max(
      -0.95,
      Math.min(
        0.95,
        frameOutput.left,
      ),
    );
    const right = Math.max(
      -0.95,
      Math.min(
        0.95,
        frameOutput.right,
      ),
    );
    const value = Math.max(Math.abs(left), Math.abs(right));
    runtime.meterPeak = Math.max(runtime.meterPeak, Math.abs(value));
    runtime.meterSquareSum += (left * left + right * right) * 0.5;
    runtime.meterSamples += 1;
    for (let channel = 0; channel < output.numberOfChannels; channel += 1) {
      output.getChannelData(channel)[frame] = channel === 0 ? left : right;
    }
  }
  finishNodeGraphParameterSmoothing(runtime.smoothers);
  runtime.meterCounter += frames;
  if (runtime.meterCounter >= sampleRate / 10) {
    setNodeGraphLiveMeter(
      runtime.meterPeak,
      Math.sqrt(runtime.meterSquareSum / Math.max(1, runtime.meterSamples)),
    );
    runtime.meterCounter = 0;
    runtime.meterPeak = 0;
    runtime.meterSamples = 0;
    runtime.meterSquareSum = 0;
  }
}

function sendNodeGraphLivePlan() {
  if (!nodeGraphMvp.live.node && !nodeGraphMvp.live.context) {
    return;
  }

  try {
    const plan = nodeGraphBuildLivePlan();
    if (nodeGraphMvp.live.runtime) {
      updateNodeGraphLiveRuntimePlan(nodeGraphMvp.live.runtime, plan);
    } else {
      nodeGraphMvp.live.runtime = createNodeGraphLiveRuntime(plan);
    }
    nodeGraphMvp.live.node?.port?.postMessage({
      plan,
      type: "setPlan",
    });
    setNodeGraphLiveStatus("running", "good");
    setNodeGraphLiveRouteStatus(nodeGraphScheduleText(plan.order), "good");
  } catch (error) {
    nodeGraphMvp.live.runtime = null;
    nodeGraphMvp.live.node?.port?.postMessage({ type: "stop" });
    setNodeGraphLiveMeter();
    setNodeGraphLiveRouteStatus(`schedule blocked: ${error.message}`, "warn");
    setNodeGraphLiveStatus("error", "warn");
    document.getElementById("nodeLiveStatus").title = error.message;
  }
}

function scheduleNodeGraphLivePlanSync() {
  if (!nodeGraphMvp.live.node || nodeGraphMvp.live.syncFrame || nodeGraphMvp.live.syncTimer) {
    return;
  }
  const flush = () => flushNodeGraphLivePlanSync();
  nodeGraphMvp.live.syncFrame = window.requestAnimationFrame(flush);
  nodeGraphMvp.live.syncTimer = window.setTimeout(flush, 50);
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
  clearNodeGraphLivePlanSync();
  sendNodeGraphLivePlan();
}

async function stopNodeGraphLiveAudio() {
  clearNodeGraphLivePlanSync();
  const liveNode = nodeGraphMvp.live.node;
  const liveContext = nodeGraphMvp.live.context;
  const scriptNode = nodeGraphMvp.live.scriptNode;
  nodeGraphMvp.live.node = null;
  nodeGraphMvp.live.context = null;
  nodeGraphMvp.live.meterGain = null;
  nodeGraphMvp.live.outputGain = null;
  nodeGraphMvp.live.runtime = null;
  nodeGraphMvp.live.scriptNode = null;

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
  setNodeGraphLiveMeter();
  setNodeGraphLiveRouteStatus("route stopped");
  document.getElementById("nodeLiveStatus").removeAttribute("title");
  renderNodeGraphLiveControls(false);
}

async function startNodeGraphLiveAudio() {
  try {
    setNodeGraphLiveStatus("starting", "warn");
    renderNodeGraphLiveControls(false);
    if (nodeGraphMvp.live.node || nodeGraphMvp.live.context) {
      await stopNodeGraphLiveAudio();
      setNodeGraphLiveStatus("starting", "warn");
      renderNodeGraphLiveControls(false);
    }

    const plan = nodeGraphBuildLivePlan();
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) {
      throw new Error("Web Audio API unavailable");
    }
    const context = new AudioContextConstructor();
    if (context.state === "suspended") {
      await context.resume();
    }
    const outputGain = context.createGain();
    outputGain.gain.value = 1;
    const scriptNode = context.createScriptProcessor(nodeGraphAudioBlockSize, 0, 2);
    scriptNode.onaudioprocess = renderNodeGraphLiveScriptBlock;
    nodeGraphMvp.live.context = context;
    nodeGraphMvp.live.meterGain = null;
    nodeGraphMvp.live.node = scriptNode;
    nodeGraphMvp.live.outputGain = outputGain;
    nodeGraphMvp.live.runtime = createNodeGraphLiveRuntime(plan);
    nodeGraphMvp.live.scriptNode = scriptNode;
    scriptNode.connect(outputGain);
    outputGain.connect(context.destination);
    setNodeGraphLiveRouteStatus(nodeGraphScheduleText(plan.order), "good");
    await context.resume();
    setNodeGraphLiveStatus("running", "good");
    document.getElementById("nodeLiveStatus").removeAttribute("title");
    renderNodeGraphLiveControls(true);
  } catch (error) {
    await stopNodeGraphLiveAudio();
    setNodeGraphLiveStatus("error", "warn");
    document.getElementById("nodeLiveStatus").title = error.message;
    renderNodeGraphLiveControls(false);
  }
}

function renderNodeGraphAudio() {
  const validation = nodeGraphValidate();
  const renderStatus = document.getElementById("nodeGraphRenderStatus");
  const playButton = document.getElementById("nodePlayButton");
  if (!validation.valid) {
    nodeGraphMvp.rendered = null;
    playButton.disabled = true;
    renderStatus.textContent = "render blocked";
    renderStatus.className = "pill warn";
    document.getElementById("nodeAudioStats").textContent = "peak 0 / rms 0";
    document.getElementById("nodeOutputSummary").textContent = validation.issues.join(", ");
    drawNodeRenderedAudio();
    return;
  }

  const frames = Math.floor(nodeGraphMvp.sampleRate * nodeGraphMvp.seconds);
  const samples = new Float32Array(frames);
  const leftSamples = new Float32Array(frames);
  const rightSamples = new Float32Array(frames);
  const plan = nodeGraphBuildLivePlan();
  const runtime = createNodeGraphLiveRuntime(plan);
  let peak = 0;
  let squareSum = 0;

  for (let blockStart = 0; blockStart < frames; blockStart += nodeGraphAudioBlockSize) {
    const blockFrames = Math.min(nodeGraphAudioBlockSize, frames - blockStart);
    for (let blockFrame = 0; blockFrame < blockFrames; blockFrame += 1) {
      const frame = blockStart + blockFrame;
      const frameOutput = evaluateNodeGraphPlanFrame(
        runtime,
        nodeGraphMvp.sampleRate,
        blockFrame,
        blockFrames,
      );
      const left = Math.max(
        -0.95,
        Math.min(
          0.95,
          frameOutput.left,
        ),
      );
      const right = Math.max(
        -0.95,
        Math.min(
          0.95,
          frameOutput.right,
        ),
      );
      const output = (left + right) * 0.5;
      leftSamples[frame] = left;
      rightSamples[frame] = right;
      samples[frame] = output;
      peak = Math.max(peak, Math.abs(left), Math.abs(right));
      squareSum += (left * left + right * right) * 0.5;
    }
    finishNodeGraphParameterSmoothing(runtime.smoothers);
  }

  const rms = Math.sqrt(squareSum / frames);
  nodeGraphMvp.rendered = {
    peak,
    leftSamples,
    rightSamples,
    rms,
    samples,
    sourceNodes: validation.sourceNodes,
  };
  playButton.disabled = false;
  renderStatus.textContent = "render ready";
  renderStatus.className = "pill good";
  document.getElementById("nodeAudioStats").textContent = `peak ${peak.toFixed(3)} / rms ${rms.toFixed(3)}`;
  document.getElementById("nodeOutputSummary").textContent = validation.scheduleText;
  drawNodeRenderedAudio();
}

function drawNodeRenderedAudio() {
  drawNodeRenderedWaveform();
  drawNodeRenderedSignalPlot();
}

function drawNodeRenderedWaveform() {
  const canvas = document.getElementById("nodeWaveformCanvas");
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#101214";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "rgba(243, 241, 236, 0.18)";
  context.beginPath();
  context.moveTo(0, height / 2);
  context.lineTo(width, height / 2);
  context.stroke();

  const samples = nodeGraphMvp.rendered?.samples;
  if (!samples?.length) {
    return;
  }

  context.strokeStyle = "#71d49b";
  context.beginPath();
  for (let x = 0; x < width; x += 1) {
    const start = Math.floor((x / width) * samples.length);
    const end = Math.max(start + 1, Math.floor(((x + 1) / width) * samples.length));
    let min = 1;
    let max = -1;
    for (let frame = start; frame < end; frame += 1) {
      const sample = samples[frame] || 0;
      min = Math.min(min, sample);
      max = Math.max(max, sample);
    }
    const yMin = height / 2 - min * (height * 0.42);
    const yMax = height / 2 - max * (height * 0.42);
    context.moveTo(x, yMin);
    context.lineTo(x, yMax);
  }
  context.stroke();
}

function drawNodeRenderedSignalPlot() {
  const canvas = document.getElementById("nodeSignalPlotCanvas");
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#101214";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "rgba(243, 241, 236, 0.16)";
  context.beginPath();
  context.moveTo(width / 2, 0);
  context.lineTo(width / 2, height);
  context.moveTo(0, height / 2);
  context.lineTo(width, height / 2);
  context.stroke();

  const samples = nodeGraphMvp.rendered?.samples;
  if (!samples?.length) {
    return;
  }

  const lag = Math.max(1, Math.floor(nodeGraphMvp.sampleRate * 0.001));
  context.strokeStyle = "#7fc7d9";
  context.beginPath();
  for (let frame = lag; frame < samples.length; frame += 8) {
    const x = width / 2 + samples[frame - lag] * (width * 0.42);
    const y = height / 2 - samples[frame] * (height * 0.42);
    if (frame === lag) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();
}

async function playNodeGraphAudio() {
  if (!nodeGraphMvp.rendered?.samples?.length) {
    return;
  }

  nodeGraphMvp.audioContext ||= new AudioContext({ sampleRate: nodeGraphMvp.sampleRate });
  if (nodeGraphMvp.audioContext.state === "suspended") {
    await nodeGraphMvp.audioContext.resume();
  }
  if (nodeGraphMvp.bufferSource) {
    nodeGraphMvp.bufferSource.stop();
    nodeGraphMvp.bufferSource.disconnect();
  }

  const channelCount = nodeGraphMvp.rendered.leftSamples?.length ? 2 : 1;
  const buffer = nodeGraphMvp.audioContext.createBuffer(
    channelCount,
    nodeGraphMvp.rendered.samples.length,
    nodeGraphMvp.sampleRate,
  );
  buffer.copyToChannel(nodeGraphMvp.rendered.leftSamples || nodeGraphMvp.rendered.samples, 0);
  if (channelCount > 1) {
    buffer.copyToChannel(nodeGraphMvp.rendered.rightSamples || nodeGraphMvp.rendered.samples, 1);
  }
  const source = nodeGraphMvp.audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(nodeGraphMvp.audioContext.destination);
  source.onended = () => {
    if (nodeGraphMvp.bufferSource === source) {
      nodeGraphMvp.bufferSource = null;
    }
  };
  nodeGraphMvp.bufferSource = source;
  source.start();
}

function initNodeGraphMvp() {
  const nodePanel = document.querySelector(".node-wiring-panel");
  nodePanel?.addEventListener("pointerover", handleNodeInteractionHelp);
  nodePanel?.addEventListener("mouseover", handleNodeInteractionHelp);
  nodePanel?.addEventListener("pointerdown", handleNodeInteractionHelp);
  nodePanel?.addEventListener("click", handleNodeInteractionHelp);
  nodePanel?.addEventListener("focusin", handleNodeInteractionHelp);
  document.getElementById("nodeInteractionHelp")?.setAttribute("data-ready", "true");
  for (const element of document.querySelectorAll(
    ".node-view-toolbar button, .node-graph-controls button, .node-slider-readout",
  )) {
    attachNodeInteractionHelpTarget(element);
  }
  for (const button of document.querySelectorAll("[data-palette-node]")) {
    button.addEventListener("click", () => showPaletteNode(button.dataset.paletteNode));
  }
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("contextmenu", openNodeSceneContextMenu);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointerdown", beginNodeGraphMarqueeSelection);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointermove", dragNodeGraphMarqueeSelection);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointerup", endNodeGraphMarqueeSelection);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointercancel", endNodeGraphMarqueeSelection);

  document.addEventListener("pointermove", dragNodeGraphWire);
  document.addEventListener("pointerup", endNodeGraphWireDrag);
  document.addEventListener("pointercancel", endNodeGraphWireDrag);
  document.addEventListener("pointermove", dragNodeMetadataPopover);
  document.addEventListener("pointerup", endNodeMetadataPopoverDrag);
  document.addEventListener("pointercancel", endNodeMetadataPopoverDrag);
  document.addEventListener("keydown", handleNodeGraphKeydown);
  document.addEventListener("pointerdown", (event) => {
    const menu = document.getElementById("nodeSceneContextMenu");
    if (!menu.hidden && !menu.contains(event.target)) {
      closeNodeSceneContextMenu();
    }
  });
  document.getElementById("nodeRenderButton").addEventListener("click", renderNodeGraphAudio);
  document.getElementById("nodePlayButton").addEventListener("click", playNodeGraphAudio);
  document.getElementById("nodeLiveInputButton").addEventListener("click", toggleNodeGraphLiveInput);
  document.getElementById("nodeLiveOutputButton").addEventListener("click", toggleNodeGraphLiveOutput);
  document.getElementById("nodeDefaultButton").addEventListener("click", restoreDefaultNodeGraph);
  document.getElementById("nodeDeleteButton").addEventListener("click", deleteSelectedNodeGraphItem);
  document.getElementById("nodeUndoButton").addEventListener("click", undoNodeGraphPatch);
  document.getElementById("nodeRedoButton").addEventListener("click", redoNodeGraphPatch);
  document
    .getElementById("nodeZoomOutButton")
    .addEventListener("click", () => zoomNodeGraphBy(-nodeGraphZoomLimits.step));
  document
    .getElementById("nodeZoomInButton")
    .addEventListener("click", () => zoomNodeGraphBy(nodeGraphZoomLimits.step));
  document
    .getElementById("nodeSettingsViewButton")
    .addEventListener("click", () => setNodeGraphViewMode("settings"));
  document
    .getElementById("nodeModularViewButton")
    .addEventListener("click", () => setNodeGraphViewMode("modular"));
  document
    .getElementById("nodeScriptViewButton")
    .addEventListener("click", () => setNodeGraphViewMode("script"));
  document.getElementById("nodePatchScript").addEventListener("input", handleNodePatchScriptInput);
  document.getElementById("loadNodeGraphScriptButton").addEventListener("click", loadNodeGraphScript);
  document.getElementById("saveNodeGraphScriptButton").addEventListener("click", saveNodeGraphScript);
  document
    .getElementById("nodePatchScriptFileInput")
    .addEventListener("change", handleNodeGraphScriptFileLoad);
  for (const field of document.querySelectorAll("[data-patch-info-field]")) {
    field.addEventListener("input", handleNodeGraphSettingsInput);
  }
  document.getElementById("toggleDebugButton").addEventListener("click", toggleDebugSections);
  document
    .getElementById("nodeParameterMetadataPopover")
    .addEventListener("input", handleNodeMetadataEditorInput);
  document
    .getElementById("metadataKindValue")
    .addEventListener("change", handleNodeMetadataKindChange);
  document
    .getElementById("metadataPopoverClose")
    .addEventListener("click", closeNodeMetadataPopover);
  document
    .getElementById("metadataPopoverDragHandle")
    .addEventListener("pointerdown", beginNodeMetadataPopoverDrag);
  document
    .getElementById("metadataSetDefaultButton")
    .addEventListener("click", setNodeMetadataDefaultsFromKind);
  for (const button of document.querySelectorAll("[data-context-module]")) {
    button.addEventListener("click", addNodeGraphModuleFromContext);
  }
  document
    .getElementById("nodeSceneDeleteModule")
    .addEventListener("click", deleteNodeGraphModuleFromContext);

  document.addEventListener("pointermove", dragNodeSlider);
  document.addEventListener("pointerup", endNodeSliderDrag);
  document.addEventListener("pointercancel", endNodeSliderDrag);
  document.addEventListener("mousemove", dragNodeSlider);
  document.addEventListener("mouseup", endNodeSliderDrag);

  commitNodeGraphPatch(cloneNodeGraphPatch(nodeGraphDefaultPatch), {
    markPending: false,
    record: false,
  });
  recordNodeGraphHistory();
  markNodeGraphRenderPending();
  applyNodeGraphZoom();
  loadNodeMetadataKindTemplates();
}

loadSignalPlotSettings();
loadManifest();
initNodeGraphMvp();
