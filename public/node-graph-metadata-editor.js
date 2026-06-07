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
  if (event.button > 0 || nodeGraphDialogDragTargetIsInteractive(event)) {
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

function metadataScriptStatus(message, error = false, detail = "") {
  const status = document.getElementById("metadataScriptStatus");
  if (!status) {
    return;
  }
  status.textContent = message;
  status.title = detail || message;
  status.classList.toggle("error", Boolean(error));
  status.classList.toggle("dirty", Boolean(nodeGraphMvp.metadataScriptDirty));
}

function metadataScriptSourceText() {
  return document.getElementById("metadataScriptSource")?.value || "";
}

const nodeMetadataScriptHighlightTokenPattern =
  /param\.[A-Za-z0-9_.]+|\[[^\]]*\]|-?(?:\d+\.\d+|\d+|\.\d+)(?:e[+-]?\d+)?|\b(?:true|false|any)\b|=|[A-Za-z_][\w-]*/gi;

const nodeMetadataScriptAliases = Object.freeze({
  default: "def",
});

const nodeMetadataScriptSupportedKeys = new Set([
  "choices",
  "def",
  "displayChoices",
  "divideChoicesVisibly",
  "kind",
  "linearSmoothing",
  "max",
  "maxDigits",
  "mid",
  "min",
  "nonlinearSlider",
  "showSign",
  "step",
  "unit",
  "wraparound",
]);

function escapeNodeMetadataScriptHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function colorizeNodeMetadataScriptLine(line = "") {
  const commentIndex = line.indexOf("//");
  const code = commentIndex >= 0 ? line.slice(0, commentIndex) : line;
  const comment = commentIndex >= 0 ? line.slice(commentIndex) : "";
  let html = "";
  let lastIndex = 0;
  for (const match of code.matchAll(nodeMetadataScriptHighlightTokenPattern)) {
    const token = match[0];
    html += escapeNodeMetadataScriptHtml(code.slice(lastIndex, match.index));
    const lowerToken = token.toLowerCase();
    const className = token.startsWith("param.")
      ? "metadata-token-property"
      : token === "="
        ? "metadata-token-assignment"
        : token.startsWith("[") && token.endsWith("]")
          ? "metadata-token-list"
          : ["true", "false", "any"].includes(lowerToken)
            ? "metadata-token-keyword"
            : Number.isFinite(Number(token))
              ? "metadata-token-number"
              : "metadata-token-value";
    html += `<span class="${className}">${escapeNodeMetadataScriptHtml(token)}</span>`;
    lastIndex = match.index + token.length;
  }
  html += escapeNodeMetadataScriptHtml(code.slice(lastIndex));
  if (comment) {
    html += `<span class="metadata-token-comment">${escapeNodeMetadataScriptHtml(comment)}</span>`;
  }
  return html;
}

function updateNodeMetadataScriptHighlight() {
  const source = document.getElementById("metadataScriptSource");
  const highlight = document.getElementById("metadataScriptHighlight");
  if (!source || !highlight) {
    return;
  }
  const text = source.value || "";
  const ignoredLines = new Set(analyzeNodeMetadataScriptSource(text).ignored);
  highlight.innerHTML = text.split("\n").map((line, index) => {
    const lineNumber = index + 1;
    const lineClass = ignoredLines.has(lineNumber)
      ? "metadata-script-line metadata-script-line-ignored"
      : "metadata-script-line";
    return `<span class="${lineClass}">${colorizeNodeMetadataScriptLine(line) || " "}</span>`;
  }).join("\n") || "&nbsp;";
  highlight.scrollTop = source.scrollTop;
  highlight.scrollLeft = source.scrollLeft;
}

function setMetadataScriptSourceText(text) {
  const source = document.getElementById("metadataScriptSource");
  if (!source) {
    return;
  }
  source.value = String(text || "");
  updateNodeMetadataScriptHighlight();
  updateNodeMetadataScriptPreview(source.value);
}

function setNodeMetadataScriptDirty(dirty, message = "", error = false, detail = "") {
  nodeGraphMvp.metadataScriptDirty = Boolean(dirty);
  const popover = document.getElementById("nodeParameterMetadataPopover");
  if (popover) {
    popover.dataset.metadataScriptDirty = dirty ? "true" : "false";
  }
  const saveButton = document.getElementById("metadataScriptApply");
  if (saveButton) {
    saveButton.classList.toggle("armed", Boolean(dirty));
  }
  if (message) {
    metadataScriptStatus(message, error, detail);
  } else {
    metadataScriptStatus(dirty ? "unsaved" : "saved", false);
  }
}

function confirmNodeMetadataScriptDiscard() {
  return !nodeGraphMvp.metadataScriptDirty ||
    window.confirm("Discard unsaved metadata script changes?");
}

function nodeMetadataScriptParamKey(slider) {
  return String(slider?.dataset?.param || "parameter")
    .trim()
    .replace(/[^\w]+/g, "_") || "parameter";
}

function nodeMetadataScriptValue(value, key = "") {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => String(entry || "").trim()).filter(Boolean).join(", ")}]`;
  }
  if (key === "step" && (!Number.isFinite(Number(value)) || Number(value) <= 0)) {
    return "any";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Number.isFinite(Number(value)) && String(value).trim() !== "") {
    return formatNodeSliderCompactNumber(Number(value));
  }
  return String(value ?? "");
}

function formatNodeMetadataScript(slider, metadata = nodeSliderMetadata(slider)) {
  const key = nodeMetadataScriptParamKey(slider);
  const nodeElement = slider?.closest?.(".dsp-node");
  const node = nodeElement ? nodeGraphPatchNode(nodeElement.dataset.node) : null;
  const title = node ? nodeGraphPatchNodeTitle(node) : "Module";
  const label = nodeSliderLabelText(slider);
  const rows = [
    `// ${title} : ${label}`,
    `param.${key}.kind = ${nodeMetadataScriptValue(metadata.kind, "kind")};`,
    `param.${key}.min = ${nodeMetadataScriptValue(metadata.min, "min")};`,
    `param.${key}.mid = ${nodeMetadataScriptValue(metadata.mid, "mid")};`,
    `param.${key}.max = ${nodeMetadataScriptValue(metadata.max, "max")};`,
    `param.${key}.default = ${nodeMetadataScriptValue(metadata.def, "default")};`,
    `param.${key}.step = ${nodeMetadataScriptValue(metadata.step, "step")};`,
    `param.${key}.unit = ${nodeMetadataScriptValue(metadata.unit, "unit")};`,
    `param.${key}.maxDigits = ${nodeMetadataScriptValue(metadata.maxDigits, "maxDigits")};`,
    `param.${key}.choices = ${nodeMetadataScriptValue(metadata.choices, "choices")};`,
    `param.${key}.displayChoices = ${nodeMetadataScriptValue(metadata.displayChoices, "displayChoices")};`,
    `param.${key}.divideChoicesVisibly = ${nodeMetadataScriptValue(metadata.divideChoicesVisibly, "divideChoicesVisibly")};`,
    `param.${key}.linearSmoothing = ${nodeMetadataScriptValue(metadata.linearSmoothing, "linearSmoothing")};`,
    `param.${key}.nonlinearSlider = ${nodeMetadataScriptValue(metadata.nonlinearSlider, "nonlinearSlider")};`,
    `param.${key}.showSign = ${nodeMetadataScriptValue(metadata.showSign, "showSign")};`,
    `param.${key}.wraparound = ${nodeMetadataScriptValue(metadata.wraparound, "wraparound")};`,
  ];
  return rows.join("\n");
}

function nodeMetadataScriptTemplateForKind(slider, kind) {
  const normalizedKind = normalizeNodeMetadataKind(kind);
  const template = nodeMetadataKindTemplates[normalizedKind] || nodeMetadataKindTemplates.decimal;
  const templateMetadata = {
    choices: template.choices || [],
    def: Number.isFinite(Number(template.def)) ? Number(template.def) : 0,
    displayChoices: Boolean(template.displayChoices),
    divideChoicesVisibly: Boolean(template.divideChoicesVisibly),
    kind: normalizedKind,
    linearSmoothing: template.linearSmoothing !== false,
    max: Number.isFinite(Number(template.max)) ? Number(template.max) : 1,
    maxDigits: normalizeNodeGraphMetadataMaxDigits(template.maxDigits, normalizedKind),
    mid: Number.isFinite(Number(template.mid)) ? Number(template.mid) : 0,
    min: Number.isFinite(Number(template.min)) ? Number(template.min) : 0,
    nonlinearSlider: Boolean(template.nonlinearSlider),
    showSign: Boolean(template.showPlusMinus),
    step: Number.isFinite(Number(template.step)) ? Number(template.step) : 0,
    unit: template.unit || "",
    wraparound: Boolean(template.wraparound),
  };
  const metadata = normalizeNodeGraphPatchParameterMetadata(
    nodeGraphPatchNode(slider?.closest?.(".dsp-node")?.dataset.node)?.type,
    slider?.dataset?.param,
    templateMetadata,
  ) || templateMetadata;
  return formatNodeMetadataScript(slider, metadata);
}

function syncNodeMetadataScriptFromFields(options = {}) {
  const slider = document.getElementById(nodeGraphMvp.metadataEditorTarget);
  if (!slider) {
    metadataScriptStatus("no parameter", true);
    return;
  }
  if (!options.force && nodeGraphMvp.metadataScriptDirty && !confirmNodeMetadataScriptDiscard()) {
    metadataScriptStatus("sync canceled", false);
    return;
  }
  const metadata = readNodeMetadataEditorValues(slider);
  setMetadataScriptSourceText(formatNodeMetadataScript(slider, metadata));
  setNodeMetadataScriptDirty(false, "script synced", false);
}

function parseNodeMetadataScriptBoolean(value, fallback = false) {
  const text = String(value || "").trim().toLowerCase();
  if (["true", "yes", "on", "1"].includes(text)) {
    return true;
  }
  if (["false", "no", "off", "0"].includes(text)) {
    return false;
  }
  return Boolean(fallback);
}

function parseNodeMetadataScriptChoices(value) {
  const text = String(value || "").trim();
  if (!text || text.toLowerCase() === "none" || text === "[]") {
    return [];
  }
  const body = text.startsWith("[") && text.endsWith("]")
    ? text.slice(1, -1)
    : text;
  return parseNodeMetadataChoices(body);
}

function nodeMetadataScriptKeyFromPath(path = "") {
  const pathKey = String(path || "").split(".").pop();
  return nodeMetadataScriptAliases[pathKey] || pathKey;
}

function parseNodeMetadataScriptAssignments(source) {
  const assignments = [];
  const ignored = [];
  const lines = String(source || "").split(/\r?\n/);
  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.replace(/\/\/.*$/, "").trim();
    if (!line) {
      continue;
    }
    const match = line.match(/^([\w.]+)\s*=\s*(.+?)\s*;?$/);
    if (!match) {
      ignored.push(index + 1);
      continue;
    }
    assignments.push({
      key: nodeMetadataScriptKeyFromPath(match[1]),
      line: index + 1,
      path: match[1],
      rawValue: match[2].trim(),
    });
  }
  return { assignments, ignored };
}

function analyzeNodeMetadataScriptSource(source) {
  const parsed = parseNodeMetadataScriptAssignments(source);
  const supported = [];
  const unsupported = [];
  for (const assignment of parsed.assignments) {
    if (nodeMetadataScriptSupportedKeys.has(assignment.key)) {
      supported.push(assignment);
    } else {
      unsupported.push(assignment);
    }
  }
  const ignored = [
    ...parsed.ignored,
    ...unsupported.map((assignment) => assignment.line),
  ].sort((a, b) => a - b);
  return {
    assignmentCount: parsed.assignments.length,
    ignored,
    ok: ignored.length === 0,
    syntaxIgnored: parsed.ignored,
    supported,
    supportedCount: supported.length,
    unsupported,
  };
}

function nodeMetadataScriptPreviewValueFingerprint(value) {
  if (Array.isArray(value)) {
    return JSON.stringify(value.map((entry) => String(entry || "").trim()));
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Number.isFinite(Number(value)) && String(value).trim() !== "") {
    return String(Number(value));
  }
  return String(value ?? "").trim();
}

function nodeMetadataScriptPreviewValueText(value, key = "") {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => String(entry || "").trim()).filter(Boolean).join(", ")}]`;
  }
  return nodeMetadataScriptValue(value, key);
}

function nodeMetadataScriptPreviewState(assignment, draftMetadata) {
  return nodeMetadataScriptPreviewDetails(assignment, draftMetadata).state;
}

function nodeMetadataScriptPreviewDetails(assignment, draftMetadata) {
  if (!draftMetadata || !nodeMetadataScriptSupportedKeys.has(assignment.key)) {
    return {
      after: assignment.rawValue,
      before: "",
      state: "supported",
    };
  }
  try {
    const beforeValue = draftMetadata[assignment.key];
    const parsedValue = parseNodeMetadataScriptValue(
      assignment.rawValue,
      assignment.key,
      draftMetadata,
    );
    draftMetadata[assignment.key] = parsedValue;
    const before = nodeMetadataScriptPreviewValueText(beforeValue, assignment.key);
    const after = nodeMetadataScriptPreviewValueText(parsedValue, assignment.key);
    return {
      after,
      before,
      state: nodeMetadataScriptPreviewValueFingerprint(beforeValue) ===
        nodeMetadataScriptPreviewValueFingerprint(parsedValue)
        ? "same"
        : "changed",
    };
  } catch {
    return {
      after: assignment.rawValue,
      before: "",
      state: "supported",
    };
  }
}

function nodeMetadataScriptPreviewItemHtml(assignment, details = "supported") {
  const detail = typeof details === "string" ? { state: details } : details;
  const state = detail.state || "supported";
  const stateText = state === "unsupported"
    ? "ignored"
    : state === "same"
      ? "same"
      : state === "changed"
        ? "change"
        : "will set";
  const valueText = state === "changed" && detail.before
    ? `${detail.before} => ${detail.after}`
    : detail.after || assignment.rawValue;
  return `
    <li class="${state === "unsupported" ? "ignored" : state}" data-line="${escapeNodeMetadataScriptHtml(assignment.line)}">
      <span>${escapeNodeMetadataScriptHtml(stateText)}</span>
      <em>L${escapeNodeMetadataScriptHtml(assignment.line)}</em>
      <strong>${escapeNodeMetadataScriptHtml(assignment.key)}</strong>
      <code>${escapeNodeMetadataScriptHtml(valueText)}</code>
    </li>`;
}

function nodeMetadataScriptEffectiveRows(metadata) {
  const flags = [
    metadata.displayChoices ? "display choices" : "",
    metadata.divideChoicesVisibly ? "divided choices" : "",
    metadata.linearSmoothing ? "smooth" : "",
    metadata.nonlinearSlider ? "nonlinear" : "",
    metadata.showSign ? "signed" : "",
    metadata.wraparound ? "wraparound" : "",
  ].filter(Boolean);
  const choices = Array.isArray(metadata.choices) && metadata.choices.length
    ? metadata.choices.join(", ")
    : "none";
  return [
    ["kind", metadata.kind || "decimal"],
    ["range", `${nodeMetadataScriptPreviewValueText(metadata.min, "min")} to ${nodeMetadataScriptPreviewValueText(metadata.max, "max")}`],
    ["mid", nodeMetadataScriptPreviewValueText(metadata.mid, "mid")],
    ["default", nodeMetadataScriptPreviewValueText(metadata.def, "default")],
    ["step", nodeMetadataScriptPreviewValueText(metadata.step, "step")],
    ["unit", metadata.unit || "none"],
    ["digits", normalizeNodeGraphMetadataMaxDigits(metadata.maxDigits, metadata.kind)],
    ["choices", choices],
    ["flags", flags.length ? flags.join(", ") : "none"],
  ];
}

function updateNodeMetadataScriptEffective(source = metadataScriptSourceText()) {
  const effective = document.getElementById("metadataScriptEffective");
  const slider = document.getElementById(nodeGraphMvp.metadataEditorTarget);
  if (!effective || !slider) {
    if (effective) {
      effective.hidden = true;
      effective.innerHTML = "";
    }
    return;
  }
  const parsed = parseNodeMetadataScript(source, slider);
  effective.hidden = false;
  effective.innerHTML = nodeMetadataScriptEffectiveRows(parsed.metadata)
    .map(([key, value]) => `
      <div>
        <dt>${escapeNodeMetadataScriptHtml(key)}</dt>
        <dd>${escapeNodeMetadataScriptHtml(value)}</dd>
      </div>`)
    .join("");
}

function updateNodeMetadataScriptPreview(source = metadataScriptSourceText()) {
  const preview = document.getElementById("metadataScriptPreview");
  if (!preview) {
    return;
  }
  updateNodeMetadataScriptEffective(source);
  const diagnostics = analyzeNodeMetadataScriptSource(source);
  const maxVisibleItems = 8;
  const slider = document.getElementById(nodeGraphMvp.metadataEditorTarget);
  const currentMetadata = slider ? nodeSliderMetadata(slider) : null;
  const draftMetadata = slider ? {
    ...currentMetadata,
    choices: [...(currentMetadata.choices || [])],
  } : null;
  const items = [
    ...diagnostics.supported.map((assignment) =>
      nodeMetadataScriptPreviewItemHtml(
        assignment,
        nodeMetadataScriptPreviewDetails(assignment, draftMetadata),
      )),
    ...diagnostics.unsupported.map((assignment) =>
      nodeMetadataScriptPreviewItemHtml(assignment, "unsupported")),
  ];
  if (diagnostics.syntaxIgnored.length) {
    const firstSyntaxLine = diagnostics.syntaxIgnored[0];
    items.push(`
      <li class="ignored" data-line="${escapeNodeMetadataScriptHtml(firstSyntaxLine)}">
        <span>ignored</span>
        <em>L${escapeNodeMetadataScriptHtml(diagnostics.syntaxIgnored.join(","))}</em>
        <strong>syntax</strong>
        <code>not an assignment</code>
      </li>`);
  }
  preview.hidden = items.length === 0;
  if (items.length === 0) {
    preview.innerHTML = "";
    return;
  }
  const hiddenCount = Math.max(0, items.length - maxVisibleItems);
  const visibleItems = items.slice(0, maxVisibleItems);
  if (hiddenCount) {
    visibleItems.push(`
      <li class="more">
        <span>preview</span>
        <em>...</em>
        <strong>more</strong>
        <code>${hiddenCount} more</code>
      </li>`);
  }
  preview.innerHTML = visibleItems.join("");
}

function focusNodeMetadataScriptLine(lineNumber) {
  const source = document.getElementById("metadataScriptSource");
  const line = Math.max(1, Number.parseInt(lineNumber, 10) || 1);
  if (!source) {
    return;
  }
  const lines = source.value.split("\n");
  const start = lines.slice(0, line - 1).reduce((offset, text) => offset + text.length + 1, 0);
  const end = start + (lines[line - 1]?.length || 0);
  source.focus();
  source.setSelectionRange(start, end);
}

function handleNodeMetadataScriptPreviewClick(event) {
  const row = event.target?.closest?.("[data-line]");
  if (!row) {
    return;
  }
  focusNodeMetadataScriptLine(row.dataset.line);
}

function nodeMetadataScriptDiagnosticMessage(source = metadataScriptSourceText()) {
  const diagnostics = analyzeNodeMetadataScriptSource(source);
  const settingsText = diagnostics.supportedCount === 1
    ? "1 setting"
    : `${diagnostics.supportedCount} settings`;
  if (diagnostics.assignmentCount === 0 && diagnostics.ignored.length === 0) {
    return { error: false, message: "unsaved: empty script" };
  }
  if (diagnostics.ignored.length) {
    const syntaxDetail = diagnostics.syntaxIgnored.length
      ? `syntax lines ${diagnostics.syntaxIgnored.join(", ")}`
      : "";
    const unsupportedDetail = diagnostics.unsupported.length
      ? `unsupported ${diagnostics.unsupported.map((assignment) => `line ${assignment.line}: ${assignment.path}`).join("; ")}`
      : "";
    const detail = [syntaxDetail, unsupportedDetail].filter(Boolean).join(" | ");
    return {
      detail,
      error: true,
      message: `unsaved: ${settingsText}; ignored lines ${diagnostics.ignored.join(", ")}`,
    };
  }
  return { error: false, message: `unsaved: ${settingsText} ready` };
}

function syncNodeMetadataScriptDiagnostics() {
  updateNodeMetadataScriptPreview();
  const diagnostics = nodeMetadataScriptDiagnosticMessage();
  setNodeMetadataScriptDirty(true, diagnostics.message, diagnostics.error, diagnostics.detail);
}

function runNodeMetadataScriptParserSelfTest() {
  const fakeSlider = document.createElement("div");
  fakeSlider.dataset.param = "waveform";
  const parsed = parseNodeMetadataScriptAssignments(`
// parser fixture
param.frequency.default = 440;
param.frequency.choices = [Saw, Square, Sine];
param.frequency.displayChoices = true;
this line is intentionally invalid
`);
  const samePreviewDraft = { def: 440, kind: "decimal" };
  const changedPreviewDraft = { def: 440, kind: "decimal" };
  const checks = [
    parsed.assignments.length === 3,
    parsed.assignments[0]?.key === "def",
    parsed.assignments[0]?.rawValue === "440",
    parsed.assignments[1]?.rawValue === "[Saw, Square, Sine]",
    parsed.assignments[2]?.key === "displayChoices",
    parsed.ignored.length === 1,
    parsed.ignored[0] === 6,
    analyzeNodeMetadataScriptSource("param.frequency.default = 440;").supportedCount === 1,
    analyzeNodeMetadataScriptSource("param.frequency.unknown = 1;").unsupported.length === 1,
    nodeMetadataScriptDiagnosticMessage("param.frequency.unknown = 1;").error === true,
    nodeMetadataScriptPreviewState({ key: "def", rawValue: "440" }, samePreviewDraft) === "same",
    nodeMetadataScriptPreviewState({ key: "def", rawValue: "441" }, changedPreviewDraft) === "changed",
    nodeMetadataScriptPreviewDetails({ key: "def", rawValue: "441" }, { def: 440, kind: "decimal" }).after === "441",
    nodeMetadataScriptPreviewDetails({ key: "def", rawValue: "441" }, { def: 440, kind: "decimal" }).before === "440",
    nodeMetadataScriptEffectiveRows({ kind: "decimal", min: 0, mid: 0.5, max: 1, def: 0.25, step: 0, unit: "", maxDigits: 2, choices: [], displayChoices: false, divideChoicesVisibly: false, linearSmoothing: true, nonlinearSlider: false, showSign: false, wraparound: false })
      .some(([key, value]) => key === "step" && value === "any"),
    nodeMetadataScriptTemplateForKind(fakeSlider, "waveform").includes("param.waveform.choices = [Saw, Square, Triangle, Sine, Noise];"),
    nodeMetadataScriptTemplateForKind(fakeSlider, "waveform").includes("param.waveform.displayChoices = true;"),
  ];
  return {
    assignments: parsed.assignments,
    ignored: parsed.ignored,
    ok: checks.every(Boolean),
  };
}

function syncNodeMetadataScriptParserSelfTestStatus() {
  const result = runNodeMetadataScriptParserSelfTest();
  document.documentElement.dataset.metadataScriptParserSelfTest = result.ok ? "passed" : "failed";
  if (!result.ok) {
    console.warn("metadata script parser self-test failed", result);
  }
}

function scheduleNodeMetadataScriptParserSelfTestStatus() {
  if (document.readyState === "complete") {
    syncNodeMetadataScriptParserSelfTestStatus();
    return;
  }
  window.addEventListener("load", syncNodeMetadataScriptParserSelfTestStatus, { once: true });
}

function parseNodeMetadataScriptValue(rawValue, key, current) {
  const value = String(rawValue || "").trim().replace(/;$/, "").trim();
  if (key === "choices") {
    return parseNodeMetadataScriptChoices(value);
  }
  if (["displayChoices", "divideChoicesVisibly", "linearSmoothing", "nonlinearSlider", "showSign", "wraparound"].includes(key)) {
    return parseNodeMetadataScriptBoolean(value, current[key]);
  }
  if (key === "kind") {
    return normalizeNodeMetadataKind(value);
  }
  if (key === "unit") {
    return value.replace(/^["']|["']$/g, "");
  }
  if (key === "step" && value.toLowerCase() === "any") {
    return 0;
  }
  if (key === "maxDigits") {
    return normalizeNodeGraphMetadataMaxDigits(value, current.kind);
  }
  return parseNodeMetadataNumber(value, current[key]);
}

function parseNodeMetadataScript(source, slider) {
  const current = nodeSliderMetadata(slider);
  const next = { ...current, choices: [...(current.choices || [])] };
  const parsed = parseNodeMetadataScriptAssignments(source);
  const ignored = [...parsed.ignored];
  for (const assignment of parsed.assignments) {
    if (!nodeMetadataScriptSupportedKeys.has(assignment.key)) {
      ignored.push(assignment.line);
      continue;
    }
    next[assignment.key] = parseNodeMetadataScriptValue(
      assignment.rawValue,
      assignment.key,
      next,
    );
  }
  return {
    ignored,
    metadata: normalizeNodeGraphPatchParameterMetadata(
      nodeGraphPatchNode(slider.closest(".dsp-node")?.dataset.node)?.type,
      slider.dataset.param,
      next,
    ) || next,
  };
}

function writeNodeMetadataEditorValues(metadata) {
  document.getElementById("metadataMinValue").value = formatNodeSliderCompactNumber(metadata.min);
  document.getElementById("metadataMidValue").value = formatNodeSliderCompactNumber(metadata.mid);
  document.getElementById("metadataMaxValue").value = formatNodeSliderCompactNumber(metadata.max);
  document.getElementById("metadataDefaultValue").value =
    formatNodeSliderCompactNumber(metadata.def);
  document.getElementById("metadataStepValue").value = formatNodeMetadataStep(metadata.step);
  document.getElementById("metadataMaxDigitsValue").value =
    String(normalizeNodeGraphMetadataMaxDigits(metadata.maxDigits, metadata.kind));
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
}

function fillNodeMetadataPopover(slider) {
  populateNodeMetadataKindChoices();
  const metadata = nodeSliderMetadata(slider);
  document.getElementById("metadataPopoverTitle").textContent = nodeSliderDebugPath(slider);
  document.getElementById("metadataScriptTarget").textContent = nodeSliderLabelText(slider);
  writeNodeMetadataEditorValues(metadata);
  setMetadataScriptSourceText(formatNodeMetadataScript(slider, metadata));
  setNodeMetadataScriptDirty(false, "script ready", false);
  document.getElementById("metadataSetDefaultButton").classList.remove("armed");
}

function openNodeMetadataPopover(event, readout) {
  event.preventDefault();
  event.stopPropagation();
  bindNodeGraphMetadataPopoverEvents();
  const slider = document.getElementById(readout.dataset.sliderTarget);
  if (!slider) {
    return;
  }
  if (nodeGraphMvp.metadataEditorTarget !== slider.id && !confirmNodeMetadataScriptDiscard()) {
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
  if (!confirmNodeMetadataScriptDiscard()) {
    return;
  }
  const popover = document.getElementById("nodeParameterMetadataPopover");
  popover.hidden = true;
  setNodeMetadataScriptDirty(false, "");
  if (nodeGraphMvp.metadataDragging?.handle) {
    nodeGraphMvp.metadataDragging.handle.classList.remove("dragging");
  }
  nodeGraphMvp.metadataDragging = null;
  nodeGraphMvp.metadataEditorTarget = null;
}

function bindNodeGraphMetadataPopoverEvents() {
  const popover = document.getElementById("nodeParameterMetadataPopover");
  if (popover && popover.dataset.metadataPopoverBound !== "true") {
    popover.dataset.metadataPopoverBound = "true";
    popover.addEventListener("input", handleNodeMetadataEditorInput);
  }
  const scriptSource = document.getElementById("metadataScriptSource");
  if (scriptSource && scriptSource.dataset.metadataScriptSourceBound !== "true") {
    scriptSource.dataset.metadataScriptSourceBound = "true";
    scriptSource.addEventListener("keydown", handleNodeMetadataScriptKeydown);
    scriptSource.addEventListener("scroll", updateNodeMetadataScriptHighlight);
  }
  const scriptPreview = document.getElementById("metadataScriptPreview");
  if (scriptPreview && scriptPreview.dataset.metadataScriptPreviewBound !== "true") {
    scriptPreview.dataset.metadataScriptPreviewBound = "true";
    scriptPreview.addEventListener("click", handleNodeMetadataScriptPreviewClick);
  }
  const closeButton = document.getElementById("metadataPopoverClose");
  if (closeButton && closeButton.dataset.metadataCloseBound !== "true") {
    closeButton.dataset.metadataCloseBound = "true";
    closeButton.addEventListener("click", closeNodeMetadataPopover);
  }
  const dragHandle = document.getElementById("metadataPopoverDragHandle");
  if (dragHandle && dragHandle.dataset.metadataDragBound !== "true") {
    dragHandle.dataset.metadataDragBound = "true";
    dragHandle.addEventListener("pointerdown", beginNodeMetadataPopoverDrag);
  }
  const dragHeading = document.querySelector("#nodeParameterMetadataPopover .metadata-popover-heading");
  if (dragHeading && dragHeading.dataset.metadataDragHeadingBound !== "true") {
    dragHeading.dataset.metadataDragHeadingBound = "true";
    dragHeading.addEventListener("pointerdown", beginNodeMetadataPopoverDrag);
  }
  const defaultButton = document.getElementById("metadataSetDefaultButton");
  if (defaultButton && defaultButton.dataset.metadataDefaultBound !== "true") {
    defaultButton.dataset.metadataDefaultBound = "true";
    defaultButton.addEventListener("click", setNodeMetadataDefaultsFromKind);
  }
  const kindInput = document.getElementById("metadataKindValue");
  if (kindInput && kindInput.dataset.metadataKindBound !== "true") {
    kindInput.dataset.metadataKindBound = "true";
    kindInput.addEventListener("change", handleNodeMetadataKindChange);
  }
  const scriptApply = document.getElementById("metadataScriptApply");
  if (scriptApply && scriptApply.dataset.metadataScriptApplyBound !== "true") {
    scriptApply.dataset.metadataScriptApplyBound = "true";
    scriptApply.addEventListener("click", applyNodeMetadataScriptEditor);
  }
  const scriptRefresh = document.getElementById("metadataScriptRefresh");
  if (scriptRefresh && scriptRefresh.dataset.metadataScriptRefreshBound !== "true") {
    scriptRefresh.dataset.metadataScriptRefreshBound = "true";
    scriptRefresh.addEventListener("click", () => syncNodeMetadataScriptFromFields());
  }
  const scriptKindTemplate = document.getElementById("metadataScriptKindTemplate");
  if (scriptKindTemplate && scriptKindTemplate.dataset.metadataScriptKindTemplateBound !== "true") {
    scriptKindTemplate.dataset.metadataScriptKindTemplateBound = "true";
    scriptKindTemplate.addEventListener("click", insertNodeMetadataScriptKindTemplate);
  }
  const scriptCopy = document.getElementById("metadataScriptCopy");
  if (scriptCopy && scriptCopy.dataset.metadataScriptCopyBound !== "true") {
    scriptCopy.dataset.metadataScriptCopyBound = "true";
    scriptCopy.addEventListener("click", copyNodeMetadataScriptSource);
  }
  const scriptPaste = document.getElementById("metadataScriptPaste");
  if (scriptPaste && scriptPaste.dataset.metadataScriptPasteBound !== "true") {
    scriptPaste.dataset.metadataScriptPasteBound = "true";
    scriptPaste.addEventListener("click", pasteNodeMetadataScriptSource);
  }
  const scriptToDesktop = document.getElementById("metadataScriptToDesktop");
  if (scriptToDesktop && scriptToDesktop.dataset.metadataScriptDesktopBound !== "true") {
    scriptToDesktop.dataset.metadataScriptDesktopBound = "true";
    scriptToDesktop.addEventListener("click", exportNodeMetadataScriptToDesktop);
  }
}

function insertNodeMetadataScriptText(text) {
  const source = document.getElementById("metadataScriptSource");
  if (!source) {
    return;
  }
  const start = source.selectionStart ?? source.value.length;
  const end = source.selectionEnd ?? start;
  source.setRangeText(text, start, end, "end");
  updateNodeMetadataScriptHighlight();
  syncNodeMetadataScriptDiagnostics();
}

function handleNodeMetadataScriptKeydown(event) {
  const source = event.currentTarget;
  if (!source || source.id !== "metadataScriptSource") {
    return;
  }
  const commandKey = event.ctrlKey || event.metaKey;
  if (event.key === "Tab") {
    event.preventDefault();
    insertNodeMetadataScriptText("  ");
    return;
  }
  if (commandKey && (event.key.toLowerCase() === "s" || event.key === "Enter")) {
    event.preventDefault();
    applyNodeMetadataScriptEditor();
  }
}

function insertNodeMetadataScriptKindTemplate() {
  const slider = document.getElementById(nodeGraphMvp.metadataEditorTarget);
  if (!slider) {
    metadataScriptStatus("no parameter", true);
    return;
  }
  if (nodeGraphMvp.metadataScriptDirty && !confirmNodeMetadataScriptDiscard()) {
    metadataScriptStatus("template canceled", false);
    return;
  }
  const kind = normalizeNodeMetadataKind(document.getElementById("metadataKindValue").value);
  setMetadataScriptSourceText(nodeMetadataScriptTemplateForKind(slider, kind));
  syncNodeMetadataScriptDiagnostics();
  metadataScriptStatus(`template: ${kind}`, false, `Kind template inserted for ${kind}. Save to apply.`);
}

function bindNodeMetadataScriptBeforeUnload() {
  if (window.nodeMetadataScriptBeforeUnloadBound === true) {
    return;
  }
  window.nodeMetadataScriptBeforeUnloadBound = true;
  window.addEventListener("beforeunload", (event) => {
    if (!nodeGraphMvp.metadataScriptDirty) {
      return;
    }
    event.preventDefault();
    event.returnValue = "";
  });
}

function readNodeMetadataEditorValues(slider) {
  const current = nodeSliderMetadata(slider);
  let min = parseNodeMetadataNumber(document.getElementById("metadataMinValue").value, current.min);
  let max = parseNodeMetadataNumber(document.getElementById("metadataMaxValue").value, current.max);
  if (min > max) {
    [min, max] = [max, min];
  }
  const stepInput = document.getElementById("metadataStepValue").value.trim();
  const kind = normalizeNodeMetadataKind(document.getElementById("metadataKindValue").value);
  return {
    def: parseNodeMetadataNumber(document.getElementById("metadataDefaultValue").value, current.def),
    kind,
    max,
    maxDigits: normalizeNodeGraphMetadataMaxDigits(
      document.getElementById("metadataMaxDigitsValue").value,
      kind,
    ),
    mid: parseNodeMetadataNumber(document.getElementById("metadataMidValue").value, current.mid),
    min,
    choices: parseNodeMetadataChoices(document.getElementById("metadataChoicesValue").value),
    displayChoices: document.getElementById("metadataDisplayChoicesValue").checked,
    divideChoicesVisibly: document.getElementById("metadataDivideChoicesValue").checked,
    linearSmoothing: document.getElementById("metadataLinearSmoothingValue").checked,
    nonlinearSlider: document.getElementById("metadataNonlinearSliderValue").checked,
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
  syncNodeGraphPatchMetadataFromSlider(slider, {
    status: "metadata synced",
  });
  markNodeGraphRenderPending();
}

function applyNodeMetadataScriptEditor() {
  const slider = document.getElementById(nodeGraphMvp.metadataEditorTarget);
  if (!slider) {
    metadataScriptStatus("no parameter", true);
    return false;
  }
  const parsed = parseNodeMetadataScript(metadataScriptSourceText(), slider);
  setNodeSliderMetadata(slider, parsed.metadata);
  writeNodeMetadataEditorValues(nodeSliderMetadata(slider));
  syncNodeGraphPatchMetadataFromSlider(slider, {
    status: "metadata script synced",
  });
  markNodeGraphRenderPending();
  const ignoredText = parsed.ignored.length
    ? `; ignored lines ${parsed.ignored.join(", ")}`
    : "";
  setNodeMetadataScriptDirty(Boolean(parsed.ignored.length), `script applied${ignoredText}`, Boolean(parsed.ignored.length));
  return true;
}

async function copyNodeMetadataScriptSource() {
  try {
    await navigator.clipboard.writeText(metadataScriptSourceText());
    metadataScriptStatus("copied", false);
  } catch {
    metadataScriptStatus("copy unavailable", true);
  }
}

async function pasteNodeMetadataScriptSource() {
  try {
    const text = await navigator.clipboard.readText();
    setMetadataScriptSourceText(text);
    syncNodeMetadataScriptDiagnostics();
  } catch {
    metadataScriptStatus("paste unavailable", true);
  }
}

function downloadNodeMetadataScriptSource(filename, source) {
  const link = document.createElement("a");
  const blob = new Blob([source], { type: "text/plain;charset=utf-8" });
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

async function exportNodeMetadataScriptToDesktop() {
  const slider = document.getElementById(nodeGraphMvp.metadataEditorTarget);
  const nodeElement = slider?.closest?.(".dsp-node");
  const node = nodeElement ? nodeGraphPatchNode(nodeElement.dataset.node) : null;
  const title = `${node ? nodeGraphPatchNodeTitle(node) : "module"}-${nodeMetadataScriptParamKey(slider)}`;
  const source = metadataScriptSourceText();
  try {
    const response = await fetch("/api/metadata-script/to-desktop", {
      body: JSON.stringify({ source, title }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const result = await response.json();
    if (!response.ok || !result?.ok) {
      throw new Error(result?.error || "desktop export failed");
    }
    metadataScriptStatus(`desktop: ${result.filename}`, false);
  } catch {
    downloadNodeMetadataScriptSource(`${title.replace(/[^\w.-]+/g, "-") || "metadata-script"}.metadata-script.txt`, source);
    metadataScriptStatus("downloaded", false);
  }
}

function setNodeMetadataDefaultsFromKind() {
  const slider = document.getElementById(nodeGraphMvp.metadataEditorTarget);
  if (!slider) {
    return;
  }
  const kind = normalizeNodeMetadataKind(document.getElementById("metadataKindValue").value);
  const template = nodeMetadataKindTemplates[kind] || nodeMetadataKindTemplates.decimal;
  const choices = template.choices || [];
  if (Number.isFinite(Number(template.min))) {
    document.getElementById("metadataMinValue").value = String(template.min);
  }
  if (Number.isFinite(Number(template.mid))) {
    document.getElementById("metadataMidValue").value = String(template.mid);
  }
  if (Number.isFinite(Number(template.max))) {
    document.getElementById("metadataMaxValue").value = String(template.max);
  }
  document.getElementById("metadataUnitValue").value = template.unit;
  document.getElementById("metadataMaxDigitsValue").value =
    String(normalizeNodeGraphMetadataMaxDigits(template.maxDigits, kind));
  document.getElementById("metadataChoicesValue").value = formatNodeMetadataChoices(choices);
  document.getElementById("metadataDisplayChoicesValue").checked = Boolean(template.displayChoices);
  document.getElementById("metadataDivideChoicesValue").checked = Boolean(template.divideChoicesVisibly);
  document.getElementById("metadataLinearSmoothingValue").checked = template.linearSmoothing !== false;
  document.getElementById("metadataNonlinearSliderValue").checked = Boolean(template.nonlinearSlider);
  document.getElementById("metadataShowSignValue").checked = Boolean(template.showPlusMinus);
  document.getElementById("metadataWraparoundValue").checked = Boolean(template.wraparound);
  syncNodeMetadataMidVisibility();
  applyNodeMetadataEditor();
  syncNodeMetadataScriptFromFields({ force: true });
  document.getElementById("metadataSetDefaultButton").classList.remove("armed");
}

function handleNodeMetadataKindChange() {
  applyNodeMetadataEditor();
  document.getElementById("metadataSetDefaultButton").classList.add("armed");
}

function handleNodeMetadataEditorInput(event) {
  if (!nodeGraphMvp.metadataEditorTarget) {
    return;
  }
  if (event?.target?.id === "metadataScriptSource") {
    updateNodeMetadataScriptHighlight();
    syncNodeMetadataScriptDiagnostics();
    return;
  }
  syncNodeMetadataMidVisibility();
  applyNodeMetadataEditor();
  syncNodeMetadataScriptFromFields({ force: true });
}

bindNodeGraphMetadataPopoverEvents();
bindNodeMetadataScriptBeforeUnload();
scheduleNodeMetadataScriptParserSelfTestStatus();
