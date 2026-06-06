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

    const currentHeightGu = nodeGraphPatchNodeGridHeightUnits(patchNode);
    const nextHeightGu = normalizeNodeGraphModuleHeightUnits(
      patchNode.type,
      currentHeightGu + delta,
      patchNode.ui,
    );
    if (nextHeightGu === currentHeightGu) {
      continue;
    }
    if (nextHeightGu === nodeGraphModuleGridHeightUnitsForUi(patchNode.type, patchNode.ui)) {
      delete patchNode.heightGu;
    } else {
      patchNode.heightGu = nextHeightGu;
    }
    changedCount += 1;
  }

  if (!changedCount) {
    return false;
  }
  commitNodeGraphPatch(patch, {
    status: axis === "width" ? "module width changed" : "module height changed",
  });
  configureNodeSceneContextMenu("module");
  return true;
}

function handleNodeGraphKeydown(event) {
  if (event.key === "Escape" && nodeGraphWireInteractions?.cancelManualTrace?.()) {
    event.preventDefault();
    return;
  }
  if (event.key === "Escape" && document.getElementById("nodeWiringPanel")?.classList.contains("modular-only-view")) {
    setNodeGraphViewMode("modular");
    return;
  }
  if (event.key === "Escape" && !document.getElementById("nodeSceneContextMenu").hidden) {
    closeNodeSceneContextMenu();
    return;
  }
  if (nodeGraphEventTargetIsEditable(event.target)) {
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
  if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const shiftArrowSizeActions = {
      ArrowDown: ["height", 1],
      ArrowLeft: ["width", -1],
      ArrowRight: ["width", 1],
      ArrowUp: ["height", -1],
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
  deleteSelectedNodeGraphItem();
}
