const state = {
  response: null,
  waveform: null,
  playheadFrame: 0,
  followAudio: true,
  reports: [],
  activeReportIndex: 0,
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

function artifactUrl(path) {
  return `/artifact?path=${encodeURIComponent(path)}`;
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

function buildPhaseRegions(phases, totalFrames) {
  let startFrame = 0;
  return phases.map((phase) => {
    const frames = Number(phase.samplesProcessed || 0);
    const endFrame = Math.min(totalFrames, startFrame + frames);
    const region = {
      endFrame,
      name: phase.name || "phase",
      startFrame,
    };
    startFrame = endFrame;
    return region;
  });
}

function buildPhaseSpans(phases, totalFrames) {
  let startFrame = 0;
  return phases.map((phase) => {
    const frames = Number(phase.samplesProcessed || 0);
    const endFrame = Math.min(totalFrames, startFrame + frames);
    const span = {
      endFrame,
      frames,
      startFrame,
    };
    startFrame = endFrame;
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
    button.addEventListener("click", () => {
      setFollowAudio(false, false);
      setPlayheadFrame(region.startFrame);
    });
    container.append(button);
  }
}

function activeWaveformRegion() {
  const waveform = state.waveform;
  if (!waveform) {
    return null;
  }

  return (
    (waveform.regions || []).find(
      (region) =>
        state.playheadFrame >= region.startFrame &&
        state.playheadFrame < region.endFrame,
    ) || waveform.regions?.at(-1) || null
  );
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
    state.waveform.regions = buildPhaseRegions(
      state.response?.manifest?.phases || [],
      state.waveform.frames,
    );
    setPlayheadFrame(0);
    drawWaveform();
    renderWaveformPhaseControls();
    const wav = state.response?.manifest?.wav || {};
    renderKeyValue(meta, [
      ["sample rate", String(state.waveform.sampleRate), manifestNumberText(wav.sampleRate)],
      ["channels", String(state.waveform.channels), manifestNumberText(wav.channels)],
      ["bit depth", String(state.waveform.bitsPerSample), manifestNumberText(wav.bitDepth)],
      ["frames", String(state.waveform.frames), manifestNumberText(wav.frames)],
      ["data bytes", formatBytes(state.waveform.dataBytes), manifestBytesText(wav.dataBytes)],
      ["file bytes", formatBytes(state.waveform.fileBytes), manifestBytesText(wav.fileBytes)],
    ]);
    status.textContent = "Drawn";
    status.className = "pill good";
    renderWaveformPosition();
    renderFollowAudioControl();
  } catch (error) {
    state.waveform = null;
    state.playheadFrame = 0;
    meta.replaceChildren();
    renderWaveformPhaseControls();
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
  const phase = document.getElementById("waveformPhase");
  const scrubber = document.getElementById("waveformScrubber");
  const waveform = state.waveform;
  if (!waveform) {
    position.textContent = "0.000s";
    sample.textContent = "frame 0 / sample 0";
    phase.textContent = "phase";
    scrubber.value = "0";
    updateActivePhaseButtons(null);
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
  scrubber.value = String(
    waveform.frames > 0 ? state.playheadFrame / waveform.frames : 0,
  );
  updateActivePhaseButtons(activeRegion);
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
  }
}

function syncWaveformToAudio() {
  const audio = document.getElementById("audioPlayer");
  if (!state.followAudio || !state.waveform || Number.isNaN(audio.currentTime)) {
    return;
  }

  setPlayheadFrame(Math.round(audio.currentTime * state.waveform.sampleRate));
}

function seekWaveform(event) {
  const waveform = state.waveform;
  if (!waveform) {
    return;
  }

  const canvas = document.getElementById("waveformCanvas");
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  setFollowAudio(false, false);
  setPlayheadFrame(Math.round(ratio * waveform.frames));
}

function scrubWaveform(event) {
  const waveform = state.waveform;
  if (!waveform) {
    return;
  }

  const ratio = Number(event.currentTarget.value);
  setFollowAudio(false, false);
  setPlayheadFrame(Math.round(ratio * waveform.frames));
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
    ["First Frequency", pairs.get("first half frequency")],
    ["First Amplitude", pairs.get("first half amplitude")],
    ["Second Frequency", pairs.get("second half frequency")],
    ["Second Amplitude", pairs.get("second half amplitude")],
    [
      "Frequency Change",
      formatSummaryChange(firstFrequency, secondFrequency),
      "comparison",
    ],
    [
      "Amplitude Change",
      formatSummaryChange(firstAmplitude, secondAmplitude),
      "comparison",
    ],
  ];

  for (const [label, value, kind] of values) {
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
    if (!value) {
      body.className = "warn";
    }

    item.append(title, body);
    container.append(item);
  }
}

function parseSummaryNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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

async function renderParameterSummary(links) {
  const status = document.getElementById("parameterSummaryStatus");
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
    ["audio link", hasArtifactKind(links, "audio")],
    ["phase report", phases.length > 0],
  ];

  return {
    accepted: checks.every(([, ok]) => ok),
    checks,
  };
}

function renderChecklist(result) {
  const list = document.getElementById("checklist");
  list.replaceChildren();
  for (const [label, ok] of result.checks) {
    const item = document.createElement("div");
    item.className = ok ? "check-row" : "check-row warn-row";

    const marker = document.createElement("strong");
    marker.textContent = ok ? "OK" : "Check";

    const text = document.createElement("span");
    text.textContent = label;

    item.append(marker, text);
    list.append(item);
  }
}

function renderProducerProof(manifest) {
  const status = document.getElementById("producerStatus");
  const setters = manifest.parameterSetters || {};
  const rows = [
    ["demo", manifest.demo || "missing"],
    ["kind", manifest.kind || "missing"],
    ["runtime API", boolText(Boolean(manifest.runtimeApi)), false],
    ["scheduler", boolText(Boolean(manifest.scheduler)), false],
    ["audio engine", boolText(Boolean(manifest.audioEngine)), false],
    ["frequency setter", boolText(Boolean(setters.frequency)), true],
    ["amplitude setter", boolText(Boolean(setters.amplitude)), true],
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

function renderArtifactCoverage(links, phases) {
  const phaseReportCount = countArtifactKind(links, "phase-report");
  const missingPathCount = links.filter((link) => !link.path).length;
  const rows = [
    ["total links", String(links.length)],
    ["missing paths", String(missingPathCount), 0],
    ["reachability method", "HEAD", "HEAD"],
    ["entry point", String(countArtifactKind(links, "entry-point")), 1],
    ["audio", String(countArtifactKind(links, "audio")), 1],
    ["manifest", String(countArtifactKind(links, "manifest")), 1],
    ["text summary", String(countArtifactKind(links, "text-summary")), 1],
    ["wav report", String(countArtifactKind(links, "wav-report")), 1],
    ["phase reports", String(phaseReportCount), phases.length],
  ];
  const ok =
    links.length > 0 &&
    missingPathCount === 0 &&
    countArtifactKind(links, "entry-point") >= 1 &&
    countArtifactKind(links, "audio") >= 1 &&
    countArtifactKind(links, "manifest") >= 1 &&
    countArtifactKind(links, "text-summary") >= 1 &&
    countArtifactKind(links, "wav-report") >= 1 &&
    phaseReportCount === phases.length;

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
  renderPhaseCoverage(manifest.phases || [], manifest.wav);
  renderPhases(manifest.phases || [], manifest.wav);
  renderChecklist(checklist);
  renderArtifactCoverage(manifest.artifactLinks || [], manifest.phases || []);
  renderParameterSummary(manifest.artifactLinks || []);
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

  if (!manifest.wav || typeof manifest.wav !== "object") {
    return "wav metadata missing";
  }

  if (!Number.isFinite(Number(manifest.wav.frames))) {
    return "wav frame count missing";
  }

  if (!Array.isArray(manifest.artifactLinks)) {
    return "artifact links missing";
  }

  if (!Array.isArray(manifest.phases)) {
    return "phases missing";
  }

  return "";
}

function renderError(message, details = {}) {
  state.response = null;
  state.waveform = null;
  state.playheadFrame = 0;
  state.reports = [];
  state.activeReportIndex = 0;

  setStatus("manifestStatus", "Check", false);
  setStatus("contractStatus", message, false);
  setStatus("inspectionMode", "Unavailable", false);
  setText("frameCount", "0");
  setStatus("checklistStatus", "Check", false);
  setStatus("producerStatus", "Check", false);
  setStatus("parameterSummaryStatus", "Check", false);
  setStatus("waveformStatus", "Check", false);
  setStatus("phaseCoverageStatus", "Check", false);
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

  clearElement("producerProof");
  clearElement("parameterSummary");
  renderReportControls();
  renderActiveReport();
  renderWaveformPhaseControls();
  renderWaveformPosition();
  clearElement("waveformMeta");
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
  .getElementById("waveformScrubber")
  .addEventListener("input", scrubWaveform);

document
  .getElementById("followAudioButton")
  .addEventListener("click", toggleFollowAudio);

document
  .getElementById("audioPlayer")
  .addEventListener("timeupdate", syncWaveformToAudio);

document
  .getElementById("audioPlayer")
  .addEventListener("seeked", syncWaveformToAudio);

window.addEventListener("resize", drawWaveform);

loadManifest();
