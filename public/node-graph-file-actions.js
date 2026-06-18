function nodeGraphPatchFileName() {
  const info = normalizeNodeGraphPatchInfo(nodeGraphMvp.patch.info);
  const baseName = info.name || "soemdsp-patch";
  const tagName = info.tags && info.tags !== "tags"
    ? `-${info.tags}`
    : "";
  const safeName = `${baseName}${tagName}`
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${safeName || "soemdsp-patch"}.json`;
}

const nodeGraphPatchPresetStorageKey = "soemdsp-sandbox.patchPresets.v1";

function nodeGraphPatchPresetDefaultName() {
  const info = normalizeNodeGraphPatchInfo(nodeGraphMvp.patch.info);
  return info.name && info.name !== "Untitled Patch" ? info.name : "Preset";
}

function normalizeNodeGraphPatchPresetName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function loadNodeGraphPatchPresetEntries() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(nodeGraphPatchPresetStorageKey) || "[]");
    return Array.isArray(parsed)
      ? parsed
        .map((entry) => ({
          name: normalizeNodeGraphPatchPresetName(entry?.name),
          text: typeof entry?.text === "string" ? entry.text : "",
          updatedAt: Number(entry?.updatedAt) || 0,
        }))
        .filter((entry) => entry.name && entry.text)
        .sort((a, b) => a.name.localeCompare(b.name))
      : [];
  } catch {
    return [];
  }
}

function saveNodeGraphPatchPresetEntries(entries) {
  window.localStorage.setItem(nodeGraphPatchPresetStorageKey, JSON.stringify(entries));
}

function selectedNodeGraphPatchPresetName() {
  const inputName = normalizeNodeGraphPatchPresetName(document.getElementById("nodePatchPresetName")?.value);
  const selectName = normalizeNodeGraphPatchPresetName(document.getElementById("nodePatchPresetSelect")?.value);
  return inputName || selectName;
}

function renderNodeGraphPatchPresetControls(selectedName = "") {
  const nameInput = document.getElementById("nodePatchPresetName");
  const select = document.getElementById("nodePatchPresetSelect");
  const loadButton = document.getElementById("nodePatchPresetLoadButton");
  const deleteButton = document.getElementById("nodePatchPresetDeleteButton");
  if (!nameInput || !select || !loadButton || !deleteButton) {
    return;
  }
  const entries = loadNodeGraphPatchPresetEntries();
  const normalizedSelected = normalizeNodeGraphPatchPresetName(selectedName || select.value);
  select.replaceChildren();
  if (!entries.length) {
    select.append(new Option("No saved presets", ""));
  } else {
    for (const entry of entries) {
      select.append(new Option(entry.name, entry.name));
    }
  }
  const selectedExists = entries.some((entry) => entry.name === normalizedSelected);
  select.value = selectedExists ? normalizedSelected : entries[0]?.name || "";
  if (!nameInput.value) {
    nameInput.value = select.value || nodeGraphPatchPresetDefaultName();
  }
  loadButton.disabled = !select.value;
  deleteButton.disabled = !select.value;
}

function saveCurrentNodeGraphPatchPreset() {
  if (!nodeGraphScriptReadyForGraphAction("save preset")) {
    return;
  }
  const name = selectedNodeGraphPatchPresetName();
  if (!name) {
    setNodeGraphScriptStatus("preset needs a name", false);
    return;
  }
  const text = serializeNodeGraphPatch();
  const entries = loadNodeGraphPatchPresetEntries().filter((entry) => entry.name !== name);
  entries.push({ name, text, updatedAt: Date.now() });
  try {
    saveNodeGraphPatchPresetEntries(entries.sort((a, b) => a.name.localeCompare(b.name)));
    const nameInput = document.getElementById("nodePatchPresetName");
    if (nameInput) {
      nameInput.value = name;
    }
    renderNodeGraphPatchPresetControls(name);
    setNodeGraphScriptStatus(`preset saved: ${name}`, true);
  } catch (error) {
    setNodeGraphScriptStatus(`preset save failed: ${error?.message || error}`, false);
  }
}

function loadSelectedNodeGraphPatchPreset() {
  const name = normalizeNodeGraphPatchPresetName(document.getElementById("nodePatchPresetSelect")?.value);
  const entry = loadNodeGraphPatchPresetEntries().find((candidate) => candidate.name === name);
  if (!entry) {
    setNodeGraphScriptStatus("choose a saved preset", false);
    renderNodeGraphPatchPresetControls();
    return;
  }
  try {
    commitNodeGraphPatch(loadNodeGraphPatchFromScript(entry.text), { status: `preset loaded: ${entry.name}` });
    const nameInput = document.getElementById("nodePatchPresetName");
    if (nameInput) {
      nameInput.value = entry.name;
    }
    renderNodeGraphPatchPresetControls(entry.name);
  } catch (error) {
    setNodeGraphScriptStatus(`preset load failed: ${error?.message || error}`, false);
  }
}

function deleteSelectedNodeGraphPatchPreset() {
  const name = normalizeNodeGraphPatchPresetName(document.getElementById("nodePatchPresetSelect")?.value);
  if (!name) {
    setNodeGraphScriptStatus("choose a saved preset", false);
    return;
  }
  try {
    const entries = loadNodeGraphPatchPresetEntries().filter((entry) => entry.name !== name);
    saveNodeGraphPatchPresetEntries(entries);
    const nameInput = document.getElementById("nodePatchPresetName");
    if (nameInput) {
      nameInput.value = entries[0]?.name || nodeGraphPatchPresetDefaultName();
    }
    renderNodeGraphPatchPresetControls(entries[0]?.name || "");
    setNodeGraphScriptStatus(`preset deleted: ${name}`, true);
  } catch (error) {
    setNodeGraphScriptStatus(`preset delete failed: ${error?.message || error}`, false);
  }
}

function handleNodeGraphPatchPresetSelectChange(event) {
  const name = normalizeNodeGraphPatchPresetName(event.currentTarget.value);
  const nameInput = document.getElementById("nodePatchPresetName");
  if (name && nameInput) {
    nameInput.value = name;
  }
}

async function saveNodeGraphScript() {
  if (!nodeGraphScriptReadyForGraphAction("save")) {
    return;
  }
  try {
    const response = await fetch("/api/patches/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: serializeNodeGraphPatch(),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }
    setNodeGraphScriptStatus(`patch saved: ${result.filename || nodeGraphPatchFileName()}`, true);
    renderNodeGraphDemoPatchList();
  } catch (error) {
    setNodeGraphScriptStatus(`patch save failed: ${error?.message || error}`, false);
  }
}

function loadNodeGraphScript() {
  if (!nodeGraphScriptReadyForGraphAction("load")) {
    return;
  }
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

function handleNodePatchScriptInput(event) {
  scheduleNodeGraphScriptCommit(event.currentTarget.value);
}

function saveNodeGraphScriptEditor() {
  const script = document.getElementById("nodePatchScript");
  clearNodeGraphScriptCommitTimer();
  if (commitNodeGraphScript(script?.value || serializeNodeGraphPatch())) {
    setNodeGraphScriptStatus("script saved", true);
  }
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

function nodeGraphDemoPatchEmptySlots(count) {
  return Array.from({ length: Math.max(0, count) }, (_, index) => ({
    empty: true,
    slot: index + 1,
  }));
}

function nodeGraphDemoPatchRows(patches) {
  const safePatches = Array.isArray(patches) ? patches.slice(0, 10) : [];
  return safePatches.concat(nodeGraphDemoPatchEmptySlots(10 - safePatches.length));
}

function renderNodeGraphDemoPatchRows(patches = []) {
  const list = document.getElementById("nodeDemoPatchList");
  if (!list) {
    return;
  }
  list.replaceChildren();
  for (const [index, patch] of nodeGraphDemoPatchRows(patches).entries()) {
    const row = document.createElement(patch.empty ? "div" : "button");
    row.className = "node-demo-patch-row";
    if (!patch.empty) {
      row.type = "button";
      row.dataset.patchFilename = patch.filename;
      row.addEventListener("click", () => loadNodeGraphDemoPatch(patch.filename));
    }
    const slot = document.createElement("span");
    slot.className = "node-demo-patch-slot";
    slot.textContent = String(index + 1).padStart(2, "0");
    const name = document.createElement("strong");
    name.textContent = patch.empty ? "Empty patch slot" : patch.name || patch.filename;
    const meta = document.createElement("small");
    meta.textContent = patch.empty
      ? "save a patch to fill this slot"
      : [patch.tags, patch.modifiedUtc].filter(Boolean).join(" - ");
    row.append(slot, name, meta);
    list.append(row);
  }
}

async function renderNodeGraphDemoPatchList() {
  const list = document.getElementById("nodeDemoPatchList");
  if (!list) {
    return;
  }
  list.replaceChildren();
  const loading = document.createElement("div");
  loading.className = "node-demo-patch-row";
  loading.textContent = "Loading saved patches...";
  list.append(loading);
  try {
    const response = await fetch("/api/patches");
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }
    renderNodeGraphDemoPatchRows(result.patches || []);
  } catch (error) {
    list.replaceChildren();
    const row = document.createElement("div");
    row.className = "node-demo-patch-row error";
    row.textContent = `Patch list unavailable: ${error?.message || error}`;
    list.append(row);
  }
}

async function loadNodeGraphDemoPatch(filename) {
  const safeFilename = String(filename || "");
  if (!safeFilename) {
    return;
  }
  if (!nodeGraphScriptReadyForGraphAction("load saved patch")) {
    return;
  }
  try {
    const response = await fetch(`/api/patches/file?name=${encodeURIComponent(safeFilename)}`);
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    commitNodeGraphPatch(loadNodeGraphPatchFromScript(text), {
      status: `patch loaded: ${safeFilename}`,
    });
  } catch (error) {
    setNodeGraphScriptStatus(`patch load failed: ${error?.message || error}`, false);
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
