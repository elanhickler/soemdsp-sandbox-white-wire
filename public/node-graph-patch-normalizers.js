function normalizeNodeGraphPatchInfo(info = {}) {
  return {
    author: nodeGraphOneLineText(info.author),
    description: String(info.description ?? "").trim(),
    name: nodeGraphOneLineText(info.name),
    tags: nodeGraphOneLineText(info.tags),
  };
}

function normalizeNodeGraphPatchAudio(audio = {}) {
  const targetSampleRate = Number(audio?.targetSampleRate);
  return {
    targetSampleRate: Number.isFinite(targetSampleRate)
      ? Math.max(8000, Math.min(768000, targetSampleRate))
      : 88200,
  };
}

function normalizeNodeGraphPatchTiming(timing = {}) {
  const tempoBpm = Math.round(Number(timing?.tempoBpm));
  const numerator = Math.round(Number(timing?.timeSignatureNumerator));
  const denominator = Math.round(Number(timing?.timeSignatureDenominator));
  return {
    tempoBpm: Number.isFinite(tempoBpm)
      ? Math.max(1, Math.min(320, tempoBpm))
      : 120,
    timeSignatureDenominator: Number.isFinite(denominator)
      ? Math.max(1, Math.min(32, denominator))
      : 4,
    timeSignatureNumerator: Number.isFinite(numerator)
      ? Math.max(1, Math.min(32, numerator))
      : 4,
  };
}

function normalizeNodeGraphPatchGrid(grid = {}) {
  const fallbackSize = Number(grid?.sizePx);
  const fallback = Number.isFinite(fallbackSize) && fallbackSize > 0
    ? fallbackSize
    : nodeGraphGrid.sizePx;
  const width = Number(grid?.widthPx);
  const height = Number(grid?.heightPx);
  const widthPx = Number.isFinite(width) && width > 0 ? width : fallback;
  const heightPx = Number.isFinite(height) && height > 0 ? height : fallback;
  return {
    heightPx: Math.max(8, Math.min(96, heightPx)),
    sizePx: Math.max(8, Math.min(96, Math.min(widthPx, heightPx))),
    widthPx: Math.max(8, Math.min(96, widthPx)),
  };
}

const nodeGraphScopeShaderDefaultSource = `video.input     = ~;
scope.mode      = 1d_full;
scope.sync      = inherit;
scope.cycles    = 1.7639;
scope.zoom      = 1.0;
scope.syncSpeed = 1.0;
dot1.color      = dot1.global.color;
dot1.size       = 1.0 * dot1.global.size;
dot1.blur       = 0.00;
dot1.brightness = 4.50;
dot2.color      = dot2.global.color;
dot2.size       = 1.0 * dot2.global.size;
dot2.blur       = 0.00;
dot2.brightness = 0.45;
// Scope modes: 1d_full, 1d_scan
// Sync options: inherit, on, off
// Blend options: laser, led, light, paint, solid
// Change the word after = to switch modes.
blend.mode      = laser;`;

const nodeGraphScopeShaderModes = Object.freeze(["1d_full", "1d_scan"]);
const nodeGraphScopeShaderSyncModes = Object.freeze(["inherit", "on", "off"]);

function normalizeNodeGraphScopeShaderVideoInput(value = "~") {
  const text = String(value || "~").trim().toLowerCase();
  if (text === "none") {
    return "none";
  }
  if (/^output\d+$/.test(text)) {
    return text;
  }
  return "~";
}

function parseNodeGraphScopeShaderVideoInput(source = "") {
  const match = String(source || "").match(/(?:^|\n)\s*video\.input\s*=\s*(~|none|output\d+)\s*;/i);
  return normalizeNodeGraphScopeShaderVideoInput(match?.[1] || "~");
}

function normalizeNodeGraphScopeShaderMode(value = "1d_full") {
  const text = String(value || "1d_full").trim().toLowerCase();
  return nodeGraphScopeShaderModes.includes(text) ? text : "1d_full";
}

function parseNodeGraphScopeShaderMode(source = "") {
  const match = String(source || "").match(/(?:^|\n)\s*scope\.mode\s*=\s*(1d_full|1d_scan)\s*;/i);
  return normalizeNodeGraphScopeShaderMode(match?.[1] || "1d_full");
}

function normalizeNodeGraphScopeShaderSync(value = "inherit") {
  const text = String(value || "inherit").trim().toLowerCase();
  return nodeGraphScopeShaderSyncModes.includes(text) ? text : "inherit";
}

function parseNodeGraphScopeShaderSync(source = "") {
  const match = String(source || "").match(/(?:^|\n)\s*scope\.sync\s*=\s*(inherit|on|off)\s*;/i);
  return normalizeNodeGraphScopeShaderSync(match?.[1] || "inherit");
}

function normalizeNodeGraphScopeShaderNumber(value, fallback, min, max) {
  const number = Number(value);
  const safeFallback = Number.isFinite(Number(fallback)) ? Number(fallback) : 0;
  const safeMin = Number.isFinite(Number(min)) ? Number(min) : -Infinity;
  const safeMax = Number.isFinite(Number(max)) ? Number(max) : Infinity;
  return Number.isFinite(number)
    ? Math.max(safeMin, Math.min(safeMax, number))
    : safeFallback;
}

function parseNodeGraphScopeShaderNumber(source = "", key = "", fallback = 0, min = -Infinity, max = Infinity) {
  const safeKey = String(key || "").replace(/[^\w]/g, "");
  if (!safeKey) {
    return normalizeNodeGraphScopeShaderNumber(fallback, fallback, min, max);
  }
  const match = String(source || "").match(new RegExp(`(?:^|\\n)\\s*scope\\.${safeKey}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)\\s*;`, "i"));
  return normalizeNodeGraphScopeShaderNumber(match?.[1], fallback, min, max);
}

function normalizeNodeGraphScopeShader(scopeShader = {}) {
  const source = typeof scopeShader === "string"
    ? scopeShader
    : scopeShader && typeof scopeShader === "object"
      ? scopeShader.source
      : "";
  const language = String(scopeShader?.language || "scope-js").trim().slice(0, 32) || "scope-js";
  const normalizedSource = String(source || "").trim().slice(0, 100000);
  const normalizedVideoInput = parseNodeGraphScopeShaderVideoInput(normalizedSource);
  const normalizedMode = parseNodeGraphScopeShaderMode(normalizedSource);
  const normalizedSync = parseNodeGraphScopeShaderSync(normalizedSource);
  const normalizedCycles = parseNodeGraphScopeShaderNumber(normalizedSource, "cycles", 1.7639, 1, 128);
  const normalizedZoom = parseNodeGraphScopeShaderNumber(normalizedSource, "zoom", 1, 0.01, 50);
  const normalizedSyncSpeed = parseNodeGraphScopeShaderNumber(normalizedSource, "syncSpeed", 1, 0, 50);
  return {
    cycles: normalizedCycles,
    enabled: scopeShader?.enabled !== false,
    kind: "scopeShader",
    language,
    mode: normalizedMode,
    source: normalizedSource || nodeGraphScopeShaderDefaultSource,
    sync: normalizedSync,
    syncSpeed: normalizedSyncSpeed,
    videoInput: normalizedVideoInput,
    zoom: normalizedZoom,
  };
}

const nodeGraphDefaultCameraColors = Object.freeze([
  "#ff3333",
  "#3399ff",
  "#38c46b",
  "#9b5cff",
]);

const nodeGraphDefaultCameraFrame = Object.freeze({
  height: 489,
  width: 868,
  x: 0,
  y: 0,
});

const nodeGraphCameraFrameLimits = Object.freeze({
  minHeight: 80,
  minWidth: 120,
});

const nodeGraphDefaultCameraResolution = Object.freeze({
  height: 1080,
  width: 1920,
});

function normalizeNodeGraphCameraResolution(value, fallback) {
  const resolution = Math.round(Number(value));
  return Number.isFinite(resolution) ? Math.max(16, Math.min(16384, resolution)) : fallback;
}

function normalizeNodeGraphCameraMidiTrigger(trigger = null) {
  const source = trigger && typeof trigger === "object" ? trigger : {};
  const type = source.type === "cc" ? "cc" : source.type === "note" ? "note" : "";
  if (!type) {
    return null;
  }
  const channel = Math.round(Number(source.channel));
  const number = Math.round(Number(source.number));
  return {
    channel: Number.isFinite(channel) ? Math.max(1, Math.min(16, channel)) : 1,
    number: Number.isFinite(number) ? Math.max(0, Math.min(127, number)) : 0,
    type,
    valueMode: source.valueMode === "threshold" ? "threshold" : "select",
  };
}

function normalizeNodeGraphCamera(camera = {}, index = 0) {
  const source = camera && typeof camera === "object" ? camera : {};
  const fallbackId = `camera-${index + 1}`;
  const id = String(source.id || fallbackId).trim().replace(/[^a-z0-9_-]/gi, "-").slice(0, 64) || fallbackId;
  const color = String(source.color || nodeGraphDefaultCameraColors[index % nodeGraphDefaultCameraColors.length] || "#ff3333").trim();
  const x = Math.round(Number(source.x));
  const y = Math.round(Number(source.y));
  const width = Math.round(Number(source.width));
  const resolutionWidth = normalizeNodeGraphCameraResolution(
    source.resolutionWidth,
    nodeGraphDefaultCameraResolution.width,
  );
  const resolutionHeight = normalizeNodeGraphCameraResolution(
    source.resolutionHeight,
    nodeGraphDefaultCameraResolution.height,
  );
  const aspectRatio = Math.max(0.01, resolutionWidth / resolutionHeight);
  const safeWidth = Number.isFinite(width)
    ? Math.max(nodeGraphCameraFrameLimits.minWidth, Math.min(4000, width))
    : nodeGraphDefaultCameraFrame.width;
  const safeHeight = Math.max(nodeGraphCameraFrameLimits.minHeight, Math.round(safeWidth / aspectRatio));
  return {
    color: /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : nodeGraphDefaultCameraColors[index % nodeGraphDefaultCameraColors.length],
    enabled: source.enabled !== false,
    height: Math.min(4000, safeHeight),
    id,
    midiTrigger: normalizeNodeGraphCameraMidiTrigger(source.midiTrigger),
    name: nodeGraphOneLineText(source.name).slice(0, 64) || `Camera ${index + 1}`,
    resolutionHeight,
    resolutionWidth,
    width: Math.min(4000, Math.round(Math.min(4000, safeHeight) * aspectRatio)),
    x: Number.isFinite(x) ? Math.max(0, Math.min(10000, x)) : nodeGraphDefaultCameraFrame.x,
    y: Number.isFinite(y) ? Math.max(0, Math.min(10000, y)) : nodeGraphDefaultCameraFrame.y,
  };
}

function normalizeNodeGraphPatchCameras(cameras = [], activeCameraId = "") {
  const source = Array.isArray(cameras) && cameras.length ? cameras : [{}];
  const seen = new Set();
  const normalized = source.map((camera, index) => normalizeNodeGraphCamera(camera, index))
    .filter((camera) => {
      if (seen.has(camera.id)) {
        return false;
      }
      seen.add(camera.id);
      return true;
    });
  const safeCameras = normalized.length ? normalized : [normalizeNodeGraphCamera({}, 0)];
  const active = String(activeCameraId || "").trim();
  return {
    activeCameraId: safeCameras.some((camera) => camera.id === active) ? active : safeCameras[0].id,
    cameras: safeCameras,
  };
}

function normalizeNodeGraphWindowPosition(position = {}) {
  const source = position && typeof position === "object" ? position : {};
  const left = source.left === null || source.left === undefined ? NaN : Number(source.left);
  const top = source.top === null || source.top === undefined ? NaN : Number(source.top);
  return {
    left: Number.isFinite(left) ? Math.max(0, left) : null,
    top: Number.isFinite(top) ? Math.max(0, top) : null,
  };
}

function normalizeNodeGraphPatchWindows(windows = {}) {
  return {
    metadata: normalizeNodeGraphWindowPosition(windows.metadata),
    moduleActions: normalizeNodeGraphWindowPosition(windows.moduleActions),
  };
}

const nodeGraphWorkspaceViewLimits = Object.freeze({
  minHeightGu: 4,
  minWidthGu: 4,
});

function normalizeNodeGraphPatchView(view = {}) {
  const widthGu = Math.round(Number(view?.widthGu));
  const heightGu = Math.round(Number(view?.heightGu));
  return {
    heightGu: Number.isFinite(heightGu)
      ? Math.max(0, heightGu)
      : 0,
    widthGu: Number.isFinite(widthGu)
      ? Math.max(0, widthGu)
      : 0,
  };
}

function normalizeNodeGraphPatchUiItems(uiItems = [], options = {}) {
  if (!Array.isArray(uiItems)) {
    return [];
  }

  const nodeIds = options.nodeIds instanceof Set ? options.nodeIds : null;
  const seen = new Set();
  return uiItems
    .map((item, index) => {
      const source = item && typeof item === "object" ? item : {};
      const sourceNodeId = String(source.sourceNodeId || "").trim();
      if (nodeIds && (!sourceNodeId || !nodeIds.has(sourceNodeId))) {
        return null;
      }
      const idSource = String(source.id || "").trim() || `ui-${index + 1}`;
      const id = idSource.replace(/[^a-z0-9_-]/gi, "-").slice(0, 64) || `ui-${index + 1}`;
      if (seen.has(id)) {
        return null;
      }
      seen.add(id);
      const x = Math.round(Number(source.x));
      const y = Math.round(Number(source.y));
      const w = Math.round(Number(source.w));
      const h = Math.round(Number(source.h));
      const label = nodeGraphOneLineText(source.label).slice(0, 64) || sourceNodeId || id;
      const type = ["graphEditor", "moduleControl"].includes(source.type) ? source.type : "moduleControl";
      return {
        h: Number.isFinite(h) ? Math.max(28, Math.min(420, h)) : type === "graphEditor" ? 260 : 44,
        id,
        label,
        sourceNodeId,
        type,
        w: Number.isFinite(w) ? Math.max(64, Math.min(720, w)) : type === "graphEditor" ? 460 : 132,
        x: Number.isFinite(x) ? Math.max(0, Math.min(2000, x)) : 24,
        y: Number.isFinite(y) ? Math.max(0, Math.min(2000, y)) : 24,
      };
    })
    .filter(Boolean);
}
