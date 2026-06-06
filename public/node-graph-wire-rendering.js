function nodeGraphSelfTraceModuleRect(nodeId) {
  const surface = nodeGraphZoomSurface();
  const node = nodeGraphNodeElement(nodeId);
  if (!surface || !node) {
    return null;
  }
  const surfaceRect = surface.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();
  const zoom = nodeGraphZoom();
  const titleRowRect = node.querySelector(".node-header-title-row")?.getBoundingClientRect();
  const titleBottom = titleRowRect
    ? (titleRowRect.bottom - surfaceRect.top) / zoom
    : (nodeRect.top - surfaceRect.top) / zoom;
  return {
    bottom: (nodeRect.bottom - surfaceRect.top) / zoom,
    left: (nodeRect.left - surfaceRect.left) / zoom,
    right: (nodeRect.right - surfaceRect.left) / zoom,
    titleBottom,
    top: (nodeRect.top - surfaceRect.top) / zoom,
  };
}

function nodeGraphSelfTracePoints(wire, from, to) {
  const sourceNode = wire?.sourceNode;
  const destinationNode = wire?.destinationNode;
  if (!sourceNode || sourceNode !== destinationNode) {
    return [];
  }
  const rect = nodeGraphSelfTraceModuleRect(sourceNode);
  if (!rect) {
    return [];
  }
  const distance = Math.max(nodeGraphGridWidth(), nodeGraphGridHeight()) * 0.75;
  const centerX = (rect.left + rect.right) * 0.5;
  const fromDirection = from.x < centerX ? -1 : 1;
  const toDirection = to.x < centerX ? -1 : 1;
  const outX = from.x + fromDirection * distance;
  const destinationSideX = to.x + toDirection * distance;
  const aboveY = Math.max(0.5, rect.top - distance);
  const belowTitleY = Math.max(to.y, rect.titleBottom + 0.5);
  return [
    { x: outX, y: from.y },
    { x: outX, y: aboveY },
    { x: destinationSideX, y: aboveY },
    { x: destinationSideX, y: belowTitleY },
  ];
}

function nodeGraphManualTracePathOptions(wire, from, to) {
  const wireType = normalizeNodeGraphWireType(wire?.wireType);
  if (wireType !== nodeGraphWireTypes.trace) {
    return { wireType };
  }
  const manualTracePoints = normalizeNodeGraphTracePoints(wire?.tracePoints);
  const tracePoints = manualTracePoints.length
    ? manualTracePoints
    : nodeGraphSelfTracePoints(wire, from, to);
  return {
    pathData: nodeGraphTracePathFromPoints(from, tracePoints, to),
    tracePoints,
    wireType,
  };
}

function nodeGraphWireEndpointsAreRenderable(wire) {
  return Boolean(
    nodeGraphMvp.activeNodes.has(wire.sourceNode) &&
    nodeGraphMvp.activeNodes.has(wire.destinationNode) &&
    nodeGraphPatchNodeIsVisible(wire.sourceNode) &&
    nodeGraphPatchNodeIsVisible(wire.destinationNode),
  );
}

function nodeGraphWireInteractionMode(wire, identity, feedbackSet, activeWirePredicate, activeNodeIds, plan) {
  if (nodeGraphWireTouchesBypassed(wire, plan)) {
    return "bypassed";
  }
  if (!activeWirePredicate(wire, activeNodeIds)) {
    return "inactive";
  }
  return feedbackSet.has(identity) ? "state-read" : "same-pass";
}

function nodeGraphWirePathClass(...classes) {
  return classes.filter(Boolean).join(" ");
}

function markNodeGraphWireEndpointsConnected(wire, destinationIo = "input") {
  nodeGraphNodeElement(wire.sourceNode)?.classList.add("connected");
  nodeGraphNodeElement(wire.destinationNode)?.classList.add("connected");
  markNodeGraphPortConnected(wire.sourceNode, wire.sourcePort, "output");
  if (destinationIo === "modulation") {
    markNodeGraphModulationPortConnected(wire.destinationNode, wire.destinationParam);
    return;
  }
  markNodeGraphPortConnected(wire.destinationNode, wire.destinationPort, "input");
}

function nodeGraphDrawSignalWire(svg, connection, index, context) {
  if (!nodeGraphWireEndpointsAreRenderable(connection)) {
    return;
  }
  const from = nodeGraphPortCenter(connection.sourceNode, connection.sourcePort, "output");
  const to = nodeGraphPortCenter(connection.destinationNode, connection.destinationPort, "input");
  const isInactive = !nodeGraphSignalConnectionIsActive(connection, context.activeNodeIds);
  const mode = nodeGraphWireInteractionMode(
    connection,
    nodeGraphSignalWireIdentity(connection),
    context.feedbackSets.signal,
    nodeGraphSignalConnectionIsActive,
    context.activeNodeIds,
    context.plan,
  );
  nodeGraphWireHelpers.drawPath(svg, {
    alias: `${nodeGraphLabel(connection.sourceNode, connection.sourcePort)} -> ${nodeGraphLabel(
      connection.destinationNode,
      connection.destinationPort,
    )}`,
    from,
    gradientId: `node-wire-gradient-${index}`,
    index,
    kind: "signal",
    mode,
    pathClass: nodeGraphWirePathClass(
      "node-wire-path",
      mode === "state-read" ? "state-read" : "",
      isInactive ? "inactive-wire" : "",
    ),
    to,
    wireType: connection.wireType,
    wireColors: [
      nodeGraphPortWireColor(connection.sourceNode, connection.sourcePort, "output"),
      nodeGraphPortWireColor(connection.destinationNode, connection.destinationPort, "input"),
    ],
    ...nodeGraphManualTracePathOptions(connection, from, to),
  });
  markNodeGraphWireEndpointsConnected(connection);
}

function nodeGraphDrawModulationWire(svg, modulation, index, context) {
  if (!nodeGraphWireEndpointsAreRenderable(modulation)) {
    return;
  }
  const from = nodeGraphPortCenter(modulation.sourceNode, modulation.sourcePort, "output");
  const to = nodeGraphModulationPortCenter(
    modulation.destinationNode,
    modulation.destinationParam,
  );
  const isInactive = !nodeGraphModulationIsActive(modulation, context.activeNodeIds);
  const mode = nodeGraphWireInteractionMode(
    modulation,
    nodeGraphModulationWireIdentity(modulation),
    context.feedbackSets.modulation,
    nodeGraphModulationIsActive,
    context.activeNodeIds,
    context.plan,
  );
  nodeGraphWireHelpers.drawPath(svg, {
    alias: `${nodeGraphLabel(modulation.sourceNode, modulation.sourcePort)} -> ${nodeGraphNodeDisplayName(
      modulation.destinationNode,
    )}.${modulation.destinationParam} mod`,
    from,
    gradientClass: "node-modulation-wire-gradient-stop",
    gradientId: `node-modulation-wire-gradient-${index}`,
    index,
    kind: "modulation",
    mode,
    pathClass: nodeGraphWirePathClass(
      "node-wire-path",
      "node-modulation-wire-path",
      isInactive ? "inactive-wire" : "",
    ),
    to,
    wireType: modulation.wireType,
    wireColors: [
      nodeGraphPortWireColor(modulation.sourceNode, modulation.sourcePort, "output"),
      nodeGraphPortWireColor(modulation.destinationNode, modulation.destinationParam, "modulation"),
    ],
    ...nodeGraphManualTracePathOptions(modulation, from, to),
  });
  markNodeGraphWireEndpointsConnected(modulation, "modulation");
}

function nodeGraphDrawTemporaryWire(svg, options) {
  const { className, endpoint, from, gradientId, to, tracePoints = null } = options;
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const stroke = nodeGraphWireHelpers.createGradient(
    svg,
    gradientId,
    from,
    to,
    "node-wire-gradient-stop",
    [
      nodeGraphPortWireColor(endpoint.node, endpoint.port, endpoint.io),
      "rgba(243, 241, 236, 0.44)",
    ],
  );
  path.setAttribute("class", className);
  path.setAttribute("stroke", stroke);
  if (tracePoints) {
    path.dataset.tracePoints = nodeGraphTraceWaypointAttribute(tracePoints);
    path.setAttribute("d", nodeGraphTracePathFromPoints(from, tracePoints, to));
  } else {
    path.setAttribute("d", nodeGraphWireHelpers.path(from, to));
  }
  svg.append(path);
}

function nodeGraphResetConnectedWireClasses(workspace) {
  for (const node of workspace.querySelectorAll(".dsp-node")) {
    node.classList.remove("connected");
  }
  for (const port of workspace.querySelectorAll(".node-port, .node-param-port")) {
    port.classList.remove("connected-port");
  }
}

function drawNodeGraphWires() {
  const workspace = nodeGraphZoomSurface();
  const svg = document.getElementById("nodeWireSvg");
  if (!workspace || !svg) {
    return;
  }
  updateNodeGraphGridHeatmap();
  const plan = compileNodeGraphExecutionPlan();
  const feedbackSets = nodeGraphFeedbackIdentitySets(plan);
  const activeNodeIds = nodeGraphActiveNodeIds(plan);

  const graphRect = nodeGraphGraphRect();
  svg.setAttribute("viewBox", `0 0 ${graphRect.width} ${graphRect.height}`);
  svg.replaceChildren();
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  svg.append(defs);

  nodeGraphResetConnectedWireClasses(workspace);

  const context = { activeNodeIds, feedbackSets, plan };
  for (const [index, connection] of nodeGraphMvp.connections.entries()) {
    nodeGraphDrawSignalWire(svg, connection, index, context);
  }

  for (const [index, modulation] of nodeGraphMvp.modulations.entries()) {
    nodeGraphDrawModulationWire(svg, modulation, index, context);
  }

  syncNodeGraphMonitorIndicators();

  if (nodeGraphMvp.dragging) {
    nodeGraphDrawTemporaryWire(svg, {
      className: "node-wire-path temp",
      endpoint: nodeGraphMvp.dragging.endpoint,
      from: nodeGraphMvp.dragging.from,
      gradientId: "node-wire-gradient-temp",
      to: nodeGraphMvp.dragging.to,
    });
  }

  if (nodeGraphMvp.manualTrace) {
    const trace = nodeGraphMvp.manualTrace;
    const previewPoint = nodeGraphTraceSingleMovePoint(trace.from, trace.points, trace.to);
    nodeGraphDrawTemporaryWire(svg, {
      className: "node-wire-path trace-wire temp",
      endpoint: trace.endpoint,
      from: trace.from,
      gradientId: "node-wire-gradient-manual-trace",
      to: previewPoint,
      tracePoints: trace.points,
    });
  }

  renderNodeGraphSelection();
  scheduleNodeGraphModuleScopeDraw();
}

function renderNodeGraphConnectionList() {
  const plan = compileNodeGraphExecutionPlan();
  const validation = {
    issues: plan.issues,
    scheduleText: nodeGraphScheduleText(
      plan.order,
      plan.issues,
      plan.feedbackConnections,
      plan.feedbackModulations,
    ),
    sourceNodes: plan.sourceNodes,
    valid: plan.valid,
  };
  const list = document.getElementById("nodeConnectionList");
  const status = document.getElementById("nodeGraphStatus");
  const source = document.getElementById("nodeGraphSource");
  const validationPill = document.getElementById("nodeGraphValidation");
  const feedbackSets = nodeGraphFeedbackIdentitySets(plan);
  const activeNodeIds = nodeGraphActiveNodeIds(plan);

  list.replaceChildren();
  let renderedWireCount = 0;
  for (const [index, connection] of nodeGraphMvp.connections.entries()) {
    if (
      !nodeGraphMvp.activeNodes.has(connection.sourceNode) ||
      !nodeGraphMvp.activeNodes.has(connection.destinationNode)
    ) {
      continue;
    }

    const item = document.createElement("li");
    item.dataset.connectionRowIndex = String(index);
    item.dataset.connectionRowKind = "signal";
    item.classList.toggle(
      "selected",
      sameNodeGraphSelection(nodeGraphMvp.selected, { type: "wire", kind: "signal", index }),
    );
    item.addEventListener("click", () => setNodeGraphSelection({ type: "wire", kind: "signal", index }));
    const label = document.createElement("span");
    const isFeedback = feedbackSets.signal.has(nodeGraphSignalWireIdentity(connection));
    const isInactive = !nodeGraphSignalConnectionIsActive(connection, activeNodeIds);
    const isBypassed = nodeGraphWireTouchesBypassed(connection, plan);
    label.textContent = `${nodeGraphLabel(connection.sourceNode, connection.sourcePort)} -> ${nodeGraphLabel(
      connection.destinationNode,
      connection.destinationPort,
    )}${isFeedback ? " (state read)" : ""}${isBypassed ? " (bypassed)" : isInactive ? " (inactive)" : ""}`;
    item.classList.toggle("state-read", isFeedback);
    item.classList.toggle("inactive-wire", isInactive);
    const button = document.createElement("button");
    button.className = "disconnect-wire-button";
    button.type = "button";
    button.textContent = "Disconnect";
    button.dataset.connectionIndex = String(index);
    button.dataset.connectionKind = "signal";
    button.setAttribute("aria-label", `Disconnect ${label.textContent}`);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      disconnectNodeGraphConnection(index, "signal");
    });
    item.append(label, button);
    list.append(item);
    renderedWireCount += 1;
  }

  for (const [index, modulation] of nodeGraphMvp.modulations.entries()) {
    if (
      !nodeGraphMvp.activeNodes.has(modulation.sourceNode) ||
      !nodeGraphMvp.activeNodes.has(modulation.destinationNode)
    ) {
      continue;
    }

    const item = document.createElement("li");
    item.dataset.connectionRowIndex = String(index);
    item.dataset.connectionRowKind = "modulation";
    item.classList.toggle(
      "selected",
      sameNodeGraphSelection(nodeGraphMvp.selected, { type: "wire", kind: "modulation", index }),
    );
    item.addEventListener("click", () => setNodeGraphSelection({ type: "wire", kind: "modulation", index }));
    const label = document.createElement("span");
    const isFeedback = feedbackSets.modulation.has(nodeGraphModulationWireIdentity(modulation));
    const isInactive = !nodeGraphModulationIsActive(modulation, activeNodeIds);
    const isBypassed = nodeGraphWireTouchesBypassed(modulation, plan);
    label.textContent = `${nodeGraphLabel(modulation.sourceNode, modulation.sourcePort)} -> ${nodeGraphNodeDisplayName(
      modulation.destinationNode,
    )}.${modulation.destinationParam} mod${isFeedback ? " (state read)" : ""}${isBypassed ? " (bypassed)" : isInactive ? " (inactive)" : ""}`;
    item.classList.toggle("state-read", isFeedback);
    item.classList.toggle("inactive-wire", isInactive);
    const button = document.createElement("button");
    button.className = "disconnect-wire-button";
    button.type = "button";
    button.textContent = "Disconnect";
    button.dataset.connectionIndex = String(index);
    button.dataset.connectionKind = "modulation";
    button.setAttribute("aria-label", `Disconnect ${label.textContent}`);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      disconnectNodeGraphConnection(index, "modulation");
    });
    item.append(label, button);
    list.append(item);
    renderedWireCount += 1;
  }

  if (!renderedWireCount) {
    const item = document.createElement("li");
    item.className = "warn-row";
    item.textContent = "No wires connected";
    list.append(item);
  }

  status.textContent = validation.valid ? "Graph Valid" : "Graph Incomplete";
  status.className = `pill ${validation.valid ? "good" : "warn"}`;
  source.textContent = validation.scheduleText;
  validationPill.textContent = validation.valid
    ? "valid"
    : validation.issues.join(", ");
  validationPill.className = `pill ${validation.valid ? "good" : "warn"}`;

  const renderButton = document.getElementById("nodeRenderButton");
  renderButton.disabled = !validation.valid;
  renderButton.title = validation.valid
    ? "Render current patch sample"
    : `Render blocked: ${validation.issues.join(", ")}`;
  renderNodeGraphExecutionPlanDebug(plan);
  drawNodeGraphWires();
}
