const nodeGraphZoomLimits = Object.freeze({
  max: 6,
  min: 0.25,
  step: 0.08,
  wheelRatio: 1.12,
});

function applyNodeGraphWorkspaceView() {
  const workspace = document.getElementById("nodeGraphWorkspace");
  if (!workspace) {
    return;
  }

  workspace.style.setProperty("--node-grid-height", `${nodeGraphGridHeight()}px`);
  workspace.style.setProperty("--node-grid-size", `${nodeGraphGridSize()}px`);
  workspace.style.setProperty("--node-grid-width", `${nodeGraphGridWidth()}px`);
  const view = normalizeNodeGraphPatchView(nodeGraphMvp.patch.view);
  if (view.widthGu > 0) {
    workspace.style.width = nodeGraphWorkspaceWidthCss(view.widthGu * nodeGraphGridWidth());
  } else {
    workspace.style.removeProperty("width");
  }
  if (view.heightGu > 0) {
    workspace.style.height = nodeGraphWorkspaceHeightCss(view.heightGu * nodeGraphGridHeight());
    workspace.style.removeProperty("aspect-ratio");
  } else {
    workspace.style.removeProperty("height");
    workspace.style.removeProperty("aspect-ratio");
  }
  workspace.dataset.widthGu = String(view.widthGu);
  workspace.dataset.heightGu = String(view.heightGu);
}

function nodeGraphZoom() {
  return Number.isFinite(nodeGraphMvp.zoom) ? nodeGraphMvp.zoom : 1;
}

function nodeGraphZoomSurface() {
  return document.getElementById("nodeGraphZoomSurface");
}

function nodeGraphGraphRect() {
  const workspace = document.getElementById("nodeGraphWorkspace");
  const workspaceRect = workspace.getBoundingClientRect();
  const zoom = nodeGraphZoom();
  return {
    height: workspaceRect.height / zoom,
    width: workspaceRect.width / zoom,
  };
}

function nodeGraphClientPoint(event) {
  const surface = nodeGraphZoomSurface();
  const surfaceRect = surface.getBoundingClientRect();
  const zoom = nodeGraphZoom();
  return {
    x: (event.clientX - surfaceRect.left) / zoom,
    y: (event.clientY - surfaceRect.top) / zoom,
  };
}

function positionNodeGraphNode(node, point, options = {}) {
  const graphRect = nodeGraphGraphRect();
  const maxX = Math.max(0, graphRect.width - node.offsetWidth - 10);
  const maxY = Math.max(0, graphRect.height - node.offsetHeight - 10);
  const positionedPoint = options.snap === false ? point : snapNodeGraphPointToGrid(point);
  const x = options.clamp === false
    ? positionedPoint.x
    : Math.max(0, Math.min(maxX, positionedPoint.x));
  const y = options.clamp === false
    ? positionedPoint.y
    : Math.max(0, Math.min(maxY, positionedPoint.y));
  node.style.setProperty("--node-x", `${x}px`);
  node.style.setProperty("--node-y", `${y}px`);
}

function nodeGraphRectFromPoints(a, b) {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x, b.x);
  const bottom = Math.max(a.y, b.y);
  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  };
}

function nodeGraphNodeBounds(node) {
  const x = Number.parseFloat(node.style.getPropertyValue("--node-x")) || 0;
  const y = Number.parseFloat(node.style.getPropertyValue("--node-y")) || 0;
  return {
    bottom: y + node.offsetHeight,
    left: x,
    right: x + node.offsetWidth,
    top: y,
  };
}

function updateNodeGraphGridHeatmap() {
  const heatmap = document.getElementById("nodeGridHeatmap");
  const surface = nodeGraphZoomSurface();
  if (!heatmap || !surface) {
    return;
  }

  const visibleNodes = [...surface.querySelectorAll(".dsp-node:not(.removed):not([hidden])")];
  if (!visibleNodes.length) {
    heatmap.style.setProperty("--node-grid-heatmap", "none");
    heatmap.style.setProperty("--node-grid-heatmap-mask", "none");
    return;
  }

  const glowLayers = [];
  const maskLayers = [];
  const workspace = document.getElementById("nodeGraphWorkspace");
  const zoom = nodeGraphZoom();
  const pan = nodeGraphMvp.pan || { x: 0, y: 0 };
  heatmap.style.setProperty("--node-grid-heatmap-grid-position", `${Number(pan.x) || 0}px ${Number(pan.y) || 0}px`);
  heatmap.style.setProperty(
    "--node-grid-heatmap-grid-size",
    `${(nodeGraphGridWidth() * zoom).toFixed(2)}px ${(nodeGraphGridHeight() * zoom).toFixed(2)}px`,
  );
  const spread = Math.max(
    0.4,
    Math.min(
      2.2,
      (Number.parseFloat(getComputedStyle(workspace).getPropertyValue("--node-module-light-spread")) || 1),
    ),
  );
  for (const node of visibleNodes) {
    const bounds = nodeGraphNodeBounds(node);
    const centerX = (bounds.left + (bounds.right - bounds.left) / 2) * zoom + (Number(pan.x) || 0);
    const centerY = (bounds.top + (bounds.bottom - bounds.top) / 2) * zoom + (Number(pan.y) || 0);
    const radiusX = Math.max(nodeGraphGridWidth() * 5, (bounds.right - bounds.left) * 1.18) * spread * zoom;
    const radiusY = Math.max(nodeGraphGridHeight() * 5, (bounds.bottom - bounds.top) * 1.35) * spread * zoom;
    glowLayers.push(
      `radial-gradient(ellipse ${radiusX.toFixed(2)}px ${radiusY.toFixed(2)}px at ${centerX.toFixed(2)}px ${centerY.toFixed(2)}px, rgba(127, 199, 217, 0.18) 0%, rgba(127, 199, 217, 0.15) 18%, rgba(226, 168, 109, 0.1) 38%, rgba(226, 168, 109, 0.045) 62%, transparent 92%)`,
    );
    maskLayers.push(
      `radial-gradient(ellipse ${radiusX.toFixed(2)}px ${radiusY.toFixed(2)}px at ${centerX.toFixed(2)}px ${centerY.toFixed(2)}px, black 0%, rgb(0 0 0 / 0.95) 22%, rgb(0 0 0 / 0.72) 48%, rgb(0 0 0 / 0.28) 74%, transparent 94%)`,
    );
  }
  heatmap.style.setProperty("--node-grid-heatmap", glowLayers.join(", "));
  heatmap.style.setProperty("--node-grid-heatmap-mask", maskLayers.join(", "));
}

function nodeGraphRectsIntersect(a, b) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function applyNodeGraphZoom() {
  const workspace = document.getElementById("nodeGraphWorkspace");
  if (!workspace) {
    return;
  }
  workspace.style.setProperty("--node-graph-zoom", String(nodeGraphZoom()));
  workspace.dataset.zoom = nodeGraphZoom().toFixed(2);
  applyNodeGraphWorkspaceView();
  updateNodeGraphGridHeatmap();
  const zoomOutButton = document.getElementById("nodeZoomOutButton");
  const zoomResetButton = document.getElementById("nodeZoomResetButton");
  const zoomInButton = document.getElementById("nodeZoomInButton");
  if (zoomOutButton) {
    zoomOutButton.disabled = nodeGraphZoom() <= nodeGraphZoomLimits.min + 0.001;
  }
  if (zoomResetButton) {
    const zoomLabel = nodeGraphZoom().toFixed(2);
    zoomResetButton.textContent = zoomLabel;
    zoomResetButton.setAttribute("aria-label", `Current zoom ${zoomLabel}. Reset graph zoom to 1:1`);
    zoomResetButton.title = nodeGraphTooltipText("view.zoomReset", { zoom: zoomLabel });
  }
  if (zoomInButton) {
    zoomInButton.disabled = nodeGraphZoom() >= nodeGraphZoomLimits.max - 0.001;
  }
  drawNodeGraphWires();
}

function setNodeGraphZoom(nextZoom, anchor = null) {
  const workspace = document.getElementById("nodeGraphWorkspace");
  const workspaceRect = workspace?.getBoundingClientRect();
  const oldZoom = nodeGraphZoom();
  const oldPan = nodeGraphMvp.pan || { x: 0, y: 0 };
  const anchorPoint = workspaceRect
    ? (anchor || {
      x: workspaceRect.left + workspaceRect.width / 2,
      y: workspaceRect.top + workspaceRect.height / 2,
    })
    : null;
  const anchoredContentPoint = workspaceRect && anchorPoint
    ? {
      x: (anchorPoint.x - workspaceRect.left - (Number(oldPan.x) || 0)) / oldZoom,
      y: (anchorPoint.y - workspaceRect.top - (Number(oldPan.y) || 0)) / oldZoom,
    }
    : null;
  const zoom = Math.max(
    nodeGraphZoomLimits.min,
    Math.min(nodeGraphZoomLimits.max, Number(nextZoom) || 1),
  );
  if (Math.abs(zoom - oldZoom) < 0.001) {
    return;
  }
  nodeGraphMvp.zoom = zoom;
  const nextPan = workspaceRect && anchorPoint && anchoredContentPoint
    ? {
      x: anchorPoint.x - workspaceRect.left - anchoredContentPoint.x * zoom,
      y: anchorPoint.y - workspaceRect.top - anchoredContentPoint.y * zoom,
    }
    : oldPan;
  nodeGraphMvp.pan = {
    x: Number(nextPan.x) || 0,
    y: Number(nextPan.y) || 0,
  };
  applyNodeGraphZoom();
  applyNodeGraphPan();
}

function nodeGraphZoomByRatio(ratio) {
  const value = Number(ratio);
  return Number.isFinite(value) && value > 0
    ? nodeGraphZoom() * value
    : nodeGraphZoom();
}

function zoomNodeGraphBy(delta) {
  const ratio = delta > 0
    ? nodeGraphZoomLimits.wheelRatio
    : 1 / nodeGraphZoomLimits.wheelRatio;
  setNodeGraphZoom(nodeGraphZoomByRatio(ratio));
}

function zoomNodeGraphAt(delta, clientX, clientY) {
  const ratio = delta > 0
    ? nodeGraphZoomLimits.wheelRatio
    : 1 / nodeGraphZoomLimits.wheelRatio;
  setNodeGraphZoom(nodeGraphZoomByRatio(ratio), { x: clientX, y: clientY });
}

function handleNodeGraphWorkspaceWheel(event) {
  if (!event.deltaY) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  zoomNodeGraphAt(
    -Math.sign(event.deltaY),
    event.clientX,
    event.clientY,
  );
}

function beginNodeGraphSmoothZoomDrag(event) {
  const ctrlZoom = event.ctrlKey;
  const altZoom = event.altKey;
  if (
    event.button !== 1 ||
    (!ctrlZoom && !altZoom)
  ) {
    return;
  }

  const workspace = event.currentTarget;
  nodeGraphMvp.smoothZoomDragging = {
    anchor: { x: event.clientX, y: event.clientY },
    pointerId: event.pointerId,
    startClientY: event.clientY,
    startZoom: nodeGraphZoom(),
  };
  workspace.classList.add("smooth-zooming");
  workspace.setPointerCapture(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function dragNodeGraphSmoothZoom(event) {
  const drag = nodeGraphMvp.smoothZoomDragging;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }

  const deltaY = drag.startClientY - event.clientY;
  const ratio = Math.exp(deltaY * 0.0045);
  setNodeGraphZoom(drag.startZoom * ratio, drag.anchor);
  event.preventDefault();
  event.stopPropagation();
}

function endNodeGraphSmoothZoomDrag(event) {
  const drag = nodeGraphMvp.smoothZoomDragging;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }

  const workspace = document.getElementById("nodeGraphWorkspace");
  if (workspace?.hasPointerCapture?.(event.pointerId)) {
    workspace.releasePointerCapture(event.pointerId);
  }
  workspace?.classList.remove("smooth-zooming");
  nodeGraphMvp.smoothZoomDragging = null;
  event.preventDefault();
  event.stopPropagation();
}

function applyNodeGraphPan() {
  const workspace = document.getElementById("nodeGraphWorkspace");
  if (!workspace) {
    return;
  }
  const pan = nodeGraphMvp.pan || { x: 0, y: 0 };
  workspace.style.setProperty("--node-graph-pan-x", `${pan.x}px`);
  workspace.style.setProperty("--node-graph-pan-y", `${pan.y}px`);
  workspace.dataset.panX = String(Math.round(pan.x));
  workspace.dataset.panY = String(Math.round(pan.y));
  updateNodeGraphGridHeatmap();
  drawNodeGraphWires();
}

function setNodeGraphPan(x, y) {
  nodeGraphMvp.pan = {
    x: Number.isFinite(Number(x)) ? Number(x) : 0,
    y: Number.isFinite(Number(y)) ? Number(y) : 0,
  };
  applyNodeGraphPan();
}

function snapNodeGraphWorkspaceEdgesToGrid(zoom = nodeGraphZoom()) {
  const workspace = document.getElementById("nodeGraphWorkspace");
  if (!workspace) {
    return;
  }
  const rect = workspace.getBoundingClientRect();
  const chromeWidth = nodeGraphWorkspaceChromeSize("x");
  const chromeHeight = nodeGraphWorkspaceChromeSize("y");
  const contentWidth = Math.max(0, rect.width - chromeWidth);
  const contentHeight = Math.max(0, rect.height - chromeHeight);
  const renderedGridWidth = nodeGraphGridWidth() * zoom;
  const renderedGridHeight = nodeGraphGridHeight() * zoom;
  const snapContentSize = (value, step, minGridUnits) => {
    if (!Number.isFinite(step) || step <= 0) {
      return value;
    }
    const min = step * minGridUnits;
    return Math.max(min, Math.round(value / step) * step);
  };
  const snappedContentWidth = snapContentSize(
    contentWidth,
    renderedGridWidth,
    nodeGraphWorkspaceViewLimits.minWidthGu,
  );
  const snappedContentHeight = snapContentSize(
    contentHeight,
    renderedGridHeight,
    nodeGraphWorkspaceViewLimits.minHeightGu,
  );
  withNodeGraphWorkspaceContentAnchored(workspace, () => {
    const widthCss = nodeGraphWorkspaceWidthCss(snappedContentWidth);
    const heightCss = nodeGraphWorkspaceHeightCss(snappedContentHeight);
    if (document.getElementById("nodeWiringPanel")?.classList.contains("modular-only-view")) {
      workspace.style.setProperty("--node-modular-only-view-width", widthCss);
      workspace.style.setProperty("--node-modular-only-view-height", heightCss);
    } else {
      workspace.style.width = widthCss;
      workspace.style.height = heightCss;
      workspace.style.removeProperty("aspect-ratio");
    }
  });
  drawNodeGraphWires();
}

function snapNodeGraphPanValueToGrid(value, gridSize, zoom = nodeGraphZoom()) {
  const step = gridSize * zoom;
  return Number.isFinite(step) && step > 0
    ? Math.round((Number(value) || 0) / step) * step
    : Number(value) || 0;
}

function renderNodeGraphSnapGridButton() {
  const button = document.getElementById("nodeSnapGridViewButton");
  if (!button) {
    return;
  }
  const active = Boolean(nodeGraphMvp.snapGridWhilePanning);
  button.classList.toggle("active", active);
  button.setAttribute("aria-pressed", String(active));
  button.title = nodeGraphTooltipText("view.snapGrid");
}

function alignNodeGraphViewToGridWithOptions(options = {}) {
  const workspace = document.getElementById("nodeGraphWorkspace");
  const rect = workspace?.getBoundingClientRect();
  const oldZoom = nodeGraphZoom();
  const oldPan = nodeGraphMvp.pan || { x: 0, y: 0 };
  const zoomStep = 1 / Math.max(1, nodeGraphGridSize());
  const nextZoom = Math.max(
    nodeGraphZoomLimits.min,
    Math.min(nodeGraphZoomLimits.max, Math.round(oldZoom / zoomStep) * zoomStep),
  );
  const anchor = rect
    ? {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
    : null;
  const anchoredContentPoint = rect && anchor
    ? {
      x: (anchor.x - rect.left - (Number(oldPan.x) || 0)) / oldZoom,
      y: (anchor.y - rect.top - (Number(oldPan.y) || 0)) / oldZoom,
    }
    : null;
  nodeGraphMvp.zoom = nextZoom;
  applyNodeGraphZoom();
  if (options.snapWorkspaceEdges) {
    snapNodeGraphWorkspaceEdgesToGrid(nextZoom);
  }
  const nextRect = workspace?.getBoundingClientRect();
  const nextAnchor = nextRect
    ? {
      x: nextRect.left + nextRect.width / 2,
      y: nextRect.top + nextRect.height / 2,
    }
    : anchor;
  const unsnappedPan = nextRect && nextAnchor && anchoredContentPoint
    ? {
      x: nextAnchor.x - nextRect.left - anchoredContentPoint.x * nextZoom,
      y: nextAnchor.y - nextRect.top - anchoredContentPoint.y * nextZoom,
    }
    : oldPan;
  const snapPan = (value, gridSize) => snapNodeGraphPanValueToGrid(value, gridSize, nextZoom);
  nodeGraphMvp.pan = {
    x: snapPan(unsnappedPan.x, nodeGraphGridWidth()),
    y: snapPan(unsnappedPan.y, nodeGraphGridHeight()),
  };
  applyNodeGraphPan();
  setNodeInteractionHelp(options.snapWorkspaceEdges
    ? "View snapped to complete grid cells."
    : "View aligned to grid. Hotkey: Ctrl+Shift+G.");
}

function alignNodeGraphViewToGrid() {
  alignNodeGraphViewToGridWithOptions();
}

function snapNodeGraphViewToGrid() {
  alignNodeGraphViewToGridWithOptions({ snapWorkspaceEdges: true });
}

function handleNodeGraphSnapGridButtonClick(event) {
  if (event.shiftKey) {
    nodeGraphMvp.snapGridWhilePanning = !nodeGraphMvp.snapGridWhilePanning;
    renderNodeGraphSnapGridButton();
    setNodeInteractionHelp(nodeGraphMvp.snapGridWhilePanning
      ? "Grid snap while moving is on."
      : "Grid snap while moving is off.");
    return;
  }
  snapNodeGraphViewToGrid();
}

function nodeGraphWorkspaceCurrentGridSize() {
  const workspace = document.getElementById("nodeGraphWorkspace");
  const rect = workspace.getBoundingClientRect();
  const contentWidth = Math.max(0, rect.width - nodeGraphWorkspaceChromeSize("x"));
  const contentHeight = Math.max(0, rect.height - nodeGraphWorkspaceChromeSize("y"));
  return {
    heightGu: Math.max(
      nodeGraphWorkspaceViewLimits.minHeightGu,
      Math.round(contentHeight / nodeGraphGridHeight()),
    ),
    widthGu: Math.max(
      nodeGraphWorkspaceViewLimits.minWidthGu,
      Math.round(contentWidth / nodeGraphGridWidth()),
    ),
  };
}

function setNodeGraphWorkspacePreviewSize(widthGu, heightGu) {
  const workspace = document.getElementById("nodeGraphWorkspace");
  withNodeGraphWorkspaceContentAnchored(workspace, () => {
    workspace.style.width = nodeGraphWorkspaceWidthCss(widthGu * nodeGraphGridWidth());
    workspace.style.height = nodeGraphWorkspaceHeightCss(heightGu * nodeGraphGridHeight());
    workspace.style.removeProperty("aspect-ratio");
  });
  workspace.dataset.widthGu = String(widthGu);
  workspace.dataset.heightGu = String(heightGu);
  drawNodeGraphWires();
}

function beginNodeGraphWorkspaceResize(event) {
  if (event.button !== 0) {
    return;
  }
  if (!nodeGraphScriptReadyForGraphAction("resize workspace")) {
    return;
  }
  const workspace = document.getElementById("nodeGraphWorkspace");
  const startSize = nodeGraphWorkspaceCurrentGridSize();
  nodeGraphMvp.workspaceResizing = {
    heightGu: startSize.heightGu,
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startHeightGu: startSize.heightGu,
    startWidthGu: startSize.widthGu,
    widthGu: startSize.widthGu,
  };
  workspace.classList.add("resizing");
  event.currentTarget.setPointerCapture(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function dragNodeGraphWorkspaceResize(event) {
  const drag = nodeGraphMvp.workspaceResizing;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }
  const widthGu = Math.max(
    nodeGraphWorkspaceViewLimits.minWidthGu,
    drag.startWidthGu + Math.round((event.clientX - drag.startClientX) / nodeGraphGridWidth()) * 2,
  );
  const heightGu = Math.max(
    nodeGraphWorkspaceViewLimits.minHeightGu,
    drag.startHeightGu + Math.round((event.clientY - drag.startClientY) / nodeGraphGridHeight()),
  );
  if (widthGu === drag.widthGu && heightGu === drag.heightGu) {
    return;
  }
  drag.widthGu = widthGu;
  drag.heightGu = heightGu;
  setNodeGraphWorkspacePreviewSize(widthGu, heightGu);
}

function endNodeGraphWorkspaceResize(event) {
  const drag = nodeGraphMvp.workspaceResizing;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }
  const handle = document.getElementById("nodeGraphResizeHandle");
  if (handle?.hasPointerCapture?.(event.pointerId)) {
    handle.releasePointerCapture(event.pointerId);
  }
  document.getElementById("nodeGraphWorkspace")?.classList.remove("resizing");
  nodeGraphMvp.workspaceResizing = null;
  if (drag.widthGu === drag.startWidthGu && drag.heightGu === drag.startHeightGu) {
    applyNodeGraphWorkspaceView();
    return;
  }
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  patch.view = {
    heightGu: drag.heightGu,
    widthGu: drag.widthGu,
  };
  commitNodeGraphPatch(patch, {
    markPending: false,
    status: "workspace resized",
  });
}

function handleNodeGraphWindowResize() {
  applyNodeGraphWorkspaceView();
  drawNodeGraphWires();
}

function beginNodeGraphWorkspacePan(event) {
  if (event.button !== 1 || event.ctrlKey || event.altKey) {
    return;
  }

  const workspace = document.getElementById("nodeGraphWorkspace");
  const pan = nodeGraphMvp.pan || { x: 0, y: 0 };
  nodeGraphMvp.workspacePanning = {
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startPanX: pan.x,
    startPanY: pan.y,
  };
  workspace.classList.add("panning");
  workspace.setPointerCapture(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function dragNodeGraphWorkspacePan(event) {
  const drag = nodeGraphMvp.workspacePanning;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }

  const nextX = drag.startPanX + event.clientX - drag.startClientX;
  const nextY = drag.startPanY + event.clientY - drag.startClientY;
  setNodeGraphPan(
    nodeGraphMvp.snapGridWhilePanning
      ? snapNodeGraphPanValueToGrid(nextX, nodeGraphGridWidth())
      : nextX,
    nodeGraphMvp.snapGridWhilePanning
      ? snapNodeGraphPanValueToGrid(nextY, nodeGraphGridHeight())
      : nextY,
  );
  event.preventDefault();
  event.stopPropagation();
}

function endNodeGraphWorkspacePan(event) {
  const drag = nodeGraphMvp.workspacePanning;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }

  const workspace = document.getElementById("nodeGraphWorkspace");
  if (workspace?.hasPointerCapture?.(event.pointerId)) {
    workspace.releasePointerCapture(event.pointerId);
  }
  workspace?.classList.remove("panning");
  nodeGraphMvp.workspacePanning = null;
  drawNodeGraphWires();
  event.preventDefault();
  event.stopPropagation();
}

function preventNodeGraphMiddleMouseAuxClick(event) {
  if (event.button === 1 && event.target.closest("#nodeGraphWorkspace")) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function preventNodeGraphMiddleMouseDefault(event) {
  if (event.button === 1 && event.target.closest("#nodeGraphWorkspace")) {
    event.preventDefault();
  }
}
