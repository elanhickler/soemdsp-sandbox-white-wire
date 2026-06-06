const nodeUiDevDefaultSettingsUrl = "./public/presets/useruisettings.json";
const nodeUiDevDefaultSettingsStorageKey = "soemdsp-sandbox.userUiSettings.startup.v7";

function normalizeNodeUiDevSettings(settings = {}) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new Error("UI settings must be a JSON object");
  }
  const controls = settings.controls && typeof settings.controls === "object"
    ? settings.controls
    : {};
  const exposedControls = settings.exposedControls && typeof settings.exposedControls === "object"
    ? settings.exposedControls
    : {};
  const nodeColors = settings.nodeColors && typeof settings.nodeColors === "object"
    ? settings.nodeColors
    : {};
  const view = settings.view && typeof settings.view === "object"
    ? settings.view
    : {};
  const normalizedColors = {};
  for (const [property, value] of Object.entries(nodeColors)) {
    if (property.startsWith("--")) {
      normalizedColors[property] = normalizeNodeUiDevColor(value);
    }
  }
  const gridVisible = view.gridVisible ?? controls.gridVisible ?? controls.showGrid ?? nodeGraphMvp.gridVisible;
  const moduleButtonsVisible = Boolean(view.moduleButtonsVisible ?? nodeGraphMvp.moduleButtonsVisible);
  const moduleOscilloscopesVisible = Boolean(view.moduleOscilloscopesVisible ?? nodeGraphMvp.moduleOscilloscopesVisible);
  const moduleSlidersVisible = Boolean(view.moduleSlidersVisible ?? nodeGraphMvp.moduleSlidersVisible);
  const moduleScopeBackgroundColor = normalizeNodeGraphModuleScopeBackgroundColor(
    view.moduleScopeBackgroundColor ?? nodeGraphMvp.moduleScopeBackgroundColor ?? "#000000",
  );
  const moduleScopeDotCore1Size = normalizeNodeGraphModuleScopeDotCoreSize(
    view.moduleScopeDotCore1Size ?? view.moduleScopeDotCore ?? nodeGraphMvp.moduleScopeDotCore1Size ?? 3.18,
    3.18,
  );
  const moduleScopeDotCore1Brightness = normalizeNodeGraphModuleScopeDotCoreBrightness(
    view.moduleScopeDotCore1Brightness ?? nodeGraphMvp.moduleScopeDotCore1Brightness ?? 4.5,
    4.5,
  );
  const moduleScopeDotCore1Color = normalizeNodeGraphModuleScopeDotCoreColor(
    view.moduleScopeDotCore1Color ?? nodeGraphMvp.moduleScopeDotCore1Color ?? "#ffffff",
    "#ffffff",
  );
  const moduleScopeDotCore2Size = normalizeNodeGraphModuleScopeDotCoreSize(
    view.moduleScopeDotCore2Size ?? view.moduleScopeDotGlow ?? nodeGraphMvp.moduleScopeDotCore2Size ?? 4,
    4,
  );
  const moduleScopeDotCore2Brightness = normalizeNodeGraphModuleScopeDotCoreBrightness(
    view.moduleScopeDotCore2Brightness ?? nodeGraphMvp.moduleScopeDotCore2Brightness ?? 0.45,
    0.45,
  );
  const moduleScopeDotCore2Color = normalizeNodeGraphModuleScopeDotCoreColor(
    view.moduleScopeDotCore2Color ?? nodeGraphMvp.moduleScopeDotCore2Color ?? "#17002f",
    "#17002f",
  );
  const moduleScopeFramesPerSecond = normalizeNodeGraphModuleScopeFramesPerSecond(
    view.moduleScopeFramesPerSecond ?? nodeGraphMvp.moduleScopeFramesPerSecond ?? 60,
  );
  const moduleScopeLineThickness = normalizeNodeGraphModuleScopeLineThickness(
    view.moduleScopeLineThickness ?? nodeGraphMvp.moduleScopeLineThickness ?? 2,
  );
  const moduleScopeDiscontinuitySkipSamples = normalizeNodeGraphModuleScopeDiscontinuitySkipSamples(
    view.moduleScopeDiscontinuitySkipSamples ?? nodeGraphMvp.moduleScopeDiscontinuitySkipSamples ?? 1,
  );
  const moduleScopeOverdrawPoints = normalizeNodeGraphModuleScopeOverdrawPoints(
    view.moduleScopeOverdrawPoints ?? nodeGraphMvp.moduleScopeOverdrawPoints ?? 1,
  );
  const moduleScopeOverdrawFade = normalizeNodeGraphModuleScopeOverdrawFade(
    view.moduleScopeOverdrawFade ?? nodeGraphMvp.moduleScopeOverdrawFade ?? 0.5,
  );
  const sliderLayout = normalizeNodeGraphSliderLayout(view.sliderLayout ?? nodeGraphMvp.sliderLayout);
  const sliderAmountVisible = Boolean(view.sliderAmountVisible ?? nodeGraphMvp.sliderAmountVisible);
  const sliderPositionVisible = Boolean(
    view.sliderPositionVisible ??
    nodeGraphMvp.sliderPositionVisible
  );
  const moduleCatalogVisibility = normalizeNodeGraphModuleCatalogVisibility(
    view.moduleCatalogVisibility ?? settings.moduleCatalogVisibility ?? nodeGraphMvp.moduleCatalogVisibility,
  );
  return {
    format: {
      kind: "soemdsp-sandbox-user-ui-settings",
      version: 3,
    },
    controls: Object.fromEntries(
      nodeUiDevSettingControls.map((definition) => [
        definition.key,
        normalizeNodeUiDevControlValue(definition, controls[definition.key]),
      ]),
    ),
    exposedControls: Object.fromEntries(
      nodeUiDevSettingControls.map((definition) => [
        definition.key,
        Boolean(exposedControls[definition.key] ?? definition.exposeDefault),
      ]),
    ),
    nodeColors: normalizedColors,
    view: {
      gridVisible: Boolean(gridVisible),
      moduleButtonsVisible,
      moduleOscilloscopesVisible,
      moduleSlidersVisible,
      moduleScopeBackgroundColor,
      moduleScopeDotCore1Size,
      moduleScopeDotCore1Brightness,
      moduleScopeDotCore1Color,
      moduleScopeDotCore2Size,
      moduleScopeDotCore2Brightness,
      moduleScopeDotCore2Color,
      moduleScopeFramesPerSecond,
      moduleScopeLineThickness,
      moduleScopeDiscontinuitySkipSamples,
      moduleScopeOverdrawPoints,
      moduleScopeOverdrawFade,
      sliderLayout,
      sliderAmountVisible,
      sliderPositionVisible,
      moduleCatalogVisibility,
    },
  };
}

function readNodeUiDevSettingsFromControls() {
  const controls = {};
  for (const definition of nodeUiDevSettingControls) {
    const input = document.getElementById(definition.id);
    if (!input) {
      controls[definition.key] = definition.defaultValue;
    } else if (definition.locked) {
      controls[definition.key] = definition.defaultValue;
    } else if (definition.type === "boolean") {
      controls[definition.key] = input.checked;
    } else {
      controls[definition.key] = input.value;
    }
  }
  const exposedControls = Object.fromEntries(
    nodeUiDevSettingControls.map((definition) => [
      definition.key,
      nodeUiDevControlIsExposed(definition.key),
    ]),
  );
  const nodeColors = {};
  for (const input of document.querySelectorAll("[data-node-color-var]")) {
    nodeColors[input.dataset.nodeColorVar] = input.value;
  }
  return normalizeNodeUiDevSettings({
    controls,
    exposedControls,
    nodeColors,
    view: {
      gridVisible: Boolean(nodeGraphMvp.gridVisible),
      moduleButtonsVisible: Boolean(nodeGraphMvp.moduleButtonsVisible),
      moduleOscilloscopesVisible: Boolean(nodeGraphMvp.moduleOscilloscopesVisible),
      moduleSlidersVisible: Boolean(nodeGraphMvp.moduleSlidersVisible),
      moduleScopeBackgroundColor: normalizeNodeGraphModuleScopeBackgroundColor(nodeGraphMvp.moduleScopeBackgroundColor ?? "#000000"),
      moduleScopeDotCore1Size: normalizeNodeGraphModuleScopeDotCoreSize(nodeGraphMvp.moduleScopeDotCore1Size ?? 3.18, 3.18),
      moduleScopeDotCore1Brightness: normalizeNodeGraphModuleScopeDotCoreBrightness(nodeGraphMvp.moduleScopeDotCore1Brightness ?? 4.5, 4.5),
      moduleScopeDotCore1Color: normalizeNodeGraphModuleScopeDotCoreColor(nodeGraphMvp.moduleScopeDotCore1Color ?? "#ffffff", "#ffffff"),
      moduleScopeDotCore2Size: normalizeNodeGraphModuleScopeDotCoreSize(nodeGraphMvp.moduleScopeDotCore2Size ?? 4, 4),
      moduleScopeDotCore2Brightness: normalizeNodeGraphModuleScopeDotCoreBrightness(nodeGraphMvp.moduleScopeDotCore2Brightness ?? 0.45, 0.45),
      moduleScopeDotCore2Color: normalizeNodeGraphModuleScopeDotCoreColor(nodeGraphMvp.moduleScopeDotCore2Color ?? "#17002f", "#17002f"),
      moduleScopeFramesPerSecond: normalizeNodeGraphModuleScopeFramesPerSecond(nodeGraphMvp.moduleScopeFramesPerSecond ?? 60),
      moduleScopeLineThickness: normalizeNodeGraphModuleScopeLineThickness(nodeGraphMvp.moduleScopeLineThickness ?? 2),
      moduleScopeDiscontinuitySkipSamples: normalizeNodeGraphModuleScopeDiscontinuitySkipSamples(
        nodeGraphMvp.moduleScopeDiscontinuitySkipSamples ?? 1,
      ),
      moduleScopeOverdrawPoints: normalizeNodeGraphModuleScopeOverdrawPoints(nodeGraphMvp.moduleScopeOverdrawPoints ?? 1),
      moduleScopeOverdrawFade: normalizeNodeGraphModuleScopeOverdrawFade(nodeGraphMvp.moduleScopeOverdrawFade ?? 0.5),
      sliderLayout: normalizeNodeGraphSliderLayout(nodeGraphMvp.sliderLayout),
      sliderAmountVisible: Boolean(nodeGraphMvp.sliderAmountVisible),
      sliderPositionVisible: Boolean(nodeGraphMvp.sliderPositionVisible),
      moduleCatalogVisibility: nodeGraphModuleCatalogVisibility(),
    },
  });
}

function serializeNodeUiDevSettings() {
  return JSON.stringify(readNodeUiDevSettingsFromControls(), null, 2);
}

function loadNodeUiDevSettingsFromScript(text) {
  const payload = JSON.parse(text);
  const format = payload?.format;
  if (!format || typeof format !== "object") {
    throw new Error("UI settings missing format object");
  }
  if (format.kind !== "soemdsp-sandbox-user-ui-settings") {
    throw new Error("UI settings format kind mismatch");
  }
  if (format.version !== 3) {
    throw new Error("UI settings format version mismatch");
  }
  return normalizeNodeUiDevSettings(payload);
}

function applyNodeUiDevSettings(settings) {
  const normalized = normalizeNodeUiDevSettings(settings);
  for (const definition of nodeUiDevSettingControls) {
    const input = document.getElementById(definition.id);
    if (!input) {
      continue;
    }
    const value = normalized.controls[definition.key];
    if (definition.type === "boolean") {
      input.checked = Boolean(value);
    } else {
      input.value = String(value);
    }
    input.disabled = Boolean(definition.locked);
    const exposeInput = document.getElementById(nodeUiDevExposeCheckboxId(definition.key));
    if (exposeInput) {
      exposeInput.checked = Boolean(normalized.exposedControls[definition.key]);
    }
  }
  for (const input of document.querySelectorAll("[data-node-color-var]")) {
    const color = normalized.nodeColors[input.dataset.nodeColorVar];
    if (color) {
      input.value = color;
    }
  }
  nodeGraphMvp.gridVisible = Boolean(normalized.view.gridVisible);
  nodeGraphMvp.moduleButtonsVisible = Boolean(normalized.view.moduleButtonsVisible);
  nodeGraphMvp.moduleOscilloscopesVisible = Boolean(normalized.view.moduleOscilloscopesVisible);
  nodeGraphMvp.moduleSlidersVisible = Boolean(normalized.view.moduleSlidersVisible);
  nodeGraphMvp.moduleScopeBackgroundColor = normalizeNodeGraphModuleScopeBackgroundColor(normalized.view.moduleScopeBackgroundColor);
  nodeGraphMvp.moduleScopeDotCore1Size = normalizeNodeGraphModuleScopeDotCoreSize(normalized.view.moduleScopeDotCore1Size, 3.18);
  nodeGraphMvp.moduleScopeDotCore1Brightness = normalizeNodeGraphModuleScopeDotCoreBrightness(normalized.view.moduleScopeDotCore1Brightness, 4.5);
  nodeGraphMvp.moduleScopeDotCore1Color = normalizeNodeGraphModuleScopeDotCoreColor(normalized.view.moduleScopeDotCore1Color, "#ffffff");
  nodeGraphMvp.moduleScopeDotCore2Size = normalizeNodeGraphModuleScopeDotCoreSize(normalized.view.moduleScopeDotCore2Size, 4);
  nodeGraphMvp.moduleScopeDotCore2Brightness = normalizeNodeGraphModuleScopeDotCoreBrightness(normalized.view.moduleScopeDotCore2Brightness, 0.45);
  nodeGraphMvp.moduleScopeDotCore2Color = normalizeNodeGraphModuleScopeDotCoreColor(normalized.view.moduleScopeDotCore2Color, "#17002f");
  nodeGraphMvp.moduleScopeFramesPerSecond = normalizeNodeGraphModuleScopeFramesPerSecond(normalized.view.moduleScopeFramesPerSecond);
  nodeGraphMvp.moduleScopeLineThickness = normalizeNodeGraphModuleScopeLineThickness(normalized.view.moduleScopeLineThickness);
  nodeGraphMvp.moduleScopeDiscontinuitySkipSamples = normalizeNodeGraphModuleScopeDiscontinuitySkipSamples(
    normalized.view.moduleScopeDiscontinuitySkipSamples,
  );
  nodeGraphMvp.moduleScopeOverdrawPoints = normalizeNodeGraphModuleScopeOverdrawPoints(
    normalized.view.moduleScopeOverdrawPoints,
  );
  nodeGraphMvp.moduleScopeOverdrawFade = normalizeNodeGraphModuleScopeOverdrawFade(
    normalized.view.moduleScopeOverdrawFade,
  );
  nodeGraphMvp.sliderLayout = normalizeNodeGraphSliderLayout(normalized.view.sliderLayout);
  nodeGraphMvp.sliderAmountVisible = Boolean(normalized.view.sliderAmountVisible);
  nodeGraphMvp.sliderPositionVisible = Boolean(normalized.view.sliderPositionVisible);
  applyNodeGraphModuleCatalogVisibility(normalized.view.moduleCatalogVisibility);
  renderNodeGraphGridToggle();
  renderNodeGraphModuleVisibilityToggles();
  renderNodeGraphModuleScopeBrightnessControl();
  renderNodeGraphSliderVisibilityToggles();
  renderNodeGraphSliderLayout();
  syncNodeUiDevSettingsHeaderControls();
  if (!document.activeElement?.dataset?.nodeUiDevMirror) {
    renderNodeUserUiSettingsControls();
  }
  setNodeUiDevSettingsStatus("ui settings applied", true);
}

function setNodeUiDevSettingsStatus(message, ok = true) {
  for (const status of [
    document.getElementById("nodeUiDevSettingsStatus"),
    document.getElementById("nodeUserUiSettingsStatus"),
  ]) {
    if (!status) {
      continue;
    }
    status.textContent = message;
    status.className = `pill ${ok ? "good" : "warn"}`;
  }
}

function loadNodeUiDevLocalDefaultSettings() {
  if (!nodeGraphLocalDefaultPresetAllowed()) {
    return null;
  }
  try {
    const text = window.localStorage.getItem(nodeUiDevDefaultSettingsStorageKey);
    return text ? loadNodeUiDevSettingsFromScript(text) : null;
  } catch {
    return null;
  }
}

function loadNodeUiDevBundledDefaultSettings() {
  let bundled = window.nodeUiDevBundledDefaultSettings;
  if (!bundled) {
    try {
      bundled = JSON.parse(document.documentElement.dataset.nodeUiDevBundledDefaultSettings || "null");
    } catch {
      bundled = null;
    }
  }
  if (!bundled) {
    return null;
  }
  try {
    return loadNodeUiDevSettingsFromScript(JSON.stringify(bundled));
  } catch {
    return null;
  }
}

function saveNodeUiDevLocalDefaultSettings(text) {
  if (!nodeGraphLocalDefaultPresetAllowed()) {
    return false;
  }
  try {
    window.localStorage.setItem(nodeUiDevDefaultSettingsStorageKey, text);
    return true;
  } catch {
    return false;
  }
}

async function loadNodeUiDevDefaultSettings() {
  const storedSettings = loadNodeUiDevLocalDefaultSettings();
  if (storedSettings) {
    applyNodeUiDevSettings(storedSettings);
    const storedCatalogVisibility = loadNodeGraphModuleCatalogVisibilityLocal();
    if (storedCatalogVisibility) {
      applyNodeGraphModuleCatalogVisibility(storedCatalogVisibility);
    }
    loadNodeGraphModuleStoreStateLocal();
    loadNodeGraphModuleScopeSettingsLocal();
    document.documentElement.dataset.nodeUiDevSettingsSource = "local";
    return;
  }
  if (typeof fetch === "function") {
    try {
      const response = await fetch(nodeUiDevDefaultSettingsUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      applyNodeUiDevSettings(loadNodeUiDevSettingsFromScript(await response.text()));
      const storedCatalogVisibility = loadNodeGraphModuleCatalogVisibilityLocal();
      if (storedCatalogVisibility) {
        applyNodeGraphModuleCatalogVisibility(storedCatalogVisibility);
      }
      loadNodeGraphModuleStoreStateLocal();
      loadNodeGraphModuleScopeSettingsLocal();
      document.documentElement.dataset.nodeUiDevSettingsSource = "fetch";
      return;
    } catch {
      // Fall through to the bundled preset for browser surfaces without request APIs.
    }
  }
  const bundledSettings = loadNodeUiDevBundledDefaultSettings();
  document.documentElement.dataset.nodeUiDevSettingsSource = bundledSettings ? "bundled" : "controls";
  applyNodeUiDevSettings(bundledSettings || readNodeUiDevSettingsFromControls());
  const storedCatalogVisibility = loadNodeGraphModuleCatalogVisibilityLocal();
  if (storedCatalogVisibility) {
    applyNodeGraphModuleCatalogVisibility(storedCatalogVisibility);
  }
  loadNodeGraphModuleStoreStateLocal();
  loadNodeGraphModuleScopeSettingsLocal();
}

async function copyNodeUiDevSettingsToClipboard() {
  try {
    await copyTextToClipboard(serializeNodeUiDevSettings());
    setNodeUiDevSettingsStatus("ui settings copied", true);
  } catch (error) {
    setNodeUiDevSettingsStatus(`copy failed: ${error.message}`, false);
  }
}

function saveNodeUiDevSettingsFile() {
  const blob = new Blob([`${serializeNodeUiDevSettings()}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "useruisettings.json";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  setNodeUiDevSettingsStatus("ui settings saved", true);
}

function loadNodeUiDevSettingsFile() {
  document.getElementById("nodeUiDevSettingsFileInput")?.click();
}

function handleNodeUiDevSettingsFileLoad(event) {
  const [file] = event.currentTarget.files || [];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      applyNodeUiDevSettings(loadNodeUiDevSettingsFromScript(String(reader.result || "")));
      setNodeUiDevSettingsStatus("ui settings loaded", true);
    } catch (error) {
      setNodeUiDevSettingsStatus(error.message, false);
    } finally {
      event.currentTarget.value = "";
    }
  });
  reader.addEventListener("error", () => {
    setNodeUiDevSettingsStatus("ui settings file read failed", false);
    event.currentTarget.value = "";
  });
  reader.readAsText(file);
}

async function updateDefaultNodeUiDevSettingsPreset() {
  const text = serializeNodeUiDevSettings();
  try {
    await postNodeUiDevSettingsPreset(text);
    saveNodeUiDevLocalDefaultSettings(text);
    setNodeUiDevSettingsStatus("default ui settings updated", true);
    return true;
  } catch (error) {
    if (saveNodeUiDevLocalDefaultSettings(text)) {
      setNodeUiDevSettingsStatus("local ui settings updated", true);
      return true;
    }
    setNodeUiDevSettingsStatus(`default update failed: ${error.message}`, false);
    return false;
  }
}

async function postNodeUiDevSettingsPreset(text) {
  const response = await fetch("/api/presets/useruisettings", {
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
  return result;
}

async function saveNodeUserUiSettingsDefaultPreset() {
  const text = serializeNodeUiDevSettings();
  const localSaved = saveNodeUiDevLocalDefaultSettings(text);
  if (localSaved) {
    setNodeUiDevSettingsStatus("ui settings saved", true);
    postNodeUiDevSettingsPreset(text)
      .then(() => {
        saveNodeUiDevLocalDefaultSettings(text);
        setNodeUiDevSettingsStatus("default ui settings updated", true);
      })
      .catch(() => {
        setNodeUiDevSettingsStatus("ui settings saved", true);
      });
    return true;
  }
  try {
    await postNodeUiDevSettingsPreset(text);
    saveNodeUiDevLocalDefaultSettings(text);
    setNodeUiDevSettingsStatus("default ui settings updated", true);
    return true;
  } catch (error) {
    if (localSaved) {
      return true;
    }
    setNodeUiDevSettingsStatus(`ui settings save failed: ${error.message}`, false);
    return false;
  }
}

async function handleUpdateDefaultNodeUiDevSettingsPresetClick(event) {
  if (!confirmNodeGraphDefaultButtonClick(event.currentTarget, () => {
    setNodeUiDevSettingsStatus("click Confirm Default to update default ui settings", true);
  })) {
    return;
  }
  flashNodeGraphDefaultButtonSaved(event.currentTarget);
  await updateDefaultNodeUiDevSettingsPreset();
}

async function handleSaveNodeUserUiSettingsDefaultClick(event) {
  flashNodeGraphDefaultButtonSaved(event.currentTarget);
  const saved = await saveNodeUserUiSettingsDefaultPreset();
  if (!saved) {
    event.currentTarget.textContent = "Save UI Settings";
  }
}
