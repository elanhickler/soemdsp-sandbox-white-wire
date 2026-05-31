function formatNodeSliderNumber(value, options = {}) {
  const number = Number(value);
  const text = Number.isFinite(number) ? Number(number.toFixed(6)).toString() : "";
  if (options.showSign && number >= 0) {
    return `+${text}`;
  }
  return options.reserveSignSpace && number >= 0 ? ` ${text}` : text;
}

function nodeSliderShouldShowSign(slider) {
  return slider.dataset.showSign === "true";
}

function nodeSliderShouldDisplayChoices(slider) {
  return slider.dataset.displayChoices === "true";
}

function nodeSliderShouldDivideChoicesVisibly(slider) {
  return slider.dataset.divideChoicesVisibly === "true";
}

function nodeSliderShouldWraparound(slider) {
  return slider.dataset.wraparound === "true";
}

function nodeSliderShouldUseLinearSmoothing(slider) {
  return slider.dataset.linearSmoothing !== "false";
}

function nodeSliderShouldUseNonlinearSlider(slider) {
  return slider.dataset.nonlinearSlider === "true";
}

function formatNodeSliderCompactNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(6)).toString() : "";
}

function parseNodeMetadataNumber(value, fallback) {
  const number = Number(String(value).trim());
  return Number.isFinite(number) ? number : fallback;
}

function formatNodeMetadataStep(value) {
  return value > 0 ? formatNodeSliderCompactNumber(value) : "any";
}

function parseNodeMetadataChoices(value) {
  return String(value)
    .split(",")
    .map((choice) => choice.trim())
    .filter(Boolean);
}

function formatNodeMetadataChoices(choices) {
  return choices.join(", ");
}

function nodeSliderChoiceLabel(slider) {
  const metadata = nodeSliderMetadata(slider);
  if (!metadata.displayChoices || !metadata.choices.length) {
    return null;
  }

  const index = Math.round(Number(slider.value));
  if (!Number.isFinite(index)) {
    return null;
  }

  return metadata.choices[Math.max(0, Math.min(metadata.choices.length - 1, index))] ?? null;
}

function nodeGraphPatchChoiceLabel(metadata, value) {
  if (!metadata?.displayChoices || !metadata.choices?.length) {
    return null;
  }
  const index = Math.round(Number(value));
  if (!Number.isFinite(index)) {
    return null;
  }
  return metadata.choices[Math.max(0, Math.min(metadata.choices.length - 1, index))] ?? null;
}

function nodeSliderChoiceIndexFromText(slider, value) {
  const metadata = nodeSliderMetadata(slider);
  if (!metadata.displayChoices || !metadata.choices.length) {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  const exactIndex = metadata.choices.findIndex(
    (choice) => choice.toLowerCase() === normalized,
  );
  if (exactIndex >= 0) {
    return exactIndex;
  }

  const prefixMatches = metadata.choices
    .map((choice, index) => ({ choice: choice.toLowerCase(), index }))
    .filter((choice) => choice.choice.startsWith(normalized));
  return prefixMatches.length === 1 ? prefixMatches[0].index : null;
}

function nodeSliderMetadata(slider) {
  const min = Number(slider.min);
  const mid = Number(slider.dataset.mid);
  const max = Number(slider.max);
  const def = Number(slider.dataset.default);
  const cur = Number(slider.value);
  const step =
    slider.dataset.step && slider.dataset.step !== "any"
      ? Number(slider.dataset.step)
      : 0;
  return {
    choices: parseNodeMetadataChoices(slider.dataset.choices || ""),
    cur,
    def,
    displayChoices: nodeSliderShouldDisplayChoices(slider),
    divideChoicesVisibly: nodeSliderShouldDivideChoicesVisibly(slider),
    linearSmoothing: nodeSliderShouldUseLinearSmoothing(slider),
    nonlinearSlider: nodeSliderShouldUseNonlinearSlider(slider),
    showSign: nodeSliderShouldShowSign(slider),
    wraparound: nodeSliderShouldWraparound(slider),
    unit: slider.dataset.unit ?? "",
    kind: slider.dataset.kind || "decimal",
    max,
    mid,
    min,
    step,
  };
}

function formatNodeSliderMetadataTooltip(slider) {
  const metadata = nodeSliderMetadata(slider);
  const stepText = metadata.step > 0 ? formatNodeSliderNumber(metadata.step) : "any";
  const rows = [
    `current ${formatNodeSliderNumber(metadata.cur)}`,
    `default ${formatNodeSliderNumber(metadata.def)}`,
    `min ${formatNodeSliderNumber(metadata.min)}`,
    `max ${formatNodeSliderNumber(metadata.max)}`,
    `step ${stepText}`,
    `kind ${metadata.kind}`,
    `unit ${metadata.unit}`,
    `choices ${metadata.choices.length ? formatNodeMetadataChoices(metadata.choices) : "none"}`,
    `display choices ${metadata.displayChoices}`,
    `divide choices visibly ${metadata.divideChoicesVisibly}`,
    `linear smoothing ${metadata.linearSmoothing}`,
    `nonlinear slider ${metadata.nonlinearSlider}`,
    `show sign ${metadata.showSign}`,
    `wraparound ${metadata.wraparound}`,
  ];
  if (metadata.nonlinearSlider) {
    rows.splice(3, 0, `mid ${formatNodeSliderNumber(metadata.mid)}`);
  }
  return rows.join(" / ");
}

function syncNodeSliderMetadataTooltip(slider) {
  const tooltip = formatNodeSliderMetadataTooltip(slider);
  slider.setAttribute("aria-valuetext", tooltip);
  slider.removeAttribute("title");
  slider.closest(".node-slider-drag-surface")?.removeAttribute("title");
}
