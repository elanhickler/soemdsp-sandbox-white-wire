function renderNodeGraphHistoryControls() {
  const undo = document.getElementById("nodeUndoButton");
  const redo = document.getElementById("nodeRedoButton");
  if (!undo || !redo) {
    return;
  }
  const canUndo = nodeGraphMvp.historyIndex > 0;
  const canRedo = nodeGraphMvp.historyIndex < nodeGraphMvp.historySnapshots.length - 1;
  undo.disabled = !canUndo;
  redo.disabled = !canRedo;
  undo.removeAttribute("title");
  redo.removeAttribute("title");
}

function renderNodeGraphVisibilityMenuButton() {
  const button = document.getElementById("nodeVisibilityMenuButton");
  const menu = document.getElementById("nodeVisibilityMenu");
  if (!button) {
    return;
  }
  const hiddenCount = [
    nodeGraphMvp.gridVisible ? 0 : 1,
    nodeGraphMvp.moduleButtonsVisible === false ? 1 : 0,
    nodeGraphMvp.moduleOscilloscopesVisible === false ? 1 : 0,
    nodeGraphMvp.moduleSlidersVisible === false ? 1 : 0,
    nodeGraphMvp.tooltipVisible ? 0 : 1,
    nodeGraphMvp.sliderAmountVisible ? 0 : 1,
    nodeGraphMvp.sliderPositionVisible ? 0 : 1,
  ].reduce((total, value) => total + value, 0);
  button.textContent = hiddenCount ? `Visibility (${hiddenCount} hidden)` : "Visibility";
  button.setAttribute("aria-pressed", String(Boolean(menu && !menu.hidden)));
  button.removeAttribute("title");
}

function renderNodeGraphGridToggle() {
  const workspace = document.getElementById("nodeGraphWorkspace");
  const button = document.getElementById("nodeGridToggleButton");
  const visible = Boolean(nodeGraphMvp.gridVisible);
  workspace?.classList.toggle("grid-visible", visible);
  if (button) {
    button.textContent = visible ? "Hide Grid" : "Show Grid";
    button.setAttribute("aria-pressed", visible ? "true" : "false");
    button.removeAttribute("title");
  }
  renderNodeGraphVisibilityMenuButton();
  syncNodeUserUiSettingsViewControls();
}

function renderNodeGraphSliderVisibilityToggles() {
  const workspace = document.getElementById("nodeGraphWorkspace");
  const amountButton = document.getElementById("nodeSliderAmountToggleButton");
  const positionButton = document.getElementById("nodeSliderPositionToggleButton");
  const amountVisible = Boolean(nodeGraphMvp.sliderAmountVisible);
  const positionVisible = Boolean(nodeGraphMvp.sliderPositionVisible);
  workspace?.classList.toggle("show-slider-amount", amountVisible);
  workspace?.classList.toggle("hide-slider-position", !positionVisible);
  if (amountButton) {
    amountButton.textContent = amountVisible ? "Hide Amount Slider" : "Show Amount Slider";
    amountButton.setAttribute("aria-pressed", amountVisible ? "true" : "false");
    amountButton.removeAttribute("title");
  }
  if (positionButton) {
    positionButton.textContent = positionVisible ? "Hide Position Slider" : "Show Position Slider";
    positionButton.setAttribute("aria-pressed", positionVisible ? "true" : "false");
    positionButton.removeAttribute("title");
  }
  renderNodeGraphVisibilityMenuButton();
  syncNodeUserUiSettingsViewControls();
}

function renderNodeGraphModuleVisibilityToggles() {
  const workspace = document.getElementById("nodeGraphWorkspace");
  const buttonsButton = document.getElementById("nodeModuleButtonsToggleButton");
  const scopesButton = document.getElementById("nodeOscilloscopeToggleButton");
  const slidersButton = document.getElementById("nodeModuleSlidersToggleButton");
  const buttonsVisible = nodeGraphMvp.moduleButtonsVisible !== false;
  const scopesVisible = nodeGraphMvp.moduleOscilloscopesVisible !== false;
  const slidersVisible = nodeGraphMvp.moduleSlidersVisible !== false;
  workspace?.classList.toggle("module-buttons-hidden", !buttonsVisible);
  workspace?.classList.toggle("module-oscilloscopes-hidden", !scopesVisible);
  workspace?.classList.toggle("module-sliders-hidden", !slidersVisible);
  if (buttonsButton) {
    buttonsButton.textContent = buttonsVisible ? "Hide Module Buttons" : "Show Module Buttons";
    buttonsButton.setAttribute("aria-pressed", buttonsVisible ? "true" : "false");
    buttonsButton.removeAttribute("title");
  }
  if (scopesButton) {
    scopesButton.textContent = scopesVisible ? "Hide Oscilloscopes" : "Show Oscilloscopes";
    scopesButton.setAttribute("aria-pressed", scopesVisible ? "true" : "false");
    scopesButton.removeAttribute("title");
  }
  if (slidersButton) {
    slidersButton.textContent = slidersVisible ? "Hide Sliders" : "Show Sliders";
    slidersButton.setAttribute("aria-pressed", slidersVisible ? "true" : "false");
    slidersButton.removeAttribute("title");
  }
  if (!scopesVisible && typeof closeNodeScopeContextMenu === "function") {
    closeNodeScopeContextMenu();
  }
  if (typeof drawNodeGraphWires === "function") {
    drawNodeGraphWires();
  }
  if (scopesVisible && typeof scheduleNodeGraphModuleScopeDraw === "function") {
    scheduleNodeGraphModuleScopeDraw();
  }
  renderNodeGraphVisibilityMenuButton();
}

function normalizeNodeGraphModuleScopeBurn(value) {
  const number = Number(value);
  return Number.isFinite(number) ? clampNodeSliderValue(number, 0, 1) : 0.5;
}

function normalizeNodeGraphModuleScopeLineThickness(value) {
  const number = Number(value);
  return Number.isFinite(number) ? clampNodeSliderValue(number, 0.25, 10) : 1;
}

function normalizeNodeGraphModuleScopeDiscontinuitySkipSamples(value) {
  const number = Number(value);
  return Number.isFinite(number) ? clampNodeSliderValue(Math.round(number), 0, 2) : 1;
}

function normalizeNodeGraphModuleScopeOverdrawPoints(value) {
  const number = Number(value);
  return Number.isFinite(number) ? clampNodeSliderValue(Math.round(number), 1, 2048) : 1;
}

function normalizeNodeGraphModuleScopeOverdrawFade(value) {
  const number = Number(value);
  return Number.isFinite(number) ? clampNodeSliderValue(number, 0, 1) : 0.5;
}

function normalizeNodeGraphModuleScopeFramesPerSecond(value) {
  const number = Number(value);
  return Number.isFinite(number) ? clampNodeSliderValue(Math.round(number), 1, 240) : 60;
}

function normalizeNodeGraphModuleScopeBackgroundColor(value) {
  const text = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : "#000000";
}

function normalizeNodeGraphModuleScopeDotCoreColor(value, fallback = "#ffffff") {
  const text = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : fallback;
}

function normalizeNodeGraphModuleScopeDotCoreSize(value, fallback = 0.5) {
  const number = Number(value);
  return Number.isFinite(number) ? clampNodeSliderValue(number, 0.01, 10) : fallback;
}

function normalizeNodeGraphModuleScopeDotCoreBrightness(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? clampNodeSliderValue(number, 0, 40) : fallback;
}

function renderNodeGraphModuleScopeDotPreview(
  core1Size,
  core1Brightness,
  core1Color,
  core2Size,
  core2Brightness,
  core2Color,
  lineThickness = nodeGraphMvp?.moduleScopeLineThickness,
  canvasId = "nodeMasterScopeDotPreview",
) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    return;
  }
  const size = 64;
  if (canvas.width !== size) {
    canvas.width = size;
  }
  if (canvas.height !== size) {
    canvas.height = size;
  }
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  const pixels = typeof nodeGraphModuleScopeGeneratedDotTextureData === "function"
    ? nodeGraphModuleScopeGeneratedDotTextureData({
      core1Brightness,
      core1Color,
      core1Size,
      core2Brightness,
      core2Color,
      core2Size,
      lineThickness,
      size,
    })
    : new Uint8ClampedArray(size * size * 4);
  const imageData = new ImageData(
    pixels instanceof Uint8ClampedArray ? pixels : new Uint8ClampedArray(pixels),
    size,
    size,
  );
  context.clearRect(0, 0, size, size);
  context.putImageData(imageData, 0, 0);
}

function renderNodeGraphModuleScopeBrightnessControl() {
  const burn = normalizeNodeGraphModuleScopeBurn(nodeGraphMvp.moduleScopeBurn ?? 0);
  const backgroundColor = normalizeNodeGraphModuleScopeBackgroundColor(nodeGraphMvp.moduleScopeBackgroundColor);
  const dotCore1Size = normalizeNodeGraphModuleScopeDotCoreSize(nodeGraphMvp.moduleScopeDotCore1Size ?? 3.18, 3.18);
  const dotCore1Brightness = normalizeNodeGraphModuleScopeDotCoreBrightness(nodeGraphMvp.moduleScopeDotCore1Brightness ?? 4.5, 4.5);
  const dotCore1Color = normalizeNodeGraphModuleScopeDotCoreColor(nodeGraphMvp.moduleScopeDotCore1Color ?? "#ffffff", "#ffffff");
  const dotCore2Size = normalizeNodeGraphModuleScopeDotCoreSize(nodeGraphMvp.moduleScopeDotCore2Size ?? 4, 4);
  const dotCore2Brightness = normalizeNodeGraphModuleScopeDotCoreBrightness(nodeGraphMvp.moduleScopeDotCore2Brightness ?? 0.45, 0.45);
  const dotCore2Color = normalizeNodeGraphModuleScopeDotCoreColor(nodeGraphMvp.moduleScopeDotCore2Color ?? "#17002f", "#17002f");
  const framesPerSecond = normalizeNodeGraphModuleScopeFramesPerSecond(nodeGraphMvp.moduleScopeFramesPerSecond ?? 60);
  const lineThickness = normalizeNodeGraphModuleScopeLineThickness(nodeGraphMvp.moduleScopeLineThickness ?? 2);
  const discontinuitySkipSamples = normalizeNodeGraphModuleScopeDiscontinuitySkipSamples(
    nodeGraphMvp.moduleScopeDiscontinuitySkipSamples ?? 1,
  );
  const overdrawPoints = normalizeNodeGraphModuleScopeOverdrawPoints(nodeGraphMvp.moduleScopeOverdrawPoints ?? 1);
  const overdrawFade = normalizeNodeGraphModuleScopeOverdrawFade(nodeGraphMvp.moduleScopeOverdrawFade ?? 0.5);
  nodeGraphMvp.moduleScopeBurn = burn;
  nodeGraphMvp.moduleScopeBackgroundColor = backgroundColor;
  nodeGraphMvp.moduleScopeDotCore1Size = dotCore1Size;
  nodeGraphMvp.moduleScopeDotCore1Brightness = dotCore1Brightness;
  nodeGraphMvp.moduleScopeDotCore1Color = dotCore1Color;
  nodeGraphMvp.moduleScopeDotCore2Size = dotCore2Size;
  nodeGraphMvp.moduleScopeDotCore2Brightness = dotCore2Brightness;
  nodeGraphMvp.moduleScopeDotCore2Color = dotCore2Color;
  nodeGraphMvp.moduleScopeFramesPerSecond = framesPerSecond;
  nodeGraphMvp.moduleScopeLineThickness = lineThickness;
  nodeGraphMvp.moduleScopeDiscontinuitySkipSamples = discontinuitySkipSamples;
  nodeGraphMvp.moduleScopeOverdrawPoints = overdrawPoints;
  nodeGraphMvp.moduleScopeOverdrawFade = overdrawFade;
  const burnInput = document.getElementById("nodeMasterScopeBurn");
  const backgroundInput = document.getElementById("nodeMasterScopeBackgroundColor");
  const dotCore1SizeInput = document.getElementById("nodeMasterScopeDotCore1Size");
  const dotCore1BrightnessInput = document.getElementById("nodeMasterScopeDotCore1Brightness");
  const dotCore1ColorInput = document.getElementById("nodeMasterScopeDotCore1Color");
  const dotCore2SizeInput = document.getElementById("nodeMasterScopeDotCore2Size");
  const dotCore2BrightnessInput = document.getElementById("nodeMasterScopeDotCore2Brightness");
  const dotCore2ColorInput = document.getElementById("nodeMasterScopeDotCore2Color");
  const fpsInput = document.getElementById("nodeMasterScopeFps");
  const lineInput = document.getElementById("nodeMasterScopeLineThickness");
  const skipSamplesInput = document.getElementById("nodeMasterScopeDiscontinuitySkipSamples");
  const overdrawInput = document.getElementById("nodeMasterScopeOverdrawPoints");
  const overdrawFadeInput = document.getElementById("nodeMasterScopeOverdrawFade");
  if (burnInput && document.activeElement !== burnInput) {
    burnInput.value = burn.toFixed(2);
  }
  if (backgroundInput && document.activeElement !== backgroundInput) {
    backgroundInput.value = backgroundColor;
  }
  if (dotCore1SizeInput && document.activeElement !== dotCore1SizeInput) {
    dotCore1SizeInput.value = dotCore1Size.toFixed(2);
  }
  if (dotCore1BrightnessInput && document.activeElement !== dotCore1BrightnessInput) {
    dotCore1BrightnessInput.value = dotCore1Brightness.toFixed(2);
  }
  if (dotCore1ColorInput && document.activeElement !== dotCore1ColorInput) {
    dotCore1ColorInput.value = dotCore1Color;
  }
  if (dotCore2SizeInput && document.activeElement !== dotCore2SizeInput) {
    dotCore2SizeInput.value = dotCore2Size.toFixed(2);
  }
  if (dotCore2BrightnessInput && document.activeElement !== dotCore2BrightnessInput) {
    dotCore2BrightnessInput.value = dotCore2Brightness.toFixed(2);
  }
  if (dotCore2ColorInput && document.activeElement !== dotCore2ColorInput) {
    dotCore2ColorInput.value = dotCore2Color;
  }
  renderNodeGraphModuleScopeDotPreview(
    dotCore1Size,
    dotCore1Brightness,
    dotCore1Color,
    0.01,
    0,
    dotCore2Color,
    lineThickness,
    "nodeMasterScopeDotCore1Preview",
  );
  renderNodeGraphModuleScopeDotPreview(
    0.01,
    0,
    dotCore1Color,
    dotCore2Size,
    dotCore2Brightness,
    dotCore2Color,
    lineThickness,
    "nodeMasterScopeDotCore2Preview",
  );
  renderNodeGraphModuleScopeDotPreview(
    dotCore1Size,
    dotCore1Brightness,
    dotCore1Color,
    dotCore2Size,
    dotCore2Brightness,
    dotCore2Color,
    lineThickness,
  );
  if (fpsInput && document.activeElement !== fpsInput) {
    fpsInput.value = String(framesPerSecond);
  }
  if (lineInput && document.activeElement !== lineInput) {
    lineInput.value = lineThickness.toFixed(2);
  }
  if (skipSamplesInput && document.activeElement !== skipSamplesInput) {
    skipSamplesInput.value = String(discontinuitySkipSamples);
  }
  if (overdrawInput && document.activeElement !== overdrawInput) {
    overdrawInput.value = String(overdrawPoints);
  }
  if (overdrawFadeInput && document.activeElement !== overdrawFadeInput) {
    overdrawFadeInput.value = overdrawFade.toFixed(2);
  }
  const globalScopeMenu = document.getElementById("nodeGlobalScopeMenu");
  document.getElementById("nodeGlobalScopeMenuButton")
    ?.setAttribute("aria-pressed", String(Boolean(globalScopeMenu && !globalScopeMenu.hidden)));
  document.getElementById("nodeGraphWorkspace")
    ?.style.setProperty("--node-scope-background", backgroundColor);
  syncNodeUserUiSettingsViewControls();
}

function setNodeGraphModuleButtonsVisibility(visible, options = {}) {
  nodeGraphMvp.moduleButtonsVisible = Boolean(visible);
  renderNodeGraphModuleVisibilityToggles();
  if (options.help !== false) {
    setNodeInteractionHelp(nodeGraphMvp.moduleButtonsVisible ? "Module buttons shown." : "Module buttons hidden.");
  }
}

function setNodeGraphModuleScopeBurn(value) {
  nodeGraphMvp.moduleScopeBurn = normalizeNodeGraphModuleScopeBurn(value);
  renderNodeGraphModuleScopeBrightnessControl();
  if (typeof scheduleNodeGraphModuleScopeDraw === "function") {
    scheduleNodeGraphModuleScopeDraw();
  }
}

function handleNodeGraphModuleScopeBurnInput(event) {
  setNodeGraphModuleScopeBurn(event.currentTarget.value);
}

function setNodeGraphModuleScopeFramesPerSecond(value) {
  nodeGraphMvp.moduleScopeFramesPerSecond = normalizeNodeGraphModuleScopeFramesPerSecond(value);
  renderNodeGraphModuleScopeBrightnessControl();
  if (typeof scheduleNodeGraphModuleScopeDraw === "function") {
    scheduleNodeGraphModuleScopeDraw();
  }
}

function handleNodeGraphModuleScopeFramesPerSecondInput(event) {
  setNodeGraphModuleScopeFramesPerSecond(event.currentTarget.value);
}

function setNodeGraphModuleScopeBackgroundColor(value) {
  nodeGraphMvp.moduleScopeBackgroundColor = normalizeNodeGraphModuleScopeBackgroundColor(value);
  renderNodeGraphModuleScopeBrightnessControl();
  if (typeof scheduleNodeGraphModuleScopeDraw === "function") {
    scheduleNodeGraphModuleScopeDraw();
  }
}

function refreshNodeGraphModuleScopeGeneratedDot() {
  renderNodeGraphModuleScopeBrightnessControl();
  if (typeof invalidateNodeGraphModuleScopeTraceImageTexture === "function") {
    invalidateNodeGraphModuleScopeTraceImageTexture();
  }
  if (typeof scheduleNodeGraphModuleScopeDraw === "function") {
    scheduleNodeGraphModuleScopeDraw();
  }
}

function setNodeGraphModuleScopeDotCore1Size(value) {
  nodeGraphMvp.moduleScopeDotCore1Size = normalizeNodeGraphModuleScopeDotCoreSize(value, 3.18);
  refreshNodeGraphModuleScopeGeneratedDot();
}

function setNodeGraphModuleScopeDotCore1Brightness(value) {
  nodeGraphMvp.moduleScopeDotCore1Brightness = normalizeNodeGraphModuleScopeDotCoreBrightness(value, 4.5);
  refreshNodeGraphModuleScopeGeneratedDot();
}

function setNodeGraphModuleScopeDotCore1Color(value) {
  nodeGraphMvp.moduleScopeDotCore1Color = normalizeNodeGraphModuleScopeDotCoreColor(value, "#ffffff");
  refreshNodeGraphModuleScopeGeneratedDot();
}

function setNodeGraphModuleScopeDotCore2Size(value) {
  nodeGraphMvp.moduleScopeDotCore2Size = normalizeNodeGraphModuleScopeDotCoreSize(value, 4);
  refreshNodeGraphModuleScopeGeneratedDot();
}

function setNodeGraphModuleScopeDotCore2Brightness(value) {
  nodeGraphMvp.moduleScopeDotCore2Brightness = normalizeNodeGraphModuleScopeDotCoreBrightness(value, 0.45);
  refreshNodeGraphModuleScopeGeneratedDot();
}

function setNodeGraphModuleScopeDotCore2Color(value) {
  nodeGraphMvp.moduleScopeDotCore2Color = normalizeNodeGraphModuleScopeDotCoreColor(value, "#17002f");
  refreshNodeGraphModuleScopeGeneratedDot();
}

function setNodeGraphModuleScopeLineThickness(value) {
  nodeGraphMvp.moduleScopeLineThickness = normalizeNodeGraphModuleScopeLineThickness(value);
  refreshNodeGraphModuleScopeGeneratedDot();
}

function handleNodeGraphModuleScopeLineThicknessInput(event) {
  setNodeGraphModuleScopeLineThickness(event.currentTarget.value);
}

function setNodeGraphModuleScopeDiscontinuitySkipSamples(value) {
  nodeGraphMvp.moduleScopeDiscontinuitySkipSamples = normalizeNodeGraphModuleScopeDiscontinuitySkipSamples(value);
  renderNodeGraphModuleScopeBrightnessControl();
  if (typeof scheduleNodeGraphModuleScopeDraw === "function") {
    scheduleNodeGraphModuleScopeDraw();
  }
}

function handleNodeGraphModuleScopeDiscontinuitySkipSamplesInput(event) {
  setNodeGraphModuleScopeDiscontinuitySkipSamples(event.currentTarget.value);
}

function setNodeGraphModuleScopeOverdrawPoints(value) {
  nodeGraphMvp.moduleScopeOverdrawPoints = normalizeNodeGraphModuleScopeOverdrawPoints(value);
  renderNodeGraphModuleScopeBrightnessControl();
  if (typeof scheduleNodeGraphModuleScopeDraw === "function") {
    scheduleNodeGraphModuleScopeDraw();
  }
}

function setNodeGraphModuleScopeOverdrawFade(value) {
  nodeGraphMvp.moduleScopeOverdrawFade = normalizeNodeGraphModuleScopeOverdrawFade(value);
  renderNodeGraphModuleScopeBrightnessControl();
  if (typeof scheduleNodeGraphModuleScopeDraw === "function") {
    scheduleNodeGraphModuleScopeDraw();
  }
}

function handleNodeGraphModuleScopeOverdrawPointsInput(event) {
  setNodeGraphModuleScopeOverdrawPoints(event.currentTarget.value);
}

const nodeGraphSliderLayouts = Object.freeze([
  { key: "text-inside", label: "Text Inside" },
  { key: "label-value-slider", label: "Label Value Slider" },
  { key: "value-unit-left", label: "Value And Unit Left" },
  { key: "value-unit-right", label: "Value And Unit Right" },
  { key: "label-outside", label: "Label Outside" },
  { key: "label-outside-no-unit", label: "Label Outside No Unit" },
  { key: "value-outside", label: "Value Outside" },
  { key: "unit-only", label: "Unit Only" },
  { key: "value-focus", label: "Value Focus" },
]);

function normalizeNodeGraphSliderLayout(value) {
  const aliases = {
    alternate: "label-outside",
    classic: "text-inside",
  };
  const key = aliases[value] || value;
  return nodeGraphSliderLayouts.some((layout) => layout.key === key) ? key : "text-inside";
}

function nodeGraphSliderLayoutLabel(value) {
  const normalized = normalizeNodeGraphSliderLayout(value);
  return nodeGraphSliderLayouts.find((layout) => layout.key === normalized)?.label || "Text Inside";
}

function nextNodeGraphSliderLayout(value) {
  const normalized = normalizeNodeGraphSliderLayout(value);
  const index = nodeGraphSliderLayouts.findIndex((layout) => layout.key === normalized);
  const next = nodeGraphSliderLayouts[(index + 1) % nodeGraphSliderLayouts.length];
  return next?.key || "text-inside";
}

function renderNodeGraphSliderLayout() {
  const layout = normalizeNodeGraphSliderLayout(nodeGraphMvp.sliderLayout);
  nodeGraphMvp.sliderLayout = layout;
  document.getElementById("nodeGraphWorkspace")?.setAttribute("data-slider-layout", layout);
  document.getElementById("nodeWiringPanel")?.setAttribute("data-slider-layout", layout);
  syncNodeUserUiSettingsViewControls();
}

function cycleNodeGraphSliderLayout() {
  nodeGraphMvp.sliderLayout = nextNodeGraphSliderLayout(nodeGraphMvp.sliderLayout);
  renderNodeGraphSliderLayout();
  setNodeInteractionHelp(`Slider layout: ${nodeGraphSliderLayoutLabel(nodeGraphMvp.sliderLayout)}.`);
}

function renderNodeGraphTooltipToggle() {
  const helpStack = document.querySelector(".node-help-stack");
  const help = document.getElementById("nodeInteractionHelp");
  const button = document.getElementById("nodeTooltipToggleButton");
  const visible = Boolean(nodeGraphMvp.tooltipVisible);
  helpStack?.classList.toggle("tips-hidden", !visible);
  if (!visible && help) {
    help.textContent = "";
  }
  if (button) {
    button.textContent = visible ? "Hide Tips" : "Show Tips";
    button.setAttribute("aria-pressed", visible ? "true" : "false");
    button.removeAttribute("title");
  }
  renderNodeGraphVisibilityMenuButton();
}

function setNodeGraphVisibilityMenuOpen(open) {
  const menu = document.getElementById("nodeVisibilityMenu");
  if (menu) {
    menu.hidden = !open;
  }
  renderNodeGraphVisibilityMenuButton();
}

function toggleNodeGraphVisibilityMenu() {
  const menu = document.getElementById("nodeVisibilityMenu");
  setNodeGraphVisibilityMenuOpen(!(menu && !menu.hidden));
}

function resetNodeGraphStartupView() {
  nodeGraphMvp.moduleStoreDepartment = "";
  nodeGraphMvp.sceneContextPoint = null;
  setNodeGraphViewMode("modular");
}

function renderNodeGraphVideoViewToggle() {
  const button = document.getElementById("nodeVideoViewButton");
  const panel = document.getElementById("nodeVideoViewPanel");
  const workspace = document.getElementById("nodeGraphWorkspace");
  const wiringPanel = document.getElementById("nodeWiringPanel");
  const workspaceAvailable = Boolean(workspace && !workspace.hidden);
  const visible = Boolean(nodeGraphMvp.videoViewVisible) && workspaceAvailable;
  wiringPanel?.classList.toggle("camera-view-visible", visible);
  if (panel) {
    panel.hidden = !visible;
  }
  if (button) {
    button.innerHTML = visible
      ? "<span>Hide</span><span>Camera View</span>"
      : "<span>Show</span><span>Camera View</span>";
    button.setAttribute("aria-label", visible ? "Hide Camera View" : "Show Camera View");
    button.setAttribute("aria-pressed", visible ? "true" : "false");
    button.removeAttribute("title");
  }
  if (typeof renderNodeGraphCameraView === "function") {
    renderNodeGraphCameraView();
  }
}

function normalizeNodeGraphMacroValue(value) {
  return clampNodeSliderValue(Number(value) || 0, 0, 1);
}

function ensureNodeGraphMacroControls() {
  if (!Array.isArray(nodeGraphMvp.macroControls) || nodeGraphMvp.macroControls.length !== 10) {
    nodeGraphMvp.macroControls = new Array(10).fill(0);
  }
  nodeGraphMvp.macroControls = nodeGraphMvp.macroControls.map(normalizeNodeGraphMacroValue);
}

function renderNodeGraphMacroControls() {
  const button = document.getElementById("nodeMacroControlsToggleButton");
  const panel = document.getElementById("nodeMacroControlsPanel");
  const workspace = document.getElementById("nodeGraphWorkspace");
  const workspaceAvailable = Boolean(workspace && !workspace.hidden);
  const visible = Boolean(nodeGraphMvp.macroControlsVisible) && workspaceAvailable;
  ensureNodeGraphMacroControls();
  if (panel) {
    panel.hidden = !visible;
  }
  if (button) {
    button.innerHTML = visible
      ? "<span>Hide</span><span>Macro Controls</span>"
      : "<span>Show</span><span>Macro Controls</span>";
    button.setAttribute("aria-label", visible ? "Hide Macro Controls" : "Show Macro Controls");
    button.setAttribute("aria-pressed", visible ? "true" : "false");
    button.removeAttribute("title");
  }
  document.querySelectorAll("[data-macro-index]").forEach((knob) => {
    const index = Math.max(0, Math.min(9, Math.round(Number(knob.dataset.macroIndex) || 0)));
    const value = normalizeNodeGraphMacroValue(nodeGraphMvp.macroControls[index]);
    const angle = -132 + value * 264;
    knob.style.setProperty("--macro-value", String(value));
    knob.style.setProperty("--macro-angle", `${angle}deg`);
    knob.setAttribute("aria-valuenow", value.toFixed(3));
    const readout = knob.querySelector("[data-macro-value]");
    if (readout) {
      readout.textContent = value.toFixed(2);
    }
  });
  const status = document.getElementById("nodeMacroControlsStatus");
  if (status) {
    const activeCount = nodeGraphMvp.macroControls.filter((value) => value > 0).length;
    status.textContent = activeCount ? `${activeCount} active` : "10 macros ready";
  }
}

function setNodeGraphMacroControl(index, value) {
  ensureNodeGraphMacroControls();
  const safeIndex = Math.max(0, Math.min(9, Math.round(Number(index) || 0)));
  nodeGraphMvp.macroControls[safeIndex] = normalizeNodeGraphMacroValue(value);
  renderNodeGraphMacroControls();
  if (typeof sendNodeGraphLiveMacroControls === "function") {
    sendNodeGraphLiveMacroControls();
  }
}

function beginNodeGraphMacroControlDrag(event) {
  const knob = event.currentTarget;
  const index = Math.max(0, Math.min(9, Math.round(Number(knob.dataset.macroIndex) || 0)));
  event.preventDefault();
  knob.setPointerCapture?.(event.pointerId);
  nodeGraphMvp.dragging = {
    type: "macro-control",
    index,
    startX: event.clientX,
    startY: event.clientY,
    startValue: normalizeNodeGraphMacroValue(nodeGraphMvp.macroControls?.[index]),
  };
}

function dragNodeGraphMacroControl(event) {
  const drag = nodeGraphMvp.dragging;
  if (!drag || drag.type !== "macro-control") {
    return;
  }
  event.preventDefault();
  const delta = ((event.clientX - drag.startX) - (event.clientY - drag.startY)) / 240;
  setNodeGraphMacroControl(drag.index, drag.startValue + delta);
}

function endNodeGraphMacroControlDrag(event) {
  const drag = nodeGraphMvp.dragging;
  if (drag?.type === "macro-control") {
    event.currentTarget?.releasePointerCapture?.(event.pointerId);
    nodeGraphMvp.dragging = null;
  }
}

function bindNodeGraphMacroControlsPanelEvents() {
  document.querySelectorAll("[data-macro-index]").forEach((knob) => {
    if (knob.dataset.macroControlBound === "true") {
      return;
    }
    knob.dataset.macroControlBound = "true";
    knob.addEventListener("pointerdown", beginNodeGraphMacroControlDrag);
    knob.addEventListener("pointermove", dragNodeGraphMacroControl);
    knob.addEventListener("pointerup", endNodeGraphMacroControlDrag);
    knob.addEventListener("pointercancel", endNodeGraphMacroControlDrag);
    knob.addEventListener("lostpointercapture", endNodeGraphMacroControlDrag);
  });
  if (document.body.dataset.macroControlWindowBound !== "true") {
    document.body.dataset.macroControlWindowBound = "true";
    window.addEventListener("pointermove", dragNodeGraphMacroControl);
    window.addEventListener("pointerup", endNodeGraphMacroControlDrag);
    window.addEventListener("pointercancel", endNodeGraphMacroControlDrag);
  }
  renderNodeGraphMacroControls();
}

const nodeGraphMidiKeyboardStartMidi = 48;
const nodeGraphMidiKeyboardNoteCount = 25;
const nodeGraphMidiKeyboardSampleRate = 44100;
const nodeGraphMidiKeyboardMinOctave = -4;
const nodeGraphMidiKeyboardMaxOctave = 4;
const nodeGraphMidiKeyboardNoteNames = Object.freeze(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]);
const nodeGraphMidiKeyboardMemoryStorageKey = "soemdsp-sandbox-midi-keyboard-memory-v1";

function nodeGraphMidiKeyboardClamp01(value) {
  return clampNodeSliderValue(Number(value) || 0, 0, 1);
}

function nodeGraphMidiKeyboardTenthVoltPerOctave(midi) {
  return nodeGraphMidiKeyboardClamp01((Number(midi) || 0) / 120);
}

function normalizeNodeGraphMidiKeyboardMemorySignal(signal, options = {}) {
  if (!signal || typeof signal !== "object") {
    return null;
  }
  const midi = Math.max(0, Math.min(127, Math.round(Number(signal.midi) || 60)));
  const rawMidi = Math.max(0, Math.min(127, Math.round(Number(signal.rawMidi) || midi)));
  const octave = nodeGraphMidiKeyboardOctaveOffset(signal.octave);
  const keyIndex = Math.max(0, Math.min(nodeGraphMidiKeyboardNoteCount - 1, Number(signal.keyIndex) || 0));
  const keyQuantized = nodeGraphMidiKeyboardClamp01(signal.keyQuantized ?? (keyIndex / Math.max(1, nodeGraphMidiKeyboardNoteCount - 1)));
  const frequency = Math.max(0, Number(signal.frequency) || 440 * 2 ** ((midi - 69) / 12));
  const gate = options.preserveGate ? (Number(signal.gate) > 0 ? 1 : 0) : 0;
  return {
    source: signal.source || "remembered",
    gate,
    gatePulse: options.preserveGatePulse ? (Number(signal.gatePulse) > 0 ? 1 : 0) : 0,
    x: nodeGraphMidiKeyboardClamp01(signal.x ?? keyQuantized),
    y: nodeGraphMidiKeyboardClamp01(signal.y ?? 0),
    keyIndex,
    keyQuantized,
    rawMidi,
    octave,
    midi,
    pitch: signal.pitch || nodeGraphMidiKeyboardPitchLabel(midi),
    pitchValue: Math.max(0, Math.min(127, Number(signal.pitchValue) || midi)),
    midiNormalized: nodeGraphMidiKeyboardClamp01(signal.midiNormalized ?? (midi / 127)),
    tenthVoltPerOctave: nodeGraphMidiKeyboardClamp01(signal.tenthVoltPerOctave ?? (midi / 120)),
    increment: Math.max(0, Number(signal.increment) || frequency / nodeGraphMidiKeyboardSampleRate),
    frequency,
  };
}

function nodeGraphMidiKeyboardMemoryPayload() {
  return {
    inputId: nodeGraphMvp.midiKeyboardInputId || "",
    mode: nodeGraphMidiKeyboardMode(),
    modWheel: nodeGraphPerformanceModWheelValue(),
    octave: nodeGraphMidiKeyboardOctaveOffset(),
    pitchWheel: nodeGraphPerformancePitchWheelValue(),
    signal: normalizeNodeGraphMidiKeyboardMemorySignal(nodeGraphMvp.midiKeyboardSignal),
    visible: Boolean(nodeGraphMvp.midiKeyboardVisible),
  };
}

function saveNodeGraphMidiKeyboardMemory() {
  try {
    window.localStorage.setItem(
      nodeGraphMidiKeyboardMemoryStorageKey,
      JSON.stringify(nodeGraphMidiKeyboardMemoryPayload()),
    );
    return true;
  } catch {
    return false;
  }
}

function loadNodeGraphMidiKeyboardMemory() {
  try {
    const text = window.localStorage.getItem(nodeGraphMidiKeyboardMemoryStorageKey);
    if (!text) {
      return null;
    }
    const payload = JSON.parse(text);
    if (!payload || typeof payload !== "object") {
      return null;
    }
    return {
      inputId: String(payload.inputId || ""),
      mode: nodeGraphMidiKeyboardMode(payload.mode),
      modWheel: nodeGraphPerformanceModWheelValue(payload.modWheel),
      octave: nodeGraphMidiKeyboardOctaveOffset(payload.octave),
      pitchWheel: nodeGraphPerformancePitchWheelValue(payload.pitchWheel),
      signal: normalizeNodeGraphMidiKeyboardMemorySignal(payload.signal),
      visible: Boolean(payload.visible),
    };
  } catch {
    return null;
  }
}

function applyNodeGraphMidiKeyboardMemory() {
  nodeGraphMvp.midiKeyboardMemoryLoaded = true;
  const memory = loadNodeGraphMidiKeyboardMemory();
  if (!memory) {
    return false;
  }
  nodeGraphMvp.midiKeyboardInputId = memory.inputId;
  nodeGraphMvp.midiKeyboardMode = memory.mode;
  nodeGraphMvp.modWheelSignal = memory.modWheel;
  nodeGraphMvp.midiKeyboardOctave = memory.octave;
  nodeGraphMvp.pitchWheelSignal = memory.pitchWheel;
  nodeGraphMvp.midiKeyboardSignal = memory.signal;
  nodeGraphMvp.midiKeyboardVisible = memory.visible;
  nodeGraphMvp.midiKeyboardPreviousGate = 0;
  return true;
}

function ensureNodeGraphMidiKeyboardMemoryLoaded() {
  if (nodeGraphMvp.midiKeyboardMemoryLoaded) {
    return;
  }
  applyNodeGraphMidiKeyboardMemory();
}

function nodeGraphPerformancePitchWheelValue(value = nodeGraphMvp.pitchWheelSignal) {
  return clampNodeSliderValue(Number(value) || 0, -1, 1);
}

function nodeGraphPerformanceModWheelValue(value = nodeGraphMvp.modWheelSignal) {
  return clampNodeSliderValue(Number(value) || 0, 0, 1);
}

function renderNodeGraphPerformanceWheels() {
  const pitchWheel = nodeGraphPerformancePitchWheelValue();
  const modWheel = nodeGraphPerformanceModWheelValue();
  nodeGraphMvp.pitchWheelSignal = pitchWheel;
  nodeGraphMvp.modWheelSignal = modWheel;
  const controls = [
    {
      id: "nodePitchWheelControl",
      position: (pitchWheel + 1) * 0.5,
      value: pitchWheel,
      valueKey: "pitchWheel",
    },
    {
      id: "nodeModWheelControl",
      position: modWheel,
      value: modWheel,
      valueKey: "modWheel",
    },
  ];
  for (const control of controls) {
    const element = document.getElementById(control.id);
    if (element) {
      element.style.setProperty("--wheel-value", String(control.position));
      element.setAttribute("aria-valuenow", control.value.toFixed(3));
    }
    const valueElement = document.querySelector(`[data-performance-wheel-value="${control.valueKey}"]`);
    if (valueElement) {
      valueElement.textContent = control.value.toFixed(3);
    }
  }
}

function setNodeGraphPerformanceWheel(kind, value, status = "") {
  if (kind === "pitchWheel") {
    nodeGraphMvp.pitchWheelSignal = nodeGraphPerformancePitchWheelValue(value);
  } else if (kind === "modWheel") {
    nodeGraphMvp.modWheelSignal = nodeGraphPerformanceModWheelValue(value);
  }
  if (status) {
    nodeGraphMvp.midiKeyboardStatus = status;
  }
  saveNodeGraphMidiKeyboardMemory();
  renderNodeGraphPerformanceWheels();
  renderNodeGraphMidiKeyboardInputControls();
  if (typeof sendNodeGraphLivePitchModWheelSignal === "function") {
    sendNodeGraphLivePitchModWheelSignal();
  }
}

function setNodeGraphPerformanceWheelFromPointer(element, event) {
  const rect = element.getBoundingClientRect();
  const y = nodeGraphMidiKeyboardClamp01((event.clientY - rect.top) / Math.max(1, rect.height));
  const kind = element.dataset.performanceWheel;
  const value = kind === "pitchWheel" ? 1 - y * 2 : 1 - y;
  setNodeGraphPerformanceWheel(kind, value, kind === "pitchWheel"
    ? `pitch wheel ${nodeGraphPerformancePitchWheelValue(value).toFixed(3)}`
    : `mod wheel ${nodeGraphPerformanceModWheelValue(value).toFixed(3)}`);
}

function beginNodeGraphPerformanceWheelDrag(event) {
  const element = event.currentTarget;
  event.preventDefault();
  element.setPointerCapture?.(event.pointerId);
  setNodeGraphPerformanceWheelFromPointer(element, event);
}

function dragNodeGraphPerformanceWheel(event) {
  if (!event.currentTarget.hasPointerCapture?.(event.pointerId)) {
    return;
  }
  event.preventDefault();
  setNodeGraphPerformanceWheelFromPointer(event.currentTarget, event);
}

function endNodeGraphPerformanceWheelDrag(event) {
  const element = event.currentTarget;
  if (element.hasPointerCapture?.(event.pointerId)) {
    element.releasePointerCapture?.(event.pointerId);
  }
  if (element.dataset.performanceWheel === "pitchWheel") {
    setNodeGraphPerformanceWheel("pitchWheel", 0, "pitch wheel centered");
  }
}

function nodeGraphMidiKeyboardPitchLabel(midi) {
  const rounded = Math.round(Number(midi) || 0);
  const note = nodeGraphMidiKeyboardNoteNames[((rounded % 12) + 12) % 12];
  return `${note}${Math.floor(rounded / 12) - 1}`;
}

function nodeGraphMidiKeyboardOctaveOffset(value = nodeGraphMvp.midiKeyboardOctave) {
  return Math.max(
    nodeGraphMidiKeyboardMinOctave,
    Math.min(nodeGraphMidiKeyboardMaxOctave, Math.round(Number(value) || 0)),
  );
}

function nodeGraphMidiKeyboardShiftMidi(rawMidi, octave = nodeGraphMidiKeyboardOctaveOffset()) {
  return Math.max(0, Math.min(127, Math.round(Number(rawMidi) || 0) + octave * 12));
}

function nodeGraphMidiKeyboardOctaveLabel(value = nodeGraphMidiKeyboardOctaveOffset()) {
  const octave = nodeGraphMidiKeyboardOctaveOffset(value);
  return `${octave >= 0 ? "+" : ""}${octave}`;
}

const nodeGraphMidiKeyboardModes = Object.freeze(["press", "hold"]);

function nodeGraphMidiKeyboardMode(value = nodeGraphMvp.midiKeyboardMode) {
  return nodeGraphMidiKeyboardModes.includes(value) ? value : "press";
}

function nodeGraphMidiKeyboardModeLabel(value = nodeGraphMidiKeyboardMode()) {
  return {
    press: "Press",
    hold: "Hold",
  }[nodeGraphMidiKeyboardMode(value)] || "Press";
}

function nodeGraphMidiKeyboardRawMidiFromSignal(signal) {
  if (Number.isFinite(Number(signal?.rawMidi))) {
    return Math.round(Number(signal.rawMidi));
  }
  const signalOctave = nodeGraphMidiKeyboardOctaveOffset(signal?.octave);
  return Math.round(Number(signal?.midi) || 60) - signalOctave * 12;
}

function renderNodeGraphMidiKeyboardKeyLabels() {
  const octave = nodeGraphMidiKeyboardOctaveOffset();
  document.querySelectorAll("#nodeMidiKeyboardPanel [data-midi]").forEach((key) => {
    const rawMidi = Math.round(Number(key.dataset.midi) || 0);
    key.textContent = nodeGraphMidiKeyboardPitchLabel(nodeGraphMidiKeyboardShiftMidi(rawMidi, octave));
    key.setAttribute("aria-label", `${key.textContent} / MIDI ${nodeGraphMidiKeyboardShiftMidi(rawMidi, octave)}`);
  });
}

function nodeGraphMidiKeyboardSignalFromRaw(rawMidi, options = {}) {
  const octave = nodeGraphMidiKeyboardOctaveOffset();
  const midi = nodeGraphMidiKeyboardShiftMidi(rawMidi, octave);
  const rawKeyIndex = Math.max(
    0,
    Math.min(nodeGraphMidiKeyboardNoteCount - 1, Math.round(Number(rawMidi) || 0) - nodeGraphMidiKeyboardStartMidi),
  );
  const keyQuantized = nodeGraphMidiKeyboardNoteCount > 1 ? rawKeyIndex / (nodeGraphMidiKeyboardNoteCount - 1) : 0;
  const frequency = 440 * 2 ** ((midi - 69) / 12);
  return {
    source: options.source || "keyboard",
    gate: options.gate ? 1 : 0,
    gatePulse: options.gatePulse ? 1 : 0,
    x: nodeGraphMidiKeyboardClamp01(options.x ?? keyQuantized),
    y: nodeGraphMidiKeyboardClamp01(options.y ?? 0),
    keyIndex: rawKeyIndex,
    keyQuantized,
    rawMidi: Math.round(Number(rawMidi) || 0),
    octave,
    midi,
    pitchValue: midi,
    midiNormalized: midi / 127,
    tenthVoltPerOctave: nodeGraphMidiKeyboardTenthVoltPerOctave(midi),
    increment: frequency / nodeGraphMidiKeyboardSampleRate,
    frequency,
    pitch: nodeGraphMidiKeyboardPitchLabel(midi),
  };
}

function nodeGraphMidiKeyboardFallbackSignal() {
  return nodeGraphMidiKeyboardSignalFromRaw(60, {
    source: "fallback",
    gate: 0,
    gatePulse: 0,
    x: 0.5,
    y: 0,
  });
}

function nodeGraphMidiKeyboardSignalFromPointer(event, surface) {
  const rect = surface.getBoundingClientRect();
  const x = nodeGraphMidiKeyboardClamp01((event.clientX - rect.left) / Math.max(1, rect.width));
  const y = nodeGraphMidiKeyboardClamp01(1 - (event.clientY - rect.top) / Math.max(1, rect.height));
  const target = event.target?.closest?.("[data-midi]");
  const targetMidi = target && surface.contains(target) ? Number(target.dataset.midi) : NaN;
  const fallbackKeyIndex = Math.min(
    nodeGraphMidiKeyboardNoteCount - 1,
    Math.max(0, Math.floor(x * nodeGraphMidiKeyboardNoteCount)),
  );
  const rawMidi = Number.isFinite(targetMidi) ? targetMidi : nodeGraphMidiKeyboardStartMidi + fallbackKeyIndex;
  const gate = event.buttons > 0 ? 1 : 0;
  return nodeGraphMidiKeyboardSignalFromRaw(rawMidi, {
    source: "pointer",
    gate,
    x,
    y,
  });
}

function nodeGraphMidiKeyboardSignalFromMidi(midiValue, velocityValue = 0, gateValue = 0, pulseValue = 0) {
  const rawMidi = Math.max(0, Math.min(127, Math.round(Number(midiValue) || 0)));
  const velocity = Math.max(0, Math.min(127, Math.round(Number(velocityValue) || 0)));
  return nodeGraphMidiKeyboardSignalFromRaw(rawMidi, {
    source: "midi",
    gate: gateValue ? 1 : 0,
    gatePulse: pulseValue ? 1 : 0,
    y: velocity / 127,
  });
}

function sendNodeGraphMidiKeyboardSignalToLive(signal) {
  if (typeof sendNodeGraphLiveMidiKeyboardSignal === "function") {
    sendNodeGraphLiveMidiKeyboardSignal(signal || nodeGraphMidiKeyboardFallbackSignal());
  }
}

function nodeGraphMidiKeyboardHeldPointerSignal() {
  const held = nodeGraphMvp.midiKeyboardPointerHeldSignal;
  return held && typeof held === "object" ? { ...held, gate: 1, source: "pointerHold" } : null;
}

function clearNodeGraphMidiKeyboardPointerHold(status = "") {
  nodeGraphMvp.midiKeyboardPointerHeldSignal = null;
  if (status) {
    nodeGraphMvp.midiKeyboardStatus = status;
  }
  renderNodeGraphMidiKeyboardSignal(null);
}

function nodeGraphMidiKeyboardFixedText(text, width) {
  return String(text ?? "").padStart(Math.max(0, Number(width) || 0), " ");
}

function nodeGraphMidiKeyboardFixedInteger(value, width, fallback = "-") {
  const number = Number(value);
  const text = Number.isFinite(number) ? String(Math.round(number)) : fallback;
  return nodeGraphMidiKeyboardFixedText(text, width);
}

function nodeGraphMidiKeyboardFixedDecimal(value, options = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return nodeGraphMidiKeyboardFixedText(options.fallback ?? "-", options.width ?? 1);
  }
  const text = typeof limit_decimals === "function"
    ? limit_decimals(
      String(number),
      options.maxDigits ?? 4,
      options.decimalPlaces ?? 3,
      options.decimalPlaces ?? 3,
      false,
    )
    : number.toFixed(options.decimalPlaces ?? 3);
  return nodeGraphMidiKeyboardFixedText(text, options.width ?? text.length);
}

function toggleNodeGraphMidiKeyboardPointerHold(event, surface) {
  const signal = nodeGraphMidiKeyboardSignalFromPointer(event, surface);
  const held = nodeGraphMidiKeyboardHeldPointerSignal();
  event.preventDefault();
  if (held && held.midi === signal.midi) {
    clearNodeGraphMidiKeyboardPointerHold(`${signal.pitch} hold off`);
    return;
  }
  nodeGraphMvp.midiKeyboardPointerHeldSignal = {
    ...signal,
    gate: 1,
    gatePulse: 1,
    source: "pointerHold",
  };
  nodeGraphMvp.midiKeyboardStatus = `${signal.pitch} held`;
  renderNodeGraphMidiKeyboardSignal(nodeGraphMvp.midiKeyboardPointerHeldSignal);
}

function clearNodeGraphMidiKeyboardPulseDisplay(serial) {
  window.setTimeout(() => {
    if (nodeGraphMvp.midiKeyboardPulseSerial !== serial || !nodeGraphMvp.midiKeyboardSignal) {
      return;
    }
    nodeGraphMvp.midiKeyboardSignal.gatePulse = 0;
    const field = document.querySelector('#nodeMidiKeyboardSignalBar [data-keyboard-signal="gatePulse"]');
    if (field) {
      field.textContent = nodeGraphMidiKeyboardFixedInteger(0, 1, "0");
    }
    sendNodeGraphMidiKeyboardSignalToLive(nodeGraphMvp.midiKeyboardSignal);
  }, 60);
}

function renderNodeGraphMidiKeyboardSignal(signal = null) {
  const previousGate = Number(nodeGraphMvp.midiKeyboardPreviousGate) > 0 ? 1 : 0;
  const rememberedSignal = normalizeNodeGraphMidiKeyboardMemorySignal(nodeGraphMvp.midiKeyboardSignal);
  const nextSignal = signal
    ? normalizeNodeGraphMidiKeyboardMemorySignal(signal, { preserveGate: true, preserveGatePulse: true })
    : rememberedSignal;
  if (nextSignal) {
    const gate = Number(nextSignal.gate) > 0 ? 1 : 0;
    nextSignal.gate = gate;
    nextSignal.gatePulse = Number(nextSignal.gatePulse) > 0 || (gate > 0 && previousGate <= 0) ? 1 : 0;
    nodeGraphMvp.midiKeyboardPreviousGate = gate;
    if (nextSignal.gatePulse > 0) {
      nodeGraphMvp.midiKeyboardPulseSerial = (Number(nodeGraphMvp.midiKeyboardPulseSerial) || 0) + 1;
    }
  } else {
    nodeGraphMvp.midiKeyboardPreviousGate = 0;
  }
  nodeGraphMvp.midiKeyboardSignal = nextSignal ? { ...nextSignal } : null;
  saveNodeGraphMidiKeyboardMemory();
  const values = {
    gate: nodeGraphMidiKeyboardFixedInteger(nextSignal?.gate ?? 0, 1, "0"),
    gatePulse: nodeGraphMidiKeyboardFixedInteger(nextSignal?.gatePulse ?? 0, 1, "0"),
    key: nextSignal ? nodeGraphMidiKeyboardFixedInteger(nextSignal.keyIndex, 2) : nodeGraphMidiKeyboardFixedText("-", 2),
    quantized: nextSignal
      ? nodeGraphMidiKeyboardFixedDecimal(nextSignal.keyQuantized, { decimalPlaces: 3, maxDigits: 4, width: 5 })
      : nodeGraphMidiKeyboardFixedText("-", 5),
    midi: nextSignal ? nodeGraphMidiKeyboardFixedInteger(nextSignal.midi, 3) : nodeGraphMidiKeyboardFixedText("-", 3),
    octave: nodeGraphMidiKeyboardOctaveLabel(),
    double: nextSignal
      ? nodeGraphMidiKeyboardFixedDecimal(nextSignal.midiNormalized, { decimalPlaces: 6, maxDigits: 7, width: 8 })
      : nodeGraphMidiKeyboardFixedText("-", 8),
    tenthVoltPerOctave: nextSignal
      ? nodeGraphMidiKeyboardFixedDecimal(nextSignal.tenthVoltPerOctave, { decimalPlaces: 6, maxDigits: 7, width: 8 })
      : nodeGraphMidiKeyboardFixedText("-", 8),
    increment: nextSignal
      ? nodeGraphMidiKeyboardFixedDecimal(nextSignal.increment, { decimalPlaces: 7, maxDigits: 8, width: 9 })
      : nodeGraphMidiKeyboardFixedText("-", 9),
    frequency: nextSignal
      ? nodeGraphMidiKeyboardFixedDecimal(nextSignal.frequency, { decimalPlaces: 2, maxDigits: 7, width: 8 })
      : nodeGraphMidiKeyboardFixedText("-", 8),
    pitch: nextSignal ? nodeGraphMidiKeyboardFixedText(nextSignal.pitch, 3) : nodeGraphMidiKeyboardFixedText("-", 3),
    x: nextSignal
      ? nodeGraphMidiKeyboardFixedDecimal(nextSignal.x, { decimalPlaces: 3, maxDigits: 4, width: 5 })
      : nodeGraphMidiKeyboardFixedDecimal(0, { decimalPlaces: 3, maxDigits: 4, width: 5 }),
    y: nextSignal
      ? nodeGraphMidiKeyboardFixedDecimal(nextSignal.y, { decimalPlaces: 3, maxDigits: 4, width: 5 })
      : nodeGraphMidiKeyboardFixedDecimal(0, { decimalPlaces: 3, maxDigits: 4, width: 5 }),
  };
  document.querySelectorAll("#nodeMidiKeyboardSignalBar [data-keyboard-signal]").forEach((field) => {
    const key = field.dataset.keyboardSignal;
    field.textContent = values[key] ?? "-";
  });
  const status = document.getElementById("nodeMidiKeyboardStatus");
  if (status) {
    status.textContent = nextSignal ? `${nextSignal.pitch} / midi ${nextSignal.midi}` : "";
  }
  document.querySelectorAll("#nodeMidiKeyboardPanel [data-midi]").forEach((key) => {
    const activeMidi = nextSignal ? nodeGraphMidiKeyboardRawMidiFromSignal(nextSignal) : NaN;
    const active = Boolean(
      nextSignal &&
      Number(key.dataset.midi) === activeMidi &&
      nextSignal.gate > 0,
    );
    key.classList.toggle("active", active);
  });
  sendNodeGraphMidiKeyboardSignalToLive(nodeGraphMvp.midiKeyboardSignal);
  if (nextSignal?.gatePulse > 0) {
    clearNodeGraphMidiKeyboardPulseDisplay(nodeGraphMvp.midiKeyboardPulseSerial);
  }
}

function renderNodeGraphMidiKeyboardOctaveControl() {
  nodeGraphMvp.midiKeyboardOctave = nodeGraphMidiKeyboardOctaveOffset();
  renderNodeGraphMidiKeyboardKeyLabels();
  const value = document.getElementById("nodeMidiKeyboardOctaveValue");
  const down = document.getElementById("nodeMidiKeyboardOctaveDown");
  const up = document.getElementById("nodeMidiKeyboardOctaveUp");
  if (value) {
    value.textContent = nodeGraphMidiKeyboardOctaveLabel(nodeGraphMvp.midiKeyboardOctave);
  }
  if (down) {
    down.disabled = nodeGraphMvp.midiKeyboardOctave <= nodeGraphMidiKeyboardMinOctave;
  }
  if (up) {
    up.disabled = nodeGraphMvp.midiKeyboardOctave >= nodeGraphMidiKeyboardMaxOctave;
  }
}

function renderNodeGraphMidiKeyboardModeControl() {
  nodeGraphMvp.midiKeyboardMode = nodeGraphMidiKeyboardMode();
  const select = document.getElementById("nodeMidiKeyboardModeSelect");
  if (select) {
    select.value = nodeGraphMvp.midiKeyboardMode;
  }
}

function handleNodeGraphMidiKeyboardModeChange(event) {
  const mode = nodeGraphMidiKeyboardMode(event.currentTarget.value);
  nodeGraphMvp.midiKeyboardMode = mode;
  nodeGraphMvp.midiKeyboardStatus = `${nodeGraphMidiKeyboardModeLabel(mode)} mode`;
  if (mode !== "hold") {
    nodeGraphMvp.midiKeyboardPointerHeldSignal = null;
  }
  renderNodeGraphMidiKeyboardModeControl();
  renderNodeGraphMidiKeyboardSignal(mode === "hold" ? nodeGraphMidiKeyboardHeldPointerSignal() : null);
  saveNodeGraphMidiKeyboardMemory();
  renderNodeGraphMidiKeyboardInputControls();
}

function retuneNodeGraphMidiKeyboardSignal(signal) {
  if (!signal) {
    return null;
  }
  return {
    ...nodeGraphMidiKeyboardSignalFromRaw(nodeGraphMidiKeyboardRawMidiFromSignal(signal), {
      source: signal.source || "keyboard",
      gate: Number(signal.gate) > 0 ? 1 : 0,
      gatePulse: Number(signal.gatePulse) > 0 ? 1 : 0,
      x: signal.x,
      y: signal.y,
    }),
  };
}

function changeNodeGraphMidiKeyboardOctave(delta) {
  nodeGraphMvp.midiKeyboardOctave = nodeGraphMidiKeyboardOctaveOffset(nodeGraphMvp.midiKeyboardOctave + delta);
  nodeGraphMvp.midiKeyboardPointerHeldSignal = retuneNodeGraphMidiKeyboardSignal(nodeGraphMvp.midiKeyboardPointerHeldSignal);
  nodeGraphMvp.midiKeyboardStatus = `octave ${nodeGraphMidiKeyboardOctaveLabel(nodeGraphMvp.midiKeyboardOctave)}`;
  renderNodeGraphMidiKeyboardOctaveControl();
  renderNodeGraphMidiKeyboardSignal(retuneNodeGraphMidiKeyboardSignal(nodeGraphMvp.midiKeyboardSignal));
  saveNodeGraphMidiKeyboardMemory();
  renderNodeGraphMidiKeyboardInputControls();
}

function updateNodeGraphMidiKeyboardSignal(event) {
  const surface = document.querySelector("#nodeMidiKeyboardPanel .node-midi-keyboard-surface");
  if (!surface) {
    return;
  }
  const mode = nodeGraphMidiKeyboardMode();
  if (event.type === "pointerdown" && (event.shiftKey || mode === "hold")) {
    toggleNodeGraphMidiKeyboardPointerHold(event, surface);
    return;
  }
  const held = nodeGraphMidiKeyboardHeldPointerSignal();
  if (event.type === "pointerup" && (event.shiftKey || mode === "hold") && !held) {
    renderNodeGraphMidiKeyboardSignal(null);
    return;
  }
  if (held && event.buttons <= 0) {
    renderNodeGraphMidiKeyboardSignal(held);
    return;
  }
  renderNodeGraphMidiKeyboardSignal(nodeGraphMidiKeyboardSignalFromPointer(event, surface));
}

function handleNodeGraphMidiKeyboardPointerLeave() {
  renderNodeGraphMidiKeyboardSignal(nodeGraphMidiKeyboardHeldPointerSignal());
}

function renderNodeGraphMidiKeyboardInputControls() {
  const button = document.getElementById("nodeMidiKeyboardMidiButton");
  const select = document.getElementById("nodeMidiKeyboardMidiInput");
  const status = document.getElementById("nodeMidiKeyboardStatus");
  const inputs = Array.isArray(nodeGraphMvp.midiKeyboardInputs) ? nodeGraphMvp.midiKeyboardInputs : [];
  if (button) {
    button.textContent = nodeGraphMvp.midiKeyboardAccess ? "Refresh MIDI" : "Enable MIDI";
  }
  if (select) {
    const selected = nodeGraphMvp.midiKeyboardInputId || "";
    select.replaceChildren(new Option(inputs.length ? "all midi inputs" : "no midi input", ""));
    for (const input of inputs) {
      select.append(new Option(input.name || input.id || "midi input", input.id));
    }
    select.disabled = !inputs.length;
    select.value = inputs.some((input) => input.id === selected) ? selected : "";
  }
  if (status) {
    status.textContent = nodeGraphMvp.midiKeyboardStatus || (nodeGraphMvp.midiKeyboardSignal
      ? `${nodeGraphMvp.midiKeyboardSignal.pitch} / midi ${nodeGraphMvp.midiKeyboardSignal.midi}`
      : "");
  }
  renderNodeGraphMidiKeyboardModeControl();
}

function updateNodeGraphMidiKeyboardStatus(text) {
  nodeGraphMvp.midiKeyboardStatus = text;
  renderNodeGraphMidiKeyboardInputControls();
}

function refreshNodeGraphMidiKeyboardInputs() {
  const access = nodeGraphMvp.midiKeyboardAccess;
  const inputs = access?.inputs ? Array.from(access.inputs.values()) : [];
  nodeGraphMvp.midiKeyboardInputs = inputs.map((input) => ({
    id: input.id,
    name: input.name || input.manufacturer || input.id,
  }));
  if (nodeGraphMvp.midiKeyboardInputId && !inputs.some((input) => input.id === nodeGraphMvp.midiKeyboardInputId)) {
    nodeGraphMvp.midiKeyboardInputId = "";
  }
  for (const input of inputs) {
    input.onmidimessage = handleNodeGraphMidiKeyboardMessage;
  }
  nodeGraphMvp.midiKeyboardStatus = inputs.length ? `${inputs.length} midi input${inputs.length === 1 ? "" : "s"}` : "midi ready: no inputs";
  renderNodeGraphMidiKeyboardInputControls();
}

async function enableNodeGraphMidiKeyboardInput() {
  if (!navigator.requestMIDIAccess) {
    nodeGraphMvp.midiKeyboardStatus = "web midi unavailable";
    renderNodeGraphMidiKeyboardInputControls();
    return;
  }
  try {
    nodeGraphMvp.midiKeyboardStatus = "requesting midi...";
    renderNodeGraphMidiKeyboardInputControls();
    const access = await navigator.requestMIDIAccess({ sysex: false });
    nodeGraphMvp.midiKeyboardAccess = access;
    access.onstatechange = refreshNodeGraphMidiKeyboardInputs;
    refreshNodeGraphMidiKeyboardInputs();
  } catch (error) {
    nodeGraphMvp.midiKeyboardStatus = error?.message || "midi access blocked";
    renderNodeGraphMidiKeyboardInputControls();
  }
}

function handleNodeGraphMidiKeyboardInputChange(event) {
  nodeGraphMvp.midiKeyboardInputId = event.currentTarget.value || "";
  saveNodeGraphMidiKeyboardMemory();
  renderNodeGraphMidiKeyboardInputControls();
}

function handleNodeGraphMidiKeyboardMessage(event) {
  const input = event.currentTarget;
  if (nodeGraphMvp.midiKeyboardInputId && input?.id !== nodeGraphMvp.midiKeyboardInputId) {
    return;
  }
  const [status = 0, data1 = 0, data2 = 0] = Array.from(event.data || []);
  const command = status & 0xf0;
  const channel = (status & 0x0f) + 1;
  if (command === 0xb0 && data1 === 1) {
    const value = Math.max(0, Math.min(127, Math.round(data2))) / 127;
    setNodeGraphPerformanceWheel("modWheel", value, `ch ${channel} mod wheel ${value.toFixed(3)}`);
    return;
  }
  if (command === 0xe0) {
    const raw = Math.max(0, Math.min(16383, (Math.round(data1) || 0) + (Math.round(data2) || 0) * 128));
    const value = raw >= 8192 ? (raw - 8192) / 8191 : (raw - 8192) / 8192;
    setNodeGraphPerformanceWheel("pitchWheel", value, `ch ${channel} pitch bend ${nodeGraphPerformancePitchWheelValue(value).toFixed(3)}`);
    return;
  }
  if (command !== 0x80 && command !== 0x90) {
    return;
  }
  const midi = Math.max(0, Math.min(127, Math.round(data1)));
  const velocity = Math.max(0, Math.min(127, Math.round(data2)));
  const noteOn = command === 0x90 && velocity > 0;
  if (!(nodeGraphMvp.midiKeyboardHeldNotes instanceof Map)) {
    nodeGraphMvp.midiKeyboardHeldNotes = new Map();
  }
  if (noteOn) {
    nodeGraphMvp.midiKeyboardHeldNotes.set(midi, velocity);
    nodeGraphMvp.midiKeyboardStatus = `ch ${channel} ${nodeGraphMidiKeyboardPitchLabel(midi)} vel ${velocity}`;
    renderNodeGraphMidiKeyboardSignal(nodeGraphMidiKeyboardSignalFromMidi(midi, velocity, 1, 1));
    return;
  }
  nodeGraphMvp.midiKeyboardHeldNotes.delete(midi);
  const held = Array.from(nodeGraphMvp.midiKeyboardHeldNotes.entries()).at(-1);
  if (held) {
    const [heldMidi, heldVelocity] = held;
    nodeGraphMvp.midiKeyboardStatus = `ch ${channel} ${nodeGraphMidiKeyboardPitchLabel(heldMidi)} vel ${heldVelocity}`;
    renderNodeGraphMidiKeyboardSignal(nodeGraphMidiKeyboardSignalFromMidi(heldMidi, heldVelocity, 1));
    return;
  }
  nodeGraphMvp.midiKeyboardStatus = `ch ${channel} ${nodeGraphMidiKeyboardPitchLabel(midi)} off`;
  renderNodeGraphMidiKeyboardSignal(nodeGraphMidiKeyboardSignalFromMidi(midi, 0, 0));
}

function bindNodeGraphMidiKeyboardPanelEvents() {
  const surface = document.querySelector("#nodeMidiKeyboardPanel .node-midi-keyboard-surface");
  if (!surface || surface.dataset.keyboardSignalBound === "true") {
    return;
  }
  surface.dataset.keyboardSignalBound = "true";
  surface.addEventListener("pointermove", updateNodeGraphMidiKeyboardSignal);
  surface.addEventListener("pointerdown", updateNodeGraphMidiKeyboardSignal);
  surface.addEventListener("pointerup", updateNodeGraphMidiKeyboardSignal);
  surface.addEventListener("pointerleave", handleNodeGraphMidiKeyboardPointerLeave);
  document.querySelectorAll("[data-performance-wheel]").forEach((wheel) => {
    if (wheel.dataset.performanceWheelBound === "true") {
      return;
    }
    wheel.dataset.performanceWheelBound = "true";
    wheel.addEventListener("pointerdown", beginNodeGraphPerformanceWheelDrag);
    wheel.addEventListener("pointermove", dragNodeGraphPerformanceWheel);
    wheel.addEventListener("pointerup", endNodeGraphPerformanceWheelDrag);
    wheel.addEventListener("pointercancel", endNodeGraphPerformanceWheelDrag);
  });
  document
    .getElementById("nodeMidiKeyboardMidiButton")
    ?.addEventListener("click", enableNodeGraphMidiKeyboardInput);
  document
    .getElementById("nodeMidiKeyboardMidiInput")
    ?.addEventListener("change", handleNodeGraphMidiKeyboardInputChange);
  document
    .getElementById("nodeMidiKeyboardModeSelect")
    ?.addEventListener("change", handleNodeGraphMidiKeyboardModeChange);
  document
    .getElementById("nodeMidiKeyboardOctaveDown")
    ?.addEventListener("click", () => changeNodeGraphMidiKeyboardOctave(-1));
  document
    .getElementById("nodeMidiKeyboardOctaveUp")
    ?.addEventListener("click", () => changeNodeGraphMidiKeyboardOctave(1));
  renderNodeGraphMidiKeyboardSignal(null);
  renderNodeGraphMidiKeyboardOctaveControl();
  renderNodeGraphPerformanceWheels();
  renderNodeGraphMidiKeyboardInputControls();
}

function renderNodeGraphMidiKeyboardToggle() {
  ensureNodeGraphMidiKeyboardMemoryLoaded();
  const button = document.getElementById("nodeMidiKeyboardToggleButton");
  const dock = document.getElementById("nodeKeyboardPerformanceDock");
  const panel = document.getElementById("nodeMidiKeyboardPanel");
  const workspace = document.getElementById("nodeGraphWorkspace");
  const workspaceAvailable = Boolean(workspace && !workspace.hidden);
  const visible = Boolean(nodeGraphMvp.midiKeyboardVisible) && workspaceAvailable;
  if (dock) {
    dock.hidden = !visible;
  }
  if (panel) {
    panel.hidden = !visible;
  }
  if (button) {
    button.innerHTML = visible
      ? "<span>Hide</span><span>Keyboard</span>"
      : "<span>Show</span><span>Keyboard</span>";
    button.setAttribute("aria-label", visible ? "Hide Keyboard" : "Show Keyboard");
    button.setAttribute("aria-pressed", visible ? "true" : "false");
    button.removeAttribute("aria-disabled");
    button.removeAttribute("title");
  }
  bindNodeGraphMidiKeyboardPanelEvents();
}

function toggleNodeGraphMidiKeyboard() {
  nodeGraphMvp.midiKeyboardVisible = !nodeGraphMvp.midiKeyboardVisible;
  saveNodeGraphMidiKeyboardMemory();
  renderNodeGraphMidiKeyboardToggle();
  setNodeInteractionHelp(nodeGraphMvp.midiKeyboardVisible ? "Keyboard shown." : "Keyboard hidden.");
}

function toggleNodeGraphVideoView() {
  nodeGraphMvp.videoViewVisible = !nodeGraphMvp.videoViewVisible;
  renderNodeGraphVideoViewToggle();
  setNodeInteractionHelp(nodeGraphMvp.videoViewVisible ? "Camera view shown." : "Camera view hidden.");
}

function toggleNodeGraphMacroControls() {
  nodeGraphMvp.macroControlsVisible = !nodeGraphMvp.macroControlsVisible;
  renderNodeGraphMacroControls();
  setNodeInteractionHelp(nodeGraphMvp.macroControlsVisible ? "Macro controls shown." : "Macro controls hidden.");
}

function toggleNodeGraphGridVisibility() {
  nodeGraphMvp.gridVisible = !nodeGraphMvp.gridVisible;
  renderNodeGraphGridToggle();
}

function toggleNodeGraphModuleButtonsVisibility() {
  setNodeGraphModuleButtonsVisibility(nodeGraphMvp.moduleButtonsVisible === false);
}

function toggleNodeGraphOscilloscopeVisibility() {
  nodeGraphMvp.moduleOscilloscopesVisible = nodeGraphMvp.moduleOscilloscopesVisible === false;
  renderNodeGraphModuleVisibilityToggles();
  if (nodeGraphMvp.moduleOscilloscopesVisible) {
    scheduleNodeGraphModuleScopeDraw();
  } else {
    if (typeof closeNodeScopeContextMenu === "function") {
      closeNodeScopeContextMenu();
    }
  }
  setNodeInteractionHelp(nodeGraphMvp.moduleOscilloscopesVisible ? "Oscilloscopes shown." : "Oscilloscopes hidden.");
}

function toggleNodeGraphModuleSlidersVisibility() {
  nodeGraphMvp.moduleSlidersVisible = nodeGraphMvp.moduleSlidersVisible === false;
  renderNodeGraphModuleVisibilityToggles();
  setNodeInteractionHelp(nodeGraphMvp.moduleSlidersVisible ? "Module sliders shown." : "Module sliders hidden.");
}

function toggleNodeGraphTooltipVisibility() {
  nodeGraphMvp.tooltipVisible = !nodeGraphMvp.tooltipVisible;
  renderNodeGraphTooltipToggle();
}

function toggleNodeGraphSliderAmount() {
  nodeGraphMvp.sliderAmountVisible = !nodeGraphMvp.sliderAmountVisible;
  renderNodeGraphSliderVisibilityToggles();
}

function toggleNodeGraphSliderPosition() {
  nodeGraphMvp.sliderPositionVisible = !nodeGraphMvp.sliderPositionVisible;
  renderNodeGraphSliderVisibilityToggles();
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

function handleNodeGraphMappingCellClick(event) {
  const cell = event.target.closest("[data-mapping-key][data-mapping-velocity]");
  if (!cell) {
    return;
  }
  const active = cell.getAttribute("aria-pressed") !== "true";
  cell.setAttribute("aria-pressed", String(active));
  cell.classList.toggle("active", active);
  const key = Number(cell.dataset.mappingKey);
  const velocity = Number(cell.dataset.mappingVelocity);
  const keyLabel = nodeGraphMidiKeyboardPitchLabel(key);
  const status = document.getElementById("nodeMappingStatus");
  if (status) {
    status.textContent = `${active ? "mapped" : "cleared"} key ${keyLabel} (${key}) velocity ${velocity}`;
  }
}

function renderNodeGraphMappingView() {
  const grid = document.getElementById("nodeMappingGrid");
  if (!grid) {
    return;
  }
  if (grid.dataset.rendered === "true") {
    return;
  }
  grid.dataset.rendered = "true";
  if (grid.dataset.bound !== "true") {
    grid.dataset.bound = "true";
    grid.addEventListener("click", handleNodeGraphMappingCellClick);
  }
  const fragment = document.createDocumentFragment();
  const corner = document.createElement("div");
  corner.className = "node-mapping-corner";
  corner.textContent = "velocity \\ key";
  fragment.append(corner);
  for (let key = 0; key < 128; key += 1) {
    const header = document.createElement("div");
    header.className = "node-mapping-col-header";
    header.title = `${nodeGraphMidiKeyboardPitchLabel(key)} / MIDI ${key}`;
    header.textContent = String(key);
    fragment.append(header);
  }
  for (let velocity = 127; velocity >= 0; velocity -= 1) {
    const rowHeader = document.createElement("div");
    rowHeader.className = "node-mapping-row-header";
    rowHeader.title = `Velocity ${velocity}`;
    rowHeader.textContent = String(velocity);
    fragment.append(rowHeader);
    for (let key = 0; key < 128; key += 1) {
      const cell = document.createElement("button");
      cell.className = "node-mapping-cell";
      cell.type = "button";
      cell.dataset.mappingKey = String(key);
      cell.dataset.mappingVelocity = String(velocity);
      cell.setAttribute("aria-label", `Map key ${nodeGraphMidiKeyboardPitchLabel(key)} MIDI ${key} at velocity ${velocity}`);
      cell.setAttribute("aria-pressed", "false");
      fragment.append(cell);
    }
  }
  grid.replaceChildren(fragment);
}

function setNodeGraphViewMode(mode) {
  if (mode !== "script") {
    flushNodeGraphScriptCommit();
  }
  const settingsMode = mode === "settings";
  const shopMode = mode === "shop";
  const departmentMode = shopMode && Boolean(nodeGraphMvp.moduleStoreDepartment);
  const shopLandingMode = shopMode && !departmentMode;
  const scriptMode = mode === "script";
  const codeMode = mode === "code";
  const uiMode = mode === "ui";
  const mappingMode = mode === "mapping";
  const modularOnlyMode = mode === "modular-only";
  const modularMode = modularOnlyMode || (!settingsMode && !shopMode && !scriptMode && !codeMode && !uiMode && !mappingMode);
  const workspaceMode = modularMode;
  if (!shopLandingMode) {
    closeNodeGraphModuleCollectionsMenu();
  }
  const wiringPanel = document.getElementById("nodeWiringPanel");
  wiringPanel?.classList.toggle("modular-only-view", modularOnlyMode);
  document.getElementById("nodeGraphWorkspace").hidden = !workspaceMode;
  document.getElementById("nodeModularOnlyBackButton").textContent = uiMode ? "×" : "←";
  document
    .getElementById("nodeModularOnlyBackButton")
    .setAttribute("aria-label", uiMode ? "Close UI view" : "Return to full modular view");
  document.getElementById("nodeModuleShopView").hidden = !shopLandingMode;
  document.getElementById("nodeModuleDepartmentView").hidden = !departmentMode;
  document.getElementById("nodeScriptView").hidden = !scriptMode;
  document.getElementById("nodeCodeScreenView").hidden = !codeMode;
  document.getElementById("nodeUiView").hidden = !uiMode;
  document.getElementById("nodeMappingView").hidden = !mappingMode;
  document.getElementById("nodeSettingsView").hidden = !settingsMode;
  renderNodeGraphMidiKeyboardToggle();
  renderNodeGraphMacroControls();
  renderNodeGraphVideoViewToggle();
  document.getElementById("nodeSettingsViewButton").classList.toggle("active", settingsMode);
  document.getElementById("nodeModularViewButton").classList.toggle("active", modularMode && !modularOnlyMode);
  document.getElementById("nodeModuleShopButton").classList.toggle("active", shopMode);
  document.getElementById("nodeModularOnlyViewButton").classList.toggle("active", modularOnlyMode);
  document.getElementById("nodeMappingViewButton").classList.toggle("active", mappingMode);
  document.getElementById("nodeCodeScreenViewButton").classList.toggle("active", codeMode);
  document.getElementById("nodeUiViewButton").classList.toggle("active", uiMode);
  document.getElementById("nodeSettingsScriptViewButton").classList.toggle("active", scriptMode);
  document.getElementById("nodeSettingsViewButton").setAttribute("aria-pressed", String(settingsMode));
  document.getElementById("nodeModularViewButton").setAttribute("aria-pressed", String(modularMode && !modularOnlyMode));
  document.getElementById("nodeModuleShopButton").setAttribute("aria-pressed", String(shopMode));
  document.getElementById("nodeModularOnlyViewButton").setAttribute("aria-pressed", String(modularOnlyMode));
  document.getElementById("nodeMappingViewButton").setAttribute("aria-pressed", String(mappingMode));
  document.getElementById("nodeCodeScreenViewButton").setAttribute("aria-pressed", String(codeMode));
  document.getElementById("nodeUiViewButton").setAttribute("aria-pressed", String(uiMode));
  document.getElementById("nodeSettingsScriptViewButton").setAttribute("aria-pressed", String(scriptMode));
  if (scriptMode) {
    syncNodeGraphScriptView();
  } else if (codeMode) {
    renderNodeGraphCodeScreen();
  } else if (uiMode) {
    renderNodeGraphUiView();
  } else if (settingsMode) {
    syncNodeGraphSettingsView();
    scheduleNodeSettingsHeaderTextFit();
  } else if (shopMode) {
    renderNodeGraphModuleStoreCatalog();
  } else if (mappingMode) {
    renderNodeGraphMappingView();
  } else {
    drawNodeGraphWires();
  }
  if (typeof renderNodeGraphCameraView === "function") {
    renderNodeGraphCameraView();
  }
}
