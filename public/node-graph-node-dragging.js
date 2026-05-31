function beginNodeGraphNodeDrag(event) {
  if (event.button !== undefined && event.button !== 0) {
    return;
  }
  const handle = event.currentTarget.closest(
    ".node-drag-handle, .node-header-title-row",
  );
  if (!handle) {
    return;
  }

  const node = handle.closest(".dsp-node");
  if (!node) {
    return;
  }

  const additiveSelection = event.ctrlKey || event.metaKey || event.shiftKey;
  const selectedNodeIds = nodeGraphSelectedNodeIds();
  const wasSelectedAtStart = selectedNodeIds.has(node.dataset.node);
  const point = nodeGraphClientPoint(event);
  const additiveDragSelection = additiveSelection;
  const pendingSelectionIds = new Set(selectedNodeIds);
  if (additiveDragSelection) {
    pendingSelectionIds.add(node.dataset.node);
  }
  const draggedNodeIds = wasSelectedAtStart || additiveDragSelection
    ? pendingSelectionIds
    : new Set([node.dataset.node]);
  const draggedNodes = [...draggedNodeIds]
    .map((id) => nodeGraphNodeElement(id))
    .filter(Boolean)
    .map((element) => {
      const x = Number.parseFloat(element.style.getPropertyValue("--node-x")) || 0;
      const y = Number.parseFloat(element.style.getPropertyValue("--node-y")) || 0;
      return {
        element,
        id: element.dataset.node,
        startX: x,
        startY: y,
      };
    });

  nodeGraphMvp.nodeDragging = {
    draggedNodes,
    handle,
    moved: false,
    node,
    startPoint: point,
    additiveSelection,
    additiveDragSelection,
    pendingSelectionIds: [...pendingSelectionIds],
    wasSelectedAtStart,
  };
  for (const dragged of draggedNodes) {
    dragged.element.classList.add("dragging");
  }
  handle.classList.add("dragging");
  handle.setPointerCapture(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function dragNodeGraphNode(event) {
  if (!nodeGraphMvp.nodeDragging) {
    return;
  }

  const { draggedNodes, startPoint } = nodeGraphMvp.nodeDragging;
  const point = nodeGraphClientPoint(event);
  const deltaX = point.x - startPoint.x;
  const deltaY = point.y - startPoint.y;
  if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
    nodeGraphMvp.nodeDragging.moved = true;
  }
  for (const dragged of draggedNodes) {
    positionNodeGraphNode(dragged.element, {
      x: dragged.startX + deltaX,
      y: dragged.startY + deltaY,
    }, { clamp: false });
  }
  drawNodeGraphWires();
}

function endNodeGraphNodeDrag(event) {
  if (!nodeGraphMvp.nodeDragging) {
    return;
  }

  const {
    additiveSelection,
    additiveDragSelection,
    draggedNodes,
    handle,
    moved,
    node,
    pendingSelectionIds,
  } = nodeGraphMvp.nodeDragging;
  for (const dragged of draggedNodes) {
    dragged.element.classList.remove("dragging");
  }
  handle.classList.remove("dragging");
  if (handle.hasPointerCapture?.(event.pointerId)) {
    handle.releasePointerCapture(event.pointerId);
  }
  nodeGraphMvp.nodeDragging = null;
  if (!moved) {
    toggleNodeGraphNodeSelection(node.dataset.node, additiveSelection);
    return;
  }
  if (additiveDragSelection) {
    setNodeGraphNodeSelection(pendingSelectionIds);
  }
  const patch = cloneNodeGraphPatch(nodeGraphMvp.patch);
  for (const dragged of draggedNodes) {
    const x = Number.parseFloat(dragged.element.style.getPropertyValue("--node-x")) || 0;
    const y = Number.parseFloat(dragged.element.style.getPropertyValue("--node-y")) || 0;
    const gridPoint = nodeGraphPixelToGrid({ x, y });
    const patchNode = patch.nodes.find((candidate) => candidate.id === dragged.id);
    if (patchNode) {
      patchNode.gx = gridPoint.gx;
      patchNode.gy = gridPoint.gy;
    }
  }
  commitNodeGraphPatch(patch, { status: "layout snapped" });
}
