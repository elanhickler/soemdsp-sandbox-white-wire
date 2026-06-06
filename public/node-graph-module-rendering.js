function ensureNodeGraphDragHandle(node) {
  const actions = node.querySelector(".node-header-actions");
  if (!actions || actions.querySelector(".node-drag-handle")) {
    return;
  }

  const handle = document.createElement("button");
  handle.className = "node-drag-handle";
  handle.type = "button";
  handle.setAttribute("aria-label", `Move ${nodeGraphNodeDisplayName(node.dataset.node)} module`);
  nodeGraphApplyTooltip(handle, "module.move", {}, { title: false });
  handle.innerHTML = "&#x2725;";
  actions.prepend(handle);
}

function handleNodeGraphIoRowMonitorPointerDown(event) {
  if (event.target.closest(".node-port")) {
    return;
  }
  toggleNodeGraphMonitorFromPortEvent(event);
}

function handleNodeGraphIoRowWirePointerDown(event) {
  if (event.target.closest(".node-port")) {
    return;
  }
  nodeGraphWireInteractions.beginWireDrag(event);
}

function attachNodeGraphNodeEvents(node) {
  ensureNodeGraphDragHandle(node);
  node.querySelector(".node-drag-handle")?.addEventListener("pointerdown", beginNodeGraphNodeDrag);
  node.querySelector(".node-header-title-row")?.addEventListener("pointerdown", beginNodeGraphNodeDrag);
  node.querySelector(".node-led-face")?.addEventListener("pointerdown", beginNodeGraphNodeDrag);
  node.querySelector(".node-bypass-button")?.addEventListener("click", toggleNodeGraphModuleBypass);
  node.querySelector(".node-action-button")?.addEventListener("click", openNodeModuleActionMenu);
  node.addEventListener("pointermove", dragNodeGraphNode);
  node.addEventListener("pointerup", endNodeGraphNodeDrag);
  node.addEventListener("pointercancel", endNodeGraphNodeDrag);
  node.addEventListener("lostpointercapture", endNodeGraphNodeDrag);
  for (const port of node.querySelectorAll(".node-port")) {
    port.addEventListener("pointerdown", toggleNodeGraphMonitorFromPortEvent, true);
    port.addEventListener("pointerdown", nodeGraphWireInteractions.beginWireDrag);
  }
  for (const port of node.querySelectorAll(".node-param-port.modulation-input")) {
    port.addEventListener("pointerdown", toggleNodeGraphMonitorFromPortEvent, true);
    port.addEventListener("pointerdown", nodeGraphWireInteractions.beginWireDrag);
  }
  for (const row of node.querySelectorAll(".node-io-row")) {
    row.addEventListener("pointerdown", handleNodeGraphIoRowMonitorPointerDown, true);
    row.addEventListener("pointerdown", handleNodeGraphIoRowWirePointerDown);
  }
  for (const slider of node.querySelectorAll('input[type="range"]')) {
    createNodeSliderReadout(slider);
    slider.addEventListener("input", () => {
      syncNodeSliderReadout(slider);
      syncNodeGraphPatchParameterFromSlider(slider);
      syncNodeGraphGhostSliders();
      markNodeGraphRenderPending();
      scheduleNodeGraphModuleScopeDraw();
      if (typeof scheduleNodeGraphFilterCurveDraw === "function") {
        scheduleNodeGraphFilterCurveDraw();
      }
      scheduleNodeGraphLiveParameterSync();
    });
  }
}

function nodeGraphModuleButtonsHiddenForNode(node) {
  if (!(node instanceof Element)) {
    return false;
  }
  return (
    nodeGraphMvp.moduleButtonsVisible === false ||
    node.classList.contains("buttons-hidden") ||
    node.closest(".node-graph-workspace")?.classList.contains("module-buttons-hidden")
  );
}

function nodeGraphModuleTitleBypassModifierActive(event) {
  return Boolean(event?.altKey);
}

function toggleNodeGraphModuleBypassFromNode(node, event) {
  if (!nodeGraphScriptReadyForGraphAction("bypass")) {
    return false;
  }
  const bypassButton = node?.querySelector?.(".node-bypass-button");
  if (!bypassButton) {
    return false;
  }
  const nodeId = node?.dataset?.node;
  if (nodeId === "output") {
    toggleNodeGraphLiveOutput();
    event?.preventDefault?.();
    event?.stopPropagation?.();
    return true;
  }
  if (!nodeId || !nodeGraphMvp.activeNodes.has(nodeId)) {
    return false;
  }

  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  const bypassed = new Set(patch.bypassedNodes || []);
  if (bypassed.has(nodeId)) {
    bypassed.delete(nodeId);
  } else {
    bypassed.add(nodeId);
  }
  patch.bypassedNodes = [...bypassed];
  commitNodeGraphPatch(patch, {
    status: bypassed.has(nodeId) ? "module bypassed" : "module active",
  });
  event?.preventDefault?.();
  event?.stopPropagation?.();
  return true;
}

function createNodeGraphModuleElement(type, node) {
  const definition = nodeGraphModuleDefinitions[type];
  const patchNode = nodeGraphPatchNode(node) || { id: node, type };
  const parameterDefinitions = nodeGraphPatchNodeParameterDefinitions(patchNode);
  const inputPorts = nodeGraphPatchNodeInputPorts(patchNode);
  const outputPorts = nodeGraphPatchNodeOutputPorts(patchNode).filter(
    (port) => !parameterDefinitions.some((parameter) => parameter.key === port),
  );
  const article = document.createElement("article");
  article.className = `dsp-node${definition.output ? " output-node" : ""}${definition.layout === "textBox" ? " text-box-layout" : ""}${definition.layout === "image" ? " image-node-layout" : ""}${definition.layout === "visualScope" ? " visual-scope-layout" : ""}${definition.layout === "graph" ? " graph-node-layout" : ""}${definition.layout === "filterCurve" ? " filter-curve-layout" : ""}${definition.layout === "sliderWidget" ? " slider-widget-layout" : ""}${definition.layout === "clapPlugin" ? " clap-plugin-layout" : ""}${definition.layout === "led" ? " led-layout" : ""}`;
  article.dataset.node = node;
  article.dataset.nodeType = type;
  article.dataset.portSignature = `${inputPorts.join(",")}=>${outputPorts.join(",")}`;
  article.style.setProperty("--node-grid-width-units", String(nodeGraphPatchNodeGridWidthUnits(patchNode)));
  article.style.setProperty("--node-grid-height-units", String(nodeGraphPatchNodeGridHeightUnits(patchNode)));

  if (definition.layout === "led") {
    const ledFace = createNodeGraphLedFace(node, type);
    article.append(ledFace);
    registerNodeGraphModuleScopeSlot(article, {
      nodeId: node,
      scopeElement: ledFace,
      type,
      viewDrag: false,
    });
  } else {
    article.append(createNodeGraphModuleHeader(type, node, definition));
  }
  if (definition.layout === "led") {
    // Compact LED body is the whole module face.
  } else if (definition.layout === "textBox") {
    article.append(createNodeGraphTextBoxBody(node));
  } else if (definition.layout === "image") {
    article.append(createNodeGraphImageBody(node));
    const ioSection = document.createElement("div");
    ioSection.className = "dsp-node-io-section";
    ioSection.append(document.createElement("div"));
    const outputColumn = createNodeGraphIoColumn(node, type, outputPorts, "output");
    ioSection.append(outputColumn || document.createElement("div"));
    article.append(ioSection);
  } else if (definition.layout === "visualScope") {
    const scopeSection = createNodeGraphModuleScopeSection(node, type);
    scopeSection.classList.add("node-module-square-scope-window");
    article.append(scopeSection);
    registerNodeGraphModuleScopeSlot(article, { nodeId: node, type, scopeElement: scopeSection });

    const ioSection = document.createElement("div");
    ioSection.className = "dsp-node-io-section";
    const inputColumn = createNodeGraphIoColumn(node, type, inputPorts, "input");
    ioSection.append(inputColumn || document.createElement("div"));
    ioSection.append(document.createElement("div"));
    article.append(ioSection);
  } else if (definition.layout === "graph") {
    const graphSection = document.createElement("div");
    graphSection.className = "node-module-graph-display";
    graphSection.dataset.graphNode = node;
    graphSection.tabIndex = 0;
    graphSection.setAttribute("aria-label", `${nodeGraphNodeDisplayName(node)} graph display`);
    article.append(graphSection);
    renderNodeGraphGraphDisplay(graphSection, patchNode.graph);

    const ioSection = document.createElement("div");
    ioSection.className = "dsp-node-io-section";
    const inputColumn = createNodeGraphIoColumn(node, type, inputPorts, "input");
    const outputColumn = createNodeGraphIoColumn(node, type, outputPorts, "output");
    ioSection.append(inputColumn || document.createElement("div"));
    ioSection.append(outputColumn || document.createElement("div"));
    article.append(ioSection);
  } else if (definition.layout === "sliderWidget") {
    article.append(createNodeGraphSliderWidgetBody(node, type));

    const ioSection = document.createElement("div");
    ioSection.className = "dsp-node-io-section node-slider-widget-io-section";
    ioSection.append(document.createElement("div"));
    const outputColumn = createNodeGraphIoColumn(node, type, outputPorts, "output");
    ioSection.append(outputColumn || document.createElement("div"));
    article.append(ioSection);
  } else if (definition.layout === "clapPlugin") {
    if (typeof createNodeGraphClapPluginBody === "function") {
      article.append(createNodeGraphClapPluginBody(node));
    }

    const ioSection = document.createElement("div");
    ioSection.className = "dsp-node-io-section";
    const inputColumn = createNodeGraphIoColumn(node, type, inputPorts, "input");
    const outputColumn = createNodeGraphIoColumn(node, type, outputPorts, "output");
    ioSection.append(inputColumn || document.createElement("div"));
    ioSection.append(outputColumn || document.createElement("div"));
    article.append(ioSection);
  } else if (definition.layout === "filterCurve") {
    article.append(createNodeGraphFilterCurveDisplay(node, type));

    const ioSection = document.createElement("div");
    ioSection.className = "dsp-node-io-section";
    const inputColumn = createNodeGraphIoColumn(node, type, inputPorts, "input");
    const outputColumn = createNodeGraphIoColumn(node, type, outputPorts, "output");
    ioSection.append(inputColumn || document.createElement("div"));
    ioSection.append(outputColumn || document.createElement("div"));
    article.append(ioSection);
  } else {
    const scopeSection = createNodeGraphModuleScopeSection(node, type);
    article.append(scopeSection);
    registerNodeGraphModuleScopeSlot(article, { nodeId: node, type, scopeElement: scopeSection });

    const ioSection = document.createElement("div");
    ioSection.className = "dsp-node-io-section";
    const inputColumn = createNodeGraphIoColumn(node, type, inputPorts, "input");
    const outputColumn = createNodeGraphIoColumn(node, type, outputPorts, "output");
    if (inputColumn) {
      ioSection.append(inputColumn);
    } else {
      ioSection.append(document.createElement("div"));
    }
    if (outputColumn) {
      ioSection.append(outputColumn);
    } else {
      ioSection.append(document.createElement("div"));
    }
    article.append(ioSection);
  }

  if (type === "audioInput") {
    const stateBadge = document.createElement("div");
    stateBadge.className = "node-live-input-state-badge";
    stateBadge.dataset.micState = "off";
    stateBadge.textContent = "mic off";
    article.append(stateBadge);
  }

  if (definition.parameters?.length && definition.layout !== "sliderWidget" && definition.layout !== "led") {
    const body = document.createElement("div");
    body.className = "dsp-node-body";

    for (const parameter of definition.parameters) {
      body.append(createNodeGraphParameter(node, type, parameter));
    }
    article.append(body);
  }

  attachNodeGraphNodeEvents(article);
  return article;
}

function registerExistingNodeGraphNodes() {
  nodeGraphMvp.activeNodes = new Set();
  for (const node of document.querySelectorAll(".dsp-node")) {
    node.dataset.nodeType ||= node.dataset.node;
    nodeGraphMvp.activeNodes.add(node.dataset.node);
    const scopeElement = node.querySelector(".node-module-scope-window");
    if (scopeElement) {
      registerNodeGraphModuleScopeSlot(node, {
        nodeId: node.dataset.node,
        scopeElement,
        type: node.dataset.nodeType,
      });
    }
    attachNodeGraphNodeEvents(node);
  }
}

function toggleNodeGraphModuleBypass(event) {
  const button = event.currentTarget;
  const node = button.closest(".dsp-node");
  toggleNodeGraphModuleBypassFromNode(node, event);
}
