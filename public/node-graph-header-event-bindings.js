function bindNodeGraphHeaderControlEvents() {
  bindNodeGraphShaderScriptEvents();
  bindNodeGraphCodeScreenEvents();
  renderNodeGraphPatchTimingControls();
  const closeNodeGraphModuleBrowser = () => {
    nodeGraphMvp.sceneContextPoint = null;
    closeNodeGraphModuleCollectionsMenu();
    setNodeGraphViewMode("modular");
  };
  document.getElementById("nodeDeleteButton").addEventListener("click", deleteSelectedNodeGraphItem);
  document.getElementById("nodeUndoButton").addEventListener("click", undoNodeGraphPatch);
  document.getElementById("nodeRedoButton").addEventListener("click", redoNodeGraphPatch);
  document.getElementById("nodeVisibilityMenuButton").addEventListener("click", toggleNodeGraphVisibilityMenu);
  document.getElementById("nodeVisibilityMenuClose").addEventListener("click", () => setNodeGraphVisibilityMenuOpen(false));
  document.getElementById("nodeGridToggleButton").addEventListener("click", toggleNodeGraphGridVisibility);
  document.getElementById("nodeVideoViewButton").addEventListener("click", toggleNodeGraphVideoView);
  document.getElementById("nodeMappingViewButton").addEventListener("click", () => setNodeGraphViewMode("mapping"));
  document.getElementById("nodeMidiKeyboardToggleButton").addEventListener("click", toggleNodeGraphMidiKeyboard);
  document.getElementById("nodeMacroControlsToggleButton").addEventListener("click", toggleNodeGraphMacroControls);
  document.getElementById("nodeModuleButtonsToggleButton").addEventListener("click", toggleNodeGraphModuleButtonsVisibility);
  document.getElementById("nodeOscilloscopeToggleButton").addEventListener("click", toggleNodeGraphOscilloscopeVisibility);
  document.getElementById("nodeGlobalScopeMenuButton").addEventListener("click", toggleNodeGlobalScopeMenu);
  document.getElementById("nodeCopyViewportImageButton").addEventListener("click", copyNodeGraphViewportImageToClipboard);
  document.getElementById("nodeGlobalScopeCloseMenu").addEventListener("click", closeNodeGlobalScopeMenu);
  document.getElementById("nodeGlobalScopeDragHandle").addEventListener("pointerdown", beginNodeGlobalScopeMenuDrag);
  document
    .getElementById("nodeMasterScopeBackgroundColor")
    .addEventListener("input", (event) => setNodeGraphModuleScopeBackgroundColor(event.currentTarget.value));
  document
    .getElementById("nodeMasterScopeBurn")
    .addEventListener("input", handleNodeGraphModuleScopeBurnInput);
  document
    .getElementById("nodeMasterScopeBurn")
    .addEventListener("change", handleNodeGraphModuleScopeBurnInput);
  document
    .getElementById("nodeMasterScopeFps")
    .addEventListener("input", handleNodeGraphModuleScopeFramesPerSecondInput);
  document
    .getElementById("nodeMasterScopeFps")
    .addEventListener("change", handleNodeGraphModuleScopeFramesPerSecondInput);
  document
    .getElementById("nodeMasterScopeDotCore1Size")
    .addEventListener("input", (event) => setNodeGraphModuleScopeDotCore1Size(event.currentTarget.value));
  document
    .getElementById("nodeMasterScopeDotCore1Size")
    .addEventListener("change", (event) => setNodeGraphModuleScopeDotCore1Size(event.currentTarget.value));
  document
    .getElementById("nodeMasterScopeDotCore1Brightness")
    .addEventListener("input", (event) => setNodeGraphModuleScopeDotCore1Brightness(event.currentTarget.value));
  document
    .getElementById("nodeMasterScopeDotCore1Brightness")
    .addEventListener("change", (event) => setNodeGraphModuleScopeDotCore1Brightness(event.currentTarget.value));
  document
    .getElementById("nodeMasterScopeDotCore1Color")
    .addEventListener("input", (event) => setNodeGraphModuleScopeDotCore1Color(event.currentTarget.value));
  document
    .getElementById("nodeMasterScopeDotCore1Color")
    .addEventListener("change", (event) => setNodeGraphModuleScopeDotCore1Color(event.currentTarget.value));
  document
    .getElementById("nodeMasterScopeDotCore2Size")
    .addEventListener("input", (event) => setNodeGraphModuleScopeDotCore2Size(event.currentTarget.value));
  document
    .getElementById("nodeMasterScopeDotCore2Size")
    .addEventListener("change", (event) => setNodeGraphModuleScopeDotCore2Size(event.currentTarget.value));
  document
    .getElementById("nodeMasterScopeDotCore2Brightness")
    .addEventListener("input", (event) => setNodeGraphModuleScopeDotCore2Brightness(event.currentTarget.value));
  document
    .getElementById("nodeMasterScopeDotCore2Brightness")
    .addEventListener("change", (event) => setNodeGraphModuleScopeDotCore2Brightness(event.currentTarget.value));
  document
    .getElementById("nodeMasterScopeDotCore2Color")
    .addEventListener("input", (event) => setNodeGraphModuleScopeDotCore2Color(event.currentTarget.value));
  document
    .getElementById("nodeMasterScopeDotCore2Color")
    .addEventListener("change", (event) => setNodeGraphModuleScopeDotCore2Color(event.currentTarget.value));
  document
    .querySelectorAll("#nodeGlobalScopeMenu input[type='number'][data-global-scope-input]")
    .forEach((input) => {
      input.addEventListener("dblclick", beginNodeGraphScopeNumberEdit);
      input.addEventListener("pointerdown", beginNodeGraphScopeNumberDrag);
      input.addEventListener("lostpointercapture", endNodeGraphScopeNumberDrag);
    });
  document
    .getElementById("nodeMasterScopeLineThickness")
    .addEventListener("input", handleNodeGraphModuleScopeLineThicknessInput);
  document
    .getElementById("nodeMasterScopeLineThickness")
    .addEventListener("change", handleNodeGraphModuleScopeLineThicknessInput);
  document
    .getElementById("nodeMasterScopeDiscontinuitySkipSamples")
    .addEventListener("input", handleNodeGraphModuleScopeDiscontinuitySkipSamplesInput);
  document
    .getElementById("nodeMasterScopeDiscontinuitySkipSamples")
    .addEventListener("change", handleNodeGraphModuleScopeDiscontinuitySkipSamplesInput);
  document
    .getElementById("nodeMasterScopeOverdrawPoints")
    .addEventListener("input", handleNodeGraphModuleScopeOverdrawPointsInput);
  document
    .getElementById("nodeMasterScopeOverdrawPoints")
    .addEventListener("change", handleNodeGraphModuleScopeOverdrawPointsInput);
  document
    .getElementById("nodeSceneScopeTime")
    .addEventListener("change", handleNodeGraphSceneScopeNumericInput);
  document
    .getElementById("nodeSceneScopeTime")
    .addEventListener("keydown", handleNodeGraphSceneScopeNumericKeydown);
  document
    .getElementById("nodeSceneScopeTime")
    .addEventListener("dblclick", beginNodeGraphScopeNumberEdit);
  document
    .getElementById("nodeSceneScopeTime")
    .addEventListener("pointerdown", beginNodeGraphScopeNumberDrag);
  document
    .getElementById("nodeSceneScopeTime")
    .addEventListener("lostpointercapture", endNodeGraphScopeNumberDrag);
  document
    .getElementById("nodeSceneScopeSync")
    .addEventListener("click", handleNodeGraphSceneScopeControlClick);
  document
    .getElementById("nodeSceneScopeOscillatorTraceMode")
    .addEventListener("click", handleNodeGraphSceneScopeControlClick);
  document
    .getElementById("nodeSceneBlinkLightShape")
    .addEventListener("change", handleNodeGraphSceneScopeOptionInput);
  document.getElementById("nodeModuleSlidersToggleButton").addEventListener("click", toggleNodeGraphModuleSlidersVisibility);
  document.getElementById("nodeTooltipToggleButton").addEventListener("click", toggleNodeGraphTooltipVisibility);
  document.getElementById("nodeUserUiSettingsButton").addEventListener("click", toggleNodeUserUiSettings);
  document
    .getElementById("nodeUserUiSettingsSaveDefault")
    .addEventListener("click", handleSaveNodeUserUiSettingsDefaultClick);
  document.getElementById("nodeUserUiSettingsClose").addEventListener("click", () => setNodeUserUiSettingsVisible(false));
  document
    .getElementById("nodeUserUiSettingsDragHandle")
    .addEventListener("pointerdown", beginNodeUserUiSettingsDrag);
  document
    .getElementById("nodeUserUiSettingsHeading")
    .addEventListener("pointerdown", beginNodeUserUiSettingsDrag);
  document.getElementById("nodeSliderAmountToggleButton").addEventListener("click", toggleNodeGraphSliderAmount);
  document.getElementById("nodeSliderPositionToggleButton").addEventListener("click", toggleNodeGraphSliderPosition);
  document
    .getElementById("nodeZoomOutButton")
    .addEventListener("click", () => zoomNodeGraphBy(-nodeGraphZoomLimits.step));
  document
    .getElementById("nodeZoomResetButton")
    .addEventListener("click", handleNodeGraphZoomResetClick);
  document
    .getElementById("nodeZoomResetButton")
    .addEventListener("dblclick", beginNodeGraphZoomInput);
  document
    .getElementById("nodeZoomInButton")
    .addEventListener("click", () => zoomNodeGraphBy(nodeGraphZoomLimits.step));
  document
    .getElementById("nodeSettingsViewButton")
    .addEventListener("click", () => {
      const settingsVisible = !document.getElementById("nodeSettingsView").hidden;
      setNodeGraphViewMode(settingsVisible ? "modular" : "settings");
    });
  document
    .getElementById("nodeModularViewButton")
    .addEventListener("click", () => setNodeGraphViewMode("modular"));
  document
    .getElementById("nodeCodeScreenViewButton")
    .addEventListener("click", () => setNodeGraphViewMode("code"));
  document
    .getElementById("nodeUiViewButton")
    .addEventListener("click", () => setNodeGraphViewMode("ui"));
  document
    .getElementById("nodeModuleShopButton")
    .addEventListener("click", () => {
      const shopVisible =
        !document.getElementById("nodeModuleShopView").hidden ||
        !document.getElementById("nodeModuleDepartmentView").hidden;
      nodeGraphMvp.sceneContextPoint = null;
      setNodeGraphViewMode(shopVisible ? "modular" : "shop");
    });
  document
    .getElementById("nodeGraphEmptyModuleButton")
    .addEventListener("click", () => openNodeGraphModuleShop(null));
  document.getElementById("nodeModuleShopClose").addEventListener("click", closeNodeGraphModuleBrowser);
  document.getElementById("nodeModuleDepartmentClose").addEventListener("click", closeNodeGraphModuleBrowser);
  document
    .getElementById("nodeModuleDepartmentSearchShell")
    .addEventListener("contextmenu", openNodeGraphModuleCollectionsMenu);
  document
    .getElementById("nodeModuleCollectionsClose")
    .addEventListener("click", closeNodeGraphModuleCollectionsMenu);
  document.addEventListener("pointerdown", handleNodeGraphModuleCollectionsPointerDown);
  document
    .getElementById("nodeModularOnlyViewButton")
    .addEventListener("click", () => setNodeGraphViewMode("modular-only"));
  document
    .getElementById("nodeSnapGridViewButton")
    .addEventListener("click", handleNodeGraphSnapGridButtonClick);
  document
    .getElementById("nodeModularOnlyBackButton")
    .addEventListener("click", () => setNodeGraphViewMode("modular"));
  document
    .getElementById("nodeSettingsScriptViewButton")
    .addEventListener("click", () => setNodeGraphViewMode("script"));
  document.getElementById("nodePatchScript").addEventListener("input", handleNodePatchScriptInput);
  document.getElementById("copyNodeGraphScriptButton").addEventListener("click", copyNodeGraphScriptToClipboard);
  document.getElementById("downloadNodeGraphScriptButton").addEventListener("click", saveNodeGraphScript);
  document.getElementById("pasteNodeGraphScriptButton").addEventListener("click", pasteNodeGraphScriptFromClipboard);
  document.getElementById("updateDefaultPresetButton").addEventListener("click", handleUpdateDefaultNodeGraphPresetClick);
  document.getElementById("loadNodeGraphScriptButton").addEventListener("click", loadNodeGraphScript);
  document.getElementById("nodeSettingsSaveScriptButton").addEventListener("click", saveNodeGraphScript);
}
