function syncNodeSliderPortalHandle(readout, slider, position, enabled) {
  readout.classList.toggle("wraparound-slider", enabled);
  if (!enabled) {
    readout.style.removeProperty("--portal-left-width");
    readout.style.removeProperty("--portal-right-width");
    return;
  }

  const width = readout.getBoundingClientRect().width;
  if (!Number.isFinite(width) || width <= 0) {
    readout.style.setProperty("--portal-left-width", "0px");
    readout.style.setProperty("--portal-right-width", "0px");
    return;
  }

  const boundedPosition = Math.max(0, Math.min(100, position));
  const center = (boundedPosition / 100) * width;
  const handleHalfWidth = nodeSliderHandleHalfWidthPx;
  const leftOverflow = Math.max(0, handleHalfWidth - center);
  const rightOverflow = Math.max(0, center + handleHalfWidth - width);
  readout.style.setProperty("--portal-left-width", `${rightOverflow}px`);
  readout.style.setProperty("--portal-right-width", `${leftOverflow}px`);
}

function nodeSliderChoiceDividerBackground(readout, choices) {
  const width = Math.floor(readout.getBoundingClientRect().width);
  const dividerColor = "rgba(243, 241, 236, 0.2)";
  const dividerLayers = Array.from({ length: Math.max(0, choices.length - 1) }, (_, index) => {
    if (!Number.isFinite(width) || width <= 0) {
      const position = ((index + 1) / choices.length) * 100;
      return `linear-gradient(90deg, transparent 0 calc(${position}% - 0.5px), ${dividerColor} calc(${position}% - 0.5px) calc(${position}% + 0.5px), transparent calc(${position}% + 0.5px) 100%)`;
    }
    const position = Math.round(((index + 1) / choices.length) * width);
    return `linear-gradient(90deg, transparent 0 ${position}px, ${dividerColor} ${position}px ${position + 1}px, transparent ${position + 1}px 100%)`;
  });
  return dividerLayers.join(", ") || "none";
}

function nodeSliderReadCssNumber(element, property, fallback, min = -Infinity, max = Infinity) {
  const value = Number.parseFloat(getComputedStyle(element).getPropertyValue(property));
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, value));
}

function nodeSliderReadCssColor(element, property, fallback) {
  const value = getComputedStyle(element).getPropertyValue(property).trim();
  return value || fallback;
}

function nodeSliderHexToRgba(color, alpha) {
  const normalized = color.trim();
  const match = /^#?([0-9a-f]{6})$/i.exec(normalized);
  if (!match) {
    return normalized;
  }
  const value = match[1];
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function nodeSliderChoiceSlideStyle(readout) {
  const color = nodeSliderReadCssColor(readout, "--node-choice-slide-color", "#7fc7d9");
  const edgeBrightness = nodeSliderReadCssNumber(readout, "--node-choice-slide-edge-brightness", 0.85, 0, 1);
  const glowLevel = nodeSliderReadCssNumber(readout, "--node-choice-slide-glow-level", 0.45, 0, 1);
  return {
    color,
    edgeBrightness,
    fillOpacity: Math.min(0.42, 0.12 + glowLevel * 0.2),
    glowAlpha: glowLevel * 0.62,
    glowRadius: glowLevel * 8,
  };
}

function nodeSliderChoiceCellRects(width, height, choices, emptyPixelBorder = 0) {
  const layoutWidth = Math.floor(width);
  const layoutHeight = Math.round(height);
  const count = choices.length;
  if (!count || !Number.isFinite(layoutWidth) || !Number.isFinite(layoutHeight) || layoutWidth <= 0 || layoutHeight <= 0) {
    return [];
  }

  const boundedEmptyPixelBorder = Math.max(0, Math.min(8, Number(emptyPixelBorder) || 0));
  const strokeWidth = 1;
  const strokeInset = strokeWidth / 2;
  const wallRectPadding = boundedEmptyPixelBorder + strokeInset;
  const dividerRectPadding = boundedEmptyPixelBorder + strokeWidth + strokeInset;
  const trailingRectPadding = wallRectPadding;
  const verticalRectPadding = wallRectPadding;
  const contentHeight = Math.max(0, layoutHeight - verticalRectPadding * 2);
  return choices.map((_, index) => {
    const segmentLeft = Math.round((index / count) * layoutWidth);
    const segmentRight = Math.round(((index + 1) / count) * layoutWidth);
    const leadingRectPadding = index === 0 ? wallRectPadding : dividerRectPadding;
    const contentLeft = segmentLeft + leadingRectPadding;
    const contentRight = segmentRight - trailingRectPadding;
    return {
      height: contentHeight,
      left: contentLeft,
      top: verticalRectPadding,
      width: Math.max(0, contentRight - contentLeft),
    };
  });
}

function nodeSliderChoiceSquareRects(width, height, choices) {
  return nodeSliderChoiceCellRects(width, height, choices);
}

function nodeSliderChoiceDividerLines(width, height, choices) {
  const layoutWidth = Math.floor(width);
  const layoutHeight = Math.round(height);
  const count = choices.length;
  if (count <= 1 || !Number.isFinite(layoutWidth) || !Number.isFinite(layoutHeight) || layoutWidth <= 0 || layoutHeight <= 0) {
    return [];
  }
  return Array.from({ length: count - 1 }, (_, index) => ({
    x: Math.round(((index + 1) / count) * layoutWidth),
    height: layoutHeight,
  }));
}

function nodeSliderSnapStrokeCoordinate(localPosition, viewportOrigin, strokeWidth = 1) {
  const dpr = window.devicePixelRatio || 1;
  const strokeCenter = viewportOrigin + localPosition;
  const offset = strokeWidth % 2 === 0 ? 0 : 0.5;
  const snappedStrokeCenter = (Math.round(strokeCenter * dpr - offset) + offset) / dpr;
  return snappedStrokeCenter - viewportOrigin;
}

function nodeSliderSnapStrokeSpan(start, end, viewportOrigin, strokeWidth = 1) {
  const snappedStart = nodeSliderSnapStrokeCoordinate(start, viewportOrigin, strokeWidth);
  const snappedEnd = nodeSliderSnapStrokeCoordinate(end, viewportOrigin, strokeWidth);
  return {
    start: snappedStart,
    size: Math.max(0, snappedEnd - snappedStart),
  };
}

function syncNodeSliderChoiceDebugSquares(readout, choices, enabled) {
  let layer = readout.querySelector(".node-choice-debug-layer");
  if (!enabled) {
    layer?.remove();
    return;
  }
  if (!layer || layer.tagName.toLowerCase() !== "svg") {
    layer?.remove();
    layer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    layer.setAttribute("class", "node-choice-debug-layer");
    layer.setAttribute("aria-hidden", "true");
    layer.setAttribute("focusable", "false");
    readout.append(layer);
  }

  const layerRect = layer.getBoundingClientRect();
  const emptyPixelBorder = nodeSliderReadCssNumber(readout, "--node-choice-slide-empty-border", 0, 0, 8);
  const slideStyle = nodeSliderChoiceSlideStyle(readout);
  layer.setAttribute("viewBox", `0 0 ${layerRect.width.toFixed(3)} ${layerRect.height.toFixed(3)}`);
  layer.setAttribute("preserveAspectRatio", "none");
  const dividers = nodeSliderChoiceDividerLines(layerRect.width, layerRect.height, choices).map((divider, index) => {
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "line");
    const x = nodeSliderSnapStrokeCoordinate(divider.x, layerRect.left);
    marker.setAttribute("class", "node-choice-debug-divider");
    marker.setAttribute("data-choice-divider-index", String(index));
    marker.setAttribute("x1", x.toFixed(3));
    marker.setAttribute("x2", x.toFixed(3));
    marker.setAttribute("y1", "0");
    marker.setAttribute("y2", divider.height.toFixed(3));
    return marker;
  });
  const cells = nodeSliderChoiceCellRects(layerRect.width, layerRect.height, choices, emptyPixelBorder).map((cell, index) => {
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    marker.setAttribute("class", "node-choice-debug-square node-choice-debug-cell");
    marker.setAttribute("data-choice-index", String(index));
    marker.setAttribute("x", cell.left.toFixed(3));
    marker.setAttribute("y", cell.top.toFixed(3));
    marker.setAttribute("width", cell.width.toFixed(3));
    marker.setAttribute("height", cell.height.toFixed(3));
    marker.style.fill = slideStyle.color;
    marker.style.fillOpacity = String(slideStyle.fillOpacity);
    marker.style.stroke = slideStyle.color;
    marker.style.strokeOpacity = String(slideStyle.edgeBrightness);
    marker.style.filter = slideStyle.glowLevel <= 0
      ? "none"
      : `drop-shadow(0 0 ${slideStyle.glowRadius.toFixed(2)}px ${nodeSliderHexToRgba(slideStyle.color, slideStyle.glowAlpha.toFixed(3))})`;
    return marker;
  });
  layer.replaceChildren(...dividers, ...cells);
}

function syncNodeSliderReadout(slider) {
  const readout = slider.closest("label")?.querySelector(".node-slider-readout");
  if (!readout) {
    return;
  }

  if (!readout.querySelector(".node-slider-readout-value")) {
    readout.textContent = "";
    populateNodeSliderReadoutShell(readout);
  }
  const labelText = readout.querySelector(".node-slider-readout-label");
  const valueText = readout.querySelector(".node-slider-readout-value");
  const unitText = readout.querySelector(".node-slider-readout-unit");
  const position = nodeSliderTravelFromValue(slider, Number(slider.value)) * 100;
  const unit = (slider.dataset.unit || "").trim();
  const choiceLabel = nodeSliderChoiceLabel(slider);
  const choices = parseNodeMetadataChoices(slider.dataset.choices || "");
  const usesChoices = nodeSliderShouldDisplayChoices(slider) && choices.length > 0;
  const dividesChoices = usesChoices && nodeSliderShouldDivideChoicesVisibly(slider);
  const usesNumericReadout = !choiceLabel;
  const usesPortalWrap = nodeSliderShouldWraparound(slider) && !usesChoices;
  if (labelText) {
    labelText.textContent = readout.dataset.paramLabel || nodeSliderLabelText(slider);
  }
  valueText.textContent = choiceLabel ? ` ${choiceLabel}` : formatNodeSliderNumber(slider.value, {
    reserveSignSpace: true,
    showSign: nodeSliderShouldShowSign(slider),
  });
  unitText.textContent = unit;
  unitText.classList.toggle("is-empty", !unit);
  unitText.setAttribute("aria-hidden", unit ? "false" : "true");
  readout.dataset.value = slider.value;
  readout.dataset.unit = unit;
  readout.dataset.choiceCount = usesChoices ? String(choices.length) : "0";
  readout.classList.toggle("choices-divided", dividesChoices);
  readout.classList.toggle("reserves-sign-column", usesNumericReadout || usesChoices);
  readout.removeAttribute("title");
  if (dividesChoices) {
    readout.style.removeProperty("--value-start");
    readout.style.removeProperty("--value-end");
    readout.style.setProperty("--choice-divider-background", "none");
    syncNodeSliderChoiceDebugSquares(readout, choices, true);
    syncNodeSliderPortalHandle(readout, slider, position, false);
  } else {
    const boundedPosition = Math.max(0, Math.min(100, position));
    readout.style.setProperty(
      "--value-start",
      `calc(${boundedPosition}% - ${nodeSliderHandleHalfWidthPx}px)`,
    );
    readout.style.setProperty(
      "--value-end",
      `calc(${boundedPosition}% + ${nodeSliderHandleHalfWidthPx}px)`,
    );
    readout.style.setProperty("--choice-divider-background", "none");
    syncNodeSliderChoiceDebugSquares(readout, choices, false);
    syncNodeSliderPortalHandle(readout, slider, boundedPosition, usesPortalWrap);
  }
  syncNodeSliderMetadataTooltip(slider);
}

function nodeSliderLabelText(slider) {
  const controlLabel = slider.closest(".node-parameter-control")?.dataset.paramLabel?.trim();
  if (controlLabel) {
    return controlLabel;
  }
  const label = slider.closest("label");
  if (!label) {
    return slider.id;
  }
  for (const node of label.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (text) {
        return text;
      }
    }
  }
  return slider.id;
}

function nodeSliderDebugPath(slider) {
  const node = slider.closest(".dsp-node");
  const nodeName = node ? nodeGraphNodeDisplayName(node.dataset.node) : "Node";
  return `${nodeName} : ${nodeSliderLabelText(slider)} : Metadata`;
}
