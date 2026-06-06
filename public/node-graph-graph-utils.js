const nodeGraphGraphShapes = Object.freeze(["linear", "rational", "exponential"]);

const nodeGraphDefaultGraphData = Object.freeze({
  cursorX: 0.5,
  nodes: Object.freeze([
    Object.freeze({ c: 0, shape: "linear", x: 0, y: 0 }),
    Object.freeze({ c: 0, shape: "rational", x: 1, y: 1 }),
  ]),
});

function normalizeNodeGraphGraphShape(value) {
  const shape = String(value || "").trim();
  return nodeGraphGraphShapes.includes(shape) ? shape : "rational";
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
  const cursor = nodeGraphGraphPointToSvg(graph.cursorX, 0);
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
  svg.append(createNodeGraphGraphSvgElement("path", {
    class: "node-module-graph-curve",
    d: nodeGraphGraphCurvePath(graph),
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
  const contour = event.target?.closest?.(".node-module-graph-contour-handle");
  if (contour) {
    beginNodeGraphGraphContourDrag(event, contour);
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

function dragNodeGraphGraphNode(event) {
  const drag = nodeGraphMvp.graphNodeDragging;
  if (!drag?.svg || !drag?.display) {
    return;
  }
  const point = nodeGraphGraphSvgToGraphPoint(drag.svg, event.clientX, event.clientY);
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
    commitNodeGraphPatch(patch, { status: "graph node moved" });
    setNodeGraphGraphSelectedNodeIndex(drag.nodeId, targetNode.graph, drag.index);
    syncNodeGraphGraphControls(targetNode.graph, drag.index);
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
