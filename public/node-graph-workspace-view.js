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

function nodeGraphVisualControlValue(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number) || Math.abs(number) > 999999999) {
    return fallback;
  }
  return Math.max(0, Math.min(1, Math.abs(number)));
}

function nodeGraphVisualControlSignedValue(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number) || Math.abs(number) > 999999999) {
    return fallback;
  }
  return Math.max(-1, Math.min(1, number));
}

function nodeGraphVisualHslToRgb(hue, saturation, lightness) {
  const h = ((Number(hue) || 0) % 1 + 1) % 1;
  const s = Math.max(0, Math.min(1, Number(saturation) || 0));
  const l = Math.max(0, Math.min(1, Number(lightness) || 0));
  if (s <= 0) {
    return [l, l, l];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (offset) => {
    let t = h + offset;
    if (t < 0) {
      t += 1;
    }
    if (t > 1) {
      t -= 1;
    }
    if (t < 1 / 6) {
      return p + (q - p) * 6 * t;
    }
    if (t < 1 / 2) {
      return q;
    }
    if (t < 2 / 3) {
      return p + (q - p) * (2 / 3 - t) * 6;
    }
    return p;
  };
  return [channel(1 / 3), channel(0), channel(-1 / 3)];
}

function nodeGraphSetVisualControls(values = {}) {
  const current = nodeGraphMvp.visualControls || {};
  nodeGraphMvp.visualControls = {
    ...current,
    blue: nodeGraphVisualControlValue(values.blue, current.blue || 0),
    chromaAlpha: nodeGraphVisualControlValue(values.chromaAlpha, current.chromaAlpha || 0),
    chromaDrift: nodeGraphVisualControlValue(values.chromaDrift, current.chromaDrift || 0),
    chromaHue: nodeGraphVisualControlValue(values.chromaHue, current.chromaHue || 0),
    chromaLightness: nodeGraphVisualControlValue(values.chromaLightness, current.chromaLightness || 0),
    chromaSaturation: nodeGraphVisualControlValue(values.chromaSaturation, current.chromaSaturation || 0),
    chromaSpread: nodeGraphVisualControlValue(values.chromaSpread, current.chromaSpread || 0),
    green: nodeGraphVisualControlValue(values.green, current.green || 0),
    red: nodeGraphVisualControlValue(values.red, current.red || 0),
    scopePaused: nodeGraphVisualControlValue(values.scopePaused, current.scopePaused || 0),
    scopeTracesOff: nodeGraphVisualControlValue(values.scopeTracesOff, current.scopeTracesOff || 0),
    screenDim: nodeGraphVisualControlValue(values.screenDim, current.screenDim || 0),
    screenShake: nodeGraphVisualControlValue(values.screenShake, current.screenShake || 0),
    visualBloom: nodeGraphVisualControlValue(values.visualBloom, current.visualBloom || 0),
    visualBrightness: nodeGraphVisualControlValue(values.visualBrightness, current.visualBrightness || 0),
    visualGlow: nodeGraphVisualControlValue(values.visualGlow, current.visualGlow || 0),
    x: nodeGraphVisualControlSignedValue(values.x, current.x || 0),
    y: nodeGraphVisualControlSignedValue(values.y, current.y || 0),
  };
  if (
    nodeGraphMvp.visualControls.scopeTracesOff > 0.5 &&
    current.scopeTracesOff <= 0.5 &&
    typeof clearNodeGraphModuleScopeCanvas === "function"
  ) {
    clearNodeGraphModuleScopeCanvas();
  }
  if (
    nodeGraphMvp.visualControls.scopePaused <= 0.5 &&
    current.scopePaused > 0.5 &&
    typeof scheduleNodeGraphModuleScopeDraw === "function"
  ) {
    scheduleNodeGraphModuleScopeDraw();
  }
  nodeGraphScheduleVisualControlAnimation();
}

function nodeGraphClearVisualControls() {
  if (nodeGraphMvp.visualControlAnimationFrame) {
    window.cancelAnimationFrame(nodeGraphMvp.visualControlAnimationFrame);
  }
  nodeGraphMvp.visualControlAnimationFrame = 0;
  nodeGraphMvp.visualControls = {
    blue: 0,
    chromaAlpha: 0,
    chromaDrift: 0,
    chromaHue: 0,
    chromaLightness: 0,
    chromaSaturation: 0,
    chromaSpread: 0,
    green: 0,
    red: 0,
    scopePaused: 0,
    scopeTracesOff: 0,
    screenDim: 0,
    screenShake: 0,
    visualBloom: 0,
    visualBrightness: 0,
    visualGlow: 0,
    x: 0,
    y: 0,
  };
  nodeGraphMvp.visualControlState = {
    directX: 0,
    directY: 0,
    screenShakeX: 0,
    screenShakeY: 0,
  };
  const workspace = document.getElementById("nodeGraphWorkspace");
  workspace?.style.setProperty("--node-visual-shake-x", "0px");
  workspace?.style.setProperty("--node-visual-shake-y", "0px");
  workspace?.style.setProperty("--node-visual-bloom", "0");
  workspace?.style.setProperty("--node-visual-brightness", "0");
  workspace?.style.setProperty("--node-visual-glow", "0");
  workspace?.style.setProperty("--node-visual-wash-alpha", "0");
  workspace?.style.setProperty("--node-visual-wash-rgb", "0 0 0");
  if (workspace) {
    workspace.dataset.visualBloom = "0";
    workspace.dataset.visualBrightness = "0";
    workspace.dataset.visualChromaAlpha = "0";
    workspace.dataset.visualGlow = "0";
    workspace.dataset.visualScreenShake = "0";
    workspace.dataset.visualScreenDim = "0";
    workspace.dataset.visualScopePaused = "0";
  }
}

function nodeGraphScheduleVisualControlAnimation() {
  if (nodeGraphMvp.visualControlAnimationFrame) {
    return;
  }
  nodeGraphMvp.visualControlAnimationFrame = window.requestAnimationFrame(nodeGraphAnimateVisualControls);
}

function nodeGraphAnimateVisualControls(time = performance.now()) {
  nodeGraphMvp.visualControlAnimationFrame = 0;
  const workspace = document.getElementById("nodeGraphWorkspace");
  if (!workspace) {
    return;
  }
  const controls = nodeGraphMvp.visualControls || {};
  const screenShake = nodeGraphVisualControlValue(controls.screenShake, 0);
  const directX = nodeGraphVisualControlSignedValue(controls.x, 0) * 22;
  const directY = nodeGraphVisualControlSignedValue(controls.y, 0) * 22;
  const screenDim = nodeGraphVisualControlValue(controls.screenDim, 0);
  const red = nodeGraphVisualControlValue(controls.red, 0);
  const green = nodeGraphVisualControlValue(controls.green, 0);
  const blue = nodeGraphVisualControlValue(controls.blue, 0);
  const chromaAlpha = nodeGraphVisualControlValue(controls.chromaAlpha, 0);
  const chromaDrift = nodeGraphVisualControlValue(controls.chromaDrift, 0);
  const chromaHue = nodeGraphVisualControlValue(controls.chromaHue, 0);
  const chromaLightness = nodeGraphVisualControlValue(controls.chromaLightness, 0);
  const chromaSaturation = nodeGraphVisualControlValue(controls.chromaSaturation, 0);
  const chromaSpread = nodeGraphVisualControlValue(controls.chromaSpread, 0);
  const scopePaused = nodeGraphVisualControlValue(controls.scopePaused, 0);
  const scopeTracesOff = nodeGraphVisualControlValue(controls.scopeTracesOff, 0);
  const visualBloom = nodeGraphVisualControlValue(controls.visualBloom, 0);
  const visualBrightness = nodeGraphVisualControlValue(controls.visualBrightness, 0);
  const visualGlow = nodeGraphVisualControlValue(controls.visualGlow, 0);
  const amplitude = screenShake * screenShake * 22;
  let x = 0;
  let y = 0;
  if (amplitude > 0.001) {
    x = (
      Math.sin(time * 0.0217) +
      Math.sin(time * 0.0471 + 1.9) * 0.47 +
      Math.sin(time * 0.0833 + 4.1) * 0.22
    ) * amplitude;
    y = (
      Math.sin(time * 0.0189 + 2.7) +
      Math.sin(time * 0.0529 + 0.4) * 0.43 +
      Math.sin(time * 0.0777 + 3.2) * 0.24
    ) * amplitude;
  }
  const finalX = x + directX;
  const finalY = y + directY;
  nodeGraphMvp.visualControlState = {
    directX,
    directY,
    screenShakeX: x,
    screenShakeY: y,
  };
  workspace.style.setProperty("--node-visual-shake-x", `${finalX.toFixed(3)}px`);
  workspace.style.setProperty("--node-visual-shake-y", `${finalY.toFixed(3)}px`);
  workspace.style.setProperty("--node-visual-bloom", visualBloom.toFixed(4));
  workspace.style.setProperty("--node-visual-brightness", visualBrightness.toFixed(4));
  workspace.style.setProperty("--node-visual-glow", visualGlow.toFixed(4));
  const chromaMotion = (time * 0.000035 * chromaDrift) + (Math.sin(time * 0.0017) * chromaSpread * 0.08);
  const chromaRgb = nodeGraphVisualHslToRgb(
    chromaHue + chromaMotion,
    chromaSaturation,
    chromaLightness,
  );
  const colorMix = chromaAlpha;
  const washRed = red * (1 - colorMix) + chromaRgb[0] * colorMix;
  const washGreen = green * (1 - colorMix) + chromaRgb[1] * colorMix;
  const washBlue = blue * (1 - colorMix) + chromaRgb[2] * colorMix;
  const washAlpha = Math.max(screenDim, chromaAlpha);
  workspace.style.setProperty("--node-visual-wash-alpha", washAlpha.toFixed(4));
  workspace.style.setProperty(
    "--node-visual-wash-rgb",
    `${Math.round(washRed * 255)} ${Math.round(washGreen * 255)} ${Math.round(washBlue * 255)}`,
  );
  workspace.dataset.visualScreenShake = String(Number(screenShake.toFixed(4)));
  workspace.dataset.visualScreenDim = String(Number(washAlpha.toFixed(4)));
  workspace.dataset.visualBloom = String(Number(visualBloom.toFixed(4)));
  workspace.dataset.visualBrightness = String(Number(visualBrightness.toFixed(4)));
  workspace.dataset.visualChromaAlpha = String(Number(chromaAlpha.toFixed(4)));
  workspace.dataset.visualGlow = String(Number(visualGlow.toFixed(4)));
  workspace.dataset.visualScopePaused = String(Number(scopePaused.toFixed(4)));
  workspace.dataset.visualScopeTracesOff = String(Number(scopeTracesOff.toFixed(4)));
  if (screenShake > 0.0001 || visualBloom > 0.0001 || visualGlow > 0.0001 || chromaAlpha > 0.0001) {
    nodeGraphScheduleVisualControlAnimation();
  }
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
  button.removeAttribute("title");
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
  const zoom = nodeGraphZoom();
  const renderedGridWidth = nodeGraphGridWidth() * zoom;
  const renderedGridHeight = nodeGraphGridHeight() * zoom;
  const widthGu = Math.max(
    nodeGraphWorkspaceViewLimits.minWidthGu,
    drag.startWidthGu + Math.round((event.clientX - drag.startClientX) / renderedGridWidth) * 2,
  );
  const heightGu = Math.max(
    nodeGraphWorkspaceViewLimits.minHeightGu,
    drag.startHeightGu + Math.round((event.clientY - drag.startClientY) / renderedGridHeight),
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
  if (typeof syncNodeGraphSliderReadouts === "function") {
    syncNodeGraphSliderReadouts();
  }
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
