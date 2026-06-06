function nodeGraphCanonicalPortForNode(node, port, io) {
  const patchNode = typeof node === "string" ? nodeGraphPatchNode(node) : node;
  const type = patchNode?.type || (typeof node === "string" ? nodeGraphPatchNodeType(node) : "");
  if (io === "input") {
    return nodeGraphCanonicalInputPort(type, port);
  }
  if (io === "output") {
    return nodeGraphCanonicalOutputPort(type, port);
  }
  return String(port || "").trim();
}

function nodeGraphPortSelector(node, port, io) {
  const canonicalPort = nodeGraphCanonicalPortForNode(node, port, io);
  return `.node-port.${io}[data-node="${CSS.escape(node)}"][data-port="${CSS.escape(canonicalPort)}"]`;
}

function nodeGraphModulationPortSelector(node, parameter) {
  return `.node-param-port.modulation-input[data-node="${CSS.escape(node)}"][data-param="${CSS.escape(parameter)}"]`;
}

function markNodeGraphPortConnected(node, port, io) {
  const canonicalPort = nodeGraphCanonicalPortForNode(node, port, io);
  nodeGraphZoomSurface()
    ?.querySelector(nodeGraphPortSelector(node, canonicalPort, io))
    ?.classList.add("connected-port");
}

function markNodeGraphModulationPortConnected(node, parameter) {
  nodeGraphZoomSurface()
    ?.querySelector(nodeGraphModulationPortSelector(node, parameter))
    ?.classList.add("connected-port");
}

function nodeGraphPortCenter(node, port, io) {
  const surface = nodeGraphZoomSurface();
  const canonicalPort = nodeGraphCanonicalPortForNode(node, port, io);
  const element = surface.querySelector(nodeGraphPortSelector(node, canonicalPort, io));
  return nodeGraphElementCenter(element, io);
}

function nodeGraphModulationPortCenter(node, parameter) {
  const surface = nodeGraphZoomSurface();
  const element = surface.querySelector(nodeGraphModulationPortSelector(node, parameter));
  return nodeGraphElementCenter(element, "modulation");
}

function nodeGraphElementCenter(element, io = null) {
  const surface = nodeGraphZoomSurface();
  if (!element) {
    return { x: 0, y: 0 };
  }

  const surfaceRect = surface.getBoundingClientRect();
  const zoom = nodeGraphZoom();
  const anchor = nodeGraphElementPatchPointClientCenter(element, io);
  return {
    x: (anchor.x - surfaceRect.left) / zoom,
    y: (anchor.y - surfaceRect.top) / zoom,
  };
}

function nodeGraphElementPatchPointClientCenter(element, io = null) {
  if (!element) {
    return { x: 0, y: 0 };
  }
  const rect = element.getBoundingClientRect();
  if (element.classList?.contains("node-param-port")) {
    return nodeGraphParameterPatchPointClientCenter(element, rect, io);
  }
  return nodeGraphCssPatchPointClientCenter(element, rect, io);
}

function nodeGraphCssPatchPointClientCenter(element, rect, io = null) {
  const style = getComputedStyle(element);
  const cssX = style.getPropertyValue("--node-patch-point-x").trim();
  const percentMatch = cssX.match(/^(-?\d+(?:\.\d+)?)%$/);
  const pixelMatch = cssX.match(/^(-?\d+(?:\.\d+)?)px$/);
  const fallbackRatio = io === "output"
    ? 1
    : io === "input" || io === "modulation"
      ? 0
      : 0.5;
  const xRatio = percentMatch
    ? Number(percentMatch[1]) / 100
    : fallbackRatio;
  return {
    x: pixelMatch
      ? rect.left + Number(pixelMatch[1])
      : rect.left + rect.width * Math.max(0, Math.min(1, Number.isFinite(xRatio) ? xRatio : 0.5)),
    y: rect.top + rect.height * 0.5,
  };
}

function nodeGraphParameterPatchPointClientCenter(element, rect, io = null) {
  const side = nodeGraphParameterPatchPointSide(element, io);
  const x = side === "right"
    ? rect.right
    : side === "left"
      ? rect.left
      : rect.left + rect.width * 0.5;
  return {
    x,
    y: rect.top + rect.height * 0.5,
  };
}

function nodeGraphParameterPatchPointSide(element, io = null) {
  if (element.classList.contains("parameter-output") || io === "output") {
    return "right";
  }
  if (element.classList.contains("modulation-input") || io === "modulation") {
    return "left";
  }
  return null;
}

function nodeGraphCssColor(property, fallback) {
  const workspace = document.getElementById("nodeGraphWorkspace");
  const value = workspace
    ? getComputedStyle(workspace).getPropertyValue(property).trim()
    : "";
  return value || fallback;
}

function nodeGraphPortWireColor(node, port, io) {
  const canonicalPort = nodeGraphCanonicalPortForNode(node, port, io);
  if (io === "input") {
    return nodeGraphCssColor("--node-input-fill", "#7fc7d9");
  }
  if (io === "modulation") {
    return nodeGraphCssColor("--node-mod-input-fill", "#b184ff");
  }
  if (nodeGraphParameterOutputPort(nodeGraphPatchNode(node) || nodeGraphPatchNodeType(node), canonicalPort)) {
    return nodeGraphCssColor("--node-param-output-fill", "#66e0a3");
  }
  return nodeGraphCssColor("--node-output-fill", "#e2a86d");
}
