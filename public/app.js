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

const nodeSliderHandleHalfWidthPx = 8;
const nodeGraphDefaultPatchPointSizeRatio = 0.36;

function setInspectionCursorSource(sourceName, mode) {
  const source = document.getElementById("inspectionCursorSource");
  const value = `source ${sourceName}`;
  source.textContent = value;
  source.className = `pill inspection-source ${mode}`;
  labelInspectionCursorPill(source, "inspection source", value, mode);
}

function setInspectionCursorDelta(deltaFrame, sampleRate) {
  const delta = document.getElementById("inspectionCursorDelta");
  const stateName = deltaFrame === null ? inspectionModes.none : inspectionModes.hover;
  const value = `delta ${formatInspectionDelta(deltaFrame, sampleRate)}`;
  delta.textContent = value;
  delta.className = `pill inspection-delta ${stateName}`;
  labelInspectionCursorPill(delta, "inspection delta", value, stateName);
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

function renderedNodeGraphWavBlob(rendered) {
  return nodeGraphRenderedWavBlob(rendered, nodeGraphMvp.sampleRate);
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
    canvas.title = nodeGraphTooltipText("legacyEvidence.levelEnvelopeUnavailable");
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
  item.title = nodeGraphTooltipText("legacyEvidence.phaseAudioStatsUnavailable");

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
    canvas.title = nodeGraphTooltipText("legacyEvidence.signalPlotUnavailable");
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
    canvas.title = nodeGraphTooltipText("legacyEvidence.waveformUnavailable");
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
    scrubber.title = nodeGraphTooltipText("legacyEvidence.waveformPosition", {
      follow: followTitle,
      frame: "unknown",
      phase: "phase unknown",
      time: "0.000s",
    });
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
  scrubber.title = nodeGraphTooltipText("legacyEvidence.waveformPosition", {
    follow: followTitle,
    frame: state.playheadFrame,
    phase: phaseText,
    time: timeText,
  });
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
    viewer.title = nodeGraphTooltipText("legacyEvidence.reportViewerUnavailable");
    return;
  }

  const stateName = report.ok ? "ok" : "check";
  viewer.dataset.reportLabel = report.label || "";
  viewer.dataset.reportKind = report.kind || "";
  viewer.dataset.reportPath = report.path || "";
  viewer.dataset.reportState = stateName;
  viewer.setAttribute("role", "region");
  viewer.setAttribute("aria-label", `Report viewer ${report.label}: ${stateName}`);
  viewer.title = nodeGraphTooltipText("legacyEvidence.reportViewer", {
    kind: report.kind,
    label: report.label,
    path: report.path || "missing",
    state: stateName,
  });
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
    item.title = nodeGraphTooltipText("legacyEvidence.labeledState", {
      label,
      state: stateName,
      value: valueText,
    });

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
      segment.title = nodeGraphTooltipText("legacyEvidence.timelineSegment", {
        end: endTime,
        label: segmentLabel,
        start: startTime,
      });
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
  segment.title = nodeGraphTooltipText("legacyEvidence.parameterResyncUnavailable");

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
    item.title = nodeGraphTooltipText("legacyEvidence.sourceValue", { key: label, value: stateName });

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
  if (!button) {
    return true;
  }
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
    row.title = nodeGraphTooltipText("legacyEvidence.circuitChainUnavailable");
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
  row.title = nodeGraphTooltipText("legacyEvidence.circuitChainUnavailable");
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
    item.title = nodeGraphTooltipText("legacyEvidence.contractRow", {
      kind,
      label,
      state: item.dataset.contractState,
    });

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
    item.title = nodeGraphTooltipText("legacyEvidence.contractRow", {
      kind,
      label,
      state: "unavailable",
    });

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
  row.title = nodeGraphTooltipText("legacyEvidence.missingArtifactPacket");

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
    item.title = nodeGraphTooltipText("legacyEvidence.phaseListItem", {
      duration,
      end: endTime,
      label: itemLabel,
      start: startTime,
    });
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
  item.title = nodeGraphTooltipText("legacyEvidence.phaseListUnavailable");

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
  if (!button) {
    return;
  }
  const label = loading ? "Loading manifest" : "Reload manifest";
  button.disabled = loading;
  button.textContent = loading ? "Loading Manifest" : "Reload Manifest";
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-busy", String(loading));
  button.dataset.loading = String(loading);
  button.title = nodeGraphTooltipText(
    loading ? "legacyEvidence.manifestReloading" : "legacyEvidence.manifestReload",
  );
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
  ?.addEventListener("click", loadManifest);

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

function createNodeGraphPatchNode(type, options = {}) {
  const node = {
    gx: Number.isFinite(Number(options.gx)) ? Number(options.gx) : 0,
    gy: Number.isFinite(Number(options.gy)) ? Number(options.gy) : 0,
    id: String(options.id || type),
    paramMeta: nodeGraphDefaultParamMetaForType(type),
    params: nodeGraphDefaultParamsForType(type),
    type,
  };
  if (Object.hasOwn(options, "widthGu")) {
    node.widthGu = normalizeNodeGraphModuleWidthUnits(type, options.widthGu);
  }
  const alias = normalizeNodeGraphPatchNodeAlias(options.alias);
  if (alias) {
    node.alias = alias;
  }
  if (Object.hasOwn(options, "heightGu")) {
    node.heightGu = normalizeNodeGraphModuleHeightUnits(type, options.heightGu, options.ui);
  }
  const ui = nodeGraphModuleDefinitions[type]?.layout === "textBox" && !Object.hasOwn(options, "ui")
    ? { buttonsHidden: true }
    : normalizeNodeGraphPatchNodeUi(options.ui);
  if (ui.buttonsHidden || ui.titleHidden) {
    node.ui = ui;
  }
  if (nodeGraphModuleDefinitions[type]?.layout === "textBox") {
    node.layout = normalizeNodeGraphTextBoxLayout(options.layout);
  }
  return node;
}

const nodeGraphDefaultNodeConfigs = Object.freeze([
  createNodeGraphPatchNode("osc", { id: "osc", gx: 1, gy: 1 }),
  createNodeGraphPatchNode("noise", { id: "noise", gx: 0, gy: 11 }),
  {
    ...createNodeGraphPatchNode("gain", { id: "gain", gx: 11, gy: 2 }),
    params: { ...nodeGraphDefaultParamsForType("gain"), amount: 1 },
  },
  {
    ...createNodeGraphPatchNode("output", { id: "output", gx: 22, gy: 9 }),
    params: { ...nodeGraphDefaultParamsForType("output"), volume: 0.1 },
  },
]);

const nodeGraphDefaultConnections = Object.freeze([
  { sourceNode: "osc", sourcePort: "Out", destinationNode: "gain", destinationPort: "In" },
  { sourceNode: "gain", sourcePort: "Out", destinationNode: "output", destinationPort: "Left" },
  { sourceNode: "gain", sourcePort: "Out", destinationNode: "output", destinationPort: "Right" },
]);

const nodeGraphDefaultPatch = Object.freeze({
  audio: {
    targetSampleRate: 88200,
  },
  bypassedNodes: [],
  info: {
    author: "",
    description: "",
    name: "Patch name",
    tags: "tags",
  },
  visual: {
    background: {
      h: 210,
      l: 5,
      s: 0,
    },
    mode: "auto",
    scale: 1,
    style: "glow",
    theme: "cyan-violet",
    trail: 0.35,
  },
  windows: {
    metadata: { left: null, top: null },
    moduleActions: { left: null, top: null },
  },
  grid: { ...nodeGraphGrid },
  view: { widthGu: 31, heightGu: 20 },
  nodes: nodeGraphDefaultNodeConfigs.map((node) => ({ ...node })),
  connections: nodeGraphDefaultConnections.map((connection) => ({ ...connection })),
  modulations: [],
});

const nodeMetadataKindAliases = Object.freeze({
  bipolar: "decimal_bipolar",
  gain: "amplitude",
});
let nodeMetadataKindTemplates = Object.freeze(Object.fromEntries(
  Object.entries(fallbackNodeMetadataKindTemplates).map(([kind, template]) => [
    kind,
    normalizeNodeMetadataKindTemplate(template),
  ]),
));

const nodeGraphMvp = {
  activeNodes: new Set(nodeGraphDefaultPatch.nodes.map((node) => node.id)),
  audioContext: null,
  bufferSource: null,
  connections: nodeGraphDefaultPatch.connections.map((connection) => ({ ...connection })),
  defaultPatch: cloneNodeGraphPatch(nodeGraphDefaultPatch),
  dragging: null,
  historyIndex: -1,
  historyLimit: 100,
  historySnapshots: [],
  pan: { x: 0, y: 0 },
  gridVisible: false,
  sliderLabelsVisible: true,
  sliderValuesVisible: true,
  sliderHandlesVisible: true,
  live: {
    context: null,
    inputActive: false,
    inputDeviceId: "",
    inputMeterPeak: 0,
    inputMeterRms: 0,
    inputMeterSamples: 0,
    inputMeterSquareSum: 0,
    inputPermissionStatus: "unknown",
    micStatus: "off",
    inputStreamFactory: null,
    inputSource: null,
    inputStatus: "off",
    inputStream: null,
    lastEvidence: null,
    meterGain: null,
    mockInputDestination: null,
    mockInputGain: null,
    mockInputOscillator: null,
    node: null,
    outputEnabled: false,
    outputGain: null,
    planEvidence: null,
    activeNodeIds: new Set(),
    outputToggleSerial: 0,
    planSerial: 0,
    runtime: null,
    sessionId: 0,
    scriptNode: null,
    syncFrame: 0,
    syncMode: "",
    syncTimer: 0,
    usesWorklet: false,
  },
  marqueeSelection: null,
  marqueeSelectionEntryPointer: null,
  metadataDragging: null,
  metadataEditorTarget: null,
  metadataPopoverPosition: null,
  moduleActionDragging: null,
  moduleActionWindowPosition: null,
  modulations: nodeGraphDefaultPatch.modulations.map((modulation) => ({ ...modulation })),
  nodeDragging: null,
  nodeTypeCounts: {
    audioInput: 0,
    bias: 1,
    gain: 1,
    noise: 1,
    osc: 1,
    spiral: 0,
  },
  patch: cloneNodeGraphPatch(nodeGraphDefaultPatch),
  rendered: null,
  renderedAudioUrl: "",
  renderedPlayback: {
    durationSeconds: 0,
    frame: null,
    frames: 0,
    playing: false,
    progress: 0,
    startContextTime: 0,
    startPerformanceTime: 0,
    timer: 0,
  },
  sceneContextPoint: null,
  sceneContextTargetNode: null,
  sceneContextTargetWire: null,
  confirmDefaultButton: null,
  confirmDefaultButtonTimer: 0,
  scriptCommitDelayMs: 250,
  scriptDirty: false,
  scriptCommitTimer: 0,
  selected: null,
  sampleRate: 44100,
  seconds: 2,
  sliderDragging: null,
  smoothZoomDragging: null,
  snapGridWhilePanning: false,
  tooltipVisible: true,
  tooltips: {},
  workspaceResizing: null,
  zoom: 1,
};

const nodeGraphWireHelpers = window.createNodeGraphWireHelpers({
  clonePatch: cloneNodeGraphPatch,
  commitPatch: commitNodeGraphPatch,
  connectModulation: connectNodeGraphModulation,
  connectPorts: connectNodeGraphPorts,
  drawWires: drawNodeGraphWires,
  elementCenter: nodeGraphElementCenter,
  modulationPortCenter: nodeGraphModulationPortCenter,
  modulationPortSelector: nodeGraphModulationPortSelector,
  patch: () => nodeGraphMvp.patch,
  portCenter: nodeGraphPortCenter,
  portSelector: nodeGraphPortSelector,
  selectWire: selectNodeGraphWire,
  setSelection: setNodeGraphSelection,
  wireFromSelection: nodeGraphWireFromSelection,
  zoomSurface: nodeGraphZoomSurface,
});

const nodeGraphWireInteractions = window.createNodeGraphWireInteractionController({
  burstZap: burstNodeGraphZap,
  clientPoint: nodeGraphClientPoint,
  drawWires: drawNodeGraphWires,
  helpers: nodeGraphWireHelpers,
  setHelp: setNodeInteractionHelp,
  state: nodeGraphMvp,
  svg: () => document.getElementById("nodeWireSvg"),
  workspace: () => document.getElementById("nodeGraphWorkspace"),
});

const nodeGraphZoomLimits = Object.freeze({
  max: 6,
  min: 0.25,
  step: 0.08,
  wheelRatio: 1.12,
});

function nodeGraphBypassGlyph(bypassed) {
  return "🗲";
}

function applyNodeGraphWorkspaceView() {
  const workspace = document.getElementById("nodeGraphWorkspace");
  if (!workspace) {
    return;
  }

  workspace.style.setProperty("--node-grid-height", `${nodeGraphGridHeight()}px`);
  workspace.style.setProperty("--node-grid-size", `${nodeGraphGridSize()}px`);
  workspace.style.setProperty("--node-grid-width", `${nodeGraphGridWidth()}px`);
  const view = normalizeNodeGraphPatchView(nodeGraphMvp.patch.view);
  if (view.widthGu > 0) {
    workspace.style.width = nodeGraphWorkspaceWidthCss(view.widthGu * nodeGraphGridWidth());
  } else {
    workspace.style.removeProperty("width");
  }
  if (view.heightGu > 0) {
    workspace.style.height = nodeGraphWorkspaceHeightCss(view.heightGu * nodeGraphGridHeight());
    workspace.style.removeProperty("aspect-ratio");
  } else {
    workspace.style.removeProperty("height");
    workspace.style.removeProperty("aspect-ratio");
  }
  workspace.dataset.widthGu = String(view.widthGu);
  workspace.dataset.heightGu = String(view.heightGu);
}

function normalizeNodeGraphPatchParameter(type, key, value, metadata = null) {
  const parameter = nodeGraphModuleDefinitions[type]?.parameters?.find(
    (candidate) => candidate.key === key,
  );
  if (!parameter) {
    return null;
  }
  const number = Number(value);
  const fallback = Number(metadata?.def ?? parameter.defaultValue);
  const candidate = Number.isFinite(number)
    ? number
    : Number.isFinite(fallback)
      ? fallback
      : 0;
  const min = Number(metadata?.min ?? parameter.min);
  const max = Number(metadata?.max ?? parameter.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return candidate;
  }
  return metadata?.wraparound || parameter.wraparound
    ? wrapNodeSliderValue(candidate, min, max)
    : clampNodeSliderValue(candidate, min, max);
}

function validateNodeGraphPatch(patch) {
  if (!patch || typeof patch !== "object") {
    throw new Error("patch must be an object");
  }

  if (patch.format !== undefined) {
    if (
      patch.format?.kind !== nodeGraphPatchFormat.kind ||
      Number(patch.format?.version) !== nodeGraphPatchFormat.version
    ) {
      throw new Error("unsupported patch format");
    }
  }

  const grid = normalizeNodeGraphPatchGrid(patch.grid);
  if (!Number.isFinite(grid.widthPx) || grid.widthPx <= 0) {
    throw new Error("grid.widthPx must be a positive number");
  }
  if (!Number.isFinite(grid.heightPx) || grid.heightPx <= 0) {
    throw new Error("grid.heightPx must be a positive number");
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
    if (type === "output" && id !== "output") {
      throw new Error("output module id must be output");
    }
    const gx = Math.round(Number(node.gx));
    const gy = Math.round(Number(node.gy));
    if (!Number.isFinite(gx) || !Number.isFinite(gy)) {
      throw new Error(`node ${id} grid position invalid`);
    }
    const hasCustomWidth = Object.hasOwn(node, "widthGu");
    const widthGu = normalizeNodeGraphModuleWidthUnits(type, node.widthGu);
    if (hasCustomWidth && !Number.isFinite(Number(node.widthGu))) {
      throw new Error(`node ${id} widthGu invalid`);
    }
    const hasCustomHeight = Object.hasOwn(node, "heightGu");
    const heightGu = normalizeNodeGraphModuleHeightUnits(type, node.heightGu, node.ui);
    if (hasCustomHeight && !Number.isFinite(Number(node.heightGu))) {
      throw new Error(`node ${id} heightGu invalid`);
    }
    const params = {};
    const paramMeta = {};
    for (const parameter of nodeGraphModuleDefinitions[type].parameters || []) {
      const metadata = normalizeNodeGraphPatchParameterMetadata(
        type,
        parameter.key,
        node.paramMeta?.[parameter.key],
      );
      paramMeta[parameter.key] = metadata;
      const value = Object.hasOwn(node.params || {}, parameter.key)
        ? node.params[parameter.key]
        : parameter.defaultValue;
      params[parameter.key] = normalizeNodeGraphPatchParameter(
        type,
        parameter.key,
        value,
        metadata,
      );
    }
    ids.add(id);
    const normalizedNode = {
      gx,
      gy,
      id,
      paramMeta,
      params,
      type,
      ...(normalizeNodeGraphPatchNodeAlias(node.alias)
        ? { alias: normalizeNodeGraphPatchNodeAlias(node.alias) }
        : {}),
      ...(hasCustomWidth ? { widthGu } : {}),
      ...(hasCustomHeight ? { heightGu } : {}),
    };
    if (nodeGraphModuleDefinitions[type].layout === "textBox") {
      normalizedNode.layout = normalizeNodeGraphTextBoxLayout(node.layout);
    }
    const ui = nodeGraphModuleDefinitions[type].layout === "textBox" && !Object.hasOwn(node, "ui")
      ? { buttonsHidden: true }
      : normalizeNodeGraphPatchNodeUi(node.ui);
    if (ui.buttonsHidden || ui.titleHidden) {
      normalizedNode.ui = ui;
    }
    return normalizedNode;
  });

  if (!ids.has("output")) {
    throw new Error("output node missing");
  }

  const bypassedNodes = [];
  const bypassedNodeIds = new Set();
  if (patch.bypassedNodes !== undefined && !Array.isArray(patch.bypassedNodes)) {
    throw new Error("bypassedNodes must be an array");
  }
  for (const value of patch.bypassedNodes || []) {
    const id = String(value || "").trim();
    if (!id) {
      throw new Error("bypassedNodes entry missing node id");
    }
    if (!ids.has(id)) {
      throw new Error(`bypassed node missing: ${id}`);
    }
    if (id === "output") {
      throw new Error("output module cannot be bypassed");
    }
    if (!bypassedNodeIds.has(id)) {
      bypassedNodeIds.add(id);
      bypassedNodes.push(id);
    }
  }

  const connectionKeys = new Set();
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
    if (!nodeGraphModuleOutputPorts(sourceType).includes(sourcePort)) {
      throw new Error(`connection source port invalid: ${sourceNode}.${sourcePort}`);
    }
    if (destinationType === "output" && destinationPort === "In") {
      destinationPort = "Left";
    }
    if (!(nodeGraphModuleDefinitions[destinationType].inputs || []).includes(destinationPort)) {
      throw new Error(`connection destination port invalid: ${destinationNode}.${destinationPort}`);
    }
    const key = `${sourceNode}.${sourcePort}->${destinationNode}.${destinationPort}`;
    if (connectionKeys.has(key)) {
      throw new Error(`duplicate connection ${key}`);
    }
    connectionKeys.add(key);
    return { destinationNode, destinationPort, sourceNode, sourcePort };
  }) : [];

  const modulationKeys = new Set();
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
    if (!nodeGraphModuleOutputPorts(sourceType).includes(sourcePort)) {
      throw new Error(`modulation source port invalid: ${sourceNode}.${sourcePort}`);
    }
    if (!(nodeGraphModuleDefinitions[destinationType].parameters || []).some((parameter) => parameter.key === destinationParam)) {
      throw new Error(`modulation destination parameter invalid: ${destinationNode}.${destinationParam}`);
    }
    const key = `${sourceNode}.${sourcePort}->${destinationNode}.${destinationParam}`;
    if (modulationKeys.has(key)) {
      throw new Error(`duplicate modulation ${key}`);
    }
    modulationKeys.add(key);
    return { destinationNode, destinationParam, sourceNode, sourcePort };
  }) : [];

  const view = normalizeNodeGraphPatchView(patch.view);
  if (view.widthGu && view.widthGu < nodeGraphWorkspaceViewLimits.minWidthGu) {
    throw new Error(`view.widthGu must be 0 or at least ${nodeGraphWorkspaceViewLimits.minWidthGu}`);
  }
  if (view.heightGu && view.heightGu < nodeGraphWorkspaceViewLimits.minHeightGu) {
    throw new Error(`view.heightGu must be 0 or at least ${nodeGraphWorkspaceViewLimits.minHeightGu}`);
  }

  return {
    audio: normalizeNodeGraphPatchAudio(patch.audio),
    bypassedNodes,
    connections,
    format: { ...nodeGraphPatchFormat },
    grid,
    info: normalizeNodeGraphPatchInfo(patch.info),
    modulations,
    nodes,
    view,
    visual: normalizeNodeGraphPatchVisual(patch.visual),
    windows: normalizeNodeGraphPatchWindows(patch.windows),
  };
}

function loadNodeGraphPatchFromScript(text) {
  try {
    return validateNodeGraphPatch(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`script JSON parse failed: ${error.message}`);
    }
    throw new Error(`script validation failed: ${error.message}`);
  }
}

function handleNodeGraphSettingsInput() {
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  patch.audio = readNodeGraphAudioSettingsView();
  patch.grid = readNodeGraphGridSettingsView();
  patch.info = readNodeGraphSettingsView();
  patch.visual = readNodeGraphVisualSettingsView();
  commitNodeGraphPatch(patch, {
    markPending: false,
    record: false,
    status: "settings synced",
  });
  drawNodeRenderedVisualOutput();
}

function commitNodeGraphSettingsHistory() {
  recordNodeGraphHistory();
  const scriptStatus = nodeGraphPatchScriptStatus("settings saved", true);
  syncNodeGraphScriptView(scriptStatus.message, scriptStatus.ok);
}

function handleNodeGraphHeaderInfoInput(event) {
  const field = event.currentTarget?.dataset?.patchHeaderInfoField;
  if (!["name", "tags"].includes(field)) {
    return;
  }
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  patch.info = normalizeNodeGraphPatchInfo({
    ...patch.info,
    [field]: event.currentTarget.value,
  });
  commitNodeGraphPatch(patch, {
    markPending: false,
    record: false,
    status: "settings synced",
  });
}

function nodeGraphModuleShouldBeVisible(node) {
  const type = typeof node === "string" ? nodeGraphPatchNodeType(node) : node?.type;
  return type !== "audioInput" || Boolean(nodeGraphMvp.live.inputActive);
}

function nodeGraphPatchNodeIsVisible(nodeId) {
  const node = nodeGraphPatchNode(nodeId);
  return Boolean(node && nodeGraphModuleShouldBeVisible(node));
}

function applyNodeGraphPatchToDom() {
  const container = document.getElementById("nodeGraphNodes");
  if (!container) {
    return;
  }

  applyNodeGraphWorkspaceView();

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
    element.style.setProperty("--node-grid-width-units", String(nodeGraphPatchNodeGridWidthUnits(patchNode)));
    element.style.setProperty("--node-grid-height-units", String(nodeGraphPatchNodeGridHeightUnits(patchNode)));
    const point = nodeGraphGridToPixel(patchNode);
    positionNodeGraphNode(element, point, { clamp: false, snap: false });
    element.hidden = !nodeGraphModuleShouldBeVisible(patchNode);
    element.dataset.gridX = String(patchNode.gx);
    element.dataset.gridY = String(patchNode.gy);
    const titleText = element.querySelector(".node-header-title");
    if (titleText) {
      titleText.textContent = nodeGraphPatchNodeTitle(patchNode);
    }
    const patchNodeUi = normalizeNodeGraphPatchNodeUi(patchNode.ui);
    element.classList.toggle("buttons-hidden", patchNodeUi.buttonsHidden);
    element.classList.toggle("title-hidden", patchNodeUi.titleHidden);
    const bypassed = nodeGraphNodeDisplaysBypassed(patchNode.id);
    element.classList.toggle("bypassed", bypassed);
    const bypassButton = element.querySelector(".node-bypass-button");
    if (bypassButton) {
      bypassButton.setAttribute("aria-pressed", bypassed ? "true" : "false");
      bypassButton.textContent = nodeGraphBypassGlyph(bypassed);
      nodeGraphApplyTooltip(
        bypassButton,
        patchNode.id === "output"
          ? (bypassed ? "module.outputOn" : "module.outputOff")
          : (bypassed ? "module.include" : "module.bypass"),
      );
    }
    for (const parameter of nodeGraphModuleDefinitions[patchNode.type]?.parameters || []) {
      const input = element.querySelector(`input[data-param="${CSS.escape(parameter.key)}"]`);
      if (!input) {
        continue;
      }
      setNodeSliderMetadata(
        input,
        patchNode.paramMeta?.[parameter.key] ||
        nodeGraphParameterDefinitionMetadata(parameter),
      );
      input.value = String(
        patchNode.params?.[parameter.key] ??
        nodeGraphParameterFallback(patchNode.type, parameter.key),
      );
      syncNodeSliderReadout(input);
    }
    if (nodeGraphModuleDefinitions[patchNode.type]?.layout === "textBox") {
      syncNodeGraphTextBoxElement(element, patchNode);
    }
  }
  syncNodeGraphInputModuleLiveState();
  updateNodeGraphGridHeatmap();
}

function commitNodeGraphPatch(patch, options = {}) {
  nodeGraphMvp.patch = cloneNodeGraphPatch(validateNodeGraphPatch(patch));
  syncNodeGraphRuntimeFromPatch();
  applyNodeGraphPatchToDom();
  pruneNodeGraphSelectionAfterPatch();
  renderNodePalette();
  renderNodeGraphConnectionList();
  syncNodeGraphGhostSliders();
  renderNodeGraphVisualSettings();
  syncNodeGraphSettingsView();
  const scriptStatus = nodeGraphPatchScriptStatus(
    options.status || "script synced",
    options.ok ?? true,
  );
  syncNodeGraphScriptView(scriptStatus.message, scriptStatus.ok);
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
    nodeGraphMvp.scriptDirty = false;
    clearNodeGraphScriptBlockedActions();
    return true;
  } catch (error) {
    nodeGraphMvp.scriptDirty = true;
    setNodeGraphScriptStatus(error.message, false);
    return false;
  }
}

function clearNodeGraphScriptCommitTimer() {
  if (!nodeGraphMvp.scriptCommitTimer) {
    return;
  }
  window.clearTimeout(nodeGraphMvp.scriptCommitTimer);
  nodeGraphMvp.scriptCommitTimer = 0;
}

function scheduleNodeGraphScriptCommit(text) {
  clearNodeGraphScriptCommitTimer();
  nodeGraphMvp.scriptDirty = true;
  setNodeGraphScriptStatus("script editing", true);
  nodeGraphMvp.scriptCommitTimer = window.setTimeout(() => {
    nodeGraphMvp.scriptCommitTimer = 0;
    commitNodeGraphScript(text);
  }, nodeGraphMvp.scriptCommitDelayMs);
}

function flushNodeGraphScriptCommit() {
  if (!nodeGraphMvp.scriptCommitTimer) {
    return !nodeGraphMvp.scriptDirty;
  }
  const script = document.getElementById("nodePatchScript");
  clearNodeGraphScriptCommitTimer();
  return commitNodeGraphScript(script?.value || "");
}

function nodeGraphScriptReadyForGraphAction(action = "graph action") {
  if (flushNodeGraphScriptCommit()) {
    return true;
  }
  setNodeGraphScriptStatus(`Fix script before ${action}`, false);
  return false;
}

function markNodeGraphRenderScriptBlocked() {
  const renderStatus = document.getElementById("nodeGraphRenderStatus");
  renderStatus.textContent = "render blocked";
  renderStatus.className = "pill warn";
  clearNodeGraphRenderedAudioElement();
  labelPrimaryAudioTitle("Fix script before rendering", false);
}

function markNodeGraphLiveScriptBlocked() {
  const message = "fix script before live audio";
  setNodeGraphLiveEvidence("script-blocked", {
    message,
    patchFingerprint: nodeGraphPatchFingerprint(),
  });
  setNodeGraphLiveStatus("error", "warn");
  setNodeGraphLivePlanStatus("plan blocked", "warn");
  setNodeGraphLivePlanTitle(message);
  setNodeGraphLiveScheduleStatus(`schedule blocked: ${message}`, "warn");
  document.getElementById("nodeLiveStatus").title = message;
  renderNodeGraphLiveControls(false);
}

function clearNodeGraphRenderScriptBlock() {
  const renderStatus = document.getElementById("nodeGraphRenderStatus");
  if (renderStatus?.textContent === "render blocked") {
    markNodeGraphRenderPending();
  }
}

function clearNodeGraphLiveScriptBlock() {
  const liveStatus = document.getElementById("nodeLiveStatus");
  const livePlanStatus = document.getElementById("nodeLivePlanStatus");
  const liveScheduleStatus = document.getElementById("nodeLiveRouteStatus");
  if (
    liveStatus?.textContent === "error" &&
    livePlanStatus?.textContent === "plan blocked" &&
    liveScheduleStatus?.textContent === "schedule blocked: fix script before live audio"
  ) {
    setNodeGraphLiveStatus("stopped");
    setNodeGraphLiveEvidence("stopped");
    setNodeGraphLivePlanStatus();
    setNodeGraphLivePlanTitle();
    setNodeGraphLiveScheduleStatus("schedule stopped");
    clearNodeGraphLiveStatusTitle();
    renderNodeGraphLiveControls(false);
  }
}

function clearNodeGraphScriptBlockedActions() {
  clearNodeGraphRenderScriptBlock();
  clearNodeGraphLiveScriptBlock();
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
    syncNodeGraphPatchWindowPosition("metadata", { left, top });
  }
}

function syncNodeGraphPatchWindowPosition(key, position) {
  const normalizedPosition = normalizeNodeGraphWindowPosition(position);
  if (key === "metadata") {
    nodeGraphMvp.metadataPopoverPosition = normalizedPosition;
  } else if (key === "moduleActions") {
    nodeGraphMvp.moduleActionWindowPosition = normalizedPosition;
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
  event.stopPropagation();
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
  document.getElementById("metadataDivideChoicesValue").checked = metadata.divideChoicesVisibly;
  document.getElementById("metadataLinearSmoothingValue").checked = metadata.linearSmoothing;
  document.getElementById("metadataNonlinearSliderValue").checked = metadata.nonlinearSlider;
  document.getElementById("metadataShowSignValue").checked = metadata.showSign;
  document.getElementById("metadataWraparoundValue").checked = metadata.wraparound;
  syncNodeMetadataMidVisibility();
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
  if (nodeGraphMvp.moduleActionDragging?.handle) {
    nodeGraphMvp.moduleActionDragging.handle.classList.remove("dragging");
  }
  nodeGraphMvp.moduleActionDragging = null;
  nodeGraphMvp.sceneContextPoint = null;
  nodeGraphMvp.sceneContextTargetNode = null;
  nodeGraphMvp.sceneContextTargetWire = null;
}

function syncNodeGraphPatchMetadataFromSlider(slider, options = {}) {
  const node = slider?.closest(".dsp-node")?.dataset.node;
  const key = slider?.dataset.param;
  if (!node || !key) {
    return;
  }
  const patchNode = nodeGraphMvp.patch.nodes.find((candidate) => candidate.id === node);
  if (!patchNode) {
    return;
  }
  patchNode.paramMeta = {
    ...(patchNode.paramMeta || {}),
    [key]: normalizeNodeGraphPatchParameterMetadata(
      patchNode.type,
      key,
      nodeSliderMetadata(slider),
    ),
  };
  patchNode.params = {
    ...(patchNode.params || {}),
    [key]: normalizeNodeGraphPatchParameter(
      patchNode.type,
      key,
      nodeGraphReadNodeNumber(node, key),
      patchNode.paramMeta[key],
    ),
  };
  syncNodeGraphScriptView(options.status || "metadata synced", true);
  renderNodeGraphExecutionPlanDebug();
  scheduleNodeGraphLiveParameterSync();
  if (options.record) {
    recordNodeGraphHistory();
  } else {
    renderNodeGraphHistoryControls();
  }
}

function syncNodeGraphPatchParameterFromSlider(slider, options = {}) {
  const node = slider?.closest(".dsp-node")?.dataset.node;
  const key = slider?.dataset.param;
  if (!node || !key) {
    return;
  }
  const patchNode = nodeGraphMvp.patch.nodes.find((candidate) => candidate.id === node);
  if (!patchNode) {
    return;
  }
  patchNode.paramMeta = {
    ...(patchNode.paramMeta || {}),
    [key]: normalizeNodeGraphPatchParameterMetadata(
      patchNode.type,
      key,
      patchNode.paramMeta?.[key] || nodeSliderMetadata(slider),
    ),
  };
  patchNode.params = {
    ...(patchNode.params || {}),
    [key]: normalizeNodeGraphPatchParameter(
      patchNode.type,
      key,
      nodeGraphReadNodeNumber(node, key),
      patchNode.paramMeta[key],
    ),
  };
  if (options.deferUi) {
    return;
  }
  syncNodeGraphScriptView(options.status || "parameter synced", true);
  renderNodeGraphExecutionPlanDebug();
  syncNodeGraphGhostSliders();
  if (options.record) {
    recordNodeGraphHistory();
  } else {
    renderNodeGraphHistoryControls();
  }
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
  syncNodeGraphPatchParameterFromSlider(slider, {
    record: true,
    status: "parameter changed",
  });
  if (nodeGraphMvp.metadataEditorTarget === slider.id) {
    fillNodeMetadataPopover(slider);
  }
  markNodeGraphRenderPending();
  scheduleNodeGraphLiveParameterSync();
}

function setNodeSliderValue(slider, value) {
  slider.value = String(
    normalizeNodeSliderValue(slider, value),
  );
  syncNodeSliderReadout(slider);
  syncNodeGraphPatchParameterFromSlider(slider, { deferUi: true });
  syncNodeGraphGhostSliders();
  markNodeGraphRenderPending();
  scheduleNodeGraphLiveParameterSync();
}

function nodeSliderSegmentValueFromPointer(slider, surface, clientX) {
  const choices = parseNodeMetadataChoices(slider.dataset.choices);
  if (!choices.length) {
    return null;
  }
  const rect = surface.getBoundingClientRect();
  const progress = clampNodeSliderValue((clientX - rect.left) / Math.max(1, rect.width), 0, 0.999999);
  const index = Math.min(choices.length - 1, Math.floor(progress * choices.length));
  return Number(slider.min) + index;
}

function setNodeChoiceSliderFromPointer(slider, surface, clientX) {
  const value = nodeSliderSegmentValueFromPointer(slider, surface, clientX);
  if (!Number.isFinite(value)) {
    return false;
  }
  setNodeSliderValue(slider, value);
  return true;
}

function updateNodeSliderDotCursor(event) {
  if (!event) {
    return;
  }
  document.body.style.setProperty("--node-slider-cursor-x", `${event.clientX}px`);
  document.body.style.setProperty("--node-slider-cursor-y", `${event.clientY}px`);
}

function clearNodeSliderDotCursor() {
  document.body.classList.remove("node-slider-dragging");
  document.body.style.removeProperty("--node-slider-cursor-x");
  document.body.style.removeProperty("--node-slider-cursor-y");
}

function nodeSliderValueFromPointer(slider, surface, clientX) {
  const rect = surface.getBoundingClientRect();
  const travel = clampNodeSliderValue(
    (clientX - rect.left) / Math.max(1, rect.width),
    0,
    1,
  );
  return nodeSliderValueFromTravel(slider, travel);
}

function nodeSliderFineTuneScale(event) {
  if (event.ctrlKey && event.shiftKey) {
    return 0.001;
  }
  if (event.shiftKey) {
    return 0.01;
  }
  if (event.ctrlKey) {
    return 0.1;
  }
  return 1;
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
  const resetToDefaultOnClick = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
  const pointerMode = event.altKey ? "absolute" : "relative";
  let startTravel = nodeSliderTravelFromValue(slider, Number(slider.value));
  if (pointerMode === "absolute") {
    setNodeSliderValue(
      slider,
      quantizeNodeSliderDragValue(slider, nodeSliderValueFromPointer(slider, surface, event.clientX)),
    );
    startTravel = nodeSliderTravelFromValue(slider, Number(slider.value));
  } else if (!resetToDefaultOnClick && nodeSliderShouldDisplayChoices(slider) && nodeSliderShouldDivideChoicesVisibly(slider)) {
    setNodeChoiceSliderFromPointer(slider, surface, event.clientX);
    startTravel = nodeSliderTravelFromValue(slider, Number(slider.value));
  }
  nodeGraphMvp.sliderDragging = {
    moved: false,
    pointerId: event.pointerId ?? null,
    pointerMode,
    resetToDefaultOnClick,
    slider,
    surface,
    startTravel,
    startX: event.clientX,
    startY: event.clientY,
    fineScale: nodeSliderFineTuneScale(event),
    width: Math.max(1, rect.width),
  };
  surface.classList.add("value-dragging");
  document.body.classList.add("node-slider-dragging");
  updateNodeSliderDotCursor(event);
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

  if (drag.pointerMode === "absolute") {
    setNodeSliderValue(
      drag.slider,
      quantizeNodeSliderDragValue(
        drag.slider,
        nodeSliderValueFromPointer(drag.slider, drag.surface, event.clientX),
      ),
    );
  } else {
    const horizontalDelta = event.clientX - drag.startX;
    const verticalDelta = drag.startY - event.clientY;
    if (Math.abs(horizontalDelta) > 1 || Math.abs(verticalDelta) > 1) {
      drag.moved = true;
    }
    const travelDelta = ((horizontalDelta + verticalDelta) / drag.width) * drag.fineScale;
    setNodeSliderValue(
      drag.slider,
      quantizeNodeSliderDragValue(
        drag.slider,
        nodeSliderValueFromTravel(drag.slider, drag.startTravel + travelDelta),
      ),
    );
  }
  updateNodeSliderDotCursor(event);
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
  clearNodeSliderDotCursor();
  if (event.pointerId !== undefined && drag.surface.hasPointerCapture?.(event.pointerId)) {
    drag.surface.releasePointerCapture(event.pointerId);
  }
  if (drag.resetToDefaultOnClick && !drag.moved) {
    setNodeSliderValue(drag.slider, Number(drag.slider.dataset.default));
  }
  syncNodeGraphPatchParameterFromSlider(drag.slider, {
    record: true,
    status: drag.resetToDefaultOnClick && !drag.moved ? "parameter reset to default" : "parameter changed",
  });
  nodeGraphMvp.sliderDragging = null;
}

function ensureNodeGraphDragHandle(node) {
  const actions = node.querySelector(".node-header-actions");
  if (!actions || actions.querySelector(".node-drag-handle")) {
    return;
  }

  const handle = document.createElement("button");
  handle.className = "node-drag-handle";
  handle.type = "button";
  handle.setAttribute("aria-label", `Move ${nodeGraphNodeDisplayName(node.dataset.node)} module`);
  nodeGraphApplyTooltip(handle, "module.move");
  handle.innerHTML = "&#x2725;";
  actions.prepend(handle);
}

function attachNodeGraphNodeEvents(node) {
  ensureNodeGraphDragHandle(node);
  node.querySelector(".node-drag-handle")?.addEventListener("pointerdown", beginNodeGraphNodeDrag);
  node.querySelector(".node-header-title-row")?.addEventListener("pointerdown", beginNodeGraphNodeDrag);
  node.querySelector(".node-bypass-button")?.addEventListener("click", toggleNodeGraphModuleBypass);
  node.querySelector(".node-action-button")?.addEventListener("click", openNodeModuleActionMenu);
  node.addEventListener("pointermove", dragNodeGraphNode);
  node.addEventListener("pointerup", endNodeGraphNodeDrag);
  node.addEventListener("pointercancel", endNodeGraphNodeDrag);
  node.addEventListener("lostpointercapture", endNodeGraphNodeDrag);
  for (const port of node.querySelectorAll(".node-port")) {
    port.addEventListener("pointerdown", nodeGraphWireInteractions.beginWireDrag);
  }
  for (const port of node.querySelectorAll(".node-param-port.modulation-input")) {
    port.addEventListener("pointerdown", nodeGraphWireInteractions.beginWireDrag);
  }
  for (const slider of node.querySelectorAll('input[type="range"]')) {
    createNodeSliderReadout(slider);
    slider.addEventListener("input", () => {
      syncNodeSliderReadout(slider);
      syncNodeGraphPatchParameterFromSlider(slider);
      syncNodeGraphGhostSliders();
      markNodeGraphRenderPending();
      scheduleNodeGraphLiveParameterSync();
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
  button.dataset.alias = nodeGraphLabel(node, port);
  const label = `${nodeGraphNodeLabels[type]} ${io} port ${port}`;
  button.setAttribute("aria-label", label);
  return button;
}

function createNodeGraphIoColumn(node, type, ports, io) {
  if (!ports?.length) {
    return null;
  }

  const column = document.createElement("div");
  column.className = `node-io-column ${io}`;
  for (const port of ports) {
    const row = document.createElement("div");
    row.className = `node-io-row ${io}`;
    row.dataset.node = node;
    row.dataset.port = port;
    row.dataset.io = io;
    row.dataset.alias = nodeGraphLabel(node, port);
    row.setAttribute(
      "aria-label",
      `${nodeGraphNodeLabels[type]} ${io} port ${port} interaction area`,
    );
    const label = document.createElement("span");
    label.className = "node-io-label";
    label.textContent = port;
    if (io === "input") {
      row.append(createNodeGraphPort(node, type, port, io), label);
    } else {
      row.append(label, createNodeGraphPort(node, type, port, io));
    }
    column.append(row);
  }
  return column;
}

function createNodeParameterModulationPort(node, type, parameter) {
  const button = document.createElement("button");
  button.className = "node-param-port modulation-input";
  button.type = "button";
  button.dataset.node = node;
  button.dataset.param = parameter.key;
  button.dataset.port = parameter.key;
  button.dataset.io = "modulation";
  button.dataset.alias = `${nodeGraphNodeDisplayName(node)}.${parameter.key} mod`;
  const label = `${nodeGraphNodeLabels[type]} ${parameter.label} modulation input`;
  button.setAttribute("aria-label", label);
  return button;
}

function createNodeParameterOutputPort(node, type, parameter) {
  const button = document.createElement("button");
  button.className = "node-param-port parameter-output node-port output";
  button.type = "button";
  button.dataset.node = node;
  button.dataset.param = parameter.key;
  button.dataset.port = parameter.key;
  button.dataset.io = "output";
  button.dataset.alias = `${nodeGraphNodeDisplayName(node)}.${parameter.key} slider`;
  const label = `${nodeGraphNodeLabels[type]} ${parameter.label} slider output`;
  button.setAttribute("aria-label", label);
  return button;
}

function createNodeGraphParameter(node, type, parameter) {
  const row = document.createElement("div");
  row.className = "node-parameter-row";
  row.dataset.param = parameter.key;
  row.append(createNodeParameterModulationPort(node, type, parameter));

  const label = document.createElement("label");
  label.className = "node-parameter-control";
  label.dataset.paramLabel = parameter.label;
  label.setAttribute("aria-label", parameter.label);
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
  input.dataset.divideChoicesVisibly = parameter.divideChoicesVisibly ? "true" : "false";
  input.dataset.linearSmoothing = parameter.linearSmoothing === false ? "false" : "true";
  input.dataset.nonlinearSlider = nodeGraphParameterDefinitionMetadata(parameter)?.nonlinearSlider ? "true" : "false";
  input.dataset.showSign = parameter.showSign ? "true" : "false";
  input.dataset.wraparound = parameter.wraparound ? "true" : "false";
  input.setAttribute("aria-label", `${nodeGraphNodeLabels[type]} ${parameter.label}`);
  label.append(input);
  row.append(label);
  row.append(createNodeParameterOutputPort(node, type, parameter));
  return row;
}

function createNodeGraphModuleElement(type, node) {
  const definition = nodeGraphModuleDefinitions[type];
  const article = document.createElement("article");
  article.className = `dsp-node${definition.output ? " output-node" : ""}${definition.layout === "textBox" ? " text-box-layout" : ""}`;
  article.dataset.node = node;
  article.dataset.nodeType = type;
  article.style.setProperty("--node-grid-width-units", String(nodeGraphModuleGridWidthUnits(type)));
  article.style.setProperty("--node-grid-height-units", String(nodeGraphModuleGridHeightUnits(type)));

  const header = document.createElement("div");
  header.className = "dsp-node-header";
  const titleRow = document.createElement("div");
  titleRow.className = "node-header-title-row";
  nodeGraphApplyTooltip(titleRow, "module.move");
  const titleText = document.createElement("span");
  titleText.className = "node-header-title";
  titleText.textContent = nodeGraphPatchNodeTitle({ id: node, type });
  titleRow.append(titleText);
  header.append(titleRow);

  const actionRow = document.createElement("div");
  actionRow.className = "node-header-actions";
  const handle = document.createElement("button");
  handle.className = "node-drag-handle";
  handle.type = "button";
  handle.setAttribute("aria-label", `Move ${nodeGraphNodeLabels[type]} module`);
  nodeGraphApplyTooltip(handle, "module.move");
  handle.innerHTML = "&#x2725;";
  actionRow.append(handle);
  const orderBadge = document.createElement("span");
  orderBadge.className = "node-execution-order-badge";
  orderBadge.dataset.executionState = "inactive";
  orderBadge.textContent = "--";
  orderBadge.setAttribute("aria-label", `${nodeGraphNodeLabels[type]} execution order inactive`);
  nodeGraphApplyTooltip(orderBadge, "module.executionTitleInactive");
  actionRow.append(orderBadge);
  if (definition.output) {
    const bypassButton = document.createElement("button");
    bypassButton.className = "node-bypass-button";
    bypassButton.type = "button";
    bypassButton.dataset.node = node;
    bypassButton.textContent = nodeGraphBypassGlyph(false);
    bypassButton.setAttribute("aria-label", "Toggle live OUTPUT from Output module");
    bypassButton.setAttribute("aria-pressed", "true");
    nodeGraphApplyTooltip(bypassButton, "module.outputToggle");
    actionRow.append(bypassButton);
  }
  if (!definition.output && !definition.layoutOnly) {
    const bypassButton = document.createElement("button");
    bypassButton.className = "node-bypass-button";
    bypassButton.type = "button";
    bypassButton.dataset.node = node;
    bypassButton.textContent = nodeGraphBypassGlyph(false);
    bypassButton.setAttribute("aria-label", `Bypass ${nodeGraphNodeLabels[type]} module`);
    bypassButton.setAttribute("aria-pressed", "false");
    nodeGraphApplyTooltip(bypassButton, "module.bypass");
    actionRow.append(bypassButton);
  }
  const actionButton = document.createElement("button");
  actionButton.className = "node-action-button";
  actionButton.type = "button";
  actionButton.dataset.node = node;
  actionButton.setAttribute("aria-label", `${nodeGraphNodeLabels[type]} module actions`);
  nodeGraphApplyTooltip(actionButton, "module.actionsTitle");
  actionButton.textContent = "\u2699";
  actionRow.append(actionButton);
  header.append(actionRow);

  article.append(header);

  if (definition.layout === "textBox") {
    article.append(createNodeGraphTextBoxBody(node));
  } else {
    const ioSection = document.createElement("div");
    ioSection.className = "dsp-node-io-section";
    const inputColumn = createNodeGraphIoColumn(node, type, definition.inputs, "input");
    const outputColumn = createNodeGraphIoColumn(node, type, definition.outputs, "output");
    if (inputColumn) {
      ioSection.append(inputColumn);
    } else {
      ioSection.append(document.createElement("div"));
    }
    if (outputColumn) {
      ioSection.append(outputColumn);
    } else {
      ioSection.append(document.createElement("div"));
    }
    article.append(ioSection);
  }

  if (type === "audioInput") {
    const stateBadge = document.createElement("div");
    stateBadge.className = "node-live-input-state-badge";
    stateBadge.dataset.micState = "off";
    stateBadge.textContent = "mic off";
    article.append(stateBadge);
  }

  if (definition.parameters?.length) {
    const body = document.createElement("div");
    body.className = "dsp-node-body";

    for (const parameter of definition.parameters) {
      body.append(createNodeGraphParameter(node, type, parameter));
    }
    article.append(body);
  }

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
  const bypassedNodes = nodeGraphRuntimeBypassedNodeIds(patch);
  const dependencies = new Map(nodeList.map((node) => [node.id, new Set()]));
  const inputConnections = new Map();
  const modulationConnections = new Map();

  function addDependency(map, destinationNode, sourceNode) {
    if (!map.has(destinationNode)) {
      map.set(destinationNode, new Set());
    }
    map.get(destinationNode).add(sourceNode);
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
    const sourceOutputs = nodeGraphModuleOutputPorts(source.type);
    const destinationInputs = nodeGraphModuleDefinitions[destination.type]?.inputs || [];
    if (!sourceOutputs.includes(connection.sourcePort)) {
      issues.push(`connection source port invalid: ${connection.sourceNode}.${connection.sourcePort}`);
      continue;
    }
    if (!destinationInputs.includes(connection.destinationPort)) {
      issues.push(`connection destination port invalid: ${connection.destinationNode}.${connection.destinationPort}`);
      continue;
    }
    if (bypassedNodes.has(connection.sourceNode) || bypassedNodes.has(connection.destinationNode)) {
      continue;
    }
    const key = nodeGraphInputKey(connection.destinationNode, connection.destinationPort);
    const connections = inputConnections.get(key) || [];
    connections.push({ ...connection });
    inputConnections.set(key, connections);
    addDependency(dependencies, connection.destinationNode, connection.sourceNode);
  }

  for (const modulation of patch.modulations || []) {
    const source = nodeMap.get(modulation.sourceNode);
    const destination = nodeMap.get(modulation.destinationNode);
    if (!source || !destination) {
      issues.push("modulation references missing node");
      continue;
    }
    const sourceOutputs = nodeGraphModuleOutputPorts(source.type);
    const destinationParameters = nodeGraphModuleDefinitions[destination.type]?.parameters || [];
    if (!sourceOutputs.includes(modulation.sourcePort)) {
      issues.push(`modulation source port invalid: ${modulation.sourceNode}.${modulation.sourcePort}`);
      continue;
    }
    if (!destinationParameters.some((parameter) => parameter.key === modulation.destinationParam)) {
      issues.push(`modulation destination parameter invalid: ${modulation.destinationNode}.${modulation.destinationParam}`);
      continue;
    }
    if (bypassedNodes.has(modulation.sourceNode) || bypassedNodes.has(modulation.destinationNode)) {
      continue;
    }
    const key = nodeGraphParameterKey(modulation.destinationNode, modulation.destinationParam);
    const modulations = modulationConnections.get(key) || [];
    modulations.push({ ...modulation });
    modulationConnections.set(key, modulations);
    addDependency(dependencies, modulation.destinationNode, modulation.sourceNode);
  }

  return {
    bypassedNodes: [...bypassedNodes],
    connections: (patch.connections || []).map((connection) => ({ ...connection })),
    dependencies,
    inputConnections,
    issues,
    modulationConnections,
    modulations: (patch.modulations || []).map((modulation) => ({ ...modulation })),
    nodeMap,
    nodes: nodeList,
  };
}

function nodeGraphTopologicalOrder(nodes, dependencies, reachableNodes) {
  const order = [];
  const visiting = new Set();
  const visited = new Set();

  function visit(nodeId) {
    if (!reachableNodes.has(nodeId)) {
      return;
    }
    if (visiting.has(nodeId)) {
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

  return { order };
}

function nodeGraphDependencyPathExists(dependencies, startNode, targetNode) {
  if (startNode === targetNode) {
    return true;
  }
  const visited = new Set();

  function visit(nodeId) {
    if (nodeId === targetNode) {
      return true;
    }
    if (visited.has(nodeId)) {
      return false;
    }
    visited.add(nodeId);
    for (const dependency of dependencies.get(nodeId) || []) {
      if (visit(dependency)) {
        return true;
      }
    }
    return false;
  }

  return visit(startNode);
}

function nodeGraphNodeOrderIndexes(nodes) {
  return new Map(nodes.map((node, index) => [node.id, index]));
}

function nodeGraphCompareSchedulingEdges(a, b) {
  return Number(a.isBackward) - Number(b.isBackward) ||
    a.sourceOrder - b.sourceOrder ||
    a.destinationOrder - b.destinationOrder ||
    a.kindOrder - b.kindOrder ||
    a.index - b.index;
}

function nodeGraphSchedulingEdge(sourceNode, destinationNode, kind, index, payload, nodeOrder) {
  const sourceOrder = nodeOrder.get(sourceNode) ?? Number.MAX_SAFE_INTEGER;
  const destinationOrder = nodeOrder.get(destinationNode) ?? Number.MAX_SAFE_INTEGER;
  return {
    destinationNode,
    index,
    isBackward: sourceOrder >= destinationOrder,
    kind,
    kindOrder: kind === "signal" ? 0 : 1,
    payload: { ...payload },
    sourceNode,
    sourceOrder,
    destinationOrder,
  };
}

function nodeGraphBuildSchedulingDependencies(planGraph, reachableNodes) {
  const orderDependencies = new Map(planGraph.nodes.map((node) => [node.id, new Set()]));
  const feedbackConnections = [];
  const feedbackModulations = [];
  const nodeOrder = nodeGraphNodeOrderIndexes(planGraph.nodes);
  const schedulingEdges = [];
  const validSignalWires = new Set(
    [...planGraph.inputConnections.values()]
      .flat()
      .map(nodeGraphSignalWireIdentity),
  );
  const validModulationWires = new Set(
    [...planGraph.modulationConnections.values()]
      .flat()
      .map(nodeGraphModulationWireIdentity),
  );

  for (const [index, connection] of planGraph.connections.entries()) {
    if (
      !validSignalWires.has(nodeGraphSignalWireIdentity(connection)) ||
      !reachableNodes.has(connection.sourceNode) ||
      !reachableNodes.has(connection.destinationNode)
    ) {
      continue;
    }
    schedulingEdges.push(nodeGraphSchedulingEdge(
      connection.sourceNode,
      connection.destinationNode,
      "signal",
      index,
      connection,
      nodeOrder,
    ));
  }

  for (const [index, modulation] of planGraph.modulations.entries()) {
    if (
      !validModulationWires.has(nodeGraphModulationWireIdentity(modulation)) ||
      !reachableNodes.has(modulation.sourceNode) ||
      !reachableNodes.has(modulation.destinationNode)
    ) {
      continue;
    }
    schedulingEdges.push(nodeGraphSchedulingEdge(
      modulation.sourceNode,
      modulation.destinationNode,
      "modulation",
      index,
      modulation,
      nodeOrder,
    ));
  }

  for (const edge of schedulingEdges.sort(nodeGraphCompareSchedulingEdges)) {
    if (nodeGraphDependencyPathExists(orderDependencies, edge.sourceNode, edge.destinationNode)) {
      if (edge.kind === "signal") {
        feedbackConnections.push(edge.payload);
      } else {
        feedbackModulations.push(edge.payload);
      }
    } else {
      orderDependencies.get(edge.destinationNode)?.add(edge.sourceNode);
    }
  }

  return { feedbackConnections, feedbackModulations, orderDependencies };
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
      if (!inputCount && nodeGraphNodeSignalOutputRequired(graph, nodeId)) {
        issues.push(`missing ${nodeGraphNodeDisplayName(nodeId)} input`);
      }
    } else if (
      type !== "audioInput" &&
      type !== "osc" &&
      type !== "spiral" &&
      type !== "noise" &&
      type !== "output"
    ) {
      issues.push(`unsupported source ${nodeId}`);
    }
  }

  const scheduling = nodeGraphBuildSchedulingDependencies(graph, reachableNodes);
  const topology = nodeGraphTopologicalOrder(graph.nodes, scheduling.orderDependencies, reachableNodes);
  const order = topology.order.filter((nodeId) => reachableNodes.has(nodeId));
  const sourceNodes = order.filter((nodeId) => {
    const type = graph.nodeMap.get(nodeId)?.type;
    return type === "audioInput" || type === "osc" || type === "spiral" || type === "noise";
  });
  const inactiveNodes = graph.nodes
    .filter((node) => !reachableNodes.has(node.id))
    .map((node) => node.id);

  const uniqueIssues = [...new Set(issues)];

  return {
    connections: graph.connections,
    dependencies: graph.dependencies,
    bypassedNodes: graph.bypassedNodes,
    feedbackConnections: scheduling.feedbackConnections,
    feedbackModulations: scheduling.feedbackModulations,
    inactiveNodes,
    inputConnections: graph.inputConnections,
    issues: uniqueIssues,
    modulationConnections: graph.modulationConnections,
    modulations: graph.modulations,
    nodeMap: graph.nodeMap,
    nodes: graph.nodes,
    orderDependencies: scheduling.orderDependencies,
    order,
    outputNode,
    reachableNodes: [...reachableNodes],
    sourceNodes,
    valid: uniqueIssues.length === 0,
  };
}

function nodeGraphNodeSignalOutputRequired(graph, nodeId) {
  const node = graph.nodeMap.get(nodeId);
  const signalOutputs = new Set(nodeGraphModuleDefinitions[node?.type]?.outputs || []);
  if (!signalOutputs.size) {
    return false;
  }
  return [...graph.inputConnections.values()]
    .flat()
    .some((connection) =>
      connection.sourceNode === nodeId && signalOutputs.has(connection.sourcePort),
    );
}

function compileValidatedNodeGraphExecutionPlan(patch = nodeGraphMvp.patch) {
  return compileNodeGraphExecutionPlan(validateNodeGraphPatch(patch));
}

function nodeGraphFeedbackText(feedbackConnections = [], feedbackModulations = []) {
  const signal = feedbackConnections.map((connection) =>
    `${nodeGraphNodeDisplayName(connection.sourceNode)}.${connection.sourcePort} -> ` +
    `${nodeGraphNodeDisplayName(connection.destinationNode)}.${connection.destinationPort}`,
  );
  const modulation = feedbackModulations.map((modulation) =>
    `${nodeGraphNodeDisplayName(modulation.sourceNode)}.${modulation.sourcePort} -> ` +
    `${nodeGraphNodeDisplayName(modulation.destinationNode)}.${modulation.destinationParam} mod`,
  );
  return [...signal, ...modulation].join(", ");
}

function nodeGraphSignalWireIdentity(connection) {
  return [
    connection.sourceNode,
    connection.sourcePort,
    connection.destinationNode,
    connection.destinationPort,
  ].join(".");
}

function nodeGraphModulationWireIdentity(modulation) {
  return [
    modulation.sourceNode,
    modulation.sourcePort,
    modulation.destinationNode,
    modulation.destinationParam,
  ].join(".");
}

function nodeGraphFeedbackIdentitySets(plan) {
  return {
    modulation: new Set(plan.feedbackModulations.map(nodeGraphModulationWireIdentity)),
    signal: new Set(plan.feedbackConnections.map(nodeGraphSignalWireIdentity)),
  };
}

function nodeGraphActiveNodeIds(plan) {
  return new Set(plan.reachableNodes || plan.order || []);
}

function nodeGraphPlanBypassedNodeIds(plan) {
  return new Set(plan.bypassedNodes || []);
}

function nodeGraphNodeDisplaysBypassed(nodeId, plan = null) {
  if (nodeId === "output") {
    return !nodeGraphMvp.live.outputEnabled;
  }
  const bypassedNodes = plan
    ? nodeGraphPlanBypassedNodeIds(plan)
    : nodeGraphBypassedNodeIds(nodeGraphMvp.patch);
  return bypassedNodes.has(nodeId);
}

function nodeGraphWireTouchesBypassed(wire, plan) {
  const bypassedNodeIds = nodeGraphPlanBypassedNodeIds(plan);
  return bypassedNodeIds.has(wire.sourceNode) || bypassedNodeIds.has(wire.destinationNode);
}

function nodeGraphSignalConnectionIsActive(connection, activeNodeIds) {
  return activeNodeIds.has(connection.sourceNode) && activeNodeIds.has(connection.destinationNode);
}

function nodeGraphModulationIsActive(modulation, activeNodeIds) {
  return activeNodeIds.has(modulation.sourceNode) && activeNodeIds.has(modulation.destinationNode);
}

function nodeGraphActiveSignalConnections(plan) {
  const activeNodeIds = nodeGraphActiveNodeIds(plan);
  return (plan.connections || []).filter((connection) =>
    nodeGraphSignalConnectionIsActive(connection, activeNodeIds),
  );
}

function nodeGraphActiveModulations(plan) {
  const activeNodeIds = nodeGraphActiveNodeIds(plan);
  return (plan.modulations || []).filter((modulation) =>
    nodeGraphModulationIsActive(modulation, activeNodeIds),
  );
}

function nodeGraphInactiveWireReads(plan) {
  const activeNodeIds = nodeGraphActiveNodeIds(plan);
  return {
    modulations: (plan.modulations || [])
      .filter((modulation) => !nodeGraphModulationIsActive(modulation, activeNodeIds))
      .map((modulation) => ({
        destination: `${modulation.destinationNode}.${modulation.destinationParam}`,
        reason: nodeGraphWireTouchesBypassed(modulation, plan) ? "bypassed" : "inactive",
        source: `${modulation.sourceNode}.${modulation.sourcePort}`,
      })),
    signals: (plan.connections || [])
      .filter((connection) => !nodeGraphSignalConnectionIsActive(connection, activeNodeIds))
      .map((connection) => ({
        destination: `${connection.destinationNode}.${connection.destinationPort}`,
        reason: nodeGraphWireTouchesBypassed(connection, plan) ? "bypassed" : "inactive",
        source: `${connection.sourceNode}.${connection.sourcePort}`,
      })),
  };
}

function nodeGraphExecutionWireReads(plan) {
  const feedbackSets = nodeGraphFeedbackIdentitySets(plan);
  return {
    modulations: nodeGraphActiveModulations(plan).map((modulation) => ({
      destination: `${modulation.destinationNode}.${modulation.destinationParam}`,
      mode: feedbackSets.modulation.has(nodeGraphModulationWireIdentity(modulation))
        ? "state-read"
        : "same-pass",
      source: `${modulation.sourceNode}.${modulation.sourcePort}`,
    })),
    signals: nodeGraphActiveSignalConnections(plan).map((connection) => ({
      destination: `${connection.destinationNode}.${connection.destinationPort}`,
      mode: feedbackSets.signal.has(nodeGraphSignalWireIdentity(connection))
        ? "state-read"
        : "same-pass",
      source: `${connection.sourceNode}.${connection.sourcePort}`,
    })),
  };
}

function nodeGraphExecutionWireRows(plan) {
  const feedbackSets = nodeGraphFeedbackIdentitySets(plan);
  const activeNodeIds = nodeGraphActiveNodeIds(plan);
  return [
    ...(plan.connections || []).map((connection, index) => {
      const isActive = nodeGraphSignalConnectionIsActive(connection, activeNodeIds);
      const isBypassed = nodeGraphWireTouchesBypassed(connection, plan);
      const isFeedback = feedbackSets.signal.has(nodeGraphSignalWireIdentity(connection));
      return {
        destination: `${connection.destinationNode}.${connection.destinationPort}`,
        index,
        kind: "signal",
        mode: isBypassed ? "bypassed" : !isActive ? "inactive" : isFeedback ? "state-read" : "same-pass",
        source: `${connection.sourceNode}.${connection.sourcePort}`,
      };
    }),
    ...(plan.modulations || []).map((modulation, index) => {
      const isActive = nodeGraphModulationIsActive(modulation, activeNodeIds);
      const isBypassed = nodeGraphWireTouchesBypassed(modulation, plan);
      const isFeedback = feedbackSets.modulation.has(nodeGraphModulationWireIdentity(modulation));
      return {
        destination: `${modulation.destinationNode}.${modulation.destinationParam}`,
        index,
        kind: "modulation",
        mode: isBypassed ? "bypassed" : !isActive ? "inactive" : isFeedback ? "state-read" : "same-pass",
        source: `${modulation.sourceNode}.${modulation.sourcePort}`,
      };
    }),
  ];
}

function nodeGraphWireModeHelp(mode) {
  switch (mode) {
    case "same-pass":
      return "same-pass: source already ran this frame";
    case "state-read":
      return "state-read: reads the stored previous output";
    case "bypassed":
      return "bypassed: compiler ignores the touched node or wire";
    case "inactive":
      return "inactive: not reachable from Output";
    default:
      return "unknown wire execution mode";
  }
}

function nodeGraphStateReadCount(plan) {
  return (plan.feedbackConnections?.length || 0) + (plan.feedbackModulations?.length || 0);
}

function nodeGraphStateReadText(count) {
  return count === 1 ? "1 state read" : `${count} state reads`;
}

function nodeGraphActiveNodeText(plan) {
  const patchNodeCount = plan.nodes?.length || 0;
  const activeNodeCount = plan.reachableNodes?.length || 0;
  const bypassedCount = plan.bypassedNodes?.length || 0;
  if (bypassedCount) {
    return `${activeNodeCount}/${patchNodeCount} active / ${bypassedCount} bypassed`;
  }
  return patchNodeCount > activeNodeCount
    ? `${activeNodeCount}/${patchNodeCount} active`
    : "";
}

function nodeGraphActiveWireCount(plan) {
  return nodeGraphActiveSignalConnections(plan).length + nodeGraphActiveModulations(plan).length;
}

function nodeGraphPatchWireCount(plan) {
  return (plan.connections?.length || 0) + (plan.modulations?.length || 0);
}

function nodeGraphActiveWireText(plan) {
  const patchWireCount = nodeGraphPatchWireCount(plan);
  const activeWireCount = nodeGraphActiveWireCount(plan);
  return patchWireCount > activeWireCount
    ? `${activeWireCount}/${patchWireCount} wires`
    : "";
}

function nodeGraphScheduleText(order, issues = [], feedbackConnections = [], feedbackModulations = []) {
  if (issues.length) {
    return `schedule blocked: ${issues.join(", ")}`;
  }
  const feedbackText = nodeGraphFeedbackText(feedbackConnections, feedbackModulations);
  const suffix = feedbackText ? ` / feedback: ${feedbackText}` : "";
  return order.length
    ? `schedule: ${order.map((node) => nodeGraphNodeDisplayName(node)).join(" -> ")}${suffix}`
    : "schedule missing";
}

function nodeGraphValidate() {
  const plan = compileNodeGraphExecutionPlan();
  return {
    issues: plan.issues,
    order: plan.order,
    scheduleText: nodeGraphScheduleText(
      plan.order,
      plan.issues,
      plan.feedbackConnections,
      plan.feedbackModulations,
    ),
    sourceNode: plan.sourceNodes[0] || "",
    sourceNodes: plan.sourceNodes,
    valid: plan.valid,
  };
}

function nodeGraphExecutionParameterSnapshot(plan) {
  const parametersByNode = {};
  const nodesById = new Map((plan.nodes || []).map((node) => [node.id, node]));
  for (const nodeId of plan.order || []) {
    const patchNode = nodesById.get(nodeId);
    const type = patchNode?.type || nodeGraphNodeType(nodeId);
    const definition = nodeGraphModuleDefinitions[type];
    const parameters = {};
    for (const parameter of definition?.parameters || []) {
      const metadata = nodeGraphReadPatchParameterMetadata(patchNode || nodeId, parameter.key);
      const value = nodeGraphReadPatchParameterValue(patchNode || nodeId, parameter.key);
      parameters[parameter.key] = {
        display: nodeGraphPatchChoiceLabel(metadata, value) ??
          formatNodeSliderCompactNumber(value),
        value,
      };
    }
    if (Object.keys(parameters).length) {
      parametersByNode[nodeId] = parameters;
    }
  }
  return parametersByNode;
}

function nodeGraphLastRenderDebug() {
  const rendered = nodeGraphMvp.rendered;
  if (!rendered) {
    return null;
  }
  const currentPatchFingerprint = nodeGraphPatchFingerprint();
  return {
    connectionCount: Number(rendered.connectionCount) || 0,
    clipCount: Number(rendered.clipCount) || 0,
    currentPatchFingerprint,
    durationSeconds: Number(rendered.durationSeconds) || 0,
    feedbackConnectionCount: Number(rendered.feedbackConnectionCount) || 0,
    feedbackModulationCount: Number(rendered.feedbackModulationCount) || 0,
    frames: Number(rendered.frames) || 0,
    matchesCurrentPatch: rendered.patchFingerprint === currentPatchFingerprint,
    modulationCount: Number(rendered.modulationCount) || 0,
    nodeCount: Number(rendered.nodeCount) || 0,
    patchFingerprint: rendered.patchFingerprint || "",
    peak: Number(rendered.peak) || 0,
    rms: Number(rendered.rms) || 0,
    sampleRate: Number(rendered.sampleRate) || nodeGraphMvp.sampleRate,
    stateReadCount: Number(rendered.stateReadCount) || 0,
  };
}

function nodeGraphRuntimeBoundaryDebug(plan) {
  return {
    authoringOnly: ["info", "grid", "visual", "bypassedNodes", "node gx/gy"],
    compiledRuntime: ["order", "active signal wires", "active modulation wires", "parameters", "wire read modes"],
    compilerFiltered: {
      bypassedNodes: [...(plan.bypassedNodes || [])],
      inactiveNodes: [...(plan.inactiveNodes || [])],
      inactiveWireReads: nodeGraphInactiveWireReads(plan),
    },
    invariant: "DSP nodes do not know patch authoring or display fields",
    visual: normalizeNodeGraphPatchVisual(nodeGraphMvp.patch.visual),
  };
}

function nodeGraphSoemdspObjectConcept(type) {
  switch (type) {
    case "osc":
      return "caller-owned oscillator DSP object";
    case "spiral":
      return "caller-owned JerobeamSpiral DSP object";
    case "noise":
      return "caller-owned noise DSP object";
    case "gain":
      return "caller-owned gain DSP object";
    case "bias":
      return "caller-owned bias DSP object";
    case "output":
      return "caller-owned output/audio sink";
    default:
      return "unsupported caller-owned DSP object";
  }
}

function nodeGraphSoemdspRuntimeMapping(plan) {
  const activeNodeIds = nodeGraphActiveNodeIds(plan);
  const feedbackSets = nodeGraphFeedbackIdentitySets(plan);
  const nodesById = new Map((plan.nodes || []).map((node) => [node.id, node]));
  const signalBindings = nodeGraphActiveSignalConnections(plan).map((connection) => ({
    destinationInput: `${connection.destinationNode}.${connection.destinationPort}`,
    readMode: feedbackSets.signal.has(nodeGraphSignalWireIdentity(connection))
      ? "stored output state read"
      : "same-pass buffer read",
    sourceOutput: `${connection.sourceNode}.${connection.sourcePort}`,
  }));
  const modulationBindings = nodeGraphActiveModulations(plan).map((modulation) => ({
    destinationParameter: `${modulation.destinationNode}.${modulation.destinationParam}`,
    readMode: feedbackSets.modulation.has(nodeGraphModulationWireIdentity(modulation))
      ? "stored output state read"
      : "same-pass buffer read",
    sourceOutput: `${modulation.sourceNode}.${modulation.sourcePort}`,
  }));

  return {
    bindingRole: "Binding syncs parameter/control memory; DSP objects do not know Circuit",
    circuitRole: "Circuit/patch describes nodes, parameters, and raw connections; it does not own concrete DSP objects",
    compilerRole: "Compiler filters authoring state and emits order, active wires, parameter bindings, and state-read edges",
    dspObjectRole: "Caller owns concrete DSP objects and invokes them in compiled order",
    mappedNodes: (plan.order || []).map((nodeId) => {
      const node = nodesById.get(nodeId);
      return {
        id: nodeId,
        objectConcept: nodeGraphSoemdspObjectConcept(node?.type),
        type: node?.type || "unknown",
      };
    }),
    nonRuntimePatchFields: ["info", "grid", "visual", "bypassedNodes", "node gx/gy", "paramMeta display hints"],
    parameterBindings: nodeGraphExecutionParameterSnapshot(plan),
    runtimeNodeIds: [...activeNodeIds],
    signalBindings,
    modulationBindings,
    stateReadEdges: {
      modulations: plan.feedbackModulations.map((modulation) =>
        `${modulation.sourceNode}.${modulation.sourcePort} -> ${modulation.destinationNode}.${modulation.destinationParam}`,
      ),
      signals: plan.feedbackConnections.map((connection) =>
        `${connection.sourceNode}.${connection.sourcePort} -> ${connection.destinationNode}.${connection.destinationPort}`,
      ),
    },
    status: plan.valid ? "mapping proof ready" : "mapping blocked by invalid patch",
  };
}

function nodeGraphSoemdspRuntimeSketch(plan) {
  const mapping = nodeGraphSoemdspRuntimeMapping(plan);
  const objectLines = mapping.mappedNodes.map((node) =>
    `// ${node.id}: ${node.objectConcept}`,
  );
  const signalLines = mapping.signalBindings.map((binding) =>
    `// signal ${binding.sourceOutput} -> ${binding.destinationInput} (${binding.readMode})`,
  );
  const modulationLines = mapping.modulationBindings.map((binding) =>
    `// mod ${binding.sourceOutput} -> ${binding.destinationParameter} (${binding.readMode})`,
  );
  return [
    "// soemdsp browser proof -> caller-owned C++ runtime sketch",
    "// Circuit/patch describes source data; it does not own these DSP objects.",
    ...objectLines,
    "Binding::apply(circuit, externalParameterMemory);",
    ...signalLines,
    ...modulationLines,
    "for (std::size_t frame = 0; frame < blockSize; ++frame) {",
    "  // read same-pass values when available; otherwise read stored node output",
    `  for (NodeId node : { ${plan.order.map((nodeId) => `\"${nodeId}\"`).join(", ")} }) {`,
    "    processCallerOwnedDspObject(node, externalParameterMemory, storedOutputs);",
    "  }",
    "}",
  ].join("\n");
}

function serializeNodeGraphExecutionPlanDebug(plan) {
  const samePassDependencies = {};
  for (const [nodeId, dependencies] of plan.orderDependencies.entries()) {
    if (dependencies.size) {
      samePassDependencies[nodeId] = [...dependencies];
    }
  }

  const signalInputs = {};
  const activeNodeIds = nodeGraphActiveNodeIds(plan);
  for (const [key, connections] of plan.inputConnections.entries()) {
    const activeConnections = connections.filter((connection) =>
      nodeGraphSignalConnectionIsActive(connection, activeNodeIds),
    );
    if (activeConnections.length) {
      signalInputs[key] = activeConnections.map((connection) =>
        `${connection.sourceNode}.${connection.sourcePort}`,
      );
    }
  }

  const modulationInputs = {};
  for (const [key, modulations] of plan.modulationConnections.entries()) {
    const activeModulations = modulations.filter((modulation) =>
      nodeGraphModulationIsActive(modulation, activeNodeIds),
    );
    if (activeModulations.length) {
      modulationInputs[key] = activeModulations.map((modulation) =>
        `${modulation.sourceNode}.${modulation.sourcePort}`,
      );
    }
  }

  return JSON.stringify(
    {
      activeNodeCount: plan.reachableNodes?.length || 0,
      activeWireCount: nodeGraphActiveWireCount(plan),
      bypassedNodes: plan.bypassedNodes || [],
      currentPatchFingerprint: nodeGraphPatchFingerprint(),
      executionModel: "single-pass stored-output",
      feedbackModulations: plan.feedbackModulations.map((modulation) =>
        `${modulation.sourceNode}.${modulation.sourcePort} -> ${modulation.destinationNode}.${modulation.destinationParam}`,
      ),
      feedbackSignals: plan.feedbackConnections.map((connection) =>
        `${connection.sourceNode}.${connection.sourcePort} -> ${connection.destinationNode}.${connection.destinationPort}`,
      ),
      inactiveNodes: plan.inactiveNodes || [],
      inactiveWireReads: nodeGraphInactiveWireReads(plan),
      issues: plan.issues,
      lastRender: nodeGraphLastRenderDebug(),
      modulationInputs,
      order: plan.valid ? plan.order : [],
      outputNode: plan.outputNode,
      patchNodeCount: plan.nodes?.length || 0,
      patchWireCount: nodeGraphPatchWireCount(plan),
      parameters: nodeGraphExecutionParameterSnapshot(plan),
      partialOrder: plan.valid ? [] : plan.order,
      runtimeBoundary: nodeGraphRuntimeBoundaryDebug(plan),
      schedulerPolicy: "same-pass acyclic edges; patch-node-order cycle-closing edges read stored outputs",
      samePassDependencies,
      signalInputs,
      soemdspMapping: nodeGraphSoemdspRuntimeMapping(plan),
      soemdspRuntimeSketch: nodeGraphSoemdspRuntimeSketch(plan),
      sourceNodes: plan.sourceNodes,
      stateReadCount: nodeGraphStateReadCount(plan),
      storedOutputInitialValue: 0,
      valid: plan.valid,
      wireReads: nodeGraphExecutionWireReads(plan),
    },
    null,
    2,
  );
}

function serializeNodeGraphExecutionPlanApiDebug(plan) {
  return {
    activeNodeCount: plan.reachableNodes?.length || 0,
    activeWireCount: nodeGraphActiveWireCount(plan),
    bypassedNodes: [...(plan.bypassedNodes || [])],
    currentPatchFingerprint: nodeGraphPatchFingerprint(),
    feedbackModulations: plan.feedbackModulations.map((modulation) =>
      `${modulation.sourceNode}.${modulation.sourcePort} -> ${modulation.destinationNode}.${modulation.destinationParam}`,
    ),
    feedbackSignals: plan.feedbackConnections.map((connection) =>
      `${connection.sourceNode}.${connection.sourcePort} -> ${connection.destinationNode}.${connection.destinationPort}`,
    ),
    inactiveNodes: plan.inactiveNodes || [],
    issues: [...plan.issues],
    lastRender: nodeGraphLastRenderDebug(),
    order: [...plan.order],
    patchNodeCount: plan.nodes?.length || 0,
    patchWireCount: nodeGraphPatchWireCount(plan),
    runtimeBoundary: nodeGraphRuntimeBoundaryDebug(plan),
    samePassDependencies: [...plan.orderDependencies.entries()].reduce(
      (dependencies, [node, sources]) => ({
        ...dependencies,
        [node]: [...sources],
      }),
      {},
    ),
    schedulerPolicy: "same-pass acyclic edges; patch-node-order cycle-closing edges read stored outputs",
    soemdspMapping: nodeGraphSoemdspRuntimeMapping(plan),
    soemdspRuntimeSketch: nodeGraphSoemdspRuntimeSketch(plan),
    stateReadCount: nodeGraphStateReadCount(plan),
    valid: plan.valid,
    wireReads: nodeGraphExecutionWireReads(plan),
  };
}

function installNodeGraphDebugApi() {
  window.soemdspSandboxDebug = Object.freeze({
    compileExecutionPlan(patch = nodeGraphMvp.patch) {
      return serializeNodeGraphExecutionPlanApiDebug(compileValidatedNodeGraphExecutionPlan(patch));
    },
    currentPatchFingerprint() {
      return nodeGraphPatchFingerprint();
    },
    lastRender() {
      return nodeGraphLastRenderDebug();
    },
    live() {
      return nodeGraphLiveDebug();
    },
    async startMockInput(options = {}) {
      return startNodeGraphMockInput(options);
    },
    stopMockInput() {
      stopNodeGraphMockInput();
      return nodeGraphLiveDebug();
    },
    soemdspMapping(patch = nodeGraphMvp.patch) {
      return nodeGraphSoemdspRuntimeMapping(compileValidatedNodeGraphExecutionPlan(patch));
    },
    soemdspRuntimeSketch(patch = nodeGraphMvp.patch) {
      return nodeGraphSoemdspRuntimeSketch(compileValidatedNodeGraphExecutionPlan(patch));
    },
  });
}

async function startNodeGraphMockInputDebug(options = {}) {
  document.documentElement.dataset.soemdspMockInput = "starting";
  document.documentElement.dataset.soemdspMockInputError = "";
  try {
    await startNodeGraphMockInput(options);
    await new Promise((resolve) => setTimeout(resolve, 250));
    document.documentElement.dataset.soemdspMockInput = "running";
    document.documentElement.dataset.soemdspMockInputMeter =
      document.getElementById("nodeLiveInputMeter")?.textContent || "";
  } catch (error) {
    document.documentElement.dataset.soemdspMockInput = "error";
    document.documentElement.dataset.soemdspMockInputError = error?.message || String(error);
  }
}

function stopNodeGraphMockInputDebug() {
  stopNodeGraphMockInput();
  document.documentElement.dataset.soemdspMockInput = "stopped";
  document.documentElement.dataset.soemdspMockInputMeter =
    document.getElementById("nodeLiveInputMeter")?.textContent || "";
}

function nodeGraphPortSelector(node, port, io) {
  return `.node-port.${io}[data-node="${CSS.escape(node)}"][data-port="${CSS.escape(port)}"]`;
}

function nodeGraphModulationPortSelector(node, parameter) {
  return `.node-param-port.modulation-input[data-node="${CSS.escape(node)}"][data-param="${CSS.escape(parameter)}"]`;
}

function markNodeGraphPortConnected(node, port, io) {
  nodeGraphZoomSurface()
    ?.querySelector(nodeGraphPortSelector(node, port, io))
    ?.classList.add("connected-port");
}

function markNodeGraphModulationPortConnected(node, parameter) {
  nodeGraphZoomSurface()
    ?.querySelector(nodeGraphModulationPortSelector(node, parameter))
    ?.classList.add("connected-port");
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
  applyNodeGraphWorkspaceView();
  updateNodeGraphGridHeatmap();
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

function setNodeGraphZoom(nextZoom, anchor = null) {
  const workspace = document.getElementById("nodeGraphWorkspace");
  const workspaceRect = workspace?.getBoundingClientRect();
  const oldZoom = nodeGraphZoom();
  const oldPan = nodeGraphMvp.pan || { x: 0, y: 0 };
  const anchorPoint = workspaceRect
    ? (anchor || {
      x: workspaceRect.left + workspaceRect.width / 2,
      y: workspaceRect.top + workspaceRect.height / 2,
    })
    : null;
  const anchoredContentPoint = workspaceRect && anchorPoint
    ? {
      x: (anchorPoint.x - workspaceRect.left - (Number(oldPan.x) || 0)) / oldZoom,
      y: (anchorPoint.y - workspaceRect.top - (Number(oldPan.y) || 0)) / oldZoom,
    }
    : null;
  const zoom = Math.max(
    nodeGraphZoomLimits.min,
    Math.min(nodeGraphZoomLimits.max, Number(nextZoom) || 1),
  );
  if (Math.abs(zoom - oldZoom) < 0.001) {
    return;
  }
  nodeGraphMvp.zoom = zoom;
  const nextPan = workspaceRect && anchorPoint && anchoredContentPoint
    ? {
      x: anchorPoint.x - workspaceRect.left - anchoredContentPoint.x * zoom,
      y: anchorPoint.y - workspaceRect.top - anchoredContentPoint.y * zoom,
    }
    : oldPan;
  nodeGraphMvp.pan = {
    x: Number(nextPan.x) || 0,
    y: Number(nextPan.y) || 0,
  };
  applyNodeGraphZoom();
  applyNodeGraphPan();
}

function nodeGraphZoomByRatio(ratio) {
  const value = Number(ratio);
  return Number.isFinite(value) && value > 0
    ? nodeGraphZoom() * value
    : nodeGraphZoom();
}

function zoomNodeGraphBy(delta) {
  const ratio = delta > 0
    ? nodeGraphZoomLimits.wheelRatio
    : 1 / nodeGraphZoomLimits.wheelRatio;
  setNodeGraphZoom(nodeGraphZoomByRatio(ratio));
}

function zoomNodeGraphAt(delta, clientX, clientY) {
  const ratio = delta > 0
    ? nodeGraphZoomLimits.wheelRatio
    : 1 / nodeGraphZoomLimits.wheelRatio;
  setNodeGraphZoom(nodeGraphZoomByRatio(ratio), { x: clientX, y: clientY });
}

function handleNodeGraphWorkspaceWheel(event) {
  if (!event.deltaY) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  zoomNodeGraphAt(
    -Math.sign(event.deltaY),
    event.clientX,
    event.clientY,
  );
}

function beginNodeGraphSmoothZoomDrag(event) {
  const ctrlZoom = event.ctrlKey;
  const altZoom = event.altKey;
  if (
    event.button !== 1 ||
    (!ctrlZoom && !altZoom)
  ) {
    return;
  }

  const workspace = event.currentTarget;
  nodeGraphMvp.smoothZoomDragging = {
    anchor: { x: event.clientX, y: event.clientY },
    pointerId: event.pointerId,
    startClientY: event.clientY,
    startZoom: nodeGraphZoom(),
  };
  workspace.classList.add("smooth-zooming");
  workspace.setPointerCapture(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function dragNodeGraphSmoothZoom(event) {
  const drag = nodeGraphMvp.smoothZoomDragging;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }

  const deltaY = drag.startClientY - event.clientY;
  const ratio = Math.exp(deltaY * 0.0045);
  setNodeGraphZoom(drag.startZoom * ratio, drag.anchor);
  event.preventDefault();
  event.stopPropagation();
}

function endNodeGraphSmoothZoomDrag(event) {
  const drag = nodeGraphMvp.smoothZoomDragging;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }

  const workspace = document.getElementById("nodeGraphWorkspace");
  if (workspace?.hasPointerCapture?.(event.pointerId)) {
    workspace.releasePointerCapture(event.pointerId);
  }
  workspace?.classList.remove("smooth-zooming");
  nodeGraphMvp.smoothZoomDragging = null;
  event.preventDefault();
  event.stopPropagation();
}

function applyNodeGraphPan() {
  const workspace = document.getElementById("nodeGraphWorkspace");
  if (!workspace) {
    return;
  }
  const pan = nodeGraphMvp.pan || { x: 0, y: 0 };
  workspace.style.setProperty("--node-graph-pan-x", `${pan.x}px`);
  workspace.style.setProperty("--node-graph-pan-y", `${pan.y}px`);
  workspace.dataset.panX = String(Math.round(pan.x));
  workspace.dataset.panY = String(Math.round(pan.y));
  updateNodeGraphGridHeatmap();
  drawNodeGraphWires();
}

function setNodeGraphPan(x, y) {
  nodeGraphMvp.pan = {
    x: Number.isFinite(Number(x)) ? Number(x) : 0,
    y: Number.isFinite(Number(y)) ? Number(y) : 0,
  };
  applyNodeGraphPan();
}

function snapNodeGraphWorkspaceEdgesToGrid(zoom = nodeGraphZoom()) {
  const workspace = document.getElementById("nodeGraphWorkspace");
  if (!workspace) {
    return;
  }
  const rect = workspace.getBoundingClientRect();
  const chromeWidth = nodeGraphWorkspaceChromeSize("x");
  const chromeHeight = nodeGraphWorkspaceChromeSize("y");
  const contentWidth = Math.max(0, rect.width - chromeWidth);
  const contentHeight = Math.max(0, rect.height - chromeHeight);
  const renderedGridWidth = nodeGraphGridWidth() * zoom;
  const renderedGridHeight = nodeGraphGridHeight() * zoom;
  const snapContentSize = (value, step, minGridUnits) => {
    if (!Number.isFinite(step) || step <= 0) {
      return value;
    }
    const min = step * minGridUnits;
    return Math.max(min, Math.round(value / step) * step);
  };
  const snappedContentWidth = snapContentSize(
    contentWidth,
    renderedGridWidth,
    nodeGraphWorkspaceViewLimits.minWidthGu,
  );
  const snappedContentHeight = snapContentSize(
    contentHeight,
    renderedGridHeight,
    nodeGraphWorkspaceViewLimits.minHeightGu,
  );
  withNodeGraphWorkspaceContentAnchored(workspace, () => {
    const widthCss = nodeGraphWorkspaceWidthCss(snappedContentWidth);
    const heightCss = nodeGraphWorkspaceHeightCss(snappedContentHeight);
    if (document.getElementById("nodeWiringPanel")?.classList.contains("modular-only-view")) {
      workspace.style.setProperty("--node-modular-only-view-width", widthCss);
      workspace.style.setProperty("--node-modular-only-view-height", heightCss);
    } else {
      workspace.style.width = widthCss;
      workspace.style.height = heightCss;
      workspace.style.removeProperty("aspect-ratio");
    }
  });
  drawNodeGraphWires();
}

function snapNodeGraphPanValueToGrid(value, gridSize, zoom = nodeGraphZoom()) {
  const step = gridSize * zoom;
  return Number.isFinite(step) && step > 0
    ? Math.round((Number(value) || 0) / step) * step
    : Number(value) || 0;
}

function renderNodeGraphSnapGridButton() {
  const button = document.getElementById("nodeSnapGridViewButton");
  if (!button) {
    return;
  }
  const active = Boolean(nodeGraphMvp.snapGridWhilePanning);
  button.classList.toggle("active", active);
  button.setAttribute("aria-pressed", String(active));
  button.title = nodeGraphTooltipText("view.snapGrid");
}

function alignNodeGraphViewToGridWithOptions(options = {}) {
  const workspace = document.getElementById("nodeGraphWorkspace");
  const rect = workspace?.getBoundingClientRect();
  const oldZoom = nodeGraphZoom();
  const oldPan = nodeGraphMvp.pan || { x: 0, y: 0 };
  const zoomStep = 1 / Math.max(1, nodeGraphGridSize());
  const nextZoom = Math.max(
    nodeGraphZoomLimits.min,
    Math.min(nodeGraphZoomLimits.max, Math.round(oldZoom / zoomStep) * zoomStep),
  );
  const anchor = rect
    ? {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
    : null;
  const anchoredContentPoint = rect && anchor
    ? {
      x: (anchor.x - rect.left - (Number(oldPan.x) || 0)) / oldZoom,
      y: (anchor.y - rect.top - (Number(oldPan.y) || 0)) / oldZoom,
    }
    : null;
  nodeGraphMvp.zoom = nextZoom;
  applyNodeGraphZoom();
  if (options.snapWorkspaceEdges) {
    snapNodeGraphWorkspaceEdgesToGrid(nextZoom);
  }
  const nextRect = workspace?.getBoundingClientRect();
  const nextAnchor = nextRect
    ? {
      x: nextRect.left + nextRect.width / 2,
      y: nextRect.top + nextRect.height / 2,
    }
    : anchor;
  const unsnappedPan = nextRect && nextAnchor && anchoredContentPoint
    ? {
      x: nextAnchor.x - nextRect.left - anchoredContentPoint.x * nextZoom,
      y: nextAnchor.y - nextRect.top - anchoredContentPoint.y * nextZoom,
    }
    : oldPan;
  const snapPan = (value, gridSize) => snapNodeGraphPanValueToGrid(value, gridSize, nextZoom);
  nodeGraphMvp.pan = {
    x: snapPan(unsnappedPan.x, nodeGraphGridWidth()),
    y: snapPan(unsnappedPan.y, nodeGraphGridHeight()),
  };
  applyNodeGraphPan();
  setNodeInteractionHelp(options.snapWorkspaceEdges
    ? "View snapped to complete grid cells."
    : "View aligned to grid. Hotkey: Ctrl+Shift+G.");
}

function alignNodeGraphViewToGrid() {
  alignNodeGraphViewToGridWithOptions();
}

function snapNodeGraphViewToGrid() {
  alignNodeGraphViewToGridWithOptions({ snapWorkspaceEdges: true });
}

function handleNodeGraphSnapGridButtonClick(event) {
  if (event.shiftKey) {
    nodeGraphMvp.snapGridWhilePanning = !nodeGraphMvp.snapGridWhilePanning;
    renderNodeGraphSnapGridButton();
    setNodeInteractionHelp(nodeGraphMvp.snapGridWhilePanning
      ? "Grid snap while moving is on."
      : "Grid snap while moving is off.");
    return;
  }
  snapNodeGraphViewToGrid();
}

function nodeGraphPortCenter(node, port, io) {
  const surface = nodeGraphZoomSurface();
  const element = surface.querySelector(nodeGraphPortSelector(node, port, io));
  return nodeGraphElementCenter(element, io);
}

function nodeGraphModulationPortCenter(node, parameter) {
  const surface = nodeGraphZoomSurface();
  const element = surface.querySelector(nodeGraphModulationPortSelector(node, parameter));
  return nodeGraphElementCenter(element, "modulation");
}

function nodeGraphElementCenter(element, io = null) {
  const surface = nodeGraphZoomSurface();
  if (!element) {
    return { x: 0, y: 0 };
  }

  const surfaceRect = surface.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const zoom = nodeGraphZoom();
  const centerX = elementRect.left + elementRect.width / 2;
  const elementStyle = getComputedStyle(element);
  const patchPointRatio = Math.max(
    0,
    Number.parseFloat(elementStyle.getPropertyValue("--node-wire-patch-point-size-ratio")) ||
      nodeGraphDefaultPatchPointSizeRatio,
  );
  const portDiameter = Number.parseFloat(elementStyle.getPropertyValue("--node-port-diameter"))
    || Math.max(elementRect.width, elementRect.height);
  const patchPointOverlap = (portDiameter * patchPointRatio) / 2;
  const anchorX = io === "output"
    ? elementRect.right - patchPointOverlap
    : io === "input" || io === "modulation"
      ? elementRect.left + patchPointOverlap
      : centerX;
  return {
    x: (anchorX - surfaceRect.left) / zoom,
    y: (elementRect.top + elementRect.height / 2 - surfaceRect.top) / zoom,
  };
}

function setNodeGraphSelection(selection) {
  nodeGraphMvp.selected = selection;
  renderNodeGraphSelection();
}

function clearNodeGraphSelection() {
  setNodeGraphSelection(null);
}

function handleNodeGraphEnvironmentCommand(event) {
  if (event.detail?.command === "clear-selection") {
    clearNodeGraphSelection();
  }
}

function sendNodeGraphEnvironmentCommand(command) {
  document.getElementById("nodeGraphWorkspace")?.dispatchEvent(
    new CustomEvent("nodegraph:environment-command", {
      bubbles: false,
      detail: { command },
    }),
  );
}

function handleNodeGraphDocumentClick(event) {
  const target = event.target;
  if (
    !(target instanceof Element) ||
    target.closest("#nodeGraphWorkspace, #nodeSceneContextMenu, #nodeParameterMetadataPopover")
  ) {
    return;
  }
  sendNodeGraphEnvironmentCommand("clear-selection");
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

function nodeGraphSingleSelectedNodeId(selection = nodeGraphMvp.selected) {
  const selectedNodeIds = [...nodeGraphSelectedNodeIds(selection)];
  return selectedNodeIds.length === 1 ? selectedNodeIds[0] : null;
}

function nodeGraphModuleActionTargetNodeId() {
  const contextNode = nodeGraphMvp.sceneContextTargetNode;
  if (contextNode && nodeGraphPatchNode(contextNode)) {
    return contextNode;
  }
  const selectedNode = nodeGraphSingleSelectedNodeId();
  if (selectedNode && nodeGraphPatchNode(selectedNode)) {
    return selectedNode;
  }
  return null;
}

function syncNodeGraphModuleActionTargetFromSelection() {
  const menu = document.getElementById("nodeSceneContextMenu");
  if (!menu || menu.hidden || menu.dataset.mode === "add") {
    return;
  }
  const selectedWire = nodeGraphWireFromSelection();
  if (selectedWire) {
    nodeGraphMvp.sceneContextTargetWire = {
      index: selectedWire.index,
      kind: selectedWire.kind,
    };
    nodeGraphMvp.sceneContextTargetNode = null;
    configureNodeSceneContextMenu("wire");
    return;
  }
  const selectedNode = nodeGraphSingleSelectedNodeId();
  if (selectedNode && nodeGraphPatchNode(selectedNode)) {
    nodeGraphMvp.sceneContextTargetNode = selectedNode;
    nodeGraphMvp.sceneContextTargetWire = null;
    configureNodeSceneContextMenu("module");
  } else {
    const selectedNodeIds = nodeGraphSelectedNodeIds();
    if (selectedNodeIds.size > 1) {
      nodeGraphMvp.sceneContextTargetNode = null;
      nodeGraphMvp.sceneContextTargetWire = null;
      configureNodeSceneContextMenu("module");
    }
  }
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

function selectAllNodeGraphModules() {
  setNodeGraphNodeSelection(nodeGraphMvp.patch.nodes.map((node) => node.id));
}

function toggleNodeGraphNodeSelection(id, additive = false) {
  if (!nodeGraphMvp.activeNodes.has(id)) {
    return;
  }
  if (!additive) {
    if (nodeGraphSelectedNodeIds().has(id)) {
      setNodeGraphSelection(null);
    } else {
      setNodeGraphNodeSelection([id]);
    }
    return;
  }

  const selectedNodeIds = nodeGraphSelectedNodeIds();
  if (selectedNodeIds.has(id)) {
    selectedNodeIds.delete(id);
  } else {
    selectedNodeIds.add(id);
  }
  setNodeGraphNodeSelection([...selectedNodeIds]);
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

function nodeGraphWireSelectionExists(selection = nodeGraphMvp.selected) {
  if (selection?.type !== "wire") {
    return false;
  }
  const index = Number(selection.index);
  const wires = (selection.kind || "signal") === "modulation"
    ? nodeGraphMvp.modulations
    : nodeGraphMvp.connections;
  return Number.isInteger(index) && index >= 0 && index < wires.length;
}

function nodeGraphWireFromSelection(selection = nodeGraphMvp.selected) {
  if (!nodeGraphWireSelectionExists(selection)) {
    return null;
  }
  const kind = selection.kind || "signal";
  const wire = kind === "modulation"
    ? nodeGraphMvp.modulations[selection.index]
    : nodeGraphMvp.connections[selection.index];
  return { kind, index: selection.index, wire };
}

function nodeGraphWireSelectionLabel(selection = nodeGraphMvp.selected) {
  const selectedWire = nodeGraphWireFromSelection(selection);
  if (!selectedWire) {
    return "none";
  }
  const { kind, wire } = selectedWire;
  if (kind === "modulation") {
    return `${nodeGraphLabel(wire.sourceNode, wire.sourcePort)} -> ${nodeGraphLabel(
      wire.destinationNode,
      wire.destinationParam,
    )} mod`;
  }
  return `${nodeGraphLabel(wire.sourceNode, wire.sourcePort)} -> ${nodeGraphLabel(
    wire.destinationNode,
    wire.destinationPort,
  )}`;
}

function nodeGraphNodeCanBeDeleted(node) {
  return Boolean(node && node.type !== "output");
}

function nodeGraphNodeDeleteHidesOnly(node) {
  return node?.type === "audioInput";
}

function nodeGraphSelectionCanDelete(selection = nodeGraphMvp.selected) {
  if (!selection) {
    return false;
  }
  if (selection.type === "wire") {
    return nodeGraphWireSelectionExists(selection);
  }
  return [...nodeGraphSelectedNodeIds(selection)].some((id) => {
    const node = nodeGraphPatchNode(id);
    return nodeGraphMvp.activeNodes.has(id) && nodeGraphNodeCanBeDeleted(node);
  });
}

function nodeGraphDeleteTitle(selection = nodeGraphMvp.selected) {
  if (!selection) {
    return nodeGraphTooltipText("actions.deleteNothing");
  }
  if (selection.type === "wire") {
    return nodeGraphWireSelectionExists(selection)
      ? nodeGraphTooltipText("actions.deleteWireShort")
      : nodeGraphTooltipText("actions.deleteWireMissing");
  }
  const selectedNodeIds = nodeGraphSelectedNodeIds(selection);
  if (!selectedNodeIds.size) {
    return nodeGraphTooltipText("actions.deleteNothing");
  }
  if ([...selectedNodeIds].every((id) => id === "output")) {
    return nodeGraphTooltipText("actions.deleteUnavailableOutput");
  }
  return selectedNodeIds.size === 1
    ? nodeGraphTooltipText("actions.deleteModuleShort")
    : nodeGraphTooltipText("actions.deleteModulesShort");
}

function pruneNodeGraphSelectionAfterPatch() {
  const selection = nodeGraphMvp.selected;
  if (!selection) {
    return;
  }
  if (selection.type === "wire") {
    if (!nodeGraphWireSelectionExists(selection)) {
      setNodeGraphSelection(null);
    }
    return;
  }

  const selectedNodeIds = nodeGraphSelectedNodeIds(selection);
  if (!selectedNodeIds.size) {
    setNodeGraphSelection(null);
    return;
  }
  const activeSelectedNodes = [...selectedNodeIds].filter((id) =>
    nodeGraphMvp.activeNodes.has(id),
  );
  if (activeSelectedNodes.length !== selectedNodeIds.size) {
    setNodeGraphNodeSelection(activeSelectedNodes);
  }
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
  renderNodeGraphExecutionSummarySelection();

  const button = document.getElementById("nodeDeleteButton");
  button.disabled = !nodeGraphSelectionCanDelete();
  button.title = nodeGraphDeleteTitle();

  syncNodeGraphModuleActionTargetFromSelection();
  setNodeInteractionHelp(nodeInteractionHelpText(document.activeElement));
}

function selectNodeGraphWire(event, index, kind = "signal") {
  event.stopPropagation();
  setNodeGraphSelection({ type: "wire", kind, index });
}

function nodeGraphCssColor(property, fallback) {
  const workspace = document.getElementById("nodeGraphWorkspace");
  const value = workspace
    ? getComputedStyle(workspace).getPropertyValue(property).trim()
    : "";
  return value || fallback;
}

function nodeGraphPortWireColor(node, port, io) {
  if (io === "input") {
    return nodeGraphCssColor("--node-input-fill", "#7fc7d9");
  }
  if (io === "modulation") {
    return nodeGraphCssColor("--node-mod-input-fill", "#b184ff");
  }
  if (nodeGraphParameterOutputPort(nodeGraphPatchNodeType(node), port)) {
    return nodeGraphCssColor("--node-param-output-fill", "#66e0a3");
  }
  return nodeGraphCssColor("--node-output-fill", "#e2a86d");
}

function drawNodeGraphWires() {
  const workspace = nodeGraphZoomSurface();
  const svg = document.getElementById("nodeWireSvg");
  if (!workspace || !svg) {
    return;
  }
  updateNodeGraphGridHeatmap();
  const plan = compileNodeGraphExecutionPlan();
  const feedbackSets = nodeGraphFeedbackIdentitySets(plan);
  const activeNodeIds = nodeGraphActiveNodeIds(plan);

  const graphRect = nodeGraphGraphRect();
  svg.setAttribute("viewBox", `0 0 ${graphRect.width} ${graphRect.height}`);
  svg.replaceChildren();
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  svg.append(defs);

  for (const node of workspace.querySelectorAll(".dsp-node")) {
    node.classList.remove("connected");
  }
  for (const port of workspace.querySelectorAll(".node-port, .node-param-port")) {
    port.classList.remove("connected-port");
  }

  for (const [index, connection] of nodeGraphMvp.connections.entries()) {
    if (
      !nodeGraphMvp.activeNodes.has(connection.sourceNode) ||
      !nodeGraphMvp.activeNodes.has(connection.destinationNode) ||
      !nodeGraphPatchNodeIsVisible(connection.sourceNode) ||
      !nodeGraphPatchNodeIsVisible(connection.destinationNode)
    ) {
      continue;
    }

    const from = nodeGraphPortCenter(connection.sourceNode, connection.sourcePort, "output");
    const to = nodeGraphPortCenter(
      connection.destinationNode,
      connection.destinationPort,
      "input",
    );
    const isFeedback = feedbackSets.signal.has(nodeGraphSignalWireIdentity(connection));
    const isInactive = !nodeGraphSignalConnectionIsActive(connection, activeNodeIds);
    const isBypassed = nodeGraphWireTouchesBypassed(connection, plan);
    const mode = isBypassed ? "bypassed" : isInactive ? "inactive" : isFeedback ? "state-read" : "same-pass";
    nodeGraphWireHelpers.drawPath(svg, {
      alias: `${nodeGraphLabel(connection.sourceNode, connection.sourcePort)} -> ${nodeGraphLabel(
        connection.destinationNode,
        connection.destinationPort,
      )}`,
      from,
      gradientId: `node-wire-gradient-${index}`,
      index,
      kind: "signal",
      mode,
      pathClass: [
        "node-wire-path",
        isFeedback ? "state-read" : "",
        isInactive ? "inactive-wire" : "",
      ].filter(Boolean).join(" "),
      to,
      wireColors: [
        nodeGraphPortWireColor(connection.sourceNode, connection.sourcePort, "output"),
        nodeGraphPortWireColor(connection.destinationNode, connection.destinationPort, "input"),
      ],
    });

    nodeGraphNodeElement(connection.sourceNode)?.classList.add("connected");
    nodeGraphNodeElement(connection.destinationNode)?.classList.add("connected");
    markNodeGraphPortConnected(connection.sourceNode, connection.sourcePort, "output");
    markNodeGraphPortConnected(connection.destinationNode, connection.destinationPort, "input");
  }

  for (const [index, modulation] of nodeGraphMvp.modulations.entries()) {
    if (
      !nodeGraphMvp.activeNodes.has(modulation.sourceNode) ||
      !nodeGraphMvp.activeNodes.has(modulation.destinationNode) ||
      !nodeGraphPatchNodeIsVisible(modulation.sourceNode) ||
      !nodeGraphPatchNodeIsVisible(modulation.destinationNode)
    ) {
      continue;
    }

    const from = nodeGraphPortCenter(modulation.sourceNode, modulation.sourcePort, "output");
    const to = nodeGraphModulationPortCenter(
      modulation.destinationNode,
      modulation.destinationParam,
    );
    const isFeedback = feedbackSets.modulation.has(nodeGraphModulationWireIdentity(modulation));
    const isInactive = !nodeGraphModulationIsActive(modulation, activeNodeIds);
    const isBypassed = nodeGraphWireTouchesBypassed(modulation, plan);
    const mode = isBypassed ? "bypassed" : isInactive ? "inactive" : isFeedback ? "state-read" : "same-pass";
    nodeGraphWireHelpers.drawPath(svg, {
      alias: `${nodeGraphLabel(modulation.sourceNode, modulation.sourcePort)} -> ${nodeGraphNodeDisplayName(
        modulation.destinationNode,
      )}.${modulation.destinationParam} mod`,
      from,
      gradientClass: "node-modulation-wire-gradient-stop",
      gradientId: `node-modulation-wire-gradient-${index}`,
      index,
      kind: "modulation",
      mode,
      pathClass: [
        "node-wire-path",
        "node-modulation-wire-path",
        isInactive ? "inactive-wire" : "",
      ].filter(Boolean).join(" "),
      to,
      wireColors: [
        nodeGraphPortWireColor(modulation.sourceNode, modulation.sourcePort, "output"),
        nodeGraphPortWireColor(modulation.destinationNode, modulation.destinationParam, "modulation"),
      ],
    });

    nodeGraphNodeElement(modulation.sourceNode)?.classList.add("connected");
    nodeGraphNodeElement(modulation.destinationNode)?.classList.add("connected");
    markNodeGraphPortConnected(modulation.sourceNode, modulation.sourcePort, "output");
    markNodeGraphModulationPortConnected(modulation.destinationNode, modulation.destinationParam);
  }

  if (nodeGraphMvp.dragging) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const stroke = nodeGraphWireHelpers.createGradient(
      svg,
      "node-wire-gradient-temp",
      nodeGraphMvp.dragging.from,
      nodeGraphMvp.dragging.to,
      "node-wire-gradient-stop",
      [
        nodeGraphPortWireColor(
          nodeGraphMvp.dragging.endpoint.node,
          nodeGraphMvp.dragging.endpoint.port,
          nodeGraphMvp.dragging.endpoint.io,
        ),
        "rgba(243, 241, 236, 0.44)",
      ],
    );
    path.setAttribute("class", "node-wire-path temp");
    path.setAttribute("stroke", stroke);
    path.setAttribute(
      "d",
      nodeGraphWireHelpers.path(nodeGraphMvp.dragging.from, nodeGraphMvp.dragging.to),
    );
    svg.append(path);
  }

  renderNodeGraphSelection();
}

function renderNodeGraphConnectionList() {
  const plan = compileNodeGraphExecutionPlan();
  const validation = {
    issues: plan.issues,
    scheduleText: nodeGraphScheduleText(
      plan.order,
      plan.issues,
      plan.feedbackConnections,
      plan.feedbackModulations,
    ),
    sourceNodes: plan.sourceNodes,
    valid: plan.valid,
  };
  const list = document.getElementById("nodeConnectionList");
  const status = document.getElementById("nodeGraphStatus");
  const source = document.getElementById("nodeGraphSource");
  const validationPill = document.getElementById("nodeGraphValidation");
  const feedbackSets = nodeGraphFeedbackIdentitySets(plan);
  const activeNodeIds = nodeGraphActiveNodeIds(plan);

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
    const isFeedback = feedbackSets.signal.has(nodeGraphSignalWireIdentity(connection));
    const isInactive = !nodeGraphSignalConnectionIsActive(connection, activeNodeIds);
    const isBypassed = nodeGraphWireTouchesBypassed(connection, plan);
    label.textContent = `${nodeGraphLabel(connection.sourceNode, connection.sourcePort)} -> ${nodeGraphLabel(
      connection.destinationNode,
      connection.destinationPort,
    )}${isFeedback ? " (state read)" : ""}${isBypassed ? " (bypassed)" : isInactive ? " (inactive)" : ""}`;
    item.classList.toggle("state-read", isFeedback);
    item.classList.toggle("inactive-wire", isInactive);
    const button = document.createElement("button");
    button.className = "disconnect-wire-button";
    button.type = "button";
    button.textContent = "Disconnect";
    button.dataset.connectionIndex = String(index);
    button.dataset.connectionKind = "signal";
    button.setAttribute("aria-label", `Disconnect ${label.textContent}`);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      disconnectNodeGraphConnection(index, "signal");
    });
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
    const isFeedback = feedbackSets.modulation.has(nodeGraphModulationWireIdentity(modulation));
    const isInactive = !nodeGraphModulationIsActive(modulation, activeNodeIds);
    const isBypassed = nodeGraphWireTouchesBypassed(modulation, plan);
    label.textContent = `${nodeGraphLabel(modulation.sourceNode, modulation.sourcePort)} -> ${nodeGraphNodeDisplayName(
      modulation.destinationNode,
    )}.${modulation.destinationParam} mod${isFeedback ? " (state read)" : ""}${isBypassed ? " (bypassed)" : isInactive ? " (inactive)" : ""}`;
    item.classList.toggle("state-read", isFeedback);
    item.classList.toggle("inactive-wire", isInactive);
    const button = document.createElement("button");
    button.className = "disconnect-wire-button";
    button.type = "button";
    button.textContent = "Disconnect";
    button.dataset.connectionIndex = String(index);
    button.dataset.connectionKind = "modulation";
    button.setAttribute("aria-label", `Disconnect ${label.textContent}`);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      disconnectNodeGraphConnection(index, "modulation");
    });
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

  const renderButton = document.getElementById("nodeRenderButton");
  renderButton.disabled = !validation.valid;
  renderButton.title = validation.valid
    ? "Render current patch sample"
    : `Render blocked: ${validation.issues.join(", ")}`;
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
  const selection = nodeGraphMvp.selected;
  if (sameNodeGraphSelection(selection, { type: "wire", kind, index })) {
    setNodeGraphSelection(null);
  } else if (selection?.type === "wire" && (selection.kind || "signal") === kind && selection.index > index) {
    setNodeGraphSelection({ ...selection, index: selection.index - 1 });
  }
  commitNodeGraphPatch(patch, { status: "wire disconnected" });
}

function toggleNodeGraphModuleBypass(event) {
  if (!nodeGraphScriptReadyForGraphAction("bypass")) {
    return;
  }
  const button = event.currentTarget;
  const node = button.closest(".dsp-node");
  const nodeId = node?.dataset.node;
  if (nodeId === "output") {
    toggleNodeGraphLiveOutput();
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (!nodeId || !nodeGraphMvp.activeNodes.has(nodeId)) {
    return;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const bypassed = new Set(patch.bypassedNodes || []);
  if (bypassed.has(nodeId)) {
    bypassed.delete(nodeId);
  } else {
    bypassed.add(nodeId);
  }
  patch.bypassedNodes = [...bypassed];
  commitNodeGraphPatch(patch, {
    status: bypassed.has(nodeId) ? "module bypassed" : "module active",
  });
  event.preventDefault();
  event.stopPropagation();
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

function burstNodeGraphZap(point) {
  const surface = nodeGraphZoomSurface();
  if (!surface || !point) {
    return;
  }
  const colors = [
    ["#7fc7d9", "rgba(127, 199, 217, 0.7)"],
    ["#e2a86d", "rgba(226, 168, 109, 0.72)"],
    ["#ff6b6b", "rgba(255, 107, 107, 0.72)"],
  ];
  for (let index = 0; index < 8; index += 1) {
    const [color, glow] = colors[index % colors.length];
    const particle = document.createElement("span");
    particle.className = "node-zap-particle";
    particle.textContent = "\u2301";
    particle.style.left = `${point.x}px`;
    particle.style.top = `${point.y}px`;
    particle.style.setProperty("--zap-color", color);
    particle.style.setProperty("--zap-glow", glow);
    particle.style.setProperty("--zap-x", `${(index % 4 - 1.5) * 30}px`);
    particle.style.setProperty("--zap-y", `${-30 - Math.floor(index / 4) * 24}px`);
    particle.style.setProperty("--zap-rotate", `${index * 43 - 96}deg`);
    particle.style.setProperty("--zap-scale", `${1 + (index % 5) * 0.24}`);
    particle.style.animationDelay = `${index * 14}ms`;
    particle.addEventListener("animationend", () => particle.remove(), { once: true });
    surface.append(particle);
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

function updateNodeGraphGridHeatmap() {
  const heatmap = document.getElementById("nodeGridHeatmap");
  const surface = nodeGraphZoomSurface();
  if (!heatmap || !surface) {
    return;
  }

  const visibleNodes = [...surface.querySelectorAll(".dsp-node:not(.removed):not([hidden])")];
  if (!visibleNodes.length) {
    heatmap.style.setProperty("--node-grid-heatmap", "none");
    heatmap.style.setProperty("--node-grid-heatmap-mask", "none");
    return;
  }

  const glowLayers = [];
  const maskLayers = [];
  const workspace = document.getElementById("nodeGraphWorkspace");
  const zoom = nodeGraphZoom();
  const pan = nodeGraphMvp.pan || { x: 0, y: 0 };
  heatmap.style.setProperty("--node-grid-heatmap-grid-position", `${Number(pan.x) || 0}px ${Number(pan.y) || 0}px`);
  heatmap.style.setProperty(
    "--node-grid-heatmap-grid-size",
    `${(nodeGraphGridWidth() * zoom).toFixed(2)}px ${(nodeGraphGridHeight() * zoom).toFixed(2)}px`,
  );
  const spread = Math.max(
    0.4,
    Math.min(
      2.2,
      (Number.parseFloat(getComputedStyle(workspace).getPropertyValue("--node-module-light-spread")) || 1),
    ),
  );
  for (const node of visibleNodes) {
    const bounds = nodeGraphNodeBounds(node);
    const centerX = (bounds.left + (bounds.right - bounds.left) / 2) * zoom + (Number(pan.x) || 0);
    const centerY = (bounds.top + (bounds.bottom - bounds.top) / 2) * zoom + (Number(pan.y) || 0);
    const radiusX = Math.max(nodeGraphGridWidth() * 5, (bounds.right - bounds.left) * 1.18) * spread * zoom;
    const radiusY = Math.max(nodeGraphGridHeight() * 5, (bounds.bottom - bounds.top) * 1.35) * spread * zoom;
    glowLayers.push(
      `radial-gradient(ellipse ${radiusX.toFixed(2)}px ${radiusY.toFixed(2)}px at ${centerX.toFixed(2)}px ${centerY.toFixed(2)}px, rgba(127, 199, 217, 0.18) 0%, rgba(127, 199, 217, 0.15) 18%, rgba(226, 168, 109, 0.1) 38%, rgba(226, 168, 109, 0.045) 62%, transparent 92%)`,
    );
    maskLayers.push(
      `radial-gradient(ellipse ${radiusX.toFixed(2)}px ${radiusY.toFixed(2)}px at ${centerX.toFixed(2)}px ${centerY.toFixed(2)}px, black 0%, rgb(0 0 0 / 0.95) 22%, rgb(0 0 0 / 0.72) 48%, rgb(0 0 0 / 0.28) 74%, transparent 94%)`,
    );
  }
  heatmap.style.setProperty("--node-grid-heatmap", glowLayers.join(", "));
  heatmap.style.setProperty("--node-grid-heatmap-mask", maskLayers.join(", "));
}

function nodeGraphRectsIntersect(a, b) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function nodeGraphWorkspaceCurrentGridSize() {
  const workspace = document.getElementById("nodeGraphWorkspace");
  const rect = workspace.getBoundingClientRect();
  const contentWidth = Math.max(0, rect.width - nodeGraphWorkspaceChromeSize("x"));
  const contentHeight = Math.max(0, rect.height - nodeGraphWorkspaceChromeSize("y"));
  return {
    heightGu: Math.max(
      nodeGraphWorkspaceViewLimits.minHeightGu,
      Math.round(contentHeight / nodeGraphGridHeight()),
    ),
    widthGu: Math.max(
      nodeGraphWorkspaceViewLimits.minWidthGu,
      Math.round(contentWidth / nodeGraphGridWidth()),
    ),
  };
}

function setNodeGraphWorkspacePreviewSize(widthGu, heightGu) {
  const workspace = document.getElementById("nodeGraphWorkspace");
  withNodeGraphWorkspaceContentAnchored(workspace, () => {
    workspace.style.width = nodeGraphWorkspaceWidthCss(widthGu * nodeGraphGridWidth());
    workspace.style.height = nodeGraphWorkspaceHeightCss(heightGu * nodeGraphGridHeight());
    workspace.style.removeProperty("aspect-ratio");
  });
  workspace.dataset.widthGu = String(widthGu);
  workspace.dataset.heightGu = String(heightGu);
  drawNodeGraphWires();
}

function beginNodeGraphWorkspaceResize(event) {
  if (event.button !== 0) {
    return;
  }
  if (!nodeGraphScriptReadyForGraphAction("resize workspace")) {
    return;
  }
  const workspace = document.getElementById("nodeGraphWorkspace");
  const startSize = nodeGraphWorkspaceCurrentGridSize();
  nodeGraphMvp.workspaceResizing = {
    heightGu: startSize.heightGu,
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startHeightGu: startSize.heightGu,
    startWidthGu: startSize.widthGu,
    widthGu: startSize.widthGu,
  };
  workspace.classList.add("resizing");
  event.currentTarget.setPointerCapture(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function dragNodeGraphWorkspaceResize(event) {
  const drag = nodeGraphMvp.workspaceResizing;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }
  const widthGu = Math.max(
    nodeGraphWorkspaceViewLimits.minWidthGu,
    drag.startWidthGu + Math.round((event.clientX - drag.startClientX) / nodeGraphGridWidth()) * 2,
  );
  const heightGu = Math.max(
    nodeGraphWorkspaceViewLimits.minHeightGu,
    drag.startHeightGu + Math.round((event.clientY - drag.startClientY) / nodeGraphGridHeight()),
  );
  if (widthGu === drag.widthGu && heightGu === drag.heightGu) {
    return;
  }
  drag.widthGu = widthGu;
  drag.heightGu = heightGu;
  setNodeGraphWorkspacePreviewSize(widthGu, heightGu);
}

function endNodeGraphWorkspaceResize(event) {
  const drag = nodeGraphMvp.workspaceResizing;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }
  const handle = document.getElementById("nodeGraphResizeHandle");
  if (handle?.hasPointerCapture?.(event.pointerId)) {
    handle.releasePointerCapture(event.pointerId);
  }
  document.getElementById("nodeGraphWorkspace")?.classList.remove("resizing");
  nodeGraphMvp.workspaceResizing = null;
  if (drag.widthGu === drag.startWidthGu && drag.heightGu === drag.startHeightGu) {
    applyNodeGraphWorkspaceView();
    return;
  }
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  patch.view = {
    heightGu: drag.heightGu,
    widthGu: drag.widthGu,
  };
  commitNodeGraphPatch(patch, {
    markPending: false,
    status: "workspace resized",
  });
}

function handleNodeGraphWindowResize() {
  applyNodeGraphWorkspaceView();
  drawNodeGraphWires();
}

function beginNodeGraphWorkspacePan(event) {
  if (event.button !== 1 || event.ctrlKey || event.altKey) {
    return;
  }

  const workspace = document.getElementById("nodeGraphWorkspace");
  const pan = nodeGraphMvp.pan || { x: 0, y: 0 };
  nodeGraphMvp.workspacePanning = {
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startPanX: pan.x,
    startPanY: pan.y,
  };
  workspace.classList.add("panning");
  workspace.setPointerCapture(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function dragNodeGraphWorkspacePan(event) {
  const drag = nodeGraphMvp.workspacePanning;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }

  const nextX = drag.startPanX + event.clientX - drag.startClientX;
  const nextY = drag.startPanY + event.clientY - drag.startClientY;
  setNodeGraphPan(
    nodeGraphMvp.snapGridWhilePanning
      ? snapNodeGraphPanValueToGrid(nextX, nodeGraphGridWidth())
      : nextX,
    nodeGraphMvp.snapGridWhilePanning
      ? snapNodeGraphPanValueToGrid(nextY, nodeGraphGridHeight())
      : nextY,
  );
  event.preventDefault();
  event.stopPropagation();
}

function endNodeGraphWorkspacePan(event) {
  const drag = nodeGraphMvp.workspacePanning;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }

  const workspace = document.getElementById("nodeGraphWorkspace");
  if (workspace?.hasPointerCapture?.(event.pointerId)) {
    workspace.releasePointerCapture(event.pointerId);
  }
  workspace?.classList.remove("panning");
  nodeGraphMvp.workspacePanning = null;
  drawNodeGraphWires();
  event.preventDefault();
  event.stopPropagation();
}

function preventNodeGraphMiddleMouseAuxClick(event) {
  if (event.button === 1 && event.target.closest("#nodeGraphWorkspace")) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function preventNodeGraphMiddleMouseDefault(event) {
  if (event.button === 1 && event.target.closest("#nodeGraphWorkspace")) {
    event.preventDefault();
  }
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
  const ids = drag.additive
    ? [...new Set([...(drag.startSelectedIds || []), ...nodeGraphNodesInsideRect(rect)])]
    : nodeGraphNodesInsideRect(rect);
  setNodeGraphNodeSelection(ids);
  renderNodeGraphMarqueeSelection();
}

function nodeGraphMarqueeTargetIsBlocked(target) {
  return Boolean(target?.closest?.(
    ".dsp-node, .node-port, .node-param-port, .node-slider-readout, .node-wire-hit-path, button, input, textarea, select",
  ));
}

function startNodeGraphMarqueeSelection(event, workspace) {
  const point = nodeGraphClientPoint(event);
  const additive = event.shiftKey || event.ctrlKey || event.metaKey;
  nodeGraphMvp.marqueeSelection = {
    additive,
    current: point,
    moved: false,
    pointerId: event.pointerId,
    start: point,
    startSelectedIds: [...nodeGraphSelectedNodeIds()],
  };
  if (!additive) {
    setNodeGraphSelection(null);
  }
  renderNodeGraphMarqueeSelection();
  workspace.setPointerCapture(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function beginNodeGraphMarqueeSelection(event) {
  if (
    event.button !== 0 ||
    event.ctrlKey ||
    nodeGraphMarqueeTargetIsBlocked(event.target)
  ) {
    return;
  }

  startNodeGraphMarqueeSelection(event, event.currentTarget);
}

function nodeGraphOutsideMarqueeStartIsBlocked(target) {
  return Boolean(target?.closest?.(
    "#nodeGraphWorkspace, #nodeSceneContextMenu, #nodeParameterMetadataPopover, #nodeUiDevHelper, #nodeUserUiSettingsPanel, button, input, textarea, select",
  ));
}

function trackNodeGraphOutsideMarqueePointer(event) {
  if (event.button !== 0 || nodeGraphOutsideMarqueeStartIsBlocked(event.target)) {
    nodeGraphMvp.marqueeSelectionEntryPointer = null;
    return;
  }
  nodeGraphMvp.marqueeSelectionEntryPointer = {
    additive: event.shiftKey || event.ctrlKey || event.metaKey,
    pointerId: event.pointerId,
  };
}

function clearNodeGraphOutsideMarqueePointer(event) {
  if (
    !nodeGraphMvp.marqueeSelectionEntryPointer ||
    nodeGraphMvp.marqueeSelectionEntryPointer.pointerId === event.pointerId
  ) {
    nodeGraphMvp.marqueeSelectionEntryPointer = null;
  }
}

function beginNodeGraphMarqueeSelectionOnEntry(event) {
  const entry = nodeGraphMvp.marqueeSelectionEntryPointer;
  if (
    !entry ||
    entry.pointerId !== event.pointerId ||
    !(event.buttons & 1) ||
    event.ctrlKey ||
    nodeGraphMvp.marqueeSelection ||
    nodeGraphMvp.dragging ||
    nodeGraphMvp.nodeDragging ||
    nodeGraphMvp.workspacePanning ||
    nodeGraphMvp.smoothZoomDragging ||
    nodeGraphMvp.workspaceResizing
  ) {
    return;
  }
  startNodeGraphMarqueeSelection(event, event.currentTarget);
  nodeGraphMvp.marqueeSelectionEntryPointer = null;
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
  } else if (!drag.additive) {
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

function positionNodeSceneContextMenu(menu, x, y, remember = false) {
  const margin = 12;
  menu.hidden = false;
  const rect = menu.getBoundingClientRect();
  const left = Math.max(margin, Math.min(window.innerWidth - rect.width - margin, x));
  const top = Math.max(margin, Math.min(window.innerHeight - rect.height - margin, y));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  if (remember) {
    nodeGraphMvp.moduleActionWindowPosition = { left, top };
    syncNodeGraphPatchWindowPosition("moduleActions", { left, top });
  }
}

function positionNodeSceneContextMenuAtSavedOr(menu, x, y) {
  const savedPosition = nodeGraphMvp.moduleActionWindowPosition;
  const hasSavedPosition =
    Number.isFinite(Number(savedPosition?.left)) &&
    Number.isFinite(Number(savedPosition?.top));
  positionNodeSceneContextMenu(
    menu,
    hasSavedPosition ? savedPosition.left : x,
    hasSavedPosition ? savedPosition.top : y,
    !hasSavedPosition,
  );
}

function beginNodeSceneContextMenuDrag(event) {
  if (event.button > 0) {
    return;
  }

  const menu = document.getElementById("nodeSceneContextMenu");
  if (menu.hidden) {
    return;
  }

  const rect = menu.getBoundingClientRect();
  nodeGraphMvp.moduleActionDragging = {
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

function dragNodeSceneContextMenu(event) {
  const drag = nodeGraphMvp.moduleActionDragging;
  if (
    !drag ||
    (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)
  ) {
    return;
  }

  positionNodeSceneContextMenu(
    document.getElementById("nodeSceneContextMenu"),
    event.clientX - drag.offsetX,
    event.clientY - drag.offsetY,
    true,
  );
  event.preventDefault();
}

function endNodeSceneContextMenuDrag(event) {
  const drag = nodeGraphMvp.moduleActionDragging;
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
  nodeGraphMvp.moduleActionDragging = null;
}

function configureNodeSceneContextMenu(mode) {
  const menu = document.getElementById("nodeSceneContextMenu");
  const title = menu.querySelector(".scene-context-title");
  const addGroup = menu.querySelector(".scene-context-add-group");
  const copyButton = document.getElementById("nodeSceneCopyModule");
  const deleteButton = document.getElementById("nodeSceneDeleteModule");
  const closeButton = document.getElementById("nodeSceneCloseMenu");
  const selectedModule = document.getElementById("nodeSceneSelectedModule");
  const aliasControl = document.getElementById("nodeSceneAliasControl");
  const aliasInput = document.getElementById("nodeSceneAliasInput");
  const widthControls = document.getElementById("nodeSceneWidthControls");
  const widthDecrease = document.getElementById("nodeSceneWidthDecrease");
  const widthIncrease = document.getElementById("nodeSceneWidthIncrease");
  const widthValue = document.getElementById("nodeSceneWidthValue");
  const textBoxHeightControls = document.getElementById("nodeSceneTextBoxHeightControls");
  const textBoxHeightDecrease = document.getElementById("nodeSceneTextBoxHeightDecrease");
  const textBoxHeightIncrease = document.getElementById("nodeSceneTextBoxHeightIncrease");
  const textBoxHeightValue = document.getElementById("nodeSceneTextBoxHeightValue");
  const textBoxTextSizeControls = document.getElementById("nodeSceneTextBoxTextSizeControls");
  const textBoxTextSizeDecrease = document.getElementById("nodeSceneTextBoxTextSizeDecrease");
  const textBoxTextSizeIncrease = document.getElementById("nodeSceneTextBoxTextSizeIncrease");
  const textBoxTextSizeValue = document.getElementById("nodeSceneTextBoxTextSizeValue");
  const textBoxTextControls = document.getElementById("nodeSceneTextBoxTextControls");
  const textBoxTextInput = document.getElementById("nodeSceneTextBoxTextInput");
  const toggleButtonsButton = document.getElementById("nodeSceneToggleButtons");
  const toggleTitleButton = document.getElementById("nodeSceneToggleTitle");
  const textBoxControls = document.getElementById("nodeSceneTextBoxControls");
  const textBoxSingleLine = document.getElementById("nodeSceneTextBoxSingleLine");
  const textBoxMultiline = document.getElementById("nodeSceneTextBoxMultiline");
  const textBoxHorizontalAlignControls = document.getElementById("nodeSceneTextBoxHorizontalAlignControls");
  const textBoxAlignLeft = document.getElementById("nodeSceneTextBoxAlignLeft");
  const textBoxAlignCenter = document.getElementById("nodeSceneTextBoxAlignCenter");
  const textBoxAlignRight = document.getElementById("nodeSceneTextBoxAlignRight");
  const textBoxVerticalAlignControls = document.getElementById("nodeSceneTextBoxVerticalAlignControls");
  const textBoxVerticalAlign = document.getElementById("nodeSceneTextBoxVerticalAlign");
  const textBoxVerticalAlignValue = document.getElementById("nodeSceneTextBoxVerticalAlignValue");
  const moduleMode = mode === "module";
  const wireMode = mode === "wire";
  menu.dataset.mode = mode;
  const targetNodeId = moduleMode ? nodeGraphModuleActionTargetNodeId() : null;
  if (targetNodeId) {
    nodeGraphMvp.sceneContextTargetNode = targetNodeId;
  }
  const targetNode = targetNodeId ? nodeGraphPatchNode(targetNodeId) : null;
  const selectedNodeIds = nodeGraphSelectedNodeIds();
  const selectedWire = wireMode ? nodeGraphWireFromSelection(nodeGraphMvp.selected) : null;
  const canDelete = wireMode
    ? Boolean(selectedWire)
    : moduleMode && (
      targetNode
        ? nodeGraphNodeCanBeDeleted(targetNode)
        : [...selectedNodeIds].some((id) => {
          const node = nodeGraphPatchNode(id);
          return nodeGraphMvp.activeNodes.has(id) && nodeGraphNodeCanBeDeleted(node);
        })
    );
  const canCopy = moduleMode && targetNode?.type !== "output";
  const widthGu = targetNode ? nodeGraphPatchNodeGridWidthUnits(targetNode) : 0;
  const heightGu = targetNode ? nodeGraphPatchNodeGridHeightUnits(targetNode) : 0;
  const targetNodeUi = normalizeNodeGraphPatchNodeUi(targetNode?.ui);
  const buttonsHidden = targetNodeUi.buttonsHidden;
  const titleHidden = targetNodeUi.titleHidden;
  const textBoxLayout = normalizeNodeGraphTextBoxLayout(targetNode?.layout);
  const textBoxMode = textBoxLayout.textMode;
  title.textContent = wireMode ? "WIRE ACTIONS" : moduleMode ? "ACTIONS" : "circuits:";
  menu.setAttribute("aria-label", wireMode ? "Wire actions" : moduleMode ? "Module actions" : "Add module");
  addGroup.hidden = moduleMode || wireMode;
  copyButton.hidden = !moduleMode;
  deleteButton.hidden = !(moduleMode || wireMode);
  selectedModule.hidden = !(moduleMode || wireMode);
  aliasControl.hidden = !moduleMode;
  widthControls.hidden = !moduleMode;
  textBoxHeightControls.hidden = !(moduleMode && targetNode?.type === "textBox");
  textBoxTextSizeControls.hidden = !(moduleMode && targetNode?.type === "textBox");
  textBoxTextControls.hidden = !(moduleMode && targetNode?.type === "textBox");
  toggleButtonsButton.hidden = !moduleMode;
  toggleTitleButton.hidden = !moduleMode;
  textBoxControls.hidden = !(moduleMode && targetNode?.type === "textBox");
  textBoxHorizontalAlignControls.hidden = !(moduleMode && targetNode?.type === "textBox");
  textBoxVerticalAlignControls.hidden = !(moduleMode && targetNode?.type === "textBox");
  closeButton.hidden = false;
  if (moduleMode) {
    selectedModule.querySelector("span").textContent = selectedNodeIds.size > 1 ? "selected modules" : "selected module";
    selectedModule.querySelector("strong").textContent = targetNode
      ? `${nodeGraphNodeDisplayName(targetNode.id)} (${targetNode.id})`
      : selectedNodeIds.size > 1
        ? `${selectedNodeIds.size} modules`
        : "none";
    aliasInput.disabled = !targetNode;
    aliasInput.value = targetNode ? normalizeNodeGraphPatchNodeAlias(targetNode.alias) : "";
    aliasInput.placeholder = targetNode ? nodeGraphDefaultNodeTitle(targetNode.type, targetNode.id) : "module title alias";
    aliasInput.title = nodeGraphTooltipText("actions.moduleAlias");
    copyButton.disabled = !canCopy;
    copyButton.title = canCopy
      ? nodeGraphTooltipText("actions.copyModule")
      : targetNode
        ? nodeGraphTooltipText("actions.copyUnavailableOutput")
        : nodeGraphTooltipText("actions.copyUnavailableOneModule");
    deleteButton.disabled = !canDelete;
    deleteButton.title = canDelete
      ? nodeGraphTooltipText("actions.deleteModule")
      : targetNode
        ? nodeGraphTooltipText("actions.deleteUnavailableOutput")
        : nodeGraphTooltipText("actions.deleteUnavailableOneModule");
    widthValue.textContent = `${widthGu} gu`;
    widthDecrease.disabled = !targetNode || widthGu <= nodeGraphModuleWidthLimits.minGu;
    widthDecrease.title = nodeGraphTooltipText("actions.widthDecrease");
    widthIncrease.disabled = !targetNode || widthGu >= nodeGraphModuleWidthLimits.maxGu;
    widthIncrease.title = nodeGraphTooltipText("actions.widthIncrease");
    textBoxHeightValue.textContent = `${heightGu} gu high`;
    textBoxHeightDecrease.disabled = !targetNode || targetNode.type !== "textBox" || heightGu <= nodeGraphTextBoxHeightLimits.minGu;
    textBoxHeightDecrease.title = nodeGraphTooltipText("actions.textBoxHeightDecrease");
    textBoxHeightIncrease.disabled = !targetNode || targetNode.type !== "textBox" || heightGu >= nodeGraphTextBoxHeightLimits.maxGu;
    textBoxHeightIncrease.title = nodeGraphTooltipText("actions.textBoxHeightIncrease");
    textBoxTextSizeValue.textContent = `${textBoxLayout.textSizePercent}% text`;
    textBoxTextSizeDecrease.disabled =
      !targetNode ||
      targetNode.type !== "textBox" ||
      textBoxLayout.textSizePercent <= nodeGraphTextBoxTextSizeLimits.minPercent;
    textBoxTextSizeDecrease.title = nodeGraphTooltipText("actions.textBoxTextSizeDecrease");
    textBoxTextSizeIncrease.disabled =
      !targetNode ||
      targetNode.type !== "textBox" ||
      textBoxLayout.textSizePercent >= nodeGraphTextBoxTextSizeLimits.maxPercent;
    textBoxTextSizeIncrease.title = nodeGraphTooltipText("actions.textBoxTextSizeIncrease");
    toggleButtonsButton.disabled = !targetNode;
    toggleButtonsButton.querySelector("span").textContent = buttonsHidden ? "Show buttons" : "Hide buttons";
    toggleButtonsButton.setAttribute("aria-pressed", buttonsHidden ? "true" : "false");
    toggleButtonsButton.title = nodeGraphTooltipText(buttonsHidden ? "actions.showModuleButtons" : "actions.hideModuleButtons");
    toggleTitleButton.disabled = !targetNode;
    toggleTitleButton.querySelector("span").textContent = titleHidden ? "Show title" : "Hide title";
    toggleTitleButton.setAttribute("aria-pressed", titleHidden ? "true" : "false");
    toggleTitleButton.title = nodeGraphTooltipText(titleHidden ? "actions.showModuleTitle" : "actions.hideModuleTitle");
    textBoxSingleLine.setAttribute("aria-pressed", textBoxMode === "singleLine" ? "true" : "false");
    textBoxMultiline.setAttribute("aria-pressed", textBoxMode === "multiline" ? "true" : "false");
    textBoxSingleLine.title = nodeGraphTooltipText("actions.textBoxSingleLine");
    textBoxMultiline.title = nodeGraphTooltipText("actions.textBoxMultiline");
    textBoxTextInput.disabled = !targetNode || targetNode.type !== "textBox";
    textBoxTextInput.value = targetNode?.type === "textBox" ? textBoxLayout.text : "";
    textBoxTextInput.title = nodeGraphTooltipText("actions.textBoxContent");
    textBoxAlignLeft.setAttribute("aria-pressed", textBoxLayout.horizontalAlign === "left" ? "true" : "false");
    textBoxAlignCenter.setAttribute("aria-pressed", textBoxLayout.horizontalAlign === "center" ? "true" : "false");
    textBoxAlignRight.setAttribute("aria-pressed", textBoxLayout.horizontalAlign === "right" ? "true" : "false");
    textBoxVerticalAlign.disabled = !targetNode || targetNode.type !== "textBox";
    textBoxVerticalAlign.value = String(textBoxLayout.verticalAlignPercent);
    textBoxVerticalAlignValue.textContent = `${textBoxLayout.verticalAlignPercent}%`;
    textBoxVerticalAlign.title = nodeGraphTooltipText("actions.textBoxVerticalPosition");
    textBoxAlignLeft.title = nodeGraphTooltipText("actions.textBoxAlignLeft");
    textBoxAlignCenter.title = nodeGraphTooltipText("actions.textBoxAlignCenter");
    textBoxAlignRight.title = nodeGraphTooltipText("actions.textBoxAlignRight");
  } else if (wireMode) {
    selectedModule.querySelector("span").textContent = selectedWire?.kind === "modulation"
      ? "selected modulation"
      : "selected wire";
    selectedModule.querySelector("strong").textContent = nodeGraphWireSelectionLabel(nodeGraphMvp.selected);
    deleteButton.disabled = !canDelete;
    deleteButton.title = canDelete
      ? nodeGraphTooltipText("actions.deleteWire")
      : nodeGraphTooltipText("actions.deleteWireMissing");
    copyButton.disabled = true;
    copyButton.title = nodeGraphTooltipText("actions.copyUnavailableWire");
    widthValue.textContent = "";
    widthDecrease.disabled = true;
    widthIncrease.disabled = true;
    textBoxHeightValue.textContent = "";
    textBoxHeightDecrease.disabled = true;
    textBoxHeightIncrease.disabled = true;
    textBoxTextSizeValue.textContent = "";
    textBoxTextSizeDecrease.disabled = true;
    textBoxTextSizeIncrease.disabled = true;
    textBoxTextInput.value = "";
    textBoxTextInput.disabled = true;
    textBoxVerticalAlign.value = "50";
    textBoxVerticalAlignValue.textContent = "";
    textBoxVerticalAlign.disabled = true;
    toggleButtonsButton.disabled = true;
    toggleTitleButton.disabled = true;
  } else {
    selectedModule.querySelector("span").textContent = "selected";
    selectedModule.querySelector("strong").textContent = "none";
    copyButton.disabled = true;
    copyButton.title = nodeGraphTooltipText("actions.copyUnavailableModule");
    deleteButton.disabled = true;
    deleteButton.title = nodeGraphTooltipText("actions.deleteTitle");
    widthValue.textContent = "";
    widthDecrease.disabled = true;
    widthIncrease.disabled = true;
    textBoxHeightValue.textContent = "";
    textBoxHeightDecrease.disabled = true;
    textBoxHeightIncrease.disabled = true;
    textBoxTextSizeValue.textContent = "";
    textBoxTextSizeDecrease.disabled = true;
    textBoxTextSizeIncrease.disabled = true;
    textBoxTextInput.value = "";
    textBoxTextInput.disabled = true;
    textBoxVerticalAlign.value = "50";
    textBoxVerticalAlignValue.textContent = "";
    textBoxVerticalAlign.disabled = true;
    toggleButtonsButton.disabled = true;
    toggleTitleButton.disabled = true;
  }
}

function openNodeModuleActionMenu(event) {
  const button = event.currentTarget;
  const node = button.closest(".dsp-node");
  if (!node) {
    return;
  }

  nodeGraphMvp.sceneContextPoint = null;
  nodeGraphMvp.sceneContextTargetNode = node.dataset.node;
  nodeGraphMvp.sceneContextTargetWire = null;
  configureNodeSceneContextMenu("module");
  const rect = button.getBoundingClientRect();
  positionNodeSceneContextMenuAtSavedOr(
    document.getElementById("nodeSceneContextMenu"),
    rect.right,
    rect.bottom,
  );
  event.preventDefault();
  event.stopPropagation();
}

function openNodeSceneContextMenu(event) {
  const contextNode = event.target.closest(".dsp-node");
  if (contextNode) {
    event.preventDefault();
    event.stopPropagation();
    nodeGraphMvp.sceneContextPoint = null;
    nodeGraphMvp.sceneContextTargetNode = contextNode.dataset.node;
    nodeGraphMvp.sceneContextTargetWire = null;
    configureNodeSceneContextMenu("module");
    positionNodeSceneContextMenuAtSavedOr(
      document.getElementById("nodeSceneContextMenu"),
      event.clientX,
      event.clientY,
    );
    return;
  }
  if (event.target.closest(".node-port, .node-param-port, .node-slider-readout")) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  nodeGraphMvp.sceneContextPoint = nodeGraphClientPoint(event);
  nodeGraphMvp.sceneContextTargetNode = null;
  nodeGraphMvp.sceneContextTargetWire = null;
  configureNodeSceneContextMenu("add");
  positionNodeSceneContextMenuAtSavedOr(
    document.getElementById("nodeSceneContextMenu"),
    event.clientX,
    event.clientY,
  );
}

function beginNodeGraphNodeDrag(event) {
  if (event.button !== undefined && event.button !== 0) {
    return;
  }
  const handle = event.currentTarget.closest(
    ".node-drag-handle, .node-header-title-row",
  );
  if (!handle) {
    return;
  }

  const node = handle.closest(".dsp-node");
  if (!node) {
    return;
  }

  const additiveSelection = event.ctrlKey || event.metaKey || event.shiftKey;
  const selectedNodeIds = nodeGraphSelectedNodeIds();
  const wasSelectedAtStart = selectedNodeIds.has(node.dataset.node);
  const point = nodeGraphClientPoint(event);
  const additiveDragSelection = additiveSelection;
  const pendingSelectionIds = new Set(selectedNodeIds);
  if (additiveDragSelection) {
    pendingSelectionIds.add(node.dataset.node);
  }
  const draggedNodeIds = wasSelectedAtStart || additiveDragSelection
    ? pendingSelectionIds
    : new Set([node.dataset.node]);
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
    moved: false,
    node,
    startPoint: point,
    additiveSelection,
    additiveDragSelection,
    pendingSelectionIds: [...pendingSelectionIds],
    wasSelectedAtStart,
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
  if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
    nodeGraphMvp.nodeDragging.moved = true;
  }
  for (const dragged of draggedNodes) {
    positionNodeGraphNode(dragged.element, {
      x: dragged.startX + deltaX,
      y: dragged.startY + deltaY,
    }, { clamp: false });
  }
  drawNodeGraphWires();
}

function endNodeGraphNodeDrag(event) {
  if (!nodeGraphMvp.nodeDragging) {
    return;
  }

  const {
    additiveSelection,
    additiveDragSelection,
    draggedNodes,
    handle,
    moved,
    node,
    pendingSelectionIds,
  } = nodeGraphMvp.nodeDragging;
  for (const dragged of draggedNodes) {
    dragged.element.classList.remove("dragging");
  }
  handle.classList.remove("dragging");
  if (handle.hasPointerCapture?.(event.pointerId)) {
    handle.releasePointerCapture(event.pointerId);
  }
  nodeGraphMvp.nodeDragging = null;
  if (!moved) {
    toggleNodeGraphNodeSelection(node.dataset.node, additiveSelection);
    return;
  }
  if (additiveDragSelection) {
    setNodeGraphNodeSelection(pendingSelectionIds);
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
  commitNodeGraphPatch(patch, { status: "layout snapped" });
}

function clearNodeGraphWires() {
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  patch.connections = [];
  patch.modulations = [];
  setNodeGraphSelection(null);
  markNodeGraphRenderPending();
  commitNodeGraphPatch(patch, { status: "wires cleared" });
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

function ensureNodeGraphLiveInputModule() {
  if (nodeGraphMvp.patch.nodes.some((node) => node.type === "audioInput")) {
    return false;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const counts = nextNodeGraphTypeCounts(patch.nodes);
  const id = counts.audioInput > 0 ? `audioInput-${counts.audioInput + 1}` : "audioInput";
  const gridPoint = nodeGraphFindFreeModuleGridPoint("audioInput", patch.nodes, { gx: 0, gy: 1 });
  patch.nodes.push(createNodeGraphPatchNode("audioInput", {
    id,
    gx: gridPoint.gx,
    gy: gridPoint.gy,
  }));
  commitNodeGraphPatch(patch, { status: "input module shown" });
  return true;
}

function nodeGraphFindFreeModuleGridPoint(type, nodes = nodeGraphMvp.patch.nodes, preferred = null) {
  const start = preferred || defaultNodeGraphModuleGridPoint(type);
  for (let rowOffset = 0; rowOffset < 200; rowOffset += 1) {
    const candidate = {
      gx: start.gx,
      gy: start.gy + rowOffset,
      type,
    };
    const rect = nodeGraphPatchNodeGridRect(candidate);
    const overlaps = nodes.some((node) => nodeGraphGridRectsOverlap(rect, nodeGraphPatchNodeGridRect(node)));
    if (!overlaps) {
      return { gx: candidate.gx, gy: candidate.gy };
    }
  }
  return { gx: start.gx, gy: start.gy + 200 };
}

function nodeGraphPatchNodeGridRect(node) {
  return {
    bottom: node.gy + nodeGraphPatchNodeGridHeightUnits(node),
    left: node.gx,
    right: node.gx + nodeGraphPatchNodeGridWidthUnits(node),
    top: node.gy,
  };
}

function nodeGraphGridRectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function nodeGraphFindCopiedModuleGridPoint(sourceNode, nodes = nodeGraphMvp.patch.nodes) {
  const sourceRect = nodeGraphPatchNodeGridRect(sourceNode);
  const candidate = {
    gx: sourceNode.gx,
    gy: sourceRect.bottom + 1,
  };
  const maxSearchRows = 200;

  for (let offset = 0; offset < maxSearchRows; offset += 1) {
    const rect = nodeGraphPatchNodeGridRect({
      gx: candidate.gx,
      gy: candidate.gy + offset,
      type: sourceNode.type,
    });
    const overlaps = nodes.some((node) => nodeGraphGridRectsOverlap(rect, nodeGraphPatchNodeGridRect(node)));
    if (!overlaps) {
      return { gx: candidate.gx, gy: candidate.gy + offset };
    }
  }

  return { gx: candidate.gx, gy: candidate.gy + maxSearchRows };
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
  patch.nodes.push(createNodeGraphPatchNode(type, {
    id,
    gx: gridPoint.gx,
    gy: gridPoint.gy,
  }));
  commitNodeGraphPatch(patch, { status: "module added" });
}

function showPaletteNode(node) {
  showNodeGraphModule(node);
}

function addNodeGraphModuleFromContext(event) {
  showNodeGraphModule(event.currentTarget.dataset.contextModule, nodeGraphMvp.sceneContextPoint);
  closeNodeSceneContextMenu();
}

function copyNodeGraphModule(sourceNode) {
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const counts = nextNodeGraphTypeCounts(patch.nodes);
  counts[sourceNode.type] = (counts[sourceNode.type] || 0) + 1;
  const id = `${sourceNode.type}-${counts[sourceNode.type]}`;
  const gridPoint = nodeGraphFindCopiedModuleGridPoint(sourceNode, patch.nodes);
  patch.nodes.push({
    ...createNodeGraphPatchNode(sourceNode.type, {
      alias: sourceNode.alias,
      gx: gridPoint.gx,
      gy: gridPoint.gy,
      id,
      layout: sourceNode.layout,
      ui: sourceNode.ui,
      ...(Object.hasOwn(sourceNode, "widthGu") ? { widthGu: sourceNode.widthGu } : {}),
      ...(Object.hasOwn(sourceNode, "heightGu") ? { heightGu: sourceNode.heightGu } : {}),
    }),
    ...(sourceNode.layout ? { layout: normalizeNodeGraphTextBoxLayout(sourceNode.layout) } : {}),
    paramMeta: cloneNodeGraphParamMeta(sourceNode.paramMeta),
    params: { ...(sourceNode.params || {}) },
  });
  commitNodeGraphPatch(patch, { status: "module copied" });
  return id;
}

function copyNodeGraphModuleFromContext() {
  const sourceNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId());
  if (sourceNode && sourceNode.type !== "output") {
    const copiedNodeId = copyNodeGraphModule(sourceNode);
    if (copiedNodeId) {
      nodeGraphMvp.sceneContextTargetNode = copiedNodeId;
      setNodeGraphNodeSelection([copiedNodeId]);
    }
  }
  configureNodeSceneContextMenu("module");
}

function deleteNodeGraphSelectionFromContext() {
  deleteSelectedNodeGraphItem();
  const menu = document.getElementById("nodeSceneContextMenu");
  if (!menu || menu.hidden) {
    return;
  }
  if (nodeGraphMvp.selected?.type === "wire") {
    configureNodeSceneContextMenu("wire");
  } else if (nodeGraphSelectedNodeIds().size) {
    configureNodeSceneContextMenu("module");
  } else {
    configureNodeSceneContextMenu(menu.dataset.mode === "wire" ? "wire" : "module");
  }
}

function adjustNodeGraphModuleWidthFromContext(delta) {
  const sourceNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId());
  if (!sourceNode) {
    return;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === sourceNode.id);
  if (!targetNode) {
    return;
  }
  const currentWidthGu = nodeGraphPatchNodeGridWidthUnits(targetNode);
  const nextWidthGu = normalizeNodeGraphModuleWidthUnits(targetNode.type, currentWidthGu + delta);
  if (nextWidthGu === currentWidthGu) {
    configureNodeSceneContextMenu("module");
    return;
  }

  const defaultWidthGu = nodeGraphDefaultModuleGridWidthUnits(targetNode.type);
  if (nextWidthGu === defaultWidthGu) {
    delete targetNode.widthGu;
  } else {
    targetNode.widthGu = nextWidthGu;
  }
  commitNodeGraphPatch(patch, { status: "module width changed" });
  configureNodeSceneContextMenu("module");
}

function adjustNodeGraphTextBoxHeightFromContext(delta) {
  const sourceNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId());
  if (!sourceNode || sourceNode.type !== "textBox") {
    return;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === sourceNode.id);
  if (!targetNode) {
    return;
  }
  const currentHeightGu = nodeGraphPatchNodeGridHeightUnits(targetNode);
  const nextHeightGu = normalizeNodeGraphTextBoxHeightUnits(currentHeightGu + delta);
  if (nextHeightGu === currentHeightGu) {
    configureNodeSceneContextMenu("module");
    return;
  }

  const defaultHeightGu = nodeGraphModuleGridHeightUnitsForUi("textBox", targetNode.ui);
  if (nextHeightGu === defaultHeightGu) {
    delete targetNode.heightGu;
  } else {
    targetNode.heightGu = nextHeightGu;
  }
  commitNodeGraphPatch(patch, { status: "text box height changed" });
  configureNodeSceneContextMenu("module");
}

function adjustNodeGraphTextBoxTextSizeFromContext(delta) {
  const sourceNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId());
  if (!sourceNode || sourceNode.type !== "textBox") {
    return;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === sourceNode.id);
  if (!targetNode) {
    return;
  }
  const currentLayout = normalizeNodeGraphTextBoxLayout(targetNode.layout);
  const nextTextSizePercent = normalizeNodeGraphTextBoxTextSizePercent(
    currentLayout.textSizePercent + delta,
  );
  if (nextTextSizePercent === currentLayout.textSizePercent) {
    configureNodeSceneContextMenu("module");
    return;
  }
  targetNode.layout = normalizeNodeGraphTextBoxLayout({
    ...currentLayout,
    textSizePercent: nextTextSizePercent,
  });
  commitNodeGraphPatch(patch, { status: "text box text size changed" });
  configureNodeSceneContextMenu("module");
}

function setNodeGraphModuleAliasFromContext({ record = true } = {}) {
  const sourceNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId());
  if (!sourceNode) {
    return;
  }
  const input = document.getElementById("nodeSceneAliasInput");
  const alias = normalizeNodeGraphPatchNodeAlias(input?.value);
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === sourceNode.id);
  if (!targetNode) {
    return;
  }
  if (alias) {
    targetNode.alias = alias;
  } else {
    delete targetNode.alias;
  }
  commitNodeGraphPatch(patch, {
    record,
    status: alias ? "module alias changed" : "module alias cleared",
  });
  if (document.activeElement === input) {
    input.focus();
    input.setSelectionRange?.(input.value.length, input.value.length);
  }
}

function setNodeGraphTextBoxModeFromContext(textMode) {
  const sourceNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId());
  if (!sourceNode || sourceNode.type !== "textBox") {
    return;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === sourceNode.id);
  if (!targetNode) {
    return;
  }
  targetNode.layout = normalizeNodeGraphTextBoxLayout({
    ...(targetNode.layout || {}),
    textMode,
  });
  commitNodeGraphPatch(patch, { status: "text box mode changed" });
  configureNodeSceneContextMenu("module");
}

function setNodeGraphTextBoxTextFromContext({ record = true } = {}) {
  const sourceNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId());
  if (!sourceNode || sourceNode.type !== "textBox") {
    return;
  }
  const input = document.getElementById("nodeSceneTextBoxTextInput");
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === sourceNode.id);
  if (!targetNode) {
    return;
  }
  const currentLayout = normalizeNodeGraphTextBoxLayout(targetNode.layout);
  targetNode.layout = normalizeNodeGraphTextBoxLayout({
    ...currentLayout,
    text: input?.value ?? "",
  });
  commitNodeGraphPatch(patch, {
    record,
    status: "text box text changed",
  });
  if (document.activeElement === input) {
    input.focus();
  }
}

function setNodeGraphTextBoxHorizontalAlignFromContext(value) {
  const sourceNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId());
  if (!sourceNode || sourceNode.type !== "textBox") {
    return;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === sourceNode.id);
  if (!targetNode) {
    return;
  }
  const currentLayout = normalizeNodeGraphTextBoxLayout(targetNode.layout);
  targetNode.layout = normalizeNodeGraphTextBoxLayout({
    ...currentLayout,
    horizontalAlign: value,
  });
  commitNodeGraphPatch(patch, { status: "text box alignment changed" });
  configureNodeSceneContextMenu("module");
}

function setNodeGraphTextBoxVerticalAlignFromContext({ record = true } = {}) {
  const sourceNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId());
  if (!sourceNode || sourceNode.type !== "textBox") {
    return;
  }
  const input = document.getElementById("nodeSceneTextBoxVerticalAlign");
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === sourceNode.id);
  if (!targetNode) {
    return;
  }
  const currentLayout = normalizeNodeGraphTextBoxLayout(targetNode.layout);
  const verticalAlignPercent = normalizeNodeGraphTextBoxVerticalAlignPercent(input?.value);
  targetNode.layout = normalizeNodeGraphTextBoxLayout({
    ...currentLayout,
    verticalAlignPercent,
  });
  commitNodeGraphPatch(patch, {
    record,
    status: "text box vertical position changed",
  });
  document.getElementById("nodeSceneTextBoxVerticalAlignValue").textContent = `${verticalAlignPercent}%`;
  if (document.activeElement === input) {
    input.focus();
  }
}

function toggleNodeGraphModuleButtonsFromContext() {
  const sourceNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId());
  if (!sourceNode) {
    return;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === sourceNode.id);
  if (!targetNode) {
    return;
  }
  const ui = normalizeNodeGraphPatchNodeUi(targetNode.ui);
  ui.buttonsHidden = !ui.buttonsHidden;
  if (ui.buttonsHidden || ui.titleHidden) {
    targetNode.ui = ui;
  } else {
    delete targetNode.ui;
  }
  commitNodeGraphPatch(patch, {
    status: ui.buttonsHidden ? "module buttons hidden" : "module buttons shown",
  });
  configureNodeSceneContextMenu("module");
}

function toggleNodeGraphModuleTitleFromContext() {
  const sourceNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId());
  if (!sourceNode) {
    return;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === sourceNode.id);
  if (!targetNode) {
    return;
  }
  const ui = normalizeNodeGraphPatchNodeUi(targetNode.ui);
  ui.titleHidden = !ui.titleHidden;
  if (ui.buttonsHidden || ui.titleHidden) {
    targetNode.ui = ui;
  } else {
    delete targetNode.ui;
  }
  commitNodeGraphPatch(patch, {
    status: ui.titleHidden ? "module title hidden" : "module title shown",
  });
  configureNodeSceneContextMenu("module");
}

function copySelectedNodeGraphModule() {
  const selectedNodeIds = [...nodeGraphSelectedNodeIds()];
  if (selectedNodeIds.length !== 1) {
    return false;
  }
  const sourceNode = nodeGraphPatchNode(selectedNodeIds[0]);
  if (!sourceNode || sourceNode.type === "output") {
    return false;
  }
  copyNodeGraphModule(sourceNode);
  return true;
}

function deleteNodeGraphModuleFromContext() {
  const targetNode = nodeGraphPatchNode(nodeGraphModuleActionTargetNodeId());
  if (targetNode && targetNode.type !== "output") {
    const targetNodeIds = new Set([targetNode.id]);
    const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
    patch.nodes = patch.nodes.filter((node) => !targetNodeIds.has(node.id));
    patch.bypassedNodes = patch.bypassedNodes.filter((nodeId) => !targetNodeIds.has(nodeId));
    patch.connections = patch.connections.filter(
      (connection) =>
        !targetNodeIds.has(connection.sourceNode) &&
        !targetNodeIds.has(connection.destinationNode),
    );
    patch.modulations = patch.modulations.filter(
      (modulation) =>
        !targetNodeIds.has(modulation.sourceNode) &&
        !targetNodeIds.has(modulation.destinationNode),
    );
    commitNodeGraphPatch(patch, { status: "module deleted" });
    nodeGraphMvp.sceneContextTargetNode = null;
    if (nodeGraphSelectedNodeIds().has(targetNode.id)) {
      setNodeGraphSelection(null);
    } else {
      configureNodeSceneContextMenu("module");
    }
    return;
  }
  configureNodeSceneContextMenu("module");
}

function setNodeGraphViewMode(mode) {
  if (mode !== "script") {
    flushNodeGraphScriptCommit();
  }
  const settingsMode = mode === "settings";
  const scriptMode = mode === "script";
  const modularOnlyMode = mode === "modular-only";
  const modularMode = modularOnlyMode || (!settingsMode && !scriptMode);
  document.getElementById("nodeWiringPanel")?.classList.toggle("modular-only-view", modularOnlyMode);
  document.getElementById("nodeGraphWorkspace").hidden = !modularMode;
  document.getElementById("nodeScriptView").hidden = !scriptMode;
  document.getElementById("nodeSettingsView").hidden = !settingsMode;
  document.getElementById("nodeSettingsViewButton").classList.toggle("active", settingsMode);
  document.getElementById("nodeModularViewButton").classList.toggle("active", modularMode && !modularOnlyMode);
  document.getElementById("nodeModularOnlyViewButton").classList.toggle("active", modularOnlyMode);
  document.getElementById("nodeSettingsScriptViewButton").classList.toggle("active", scriptMode);
  document.getElementById("nodeSettingsViewButton").setAttribute("aria-pressed", String(settingsMode));
  document.getElementById("nodeModularViewButton").setAttribute("aria-pressed", String(modularMode && !modularOnlyMode));
  document.getElementById("nodeModularOnlyViewButton").setAttribute("aria-pressed", String(modularOnlyMode));
  document.getElementById("nodeSettingsScriptViewButton").setAttribute("aria-pressed", String(scriptMode));
  if (scriptMode) {
    syncNodeGraphScriptView();
  } else if (settingsMode) {
    syncNodeGraphSettingsView();
    scheduleNodeSettingsHeaderTextFit();
  } else {
    drawNodeGraphWires();
  }
}

function handleNodePatchScriptInput(event) {
  scheduleNodeGraphScriptCommit(event.currentTarget.value);
}

async function copyNodeGraphScriptToClipboard() {
  const script = document.getElementById("nodePatchScript");
  const text = script?.value || serializeNodeGraphPatch();
  try {
    await navigator.clipboard.writeText(text);
    setNodeGraphScriptStatus("script copied", true);
  } catch {
    script?.focus();
    script?.select();
    setNodeGraphScriptStatus("copy blocked: select text manually", false);
  }
}

async function pasteNodeGraphScriptFromClipboard() {
  const script = document.getElementById("nodePatchScript");
  try {
    const text = await navigator.clipboard.readText();
    if (script) {
      script.value = text;
    }
    commitNodeGraphScript(text);
  } catch {
    setNodeGraphScriptStatus("paste blocked: use keyboard paste", false);
  }
}

async function updateDefaultNodeGraphPreset() {
  if (!nodeGraphScriptReadyForGraphAction("update default")) {
    return false;
  }
  const text = serializeNodeGraphPatch();
  try {
    const response = await fetch("/api/presets/default", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: text,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }
    nodeGraphMvp.defaultPatch = cloneNodeGraphPatch(nodeGraphMvp.patch);
    setNodeGraphScriptStatus("default preset updated", true);
    return true;
  } catch (error) {
    if (saveNodeGraphLocalDefaultPreset(text)) {
      nodeGraphMvp.defaultPatch = cloneNodeGraphPatch(nodeGraphMvp.patch);
      setNodeGraphScriptStatus("local default preset updated", true);
      return true;
    }
    setNodeGraphScriptStatus(`default update failed: ${error.message}`, false);
    return false;
  }
}

async function handleUpdateDefaultNodeGraphPresetClick(event) {
  if (!confirmNodeGraphDefaultButtonClick(event.currentTarget, () => {
    setNodeGraphScriptStatus("click Confirm Default to update default preset", true);
  })) {
    return;
  }
  flashNodeGraphDefaultButtonSaved(event.currentTarget);
  await updateDefaultNodeGraphPreset();
}

function deleteSelectedNodeGraphItem() {
  if (!nodeGraphScriptReadyForGraphAction("delete")) {
    return;
  }
  const selection = nodeGraphMvp.selected;
  if (!selection) {
    return;
  }

  if (selection.type === "wire") {
    disconnectNodeGraphConnection(selection.index, selection.kind || "signal");
    return;
  }

  const selectedNodeIds = nodeGraphSelectedNodeIds(selection);
  const hideOnlyNodeIds = new Set();
  const removableNodeIds = new Set();
  for (const nodeId of selectedNodeIds) {
    const node = nodeGraphPatchNode(nodeId);
    if (!nodeGraphNodeCanBeDeleted(node)) {
      continue;
    }
    if (nodeGraphNodeDeleteHidesOnly(node)) {
      hideOnlyNodeIds.add(nodeId);
    } else {
      removableNodeIds.add(nodeId);
    }
  }

  if (hideOnlyNodeIds.size) {
    nodeGraphMvp.live.inputActive = false;
    stopNodeGraphLiveInputSource();
  }

  if (removableNodeIds.size) {
    const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
    patch.nodes = patch.nodes.filter((node) => !removableNodeIds.has(node.id));
    patch.bypassedNodes = patch.bypassedNodes.filter((nodeId) => !removableNodeIds.has(nodeId));
    patch.connections = patch.connections.filter(
      (connection) =>
        !removableNodeIds.has(connection.sourceNode) &&
        !removableNodeIds.has(connection.destinationNode),
    );
    patch.modulations = patch.modulations.filter(
      (modulation) =>
        !removableNodeIds.has(modulation.sourceNode) &&
        !removableNodeIds.has(modulation.destinationNode),
    );
    setNodeGraphSelection(null);
    commitNodeGraphPatch(patch, {
      status: removableNodeIds.size === 1 ? "module deleted" : "modules deleted",
    });
    renderNodeGraphLiveControls();
    return;
  }

  if (hideOnlyNodeIds.size) {
    setNodeGraphSelection(null);
    applyNodeGraphPatchToDom();
    drawNodeGraphWires();
    scheduleNodeGraphLivePlanSync();
    renderNodeGraphLiveControls();
    setNodeGraphScriptStatus("input module hidden; script preserved", true);
  }
}

function nodeGraphEventTargetIsEditable(target) {
  return target instanceof Element &&
    Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function nudgeSelectedNodeGraphModulesOnGrid(axis, direction) {
  const selectedNodeIds = new Set([...nodeGraphSelectedNodeIds()].filter((id) =>
    nodeGraphMvp.activeNodes.has(id),
  ));
  if (!selectedNodeIds.size) {
    return false;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  let movedCount = 0;
  for (const patchNode of patch.nodes) {
    if (!selectedNodeIds.has(patchNode.id)) {
      continue;
    }
    const gridKey = axis === "x" ? "gx" : "gy";
    const gridValue = Number(patchNode[gridKey]);
    patchNode[gridKey] = (Number.isFinite(gridValue) ? gridValue : 0) + direction;
    movedCount += 1;
  }
  if (!movedCount) {
    return false;
  }

  commitNodeGraphPatch(patch, {
    status: movedCount === 1 ? "module moved" : "modules moved",
  });
  return true;
}

function resizeSelectedNodeGraphModulesOnGrid(axis, delta) {
  const selectedNodeIds = new Set([...nodeGraphSelectedNodeIds()].filter((id) =>
    nodeGraphMvp.activeNodes.has(id),
  ));
  if (!selectedNodeIds.size) {
    return false;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  let changedCount = 0;
  for (const patchNode of patch.nodes) {
    if (!selectedNodeIds.has(patchNode.id)) {
      continue;
    }

    if (axis === "width") {
      const currentWidthGu = nodeGraphPatchNodeGridWidthUnits(patchNode);
      const nextWidthGu = normalizeNodeGraphModuleWidthUnits(patchNode.type, currentWidthGu + delta);
      if (nextWidthGu === currentWidthGu) {
        continue;
      }
      if (nextWidthGu === nodeGraphDefaultModuleGridWidthUnits(patchNode.type)) {
        delete patchNode.widthGu;
      } else {
        patchNode.widthGu = nextWidthGu;
      }
      changedCount += 1;
      continue;
    }

    const currentHeightGu = nodeGraphPatchNodeGridHeightUnits(patchNode);
    const nextHeightGu = normalizeNodeGraphModuleHeightUnits(
      patchNode.type,
      currentHeightGu + delta,
      patchNode.ui,
    );
    if (nextHeightGu === currentHeightGu) {
      continue;
    }
    if (nextHeightGu === nodeGraphModuleGridHeightUnitsForUi(patchNode.type, patchNode.ui)) {
      delete patchNode.heightGu;
    } else {
      patchNode.heightGu = nextHeightGu;
    }
    changedCount += 1;
  }

  if (!changedCount) {
    return false;
  }
  commitNodeGraphPatch(patch, {
    status: axis === "width" ? "module width changed" : "module height changed",
  });
  configureNodeSceneContextMenu("module");
  return true;
}

function handleNodeGraphKeydown(event) {
  if (event.key === "Escape" && document.getElementById("nodeWiringPanel")?.classList.contains("modular-only-view")) {
    setNodeGraphViewMode("modular");
    return;
  }
  if (event.key === "Escape" && !document.getElementById("nodeSceneContextMenu").hidden) {
    closeNodeSceneContextMenu();
    return;
  }
  if (nodeGraphEventTargetIsEditable(event.target)) {
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
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "g") {
    event.preventDefault();
    alignNodeGraphViewToGrid();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
    event.preventDefault();
    selectAllNodeGraphModules();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
    if (copySelectedNodeGraphModule()) {
      event.preventDefault();
    }
    return;
  }
  if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const shiftArrowSizeActions = {
      ArrowDown: ["height", 1],
      ArrowLeft: ["width", -1],
      ArrowRight: ["width", 1],
      ArrowUp: ["height", -1],
    };
    const action = shiftArrowSizeActions[event.key];
    if (action) {
      if (resizeSelectedNodeGraphModulesOnGrid(action[0], action[1])) {
        event.preventDefault();
      }
      return;
    }
  }
  if (!event.ctrlKey && !event.metaKey && !event.altKey) {
    const arrowMoveActions = {
      ArrowDown: ["y", 1],
      ArrowLeft: ["x", -1],
      ArrowRight: ["x", 1],
      ArrowUp: ["y", -1],
    };
    const action = arrowMoveActions[event.key];
    if (action) {
      if (nudgeSelectedNodeGraphModulesOnGrid(action[0], action[1])) {
        event.preventDefault();
      }
      return;
    }
  }
  if (event.key !== "Delete" && event.key !== "Backspace") {
    return;
  }

  deleteSelectedNodeGraphItem();
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

function clearNodeGraphLiveStatusTitle() {
  document.getElementById("nodeLiveStatus")?.removeAttribute("title");
}

function setNodeGraphLiveEngineStatus(text = "engine idle", state = "") {
  const status = document.getElementById("nodeLiveEngineStatus");
  if (!status) {
    return;
  }
  status.textContent = text;
  status.className = `pill ${state}`.trim();
}

function setNodeGraphLiveEngineTitle(text = "") {
  const status = document.getElementById("nodeLiveEngineStatus");
  if (!status) {
    return;
  }
  if (text) {
    status.title = text;
  } else {
    status.removeAttribute("title");
  }
}

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

function setNodeGraphLivePlanStatus(text = "plan idle", state = "") {
  const status = document.getElementById("nodeLivePlanStatus");
  if (!status) {
    return;
  }
  status.textContent = text;
  status.className = `pill ${state}`.trim();
}

function setNodeGraphLivePlanTitle(text = "") {
  const status = document.getElementById("nodeLivePlanStatus");
  if (!status) {
    return;
  }
  if (text) {
    status.title = text;
  } else {
    status.removeAttribute("title");
  }
}

function setNodeGraphLiveEvidence(kind = "idle", details = {}) {
  const planEvidence = nodeGraphMvp.live.planEvidence || {};
  const patchFingerprint = String(details.patchFingerprint || "");
  const currentPatchFingerprint = nodeGraphPatchFingerprint();
  nodeGraphMvp.live.lastEvidence = {
    active: Boolean(nodeGraphMvp.live.node || nodeGraphMvp.live.context),
    connectionCount: Number(details.connectionCount ?? planEvidence.connectionCount) || 0,
    currentPatchFingerprint,
    engine: nodeGraphMvp.live.usesWorklet ? "worklet" : nodeGraphMvp.live.runtime ? "fallback" : "idle",
    feedbackConnectionCount: Number(details.feedbackConnectionCount ?? planEvidence.feedbackConnectionCount) || 0,
    feedbackModulationCount: Number(details.feedbackModulationCount ?? planEvidence.feedbackModulationCount) || 0,
    feedbackModulations: [
      ...(details.feedbackModulations || planEvidence.feedbackModulations || []),
    ],
    feedbackSignals: [
      ...(details.feedbackSignals || planEvidence.feedbackSignals || []),
    ],
    kind,
    matchesCurrentPatch: patchFingerprint ? patchFingerprint === currentPatchFingerprint : false,
    message: String(details.message || ""),
    modulationCount: Number(details.modulationCount ?? planEvidence.modulationCount) || 0,
    nodeCount: Number(details.nodeCount ?? planEvidence.nodeCount) || 0,
    parameterCount: Number(details.parameterCount) || 0,
    patchFingerprint,
    planSerial: Number(details.planSerial) || nodeGraphMvp.live.planSerial || 0,
    sessionId: nodeGraphMvp.live.sessionId,
    stateReadCount: Number(details.stateReadCount ?? planEvidence.stateReadCount) || 0,
  };
}

function nodeGraphLiveDebug() {
  return {
    evidence: nodeGraphMvp.live.lastEvidence,
    hasContext: Boolean(nodeGraphMvp.live.context),
    hasNode: Boolean(nodeGraphMvp.live.node),
    inputMeter: document.getElementById("nodeLiveInputMeter")?.textContent || "",
    meter: document.getElementById("nodeLiveMeter")?.textContent || "",
    outputEnabled: Boolean(nodeGraphMvp.live.outputEnabled),
    outputToggleSerial: nodeGraphMvp.live.outputToggleSerial,
    contextState: nodeGraphMvp.live.context?.state || "",
    planStatus: document.getElementById("nodeLivePlanStatus")?.textContent || "",
    routeStatus: document.getElementById("nodeLiveRouteStatus")?.textContent || "",
    status: document.getElementById("nodeLiveStatus")?.textContent || "",
  };
}

function nodeGraphLivePlanStatusText(plan, serial = nodeGraphMvp.live.planSerial) {
  const serialText = serial ? ` #${serial}` : "";
  const feedbackCount = nodeGraphStateReadCount(plan);
  const feedbackText = feedbackCount ? ` / ${nodeGraphStateReadText(feedbackCount)}` : "";
  const fingerprintText = plan.patchFingerprint ? ` / fp ${plan.patchFingerprint}` : "";
  return `plan${serialText} ${plan.nodes.length} nodes / ${plan.connections.length} wires / ${plan.modulations.length} mods${feedbackText}${fingerprintText}`;
}

function nodeGraphLiveBlockedStatusText(kind, error) {
  const issues = Array.isArray(error?.issues) && error.issues.length
    ? error.issues
    : [error?.message || "unknown issue"];
  return `${kind} blocked ${issues.length} ${issues.length === 1 ? "issue" : "issues"}`;
}

function setNodeGraphLiveBlockedError(kind, error, options = {}) {
  const message = error?.message || "unknown issue";
  setNodeGraphLiveEvidence(`${kind}-blocked`, {
    message,
    patchFingerprint: nodeGraphPatchFingerprint(),
  });
  setNodeGraphLivePlanStatus(nodeGraphLiveBlockedStatusText(kind, error), "warn");
  setNodeGraphLivePlanTitle(message);
  setNodeGraphLiveInputMeter();
  setNodeGraphLiveMeter();
  if (options.schedule !== false) {
    setNodeGraphLiveScheduleStatus(`schedule blocked: ${message}`, "warn");
  }
  setNodeGraphLiveStatus("error", "warn");
  document.getElementById("nodeLiveStatus").title = message;
  renderNodeGraphLiveControls(Boolean(nodeGraphMvp.live.node));
}

function nodeGraphLivePlanScheduleTitle(order = []) {
  return order.length
    ? `worklet order: ${order.join(" -> ")}`
    : "";
}

function nodeGraphLivePlanSentStatusText(serial = nodeGraphMvp.live.planSerial) {
  const serialText = serial ? ` #${serial}` : "";
  return `plan${serialText} sent`;
}

function nodeGraphLivePlanEvidenceDetails(plan, details = {}) {
  return {
    connectionCount: plan.connections.length,
    feedbackConnectionCount: plan.feedbackConnections.length,
    feedbackModulationCount: plan.feedbackModulations.length,
    feedbackModulations: plan.feedbackModulations.map((modulation) =>
      `${modulation.sourceNode}.${modulation.sourcePort} -> ${modulation.destinationNode}.${modulation.destinationParam}`,
    ),
    feedbackSignals: plan.feedbackConnections.map((connection) =>
      `${connection.sourceNode}.${connection.sourcePort} -> ${connection.destinationNode}.${connection.destinationPort}`,
    ),
    modulationCount: plan.modulations.length,
    nodeCount: plan.nodes.length,
    patchFingerprint: plan.patchFingerprint,
    stateReadCount: nodeGraphStateReadCount(plan),
    ...details,
  };
}

function nodeGraphLiveParameterCount(nodes = []) {
  return (nodes || []).reduce(
    (total, node) => total + Object.keys(node.params || {}).length,
    0,
  );
}

function nodeGraphLiveParametersSentStatusText(nodes = [], serial = nodeGraphMvp.live.planSerial) {
  const serialText = serial ? ` #${serial}` : "";
  return `params${serialText} sent ${nodes.length} nodes / ${nodeGraphLiveParameterCount(nodes)} params`;
}

function nodeGraphLiveParametersAppliedStatusText(message) {
  const serial = Number(message.planSerial) || 0;
  const serialText = serial ? ` #${serial}` : "";
  const fingerprintText = message.patchFingerprint ? ` / fp ${message.patchFingerprint}` : "";
  return `params${serialText} ${Number(message.nodeCount) || 0} nodes / ${Number(message.parameterCount) || 0} params${fingerprintText}`;
}

function nodeGraphLivePlanAppliedStatusText(message) {
  const serial = Number(message.planSerial) || 0;
  const serialText = serial ? ` #${serial}` : "";
  const feedbackCount = (Number(message.feedbackConnectionCount) || 0) +
    (Number(message.feedbackModulationCount) || 0);
  const feedbackText = feedbackCount ? ` / ${nodeGraphStateReadText(feedbackCount)}` : "";
  const fingerprintText = message.patchFingerprint ? ` / fp ${message.patchFingerprint}` : "";
  return `plan${serialText} ${Number(message.nodeCount) || 0} nodes / ${Number(message.connectionCount) || 0} wires / ${Number(message.modulationCount) || 0} mods${feedbackText}${fingerprintText}`;
}

function setNodeGraphLiveMeter(peak = 0, rms = 0, clipCount = 0) {
  const meter = document.getElementById("nodeLiveMeter");
  if (!meter) {
    return;
  }
  const clipText = clipCount ? ` / ${nodeGraphOutputClipCountText(clipCount)}` : "";
  meter.textContent = `live peak ${peak.toFixed(3)} / rms ${rms.toFixed(3)}${clipText}`;
  meter.dataset.liveClips = String(clipCount);
  meter.className = `pill ${clipCount ? "warn" : peak > 0.001 ? "good" : ""}`.trim();
}

function setNodeGraphLiveInputMeter(peak = 0, rms = 0) {
  const meter = document.getElementById("nodeLiveInputMeter");
  const safePeak = Number.isFinite(Number(peak)) ? Math.max(0, Math.min(1, Number(peak))) : 0;
  const safeRms = Number.isFinite(Number(rms)) ? Math.max(0, Math.min(1, Number(rms))) : 0;
  nodeGraphMvp.live.inputMeterPeak = safePeak;
  nodeGraphMvp.live.inputMeterRms = safeRms;
  if (!meter) {
    syncNodeGraphInputModuleLiveState();
    return;
  }
  meter.textContent = `input peak ${safePeak.toFixed(3)} / rms ${safeRms.toFixed(3)}`;
  meter.className = `pill ${safePeak > 0.001 ? "good" : ""}`.trim();
  syncNodeGraphInputModuleLiveState();
  updateNodeGraphLiveInputTestStatus();
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

function setNodeGraphLiveScheduleStatus(text, state = "") {
  const status = document.getElementById("nodeLiveRouteStatus");
  if (!status) {
    return;
  }
  status.textContent = text;
  status.className = `pill ${state}`.trim();
}

function setNodeGraphLiveInputStatus(state, message = "") {
  const status = document.getElementById("nodeLiveInputStatus");
  nodeGraphMvp.live.inputStatus = state;
  if (!status) {
    return;
  }
  const textByState = {
    blocked: "input blocked",
    connected: "input connected",
    off: "input off",
    requesting: "input asking",
    wired: "input wired",
    unwired: "input unwired",
  };
  const classByState = {
    blocked: "error",
    connected: "good",
    off: "",
    requesting: "warn",
    wired: "good",
    unwired: "warn",
  };
  status.textContent = textByState[state] || "input off";
  status.className = `pill ${classByState[state] || ""}`.trim();
  if (message) {
    status.title = message;
  } else {
    status.removeAttribute("title");
  }
  syncNodeGraphInputModuleLiveState();
  updateNodeGraphLiveInputTestStatus();
}

function nodeGraphLiveMicStatusText(state = nodeGraphMvp.live.micStatus) {
  switch (state) {
    case "armed":
      return "mic waits";
    case "blocked":
      return "mic blocked";
    case "connected":
      return "mic live";
    case "requesting":
      return "mic asking";
    default:
      return "mic off";
  }
}

function nodeGraphLivePermissionStatusText(state = nodeGraphMvp.live.inputPermissionStatus) {
  switch (state) {
    case "denied":
      return "mic blocked";
    case "granted":
      return "mic allowed";
    case "prompt":
      return "mic ask ready";
    case "unsupported":
      return "mic permission unknown";
    default:
      return "mic unknown";
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

function syncNodeGraphInputModuleLiveState() {
  for (const node of document.querySelectorAll('.dsp-node[data-node-type="audioInput"]')) {
    const badge = node.querySelector(".node-live-input-state-badge");
    if (!badge) {
      continue;
    }
    const state = nodeGraphMvp.live.inputActive ? nodeGraphMvp.live.micStatus : "off";
    badge.textContent = nodeGraphLiveMicStatusText(state);
    badge.dataset.micState = state;
    const peak = Math.max(0, Math.min(1, Number(nodeGraphMvp.live.inputMeterPeak) || 0));
    badge.dataset.inputPeak = peak.toFixed(3);
    badge.style.setProperty("--node-live-input-peak", `${Math.round(peak * 100)}%`);
    badge.setAttribute("title", document.getElementById("nodeLiveMicStatus")?.title || "");
  }
}

function setNodeGraphLiveMicStatus(state, message = "") {
  const status = document.getElementById("nodeLiveMicStatus");
  nodeGraphMvp.live.micStatus = state;
  if (!status) {
    return;
  }
  const textByState = {
    armed: "mic waits output",
    blocked: "mic blocked",
    connected: "mic live",
    off: "mic off",
    requesting: "mic asking",
  };
  const classByState = {
    armed: "warn",
    blocked: "error",
    connected: "good",
    off: "",
    requesting: "warn",
  };
  const permissionText = state === "armed" || state === "off"
    ? nodeGraphLivePermissionStatusText()
    : "";
  status.textContent = permissionText || textByState[state] || "mic off";
  status.className = `pill ${classByState[state] || ""}`.trim();
  if (message) {
    status.title = message;
  } else {
    status.removeAttribute("title");
  }
  syncNodeGraphInputModuleLiveState();
  updateNodeGraphLiveInputTestStatus();
}

function updateNodeGraphLiveInputTestStatus() {
  const status = document.getElementById("nodeLiveInputTestStatus");
  if (!status) {
    return;
  }
  const inputActive = Boolean(nodeGraphMvp.live.inputActive);
  const inputRouteState = nodeGraphLiveInputRouteState();
  const outputEnabled = Boolean(nodeGraphMvp.live.outputEnabled);
  const micStatus = nodeGraphMvp.live.micStatus || "off";
  const permissionStatus = nodeGraphMvp.live.inputPermissionStatus || "unknown";
  const peak = Number(nodeGraphMvp.live.inputMeterPeak) || 0;
  let text = "input test off";
  let state = "";
  let title = "Press Input to show the live input module, then wire it manually.";
  if (inputActive && inputRouteState.state === "unwired") {
    text = "wire input";
    state = "warn";
    title = inputRouteState.message;
  } else if (micStatus === "blocked" || (inputActive && permissionStatus === "denied")) {
    text = "fix mic";
    state = "error";
    title = document.getElementById("nodeLiveMicStatus")?.title ||
      "Microphone permission is blocked in the browser.";
  } else if (inputActive && !outputEnabled) {
    text = permissionStatus === "granted"
      ? "start output"
      : nodeGraphLivePermissionStatusText(permissionStatus);
    state = permissionStatus === "granted" ? "good" : "warn";
    title = permissionStatus === "granted"
      ? "Microphone permission is already allowed. Press Output to start live input."
      : "Press Output to start live audio and request microphone permission.";
  } else if (micStatus === "requesting") {
    text = "allow mic";
    state = "warn";
    title = "Respond to the browser microphone permission prompt.";
  } else if (micStatus === "connected" && peak > 0.001) {
    text = "input signal";
    state = "good";
    title = "Microphone signal is reaching the live input module.";
  } else if (micStatus === "connected") {
    text = "listening";
    state = "warn";
    title = "Microphone is connected; make sound to confirm signal.";
  } else if (inputActive) {
    text = "ready";
    state = "warn";
    title = inputRouteState.message || "Input is visible. Start Output to request microphone permission.";
  }
  status.textContent = text;
  status.className = `pill ${state}`.trim();
  status.title = title;
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

function nodeGraphLiveInputRouteState() {
  const inputNodeIds = new Set(
    (nodeGraphMvp.patch.nodes || [])
      .filter((node) => node.type === "audioInput")
      .map((node) => node.id),
  );
  if (!inputNodeIds.size) {
    return {
      message: "Live INPUT module is visible. Wire it into Output to hear it.",
      state: "unwired",
    };
  }
  const hasSignalRoute = (nodeGraphMvp.patch.connections || []).some((connection) =>
    inputNodeIds.has(connection.sourceNode)
  );
  const hasModulationRoute = (nodeGraphMvp.patch.modulations || []).some((modulation) =>
    inputNodeIds.has(modulation.sourceNode)
  );
  if (hasSignalRoute || hasModulationRoute) {
    return {
      message: hasSignalRoute
        ? "Live INPUT is wired into the patch."
        : "Live INPUT is wired as parameter modulation.",
      state: "wired",
    };
  }
  return {
    message: "Live INPUT module is visible but has no outgoing wires.",
    state: "unwired",
  };
}

function nodeGraphLiveOutputIsActive(running = Boolean(nodeGraphMvp.live.node)) {
  const statusText = document.getElementById("nodeLiveStatus")?.textContent || "";
  const starting = statusText === "starting";
  return (running || starting) && statusText !== "error";
}

function nodeGraphLiveOutputButtonTitle(outputActive, outputEnabled) {
  const inputActive = Boolean(nodeGraphMvp.live.inputActive);
  const inputStreaming = Boolean(nodeGraphMvp.live.inputStream);
  if (outputActive && inputStreaming) {
    return nodeGraphTooltipText("audio.liveOutputRunningWithInput");
  }
  if (outputActive) {
    return nodeGraphTooltipText("audio.liveOutputRunning");
  }
  if (outputEnabled && inputActive) {
    return nodeGraphTooltipText("audio.liveOutputPermissionPending");
  }
  if (outputEnabled) {
    return nodeGraphTooltipText("audio.liveOutputRequested");
  }
  if (inputActive) {
    return nodeGraphTooltipText("audio.liveOutputWithInput");
  }
  return nodeGraphTooltipText("audio.liveOutputStart");
}

function syncNodeGraphOutputBypassButton(outputEnabled = Boolean(nodeGraphMvp.live.outputEnabled)) {
  const outputNode = nodeGraphNodeElement("output");
  const bypassButton = outputNode?.querySelector(".node-bypass-button");
  if (!bypassButton || !outputNode) {
    return;
  }
  const bypassed = !outputEnabled;
  outputNode.classList.toggle("bypassed", bypassed);
  bypassButton.setAttribute("aria-pressed", bypassed ? "true" : "false");
  bypassButton.textContent = nodeGraphBypassGlyph(bypassed);
  nodeGraphApplyTooltip(bypassButton, bypassed ? "module.outputOn" : "module.outputOff");
}

function renderNodeGraphLiveControls(running = Boolean(nodeGraphMvp.live.node)) {
  const statusText = document.getElementById("nodeLiveStatus")?.textContent || "";
  const starting = statusText === "starting";
  const outputActive = nodeGraphLiveOutputIsActive(running);
  const outputEnabled = Boolean(nodeGraphMvp.live.outputEnabled);
  const inputButton = document.getElementById("nodeLiveInputButton");
  const outputButton = document.getElementById("nodeLiveOutputButton");
  const labelLiveToggle = (button, name, active) => {
    if (!button) {
      return;
    }
    const stateText = active ? "(Live)" : "(Off)";
    button.replaceChildren();
    for (const text of [name, stateText]) {
      const line = document.createElement("span");
      line.textContent = text;
      button.append(line);
    }
  };
  if (inputButton) {
    const inputActive = Boolean(nodeGraphMvp.live.inputActive);
    const inputStreaming = Boolean(nodeGraphMvp.live.inputStream);
    if (!inputActive && !["blocked", "off"].includes(nodeGraphMvp.live.inputStatus)) {
      setNodeGraphLiveInputStatus("off");
    } else if (
      inputActive &&
      !inputStreaming &&
      !nodeGraphMvp.live.node &&
      !["blocked", "requesting"].includes(nodeGraphMvp.live.inputStatus)
    ) {
      const routeState = nodeGraphLiveInputRouteState();
      setNodeGraphLiveInputStatus(routeState.state, routeState.message);
    } else if (inputStreaming && nodeGraphMvp.live.inputStatus !== "connected") {
      setNodeGraphLiveInputStatus("connected", "Live INPUT is connected to the browser audio engine.");
    }
    if (!inputActive && !["blocked", "off"].includes(nodeGraphMvp.live.micStatus)) {
      setNodeGraphLiveMicStatus("off");
    } else if (inputStreaming && nodeGraphMvp.live.micStatus !== "connected") {
      setNodeGraphLiveMicStatus("connected", "Browser microphone stream is connected.");
    } else if (
      inputActive &&
      !inputStreaming &&
      !nodeGraphMvp.live.node &&
      !["blocked", "requesting"].includes(nodeGraphMvp.live.micStatus)
    ) {
      setNodeGraphLiveMicStatus("armed", "Start OUTPUT to request browser microphone permission.");
    }
    inputButton.classList.toggle("active", inputActive);
    inputButton.setAttribute("aria-pressed", inputActive ? "true" : "false");
    labelLiveToggle(inputButton, "Input", inputActive);
    inputButton.title = inputStreaming
      ? nodeGraphTooltipText("audio.liveInputConnected")
      : inputActive
        ? nodeGraphTooltipText("audio.liveInputVisible")
        : nodeGraphTooltipText("audio.liveInputShow");
  }
  if (outputButton) {
    outputButton.disabled = starting;
    outputButton.classList.toggle("active", outputEnabled);
    outputButton.setAttribute("aria-pressed", outputEnabled ? "true" : "false");
    labelLiveToggle(outputButton, "Output", outputEnabled);
    outputButton.title = nodeGraphLiveOutputButtonTitle(outputActive, outputEnabled);
  }
  syncNodeGraphOutputBypassButton(outputEnabled);
  syncNodeGraphInputModuleLiveState();
  updateNodeGraphLiveInputTestStatus();
  scheduleNodeLiveToggleTextFit();
}

function nodeGraphLiveOutputStartCancelled(serial) {
  return serial !== nodeGraphMvp.live.outputToggleSerial || !nodeGraphMvp.live.outputEnabled;
}

function toggleNodeGraphLiveInput() {
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
  setNodeGraphLiveOutputEnabled(!nodeGraphMvp.live.outputEnabled);
}

function nodeGraphBuildLivePlan() {
  const compiled = compileNodeGraphExecutionPlan();
  if (!compiled.valid) {
    const error = new Error(compiled.issues.join(", "));
    error.issues = [...compiled.issues];
    throw error;
  }

  const activeNodeIds = nodeGraphActiveNodeIds(compiled);
  const activeSignalConnections = nodeGraphActiveSignalConnections(compiled)
    .map((connection) => ({ ...connection }));
  const activeModulations = nodeGraphActiveModulations(compiled)
    .map((modulation) => ({ ...modulation }));

  return {
    connections: activeSignalConnections,
    feedbackConnections: compiled.feedbackConnections.map((connection) => ({ ...connection })),
    feedbackModulations: compiled.feedbackModulations.map((modulation) => ({ ...modulation })),
    modulations: activeModulations,
    nodes: nodeGraphBuildLiveParameterNodes(activeNodeIds),
    order: [...compiled.order],
    outputNode: compiled.outputNode,
    patchFingerprint: nodeGraphPatchFingerprint(),
    sourceNodes: [...compiled.sourceNodes],
  };
}

function nodeGraphBuildLiveParameterNodes(activeNodeIds = null) {
  const activeIds = activeNodeIds instanceof Set ? activeNodeIds : null;
  return nodeGraphMvp.patch.nodes
    .filter((node) => !activeIds || activeIds.has(node.id))
    .map((node) => {
      const definition = nodeGraphModuleDefinitions[node.type];
      const params = {};
      const paramMeta = {};
      for (const parameter of definition.parameters || []) {
        const value = nodeGraphReadPatchParameterValue(node, parameter.key);
        params[parameter.key] = Number.isFinite(value)
          ? value
          : nodeGraphParameterFallback(node.type, parameter.key);
        paramMeta[parameter.key] = nodeGraphReadPatchParameterMetadata(node, parameter.key);
      }
      return {
        id: node.id,
        paramMeta,
        params,
        type: node.type,
      };
    });
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
  const spiralStates = new Map();
  const smoothers = new Map();
  const triangleStates = new Map();
  for (const node of plan.nodes || []) {
    if (node.type === "osc") {
      phases.set(node.id, 0);
      triangleStates.set(node.id, 0);
    }
    if (node.type === "osc" || node.type === "noise") {
      noiseSeeds.set(node.id, nodeGraphStableSeed(node.id));
    }
    if (node.type === "spiral") {
      spiralStates.set(node.id, createJerobeamSpiralState());
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
    meterClipCount: 0,
    meterPeak: 0,
    meterSamples: 0,
    meterSquareSum: 0,
    modulationConnections,
    nodeOutputs: new Map((plan.nodes || []).map((node) => [node.id, 0])),
    nodes,
    noiseSeeds,
    order: [...(plan.order || [])],
    outputNode: plan.outputNode || "output",
    phases,
    smoothers,
    spiralStates,
    triangleStates,
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
  if (!runtime.nodeOutputs) {
    runtime.nodeOutputs = new Map();
  }
  if (!runtime.spiralStates) {
    runtime.spiralStates = new Map();
  }
  if (!runtime.triangleStates) {
    runtime.triangleStates = new Map();
  }
  for (const node of plan.nodes || []) {
    if (!runtime.nodeOutputs.has(node.id)) {
      runtime.nodeOutputs.set(node.id, 0);
    }
    if (node.type === "osc" && !runtime.phases.has(node.id)) {
      runtime.phases.set(node.id, 0);
    }
    if (node.type === "osc" && !runtime.triangleStates.has(node.id)) {
      runtime.triangleStates.set(node.id, 0);
    }
    if ((node.type === "osc" || node.type === "noise") && !runtime.noiseSeeds.has(node.id)) {
      runtime.noiseSeeds.set(node.id, nodeGraphStableSeed(node.id));
    }
    if (node.type === "spiral" && !runtime.spiralStates.has(node.id)) {
      runtime.spiralStates.set(node.id, createJerobeamSpiralState());
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
  for (const id of [...runtime.triangleStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.triangleStates.delete(id);
    }
  }
  for (const id of [...runtime.noiseSeeds.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.noiseSeeds.delete(id);
    }
  }
  for (const id of [...runtime.nodeOutputs.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.nodeOutputs.delete(id);
    }
  }
  for (const id of [...runtime.spiralStates.keys()]) {
    if (!nodeIds.has(id)) {
      runtime.spiralStates.delete(id);
    }
  }
  for (const key of [...runtime.smoothers.keys()]) {
    const [nodeId, parameter] = key.split(".");
    if (!nodeIds.has(nodeId) || !runtime.nodes.get(nodeId)?.params || !(parameter in runtime.nodes.get(nodeId).params)) {
      runtime.smoothers.delete(key);
    }
  }
}

function updateNodeGraphLiveRuntimeParameters(runtime, nodes) {
  if (!runtime) {
    return;
  }
  for (const node of nodes || []) {
    const current = runtime.nodes.get(node.id);
    if (!current) {
      continue;
    }
    current.params = { ...(node.params || {}) };
    current.paramMeta = cloneNodeGraphParamMeta(node.paramMeta);
    for (const [key, value] of Object.entries(current.params || {})) {
      const smootherKey = nodeGraphParameterKey(node.id, key);
      const metadata = current.paramMeta?.[key];
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

function readNodeGraphRuntimeOutput(runtime, frameValues, nodeId, port = "Out") {
  const output = frameValues?.has(nodeId)
    ? frameValues.get(nodeId)
    : runtime.nodeOutputs?.get(nodeId);
  if (output && typeof output === "object") {
    return Number(output[port] ?? output.Out ?? 0) || 0;
  }
  return Number(output) || 0;
}

function normalizeNodeGraphParameterOutputValue(value, metadata = {}) {
  return nodeGraphParameterValueToNormalizedSignal(value, metadata);
}

function nodeGraphParameterSkewExponent(metadata = {}) {
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
  const normalizedMid = clampNodeSliderValue((mid - min) / range, 0.000001, 0.999999);
  return Math.log(normalizedMid) / Math.log(0.5);
}

function nodeGraphParameterValueToNormalizedSignal(value, metadata = {}) {
  const min = Number(metadata.min);
  const max = Number(metadata.max);
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) {
    return 0;
  }
  const bounded = metadata.wraparound
    ? wrapNodeSliderValue(Number(value) || 0, min, max)
    : clampNodeSliderValue(Number(value) || 0, min, max);
  const normalizedValue = clampNodeSliderValue((bounded - min) / range, 0, 1);
  return clampNodeSliderValue(
    normalizedValue ** (1 / nodeGraphParameterSkewExponent(metadata)),
    0,
    1,
  );
}

function nodeGraphNormalizedSignalToParameterValue(signal, metadata = {}) {
  const min = Number(metadata.min);
  const max = Number(metadata.max);
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) {
    return Number.isFinite(min) ? min : 0;
  }
  const normalizedSignal = metadata.wraparound
    ? wrapNodeSliderValue(Number(signal) || 0, 0, 1)
    : clampNodeSliderValue(Number(signal) || 0, 0, 1);
  const normalizedValue = normalizedSignal ** nodeGraphParameterSkewExponent(metadata);
  return nodeGraphApplyParameterBounds(min + range * normalizedValue, metadata);
}

function readNodeGraphRuntimePortOutput(runtime, frameValues, nodeId, port = "Out", frame = 0, frames = 1) {
  const node = runtime.nodes?.get(nodeId);
  const parameter = nodeGraphParameterOutputPort(node?.type, port);
  if (!parameter) {
    return readNodeGraphRuntimeOutput(runtime, frameValues, nodeId, port);
  }
  const metadata = node?.paramMeta?.[port] || {};
  const value = readNodeGraphLiveSmoothedParam(
    runtime,
    node,
    port,
    nodeGraphParameterFallback(node?.type, port),
    frame,
    frames,
  );
  return normalizeNodeGraphParameterOutputValue(value, metadata);
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
  const modulations = runtime.modulationConnections?.get(nodeGraphParameterKey(node?.id, key)) || [];
  const modulationSignal = modulations.reduce(
    (sum, modulation) =>
      sum + clampNodeSliderValue(readNodeGraphRuntimePortOutput(
        runtime,
        frameValues,
        modulation.sourceNode,
        modulation.sourcePort,
        frame,
        frames,
      ), 0, 1),
    0,
  );
  const baseSignal = nodeGraphParameterValueToNormalizedSignal(base, metadata);
  return nodeGraphNormalizedSignalToParameterValue(baseSignal + modulationSignal, metadata);
}

function nodeGraphPhaseRadians(value) {
  return wrapNodeSliderValue(Number(value) || 0, 0, 1) * Math.PI * 2;
}

function nextNodeGraphNoiseSample(runtime, nodeId) {
  const seed = (Math.imul(1664525, runtime.noiseSeeds.get(nodeId) || 0x12345678) + 1013904223) >>> 0;
  runtime.noiseSeeds.set(nodeId, seed);
  return (seed / 0xffffffff) * 2 - 1;
}

function nodeGraphPolyBlep(phaseCycle, phaseIncrement) {
  const dt = clampNodeSliderValue(Math.abs(Number(phaseIncrement) || 0), 1e-6, 0.5);
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

function nodeGraphPolyBlepSquare(phaseCycle, phaseIncrement) {
  let value = phaseCycle < 0.5 ? 1 : -1;
  value += nodeGraphPolyBlep(phaseCycle, phaseIncrement);
  value -= nodeGraphPolyBlep(wrapNodeSliderValue(phaseCycle + 0.5, 0, 1), phaseIncrement);
  return value;
}

function nodeGraphOscillatorWaveformSample(runtime, nodeId, phase, phaseIncrement, waveform) {
  const phaseCycle = wrapNodeSliderValue(phase / (Math.PI * 2), 0, 1);
  switch (Math.round(Number(waveform) || 0)) {
    case 1:
      return nodeGraphPolyBlepSquare(phaseCycle, phaseIncrement);
    case 2:
      {
        const triangle = runtime.triangleStates?.get(nodeId) || 0;
        const nextTriangle = (triangle + nodeGraphPolyBlepSquare(phaseCycle, phaseIncrement) * phaseIncrement * 4) * 0.995;
        runtime.triangleStates?.set(nodeId, clampNodeSliderValue(nextTriangle, -1, 1));
        return clampNodeSliderValue(nextTriangle, -1, 1);
      }
    case 3:
      return Math.sin(phase);
    case 4:
      return nextNodeGraphNoiseSample(runtime, nodeId);
    case 0:
    default:
      return phaseCycle * 2 - 1 - nodeGraphPolyBlep(phaseCycle, phaseIncrement);
  }
}

function createJerobeamSpiralState() {
  return {
    morph: 0,
    phase: 0,
    position: 0,
    rotX: 0,
    rotY: 0,
    zHistory: 0,
  };
}

function spiralWrap01(value) {
  return value - Math.floor(value);
}

function spiralFmod(value, divisor) {
  return value - Math.trunc(value / divisor) * divisor;
}

function spiralTrisaw(phase, sharp) {
  const wrapped = spiralWrap01(phase);
  const warp = Math.max(0.001, Math.min(0.999, sharp));
  return wrapped < warp ? wrapped / warp : (1 - wrapped) / (1 - warp);
}

function spiralNextPhasor(state, key, frequency, offset, sampleRate, bipolar = false) {
  const base = Number(state[key]) || 0;
  const current = spiralWrap01(base + offset);
  state[key] = spiralWrap01(base + frequency / sampleRate);
  return bipolar ? current * 2 - 1 : current;
}

function spiralRotate(inX, inY, inZ, rotX, rotY) {
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

function spiralShape(lophas, phasor, dense, div, morph) {
  const clampMorph01 = clampNodeSliderValue(morph, 0, 1);
  const clampMorph02 = clampNodeSliderValue(morph, 0, 2);
  const formula001 = nodeGraphPiOver2 * (lophas - 0.5) * clampMorph02 + nodeGraphPiOver4;
  let loSin = Math.sin(formula001);
  let loCos = Math.cos(formula001);
  const loX = 0;
  const formula002 = Math.pow(clampMorph01, 2);
  const oneZDiv = 1 / div;
  const loY = formula002 * (1 - oneZDiv * loSin);
  const loZ = formula002 * (1 - oneZDiv * loCos);

  const formula003 = Math.PI / (2 + 6 * (1 - clampMorph01)) * (lophas - 0.5) * clampMorph02 + nodeGraphPiOver4;
  loSin = Math.sin(formula003);
  loCos = Math.cos(formula003);

  const tauPhasor = nodeGraphTau * phasor;
  const sp0Sin = Math.sin(tauPhasor);
  const sp0Cos = Math.cos(tauPhasor);
  const spiral0X = sp0Sin;
  const spiral0Y = sp0Cos * loSin;
  const spiral0Z = sp0Cos * loCos;

  let sp1Sin = Math.sin(dense * tauPhasor - nodeGraphPiOver2);
  const sp1Cos = Math.cos(dense * tauPhasor - nodeGraphPiOver2);
  sp1Sin *= -1;
  const sp1SinTimesSp0Sin = sp1Sin * sp0Sin;
  const spiral1X = div * sp1SinTimesSp0Sin;
  const spiral1Y = div * ((sp1Sin * sp0Cos) * loSin + sp1Cos * loCos);
  const spiral1Z = div * (sp1Cos * -loSin + (sp1Sin * sp0Cos) * loCos);

  let sp2Cos = Math.sin(dense * dense * nodeGraphTau * phasor);
  const sp2Sin = Math.cos(dense * dense * nodeGraphTau * phasor);
  sp2Cos *= -1;
  const divSquared = div * div;
  const spiral2X = divSquared * (sp2Cos * sp0Cos + sp2Sin * sp1SinTimesSp0Sin);
  const spiral2Y = divSquared * ((sp2Cos * -sp0Sin + sp2Sin * sp1Sin * sp0Cos) * loSin + (sp2Sin * sp1Cos) * loCos);
  const spiral2Z = divSquared * ((sp2Sin * sp1Cos) * -loSin + (sp2Cos * -sp0Sin + sp2Sin * sp1Sin * sp0Cos) * loCos);

  let waveX = loX + spiral0X + spiral1X + spiral2X;
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
  x = x * Math.sin(nodeGraphPiOver4) * y;
  waveX -= x;
  waveY += x;

  return spiralRotate(waveX, waveY, waveZ, 0, 0);
}

function spiralRender(inX, inY, inZ, zDepth) {
  const formula = zDepth * 1.25 * (inZ / 2 + 0.5);
  const multiplier = 1 + zDepth;
  return {
    left: (inX - formula * inX) * multiplier,
    right: (inY - formula * inY) * multiplier,
  };
}

function jerobeamSpiralSample(options) {
  const {
    density,
    frequency,
    morph,
    morphSpeed,
    position,
    positionSpeed,
    rotX,
    rotXSpeed,
    rotY,
    rotYSpeed,
    sampleRate,
    sharp,
    sharpCurve,
    sharpCurveMult,
    size,
    state,
    zAmount,
    zDepth,
  } = options;
  const dense = Math.max(Math.abs(density), 1e-6);
  const div = Math.max(size, 0.1);
  const logDense = Math.log(dense);
  const zDarkness = Math.pow(Math.pow(zAmount, 2) * 5 + 1, state.zHistory || 0);
  const mainPhasor = spiralNextPhasor(state, "phase", frequency * zDarkness, 0, sampleRate);
  const fphasEnds = spiralTrisaw(mainPhasor, sharp);
  const fphasMids = sharpCurveMult * (Math.asin((Math.asin(fphasEnds * 2 - 1) / Math.PI + 0.5) * 2 - 1) / Math.PI + 0.5);
  const lophas = sharpCurve * fphasMids + (1 - sharpCurve) * fphasEnds;
  const morphPhasor = spiralNextPhasor(state, "morph", morphSpeed, morph, sampleRate, true) + 0.5;
  let morph2 = morphPhasor + 1;
  if (morph2 > 1.5) {
    morph2 -= 2;
  }
  const fmodLophas = spiralFmod(lophas - 0.5, 1);
  let phas = spiralFmod(fmodLophas * Math.exp(morphPhasor * logDense) / 4 + 0.375, 1);
  const phas2 = spiralFmod(fmodLophas * Math.exp(morph2 * logDense) / 4 + 0.375, 1);
  phas += spiralNextPhasor(state, "position", positionSpeed, position, sampleRate);
  const wave1 = spiralShape(lophas, phas, dense, div, morphPhasor);
  const wave2 = spiralShape(lophas, phas2, dense, div, morph2);
  const switchAmount = Math.sin(Math.PI * morphPhasor) / 2 + 0.5;
  let waveX = wave1.x * switchAmount + wave2.x * (1 - switchAmount);
  let waveY = wave1.y * switchAmount + wave2.y * (1 - switchAmount);
  let waveZ = wave1.z * switchAmount + wave2.z * (1 - switchAmount);
  let volumeCorrection = 1 / (1 + div + div * div);
  const halfZDepth = zDepth / 2;
  volumeCorrection = volumeCorrection + halfZDepth - volumeCorrection * halfZDepth;
  waveX *= volumeCorrection;
  waveY *= volumeCorrection;
  waveZ *= volumeCorrection;
  waveY += 0.25;
  waveZ += 0.36;
  const rotated = spiralRotate(
    waveX,
    waveY,
    waveZ,
    -nodeGraphTau * spiralNextPhasor(state, "rotX", rotXSpeed, rotX, sampleRate),
    nodeGraphTau * spiralNextPhasor(state, "rotY", rotYSpeed, rotY, sampleRate) - nodeGraphPiOver2,
  );
  const stereo = spiralRender(rotated.x, rotated.y, rotated.z, zDepth);
  state.zHistory = rotated.z;
  return { ...stereo, x: rotated.x, y: rotated.y, z: rotated.z };
}

function evaluateNodeGraphPlanFrame(runtime, sampleRate, frame, frames) {
  const frameValues = new Map();
  const mixInput = (nodeId, port = "In") => (runtime.inputConnections.get(`${nodeId}.${port}`) || []).reduce(
    (sum, connection) => sum + readNodeGraphRuntimePortOutput(
      runtime,
      frameValues,
      connection.sourceNode,
      connection.sourcePort,
      frame,
      frames,
    ),
    0,
  );

  for (const nodeId of runtime.order || []) {
    const node = runtime.nodes.get(nodeId);
    let value = 0;

    if (node?.type === "audioInput") {
      const input = runtime.externalInput || {};
      const leftChannel = input.left || input.right || null;
      const rightChannel = input.right || input.left || null;
      const left = Number(leftChannel?.[frame]) || 0;
      const right = Number(rightChannel?.[frame]) || left;
      const level = readNodeGraphLiveEffectiveParam(
        runtime,
        node,
        "level",
        0.35,
        frame,
        frames,
        frameValues,
      );
      value = {
        Left: left * level,
        Out: ((left + right) * 0.5) * level,
        Right: right * level,
      };
    } else if (node?.type === "osc") {
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
      const phaseIncrement = frequency / sampleRate;
      value = nodeGraphOscillatorWaveformSample(
        runtime,
        nodeId,
        phase + phaseOffset,
        phaseIncrement,
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
    } else if (node?.type === "spiral") {
      const state = runtime.spiralStates.get(nodeId) || createJerobeamSpiralState();
      runtime.spiralStates.set(nodeId, state);
      const read = (key, fallback) => readNodeGraphLiveEffectiveParam(
        runtime,
        node,
        key,
        fallback,
        frame,
        frames,
        frameValues,
      );
      const spiral = jerobeamSpiralSample({
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
        sampleRate,
        sharp: read("sharp", 0.5),
        sharpCurve: read("sharpCurve", 0),
        sharpCurveMult: read("sharpCurveMult", 1),
        size: read("size", 0.5),
        state,
        zAmount: read("zAmount", 0),
        zDepth: read("zDepth", 0),
      });
      const level = read("level", 0.35);
      value = {
        X: spiral.x * level,
        Y: spiral.y * level,
        Z: spiral.z * level,
      };
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
    runtime.nodeOutputs?.set(nodeId, value);
  }

  const outputNode = runtime.nodes.get(runtime.outputNode || "output");
  const outputVolume = outputNode
    ? readNodeGraphLiveEffectiveParam(
      runtime,
      outputNode,
      "volume",
      1,
      frame,
      frames,
      frameValues,
    )
    : 1;

  return {
    frameValues,
    left: mixInput(runtime.outputNode || "output", "Left") * outputVolume,
    right: mixInput(runtime.outputNode || "output", "Right") * outputVolume,
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
  runtime.externalInput = {
    left: event.inputBuffer?.numberOfChannels > 0
      ? event.inputBuffer.getChannelData(0)
      : null,
    right: event.inputBuffer?.numberOfChannels > 1
      ? event.inputBuffer.getChannelData(1)
      : null,
  };
  for (let frame = 0; frame < frames; frame += 1) {
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
    if (nodeGraphOutputSampleClipped(frameOutput.left)) {
      runtime.meterClipCount += 1;
    }
    if (nodeGraphOutputSampleClipped(frameOutput.right)) {
      runtime.meterClipCount += 1;
    }
    const left = nodeGraphClampOutputSample(frameOutput.left);
    const right = nodeGraphClampOutputSample(frameOutput.right);
    const value = Math.max(Math.abs(left), Math.abs(right));
    runtime.meterPeak = Math.max(runtime.meterPeak, Math.abs(value));
    runtime.meterSquareSum += (left * left + right * right) * 0.5;
    runtime.meterSamples += 1;
    for (let channel = 0; channel < output.numberOfChannels; channel += 1) {
      output.getChannelData(channel)[frame] = channel === 0 ? left : right;
    }
  }
  runtime.externalInput = null;
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
    );
    runtime.meterCounter = 0;
    nodeGraphMvp.live.inputMeterPeak = 0;
    nodeGraphMvp.live.inputMeterSamples = 0;
    nodeGraphMvp.live.inputMeterSquareSum = 0;
    runtime.meterClipCount = 0;
    runtime.meterPeak = 0;
    runtime.meterSamples = 0;
    runtime.meterSquareSum = 0;
  }
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
    );
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

function sendNodeGraphLivePlan() {
  if (!nodeGraphMvp.live.node && !nodeGraphMvp.live.context) {
    return;
  }

  try {
    const plan = nodeGraphBuildLivePlan();
    nodeGraphMvp.live.activeNodeIds = new Set(plan.order);
    nodeGraphMvp.live.planSerial += 1;
    nodeGraphMvp.live.planEvidence = nodeGraphLivePlanEvidenceDetails(plan, {
      planSerial: nodeGraphMvp.live.planSerial,
    });
    if (nodeGraphMvp.live.usesWorklet) {
      setNodeGraphLiveEvidence("plan-sent", nodeGraphMvp.live.planEvidence);
      setNodeGraphLivePlanStatus(nodeGraphLivePlanSentStatusText(), "warn");
      setNodeGraphLivePlanTitle(nodeGraphLivePlanScheduleTitle(plan.order));
      nodeGraphMvp.live.node?.port?.postMessage({
        plan,
        patchFingerprint: plan.patchFingerprint,
        planSerial: nodeGraphMvp.live.planSerial,
        sessionId: nodeGraphMvp.live.sessionId,
        type: "setPlan",
      });
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
  await context.audioWorklet.addModule("./public/node-live-audio-worklet.js");
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

function renderNodeGraphAudio() {
  if (!nodeGraphScriptReadyForGraphAction("render")) {
    markNodeGraphRenderScriptBlocked();
    return;
  }
  stopNodeGraphRenderedPlayback();
  const validation = nodeGraphValidate();
  const renderStatus = document.getElementById("nodeGraphRenderStatus");
  if (!validation.valid) {
    nodeGraphMvp.rendered = null;
    clearNodeGraphRenderedAudioElement();
    labelPrimaryAudioTitle("Fix graph before rendering", false);
    renderStatus.textContent = "render blocked";
    renderStatus.className = "pill warn";
    setNodeGraphAudioStats();
    const outputSummary = document.getElementById("nodeOutputSummary");
    if (outputSummary) {
      outputSummary.textContent = validation.scheduleText;
    }
    renderNodeGraphExecutionPlanDebug();
    drawNodeRenderedAudio();
    return;
  }

  syncNodeGraphRenderSecondsFromInput({ normalize: true });
  const audio = nodeGraphAudioDerivation(nodeGraphMvp.patch);
  const outputSampleRate = audio.outputSampleRate;
  const engineSampleRate = audio.clampedEngineSampleRate;
  const outputFrames = Math.floor(outputSampleRate * nodeGraphMvp.seconds);
  const engineFrames = Math.max(1, Math.round(engineSampleRate * nodeGraphMvp.seconds));
  const patchFingerprint = nodeGraphPatchFingerprint();
  const engineLeftSamples = new Float32Array(engineFrames);
  const engineRightSamples = new Float32Array(engineFrames);
  const plan = nodeGraphBuildLivePlan();
  const stateReadCount = nodeGraphStateReadCount(plan);
  const runtime = createNodeGraphLiveRuntime(plan);
  let clipCount = 0;

  for (let blockStart = 0; blockStart < engineFrames; blockStart += nodeGraphAudioBlockSize) {
    const blockFrames = Math.min(nodeGraphAudioBlockSize, engineFrames - blockStart);
    for (let blockFrame = 0; blockFrame < blockFrames; blockFrame += 1) {
      const frame = blockStart + blockFrame;
      const frameOutput = evaluateNodeGraphPlanFrame(
        runtime,
        engineSampleRate,
        blockFrame,
        blockFrames,
      );
      if (nodeGraphOutputSampleClipped(frameOutput.left)) {
        clipCount += 1;
      }
      if (nodeGraphOutputSampleClipped(frameOutput.right)) {
        clipCount += 1;
      }
      const left = nodeGraphClampOutputSample(frameOutput.left);
      const right = nodeGraphClampOutputSample(frameOutput.right);
      engineLeftSamples[frame] = left;
      engineRightSamples[frame] = right;
    }
    finishNodeGraphParameterSmoothing(runtime.smoothers);
  }

  const leftSamples = nodeGraphResampleRenderedChannel(
    engineLeftSamples,
    engineSampleRate,
    outputSampleRate,
    outputFrames,
  );
  const rightSamples = nodeGraphResampleRenderedChannel(
    engineRightSamples,
    engineSampleRate,
    outputSampleRate,
    outputFrames,
  );
  const samples = new Float32Array(outputFrames);
  let peak = 0;
  let squareSum = 0;
  for (let frame = 0; frame < outputFrames; frame += 1) {
    const left = leftSamples[frame] || 0;
    const right = rightSamples[frame] || 0;
    samples[frame] = (left + right) * 0.5;
    peak = Math.max(peak, Math.abs(left), Math.abs(right));
    squareSum += (left * left + right * right) * 0.5;
  }

  const rms = Math.sqrt(squareSum / outputFrames);
  nodeGraphMvp.rendered = {
    channels: 2,
    connectionCount: plan.connections.length,
    durationSeconds: outputFrames / outputSampleRate,
    engineFrames,
    engineSampleRate,
    feedbackConnectionCount: plan.feedbackConnections.length,
    feedbackModulationCount: plan.feedbackModulations.length,
    frames: outputFrames,
    modulationCount: plan.modulations.length,
    nodeCount: plan.nodes.length,
    oversamplingRatio: audio.oversamplingRatio,
    peak,
    leftSamples,
    patchFingerprint,
    rightSamples,
    rms,
    sampleRate: outputSampleRate,
    samples,
    clipCount,
    sourceNodes: validation.sourceNodes,
    stateReadCount,
  };
  syncNodeGraphRenderedAudioElement();
  renderStatus.textContent = "render ready";
  renderStatus.className = "pill good";
  setNodeGraphAudioStats(peak, rms, {
    frames: outputFrames,
    sampleRate: outputSampleRate,
    clipCount,
    engineSampleRate,
    oversamplingRatio: audio.oversamplingRatio,
    stateReadCount,
  });
  renderNodeGraphExecutionPlanDebug();
  const outputSummary = document.getElementById("nodeOutputSummary");
  if (outputSummary) {
    outputSummary.textContent = validation.scheduleText;
  }
  drawNodeRenderedAudio();
}

function drawNodeRenderedAudio() {
  drawNodeRenderedWaveform();
  drawNodeRenderedSignalPlot();
  drawNodeRenderedVisualOutput();
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

function renderNodeVisualOutputMeta(entries = {}) {
  const list = document.getElementById("nodeVisualOutputMeta");
  if (!list) {
    return;
  }
  list.replaceChildren();
  for (const [label, value] of Object.entries(entries)) {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = String(value);
    list.append(term, description);
  }
}

function setNodeVisualOutputExportReady(ready, title = "") {
  const button = document.getElementById("nodeSaveVisualOutputButton");
  if (!button) {
    return;
  }
  button.disabled = !ready;
  button.title = title || nodeGraphTooltipText(
    ready ? "legacyEvidence.visualOutputSave" : "legacyEvidence.visualOutputRenderFirst",
  );
}

function drawNodeRenderedVisualOutput(options = {}) {
  const canvas = options.canvas || document.getElementById("nodeVisualOutputCanvas");
  const includePlaybackCursor = options.includePlaybackCursor !== false;
  const updateUi = options.updateUi !== false;
  const status = updateUi ? document.getElementById("nodeVisualOutputStatus") : null;
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);

  const gradient = context.createRadialGradient(
    width * 0.5,
    height * 0.5,
    0,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.62,
  );
  gradient.addColorStop(0, "#151719");
  gradient.addColorStop(1, "#0b0d0e");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(243, 241, 236, 0.09)";
  context.lineWidth = 1;
  context.beginPath();
  for (const radius of [0.16, 0.29, 0.42]) {
    context.ellipse(
      width / 2,
      height / 2,
      width * radius,
      height * radius,
      0,
      0,
      Math.PI * 2,
    );
  }
  context.moveTo(width / 2, height * 0.08);
  context.lineTo(width / 2, height * 0.92);
  context.moveTo(width * 0.08, height / 2);
  context.lineTo(width * 0.92, height / 2);
  context.stroke();

  const rendered = nodeGraphMvp.rendered;
  const leftSamples = rendered?.leftSamples || rendered?.samples;
  const rightSamples = rendered?.rightSamples;
  const samples = rendered?.samples;
  if (!leftSamples?.length && !samples?.length) {
    if (updateUi) {
      canvas.dataset.visualSource = "unavailable";
      canvas.dataset.visualMode = "waiting";
      canvas.dataset.visualFrames = "0";
      canvas.dataset.visualPlaybackFrame = "";
      canvas.dataset.visualPlaybackProgress = "0";
      canvas.dataset.visualPlaybackState = "idle";
      canvas.dataset.visualExportIncludesPlaybackCursor = "false";
      canvas.dataset.visualExportReady = "false";
      canvas.dataset.visualPatchFingerprint = "";
      canvas.title = nodeGraphTooltipText("legacyEvidence.visualOutputWaiting");
      setNodeVisualOutputExportReady(false);
      renderNodeVisualOutputMeta({
        Frames: 0,
        Mode: "waiting",
        Peak: "0",
        RMS: "0",
        Source: "unavailable",
      });
      if (status) {
        status.textContent = "waiting";
        status.className = "pill";
      }
    }
    return;
  }

  const sourceSamples = leftSamples || samples;
  const visualSettings = normalizeNodeGraphPatchVisual(nodeGraphMvp.patch.visual);
  const visualTheme = nodeGraphVisualThemeColors(visualSettings.theme);
  const useStereo = visualSettings.mode === "stereo-xy" ||
    (visualSettings.mode === "auto" && Boolean(rightSamples?.length));
  const visualMode = useStereo ? "stereo xy" : "mono lag xy";
  const visualScale = 0.42 * visualSettings.scale;
  const lag = useStereo ? 0 : Math.max(1, Math.floor(nodeGraphMvp.sampleRate * 0.001));
  const firstFrame = useStereo ? 0 : lag;
  const step = Math.max(1, Math.floor(sourceSamples.length / 2600));

  function visualPoint(frame) {
    const xSample = useStereo ? sourceSamples[frame] || 0 : sourceSamples[frame - lag] || 0;
    const ySample = useStereo ? rightSamples[frame] || 0 : sourceSamples[frame] || 0;
    return {
      x: width / 2 + xSample * (width * visualScale),
      y: height / 2 - ySample * (height * visualScale),
    };
  }

  function drawVisualTrace({ lineWidth, strokeStyle }) {
    context.lineWidth = lineWidth;
    context.strokeStyle = strokeStyle;
    context.beginPath();
    for (let frame = firstFrame; frame < sourceSamples.length; frame += step) {
      const point = visualPoint(frame);
      if (frame === firstFrame) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    }
    context.stroke();
  }

  if (visualSettings.style === "points") {
    context.fillStyle = visualTheme.point;
    if (visualSettings.trail > 0) {
      context.globalAlpha = visualSettings.trail;
      for (let frame = firstFrame; frame < sourceSamples.length; frame += Math.max(step * 9, 9)) {
        const point = visualPoint(frame);
        context.fillRect(point.x - 2, point.y - 2, 4, 4);
      }
      context.globalAlpha = 1;
    }
    for (let frame = firstFrame; frame < sourceSamples.length; frame += Math.max(step * 3, 3)) {
      const point = visualPoint(frame);
      context.fillRect(point.x - 1, point.y - 1, 2, 2);
    }
  } else {
    if (visualSettings.trail > 0) {
      context.globalAlpha = visualSettings.style === "glow"
        ? visualSettings.trail
        : visualSettings.trail * 0.45;
      drawVisualTrace({ lineWidth: visualSettings.style === "glow" ? 4 : 3, strokeStyle: visualTheme.glow });
      context.globalAlpha = 1;
    }
    drawVisualTrace({ lineWidth: 1.3, strokeStyle: visualTheme.trace });
  }

  const playbackFrame = includePlaybackCursor
    ? nodeGraphRenderedPlaybackFrame(sourceSamples.length)
    : null;
  if (playbackFrame !== null) {
    const point = visualPoint(playbackFrame);
    context.save();
    context.strokeStyle = "rgba(243, 241, 236, 0.94)";
    context.fillStyle = "rgba(226, 168, 109, 0.92)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(point.x, point.y, 6, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(point.x, point.y, 2.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  if (updateUi) {
    canvas.dataset.visualSource = "node graph rendered audio";
    canvas.dataset.visualMode = visualMode;
    canvas.dataset.visualModeSetting = visualSettings.mode;
    canvas.dataset.visualPlaybackFrame = playbackFrame === null ? "" : String(playbackFrame);
    canvas.dataset.visualPlaybackProgress = String(nodeGraphMvp.renderedPlayback?.progress || 0);
    canvas.dataset.visualPlaybackState = playbackFrame === null ? "idle" : "playing";
    canvas.dataset.visualExportIncludesPlaybackCursor = String(playbackFrame !== null);
    canvas.dataset.visualExportReady = "true";
    canvas.dataset.visualScale = String(visualSettings.scale);
    canvas.dataset.visualStyle = visualSettings.style;
    canvas.dataset.visualTheme = visualSettings.theme;
    canvas.dataset.visualTrail = String(visualSettings.trail);
    canvas.dataset.visualFrames = String(sourceSamples.length);
    canvas.dataset.visualPatchFingerprint = rendered.patchFingerprint || "";
    canvas.dataset.visualPeak = formatCompactNumber(rendered.peak || 0);
    canvas.dataset.visualRms = formatCompactNumber(rendered.rms || 0);
    canvas.title =
      `Node graph visual output / ${canvas.dataset.visualMode} / ` +
      `${sourceSamples.length} frames / peak ${canvas.dataset.visualPeak} / rms ${canvas.dataset.visualRms}`;
    renderNodeVisualOutputMeta({
      Frames: sourceSamples.length,
      Mode: visualSettings.mode === "auto" ? `auto ${visualMode}` : visualMode,
      Peak: canvas.dataset.visualPeak,
      Playback: playbackFrame === null ? "idle" : `frame ${playbackFrame}`,
      Patch: canvas.dataset.visualPatchFingerprint,
      RMS: canvas.dataset.visualRms,
      Scale: visualSettings.scale,
      Source: canvas.dataset.visualSource,
      Style: visualSettings.style,
      Theme: visualSettings.theme,
      Trail: visualSettings.trail,
    });
    if (status) {
      status.textContent = visualSettings.mode === "auto" ? `auto ${visualMode}` : visualMode;
      status.className = "pill good";
    }
    setNodeVisualOutputExportReady(true);
  }
}

function saveNodeGraphVisualOutputPng() {
  const canvas = document.getElementById("nodeVisualOutputCanvas");
  const status = document.getElementById("nodeVisualOutputStatus");
  if (!canvas || canvas.dataset.visualExportReady !== "true") {
    setNodeVisualOutputExportReady(false);
    return;
  }
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;
  drawNodeRenderedVisualOutput({
    canvas: exportCanvas,
    includePlaybackCursor: false,
    updateUi: false,
  });
  exportCanvas.toBlob((blob) => {
    if (!blob) {
      if (status) {
        status.textContent = "save failed";
        status.className = "pill warn";
      }
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nodeGraphVisualOutputFileName(nodeGraphMvp.rendered?.patchFingerprint);
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    if (status) {
      status.textContent = "clean png saved";
      status.className = "pill good";
    }
  }, "image/png");
}

async function initNodeGraphMvp() {
  installNodeGraphDebugApi();
  configureNodeGraphDefaultPresetButton();
  await loadNodeGraphTooltips();
  const nodePanel = document.querySelector(".node-wiring-panel");
  nodePanel?.addEventListener("pointerover", handleNodeInteractionHelp);
  nodePanel?.addEventListener("pointermove", handleNodeInteractionHelp);
  nodePanel?.addEventListener("mouseover", handleNodeInteractionHelp);
  nodePanel?.addEventListener("mousemove", handleNodeInteractionHelp);
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
    .addEventListener("nodegraph:environment-command", handleNodeGraphEnvironmentCommand);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("contextmenu", openNodeSceneContextMenu);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("auxclick", preventNodeGraphMiddleMouseAuxClick);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("mousedown", preventNodeGraphMiddleMouseDefault, true);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointerdown", nodeGraphWireInteractions.beginPatchPointWireDrag, true);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointerdown", beginNodeGraphWorkspacePan, true);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointerdown", beginNodeGraphSmoothZoomDrag, true);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointerdown", beginNodeGraphMarqueeSelection);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointermove", beginNodeGraphMarqueeSelectionOnEntry);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointerleave", nodeGraphWireInteractions.clearHover);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointermove", dragNodeGraphMarqueeSelection);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointerup", endNodeGraphMarqueeSelection);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("pointercancel", endNodeGraphMarqueeSelection);
  document
    .getElementById("nodeGraphWorkspace")
    .addEventListener("wheel", handleNodeGraphWorkspaceWheel, { passive: false });
  document
    .getElementById("nodeGraphResizeHandle")
    .addEventListener("pointerdown", beginNodeGraphWorkspaceResize);

  document.addEventListener("pointermove", nodeGraphWireInteractions.dragWire);
  document.addEventListener("pointerup", nodeGraphWireInteractions.endWireDrag);
  document.addEventListener("pointercancel", nodeGraphWireInteractions.endWireDrag);
  document.addEventListener("pointermove", dragNodeGraphWorkspaceResize);
  document.addEventListener("pointerup", endNodeGraphWorkspaceResize);
  document.addEventListener("pointercancel", endNodeGraphWorkspaceResize);
  document.addEventListener("pointermove", dragNodeGraphWorkspacePan);
  document.addEventListener("pointerup", endNodeGraphWorkspacePan);
  document.addEventListener("pointercancel", endNodeGraphWorkspacePan);
  document.addEventListener("pointermove", dragNodeGraphSmoothZoom);
  document.addEventListener("pointermove", nodeGraphWireInteractions.handlePatchPointHover);
  document.addEventListener("pointerup", endNodeGraphSmoothZoomDrag);
  document.addEventListener("pointercancel", endNodeGraphSmoothZoomDrag);
  document.addEventListener("pointerdown", trackNodeGraphOutsideMarqueePointer, true);
  document.addEventListener("pointerup", clearNodeGraphOutsideMarqueePointer, true);
  document.addEventListener("pointercancel", clearNodeGraphOutsideMarqueePointer, true);
  document.addEventListener("click", handleNodeGraphDocumentClick);
  window.addEventListener("resize", handleNodeGraphWindowResize);
  document.addEventListener("pointermove", dragNodeMetadataPopover);
  document.addEventListener("pointerup", endNodeMetadataPopoverDrag);
  document.addEventListener("pointercancel", endNodeMetadataPopoverDrag);
  document.addEventListener("pointermove", dragNodeSceneContextMenu);
  document.addEventListener("pointerup", endNodeSceneContextMenuDrag);
  document.addEventListener("pointercancel", endNodeSceneContextMenuDrag);
  document.addEventListener("keydown", handleNodeGraphKeydown);
  document.getElementById("nodeRenderButton").addEventListener("click", renderNodeGraphAudio);
  document.getElementById("nodeRenderSecondsValue").addEventListener("input", handleNodeGraphRenderSecondsInput);
  document
    .getElementById("nodeRenderSecondsValue")
    .addEventListener("change", () => syncNodeGraphRenderSecondsFromInput({ normalize: true }));
  document.getElementById("nodeCopyRuntimeSketchButton").addEventListener("click", copyNodeGraphRuntimeSketch);
  document.getElementById("nodeCopyExecutionJsonButton").addEventListener("click", copyNodeGraphExecutionJson);
  document.getElementById("nodeSaveVisualOutputButton").addEventListener("click", saveNodeGraphVisualOutputPng);
  document.getElementById("nodeLiveInputButton").addEventListener("click", toggleNodeGraphLiveInput);
  document
    .getElementById("nodeStartMockInputDebugButton")
    .addEventListener("click", () => startNodeGraphMockInputDebug());
  document
    .getElementById("nodeStopMockInputDebugButton")
    .addEventListener("click", stopNodeGraphMockInputDebug);
  document
    .getElementById("nodeLiveInputDeviceSelect")
    .addEventListener("change", handleNodeGraphLiveInputDeviceChange);
  document.getElementById("nodeLiveOutputButton").addEventListener("click", toggleNodeGraphLiveOutput);
  document.getElementById("nodeDeleteButton").addEventListener("click", deleteSelectedNodeGraphItem);
  document.getElementById("nodeUndoButton").addEventListener("click", undoNodeGraphPatch);
  document.getElementById("nodeRedoButton").addEventListener("click", redoNodeGraphPatch);
  document.getElementById("nodeGridToggleButton").addEventListener("click", toggleNodeGraphGridVisibility);
  document.getElementById("nodeTooltipToggleButton").addEventListener("click", toggleNodeGraphTooltipVisibility);
  document.getElementById("nodeUserUiSettingsButton").addEventListener("click", toggleNodeUserUiSettings);
  document
    .getElementById("nodeUserUiSettingsSaveDefault")
    .addEventListener("click", handleSaveNodeUserUiSettingsDefaultClick);
  document.getElementById("nodeUserUiSettingsClose").addEventListener("click", () => setNodeUserUiSettingsVisible(false));
  document
    .getElementById("nodeUserUiSettingsDragHandle")
    .addEventListener("pointerdown", beginNodeUserUiSettingsDrag);
  document
    .getElementById("nodeUserUiSettingsHeading")
    .addEventListener("pointerdown", beginNodeUserUiSettingsDrag);
  document.getElementById("nodeSliderLabelsToggleButton").addEventListener("click", toggleNodeGraphSliderLabels);
  document.getElementById("nodeSliderValuesToggleButton").addEventListener("click", toggleNodeGraphSliderValues);
  document.getElementById("nodeSliderHandlesToggleButton").addEventListener("click", toggleNodeGraphSliderHandles);
  document
    .getElementById("nodeZoomOutButton")
    .addEventListener("click", () => zoomNodeGraphBy(-nodeGraphZoomLimits.step));
  document
    .getElementById("nodeZoomInButton")
    .addEventListener("click", () => zoomNodeGraphBy(nodeGraphZoomLimits.step));
  document
    .getElementById("nodeSettingsViewButton")
    .addEventListener("click", () => {
      const settingsVisible = !document.getElementById("nodeSettingsView").hidden;
      setNodeGraphViewMode(settingsVisible ? "modular" : "settings");
    });
  document
    .getElementById("nodeModularViewButton")
    .addEventListener("click", () => setNodeGraphViewMode("modular"));
  document
    .getElementById("nodeModularOnlyViewButton")
    .addEventListener("click", () => setNodeGraphViewMode("modular-only"));
  document
    .getElementById("nodeSnapGridViewButton")
    .addEventListener("click", handleNodeGraphSnapGridButtonClick);
  document
    .getElementById("nodeModularOnlyBackButton")
    .addEventListener("click", () => setNodeGraphViewMode("modular"));
  document
    .getElementById("nodeSettingsScriptViewButton")
    .addEventListener("click", () => setNodeGraphViewMode("script"));
  document.getElementById("nodePatchScript").addEventListener("input", handleNodePatchScriptInput);
  document.getElementById("copyNodeGraphScriptButton").addEventListener("click", copyNodeGraphScriptToClipboard);
  document.getElementById("downloadNodeGraphScriptButton").addEventListener("click", saveNodeGraphScript);
  document.getElementById("pasteNodeGraphScriptButton").addEventListener("click", pasteNodeGraphScriptFromClipboard);
  document.getElementById("updateDefaultPresetButton").addEventListener("click", handleUpdateDefaultNodeGraphPresetClick);
  document.getElementById("loadNodeGraphScriptButton").addEventListener("click", loadNodeGraphScript);
  document.getElementById("nodeSettingsSaveScriptButton").addEventListener("click", saveNodeGraphScript);
  document.getElementById("copyNodeUiDevSettingsButton").addEventListener("click", copyNodeUiDevSettingsToClipboard);
  document.getElementById("loadNodeUiDevSettingsButton").addEventListener("click", loadNodeUiDevSettingsFile);
  document.getElementById("saveNodeUiDevSettingsButton").addEventListener("click", saveNodeUiDevSettingsFile);
  document
    .getElementById("updateDefaultNodeUiDevSettingsButton")
    .addEventListener("click", handleUpdateDefaultNodeUiDevSettingsPresetClick);
  document.getElementById("nodeUiDevButton").addEventListener("click", toggleNodeUiDevHelper);
  document.getElementById("nodeUiDevHelperClose").addEventListener("click", () => setNodeUiDevHelperVisible(false));
  document
    .getElementById("nodeUiDevHelperDragHandle")
    .addEventListener("pointerdown", beginNodeUiDevHelperDrag);
  document
    .getElementById("nodeUiDevHelperHeading")
    .addEventListener("pointerdown", beginNodeUiDevHelperDrag);
  document
    .getElementById("nodeUiDevSettingsHeaderTextSize")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevButtonTextSize")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevLiveToggleTextSize")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevModularHeaderButtonBackground")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevTooltipTextSize")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevMinimumGridBrightness")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevModuleLightSpread")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevModuleGridInset")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevModuleRoundness")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevGridColor")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevGridColor")
    .addEventListener("change", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevWorkspaceBackgroundColor")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevWorkspaceBackgroundColor")
    .addEventListener("change", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevSettingsHeaderTopRatio")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevSettingsHeaderPadding")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevSliderDotSize")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevModuleTitleFont")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevModuleTitleFont")
    .addEventListener("change", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevModuleTitleHeight")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevModuleTitleTextFill")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevModuleIoSectionHeight")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevModuleNodeSize")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevNodeGlowSize")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevWirePatchPointSize")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevWireThickness")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevBypassIconSize")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevBypassIconGlowSpread")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  for (const colorInputId of [
    "nodeUiDevBypassIconGlowColor",
    "nodeUiDevBypassIconOnColor",
    "nodeUiDevBypassOnBackgroundColor",
    "nodeUiDevBypassOffBackgroundColor",
  ]) {
    const colorInput = document.getElementById(colorInputId);
    colorInput.addEventListener("input", syncNodeUiDevSettingsHeaderControls);
    colorInput.addEventListener("change", syncNodeUiDevSettingsHeaderControls);
  }
  document
    .getElementById("nodeUiDevMoveSymbolSize")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevCloseIconSize")
    .addEventListener("input", syncNodeUiDevSettingsHeaderControls);
  document
    .getElementById("nodeUiDevSettingsHeaderHighlights")
    .addEventListener("change", syncNodeUiDevSettingsHeaderControls);
  for (const colorInput of document.querySelectorAll("[data-node-color-var]")) {
    colorInput.addEventListener("input", syncNodeUiDevSettingsHeaderControls);
    colorInput.addEventListener("change", syncNodeUiDevSettingsHeaderControls);
  }
  installNodeUiDevExposeControls();
  organizeNodeUiDevSections();
  installNodeSettingsHeaderTextFitObserver();
  installNodeLiveToggleTextFitObserver();
  await loadNodeUiDevDefaultSettings();
  syncNodeUiDevSettingsHeaderControls();
  document.addEventListener("pointermove", dragNodeUiDevHelper);
  document.addEventListener("pointerup", endNodeUiDevHelperDrag);
  document.addEventListener("pointercancel", endNodeUiDevHelperDrag);
  document.addEventListener("pointermove", dragNodeUserUiSettings);
  document.addEventListener("pointerup", endNodeUserUiSettingsDrag);
  document.addEventListener("pointercancel", endNodeUserUiSettingsDrag);
  document
    .getElementById("nodePatchScriptFileInput")
    .addEventListener("change", handleNodeGraphScriptFileLoad);
  document
    .getElementById("nodeUiDevSettingsFileInput")
    .addEventListener("change", handleNodeUiDevSettingsFileLoad);
  for (const field of document.querySelectorAll("[data-patch-info-field]")) {
    field.addEventListener("input", handleNodeGraphSettingsInput);
    field.addEventListener("change", commitNodeGraphSettingsHistory);
  }
  for (const field of document.querySelectorAll("[data-patch-header-info-field]")) {
    field.addEventListener("input", handleNodeGraphHeaderInfoInput);
    field.addEventListener("change", commitNodeGraphSettingsHistory);
  }
  for (const field of document.querySelectorAll("[data-patch-visual-field]")) {
    field.addEventListener("input", handleNodeGraphSettingsInput);
    field.addEventListener("change", commitNodeGraphSettingsHistory);
  }
  for (const field of document.querySelectorAll("[data-patch-audio-field]")) {
    field.addEventListener("input", handleNodeGraphSettingsInput);
    field.addEventListener("change", commitNodeGraphSettingsHistory);
  }
  for (const field of document.querySelectorAll("[data-patch-grid-field]")) {
    field.addEventListener("input", handleNodeGraphSettingsInput);
    field.addEventListener("change", commitNodeGraphSettingsHistory);
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
    .addEventListener("click", deleteNodeGraphSelectionFromContext);
  document
    .getElementById("nodeSceneCopyModule")
    .addEventListener("click", copyNodeGraphModuleFromContext);
  document
    .getElementById("nodeSceneWidthDecrease")
    .addEventListener("click", () => adjustNodeGraphModuleWidthFromContext(-1));
  document
    .getElementById("nodeSceneWidthIncrease")
    .addEventListener("click", () => adjustNodeGraphModuleWidthFromContext(1));
  document
    .getElementById("nodeSceneTextBoxHeightDecrease")
    .addEventListener("click", () => adjustNodeGraphTextBoxHeightFromContext(-1));
  document
    .getElementById("nodeSceneTextBoxHeightIncrease")
    .addEventListener("click", () => adjustNodeGraphTextBoxHeightFromContext(1));
  document
    .getElementById("nodeSceneTextBoxTextSizeDecrease")
    .addEventListener("click", () =>
      adjustNodeGraphTextBoxTextSizeFromContext(-nodeGraphTextBoxTextSizeLimits.stepPercent));
  document
    .getElementById("nodeSceneTextBoxTextSizeIncrease")
    .addEventListener("click", () =>
      adjustNodeGraphTextBoxTextSizeFromContext(nodeGraphTextBoxTextSizeLimits.stepPercent));
  document
    .getElementById("nodeSceneAliasInput")
    .addEventListener("input", () => setNodeGraphModuleAliasFromContext({ record: false }));
  document
    .getElementById("nodeSceneAliasInput")
    .addEventListener("change", () => setNodeGraphModuleAliasFromContext({ record: true }));
  document
    .getElementById("nodeSceneToggleButtons")
    .addEventListener("click", toggleNodeGraphModuleButtonsFromContext);
  document
    .getElementById("nodeSceneToggleTitle")
    .addEventListener("click", toggleNodeGraphModuleTitleFromContext);
  document
    .getElementById("nodeSceneTextBoxSingleLine")
    .addEventListener("click", () => setNodeGraphTextBoxModeFromContext("singleLine"));
  document
    .getElementById("nodeSceneTextBoxMultiline")
    .addEventListener("click", () => setNodeGraphTextBoxModeFromContext("multiline"));
  document
    .getElementById("nodeSceneTextBoxTextInput")
    .addEventListener("input", () => setNodeGraphTextBoxTextFromContext({ record: false }));
  document
    .getElementById("nodeSceneTextBoxTextInput")
    .addEventListener("change", () => setNodeGraphTextBoxTextFromContext({ record: true }));
  document
    .getElementById("nodeSceneTextBoxAlignLeft")
    .addEventListener("click", () => setNodeGraphTextBoxHorizontalAlignFromContext("left"));
  document
    .getElementById("nodeSceneTextBoxAlignCenter")
    .addEventListener("click", () => setNodeGraphTextBoxHorizontalAlignFromContext("center"));
  document
    .getElementById("nodeSceneTextBoxAlignRight")
    .addEventListener("click", () => setNodeGraphTextBoxHorizontalAlignFromContext("right"));
  document
    .getElementById("nodeSceneTextBoxVerticalAlign")
    .addEventListener("input", () => setNodeGraphTextBoxVerticalAlignFromContext({ record: false }));
  document
    .getElementById("nodeSceneTextBoxVerticalAlign")
    .addEventListener("change", () => setNodeGraphTextBoxVerticalAlignFromContext({ record: true }));
  document
    .getElementById("nodeSceneCloseMenu")
    .addEventListener("click", closeNodeSceneContextMenu);
  document
    .getElementById("nodeSceneDragHandle")
    .addEventListener("pointerdown", beginNodeSceneContextMenuDrag);

  document.addEventListener("pointermove", dragNodeSlider);
  document.addEventListener("pointerup", endNodeSliderDrag);
  document.addEventListener("pointercancel", endNodeSliderDrag);
  document.addEventListener("mousemove", dragNodeSlider);
  document.addEventListener("mouseup", endNodeSliderDrag);

  nodeGraphMvp.defaultPatch = await loadNodeGraphDefaultPresetPatch();
  commitNodeGraphPatch(cloneNodeGraphPatch(nodeGraphMvp.defaultPatch), {
    markPending: false,
    record: false,
  });
  recordNodeGraphHistory();
  markNodeGraphRenderPending();
  applyNodeGraphZoom();
  renderNodeGraphGridToggle();
  renderNodeGraphSnapGridButton();
  renderNodeGraphTooltipToggle();
  renderNodeGraphSliderTextToggles();
  loadNodeMetadataKindTemplates();
  refreshNodeGraphLiveInputDevices();
  refreshNodeGraphLiveMicrophonePermissionState();
  navigator.mediaDevices?.addEventListener?.("devicechange", refreshNodeGraphLiveInputDevices);
}

loadSignalPlotSettings();
loadManifest();
initNodeGraphMvp();
