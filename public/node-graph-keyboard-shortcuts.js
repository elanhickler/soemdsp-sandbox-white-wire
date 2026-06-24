function nodeGraphEventTargetIsEditable(target) {
  return target instanceof Element &&
    Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function nudgeSelectedNodeGraphModulesOnGrid(axis, direction) {
  const selectedNodeIds = new Set([...nodeGraphSelectedNodeIds()].filter((id) =>
    nodeGraphMvp.activeNodes.has(id),
  ));
  if (!selectedNodeIds.size) {
    return false;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  let movedCount = 0;
  for (const patchNode of patch.nodes) {
    if (!selectedNodeIds.has(patchNode.id)) {
      continue;
    }
    const gridKey = axis === "x" ? "gx" : "gy";
    const gridValue = Number(patchNode[gridKey]);
    patchNode[gridKey] = (Number.isFinite(gridValue) ? gridValue : 0) + direction;
    movedCount += 1;
  }
  if (!movedCount) {
    return false;
  }

  commitNodeGraphPatch(patch, {
    status: movedCount === 1 ? "module moved" : "modules moved",
  });
  return true;
}

function nodeGraphCanvasScriptSourceWithGridUnits(source, widthGu, heightGu) {
  const nextWidthGu = normalizeNodeGraphModuleWidthUnits("canvas", widthGu);
  const nextHeightGu = normalizeNodeGraphModuleHeightUnits("canvas", heightGu);
  const gridLine = `canvas.grid(${nextWidthGu}, ${nextHeightGu});`;
  const baseSource = String(source || nodeGraphCanvasScriptDefaultSource || "").trim();
  const gridPattern = /(^|\n)\s*canvas\.grid\s*\(\s*[-+]?\d+(?:\.\d+)?\s*,\s*[-+]?\d+(?:\.\d+)?\s*\)\s*;?/i;
  if (gridPattern.test(baseSource)) {
    return baseSource.replace(gridPattern, (match, prefix) => `${prefix}${gridLine}`);
  }
  return `${gridLine}\n${baseSource}`;
}

function resizeNodeGraphCanvasModuleOnGrid(patchNode, delta) {
  const canvasScript = normalizeNodeGraphCanvasScript(patchNode.canvasScript);
  const currentWidthGu = nodeGraphPatchNodeGridWidthUnits(patchNode);
  const currentHeightGu = nodeGraphPatchNodeGridHeightUnits(patchNode);
  const nextWidthGu = normalizeNodeGraphModuleWidthUnits("canvas", currentWidthGu + delta);
  if (nextWidthGu === currentWidthGu) {
    return false;
  }
  const source = nodeGraphCanvasScriptSourceWithGridUnits(canvasScript.source, nextWidthGu, currentHeightGu);
  patchNode.canvasScript = normalizeNodeGraphCanvasScript({ ...canvasScript, source });
  delete patchNode.widthGu;
  delete patchNode.heightGu;
  return true;
}

function resizeSelectedNodeGraphModulesOnGrid(axis, delta) {
  const selectedNodeIds = new Set([...nodeGraphSelectedNodeIds()].filter((id) =>
    nodeGraphMvp.activeNodes.has(id),
  ));
  if (!selectedNodeIds.size) {
    return false;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  let changedCount = 0;
  for (const patchNode of patch.nodes) {
    if (!selectedNodeIds.has(patchNode.id)) {
      continue;
    }

    if (patchNode.type === "canvas") {
      if (axis === "width" && resizeNodeGraphCanvasModuleOnGrid(patchNode, delta)) {
        changedCount += 1;
      }
      continue;
    }

    if (axis === "width") {
      const currentWidthGu = nodeGraphPatchNodeGridWidthUnits(patchNode);
      const nextWidthGu = normalizeNodeGraphModuleWidthUnits(patchNode.type, currentWidthGu + delta);
      if (nextWidthGu === currentWidthGu) {
        continue;
      }
      if (nextWidthGu === nodeGraphDefaultModuleGridWidthUnits(patchNode.type)) {
        delete patchNode.widthGu;
      } else {
        patchNode.widthGu = nextWidthGu;
      }
      changedCount += 1;
      continue;
    }

    continue;
  }

  if (!changedCount) {
    return false;
  }
  commitNodeGraphPatch(patch, {
    status: "module width changed",
  });
  configureNodeSceneContextMenu("module");
  return true;
}

function handleNodeGraphKeydown(event) {
  if (handleNodeGraphFloatingWindowKeyboardNudge(event)) {
    return;
  }
  if (event.key === "Escape" && nodeGraphWireInteractions?.cancelManualTrace?.()) {
    event.preventDefault();
    return;
  }
  if (event.key === "Escape" && document.getElementById("nodeWiringPanel")?.classList.contains("modular-only-view")) {
    setNodeGraphViewMode("modular");
    return;
  }
  if (nodeGraphEventTargetIsEditable(event.target)) {
    return;
  }
  if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.code === "Space") {
    event.preventDefault();
    if (typeof toggleNodeGraphLiveOutput === "function") {
      toggleNodeGraphLiveOutput();
    }
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
    event.preventDefault();
    undoNodeGraphPatch();
    return;
  }
  if (
    (event.ctrlKey || event.metaKey) &&
    (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"))
  ) {
    event.preventDefault();
    redoNodeGraphPatch();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "g") {
    event.preventDefault();
    alignNodeGraphViewToGrid();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
    event.preventDefault();
    selectAllNodeGraphModules();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
    if (copySelectedNodeGraphModule()) {
      event.preventDefault();
    }
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
    if (duplicateFocusedNodeGraphGraphNode()) {
      event.preventDefault();
    }
    return;
  }
  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === "a") {
    if (addFocusedNodeGraphGraphNode()) {
      event.preventDefault();
    }
    return;
  }
  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === "s") {
    if (cycleFocusedNodeGraphGraphShape()) {
      event.preventDefault();
    }
    return;
  }
  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key === "[") {
    if (selectFocusedNodeGraphGraphNodeOffset(-1)) {
      event.preventDefault();
    }
    return;
  }
  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key === "]") {
    if (selectFocusedNodeGraphGraphNodeOffset(1)) {
      event.preventDefault();
    }
    return;
  }
  if (nudgeFocusedNodeGraphGraphNode(event)) {
    event.preventDefault();
    return;
  }
  if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const shiftArrowSizeActions = {
      ArrowLeft: ["width", -1],
      ArrowRight: ["width", 1],
    };
    const action = shiftArrowSizeActions[event.key];
    if (action) {
      if (resizeSelectedNodeGraphModulesOnGrid(action[0], action[1])) {
        event.preventDefault();
      }
      return;
    }
  }
  if (!event.ctrlKey && !event.metaKey && !event.altKey) {
    const arrowMoveActions = {
      ArrowDown: ["y", 1],
      ArrowLeft: ["x", -1],
      ArrowRight: ["x", 1],
      ArrowUp: ["y", -1],
    };
    const action = arrowMoveActions[event.key];
    if (action) {
      if (nudgeSelectedNodeGraphModulesOnGrid(action[0], action[1])) {
        event.preventDefault();
      }
      return;
    }
  }
  if (event.key !== "Delete" && event.key !== "Backspace") {
    return;
  }

  if (removeFocusedNodeGraphGraphNode()) {
    event.preventDefault();
    return;
  }
  if (nodeGraphSelectionCanDelete()) {
    event.preventDefault();
    deleteSelectedNodeGraphItem();
  }
}
