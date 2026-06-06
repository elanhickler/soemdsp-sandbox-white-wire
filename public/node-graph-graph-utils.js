const nodeGraphGraphShapes = Object.freeze(["linear", "smooth", "rational", "exponential", "hold"]);

const nodeGraphDefaultGraphData = Object.freeze({
  cursorX: 0.5,
  nodes: Object.freeze([
    Object.freeze({ c: 0, shape: "linear", x: 0, y: 0 }),
    Object.freeze({ c: 0, shape: "rational", x: 1, y: 1 }),
  ]),
});

const nodeGraphGraphPresets = Object.freeze({
  envelope: Object.freeze({
    cursorX: 0,
    nodes: Object.freeze([
      Object.freeze({ c: 0, shape: "linear", x: 0, y: 0 }),
      Object.freeze({ c: 0.45, shape: "exponential", x: 0.12, y: 1 }),
      Object.freeze({ c: -0.25, shape: "rational", x: 0.48, y: 0.48 }),
      Object.freeze({ c: 0.25, shape: "exponential", x: 0.82, y: 0.48 }),
      Object.freeze({ c: -0.35, shape: "exponential", x: 1, y: 0 }),
    ]),
  }),
  ramp: Object.freeze({
    cursorX: 0,
    nodes: Object.freeze([
      Object.freeze({ c: 0, shape: "linear", x: 0, y: 0 }),
      Object.freeze({ c: 0, shape: "linear", x: 1, y: 1 }),
    ]),
  }),
  steps: Object.freeze({
    cursorX: 0,
    nodes: Object.freeze([
      Object.freeze({ c: 0, shape: "linear", x: 0, y: 0.2 }),
      Object.freeze({ c: 0, shape: "hold", x: 0.25, y: 0.72 }),
      Object.freeze({ c: 0, shape: "hold", x: 0.5, y: 0.4 }),
      Object.freeze({ c: 0, shape: "hold", x: 0.75, y: 0.88 }),
      Object.freeze({ c: 0, shape: "hold", x: 1, y: 0.88 }),
    ]),
  }),
  triangle: Object.freeze({
    cursorX: 0,
    nodes: Object.freeze([
      Object.freeze({ c: 0, shape: "linear", x: 0, y: 0 }),
      Object.freeze({ c: 0, shape: "linear", x: 0.5, y: 1 }),
      Object.freeze({ c: 0, shape: "linear", x: 1, y: 0 }),
    ]),
  }),
});

function nodeGraphGraphPresetData(name) {
  return normalizeNodeGraphGraph(nodeGraphGraphPresets[String(name || "").trim()] || nodeGraphDefaultGraphData);
}

function nodeGraphGraphTransformedData(graphValue, transform) {
  const graph = normalizeNodeGraphGraph(graphValue);
  const type = String(transform || "").trim();
  if (type === "flipY") {
    return normalizeNodeGraphGraph({
      cursorX: graph.cursorX,
      nodes: graph.nodes.map((node) => ({
        ...node,
        y: 1 - node.y,
      })),
    });
  }
  if (type === "reverseX") {
    const nodes = graph.nodes.map((node, index) => {
      const segmentSource = graph.nodes[index + 1] || node;
      return {
        c: -normalizeNodeGraphGraphNumber(segmentSource.c, 0, -0.999, 0.999),
        shape: segmentSource.shape,
        x: 1 - node.x,
        y: node.y,
      };
    });
    return normalizeNodeGraphGraph({
      cursorX: 1 - graph.cursorX,
      nodes,
    });
  }
  return graph;
}

function duplicateNodeGraphGraphNodeData(graphValue, selectedIndex = 0) {
  const graph = normalizeNodeGraphGraph(graphValue);
  if (graph.nodes.length >= 32) {
    return { graph, duplicated: false, selectedIndex: nodeGraphGraphNodeIndexFromValue(graph, selectedIndex) };
  }
  const index = nodeGraphGraphNodeIndexFromValue(graph, selectedIndex);
  const sourceNode = graph.nodes[index] || graph.nodes.at(-1);
  const previousX = graph.nodes[Math.max(0, index - 1)]?.x ?? 0;
  const nextX = graph.nodes[Math.min(graph.nodes.length - 1, index + 1)]?.x ?? 1;
  const baseX = normalizeNodeGraphGraphNumber(sourceNode.x, 0.5);
  const offset = 0.025;
  const duplicateX = index >= graph.nodes.length - 1
    ? Math.max(previousX + 0.001, baseX - offset)
    : Math.min(nextX - 0.001, baseX + offset);
  const x = normalizeNodeGraphGraphNumber(duplicateX, baseX, 0.001, 0.999);
  graph.nodes.push({
    c: sourceNode.c,
    shape: sourceNode.shape,
    x,
    y: sourceNode.y,
  });
  const normalized = normalizeNodeGraphGraph(graph);
  const duplicateIndex = normalized.nodes.reduce((bestIndex, node, nodeIndex) => {
    const best = normalized.nodes[bestIndex];
    return Math.abs(node.x - x) < Math.abs(best.x - x) ? nodeIndex : bestIndex;
  }, 0);
  return {
    duplicated: true,
    graph: normalized,
    selectedIndex: duplicateIndex,
    selectedX: x,
  };
}

function cycleNodeGraphGraphShapeData(graphValue, selectedIndex = 1) {
  const graph = normalizeNodeGraphGraph(graphValue);
  const index = nodeGraphGraphNodeIndexFromValue(
    graph,
    selectedIndex <= 0 && graph.nodes.length > 1 ? 1 : selectedIndex,
  );
  const node = graph.nodes[index];
  if (!node) {
    return { graph, selectedIndex: index };
  }
  graph.nodes[index] = normalizeNodeGraphGraphNode({
    ...node,
    shape: nodeGraphGraphNextShape(node.shape),
  }, index);
  return {
    graph: normalizeNodeGraphGraph(graph),
    selectedIndex: index,
  };
}

function serializeNodeGraphGraphClipboard(graphValue) {
  return JSON.stringify({
    graph: normalizeNodeGraphGraph(graphValue),
    type: "soemdsp.graph",
    version: 1,
  }, null, 2);
}

function parseNodeGraphGraphClipboard(text) {
  try {
    const payload = JSON.parse(String(text || ""));
    if (payload?.type !== "soemdsp.graph") {
      return null;
    }
    return normalizeNodeGraphGraph(payload.graph);
  } catch (_error) {
    return null;
  }
}

function normalizeNodeGraphGraphShape(value) {
  const shape = String(value || "").trim();
  return nodeGraphGraphShapes.includes(shape) ? shape : "rational";
}

function nodeGraphGraphNextShape(value) {
  const current = normalizeNodeGraphGraphShape(value);
  const index = nodeGraphGraphShapes.indexOf(current);
  return nodeGraphGraphShapes[(index + 1) % nodeGraphGraphShapes.length];
}

function normalizeNodeGraphGraphNumber(value, fallback = 0, min = 0, max = 1) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(min, Math.min(max, number))
    : fallback;
}

function normalizeNodeGraphGraphNode(value = {}, index = 0) {
  const source = value && typeof value === "object" ? value : {};
  const fallback = nodeGraphDefaultGraphData.nodes[Math.min(index, nodeGraphDefaultGraphData.nodes.length - 1)];
  return {
    c: normalizeNodeGraphGraphNumber(source.c, fallback.c, -0.999, 0.999),
    shape: normalizeNodeGraphGraphShape(source.shape ?? fallback.shape),
    x: normalizeNodeGraphGraphNumber(source.x, fallback.x),
    y: normalizeNodeGraphGraphNumber(source.y, fallback.y),
  };
}

function normalizeNodeGraphGraph(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const inputNodes = Array.isArray(source.nodes) && source.nodes.length >= 2
    ? source.nodes
    : nodeGraphDefaultGraphData.nodes;
  const nodes = inputNodes
    .slice(0, 32)
    .map((node, index) => normalizeNodeGraphGraphNode(node, index))
    .sort((left, right) => left.x - right.x);
  if (nodes.length < 2) {
    nodes.push(...nodeGraphDefaultGraphData.nodes.map((node, index) => normalizeNodeGraphGraphNode(node, index)));
  }
  return {
    cursorX: normalizeNodeGraphGraphNumber(source.cursorX, nodeGraphDefaultGraphData.cursorX),
    nodes,
  };
}

function nodeGraphGraphRationalCurve(position, contour = 0) {
  const p = normalizeNodeGraphGraphNumber(position, 0, 0, 1);
  const c = normalizeNodeGraphGraphNumber(contour, 0, -0.999, 0.999);
  if (Math.abs(c) < 0.000001) {
    return p;
  }
  return c < 0
    ? (p * (1 + c)) / (1 + c * p)
    : p / (1 - c + c * p);
}

function nodeGraphGraphExponentialCurve(position, contour = 0) {
  const p = normalizeNodeGraphGraphNumber(position, 0, 0, 1);
  const c = normalizeNodeGraphGraphNumber(0.5 * (contour + 1), 0.5, 0.001, 0.999);
  const a = 2 * Math.log((1 - c) / c);
  if (!Number.isFinite(a) || Math.abs(a) < 0.000001) {
    return p;
  }
  const denominator = 1 - Math.exp(a);
  if (Math.abs(denominator) < 0.000001) {
    return p;
  }
  return (1 - Math.exp(p * a)) / denominator;
}

function nodeGraphGraphSmoothCurve(position) {
  const p = normalizeNodeGraphGraphNumber(position, 0, 0, 1);
  return p * p * (3 - 2 * p);
}

function nodeGraphGraphSegmentValue(graph, x, index) {
  const left = graph.nodes[index];
  const right = graph.nodes[index + 1];
  const dx = right.x - left.x;
  if (Math.abs(dx) < 0.000001) {
    return 0.5 * (left.y + right.y);
  }
  const p = normalizeNodeGraphGraphNumber((x - left.x) / dx, 0, 0, 1);
  const contour = normalizeNodeGraphGraphNumber(right.c, 0, -0.999, 0.999);
  const shaped = right.shape === "exponential"
    ? nodeGraphGraphExponentialCurve(p, contour)
    : right.shape === "hold"
      ? (p >= 1 ? 1 : 0)
    : right.shape === "smooth"
      ? nodeGraphGraphSmoothCurve(p)
    : right.shape === "linear"
      ? p
      : nodeGraphGraphRationalCurve(p, contour);
  return left.y + (right.y - left.y) * shaped;
}

function nodeGraphGraphValueAt(graphValue, xValue) {
  const graph = normalizeNodeGraphGraph(graphValue);
  const x = normalizeNodeGraphGraphNumber(xValue, 0, -Infinity, Infinity);
  if (!graph.nodes.length) {
    return 0;
  }
  if (x < graph.nodes[0].x) {
    return graph.nodes[0].y;
  }
  for (let index = 0; index < graph.nodes.length - 1; index += 1) {
    if (x <= graph.nodes[index + 1].x) {
      return normalizeNodeGraphGraphNumber(nodeGraphGraphSegmentValue(graph, x, index), 0, -Infinity, Infinity);
    }
  }
  return graph.nodes[graph.nodes.length - 1].y;
}

function nodeGraphGraphPointToSvg(x, y) {
  return {
    x: 8 + normalizeNodeGraphGraphNumber(x, 0) * 84,
    y: 92 - normalizeNodeGraphGraphNumber(y, 0) * 84,
  };
}

function nodeGraphGraphCurvePath(graphValue, sampleCount = 96) {
  const graph = normalizeNodeGraphGraph(graphValue);
  const count = Math.max(2, Math.round(Number(sampleCount) || 96));
  const commands = [];
  for (let index = 0; index < count; index += 1) {
    const x = index / (count - 1);
    const y = nodeGraphGraphValueAt(graph, x);
    const point = nodeGraphGraphPointToSvg(x, y);
    commands.push(`${index === 0 ? "M" : "L"} ${point.x.toFixed(3)} ${point.y.toFixed(3)}`);
  }
  return commands.join(" ");
}

function createNodeGraphGraphSvgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

function nodeGraphGraphSvgToGraphPoint(svg, clientX, clientY) {
  const rect = svg?.getBoundingClientRect?.();
  if (!rect?.width || !rect?.height) {
    return { x: 0, y: 0 };
  }
  const viewX = ((clientX - rect.left) / rect.width) * 100;
  const viewY = ((clientY - rect.top) / rect.height) * 100;
  return {
    x: normalizeNodeGraphGraphNumber((viewX - 8) / 84),
    y: normalizeNodeGraphGraphNumber((92 - viewY) / 84),
  };
}

function nodeGraphGraphConstrainedNodePoint(graph, index, point) {
  const nodes = graph.nodes || [];
  const lastIndex = nodes.length - 1;
  const margin = 0.001;
  const minX = index <= 0 ? 0 : normalizeNodeGraphGraphNumber(nodes[index - 1]?.x, 0) + margin;
  const maxX = index >= lastIndex ? 1 : normalizeNodeGraphGraphNumber(nodes[index + 1]?.x, 1) - margin;
  return {
    x: index <= 0
      ? 0
      : index >= lastIndex
        ? 1
        : normalizeNodeGraphGraphNumber(point.x, nodes[index]?.x || 0, Math.min(minX, maxX), Math.max(minX, maxX)),
    y: normalizeNodeGraphGraphNumber(point.y, nodes[index]?.y || 0),
  };
}

function nodeGraphGraphNodeIndexFromValue(graph, value) {
  const maxIndex = Math.max(0, (graph?.nodes?.length || 1) - 1);
  const index = Math.round(Number(value));
  return Math.max(0, Math.min(maxIndex, Number.isFinite(index) ? index : maxIndex));
}

function nodeGraphGraphSelectionState() {
  if (!(nodeGraphMvp.graphSelectedNodeIndices instanceof Map)) {
    nodeGraphMvp.graphSelectedNodeIndices = new Map();
  }
  return nodeGraphMvp.graphSelectedNodeIndices;
}

function nodeGraphGraphSelectedNodeIndex(nodeId, graph, fallback = 0) {
  const state = nodeGraphGraphSelectionState();
  return nodeGraphGraphNodeIndexFromValue(graph, state.has(nodeId) ? state.get(nodeId) : fallback);
}

function setNodeGraphGraphSelectedNodeIndex(nodeId, graph, index) {
  const selectedIndex = nodeGraphGraphNodeIndexFromValue(graph, index);
  nodeGraphGraphSelectionState().set(nodeId, selectedIndex);
  return selectedIndex;
}

function nodeGraphGraphContourHandlePoint(graph, index) {
  const left = graph.nodes[index - 1];
  const right = graph.nodes[index];
  if (!left || !right) {
    return null;
  }
  const x = left.x + (right.x - left.x) * 0.5;
  const y = nodeGraphGraphSegmentValue(graph, x, index - 1);
  return nodeGraphGraphPointToSvg(x, y);
}

function nodeGraphGraphSegmentMidpoint(graph, index) {
  const left = graph.nodes[index - 1];
  const right = graph.nodes[index];
  if (!left || !right) {
    return null;
  }
  return {
    x: left.x + (right.x - left.x) * 0.5,
    y: left.y + (right.y - left.y) * 0.5,
  };
}

function nodeGraphGraphContourFromPoint(graph, index, point) {
  const midpoint = nodeGraphGraphSegmentMidpoint(graph, index);
  const left = graph.nodes[index - 1];
  const right = graph.nodes[index];
  if (!midpoint || !left || !right) {
    return 0;
  }
  const direction = right.y >= left.y ? 1 : -1;
  const range = Math.max(0.08, Math.abs(right.y - left.y));
  return normalizeNodeGraphGraphNumber(((point.y - midpoint.y) / range) * direction * 1.8, 0, -0.999, 0.999);
}

function renderNodeGraphGraphDisplay(element, graphValue, selectedIndex = null) {
  if (!element) {
    return;
  }
  const graph = normalizeNodeGraphGraph(graphValue);
  const nodeId = element.dataset.graphNode || "";
  const activeIndex = selectedIndex === null
    ? nodeGraphGraphSelectedNodeIndex(nodeId, graph, 0)
    : nodeGraphGraphNodeIndexFromValue(graph, selectedIndex);
  const cursorValue = nodeGraphGraphValueAt(graph, graph.cursorX);
  const cursor = nodeGraphGraphPointToSvg(graph.cursorX, 0);
  const cursorPoint = nodeGraphGraphPointToSvg(graph.cursorX, cursorValue);
  element.replaceChildren();
  const svg = createNodeGraphGraphSvgElement("svg", {
    "aria-hidden": "true",
    class: "node-module-graph-svg",
    preserveAspectRatio: "none",
    viewBox: "0 0 100 100",
  });
  svg.append(createNodeGraphGraphSvgElement("rect", {
    class: "node-module-graph-frame",
    height: "84",
    width: "84",
    x: "8",
    y: "8",
  }));
  [0.25, 0.5, 0.75].forEach((gridValue) => {
    const gridPoint = nodeGraphGraphPointToSvg(gridValue, gridValue);
    svg.append(createNodeGraphGraphSvgElement("line", {
      class: `node-module-graph-grid-line${gridValue === 0.5 ? " major" : ""}`,
      x1: gridPoint.x.toFixed(3),
      x2: gridPoint.x.toFixed(3),
      y1: "8",
      y2: "92",
    }));
    svg.append(createNodeGraphGraphSvgElement("line", {
      class: `node-module-graph-grid-line${gridValue === 0.5 ? " major" : ""}`,
      x1: "8",
      x2: "92",
      y1: gridPoint.y.toFixed(3),
      y2: gridPoint.y.toFixed(3),
    }));
  });
  svg.append(createNodeGraphGraphSvgElement("line", {
    class: "node-module-graph-axis",
    x1: "8",
    x2: "92",
    y1: "50",
    y2: "50",
  }));
  svg.append(createNodeGraphGraphSvgElement("line", {
    class: "node-module-graph-cursor",
    x1: cursor.x.toFixed(3),
    x2: cursor.x.toFixed(3),
    y1: "8",
    y2: "92",
  }));
  svg.append(createNodeGraphGraphSvgElement("line", {
    class: "node-module-graph-cursor-hit",
    "data-graph-cursor": "true",
    x1: cursor.x.toFixed(3),
    x2: cursor.x.toFixed(3),
    y1: "8",
    y2: "92",
  }));
  svg.append(createNodeGraphGraphSvgElement("line", {
    class: "node-module-graph-cursor-value-guide",
    x1: "8",
    x2: "92",
    y1: cursorPoint.y.toFixed(3),
    y2: cursorPoint.y.toFixed(3),
  }));
  svg.append(createNodeGraphGraphSvgElement("path", {
    class: "node-module-graph-curve",
    d: nodeGraphGraphCurvePath(graph),
  }));
  svg.append(createNodeGraphGraphSvgElement("circle", {
    class: "node-module-graph-cursor-value",
    cx: cursorPoint.x.toFixed(3),
    cy: cursorPoint.y.toFixed(3),
    "data-graph-cursor": "true",
    r: "2.5",
  }));
  graph.nodes.forEach((node, index) => {
    if (index <= 0) {
      return;
    }
    const point = nodeGraphGraphContourHandlePoint(graph, index);
    if (!point) {
      return;
    }
    svg.append(createNodeGraphGraphSvgElement("circle", {
      class: `node-module-graph-contour-handle${index === activeIndex ? " selected" : ""}`,
      cx: point.x.toFixed(3),
      cy: point.y.toFixed(3),
      "data-graph-contour-index": String(index),
      "data-selected": index === activeIndex ? "true" : "false",
      r: "2.7",
    }));
    const shapeBadge = createNodeGraphGraphSvgElement("text", {
      class: `node-module-graph-shape-badge${index === activeIndex ? " selected" : ""}`,
      "data-graph-shape-index": String(index),
      "data-selected": index === activeIndex ? "true" : "false",
      x: Math.min(90, point.x + 4).toFixed(3),
      y: Math.max(12, point.y - 3).toFixed(3),
    });
    shapeBadge.textContent = normalizeNodeGraphGraphShape(node.shape).slice(0, 3);
    svg.append(shapeBadge);
  });
  graph.nodes.forEach((node, index) => {
    const point = nodeGraphGraphPointToSvg(node.x, node.y);
    svg.append(createNodeGraphGraphSvgElement("circle", {
      class: `node-module-graph-node-hit${index === activeIndex ? " selected" : ""}`,
      cx: point.x.toFixed(3),
      cy: point.y.toFixed(3),
      "data-graph-node-index": String(index),
      "data-selected": index === activeIndex ? "true" : "false",
      r: "5.4",
    }));
    svg.append(createNodeGraphGraphSvgElement("circle", {
      class: `node-module-graph-node${index === activeIndex ? " selected" : ""}`,
      cx: point.x.toFixed(3),
      cy: point.y.toFixed(3),
      "data-graph-node-index": String(index),
      "data-selected": index === activeIndex ? "true" : "false",
      r: "2.2",
    }));
  });
  element.append(svg);
}

function syncNodeGraphGraphElement(moduleElement, patchNode) {
  const graph = normalizeNodeGraphGraph(patchNode?.graph);
  renderNodeGraphGraphDisplay(
    moduleElement?.querySelector?.(".node-module-graph-display"),
    graph,
    nodeGraphGraphSelectedNodeIndex(patchNode?.id || "", graph, 0),
  );
}

function nodeGraphGraphDisplayFromEventTarget(target) {
  return target?.closest?.(".node-module-graph-display") || null;
}

function beginNodeGraphGraphNodeDrag(event) {
  if (event.button !== undefined && event.button !== 0) {
    return;
  }
  const shapeBadge = event.target?.closest?.(".node-module-graph-shape-badge");
  if (shapeBadge) {
    cycleNodeGraphGraphShapeFromDisplayEvent(event, shapeBadge);
    return;
  }
  const contour = event.target?.closest?.(".node-module-graph-contour-handle");
  if (contour) {
    beginNodeGraphGraphContourDrag(event, contour);
    return;
  }
  const cursor = event.target?.closest?.("[data-graph-cursor]");
  if (cursor) {
    beginNodeGraphGraphCursorDrag(event, cursor);
    return;
  }
  const circle = event.target?.closest?.(".node-module-graph-node, .node-module-graph-node-hit");
  if (!circle) {
    addNodeGraphGraphNodeFromDisplayEvent(event);
    return;
  }
  const moduleElement = circle.closest(".dsp-node");
  const nodeId = moduleElement?.dataset.node || "";
  const patchNode = nodeGraphPatchNode(nodeId);
  if (!patchNode || patchNode.type !== "graph") {
    return;
  }
  const display = nodeGraphGraphDisplayFromEventTarget(circle);
  const svg = circle.closest(".node-module-graph-svg");
  const graph = normalizeNodeGraphGraph(patchNode.graph);
  const index = nodeGraphGraphNodeIndexFromValue(graph, circle.dataset.graphNodeIndex);
  display?.focus?.({ preventScroll: true });
  setNodeGraphGraphSelectedNodeIndex(nodeId, graph, index);
  nodeGraphMvp.graphNodeDragging = {
    display,
    graph,
    index,
    nodeId,
    svg,
  };
  display?.classList.add("dragging");
  circle.setPointerCapture?.(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function beginNodeGraphGraphCursorDrag(event, cursorElement) {
  const moduleElement = cursorElement.closest(".dsp-node");
  const nodeId = moduleElement?.dataset.node || "";
  const patchNode = nodeGraphPatchNode(nodeId);
  if (!patchNode || patchNode.type !== "graph") {
    return;
  }
  const display = nodeGraphGraphDisplayFromEventTarget(cursorElement);
  const svg = cursorElement.closest(".node-module-graph-svg");
  const graph = normalizeNodeGraphGraph(patchNode.graph);
  display?.focus?.({ preventScroll: true });
  nodeGraphMvp.graphNodeDragging = {
    display,
    graph,
    mode: "cursor",
    nodeId,
    svg,
  };
  display?.classList.add("dragging");
  cursorElement.setPointerCapture?.(event.pointerId);
  dragNodeGraphGraphNode(event);
  event.preventDefault();
  event.stopPropagation();
}

function beginNodeGraphGraphContourDrag(event, contour) {
  const moduleElement = contour.closest(".dsp-node");
  const nodeId = moduleElement?.dataset.node || "";
  const patchNode = nodeGraphPatchNode(nodeId);
  if (!patchNode || patchNode.type !== "graph") {
    return;
  }
  const display = nodeGraphGraphDisplayFromEventTarget(contour);
  const svg = contour.closest(".node-module-graph-svg");
  const graph = normalizeNodeGraphGraph(patchNode.graph);
  const index = nodeGraphGraphNodeIndexFromValue(graph, contour.dataset.graphContourIndex);
  display?.focus?.({ preventScroll: true });
  setNodeGraphGraphSelectedNodeIndex(nodeId, graph, index);
  nodeGraphMvp.graphNodeDragging = {
    display,
    graph,
    index,
    mode: "contour",
    nodeId,
    svg,
  };
  display?.classList.add("dragging");
  contour.setPointerCapture?.(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function addNodeGraphGraphNodeFromDisplayEvent(event) {
  const svg = event.target?.closest?.(".node-module-graph-svg");
  if (!svg) {
    return;
  }
  const display = nodeGraphGraphDisplayFromEventTarget(event.target);
  const moduleElement = display?.closest(".dsp-node");
  const nodeId = moduleElement?.dataset.node || "";
  const patchNode = nodeGraphPatchNode(nodeId);
  if (!display || !patchNode || patchNode.type !== "graph") {
    return;
  }
  display?.focus?.({ preventScroll: true });
  const point = nodeGraphGraphSvgToGraphPoint(svg, event.clientX, event.clientY);
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === nodeId);
  if (!targetNode || targetNode.type !== "graph") {
    return;
  }
  const graph = normalizeNodeGraphGraph(targetNode.graph);
  graph.cursorX = point.x;
  graph.nodes.push({
    c: 0,
    shape: "rational",
    x: point.x,
    y: point.y,
  });
  targetNode.graph = graph;
  commitNodeGraphPatch(patch, { status: "graph node added" });
  const normalized = normalizeNodeGraphGraph(targetNode.graph);
  const selectedIndex = normalized.nodes.reduce((bestIndex, node, index) => (
    Math.abs(node.x - point.x) < Math.abs(normalized.nodes[bestIndex].x - point.x)
      ? index
      : bestIndex
  ), 0);
  setNodeGraphGraphSelectedNodeIndex(nodeId, normalized, selectedIndex);
  syncNodeGraphGraphElement(nodeGraphNodeElement(nodeId), { ...targetNode, graph: normalized });
  syncNodeGraphGraphControls(normalized, selectedIndex);
  event.preventDefault();
  event.stopPropagation();
}

function cycleNodeGraphGraphShapeFromDisplayEvent(event, shapeBadge) {
  const display = nodeGraphGraphDisplayFromEventTarget(shapeBadge);
  const moduleElement = display?.closest(".dsp-node");
  const nodeId = moduleElement?.dataset.node || "";
  const sourceNode = nodeGraphPatchNode(nodeId);
  if (!display || !sourceNode || sourceNode.type !== "graph") {
    return false;
  }
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === nodeId);
  if (!targetNode || targetNode.type !== "graph") {
    return false;
  }
  const graph = normalizeNodeGraphGraph(targetNode.graph);
  const shape = cycleNodeGraphGraphShapeData(graph, shapeBadge.dataset.graphShapeIndex);
  targetNode.graph = shape.graph;
  display?.focus?.({ preventScroll: true });
  setNodeGraphGraphSelectedNodeIndex(nodeId, targetNode.graph, shape.selectedIndex);
  commitNodeGraphPatch(patch, { status: "graph curve shape changed" });
  syncNodeGraphGraphControls(targetNode.graph, shape.selectedIndex);
  event?.preventDefault?.();
  event?.stopPropagation?.();
  return true;
}

function dragNodeGraphGraphNode(event) {
  const drag = nodeGraphMvp.graphNodeDragging;
  if (!drag?.svg || !drag?.display) {
    return;
  }
  const point = nodeGraphGraphSvgToGraphPoint(drag.svg, event.clientX, event.clientY);
  if (drag.mode === "cursor") {
    drag.graph = normalizeNodeGraphGraph({
      ...drag.graph,
      cursorX: point.x,
    });
    renderNodeGraphGraphDisplay(drag.display, drag.graph);
    drag.svg = drag.display.querySelector(".node-module-graph-svg");
    if (nodeGraphModuleActionTargetNodeId() === drag.nodeId) {
      syncNodeGraphGraphControls(drag.graph);
    }
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (drag.mode === "contour") {
    const current = drag.graph.nodes[drag.index] || normalizeNodeGraphGraphNode({}, drag.index);
    drag.graph.nodes[drag.index] = normalizeNodeGraphGraphNode({
      ...current,
      c: nodeGraphGraphContourFromPoint(drag.graph, drag.index, point),
      shape: current.shape === "linear" ? "rational" : current.shape,
    }, drag.index);
    drag.graph = normalizeNodeGraphGraph(drag.graph);
    setNodeGraphGraphSelectedNodeIndex(drag.nodeId, drag.graph, drag.index);
    renderNodeGraphGraphDisplay(drag.display, drag.graph, drag.index);
    drag.svg = drag.display.querySelector(".node-module-graph-svg");
    if (nodeGraphModuleActionTargetNodeId() === drag.nodeId) {
      syncNodeGraphGraphControls(drag.graph, drag.index);
    }
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  const constrained = nodeGraphGraphConstrainedNodePoint(drag.graph, drag.index, point);
  const current = drag.graph.nodes[drag.index] || normalizeNodeGraphGraphNode({}, drag.index);
  drag.graph.nodes[drag.index] = normalizeNodeGraphGraphNode({
    ...current,
    x: constrained.x,
    y: constrained.y,
  }, drag.index);
  drag.graph = normalizeNodeGraphGraph(drag.graph);
  drag.index = nodeGraphGraphNodeIndexFromValue(drag.graph, drag.index);
  setNodeGraphGraphSelectedNodeIndex(drag.nodeId, drag.graph, drag.index);
  renderNodeGraphGraphDisplay(drag.display, drag.graph, drag.index);
  drag.svg = drag.display.querySelector(".node-module-graph-svg");
  if (nodeGraphModuleActionTargetNodeId() === drag.nodeId) {
    syncNodeGraphGraphControls(drag.graph, drag.index);
  }
  event.preventDefault();
  event.stopPropagation();
}

function endNodeGraphGraphNodeDrag(event) {
  const drag = nodeGraphMvp.graphNodeDragging;
  if (!drag) {
    return;
  }
  drag.display?.classList.remove("dragging");
  nodeGraphMvp.graphNodeDragging = null;
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === drag.nodeId);
  if (targetNode?.type === "graph") {
    targetNode.graph = normalizeNodeGraphGraph(drag.graph);
    const status = drag.mode === "cursor"
      ? "graph cursor moved"
      : drag.mode === "contour"
        ? "graph curve changed"
        : "graph node moved";
    commitNodeGraphPatch(patch, { status });
    const selectedIndex = nodeGraphGraphSelectedNodeIndex(drag.nodeId, targetNode.graph, drag.index ?? 0);
    setNodeGraphGraphSelectedNodeIndex(drag.nodeId, targetNode.graph, selectedIndex);
    syncNodeGraphGraphControls(targetNode.graph, selectedIndex);
  }
  event.preventDefault();
  event.stopPropagation();
}

function removeSelectedNodeGraphGraphNodeFromDisplay(display) {
  const moduleElement = display?.closest?.(".dsp-node");
  const nodeId = moduleElement?.dataset.node || "";
  const sourceNode = nodeGraphPatchNode(nodeId);
  if (!display || !sourceNode || sourceNode.type !== "graph") {
    return false;
  }
  const graph = normalizeNodeGraphGraph(sourceNode.graph);
  if (graph.nodes.length <= 2) {
    return false;
  }
  const selectedIndex = nodeGraphGraphSelectedNodeIndex(nodeId, graph, graph.nodes.length - 1);
  graph.nodes.splice(selectedIndex, 1);
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === nodeId);
  if (!targetNode || targetNode.type !== "graph") {
    return false;
  }
  targetNode.graph = graph;
  const nextIndex = setNodeGraphGraphSelectedNodeIndex(nodeId, graph, Math.max(0, selectedIndex - 1));
  commitNodeGraphPatch(patch, { status: "graph node removed" });
  syncNodeGraphGraphControls(targetNode.graph, nextIndex);
  return true;
}

function removeFocusedNodeGraphGraphNode() {
  return removeSelectedNodeGraphGraphNodeFromDisplay(
    document.activeElement?.closest?.(".node-module-graph-display"),
  );
}

function duplicateFocusedNodeGraphGraphNode() {
  const display = document.activeElement?.closest?.(".node-module-graph-display");
  const moduleElement = display?.closest?.(".dsp-node");
  const nodeId = moduleElement?.dataset.node || "";
  const sourceNode = nodeGraphPatchNode(nodeId);
  if (!display || !sourceNode || sourceNode.type !== "graph") {
    return false;
  }
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === nodeId);
  if (!targetNode || targetNode.type !== "graph") {
    return false;
  }
  const graph = normalizeNodeGraphGraph(targetNode.graph);
  const selectedIndex = nodeGraphGraphSelectedNodeIndex(nodeId, graph, graph.nodes.length - 1);
  const duplicate = duplicateNodeGraphGraphNodeData(graph, selectedIndex);
  if (!duplicate.duplicated) {
    return false;
  }
  targetNode.graph = duplicate.graph;
  commitNodeGraphPatch(patch, { status: "graph node duplicated" });
  setNodeGraphGraphSelectedNodeIndex(nodeId, targetNode.graph, duplicate.selectedIndex);
  syncNodeGraphGraphElement(moduleElement, targetNode);
  if (nodeGraphModuleActionTargetNodeId() === nodeId) {
    syncNodeGraphGraphControls(targetNode.graph, duplicate.selectedIndex);
  }
  display.focus?.({ preventScroll: true });
  return true;
}

function cycleFocusedNodeGraphGraphShape() {
  const display = document.activeElement?.closest?.(".node-module-graph-display");
  const moduleElement = display?.closest?.(".dsp-node");
  const nodeId = moduleElement?.dataset.node || "";
  const sourceNode = nodeGraphPatchNode(nodeId);
  if (!display || !sourceNode || sourceNode.type !== "graph") {
    return false;
  }
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === nodeId);
  if (!targetNode || targetNode.type !== "graph") {
    return false;
  }
  const graph = normalizeNodeGraphGraph(targetNode.graph);
  const selectedIndex = nodeGraphGraphSelectedNodeIndex(nodeId, graph, graph.nodes.length - 1);
  const shape = cycleNodeGraphGraphShapeData(graph, selectedIndex);
  targetNode.graph = shape.graph;
  commitNodeGraphPatch(patch, { status: "graph curve shape changed" });
  setNodeGraphGraphSelectedNodeIndex(nodeId, targetNode.graph, shape.selectedIndex);
  syncNodeGraphGraphElement(moduleElement, targetNode);
  if (nodeGraphModuleActionTargetNodeId() === nodeId) {
    syncNodeGraphGraphControls(targetNode.graph, shape.selectedIndex);
  }
  display.focus?.({ preventScroll: true });
  return true;
}

function nudgeFocusedNodeGraphGraphNode(event) {
  const display = document.activeElement?.closest?.(".node-module-graph-display");
  const moves = {
    ArrowDown: { x: 0, y: -1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    ArrowUp: { x: 0, y: 1 },
  };
  const move = moves[event?.key];
  if (!display || !move || event.ctrlKey || event.metaKey) {
    return false;
  }
  const moduleElement = display.closest(".dsp-node");
  const nodeId = moduleElement?.dataset.node || "";
  const sourceNode = nodeGraphPatchNode(nodeId);
  if (!sourceNode || sourceNode.type !== "graph") {
    return false;
  }
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const targetNode = patch.nodes.find((node) => node.id === nodeId);
  if (!targetNode || targetNode.type !== "graph") {
    return false;
  }
  const graph = normalizeNodeGraphGraph(targetNode.graph);
  const index = nodeGraphGraphSelectedNodeIndex(nodeId, graph, graph.nodes.length - 1);
  const current = graph.nodes[index];
  const step = event.altKey ? 0.001 : event.shiftKey ? 0.05 : 0.01;
  graph.nodes[index] = normalizeNodeGraphGraphNode({
    ...current,
    ...nodeGraphGraphConstrainedNodePoint(graph, index, {
      x: current.x + move.x * step,
      y: current.y + move.y * step,
    }),
  }, index);
  targetNode.graph = normalizeNodeGraphGraph(graph);
  setNodeGraphGraphSelectedNodeIndex(nodeId, targetNode.graph, index);
  commitNodeGraphPatch(patch, { status: "graph node nudged" });
  syncNodeGraphGraphControls(targetNode.graph, index);
  return true;
}
