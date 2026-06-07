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

function metadataScriptStatus(message, error = false) {
  const status = document.getElementById("metadataScriptStatus");
  if (!status) {
    return;
  }
  status.textContent = message;
  status.classList.toggle("error", Boolean(error));
  status.classList.toggle("dirty", Boolean(nodeGraphMvp.metadataScriptDirty));
}

function metadataScriptSourceText() {
  return document.getElementById("metadataScriptSource")?.value || "";
}

const nodeMetadataScriptHighlightTokenPattern =
  /param\.[A-Za-z0-9_.]+|\[[^\]]*\]|-?(?:\d+\.\d+|\d+|\.\d+)(?:e[+-]?\d+)?|\b(?:true|false|any)\b|=|[A-Za-z_][\w-]*/gi;

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
  highlight.innerHTML = (source.value || "").split("\n").map(colorizeNodeMetadataScriptLine).join("\n") || "&nbsp;";
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
}

function setNodeMetadataScriptDirty(dirty, message = "", error = false) {
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
    metadataScriptStatus(message, error);
  } else {
    metadataScriptStatus(dirty ? "unsaved" : "saved", false);
  }
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

function syncNodeMetadataScriptFromFields() {
  const slider = document.getElementById(nodeGraphMvp.metadataEditorTarget);
  if (!slider) {
    metadataScriptStatus("no parameter", true);
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
  const aliases = {
    default: "def",
  };
  const supported = new Set([
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
  const next = { ...current, choices: [...(current.choices || [])] };
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
    const pathKey = match[1].split(".").pop();
    const key = aliases[pathKey] || pathKey;
    if (!supported.has(key)) {
      ignored.push(index + 1);
      continue;
    }
    next[key] = parseNodeMetadataScriptValue(match[2], key, next);
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
  if (
    nodeGraphMvp.metadataScriptDirty &&
    !window.confirm("Discard unsaved metadata script changes?")
  ) {
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
    scriptSource.addEventListener("scroll", updateNodeMetadataScriptHighlight);
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
    scriptRefresh.addEventListener("click", syncNodeMetadataScriptFromFields);
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
    setNodeMetadataScriptDirty(true, "pasted; save when ready", false);
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
  syncNodeMetadataScriptFromFields();
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
    setNodeMetadataScriptDirty(true, "unsaved", false);
    return;
  }
  syncNodeMetadataMidVisibility();
  applyNodeMetadataEditor();
  syncNodeMetadataScriptFromFields();
}

bindNodeGraphMetadataPopoverEvents();
