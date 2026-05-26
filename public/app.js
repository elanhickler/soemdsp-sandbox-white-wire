const state = {
  response: null,
  waveform: null,
  playheadFrame: 0,
  waveformProbeFrame: null,
  waveformProbeSource: null,
  waveformPointerActive: false,
  phaseJumpPreviewIndex: null,
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
};

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

function artifactUrl(path) {
  return `/artifact?path=${encodeURIComponent(path)}`;
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
  document.getElementById(id).textContent = value;
}

function clearElement(id) {
  document.getElementById(id).replaceChildren();
}

function setStatus(id, value, ok) {
  const element = document.getElementById(id);
  const isPill = element.classList.contains("pill");
  element.textContent = value;
  element.className = isPill ? `pill ${ok ? "good" : "warn"}` : ok ? "" : "warn";
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
    dt.textContent = key;
    dd.textContent = value;
    const expectedText =
      typeof expected === "boolean" ? boolText(expected) : String(expected);
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

function renderLevelEnvelopeProbe() {
  const probe = document.getElementById("levelEnvelopeProbe");
  const waveform = state.waveform;
  if (!waveform || state.waveformProbeFrame === null) {
    probe.textContent = "probe";
    return;
  }

  const frame = clampFrame(state.waveformProbeFrame, waveform);
  const entry = levelEnvelopeWindowAtFrame(frame);
  const region = waveformRegionAtFrame(frame);
  probe.textContent = entry
    ? `probe ${formatSeconds(frame / waveform.sampleRate)} / peak ${formatCompactNumber(
        entry.peak,
      )} / rms ${formatCompactNumber(entry.rms)} / ${region?.name || "phase"}`
    : "probe";
}

function renderLevelEnvelope() {
  const status = document.getElementById("levelEnvelopeStatus");
  const meta = document.getElementById("levelEnvelopeMeta");
  const peak = document.getElementById("levelEnvelopePeak");
  const rms = document.getElementById("levelEnvelopeRms");
  const waveform = state.waveform;
  const envelope = waveform?.envelope;

  if (!waveform || !envelope) {
    peak.textContent = "peak 0";
    rms.textContent = "rms 0";
    renderLevelEnvelopeProbe();
    status.textContent = "Check";
    status.className = "pill warn";
    meta.replaceChildren();
    return;
  }

  peak.textContent = `peak ${formatCompactNumber(envelope.peak)}`;
  rms.textContent = `rms ${formatCompactNumber(envelope.rms)}`;
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

function updatePhaseAudioStatsActive(region) {
  for (const item of document.querySelectorAll(".phase-stat")) {
    item.classList.toggle("active", item.dataset.phaseName === region?.name);
  }
}

function renderPhaseAudioStatsProbe() {
  const probe = document.getElementById("phaseAudioStatsProbe");
  const waveform = state.waveform;
  if (!waveform || state.waveformProbeFrame === null) {
    probe.textContent = "probe";
    return;
  }

  const frame = clampFrame(state.waveformProbeFrame, waveform);
  const region = waveformRegionAtFrame(frame);
  probe.textContent = region
    ? `probe ${region.name} / ${formatSeconds(frame / waveform.sampleRate)}`
    : "probe";
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
  state.waveformProbeSource = "phase audio stats";
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

  state.waveformProbeFrame = null;
  state.waveformProbeSource = null;
  state.signalPlotProbe = null;
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

    const item = document.createElement("div");
    item.className = producerOk ? "phase-stat" : "phase-stat warn-row";
    item.dataset.phaseName = region.name;
    item.dataset.startFrame = String(region.startFrame);
    item.dataset.endFrame = String(region.endFrame);
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
      amplitudeValue === null ? "missing" : formatSignedNumber(stats.peak - amplitudeValue);
    const producerPeakDeltaText =
      producerPeakDelta === null
        ? "missing"
        : formatSignedNumber(producerPeakDelta);
    const producerRmsDeltaText =
      producerRmsDelta === null ? "missing" : formatSignedNumber(producerRmsDelta);
    renderKeyValue(body, [
      ["target freq", frequencyValue === null ? "missing" : `${formatCompactNumber(frequencyValue)} Hz`],
      ["measured freq", measuredFrequency === null ? "missing" : `${formatCompactNumber(measuredFrequency)} Hz`],
      ["freq delta", frequencyDelta],
      ["producer freq", Number.isFinite(producerFrequency) ? `${formatCompactNumber(producerFrequency)} Hz` : "missing"],
      ["producer freq delta", producerFrequencyDeltaText],
      ["target amp", amplitudeValue === null ? "missing" : formatCompactNumber(amplitudeValue)],
      ["peak", formatCompactNumber(stats.peak)],
      ["peak delta", peakDelta],
      ["producer peak", Number.isFinite(producerPeak) ? formatCompactNumber(producerPeak) : "missing"],
      ["producer peak delta", producerPeakDeltaText],
      ["rms", formatCompactNumber(stats.rms)],
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
    probe.textContent = "probe";
    source.textContent = "near frame";
    return;
  }

  probe.textContent = `probe x ${formatCompactNumber(
    state.signalPlotProbe.x,
  )} / y ${formatCompactNumber(state.signalPlotProbe.y)}`;
  const nearest = state.signalPlotProbe.nearest;
  source.textContent = nearest
    ? `near frame ${nearest.frame} / ${formatSeconds(nearest.seconds)} / ${nearest.phase}`
    : "near frame";
}

function probeSignalPlot(event) {
  if (!state.waveform) {
    return;
  }

  state.signalPlotProbe = signalPlotProbeAtClientPoint(event.clientX, event.clientY);
  state.waveformProbeFrame = state.signalPlotProbe.nearest?.frame ?? null;
  state.waveformProbeSource = state.waveformProbeFrame === null ? null : "signal plot";
  drawSignalPlot();
  renderSignalPlotProbe();
  drawWaveform();
  renderWaveformProbe();
  drawLevelEnvelope();
  renderLevelEnvelopeProbe();
}

function clearSignalPlotProbe() {
  state.signalPlotProbe = null;
  state.waveformProbeFrame = null;
  state.waveformProbeSource = null;
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
  const waveform = state.waveform;
  renderSignalPlotControls();
  renderSignalPlotSummary();
  renderSignalPlotPoint();
  renderSignalPlotProbe();
  if (!waveform) {
    status.textContent = "Check";
    status.className = "pill warn";
    meta.replaceChildren();
    return;
  }

  const lagFrames = signalPlotLagFrames(waveform);
  const drawableFrames = Math.max(0, waveform.samples.length - lagFrames);
  const focusStats = signalPlotFocusStats(waveform, drawableFrames);
  drawSignalPlot();
  renderKeyValue(meta, [
    ["focus", signalPlotFocusName(waveform)],
    ["mode", state.signalPlotMode],
    ["scale", `x${state.signalPlotScale}`],
    ["window", signalPlotWindowName(waveform, drawableFrames)],
    ["window size", `${state.signalPlotWindowMs} ms`],
    ["x", "sample[n]"],
    ["y", "sample[n + lag]"],
    ["lag", `${state.signalLagMs} ms`],
    ["lag frames", String(lagFrames)],
    ["lag time", formatSeconds(lagFrames / waveform.sampleRate)],
    ["points", String(signalPlotPointCount(waveform, drawableFrames))],
    ["focus peak", formatCompactNumber(focusStats.peak)],
    ["focus rms", formatCompactNumber(focusStats.rms)],
    ["focus min", formatCompactNumber(focusStats.min)],
    ["focus max", formatCompactNumber(focusStats.max)],
  ]);
  status.textContent = "Drawn";
  status.className = "pill good";
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
    point.textContent = "x 0 / y 0";
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
  point.textContent = `x ${formatCompactNumber(x)} / y ${formatCompactNumber(y)}`;
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
  allButton.setAttribute("aria-label", "Signal plot focus all");
  allButton.textContent = "all";
  allButton.classList.toggle("active", state.signalPhaseFocusIndex === null);
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
    button.setAttribute("aria-label", `Signal plot focus ${region.name}`);
    button.textContent = region.name;
    button.classList.toggle("active", index === state.signalPhaseFocusIndex);
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
    button.setAttribute("aria-label", `Signal plot mode ${mode}`);
    button.textContent = mode;
    button.classList.toggle("active", mode === state.signalPlotMode);
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
    button.setAttribute("aria-label", `Signal plot scale x${scale}`);
    button.textContent = `x${scale}`;
    button.classList.toggle("active", scale === state.signalPlotScale);
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
    button.setAttribute("aria-label", `Signal plot window ${windowMode}`);
    button.textContent = windowMode;
    button.classList.toggle("active", windowMode === state.signalPlotWindow);
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
    button.setAttribute("aria-label", `Signal plot window size ${windowMs} ms`);
    button.textContent = `${windowMs} ms`;
    button.classList.toggle("active", windowMs === state.signalPlotWindowMs);
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
    button.setAttribute("aria-label", `Signal plot lag ${lagMs} ms`);
    button.textContent = `${lagMs} ms`;
    button.classList.toggle("active", lagMs === state.signalLagMs);
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
  resetButton.setAttribute("aria-label", "Signal plot reset settings");
  resetButton.textContent = "reset";
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
    button.textContent = region.name;
    button.classList.toggle("preview", index === state.phaseJumpPreviewIndex);
    button.addEventListener("pointermove", () => probePhaseButton(index));
    button.addEventListener("pointerleave", clearPhaseButtonProbe);
    button.addEventListener("focus", () => probePhaseButton(index));
    button.addEventListener("blur", clearPhaseButtonProbe);
    button.addEventListener("click", () => {
      seekPrimaryAudioToFrame(region.startFrame);
    });
    container.append(button);
  }
}

function setSharedProbeFrame(frame, source = "probe") {
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
  state.waveformProbeFrame = null;
  state.waveformProbeSource = null;
  state.signalPlotProbe = null;
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
  setSharedProbeFrame(region.startFrame, "phase jump");
}

function clearPhaseButtonProbe() {
  if (state.waveformPointerActive) {
    return;
  }

  state.phaseJumpPreviewIndex = null;
  updateActivePhaseButtons(activeWaveformRegion());
  clearSharedProbeFrame();
}

function activeWaveformRegion() {
  const waveform = state.waveform;
  if (!waveform) {
    return null;
  }

  return waveformRegionAtFrame(state.playheadFrame);
}

function waveformRegionAtFrame(frame) {
  const waveform = state.waveform;
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

function renderCurrentParameters(region) {
  const frequency = document.getElementById("currentFrequency");
  const amplitude = document.getElementById("currentAmplitude");
  const status = document.getElementById("currentParameterStatus");
  const frequencyValue = activeParameterValue("frequency", region);
  const amplitudeValue = activeParameterValue("amplitude", region);
  const ok = frequencyValue !== null && amplitudeValue !== null;

  frequency.textContent =
    frequencyValue === null ? "freq" : `freq ${formatCompactNumber(frequencyValue)} Hz`;
  amplitude.textContent =
    amplitudeValue === null ? "amp" : `amp ${formatCompactNumber(amplitudeValue)}`;
  status.textContent = ok ? "params synced" : "params missing";
  status.className = `pill ${ok ? "good" : "warn"}`;
}

function formatRegionRange(region, sampleRate) {
  if (!region || !sampleRate) {
    return "range";
  }

  return `${formatSeconds(region.startFrame / sampleRate)}-${formatSeconds(
    region.endFrame / sampleRate,
  )}`;
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
  status.textContent = "Loading";
  status.className = "pill";

  try {
    const response = await fetch(artifactUrl(path), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`WAV fetch failed: ${response.status}`);
    }

    state.waveform = parsePcm16Wav(await response.arrayBuffer());
    state.waveformProbeFrame = null;
    state.waveformProbeSource = null;
    state.signalPlotProbe = null;
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
    state.waveformProbeFrame = null;
    state.waveformProbeSource = null;
    state.signalPlotProbe = null;
    state.playheadFrame = 0;
    meta.replaceChildren();
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

function renderWaveformPosition() {
  const position = document.getElementById("waveformPosition");
  const sample = document.getElementById("waveformSample");
  const probe = document.getElementById("waveformProbe");
  const phase = document.getElementById("waveformPhase");
  const phaseRange = document.getElementById("waveformPhaseRange");
  const scrubber = document.getElementById("waveformScrubber");
  const waveform = state.waveform;
  if (!waveform) {
    position.textContent = "0.000s";
    sample.textContent = "frame 0 / sample 0";
    probe.textContent = "probe";
    phase.textContent = "phase";
    phaseRange.textContent = "range";
    scrubber.value = "0";
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
  position.textContent = formatSeconds(state.playheadFrame / waveform.sampleRate);
  sample.textContent = `frame ${state.playheadFrame} / sample ${formatCompactNumber(
    sampleValue,
  )}`;
  phase.textContent = activeRegion ? activeRegion.name : "phase";
  phaseRange.textContent = formatRegionRange(activeRegion, waveform.sampleRate);
  renderCurrentParameters(activeRegion);
  updateParameterTimelinePlayhead(activeRegion);
  updatePhaseAudioStatsActive(activeRegion);
  scrubber.value = String(
    waveform.frames > 0 ? state.playheadFrame / waveform.frames : 0,
  );
  updateActivePhaseButtons(activeRegion);
  renderWaveformProbe();
}

function renderWaveformProbe() {
  const probe = document.getElementById("waveformProbe");
  const waveform = state.waveform;
  if (!waveform || state.waveformProbeFrame === null) {
    probe.textContent = "probe";
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
  probe.textContent = `probe ${formatSeconds(
    frame / waveform.sampleRate,
  )} / frame ${frame} / ${formatCompactNumber(sampleValue)} / ${
    region?.name || "phase"
  }`;
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
    renderKeyValue(cursor, [
      ["transport frame", "0"],
      ["transport time", "0.000s"],
      ["transport phase", "phase"],
      ["hover source", "none"],
      ["hover frame", "none"],
      ["hover signal", "none"],
    ]);
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

  setStatus("inspectionCursorStatus", hoverFrame === null ? "Transport" : "Hover", true);
  renderKeyValue(cursor, [
    ["transport frame", String(transportFrame)],
    ["transport time", formatSeconds(transportFrame / waveform.sampleRate)],
    ["transport phase", transportRegion?.name || "phase"],
    ["transport sample", formatCompactNumber(transportSample)],
    ["hover source", hoverFrame === null ? "none" : state.waveformProbeSource || "probe"],
    ["hover frame", hoverFrame === null ? "none" : String(hoverFrame)],
    [
      "hover time",
      hoverFrame === null ? "none" : formatSeconds(hoverFrame / waveform.sampleRate),
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
}

function renderAudioPosition() {
  const audio = document.getElementById("audioPlayer");
  const position = document.getElementById("audioPosition");
  const time = Number(audio.currentTime);
  position.textContent = `audio ${formatSeconds(Number.isFinite(time) ? time : 0)}`;
}

function setFollowAudio(enabled, syncNow) {
  state.followAudio = enabled;
  renderFollowAudioControl();
  if (enabled && syncNow) {
    syncWaveformToAudio();
  }
}

function renderFollowAudioControl() {
  const button = document.getElementById("followAudioButton");
  button.textContent = state.followAudio ? "Follow Audio" : "Free View";
  button.setAttribute("aria-pressed", String(state.followAudio));
  button.classList.toggle("active", state.followAudio);
}

function updateActivePhaseButtons(activeRegion) {
  for (const button of document.querySelectorAll("#waveformPhaseControls button")) {
    button.classList.toggle("active", button.textContent === activeRegion?.name);
    button.classList.toggle(
      "preview",
      button.dataset.phaseIndex === String(state.phaseJumpPreviewIndex),
    );
  }
}

function syncWaveformToAudio() {
  const audio = document.getElementById("audioPlayer");
  renderAudioPosition();
  if (!state.followAudio || !state.waveform || Number.isNaN(audio.currentTime)) {
    return;
  }

  setPlayheadFrame(Math.round(audio.currentTime * state.waveform.sampleRate));
}

function seekPrimaryAudioToFrame(frame) {
  const waveform = state.waveform;
  if (!waveform) {
    return;
  }

  const targetFrame = clampFrame(frame, waveform);
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

  seekPrimaryAudioToFrame(waveformFrameAtClientX(clientX));
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
  state.waveformProbeSource = "waveform";
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
  state.waveformProbeSource = "level envelope";
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

  state.waveformProbeFrame = null;
  state.waveformProbeSource = null;
  state.signalPlotProbe = null;
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

  state.waveformProbeFrame = null;
  state.waveformProbeSource = null;
  state.signalPlotProbe = null;
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
  seekPrimaryAudioToFrame(Math.round(ratio * waveform.frames));
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
    button.type = "button";
    button.className = "report-button";
    button.classList.toggle("active", index === state.activeReportIndex);
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
    return;
  }

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
  const secondFrequency = parseSummaryNumber(pairs.get("second half frequency"));
  const secondAmplitude = parseSummaryNumber(pairs.get("second half amplitude"));
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
  ];

  for (const [label, value, kind, ok] of values) {
    const item = document.createElement("div");
    item.className = "summary-card";
    if (kind === "comparison") {
      item.classList.add("comparison");
    }

    const title = document.createElement("span");
    title.className = "label";
    title.textContent = label;

    const body = document.createElement("strong");
    body.textContent = value || "missing";
    if (!value || ok !== true) {
      body.className = "warn";
    }

    item.append(title, body);
    container.append(item);
  }
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

  phase.textContent = region ? region.name : "phase";
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
    probe.textContent = "probe";
    updateParameterTimelineProbeMarker();
    return;
  }

  const frame = clampFrame(state.waveformProbeFrame, waveform);
  const region = waveformRegionAtFrame(frame);
  const frequency = activeParameterValue("frequency", region);
  const amplitude = activeParameterValue("amplitude", region);
  probe.textContent = `probe ${formatSeconds(frame / waveform.sampleRate)} / ${
    region?.name || "phase"
  } / freq ${frequency === null ? "missing" : `${formatCompactNumber(frequency)} Hz`} / amp ${
    amplitude === null ? "missing" : formatCompactNumber(amplitude)
  }`;
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
  state.waveformProbeSource = "parameter timeline";
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

  state.waveformProbeFrame = null;
  state.waveformProbeSource = null;
  state.signalPlotProbe = null;
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
      const segment = document.createElement("div");
      segment.className = "parameter-segment";
      segment.dataset.phaseName = phase.name || "";
      segment.dataset.startFrame = String(span.startFrame);
      segment.dataset.endFrame = String(span.endFrame);
      segment.style.flexBasis = `${Math.max(1, (frames / totalFrames) * 100)}%`;
      segment.addEventListener("pointermove", probeParameterTimelineSegment);
      segment.addEventListener("pointerleave", clearParameterTimelineProbe);

      const phaseLabel = document.createElement("span");
      phaseLabel.textContent = phase.name || "phase";

      const value = document.createElement("strong");
      value.textContent = manifestValueText(values[phase.name]) || "missing";

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

function parameterResyncPairs(manifest) {
  const resync = manifest?.parameterResync || {};
  const frequency = resync.frequency || {};
  const amplitude = resync.amplitude || {};
  const pairs = new Map([
    ["first half frequency", manifestValueText(frequency.first)],
    ["first half amplitude", manifestValueText(amplitude.first)],
    ["second half frequency", manifestValueText(frequency.second)],
    ["second half amplitude", manifestValueText(amplitude.second)],
  ]);

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

function renderCheckRows(container, rows) {
  container.replaceChildren();
  for (const [label, ok] of rows) {
    const item = document.createElement("div");
    item.className = ok ? "check-row" : "check-row warn-row";

    const marker = document.createElement("strong");
    marker.textContent = ok ? "OK" : "Check";

    const text = document.createElement("span");
    text.textContent = label;

    item.append(marker, text);
    container.append(item);
  }
}

function renderHandsOnReadiness(manifest, waveformReady = Boolean(state.waveform)) {
  const rows = [
    [
      "native audio",
      hasArtifactKind(manifest?.artifactLinks || [], "audio") &&
        Boolean(manifest?.sandboxHandoff?.primaryAudioArtifact),
    ],
    ["decoded waveform", waveformReady],
    ["waveform seek", waveformReady && Number(manifest?.wav?.frames) > 0],
    ["waveform hover probe", waveformReady && Boolean(document.getElementById("waveformProbe"))],
    ["level envelope probe", waveformReady && Boolean(document.getElementById("levelEnvelopeProbe"))],
    ["parameter timeline probe", waveformReady && Boolean(document.getElementById("parameterTimelineProbe"))],
    ["follow/free view", Boolean(document.getElementById("followAudioButton"))],
    [
      "phase jump controls",
      Array.isArray(manifest?.phases) &&
        manifest.phases.length > 0 &&
        phaseReportCoverageIssue(manifest) === "",
    ],
    ["phase jump preview", waveformReady && Boolean(document.querySelector("#waveformPhaseControls button"))],
    ["phase list probe", waveformReady && Boolean(document.getElementById("phaseProbe"))],
    ["phase parameter readout", parameterResyncContractIssue(manifest) === ""],
    ["producer measurement compare", phaseAudioMeasurementIssues(manifest).length === 0],
    ["phase audio stats probe", waveformReady && Boolean(document.getElementById("phaseAudioStatsProbe"))],
    ["signal inspection", waveformReady && Boolean(document.getElementById("signalPlotCanvas"))],
    ["signal plot probe", waveformReady && Boolean(document.getElementById("signalPlotProbe"))],
    ["signal plot source probe", waveformReady && Boolean(document.getElementById("signalPlotProbeSource"))],
    ["waveform-to-signal probe", waveformReady && Boolean(signalPlotProbeAtFrame(0))],
    ["signal-to-waveform probe", waveformReady && Boolean(document.getElementById("waveformProbe"))],
    ["inspection cursor", waveformReady && Boolean(document.getElementById("inspectionCursor"))],
    ["read-only boundary", validateConsumerChecklist(manifest).accepted],
  ];
  const ok = rows.every(([_label, rowOk]) => rowOk);

  setStatus("handsOnReadinessStatus", ok ? "Ready" : "Check", ok);
  renderCheckRows(document.getElementById("handsOnReadiness"), rows);
}

function renderProducerProof(manifest) {
  const status = document.getElementById("producerStatus");
  const setters = manifest.parameterSetters || {};
  const phaseAudioIssues = phaseAudioMeasurementIssues(manifest);
  const rows = [
    ["demo", manifest.demo || "missing"],
    ["kind", manifest.kind || "missing"],
    ["runtime API", boolText(Boolean(manifest.runtimeApi)), false],
    ["scheduler", boolText(Boolean(manifest.scheduler)), false],
    ["audio engine", boolText(Boolean(manifest.audioEngine)), false],
    ["frequency setter", boolText(Boolean(setters.frequency)), true],
    ["amplitude setter", boolText(Boolean(setters.amplitude)), true],
    ["phase measurements", boolText(phaseAudioIssues.length === 0), true],
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

    const marker = document.createElement("strong");
    marker.textContent = rowOk ? kind : "check";

    const text = document.createElement("span");
    text.textContent = label;

    item.append(marker, text);
    list.append(item);
  }

  setStatus("sandboxContractStatus", ok ? "Bounded" : "Check", ok);
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

  setStatus("sourceStatus", ok ? "Loaded" : "Check", ok);
  setText("manifestPath", response.manifestPath || "missing");
  setText("sourceError", "none");
  setText("sourceDetail", "none");
  setText(
    "manifestHttpStatus",
    formatHttpStatus(response.responseStatus, response.responseStatusText),
  );
  setText("artifactRoot", response.artifactRoot || "missing");
  setText("manifestBytes", hasBytes ? formatBytes(bytes) : "missing");
  setText("manifestModified", modified);
  setText("manifestLoadedAt", formatTimestamp(new Date().toISOString()));
  setText("manifestCacheControl", cacheControl);
  setText("manifestPragma", pragma);
  setText("manifestExpires", expires);
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
    row.className = "artifact-row";
    if (link.path) {
      row.href = artifactUrl(link.path);
      row.target = "_blank";
      row.rel = "noreferrer";
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

function renderPhaseProbe() {
  const probe = document.getElementById("phaseProbe");
  const waveform = state.waveform;
  if (!waveform || state.waveformProbeFrame === null) {
    probe.textContent = "probe";
    return;
  }

  const frame = clampFrame(state.waveformProbeFrame, waveform);
  const region = waveformRegionAtFrame(frame);
  probe.textContent = region
    ? `probe ${region.name} / ${formatSeconds(frame / waveform.sampleRate)}`
    : "probe";
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
  state.waveformProbeSource = "phase list";
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

  state.waveformProbeFrame = null;
  state.waveformProbeSource = null;
  state.signalPlotProbe = null;
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
    const share =
      totalFrames > 0
        ? formatPercent((span.frames / totalFrames) * 100)
        : "unavailable";
    const item = document.createElement("div");
    item.className = "phase";
    item.dataset.startFrame = String(span.startFrame);
    item.dataset.endFrame = String(span.endFrame);
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
  setText("audioTitle", handoff.primaryAudioArtifact);
  renderSource(response);
  renderHandsOnReadiness(manifest, false);

  const audio = document.getElementById("audioPlayer");
  audio.src = artifactUrl(handoff.primaryAudioArtifact);
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
    if (
      !Number.isFinite(targetFrequency) ||
      Math.abs(measuredFrequency - targetFrequency) > phaseAudioFrequencyToleranceHz
    ) {
      return [`${name} phase audio frequency mismatch`];
    }
    if (
      !Number.isFinite(targetAmplitude) ||
      Math.abs(peak - targetAmplitude) > phaseAudioAmplitudeTolerance
    ) {
      return [`${name} phase audio peak mismatch`];
    }
  }

  return [];
}

function renderError(message, details = {}) {
  state.response = null;
  state.waveform = null;
  state.playheadFrame = 0;
  state.waveformProbeFrame = null;
  state.waveformProbeSource = null;
  state.signalPlotProbe = null;
  state.reports = [];
  state.activeReportIndex = 0;

  setStatus("manifestStatus", "Check", false);
  setStatus("contractStatus", message, false);
  setStatus("inspectionMode", "Unavailable", false);
  setText("frameCount", "0");
  setStatus("checklistStatus", "Check", false);
  setStatus("producerStatus", "Check", false);
  setStatus("handsOnReadinessStatus", "Check", false);
  setStatus("sandboxContractStatus", "Check", false);
  setStatus("parameterSummaryStatus", "Check", false);
  setStatus("parameterTimelineStatus", "Check", false);
  setText("parameterTimelinePhase", "phase");
  setText("parameterTimelineProbe", "probe");
  setStatus("waveformStatus", "Check", false);
  setStatus("levelEnvelopeStatus", "Check", false);
  setText("levelEnvelopePeak", "peak 0");
  setText("levelEnvelopeRms", "rms 0");
  setText("levelEnvelopeProbe", "probe");
  setStatus("currentParameterStatus", "Check", false);
  setText("currentFrequency", "freq");
  setText("currentAmplitude", "amp");
  setStatus("signalPlotStatus", "Check", false);
  setText("signalPlotModeSummary", "all / trace / x1");
  setText("signalPlotWindowSummary", "window full");
  setText("signalPlotLagSummary", "lag 1 ms");
  setText("signalPlotPoint", "x 0 / y 0");
  setText("signalPlotProbe", "probe");
  setText("signalPlotProbeSource", "near frame");
  setStatus("phaseCoverageStatus", "Check", false);
  setStatus("phaseAudioStatsStatus", "Check", false);
  setText("phaseAudioStatsProbe", "probe");
  setText("phaseProbe", "probe");
  setStatus("phaseStatus", "Check", false);
  setStatus("artifactCoverageStatus", "Check", false);
  setStatus("reportStatus", "Check", false);
  setStatus("artifactStatus", "Check", false);
  setStatus("sourceStatus", "Check", false);
  setText("audioTitle", "Unavailable");
  setText("manifestPath", details.path || details.manifestPath || "Unavailable");
  setText("sourceError", message || details.message || "Unavailable");
  setText("sourceDetail", details.message || "none");
  setText(
    "manifestHttpStatus",
    formatHttpStatus(details.responseStatus, details.responseStatusText),
  );
  setText("manifestBytes", "Unavailable");
  setText("manifestModified", "Unavailable");
  setText("manifestLoadedAt", "Unavailable");
  setText("manifestCacheControl", "Unavailable");
  setText("manifestPragma", "Unavailable");
  setText("manifestExpires", "Unavailable");
  setText("artifactRoot", details.artifactRoot || "Unavailable");

  const audio = document.getElementById("audioPlayer");
  audio.removeAttribute("src");
  audio.load();
  renderAudioPosition();

  clearElement("producerProof");
  clearElement("handsOnReadiness");
  clearElement("sandboxContract");
  clearElement("parameterSummary");
  clearElement("parameterTimeline");
  renderReportControls();
  renderActiveReport();
  renderWaveformPhaseControls();
  renderWaveformPosition();
  clearElement("waveformMeta");
  clearElement("levelEnvelopeMeta");
  renderLevelEnvelopeProbe();
  clearElement("phaseAudioStats");
  renderSignalPlotControls();
  clearSignalPlotProbe();
  clearElement("signalPlotMeta");
  clearElement("boundaryFlags");
  clearElement("phaseCoverage");
  clearElement("phaseList");
  clearElement("checklist");
  clearElement("artifactCoverage");
  clearElement("artifactList");
}

async function loadManifest() {
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

document
  .getElementById("followAudioButton")
  .addEventListener("click", toggleFollowAudio);

document
  .getElementById("audioPlayer")
  .addEventListener("timeupdate", syncWaveformToAudio);

document
  .getElementById("audioPlayer")
  .addEventListener("seeked", syncWaveformToAudio);

document
  .getElementById("audioPlayer")
  .addEventListener("loadedmetadata", renderAudioPosition);

window.addEventListener("resize", () => {
  drawWaveform();
  drawLevelEnvelope();
  drawSignalPlot();
  updateParameterTimelinePlayhead(activeWaveformRegion());
});

loadSignalPlotSettings();
loadManifest();
