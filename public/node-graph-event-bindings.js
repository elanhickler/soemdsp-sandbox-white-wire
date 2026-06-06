async function bindNodeGraphMvpEvents() {
  bindNodeGraphHelpAndPaletteEvents();
  bindNodeGraphWorkspaceInteractionEvents();
  document.addEventListener("keydown", handleNodeGraphKeydown);
  bindNodeGraphRenderLiveControlEvents();
  bindNodeGraphHeaderControlEvents();
  bindNodeGraphUiViewEvents();
  await bindNodeGraphUiDevSettingsEvents();
  bindNodeGraphSettingsFormEvents();
  bindNodeGraphSceneMenuEvents();
  bindNodeGraphSliderDragEvents();
}
