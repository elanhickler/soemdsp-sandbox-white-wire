const nodeGraphShaderScriptStorageKey = "soemdsp-sandbox.modularShader.v1";
const nodeGraphShaderScriptMaxScopes = 32;
const nodeGraphShaderScriptEditorFontSizeLimits = Object.freeze({
  defaultPx: 11.5,
  maxPx: 22,
  minPx: 8,
  stepPx: 0.75,
});
const nodeGraphShaderScriptBlendModes = Object.freeze(["laser", "led", "light", "paint", "solid"]);
const nodeGraphShaderScriptDefaultSyntaxColors = Object.freeze({
  assignment: "#d6a35f",
  color: "#dfe7e3",
  comment: "#9ca4a6",
  mode: "#d3a070",
  number: "#a9cda6",
  property: "#7fc7d9",
});
const nodeGraphShaderScriptLegacySyntaxColors = Object.freeze({
  assignment: "#ffd87f",
  color: "#ffffff",
  comment: "#9ca4a6",
  mode: "#ffae6e",
  number: "#b4ffb2",
  property: "#84e6ff",
});

const nodeGraphShaderScriptVertexSource = `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

function nodeGraphShaderScriptCameraPhosphorFragment(preset) {
  return `
precision mediump float;

uniform vec2 uResolution;
uniform float uTime;
uniform float uZoom;
uniform int uScopeCount;
uniform vec4 uScopeRects[32];

varying vec2 vUv;

float rectDistance(vec2 p, vec4 rect) {
  vec2 center = rect.xy + rect.zw * 0.5;
  vec2 q = abs(p - center) - rect.zw * 0.5;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

float grain(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 uv = vUv;
  float vignette = smoothstep(0.14, 0.92, length((uv - 0.5) * vec2(1.28, 1.0)));
  float darkness = ${preset.darknessBase} + vignette * ${preset.darknessVignette};
  float glow = 0.0;
  float core = 0.0;

  for (int i = 0; i < 32; i++) {
    if (i < uScopeCount) {
      vec4 rect = uScopeRects[i];
      float d = rectDistance(uv, rect);
      float halo = exp(-max(d, 0.0) * (${preset.haloFalloff} + uZoom * ${preset.zoomFalloff}));
      float nearPane = smoothstep(${preset.paneEdge}, -0.003, d);
      float scan = ${preset.scanBase} + ${preset.scanAmount} * sin((uv.y * uResolution.y * ${preset.scanDensity}) + uTime * ${preset.scanSpeed});
      glow += halo * ${preset.haloAmount} + nearPane * scan * ${preset.paneAmount};
      core += nearPane;
    }
  }

  glow = clamp(glow, 0.0, 1.0);
  core = clamp(core, 0.0, 1.0);
  float dust = (grain(gl_FragCoord.xy + uTime * ${preset.dustSpeed}) - 0.5) * ${preset.dustAmount};
  vec3 trace = vec3(${preset.glowColor}) * glow + vec3(${preset.coreColor}) * core * ${preset.coreAmount};
  vec3 room = vec3(${preset.roomColor});
  float alpha = clamp(darkness - glow * ${preset.glowAlphaCut} + dust, ${preset.alphaMin}, ${preset.alphaMax});
  gl_FragColor = vec4(room + trace, alpha);
}
`.trim();
}

const nodeGraphShaderScriptDefaultFragmentSource = nodeGraphShaderScriptCameraPhosphorFragment({
  alphaMax: "0.42",
  alphaMin: "0.06",
  coreAmount: "0.075",
  coreColor: "0.78, 0.96, 0.86",
  darknessBase: "0.20",
  darknessVignette: "0.16",
  dustAmount: "0.012",
  dustSpeed: "14.0",
  glowAlphaCut: "0.08",
  glowColor: "0.16, 0.62, 0.54",
  haloAmount: "0.26",
  haloFalloff: "42.0",
  paneAmount: "0.085",
  paneEdge: "0.020",
  roomColor: "0.002, 0.008, 0.010",
  scanAmount: "0.18",
  scanBase: "0.82",
  scanDensity: "1.2",
  scanSpeed: "2.2",
  zoomFalloff: "2.0",
});

const nodeGraphShaderScriptGreenFragmentSource = nodeGraphShaderScriptCameraPhosphorFragment({
  alphaMax: "0.40",
  alphaMin: "0.055",
  coreAmount: "0.07",
  coreColor: "0.82, 1.0, 0.74",
  darknessBase: "0.19",
  darknessVignette: "0.15",
  dustAmount: "0.012",
  dustSpeed: "13.0",
  glowAlphaCut: "0.075",
  glowColor: "0.20, 0.70, 0.24",
  haloAmount: "0.24",
  haloFalloff: "44.0",
  paneAmount: "0.08",
  paneEdge: "0.019",
  roomColor: "0.002, 0.010, 0.004",
  scanAmount: "0.16",
  scanBase: "0.84",
  scanDensity: "1.1",
  scanSpeed: "2.0",
  zoomFalloff: "2.1",
});

const nodeGraphShaderScriptAmberFragmentSource = nodeGraphShaderScriptCameraPhosphorFragment({
  alphaMax: "0.43",
  alphaMin: "0.06",
  coreAmount: "0.078",
  coreColor: "1.0, 0.86, 0.54",
  darknessBase: "0.20",
  darknessVignette: "0.17",
  dustAmount: "0.013",
  dustSpeed: "12.0",
  glowAlphaCut: "0.08",
  glowColor: "0.72, 0.38, 0.08",
  haloAmount: "0.25",
  haloFalloff: "41.0",
  paneAmount: "0.085",
  paneEdge: "0.021",
  roomColor: "0.014, 0.009, 0.002",
  scanAmount: "0.17",
  scanBase: "0.83",
  scanDensity: "1.15",
  scanSpeed: "1.9",
  zoomFalloff: "2.0",
});

const nodeGraphShaderScriptCoolWhiteFragmentSource = nodeGraphShaderScriptCameraPhosphorFragment({
  alphaMax: "0.38",
  alphaMin: "0.05",
  coreAmount: "0.065",
  coreColor: "0.90, 0.98, 1.0",
  darknessBase: "0.18",
  darknessVignette: "0.14",
  dustAmount: "0.010",
  dustSpeed: "11.0",
  glowAlphaCut: "0.065",
  glowColor: "0.46, 0.58, 0.62",
  haloAmount: "0.20",
  haloFalloff: "48.0",
  paneAmount: "0.07",
  paneEdge: "0.018",
  roomColor: "0.006, 0.008, 0.010",
  scanAmount: "0.14",
  scanBase: "0.86",
  scanDensity: "1.05",
  scanSpeed: "1.7",
  zoomFalloff: "2.2",
});

const nodeGraphShaderScriptRedFragmentSource = nodeGraphShaderScriptCameraPhosphorFragment({
  alphaMax: "0.44",
  alphaMin: "0.065",
  coreAmount: "0.080",
  coreColor: "1.0, 0.66, 0.54",
  darknessBase: "0.21",
  darknessVignette: "0.17",
  dustAmount: "0.013",
  dustSpeed: "12.5",
  glowAlphaCut: "0.085",
  glowColor: "0.72, 0.16, 0.08",
  haloAmount: "0.27",
  haloFalloff: "40.0",
  paneAmount: "0.09",
  paneEdge: "0.022",
  roomColor: "0.014, 0.004, 0.003",
  scanAmount: "0.18",
  scanBase: "0.82",
  scanDensity: "1.15",
  scanSpeed: "2.0",
  zoomFalloff: "1.9",
});

const nodeGraphShaderScriptRgbPixelFragmentSource = `
precision mediump float;

uniform vec2 uResolution;
uniform float uTime;
uniform float uZoom;
uniform int uScopeCount;
uniform vec4 uScopeRects[32];

varying vec2 vUv;

float rectDistance(vec2 p, vec4 rect) {
  vec2 center = rect.xy + rect.zw * 0.5;
  vec2 q = abs(p - center) - rect.zw * 0.5;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

float grain(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec3 rgbTriadMask(vec2 pixelCoord, float reveal) {
  float pitch = mix(1.0, 5.0, reveal);
  float column = mod(floor(pixelCoord.x / pitch), 3.0);
  vec3 triad = vec3(
    0.44 + 0.56 * (1.0 - step(0.5, column)),
    0.44 + 0.56 * (step(0.5, column) * (1.0 - step(1.5, column))),
    0.44 + 0.56 * step(1.5, column)
  );
  float scanGap = 0.82 + 0.18 * step(0.18, fract(pixelCoord.y / max(1.0, pitch * 1.35)));
  return mix(vec3(1.0), triad * scanGap, reveal);
}

void main() {
  vec2 uv = vUv;
  float vignette = smoothstep(0.14, 0.92, length((uv - 0.5) * vec2(1.28, 1.0)));
  float darkness = 0.18 + vignette * 0.15;
  float glow = 0.0;
  float core = 0.0;

  for (int i = 0; i < 32; i++) {
    if (i < uScopeCount) {
      vec4 rect = uScopeRects[i];
      float d = rectDistance(uv, rect);
      float halo = exp(-max(d, 0.0) * (44.0 + uZoom * 2.2));
      float nearPane = smoothstep(0.020, -0.003, d);
      float scan = 0.84 + 0.16 * sin((uv.y * uResolution.y * 1.1) + uTime * 1.9);
      glow += halo * 0.23 + nearPane * scan * 0.078;
      core += nearPane;
    }
  }

  glow = clamp(glow, 0.0, 1.0);
  core = clamp(core, 0.0, 1.0);
  float reveal = smoothstep(1.18, 2.75, uZoom);
  vec3 mask = rgbTriadMask(gl_FragCoord.xy, reveal);
  float dust = (grain(gl_FragCoord.xy + uTime * 10.0) - 0.5) * 0.010;
  vec3 trace = (vec3(0.24, 0.64, 0.58) * glow + vec3(0.90, 0.98, 0.92) * core * 0.070) * mask;
  vec3 room = vec3(0.004, 0.008, 0.009);
  float alpha = clamp(darkness - glow * 0.070 + dust, 0.055, 0.40);
  gl_FragColor = vec4(room + trace, alpha);
}
`.trim();

const nodeGraphShaderScriptState = {
  animationFrame: 0,
  dialogMode: "global",
  dialogDrag: null,
  editorFontSizePx: nodeGraphShaderScriptEditorFontSizeLimits.defaultPx,
  enabled: false,
  fragmentSource: nodeGraphShaderScriptDefaultFragmentSource.trim(),
  gl: null,
  lastError: "",
  program: null,
  previewFrame: 0,
  renderer: null,
  scopeTargetNodeId: "",
  syntaxColors: { ...nodeGraphShaderScriptDefaultSyntaxColors },
  tokenWidget: null,
};

function nodeGraphShaderScriptCanvas() {
  return document.getElementById("nodeModularShaderCanvas");
}

function nodeGraphShaderScriptWorkspace() {
  return document.getElementById("nodeGraphWorkspace");
}

function loadNodeGraphShaderScriptState() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(nodeGraphShaderScriptStorageKey) || "{}");
    if (typeof parsed.fragmentSource === "string" && parsed.fragmentSource.trim()) {
      nodeGraphShaderScriptState.fragmentSource = parsed.fragmentSource;
    }
    nodeGraphShaderScriptState.editorFontSizePx = normalizeNodeGraphShaderScriptEditorFontSize(
      parsed.editorFontSizePx,
    );
    nodeGraphShaderScriptState.syntaxColors = normalizeNodeGraphShaderScriptSyntaxColors(parsed.syntaxColors);
  } catch {
    nodeGraphShaderScriptState.fragmentSource = nodeGraphShaderScriptDefaultFragmentSource.trim();
    nodeGraphShaderScriptState.editorFontSizePx = nodeGraphShaderScriptEditorFontSizeLimits.defaultPx;
    nodeGraphShaderScriptState.syntaxColors = { ...nodeGraphShaderScriptDefaultSyntaxColors };
    nodeGraphShaderScriptState.enabled = false;
  }
}

function saveNodeGraphShaderScriptState() {
  try {
    window.localStorage.setItem(
      nodeGraphShaderScriptStorageKey,
      JSON.stringify({
        enabled: Boolean(nodeGraphShaderScriptState.enabled),
        editorFontSizePx: nodeGraphShaderScriptState.editorFontSizePx,
        fragmentSource: nodeGraphShaderScriptState.fragmentSource,
        syntaxColors: normalizeNodeGraphShaderScriptSyntaxColors(nodeGraphShaderScriptState.syntaxColors),
      }),
    );
  } catch {
    // Visual customization is nice-to-have UI state.
  }
}

function normalizeNodeGraphShaderScriptEditorFontSize(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? clampNodeSliderValue(number, nodeGraphShaderScriptEditorFontSizeLimits.minPx, nodeGraphShaderScriptEditorFontSizeLimits.maxPx)
    : nodeGraphShaderScriptEditorFontSizeLimits.defaultPx;
}

function normalizeNodeGraphShaderScriptSyntaxColor(value, fallback) {
  const color = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(color)
    ? color.toLowerCase()
    : fallback;
}

function normalizeNodeGraphShaderScriptSyntaxColors(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(
    Object.entries(nodeGraphShaderScriptDefaultSyntaxColors).map(([key, fallback]) => {
      const normalized = normalizeNodeGraphShaderScriptSyntaxColor(source[key], fallback);
      return [
        key,
        normalized === nodeGraphShaderScriptLegacySyntaxColors[key] ? fallback : normalized,
      ];
    }),
  );
}

function applyNodeGraphShaderScriptSyntaxColors() {
  const root = document.documentElement;
  if (!root) {
    return;
  }
  const colors = normalizeNodeGraphShaderScriptSyntaxColors(nodeGraphShaderScriptState.syntaxColors);
  nodeGraphShaderScriptState.syntaxColors = colors;
  for (const [key, value] of Object.entries(colors)) {
    root.style.setProperty(`--node-shader-token-${key}`, value);
    const input = document.querySelector(`[data-shader-syntax-color="${key}"]`);
    if (input) {
      input.value = value;
    }
  }
}

function setNodeGraphShaderScriptSyntaxColor(key, value) {
  if (!Object.hasOwn(nodeGraphShaderScriptDefaultSyntaxColors, key)) {
    return;
  }
  nodeGraphShaderScriptState.syntaxColors = normalizeNodeGraphShaderScriptSyntaxColors({
    ...nodeGraphShaderScriptState.syntaxColors,
    [key]: value,
  });
  applyNodeGraphShaderScriptSyntaxColors();
  saveNodeGraphShaderScriptState();
}

function resetNodeGraphShaderScriptSyntaxColors() {
  nodeGraphShaderScriptState.syntaxColors = { ...nodeGraphShaderScriptDefaultSyntaxColors };
  applyNodeGraphShaderScriptSyntaxColors();
  saveNodeGraphShaderScriptState();
}

function applyNodeGraphShaderScriptEditorFontSize() {
  const root = document.documentElement;
  if (!root) {
    return;
  }
  const size = normalizeNodeGraphShaderScriptEditorFontSize(nodeGraphShaderScriptState.editorFontSizePx);
  nodeGraphShaderScriptState.editorFontSizePx = size;
  root.style.setProperty("--node-shader-script-font-size", `${size.toFixed(2)}px`);
  const decrease = document.getElementById("nodeShaderScriptTextSizeDecrease");
  const increase = document.getElementById("nodeShaderScriptTextSizeIncrease");
  if (decrease) {
    decrease.disabled = size <= nodeGraphShaderScriptEditorFontSizeLimits.minPx;
  }
  if (increase) {
    increase.disabled = size >= nodeGraphShaderScriptEditorFontSizeLimits.maxPx;
  }
}

function setNodeGraphShaderScriptSyntaxColorsPanelVisible(visible) {
  const panel = document.getElementById("nodeShaderScriptSyntaxColorsPanel");
  const button = document.getElementById("nodeShaderScriptSyntaxColorsButton");
  if (panel) {
    panel.hidden = !visible;
  }
  if (button) {
    button.setAttribute("aria-expanded", String(Boolean(visible)));
  }
  if (visible) {
    applyNodeGraphShaderScriptSyntaxColors();
  }
}

function toggleNodeGraphShaderScriptSyntaxColorsPanel() {
  const panel = document.getElementById("nodeShaderScriptSyntaxColorsPanel");
  setNodeGraphShaderScriptSyntaxColorsPanelVisible(Boolean(panel?.hidden));
}

function changeNodeGraphShaderScriptEditorFontSize(delta) {
  nodeGraphShaderScriptState.editorFontSizePx = normalizeNodeGraphShaderScriptEditorFontSize(
    nodeGraphShaderScriptState.editorFontSizePx + delta,
  );
  applyNodeGraphShaderScriptEditorFontSize();
  saveNodeGraphShaderScriptState();
  updateNodeGraphShaderScriptHighlight();
}

function compileNodeGraphShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader) || "shader compile failed";
    gl.deleteShader(shader);
    throw new Error(error);
  }
  return shader;
}

function createNodeGraphShaderProgram(gl, fragmentSource) {
  const vertex = compileNodeGraphShader(gl, gl.VERTEX_SHADER, nodeGraphShaderScriptVertexSource);
  const fragment = compileNodeGraphShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program) || "shader link failed";
    gl.deleteProgram(program);
    throw new Error(error);
  }
  return program;
}

function createNodeGraphShaderRenderer(canvas) {
  const gl = canvas?.getContext?.("webgl", {
    alpha: true,
    antialias: false,
    depth: false,
    preserveDrawingBuffer: false,
    premultipliedAlpha: false,
    stencil: false,
  });
  if (!gl) {
    return null;
  }
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  return {
    buffer,
    canvas,
    gl,
    positionLocation: -1,
    rectLocations: [],
    resolutionLocation: null,
    scopeCountLocation: null,
    timeLocation: null,
    zoomLocation: null,
  };
}

function updateNodeGraphShaderProgram(fragmentSource = nodeGraphShaderScriptState.fragmentSource) {
  const canvas = nodeGraphShaderScriptCanvas();
  const renderer = nodeGraphShaderScriptState.renderer ||= createNodeGraphShaderRenderer(canvas);
  if (!renderer) {
    nodeGraphShaderScriptStatus("WebGL unavailable", true);
    return false;
  }
  const { gl } = renderer;
  try {
    const program = createNodeGraphShaderProgram(gl, fragmentSource);
    if (nodeGraphShaderScriptState.program) {
      gl.deleteProgram(nodeGraphShaderScriptState.program);
    }
    nodeGraphShaderScriptState.program = program;
    renderer.positionLocation = gl.getAttribLocation(program, "aPosition");
    renderer.resolutionLocation = gl.getUniformLocation(program, "uResolution");
    renderer.timeLocation = gl.getUniformLocation(program, "uTime");
    renderer.zoomLocation = gl.getUniformLocation(program, "uZoom");
    renderer.scopeCountLocation = gl.getUniformLocation(program, "uScopeCount");
    renderer.rectLocations = Array.from({ length: nodeGraphShaderScriptMaxScopes }, (_, index) =>
      gl.getUniformLocation(program, `uScopeRects[${index}]`));
    nodeGraphShaderScriptState.fragmentSource = fragmentSource;
    nodeGraphShaderScriptState.lastError = "";
    nodeGraphShaderScriptStatus("shader applied", false);
    saveNodeGraphShaderScriptState();
    scheduleNodeGraphShaderScriptDraw();
    return true;
  } catch (error) {
    nodeGraphShaderScriptState.lastError = error?.message || "shader error";
    nodeGraphShaderScriptStatus(nodeGraphShaderScriptState.lastError, true);
    return false;
  }
}

function nodeGraphShaderScriptStatus(message, isError = false) {
  const status = document.getElementById("nodeShaderScriptStatus");
  if (!status) {
    return;
  }
  status.textContent = String(message || "ready").slice(0, 140);
  status.classList.toggle("warn", Boolean(isError));
  status.classList.toggle("good", !isError);
}

function escapeNodeGraphShaderScriptHtml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function colorizeNodeGraphShaderScriptLine(line = "", lineStart = 0) {
  const commentIndex = line.indexOf("//");
  const code = commentIndex >= 0 ? line.slice(0, commentIndex) : line;
  const comment = commentIndex >= 0 ? line.slice(commentIndex) : "";
  const tokenPattern = /(#[0-9a-fA-F]{3,8}\b|\b(?:dot[12]|blend)\.[a-zA-Z_][\w]*\b|\b(?:laser|led|light|paint|solid)\b|-?\d+(?:\.\d+)?\b|=)/g;
  let html = "";
  let lastIndex = 0;
  for (const match of code.matchAll(tokenPattern)) {
    const token = match[0];
    html += escapeNodeGraphShaderScriptHtml(code.slice(lastIndex, match.index));
    const className = token.startsWith("#")
      ? "node-shader-token-color"
      : token === "="
        ? "node-shader-token-assignment"
        : nodeGraphShaderScriptBlendModes.includes(token)
          ? "node-shader-token-mode"
          : token.startsWith("dot") || token.startsWith("blend")
          ? "node-shader-token-property"
          : "node-shader-token-number";
    const tokenStart = lineStart + match.index;
    const tokenEnd = tokenStart + token.length;
    const tokenType = token.startsWith("#")
      ? "color"
      : className === "node-shader-token-number"
        ? "number"
        : className === "node-shader-token-mode"
          ? "mode"
        : "";
    const tokenAttributes = tokenType
      ? ` data-token-type="${tokenType}" data-token-start="${tokenStart}" data-token-end="${tokenEnd}"`
      : "";
    const linkClass = tokenType ? " node-shader-token-link" : "";
    html += `<span class="${className}${linkClass}"${tokenAttributes}>${escapeNodeGraphShaderScriptHtml(token)}</span>`;
    lastIndex = match.index + token.length;
  }
  html += escapeNodeGraphShaderScriptHtml(code.slice(lastIndex));
  if (comment) {
    html += `<span class="node-shader-token-comment">${escapeNodeGraphShaderScriptHtml(comment)}</span>`;
  }
  return html;
}

function updateNodeGraphShaderScriptHighlight() {
  const source = document.getElementById("nodeShaderScriptSource");
  const highlight = document.getElementById("nodeShaderScriptHighlight");
  if (!source || !highlight) {
    return;
  }
  const text = source.value || "";
  let lineStart = 0;
  highlight.innerHTML = text.split("\n").map((line) => {
    const html = colorizeNodeGraphShaderScriptLine(line, lineStart);
    lineStart += line.length + 1;
    return html;
  }).join("\n") || "&nbsp;";
  highlight.scrollTop = source.scrollTop;
  highlight.scrollLeft = source.scrollLeft;
}

function closeNodeGraphShaderScriptTokenWidget() {
  const widget = document.getElementById("nodeShaderScriptTokenWidget");
  if (widget) {
    widget.hidden = true;
  }
  for (const id of [
    "nodeShaderScriptColorWidget",
    "nodeShaderScriptNumberWidget",
    "nodeShaderScriptModeWidget",
  ]) {
    const section = document.getElementById(id);
    if (section) {
      section.hidden = true;
    }
  }
  nodeGraphShaderScriptState.tokenWidget = null;
}

function normalizeNodeGraphShaderScriptColorToken(value = "") {
  const token = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(token)) {
    return token.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(token)) {
    return `#${token[1]}${token[1]}${token[2]}${token[2]}${token[3]}${token[3]}`.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{8}$/.test(token)) {
    return token.slice(0, 7).toLowerCase();
  }
  return "#ffffff";
}

function nodeGraphShaderScriptNumberPrecision(token = "") {
  const match = String(token).match(/\.(\d+)/);
  return match ? match[1].length : 0;
}

function nodeGraphShaderScriptNumberStep(token = "") {
  const precision = nodeGraphShaderScriptNumberPrecision(token);
  return precision > 0 ? 1 / (10 ** precision) : 1;
}

function formatNodeGraphShaderScriptNumberToken(value, previousToken = "") {
  const precision = nodeGraphShaderScriptNumberPrecision(previousToken);
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toFixed(precision)
    : String(previousToken || "0");
}

function findNodeGraphShaderScriptEditableTokenAt(index) {
  const source = document.getElementById("nodeShaderScriptSource");
  const text = source?.value || "";
  const position = clampNodeSliderValue(Number(index) || 0, 0, text.length);
  const tokenPattern = /#[0-9a-fA-F]{3,8}\b|-?\d+(?:\.\d+)?\b|\b(?:laser|led|light|paint|solid)\b/g;
  for (const match of text.matchAll(tokenPattern)) {
    const start = match.index;
    const end = start + match[0].length;
    if (position >= start && position <= end) {
      const lineStart = text.lastIndexOf("\n", start - 1) + 1;
      const commentIndex = text.indexOf("//", lineStart);
      if (commentIndex >= 0 && commentIndex < start) {
        return null;
      }
      return {
        end,
        start,
        token: match[0],
        type: match[0].startsWith("#")
          ? "color"
          : nodeGraphShaderScriptBlendModes.includes(match[0])
            ? "mode"
            : "number",
      };
    }
  }
  return null;
}

function replaceNodeGraphShaderScriptToken(nextToken) {
  const source = document.getElementById("nodeShaderScriptSource");
  const token = nodeGraphShaderScriptState.tokenWidget;
  if (!source || !token) {
    return;
  }
  const replacement = String(nextToken);
  source.setRangeText(replacement, token.start, token.end, "end");
  nodeGraphShaderScriptState.tokenWidget = {
    ...token,
    end: token.start + replacement.length,
    token: replacement,
  };
  updateNodeGraphShaderScriptHighlight();
}

function positionNodeGraphShaderScriptTokenWidget(event) {
  const widget = document.getElementById("nodeShaderScriptTokenWidget");
  const editor = document.querySelector(".node-shader-script-editor");
  if (!widget || !editor) {
    return;
  }
  const rect = editor.getBoundingClientRect();
  const x = clampNodeSliderValue((event?.clientX || rect.left + 16) - rect.left + 8, 8, Math.max(8, rect.width - 180));
  const y = clampNodeSliderValue((event?.clientY || rect.top + 16) - rect.top + 8, 8, Math.max(8, rect.height - 58));
  widget.style.left = `${x}px`;
  widget.style.top = `${y}px`;
}

function openNodeGraphShaderScriptTokenWidget(token, event) {
  const widget = document.getElementById("nodeShaderScriptTokenWidget");
  const colorSection = document.getElementById("nodeShaderScriptColorWidget");
  const numberSection = document.getElementById("nodeShaderScriptNumberWidget");
  const modeSection = document.getElementById("nodeShaderScriptModeWidget");
  if (!widget || !colorSection || !numberSection || !modeSection || !token) {
    closeNodeGraphShaderScriptTokenWidget();
    return;
  }
  nodeGraphShaderScriptState.tokenWidget = token;
  widget.hidden = false;
  colorSection.hidden = token.type !== "color";
  numberSection.hidden = token.type !== "number";
  modeSection.hidden = token.type !== "mode";
  if (token.type === "color") {
    const input = document.getElementById("nodeShaderScriptColorInput");
    if (input) {
      input.value = normalizeNodeGraphShaderScriptColorToken(token.token);
    }
  } else if (token.type === "number") {
    const input = document.getElementById("nodeShaderScriptNumberInput");
    if (input) {
      input.value = token.token;
      input.step = String(nodeGraphShaderScriptNumberStep(token.token));
    }
  }
  positionNodeGraphShaderScriptTokenWidget(event);
}

function handleNodeGraphShaderScriptSourcePointer(event) {
  window.setTimeout(() => {
    const source = document.getElementById("nodeShaderScriptSource");
    const token = findNodeGraphShaderScriptEditableTokenAt(source?.selectionStart ?? 0);
    if (token) {
      openNodeGraphShaderScriptTokenWidget(token, event);
    } else {
      closeNodeGraphShaderScriptTokenWidget();
    }
  }, 0);
}

function changeNodeGraphShaderScriptNumberToken(delta) {
  const token = nodeGraphShaderScriptState.tokenWidget;
  if (!token || token.type !== "number") {
    return;
  }
  const step = nodeGraphShaderScriptNumberStep(token.token);
  const nextValue = Number(token.token) + (Number(delta) || 0) * step;
  const nextToken = formatNodeGraphShaderScriptNumberToken(nextValue, token.token);
  replaceNodeGraphShaderScriptToken(nextToken);
  const input = document.getElementById("nodeShaderScriptNumberInput");
  if (input) {
    input.value = nextToken;
  }
}

function nodeGraphShaderScriptSourceText() {
  return document.getElementById("nodeShaderScriptSource")?.value || "";
}

function setNodeGraphShaderScriptSourceText(text) {
  const source = document.getElementById("nodeShaderScriptSource");
  if (!source) {
    return;
  }
  source.value = String(text || "");
  updateNodeGraphShaderScriptHighlight();
  closeNodeGraphShaderScriptTokenWidget();
}

async function copyNodeGraphShaderScriptSource() {
  const text = nodeGraphShaderScriptSourceText();
  try {
    await navigator.clipboard.writeText(text);
    nodeGraphShaderScriptStatus("copied", false);
  } catch {
    nodeGraphShaderScriptStatus("copy unavailable", true);
  }
}

async function pasteNodeGraphShaderScriptSource() {
  try {
    const text = await navigator.clipboard.readText();
    setNodeGraphShaderScriptSourceText(text);
    nodeGraphShaderScriptStatus("pasted", false);
  } catch {
    nodeGraphShaderScriptStatus("paste unavailable", true);
  }
}

function downloadNodeGraphShaderScriptSource(filename, source) {
  const link = document.createElement("a");
  const blob = new Blob([source], { type: "text/plain;charset=utf-8" });
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

async function exportNodeGraphShaderScriptToDesktop() {
  const targetNode = nodeGraphShaderScriptDialogScopeNode();
  const title = targetNode ? nodeGraphPatchNodeTitle(targetNode) : "modular-shader";
  const source = nodeGraphShaderScriptSourceText();
  try {
    const response = await fetch("/api/shader-script/to-desktop", {
      body: JSON.stringify({ source, title }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const result = await response.json();
    if (!response.ok || !result?.ok) {
      throw new Error(result?.error || "desktop export failed");
    }
    nodeGraphShaderScriptStatus(`desktop: ${result.filename}`, false);
  } catch {
    downloadNodeGraphShaderScriptSource(`${title.replace(/[^\w.-]+/g, "-") || "scope-shader"}.scope-shader.txt`, source);
    nodeGraphShaderScriptStatus("downloaded", false);
  }
}

function nodeGraphShaderScriptDialog() {
  return document.getElementById("nodeShaderScriptDialog");
}

function nodeGraphShaderScriptDialogCanDragTarget(target) {
  return !target?.closest?.("button, textarea, input, select, option, .node-shader-script-editor");
}

function positionNodeGraphShaderScriptDialog(left, top) {
  const dialog = nodeGraphShaderScriptDialog();
  if (!dialog) {
    return;
  }
  const margin = 12;
  const rect = dialog.getBoundingClientRect();
  const nextLeft = clampNodeSliderValue(Number(left) || 0, margin, Math.max(margin, window.innerWidth - rect.width - margin));
  const nextTop = clampNodeSliderValue(Number(top) || 0, margin, Math.max(margin, window.innerHeight - rect.height - margin));
  dialog.style.left = `${nextLeft}px`;
  dialog.style.top = `${nextTop}px`;
  dialog.style.right = "auto";
  dialog.style.bottom = "auto";
}

function beginNodeGraphShaderScriptDialogDrag(event) {
  if (event.button > 0 || !nodeGraphShaderScriptDialogCanDragTarget(event.target)) {
    return;
  }
  const dialog = nodeGraphShaderScriptDialog();
  if (!dialog || dialog.hidden) {
    return;
  }
  const rect = dialog.getBoundingClientRect();
  nodeGraphShaderScriptState.dialogDrag = {
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    pointerId: event.pointerId ?? null,
  };
  dialog.classList.add("dragging");
  event.currentTarget.setPointerCapture?.(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function dragNodeGraphShaderScriptDialog(event) {
  const drag = nodeGraphShaderScriptState.dialogDrag;
  if (
    !drag ||
    (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)
  ) {
    return;
  }
  positionNodeGraphShaderScriptDialog(event.clientX - drag.offsetX, event.clientY - drag.offsetY);
  event.preventDefault();
}

function endNodeGraphShaderScriptDialogDrag(event) {
  const drag = nodeGraphShaderScriptState.dialogDrag;
  if (
    !drag ||
    (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)
  ) {
    return;
  }
  nodeGraphShaderScriptState.dialogDrag = null;
  nodeGraphShaderScriptDialog()?.classList.remove("dragging");
  event.currentTarget.releasePointerCapture?.(event.pointerId);
  event.preventDefault();
}

function nodeGraphShaderScriptDialogScopeNode() {
  const nodeId = String(nodeGraphShaderScriptState.scopeTargetNodeId || "").trim();
  return nodeId ? nodeGraphPatchNode(nodeId) : null;
}

function nodeGraphShaderScriptDialogScopeSource() {
  const node = nodeGraphShaderScriptDialogScopeNode();
  return normalizeNodeGraphScopeShader(node?.scopeShader).source;
}

function nodeGraphShaderScriptScopePreviewSlot() {
  const node = nodeGraphShaderScriptDialogScopeNode();
  return node?.id ? nodeGraphModuleScopeState?.slots?.get?.(node.id) || null : null;
}

function syncNodeGraphShaderScriptModelPreview(slot) {
  const preview = document.getElementById("nodeShaderScriptModelPreview");
  const canvas = document.getElementById("nodeShaderScriptPreviewCanvas");
  if (!preview || !canvas) {
    return null;
  }
  const sourceModule = slot?.element;
  if (!sourceModule?.isConnected) {
    preview.querySelector(".node-shader-script-model-clone")?.remove();
    canvas.style.removeProperty("--node-shader-scope-preview-aspect");
    canvas.style.removeProperty("--node-shader-scope-preview-left");
    canvas.style.removeProperty("--node-shader-scope-preview-top");
    canvas.style.removeProperty("--node-shader-scope-preview-width");
    canvas.style.removeProperty("--node-shader-scope-preview-height");
    return null;
  }
  let clone = preview.querySelector(".node-shader-script-model-clone");
  if (!clone || clone.dataset.node !== sourceModule.dataset.node) {
    clone?.remove();
    clone = sourceModule.cloneNode(true);
    clone.classList.add("node-shader-script-model-clone");
    clone.querySelectorAll("button, input, textarea, select").forEach((element) => {
      element.disabled = true;
      element.tabIndex = -1;
    });
    clone.querySelectorAll(".node-module-scope-analyzer").forEach((element) => {
      element.remove();
    });
    preview.prepend(clone);
  }
  const sourceRect = sourceModule.getBoundingClientRect();
  const sourceScopeRect = slot.scopeElement?.getBoundingClientRect?.();
  const previewRect = preview.getBoundingClientRect();
  const cloneRect = clone.getBoundingClientRect();
  const cloneScopeElement = clone.querySelector(".node-module-scope-window, .node-led-face");
  const cloneScopeRect = cloneScopeElement?.getBoundingClientRect?.();
  const widthRatio = cloneRect.width / Math.max(1, sourceRect.width);
  const heightRatio = cloneRect.height / Math.max(1, sourceRect.height);
  const left = cloneScopeRect
    ? cloneScopeRect.left - previewRect.left
    : cloneRect.left - previewRect.left + (((sourceScopeRect?.left || sourceRect.left) - sourceRect.left) * widthRatio);
  const top = cloneScopeRect
    ? cloneScopeRect.top - previewRect.top
    : cloneRect.top - previewRect.top + (((sourceScopeRect?.top || sourceRect.top) - sourceRect.top) * heightRatio);
  const width = cloneScopeRect?.width || (sourceScopeRect?.width || sourceRect.width) * widthRatio;
  const height = cloneScopeRect?.height || (sourceScopeRect?.height || sourceRect.height) * heightRatio;
  canvas.style.setProperty("--node-shader-scope-preview-aspect", `${Math.max(1, width)} / ${Math.max(1, height)}`);
  canvas.style.setProperty("--node-shader-scope-preview-left", `${left}px`);
  canvas.style.setProperty("--node-shader-scope-preview-top", `${top}px`);
  canvas.style.setProperty("--node-shader-scope-preview-width", `${width}px`);
  canvas.style.setProperty("--node-shader-scope-preview-height", `${height}px`);
  return { height, width };
}

function drawNodeGraphShaderScriptScopePreview() {
  nodeGraphShaderScriptState.previewFrame = 0;
  const panel = document.getElementById("nodeShaderScriptPreviewPanel");
  const canvas = document.getElementById("nodeShaderScriptPreviewCanvas");
  const status = document.getElementById("nodeShaderScriptPreviewStatus");
  if (
    nodeGraphShaderScriptState.dialogMode !== "scope" ||
    !panel ||
    panel.hidden ||
    !canvas
  ) {
    return;
  }
  const slot = nodeGraphShaderScriptScopePreviewSlot();
  const sourceCanvas = nodeGraphModuleScopeCanvas?.();
  const lightCanvas = nodeGraphModuleScopeLightCanvas?.();
  const workspace = document.getElementById("nodeGraphWorkspace");
  const scopeElement = slot?.scopeElement;
  const context = canvas.getContext("2d");
  if (!slot || !sourceCanvas || !workspace || !scopeElement || !context) {
    syncNodeGraphShaderScriptModelPreview(null);
    if (status) {
      status.textContent = "No scope selected.";
    }
    scheduleNodeGraphShaderScriptScopePreview();
    return;
  }
  syncNodeGraphShaderScriptModelPreview(slot);
  const sourceRect = sourceCanvas.getBoundingClientRect();
  const scopeRect = scopeElement.getBoundingClientRect();
  const previewAspectWidth = Math.max(1, Number(scopeRect.width) || 1);
  const previewAspectHeight = Math.max(1, Number(scopeRect.height) || 1);
  canvas.style.setProperty("--node-shader-scope-preview-aspect", `${previewAspectWidth} / ${previewAspectHeight}`);
  const scaleX = sourceCanvas.width / Math.max(1, sourceRect.width);
  const scaleY = sourceCanvas.height / Math.max(1, sourceRect.height);
  const sx = Math.max(0, Math.floor((scopeRect.left - sourceRect.left) * scaleX));
  const sy = Math.max(0, Math.floor((scopeRect.top - sourceRect.top) * scaleY));
  const sw = Math.max(1, Math.floor(scopeRect.width * scaleX));
  const sh = Math.max(1, Math.floor(scopeRect.height * scaleY));
  const targetWidth = Math.max(1, Math.floor(canvas.clientWidth * (window.devicePixelRatio || 1)));
  const targetHeight = Math.max(1, Math.floor(canvas.clientHeight * (window.devicePixelRatio || 1)));
  if (canvas.width !== targetWidth) {
    canvas.width = targetWidth;
  }
  if (canvas.height !== targetHeight) {
    canvas.height = targetHeight;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  try {
    context.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    if (lightCanvas && lightCanvas.width && lightCanvas.height) {
      context.drawImage(lightCanvas, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    }
    if (status) {
      status.textContent = "";
    }
  } catch {
    if (status) {
      status.textContent = "Live preview unavailable.";
    }
  }
  scheduleNodeGraphShaderScriptScopePreview();
}

function scheduleNodeGraphShaderScriptScopePreview() {
  if (nodeGraphShaderScriptState.previewFrame) {
    return;
  }
  if (
    nodeGraphShaderScriptState.dialogMode !== "scope" ||
    document.getElementById("nodeShaderScriptDialog")?.hidden
  ) {
    return;
  }
  nodeGraphShaderScriptState.previewFrame = window.requestAnimationFrame(drawNodeGraphShaderScriptScopePreview);
}

function syncNodeGraphShaderScriptControls(options = {}) {
  const source = document.getElementById("nodeShaderScriptSource");
  const scopeMode = nodeGraphShaderScriptState.dialogMode === "scope";
  if (source && (options.forceSource || document.activeElement !== source)) {
    source.value = scopeMode
      ? nodeGraphShaderScriptDialogScopeSource()
      : nodeGraphShaderScriptState.fragmentSource;
  }
  updateNodeGraphShaderScriptHighlight();
  const title = document.getElementById("nodeShaderScriptTitle");
  const targetNode = scopeMode ? nodeGraphShaderScriptDialogScopeNode() : null;
  if (title) {
    title.textContent = scopeMode && targetNode
      ? `Scope Shader: ${nodeGraphPatchNodeTitle(targetNode)}`
      : "Shader Script";
  }
  const modeLabel = title?.closest?.(".node-shader-script-heading")?.querySelector?.("span");
  if (modeLabel) {
    modeLabel.textContent = scopeMode ? "module scope" : "modular view";
  }
  const enable = document.getElementById("nodeShaderScriptEnable");
  if (enable) {
    enable.hidden = scopeMode;
    enable.textContent = nodeGraphShaderScriptState.enabled ? "Enabled" : "Disabled";
    enable.setAttribute("aria-pressed", String(Boolean(nodeGraphShaderScriptState.enabled)));
  }
  const applyButton = document.getElementById("nodeShaderScriptApply");
  if (applyButton) {
    applyButton.textContent = scopeMode ? "Save" : "Apply";
  }
  const previewPanel = document.getElementById("nodeShaderScriptPreviewPanel");
  if (previewPanel) {
    previewPanel.hidden = !scopeMode;
  }
  const defaultButton = document.getElementById("nodeShaderScriptDefault");
  if (defaultButton) {
    defaultButton.textContent = scopeMode ? "Scope Starter" : "Ghost Phosphor";
  }
  for (const id of [
    "nodeShaderScriptGreenPreset",
    "nodeShaderScriptAmberPreset",
    "nodeShaderScriptCoolWhitePreset",
    "nodeShaderScriptRgbPixelPreset",
    "nodeShaderScriptRedPreset",
  ]) {
    const button = document.getElementById(id);
    if (button) {
      button.hidden = scopeMode;
    }
  }
  const toolbar = document.getElementById("nodeShaderScriptButton");
  if (toolbar) {
    toolbar.setAttribute("aria-pressed", String(Boolean(nodeGraphShaderScriptState.enabled)));
  }
  const uiSetting = document.getElementById("nodeUiDevModularShaderEnabled");
  if (uiSetting && document.activeElement !== uiSetting) {
    uiSetting.checked = Boolean(nodeGraphShaderScriptState.enabled);
  }
  nodeGraphShaderScriptWorkspace()?.classList.toggle("shader-enabled", Boolean(nodeGraphShaderScriptState.enabled));
  applyNodeGraphShaderScriptEditorFontSize();
  applyNodeGraphShaderScriptSyntaxColors();
  scheduleNodeGraphShaderScriptScopePreview();
}

function clearNodeGraphShaderScriptCanvas() {
  const canvas = nodeGraphShaderScriptCanvas();
  const gl = nodeGraphShaderScriptState.renderer?.gl || canvas?.getContext?.("webgl");
  if (!gl) {
    return;
  }
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

function nodeGraphShaderScriptRects(canvas) {
  const workspace = nodeGraphShaderScriptWorkspace();
  if (!workspace || !canvas?.width || !canvas?.height) {
    return [];
  }
  const workspaceRect = workspace.getBoundingClientRect();
  const scaleX = canvas.width / Math.max(1, workspaceRect.width);
  const scaleY = canvas.height / Math.max(1, workspaceRect.height);
  return [...workspace.querySelectorAll(".node-module-scope-window")]
    .filter((scope) => scope.offsetParent !== null)
    .slice(0, nodeGraphShaderScriptMaxScopes)
    .map((scope) => {
      const rect = scope.getBoundingClientRect();
      const x = ((rect.left - workspaceRect.left) * scaleX) / canvas.width;
      const y = (canvas.height - ((rect.bottom - workspaceRect.top) * scaleY)) / canvas.height;
      const width = (rect.width * scaleX) / canvas.width;
      const height = (rect.height * scaleY) / canvas.height;
      return [
        clampNodeSliderValue(x, -1, 2),
        clampNodeSliderValue(y, -1, 2),
        clampNodeSliderValue(width, 0, 2),
        clampNodeSliderValue(height, 0, 2),
      ];
    });
}

function resizeNodeGraphShaderCanvas(canvas) {
  const workspace = nodeGraphShaderScriptWorkspace();
  if (!workspace || !canvas) {
    return false;
  }
  const pixelRatio = window.devicePixelRatio || 1;
  const rect = workspace.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * pixelRatio));
  const height = Math.max(1, Math.round(rect.height * pixelRatio));
  if (canvas.width !== width) {
    canvas.width = width;
  }
  if (canvas.height !== height) {
    canvas.height = height;
  }
  return true;
}

function drawNodeGraphShaderScriptFrame() {
  nodeGraphShaderScriptState.animationFrame = 0;
  if (!nodeGraphShaderScriptState.enabled) {
    return;
  }
  const canvas = nodeGraphShaderScriptCanvas();
  if (!resizeNodeGraphShaderCanvas(canvas)) {
    scheduleNodeGraphShaderScriptDraw();
    return;
  }
  const renderer = nodeGraphShaderScriptState.renderer ||= createNodeGraphShaderRenderer(canvas);
  if (!renderer || !nodeGraphShaderScriptState.program) {
    updateNodeGraphShaderProgram();
    scheduleNodeGraphShaderScriptDraw();
    return;
  }
  const { gl } = renderer;
  const program = nodeGraphShaderScriptState.program;
  const scopeRects = nodeGraphShaderScriptRects(canvas);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, renderer.buffer);
  gl.enableVertexAttribArray(renderer.positionLocation);
  gl.vertexAttribPointer(renderer.positionLocation, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(renderer.resolutionLocation, canvas.width, canvas.height);
  gl.uniform1f(renderer.timeLocation, (performance.now?.() || Date.now()) / 1000);
  gl.uniform1f(renderer.zoomLocation, Number(nodeGraphMvp?.zoom) || 1);
  gl.uniform1i(renderer.scopeCountLocation, scopeRects.length);
  for (let index = 0; index < nodeGraphShaderScriptMaxScopes; index += 1) {
    const rect = scopeRects[index] || [0, 0, 0, 0];
    const location = renderer.rectLocations[index];
    if (location) {
      gl.uniform4f(location, rect[0], rect[1], rect[2], rect[3]);
    }
  }
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.disableVertexAttribArray(renderer.positionLocation);
  scheduleNodeGraphShaderScriptDraw();
}

function scheduleNodeGraphShaderScriptDraw() {
  if (nodeGraphShaderScriptState.animationFrame || !nodeGraphShaderScriptState.enabled) {
    return;
  }
  nodeGraphShaderScriptState.animationFrame = window.requestAnimationFrame(drawNodeGraphShaderScriptFrame);
}

function setNodeGraphShaderScriptEnabled(enabled, options = {}) {
  const nextEnabled = Boolean(enabled);
  nodeGraphShaderScriptState.enabled = nextEnabled;
  if (options.persist !== false) {
    saveNodeGraphShaderScriptState();
  }
  syncNodeGraphShaderScriptControls();
  if (nextEnabled) {
    scheduleNodeGraphShaderScriptDraw();
  } else {
    clearNodeGraphShaderScriptCanvas();
  }
}

function setNodeGraphShaderScriptDialogVisible(visible) {
  const dialog = nodeGraphShaderScriptDialog();
  if (!dialog) {
    return;
  }
  dialog.hidden = !visible;
  if (visible) {
    syncNodeGraphShaderScriptControls({ forceSource: true });
    document.getElementById("nodeShaderScriptSource")?.focus();
  } else {
    if (nodeGraphShaderScriptState.previewFrame) {
      window.cancelAnimationFrame(nodeGraphShaderScriptState.previewFrame);
      nodeGraphShaderScriptState.previewFrame = 0;
    }
    setNodeGraphShaderScriptSyntaxColorsPanelVisible(false);
  }
}

function setNodeGraphShaderScriptDialogMode(mode, nodeId = "") {
  nodeGraphShaderScriptState.dialogMode = mode === "scope" ? "scope" : "global";
  nodeGraphShaderScriptState.scopeTargetNodeId = nodeGraphShaderScriptState.dialogMode === "scope"
    ? String(nodeId || "").trim()
    : "";
}

function openNodeGraphGlobalShaderScript() {
  setNodeGraphShaderScriptDialogMode("global");
  setNodeGraphShaderScriptDialogVisible(true);
}

function openNodeGraphScopeShaderScript(nodeId) {
  const node = nodeGraphPatchNode(nodeId);
  if (!node) {
    return false;
  }
  setNodeGraphShaderScriptDialogMode("scope", node.id);
  setNodeGraphShaderScriptDialogVisible(true);
  nodeGraphShaderScriptStatus("ready", false);
  return true;
}

function toggleNodeGraphShaderScriptEnabled() {
  setNodeGraphShaderScriptEnabled(!nodeGraphShaderScriptState.enabled);
}

function saveNodeGraphScopeShaderScriptFromDialog() {
  const targetNode = nodeGraphShaderScriptDialogScopeNode();
  if (!targetNode) {
    nodeGraphShaderScriptStatus("scope module missing", true);
    return false;
  }
  const source = document.getElementById("nodeShaderScriptSource")?.value || "";
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const node = patch.nodes.find((candidate) => candidate.id === targetNode.id);
  if (!node) {
    nodeGraphShaderScriptStatus("scope module missing", true);
    return false;
  }
  node.scopeShader = normalizeNodeGraphScopeShader({
    ...node.scopeShader,
    source,
  });
  commitNodeGraphPatch(patch, {
    status: `scope shader saved for ${nodeGraphPatchNodeTitle(node)}`,
  });
  nodeGraphShaderScriptStatus("scope shader saved", false);
  return true;
}

function applyNodeGraphShaderScriptFromDialog() {
  if (nodeGraphShaderScriptState.dialogMode === "scope") {
    saveNodeGraphScopeShaderScriptFromDialog();
    return;
  }
  const source = document.getElementById("nodeShaderScriptSource")?.value || "";
  if (updateNodeGraphShaderProgram(source)) {
    setNodeGraphShaderScriptEnabled(true);
  }
}

function applyNodeGraphShaderScriptPreset(fragmentSource) {
  if (nodeGraphShaderScriptState.dialogMode === "scope") {
    document.getElementById("nodeShaderScriptSource").value = nodeGraphScopeShaderDefaultSource;
    updateNodeGraphShaderScriptHighlight();
    nodeGraphShaderScriptStatus("scope starter loaded", false);
    return;
  }
  nodeGraphShaderScriptState.fragmentSource = fragmentSource.trim();
  document.getElementById("nodeShaderScriptSource").value = nodeGraphShaderScriptState.fragmentSource;
  updateNodeGraphShaderScriptHighlight();
  updateNodeGraphShaderProgram(nodeGraphShaderScriptState.fragmentSource);
  setNodeGraphShaderScriptEnabled(true);
}

function resetNodeGraphShaderScriptDefault() {
  applyNodeGraphShaderScriptPreset(nodeGraphShaderScriptDefaultFragmentSource);
}

function applyNodeGraphShaderScriptGreenPreset() {
  applyNodeGraphShaderScriptPreset(nodeGraphShaderScriptGreenFragmentSource);
}

function applyNodeGraphShaderScriptAmberPreset() {
  applyNodeGraphShaderScriptPreset(nodeGraphShaderScriptAmberFragmentSource);
}

function applyNodeGraphShaderScriptCoolWhitePreset() {
  applyNodeGraphShaderScriptPreset(nodeGraphShaderScriptCoolWhiteFragmentSource);
}

function applyNodeGraphShaderScriptRgbPixelPreset() {
  applyNodeGraphShaderScriptPreset(nodeGraphShaderScriptRgbPixelFragmentSource);
}

function applyNodeGraphShaderScriptRedPreset() {
  applyNodeGraphShaderScriptPreset(nodeGraphShaderScriptRedFragmentSource);
}

function bindNodeGraphShaderScriptEvents() {
  loadNodeGraphShaderScriptState();
  syncNodeGraphShaderScriptControls();
  document.getElementById("nodeShaderScriptButton")?.addEventListener("click", () =>
    openNodeGraphGlobalShaderScript());
  document.getElementById("nodeShaderScriptClose")?.addEventListener("click", () =>
    setNodeGraphShaderScriptDialogVisible(false));
  document.getElementById("nodeShaderScriptApply")?.addEventListener("click", applyNodeGraphShaderScriptFromDialog);
  document.getElementById("nodeShaderScriptCopy")?.addEventListener("click", copyNodeGraphShaderScriptSource);
  document.getElementById("nodeShaderScriptPaste")?.addEventListener("click", pasteNodeGraphShaderScriptSource);
  document.getElementById("nodeShaderScriptToDesktop")?.addEventListener("click", exportNodeGraphShaderScriptToDesktop);
  document.getElementById("nodeShaderScriptTextSizeDecrease")?.addEventListener("click", () =>
    changeNodeGraphShaderScriptEditorFontSize(-nodeGraphShaderScriptEditorFontSizeLimits.stepPx));
  document.getElementById("nodeShaderScriptTextSizeIncrease")?.addEventListener("click", () =>
    changeNodeGraphShaderScriptEditorFontSize(nodeGraphShaderScriptEditorFontSizeLimits.stepPx));
  document.getElementById("nodeShaderScriptSyntaxColorsButton")?.addEventListener("click", toggleNodeGraphShaderScriptSyntaxColorsPanel);
  document.getElementById("nodeShaderScriptSyntaxColorsReset")?.addEventListener("click", resetNodeGraphShaderScriptSyntaxColors);
  document.querySelectorAll("[data-shader-syntax-color]").forEach((input) => {
    input.addEventListener("input", () => setNodeGraphShaderScriptSyntaxColor(input.dataset.shaderSyntaxColor, input.value));
  });
  const source = document.getElementById("nodeShaderScriptSource");
  source?.addEventListener("input", () => {
    updateNodeGraphShaderScriptHighlight();
    closeNodeGraphShaderScriptTokenWidget();
  });
  source?.addEventListener("scroll", updateNodeGraphShaderScriptHighlight);
  source?.addEventListener("pointerup", handleNodeGraphShaderScriptSourcePointer);
  source?.addEventListener("keyup", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      const token = findNodeGraphShaderScriptEditableTokenAt(source.selectionStart ?? 0);
      if (token) {
        openNodeGraphShaderScriptTokenWidget(token, event);
      } else {
        closeNodeGraphShaderScriptTokenWidget();
      }
    }
  });
  document.getElementById("nodeShaderScriptColorInput")?.addEventListener("input", (event) => {
    replaceNodeGraphShaderScriptToken(normalizeNodeGraphShaderScriptColorToken(event.target.value));
  });
  document.getElementById("nodeShaderScriptNumberInput")?.addEventListener("input", (event) => {
    const token = nodeGraphShaderScriptState.tokenWidget;
    if (!token || token.type !== "number") {
      return;
    }
    replaceNodeGraphShaderScriptToken(formatNodeGraphShaderScriptNumberToken(event.target.value, token.token));
  });
  document.getElementById("nodeShaderScriptNumberDecrease")?.addEventListener("click", () =>
    changeNodeGraphShaderScriptNumberToken(-1));
  document.getElementById("nodeShaderScriptNumberIncrease")?.addEventListener("click", () =>
    changeNodeGraphShaderScriptNumberToken(1));
  document.querySelectorAll("[data-shader-blend-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.shaderBlendMode;
      if (nodeGraphShaderScriptBlendModes.includes(mode)) {
        replaceNodeGraphShaderScriptToken(mode);
      }
    });
  });
  const panel = document.querySelector("#nodeShaderScriptDialog .node-shader-script-panel");
  panel?.addEventListener("pointerdown", beginNodeGraphShaderScriptDialogDrag);
  panel?.addEventListener("pointermove", dragNodeGraphShaderScriptDialog);
  panel?.addEventListener("pointerup", endNodeGraphShaderScriptDialogDrag);
  panel?.addEventListener("pointercancel", endNodeGraphShaderScriptDialogDrag);
  document.getElementById("nodeShaderScriptDefault")?.addEventListener("click", resetNodeGraphShaderScriptDefault);
  document.getElementById("nodeShaderScriptGreenPreset")?.addEventListener("click", applyNodeGraphShaderScriptGreenPreset);
  document.getElementById("nodeShaderScriptAmberPreset")?.addEventListener("click", applyNodeGraphShaderScriptAmberPreset);
  document.getElementById("nodeShaderScriptCoolWhitePreset")?.addEventListener("click", applyNodeGraphShaderScriptCoolWhitePreset);
  document.getElementById("nodeShaderScriptRgbPixelPreset")?.addEventListener("click", applyNodeGraphShaderScriptRgbPixelPreset);
  document.getElementById("nodeShaderScriptRedPreset")?.addEventListener("click", applyNodeGraphShaderScriptRedPreset);
  document.getElementById("nodeShaderScriptEnable")?.addEventListener("click", toggleNodeGraphShaderScriptEnabled);
  updateNodeGraphShaderProgram(nodeGraphShaderScriptState.fragmentSource);
  if (nodeGraphShaderScriptState.enabled) {
    scheduleNodeGraphShaderScriptDraw();
  }
}
