const nodeGraphDefaultPresetUrl = "./public/presets/default.json";
const nodeGraphDefaultPresetStorageKey = "soemdsp-sandbox.defaultPatch.live.v2";

async function loadNodeGraphDefaultPresetPatch() {
  const storedPatch = loadNodeGraphLocalDefaultPresetPatch();
  if (storedPatch) {
    return storedPatch;
  }
  try {
    const response = await fetch(nodeGraphDefaultPresetUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return loadNodeGraphPatchFromScript(await response.text());
  } catch {
    return cloneNodeGraphPatch(nodeGraphDefaultPatch);
  }
}

function nodeGraphLocalDefaultPresetAllowed() {
  return ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
}

function loadNodeGraphLocalDefaultPresetPatch() {
  if (!nodeGraphLocalDefaultPresetAllowed()) {
    return null;
  }
  try {
    const text = window.localStorage.getItem(nodeGraphDefaultPresetStorageKey);
    return text ? loadNodeGraphPatchFromScript(text) : null;
  } catch {
    return null;
  }
}

function saveNodeGraphLocalDefaultPreset(text) {
  if (!nodeGraphLocalDefaultPresetAllowed()) {
    return false;
  }
  try {
    window.localStorage.setItem(nodeGraphDefaultPresetStorageKey, text);
    return true;
  } catch {
    return false;
  }
}

function configureNodeGraphDefaultPresetButton() {
  const button = document.getElementById("updateDefaultPresetButton");
  if (!button || !nodeGraphLocalDefaultPresetAllowed()) {
    return;
  }
  button.hidden = false;
}
