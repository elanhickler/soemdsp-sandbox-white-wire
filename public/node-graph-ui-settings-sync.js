function syncNodeUiDevNodeColorControls() {
  const workspace = document.getElementById("nodeGraphWorkspace");
  if (!workspace) {
    return;
  }
  for (const input of document.querySelectorAll("[data-node-color-var]")) {
    const property = input.dataset.nodeColorVar;
    if (!property?.startsWith("--")) {
      continue;
    }
    const fallback = input.getAttribute("value") || "#000000";
    const color = normalizeNodeUiDevColor(input.value, fallback);
    input.value = color;
    workspace.style.setProperty(property, color);
    const output = document.getElementById(`${input.id}Value`);
    if (output) {
      output.textContent = color;
    }
  }
}

function syncNodeUiDevSettingsHeaderControls() {
  const settingsView = document.getElementById("nodeSettingsView");
  const textSizeInput = document.getElementById("nodeUiDevSettingsHeaderTextSize");
  const textSizeValue = document.getElementById("nodeUiDevSettingsHeaderTextSizeValue");
  const uiDevTextSizeInput = document.getElementById("nodeUiDevButtonTextSize");
  const uiDevTextSizeValue = document.getElementById("nodeUiDevButtonTextSizeValue");
  const liveToggleTextSizeInput = document.getElementById("nodeUiDevLiveToggleTextSize");
  const liveToggleTextSizeValue = document.getElementById("nodeUiDevLiveToggleTextSizeValue");
  const modularHeaderButtonBackgroundInput = document.getElementById("nodeUiDevModularHeaderButtonBackground");
  const modularHeaderButtonBackgroundValue = document.getElementById("nodeUiDevModularHeaderButtonBackgroundValue");
  const tooltipTextSizeInput = document.getElementById("nodeUiDevTooltipTextSize");
  const tooltipTextSizeValue = document.getElementById("nodeUiDevTooltipTextSizeValue");
  const minimumGridBrightnessInput = document.getElementById("nodeUiDevMinimumGridBrightness");
  const minimumGridBrightnessValue = document.getElementById("nodeUiDevMinimumGridBrightnessValue");
  const moduleLightSpreadInput = document.getElementById("nodeUiDevModuleLightSpread");
  const moduleLightSpreadValue = document.getElementById("nodeUiDevModuleLightSpreadValue");
  const moduleGridInsetInput = document.getElementById("nodeUiDevModuleGridInset");
  const moduleGridInsetValue = document.getElementById("nodeUiDevModuleGridInsetValue");
  const moduleRoundnessInput = document.getElementById("nodeUiDevModuleRoundness");
  const moduleRoundnessValue = document.getElementById("nodeUiDevModuleRoundnessValue");
  const gridColorInput = document.getElementById("nodeUiDevGridColor");
  const gridColorValue = document.getElementById("nodeUiDevGridColorValue");
  const workspaceBackgroundColorInput = document.getElementById("nodeUiDevWorkspaceBackgroundColor");
  const workspaceBackgroundColorValue = document.getElementById("nodeUiDevWorkspaceBackgroundColorValue");
  const topRatioInput = document.getElementById("nodeUiDevSettingsHeaderTopRatio");
  const topRatioValue = document.getElementById("nodeUiDevSettingsHeaderTopRatioValue");
  const paddingInput = document.getElementById("nodeUiDevSettingsHeaderPadding");
  const paddingValue = document.getElementById("nodeUiDevSettingsHeaderPaddingValue");
  const dotSizeInput = document.getElementById("nodeUiDevSliderDotSize");
  const dotSizeValue = document.getElementById("nodeUiDevSliderDotSizeValue");
  const dotPreview = document.getElementById("nodeUiDevSliderDotPreview");
  const moduleTitleFontInput = document.getElementById("nodeUiDevModuleTitleFont");
  const moduleTitleFontValue = document.getElementById("nodeUiDevModuleTitleFontValue");
  const moduleTitleHeightInput = document.getElementById("nodeUiDevModuleTitleHeight");
  const moduleTitleHeightValue = document.getElementById("nodeUiDevModuleTitleHeightValue");
  const moduleTitleTextFillInput = document.getElementById("nodeUiDevModuleTitleTextFill");
  const moduleTitleTextFillValue = document.getElementById("nodeUiDevModuleTitleTextFillValue");
  const moduleIoSectionHeightInput = document.getElementById("nodeUiDevModuleIoSectionHeight");
  const moduleIoSectionHeightValue = document.getElementById("nodeUiDevModuleIoSectionHeightValue");
  const moduleNodeSizeInput = document.getElementById("nodeUiDevModuleNodeSize");
  const moduleNodeSizeValue = document.getElementById("nodeUiDevModuleNodeSizeValue");
  const nodeGlowSizeInput = document.getElementById("nodeUiDevNodeGlowSize");
  const nodeGlowSizeValue = document.getElementById("nodeUiDevNodeGlowSizeValue");
  const wirePatchPointSizeInput = document.getElementById("nodeUiDevWirePatchPointSize");
  const wirePatchPointSizeValue = document.getElementById("nodeUiDevWirePatchPointSizeValue");
  const wireThicknessInput = document.getElementById("nodeUiDevWireThickness");
  const wireThicknessValue = document.getElementById("nodeUiDevWireThicknessValue");
  const choiceSlideEmptyBorderInput = document.getElementById("nodeUiDevChoiceSlideEmptyBorder");
  const choiceSlideEmptyBorderValue = document.getElementById("nodeUiDevChoiceSlideEmptyBorderValue");
  const choiceSlideEdgeBrightnessInput = document.getElementById("nodeUiDevChoiceSlideEdgeBrightness");
  const choiceSlideEdgeBrightnessValue = document.getElementById("nodeUiDevChoiceSlideEdgeBrightnessValue");
  const choiceSlideGlowLevelInput = document.getElementById("nodeUiDevChoiceSlideGlowLevel");
  const choiceSlideGlowLevelValue = document.getElementById("nodeUiDevChoiceSlideGlowLevelValue");
  const choiceSlideColorInput = document.getElementById("nodeUiDevChoiceSlideColor");
  const choiceSlideColorValue = document.getElementById("nodeUiDevChoiceSlideColorValue");
  const bypassIconSizeInput = document.getElementById("nodeUiDevBypassIconSize");
  const bypassIconSizeValue = document.getElementById("nodeUiDevBypassIconSizeValue");
  const bypassIconPreview = document.getElementById("nodeUiDevBypassIconPreview");
  const bypassIconGlowSpreadInput = document.getElementById("nodeUiDevBypassIconGlowSpread");
  const bypassIconGlowSpreadValue = document.getElementById("nodeUiDevBypassIconGlowSpreadValue");
  const bypassIconGlowColorInput = document.getElementById("nodeUiDevBypassIconGlowColor");
  const bypassIconGlowColorValue = document.getElementById("nodeUiDevBypassIconGlowColorValue");
  const bypassIconOnColorInput = document.getElementById("nodeUiDevBypassIconOnColor");
  const bypassIconOnColorValue = document.getElementById("nodeUiDevBypassIconOnColorValue");
  const bypassOnBackgroundColorInput = document.getElementById("nodeUiDevBypassOnBackgroundColor");
  const bypassOnBackgroundColorValue = document.getElementById("nodeUiDevBypassOnBackgroundColorValue");
  const bypassOffBackgroundColorInput = document.getElementById("nodeUiDevBypassOffBackgroundColor");
  const bypassOffBackgroundColorValue = document.getElementById("nodeUiDevBypassOffBackgroundColorValue");
  const moveSymbolSizeInput = document.getElementById("nodeUiDevMoveSymbolSize");
  const moveSymbolSizeValue = document.getElementById("nodeUiDevMoveSymbolSizeValue");
  const moveSymbolPreview = document.getElementById("nodeUiDevMoveSymbolPreview");
  const closeIconSizeInput = document.getElementById("nodeUiDevCloseIconSize");
  const closeIconSizeValue = document.getElementById("nodeUiDevCloseIconSizeValue");
  const closeIconPreview = document.getElementById("nodeUiDevCloseIconPreview");
  const highlightInput = document.getElementById("nodeUiDevSettingsHeaderHighlights");
  if (
    !settingsView ||
    !textSizeInput ||
    !textSizeValue ||
    !uiDevTextSizeInput ||
    !uiDevTextSizeValue ||
    !liveToggleTextSizeInput ||
    !liveToggleTextSizeValue ||
    !modularHeaderButtonBackgroundInput ||
    !modularHeaderButtonBackgroundValue ||
    !tooltipTextSizeInput ||
    !tooltipTextSizeValue ||
    !minimumGridBrightnessInput ||
    !minimumGridBrightnessValue ||
    !moduleLightSpreadInput ||
    !moduleLightSpreadValue ||
    !moduleGridInsetInput ||
    !moduleGridInsetValue ||
    !moduleRoundnessInput ||
    !moduleRoundnessValue ||
    !gridColorInput ||
    !gridColorValue ||
    !workspaceBackgroundColorInput ||
    !workspaceBackgroundColorValue ||
    !topRatioInput ||
    !topRatioValue ||
    !paddingInput ||
    !paddingValue ||
    !dotSizeInput ||
    !dotSizeValue ||
    !dotPreview ||
    !moduleTitleFontInput ||
    !moduleTitleFontValue ||
    !moduleTitleHeightInput ||
    !moduleTitleHeightValue ||
    !moduleTitleTextFillInput ||
    !moduleTitleTextFillValue ||
    !moduleIoSectionHeightInput ||
    !moduleIoSectionHeightValue ||
    !moduleNodeSizeInput ||
    !moduleNodeSizeValue ||
    !nodeGlowSizeInput ||
    !nodeGlowSizeValue ||
    !wirePatchPointSizeInput ||
    !wirePatchPointSizeValue ||
    !wireThicknessInput ||
    !wireThicknessValue ||
    !choiceSlideEmptyBorderInput ||
    !choiceSlideEmptyBorderValue ||
    !choiceSlideEdgeBrightnessInput ||
    !choiceSlideEdgeBrightnessValue ||
    !choiceSlideGlowLevelInput ||
    !choiceSlideGlowLevelValue ||
    !choiceSlideColorInput ||
    !choiceSlideColorValue ||
    !bypassIconSizeInput ||
    !bypassIconSizeValue ||
    !bypassIconPreview ||
    !bypassIconGlowSpreadInput ||
    !bypassIconGlowSpreadValue ||
    !bypassIconGlowColorInput ||
    !bypassIconGlowColorValue ||
    !bypassIconOnColorInput ||
    !bypassIconOnColorValue ||
    !bypassOnBackgroundColorInput ||
    !bypassOnBackgroundColorValue ||
    !bypassOffBackgroundColorInput ||
    !bypassOffBackgroundColorValue ||
    !moveSymbolSizeInput ||
    !moveSymbolSizeValue ||
    !moveSymbolPreview ||
    !closeIconSizeInput ||
    !closeIconSizeValue ||
    !closeIconPreview ||
    !highlightInput
  ) {
    return;
  }

  const textPercent = Math.max(0, Math.min(100, Number(textSizeInput.value) || 0));
  const uiDevTextPercent = Math.max(0, Math.min(100, Number(uiDevTextSizeInput.value) || 0));
  const liveToggleTextPercent = Math.max(0, Math.min(100, Number(liveToggleTextSizeInput.value) || 0));
  const modularHeaderButtonBackgroundPercent = Math.max(
    0,
    Math.min(100, Number(modularHeaderButtonBackgroundInput.value) || 0),
  );
  const tooltipTextSizePx = Math.max(8, Math.min(28, Number(tooltipTextSizeInput.value) || 14));
  const minimumGridBrightnessPercent = Math.max(
    0,
    Math.min(100, Number(minimumGridBrightnessInput.value) || 0),
  );
  const moduleLightSpreadPercent = Math.max(40, Math.min(220, Number(moduleLightSpreadInput.value) || 78));
  const moduleGridInsetPx = Math.max(0, Math.min(20, Number(moduleGridInsetInput.value) || 0));
  const moduleRoundnessPercent = Math.max(0, Math.min(100, Number(moduleRoundnessInput.value) || 0));
  const gridColor = normalizeNodeUiDevColor(gridColorInput.value, "#ffffff");
  const workspaceBackgroundColor = normalizeNodeUiDevColor(workspaceBackgroundColorInput.value, "#0d0d0d");
  const topPercent = Math.max(0, Math.min(100, Number(topRatioInput.value) || 0));
  const paddingPx = Math.max(0, Math.min(20, Number(paddingInput.value) || 0));
  const dotSizePx = Math.max(0, Math.min(28, Number(dotSizeInput.value) || 0));
  const moduleTitleFont = normalizeNodeUiDevControlValue(
    nodeUiDevSettingControls.find((definition) => definition.key === "moduleTitleFont"),
    moduleTitleFontInput.value,
  );
  const moduleTitleHeightPx = Math.max(12, Math.min(44, Number(moduleTitleHeightInput.value) || 26));
  const moduleTitleTextFillPercent = Math.max(0, Math.min(100, Number(moduleTitleTextFillInput.value) || 0));
  const moduleIoSectionHeightPx = Math.max(12, Math.min(44, Number(moduleIoSectionHeightInput.value) || 24));
  const moduleNodeSizePx = Math.max(8, Math.min(28, Number(moduleNodeSizeInput.value) || 16));
  const nodeGlowSizePercent = Math.max(0, Math.min(200, Number(nodeGlowSizeInput.value) || 0));
  const wirePatchPointSizePercent = Math.max(0, Math.min(200, Number(wirePatchPointSizeInput.value) || 0));
  const wireThicknessPercent = Math.max(0, Math.min(100, Number(wireThicknessInput.value) || 0));
  const choiceSlideEmptyBorderPx = Math.max(0, Math.min(8, Number(choiceSlideEmptyBorderInput.value) || 0));
  const choiceSlideEdgeBrightnessPercent = Math.max(
    0,
    Math.min(100, Number(choiceSlideEdgeBrightnessInput.value) || 0),
  );
  const choiceSlideGlowLevelPercent = Math.max(0, Math.min(100, Number(choiceSlideGlowLevelInput.value) || 0));
  const choiceSlideColor = normalizeNodeUiDevColor(choiceSlideColorInput.value, "#7fc7d9");
  const bypassIconSizePercent = Math.max(0, Math.min(100, Number(bypassIconSizeInput.value) || 0));
  const bypassIconGlowSpreadPercent = Math.max(
    0,
    Math.min(200, Number(bypassIconGlowSpreadInput.value) || 0),
  );
  const bypassIconGlowColor = normalizeNodeUiDevColor(bypassIconGlowColorInput.value, "#f25d5d");
  const bypassIconOnColor = normalizeNodeUiDevColor(bypassIconOnColorInput.value, "#f7b758");
  const bypassOnBackgroundColor = normalizeNodeUiDevColor(bypassOnBackgroundColorInput.value, "#5c1818");
  const bypassOffBackgroundColor = normalizeNodeUiDevColor(bypassOffBackgroundColorInput.value, "#000000");
  const moveSymbolSizePercent = Math.max(0, Math.min(100, Number(moveSymbolSizeInput.value) || 0));
  const closeIconSizePercent = Math.max(0, Math.min(100, Number(closeIconSizeInput.value) || 0));
  const moduleTitleHeightGu = moduleTitleHeightPx / nodeGraphGrid.heightPx;
  settingsView.style.setProperty("--node-settings-knob-text-ratio", String(textPercent / 100));
  settingsView.style.setProperty("--node-settings-knob-top-ratio", String(topPercent / 100));
  settingsView.style.setProperty("--node-settings-knob-extra-padding", `${paddingPx}px`);
  document
    .getElementById("nodeWiringPanel")
    ?.style.setProperty(
      "--node-toolbar-button-bg-alpha",
      String(modularHeaderButtonBackgroundPercent / 100),
    );
  document
    .getElementById("nodeWiringPanel")
    ?.style.setProperty("--node-tooltip-text-size", `${tooltipTextSizePx}px`);
  document
    .getElementById("nodeWiringPanel")
    ?.style.setProperty("--node-min-grid-brightness-alpha", String(minimumGridBrightnessPercent / 100));
  document
    .getElementById("nodeGraphWorkspace")
    ?.style.setProperty("--node-module-light-spread", String(moduleLightSpreadPercent / 100));
  document
    .getElementById("nodeGraphWorkspace")
    ?.style.setProperty("--node-module-grid-inset", `${moduleGridInsetPx}px`);
  document
    .getElementById("nodeGraphWorkspace")
    ?.style.setProperty("--node-module-roundness-ratio", String(moduleRoundnessPercent / 100));
  gridColorInput.value = gridColor;
  workspaceBackgroundColorInput.value = workspaceBackgroundColor;
  document
    .getElementById("nodeGraphWorkspace")
    ?.style.setProperty("--node-grid-color-rgb", nodeUiDevHexColorToRgbTriplet(gridColor));
  document
    .getElementById("nodeGraphWorkspace")
    ?.style.setProperty("--node-workspace-bg", workspaceBackgroundColor);
  document.body.style.setProperty("--node-slider-dot-size", `${dotSizePx}px`);
  document
    .getElementById("nodeGraphWorkspace")
    ?.style.setProperty(
      "--node-header-title-font-family",
      nodeUiDevSelectCssValue(
        nodeUiDevSettingControls.find((definition) => definition.key === "moduleTitleFont"),
        moduleTitleFont,
      ),
    );
  moduleTitleFontInput.value = moduleTitleFont;
  document
    .getElementById("nodeGraphWorkspace")
    ?.style.setProperty("--node-header-title-row-height", `calc(var(--node-grid-height) * ${moduleTitleHeightGu})`);
  document
    .getElementById("nodeGraphWorkspace")
    ?.style.setProperty("--node-header-title-text-ratio", String(moduleTitleTextFillPercent / 100));
  document
    .getElementById("nodeGraphWorkspace")
    ?.style.setProperty("--node-io-section-min-height", `${moduleIoSectionHeightPx}px`);
  document
    .getElementById("nodeGraphWorkspace")
    ?.style.setProperty("--node-port-diameter", `${moduleNodeSizePx}px`);
  document
    .getElementById("nodeGraphWorkspace")
    ?.style.setProperty("--node-hover-glow-size-ratio", String(nodeGlowSizePercent / 100));
  document
    .getElementById("nodeGraphWorkspace")
    ?.style.setProperty("--node-wire-patch-point-size-ratio", String(wirePatchPointSizePercent / 100));
  document
    .getElementById("nodeGraphWorkspace")
    ?.style.setProperty("--node-wire-thickness-ratio", String(wireThicknessPercent / 100));
  document
    .getElementById("nodeGraphWorkspace")
    ?.style.setProperty("--node-choice-slide-empty-border", `${choiceSlideEmptyBorderPx}`);
  document
    .getElementById("nodeGraphWorkspace")
    ?.style.setProperty("--node-choice-slide-edge-brightness", String(choiceSlideEdgeBrightnessPercent / 100));
  document
    .getElementById("nodeGraphWorkspace")
    ?.style.setProperty("--node-choice-slide-glow-level", String(choiceSlideGlowLevelPercent / 100));
  document
    .getElementById("nodeGraphWorkspace")
    ?.style.setProperty("--node-choice-slide-color", choiceSlideColor);
  document
    .getElementById("nodeGraphWorkspace")
    ?.style.setProperty("--node-bypass-icon-size-ratio", String(bypassIconSizePercent / 100));
  document
    .getElementById("nodeGraphWorkspace")
    ?.style.setProperty("--node-bypass-icon-glow-spread-ratio", String(bypassIconGlowSpreadPercent / 100));
  document
    .getElementById("nodeGraphWorkspace")
    ?.style.setProperty("--node-bypass-icon-glow-color", bypassIconGlowColor);
  document
    .getElementById("nodeGraphWorkspace")
    ?.style.setProperty("--node-bypass-icon-on-color", bypassIconOnColor);
  document
    .getElementById("nodeGraphWorkspace")
    ?.style.setProperty("--node-bypass-on-bg", bypassOnBackgroundColor);
  document
    .getElementById("nodeGraphWorkspace")
    ?.style.setProperty("--node-bypass-off-bg", bypassOffBackgroundColor);
  document.body.style.setProperty("--node-move-symbol-size-ratio", String(moveSymbolSizePercent / 100));
  document.body.style.setProperty("--panel-close-glyph-size-ratio", String(closeIconSizePercent / 100));
  textSizeValue.textContent = `${textPercent}%`;
  uiDevTextSizeValue.textContent = `${uiDevTextPercent}%`;
  liveToggleTextSizeValue.textContent = `${liveToggleTextPercent}%`;
  modularHeaderButtonBackgroundValue.textContent = `${modularHeaderButtonBackgroundPercent}%`;
  tooltipTextSizeValue.textContent = `${tooltipTextSizePx}px`;
  minimumGridBrightnessValue.textContent = `${minimumGridBrightnessPercent}%`;
  moduleLightSpreadValue.textContent = `${moduleLightSpreadPercent}%`;
  moduleGridInsetValue.textContent = `${moduleGridInsetPx}px`;
  moduleRoundnessValue.textContent = `${moduleRoundnessPercent}%`;
  gridColorValue.textContent = gridColor;
  workspaceBackgroundColorValue.textContent = workspaceBackgroundColor;
  topRatioValue.textContent = `${topPercent}%`;
  paddingValue.textContent = `${paddingPx}px`;
  dotSizeValue.textContent = `${dotSizePx}px`;
  moduleTitleFontValue.textContent = nodeUiDevSelectLabel(
    nodeUiDevSettingControls.find((definition) => definition.key === "moduleTitleFont"),
    moduleTitleFont,
  );
  moduleTitleHeightValue.textContent = `${moduleTitleHeightPx}px`;
  moduleTitleTextFillValue.textContent = `${moduleTitleTextFillPercent}%`;
  moduleIoSectionHeightValue.textContent = `${moduleIoSectionHeightPx}px`;
  moduleNodeSizeValue.textContent = `${moduleNodeSizePx}px`;
  nodeGlowSizeValue.textContent = `${nodeGlowSizePercent}%`;
  wirePatchPointSizeValue.textContent = `${wirePatchPointSizePercent}%`;
  wireThicknessValue.textContent = `${wireThicknessPercent}%`;
  choiceSlideEmptyBorderValue.textContent = `${choiceSlideEmptyBorderPx}px`;
  choiceSlideEdgeBrightnessValue.textContent = `${choiceSlideEdgeBrightnessPercent}%`;
  choiceSlideGlowLevelValue.textContent = `${choiceSlideGlowLevelPercent}%`;
  choiceSlideColorInput.value = choiceSlideColor;
  choiceSlideColorValue.textContent = choiceSlideColor;
  bypassIconSizeValue.textContent = `${bypassIconSizePercent}%`;
  bypassIconGlowSpreadValue.textContent = `${bypassIconGlowSpreadPercent}%`;
  bypassIconGlowColorInput.value = bypassIconGlowColor;
  bypassIconGlowColorValue.textContent = bypassIconGlowColor;
  bypassIconOnColorInput.value = bypassIconOnColor;
  bypassIconOnColorValue.textContent = bypassIconOnColor;
  bypassOnBackgroundColorInput.value = bypassOnBackgroundColor;
  bypassOnBackgroundColorValue.textContent = bypassOnBackgroundColor;
  bypassOffBackgroundColorInput.value = bypassOffBackgroundColor;
  bypassOffBackgroundColorValue.textContent = bypassOffBackgroundColor;
  moveSymbolSizeValue.textContent = `${moveSymbolSizePercent}%`;
  closeIconSizeValue.textContent = `${closeIconSizePercent}%`;
  dotPreview.style.setProperty("--node-slider-dot-size", `${dotSizePx}px`);
  bypassIconPreview.style.setProperty(
    "--node-ui-dev-symbol-preview-size",
    String(bypassIconSizePercent / 100),
  );
  bypassIconPreview.style.setProperty(
    "--node-ui-dev-bypass-preview-size",
    String(bypassIconSizePercent / 100),
  );
  bypassIconPreview.style.setProperty(
    "--node-ui-dev-bypass-preview-glow-spread",
    String(bypassIconGlowSpreadPercent / 100),
  );
  bypassIconPreview.style.setProperty("--node-ui-dev-bypass-preview-glow-color", bypassIconGlowColor);
  bypassIconPreview.style.setProperty("--node-ui-dev-bypass-preview-on-color", bypassIconOnColor);
  bypassIconPreview.style.setProperty("--node-ui-dev-bypass-preview-bg", bypassOnBackgroundColor);
  moveSymbolPreview.style.setProperty("--node-ui-dev-symbol-preview-size", String(moveSymbolSizePercent / 100));
  closeIconPreview.style.setProperty("--node-ui-dev-symbol-preview-size", String(closeIconSizePercent / 100));
  document
    .getElementById("nodeWiringPanel")
    ?.classList.toggle("settings-header-layout-debug", highlightInput.checked);
  syncNodeUiDevNodeColorControls();
  syncNodeUserUiSettingsMirrorControls();
  applyNodeGraphPatchToDom();
  updateNodeGraphGridHeatmap();
  drawNodeGraphWires();
  scheduleNodeSettingsHeaderTextFit();
  scheduleNodeLiveToggleTextFit();
}
