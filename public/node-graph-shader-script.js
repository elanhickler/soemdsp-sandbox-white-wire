const nodeGraphShaderScriptStorageKey = "soemdsp-sandbox.modularShader.v1";
const nodeGraphShaderScriptMaxScopes = 32;
const nodeGraphShaderScriptEditorFontSizeLimits = Object.freeze({
  defaultPx: 11.5,
  maxPx: 22,
  minPx: 8,
  stepPx: 0.75,
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
  renderer: null,
  scopeTargetNodeId: "",
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
  } catch {
    nodeGraphShaderScriptState.fragmentSource = nodeGraphShaderScriptDefaultFragmentSource.trim();
    nodeGraphShaderScriptState.editorFontSizePx = nodeGraphShaderScriptEditorFontSizeLimits.defaultPx;
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

function colorizeNodeGraphShaderScriptLine(line = "") {
  const commentIndex = line.indexOf("//");
  const code = commentIndex >= 0 ? line.slice(0, commentIndex) : line;
  const comment = commentIndex >= 0 ? line.slice(commentIndex) : "";
  const tokenPattern = /(#[0-9a-fA-F]{3,8}\b|\b(?:dot[12]|blend)\.[a-zA-Z_][\w]*\b|\b(?:laser|led|light|paint|solid)\b|\b\d+(?:\.\d+)?\b|=)/g;
  let html = "";
  let lastIndex = 0;
  for (const match of code.matchAll(tokenPattern)) {
    const token = match[0];
    html += escapeNodeGraphShaderScriptHtml(code.slice(lastIndex, match.index));
    const className = token.startsWith("#")
      ? "node-shader-token-color"
      : token === "="
        ? "node-shader-token-assignment"
        : ["laser", "led", "light", "paint", "solid"].includes(token)
          ? "node-shader-token-mode"
          : token.startsWith("dot") || token.startsWith("blend")
          ? "node-shader-token-property"
          : "node-shader-token-number";
    html += `<span class="${className}">${escapeNodeGraphShaderScriptHtml(token)}</span>`;
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
  highlight.innerHTML = text
    .split("\n")
    .map(colorizeNodeGraphShaderScriptLine)
    .join("\n") || "&nbsp;";
  highlight.scrollTop = source.scrollTop;
  highlight.scrollLeft = source.scrollLeft;
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
    applyButton.textContent = scopeMode ? "Save Scope Shader" : "Apply";
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
  document.getElementById("nodeShaderScriptTextSizeDecrease")?.addEventListener("click", () =>
    changeNodeGraphShaderScriptEditorFontSize(-nodeGraphShaderScriptEditorFontSizeLimits.stepPx));
  document.getElementById("nodeShaderScriptTextSizeIncrease")?.addEventListener("click", () =>
    changeNodeGraphShaderScriptEditorFontSize(nodeGraphShaderScriptEditorFontSizeLimits.stepPx));
  const source = document.getElementById("nodeShaderScriptSource");
  source?.addEventListener("input", updateNodeGraphShaderScriptHighlight);
  source?.addEventListener("scroll", updateNodeGraphShaderScriptHighlight);
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
