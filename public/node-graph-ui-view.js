function nodeGraphUiItemTypeForNode(node) {
  return node?.type === "graph" ? "graphEditor" : "moduleControl";
}

function nodeGraphUiItemsPatchClone() {
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  patch.uiItems = normalizeNodeGraphPatchUiItems(patch.uiItems, {
    nodeIds: new Set(patch.nodes.map((node) => node.id)),
  });
  return patch;
}

function updateNodeGraphUiItem(itemId, updates, status = "ui item changed") {
  const patch = nodeGraphUiItemsPatchClone();
  const item = patch.uiItems.find((entry) => entry.id === itemId);
  if (!item) {
    return false;
  }
  Object.assign(item, updates);
  patch.uiItems = normalizeNodeGraphPatchUiItems(patch.uiItems, {
    nodeIds: new Set(patch.nodes.map((node) => node.id)),
  });
  commitNodeGraphPatch(patch, { status });
  if (!document.getElementById("nodeUiView")?.hidden) {
    renderNodeGraphUiView();
  }
  return true;
}

function nodeGraphUiItemFromElement(element) {
  const itemId = element?.closest?.(".node-ui-item")?.dataset?.uiItem || "";
  return normalizeNodeGraphPatchUiItems(nodeGraphMvp.patch.uiItems).find((item) => item.id === itemId) || null;
}

function beginNodeGraphUiItemDrag(event) {
  if (event.button !== undefined && event.button !== 0) {
    return;
  }
  const itemElement = event.currentTarget?.closest?.(".node-ui-item");
  const item = nodeGraphUiItemFromElement(itemElement);
  if (!item) {
    return;
  }
  nodeGraphMvp.uiItemDragging = {
    h: item.h,
    id: item.id,
    mode: "move",
    pointerId: event.pointerId ?? null,
    startX: event.clientX,
    startY: event.clientY,
    w: item.w,
    x: item.x,
    y: item.y,
  };
  itemElement.classList.add("dragging");
  event.currentTarget.setPointerCapture?.(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function beginNodeGraphUiItemResize(event) {
  if (event.button !== undefined && event.button !== 0) {
    return;
  }
  const itemElement = event.currentTarget?.closest?.(".node-ui-item");
  const item = nodeGraphUiItemFromElement(itemElement);
  if (!item) {
    return;
  }
  nodeGraphMvp.uiItemDragging = {
    h: item.h,
    id: item.id,
    mode: "resize",
    pointerId: event.pointerId ?? null,
    startX: event.clientX,
    startY: event.clientY,
    w: item.w,
    x: item.x,
    y: item.y,
  };
  itemElement.classList.add("resizing");
  event.currentTarget.setPointerCapture?.(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function dragNodeGraphUiItem(event) {
  const drag = nodeGraphMvp.uiItemDragging;
  if (!drag || (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)) {
    return;
  }
  const itemElement = document.querySelector(`.node-ui-item[data-ui-item="${CSS.escape(drag.id)}"]`);
  if (!itemElement) {
    return;
  }
  const dx = Math.round(event.clientX - drag.startX);
  const dy = Math.round(event.clientY - drag.startY);
  if (drag.mode === "resize") {
    const w = Math.max(180, Math.min(720, drag.w + dx));
    const h = Math.max(120, Math.min(420, drag.h + dy));
    itemElement.style.width = `${w}px`;
    itemElement.style.height = `${h}px`;
  } else {
    const x = Math.max(0, Math.min(2000, drag.x + dx));
    const y = Math.max(0, Math.min(2000, drag.y + dy));
    itemElement.style.left = `${x}px`;
    itemElement.style.top = `${y}px`;
  }
  event.preventDefault();
}

function endNodeGraphUiItemDrag(event) {
  const drag = nodeGraphMvp.uiItemDragging;
  if (!drag || (drag.pointerId !== null && event.pointerId !== undefined && drag.pointerId !== event.pointerId)) {
    return;
  }
  const itemElement = document.querySelector(`.node-ui-item[data-ui-item="${CSS.escape(drag.id)}"]`);
  itemElement?.classList.remove("dragging", "resizing");
  nodeGraphMvp.uiItemDragging = null;
  const dx = Math.round(event.clientX - drag.startX);
  const dy = Math.round(event.clientY - drag.startY);
  const updates = drag.mode === "resize"
    ? {
        h: Math.max(120, Math.min(420, drag.h + dy)),
        w: Math.max(180, Math.min(720, drag.w + dx)),
      }
    : {
        x: Math.max(0, Math.min(2000, drag.x + dx)),
        y: Math.max(0, Math.min(2000, drag.y + dy)),
      };
  updateNodeGraphUiItem(drag.id, updates, drag.mode === "resize" ? "ui item resized" : "ui item moved");
  event.preventDefault();
}

function bindNodeGraphUiViewEvents() {
  document.addEventListener("pointermove", dragNodeGraphUiItem);
  document.addEventListener("pointerup", endNodeGraphUiItemDrag);
  document.addEventListener("pointercancel", endNodeGraphUiItemDrag);
}

function createNodeGraphUiItemElement(item) {
  const sourceNode = nodeGraphPatchNode(item.sourceNodeId);
  const article = document.createElement("article");
  article.className = `node-ui-item node-ui-item-${item.type || "moduleControl"}`;
  article.dataset.uiItem = item.id;
  article.dataset.sourceNode = item.sourceNodeId;
  article.style.left = `${item.x}px`;
  article.style.top = `${item.y}px`;
  article.style.width = `${item.w}px`;
  article.style.height = `${item.h}px`;

  const header = document.createElement("div");
  header.className = "node-ui-item-header";
  header.addEventListener("pointerdown", beginNodeGraphUiItemDrag);
  const title = document.createElement("strong");
  title.textContent = sourceNode ? nodeGraphPatchNodeTitle(sourceNode) : item.label;
  const meta = document.createElement("span");
  meta.textContent = sourceNode?.type === "graph" ? "graph editor" : "ui item";
  header.append(title, meta);
  article.append(header);

  const body = document.createElement("div");
  body.className = "node-ui-item-body";
  if (sourceNode?.type === "graph") {
    const display = document.createElement("div");
    display.className = "node-module-graph-display node-ui-graph-display";
    display.dataset.graphNode = sourceNode.id;
    display.tabIndex = 0;
    display.setAttribute("aria-label", `${nodeGraphNodeDisplayName(sourceNode.id)} UI graph editor`);
    display.addEventListener("pointerdown", beginNodeGraphGraphNodeDrag, true);
    renderNodeGraphGraphDisplay(display, sourceNode.graph);
    body.append(display);
  } else {
    const empty = document.createElement("div");
    empty.className = "node-ui-item-placeholder";
    empty.textContent = sourceNode ? "UI control coming soon" : "missing source module";
    body.append(empty);
  }
  article.append(body);
  const resize = document.createElement("button");
  resize.className = "node-ui-item-resize";
  resize.type = "button";
  resize.setAttribute("aria-label", `Resize ${item.label}`);
  resize.addEventListener("pointerdown", beginNodeGraphUiItemResize);
  article.append(resize);
  return article;
}

function renderNodeGraphUiView() {
  const stage = document.getElementById("nodeUiViewStage");
  const status = document.getElementById("nodeUiViewStatus");
  if (!stage) {
    return;
  }
  const items = normalizeNodeGraphPatchUiItems(
    nodeGraphMvp.patch.uiItems,
    { nodeIds: new Set(nodeGraphMvp.patch.nodes.map((node) => node.id)) },
  );
  stage.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "node-ui-view-empty";
    empty.textContent = "Add a Graph module to UI from its action menu.";
    stage.append(empty);
  } else {
    items.forEach((item) => stage.append(createNodeGraphUiItemElement(item)));
  }
  if (status) {
    status.textContent = items.length === 1 ? "1 UI item" : `${items.length} UI items`;
  }
}
