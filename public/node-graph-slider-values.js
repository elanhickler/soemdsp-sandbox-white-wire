const nodeSliderHandleHalfWidthPx = 8;
const nodeSliderHandleLeftWallClearancePx = 1;
const nodeSliderHandleRightWallClearancePx = 3;
const nodeSliderMinSkewExponent = 0.25;
const nodeSliderMaxSkewExponent = 4;
const nodeGraphAutoSmoothingDefaultSeconds = 0.016;

function clampNodeGraphAutoSmoothingSeconds(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value)) {
    return nodeGraphAutoSmoothingDefaultSeconds;
  }
  return Math.max(0, value);
}

function nodeGraphSmoothingFrequencyFromSeconds(seconds) {
  const normalized = clampNodeGraphAutoSmoothingSeconds(seconds);
  return normalized <= 0 ? 0 : 1 / normalized;
}

function nodeGraphSmoothingSampleRate() {
  const rate = Number(nodeGraphMvp?.sampleRate);
  return Number.isFinite(rate) && rate > 0 ? rate : 44100;
}

function nodeGraphSmoothingSamplesFromSeconds(seconds) {
  return Math.max(0, Math.round(clampNodeGraphAutoSmoothingSeconds(seconds) * nodeGraphSmoothingSampleRate()));
}

function nodeGraphSmoothingSecondsFromSamples(samples) {
  const value = Number(samples);
  const safeSamples = Number.isFinite(value) ? Math.max(0, value) : nodeGraphSmoothingSamplesFromSeconds(nodeGraphAutoSmoothingDefaultSeconds);
  return clampNodeGraphAutoSmoothingSeconds(safeSamples / nodeGraphSmoothingSampleRate());
}

function nodeGraphDefaultSmoothingBlockSeconds() {
  return clampNodeGraphAutoSmoothingSeconds(128 / nodeGraphSmoothingSampleRate());
}

function nodeGraphNumericModifierReserved(event) {
  return Boolean(event?.shiftKey && (event.ctrlKey || event.metaKey) && event.altKey);
}

function nodeGraphNumericDragMultiplier(event) {
  if (nodeGraphNumericModifierReserved(event)) {
    return 0;
  }
  if (event?.shiftKey && (event.ctrlKey || event.metaKey)) {
    return 0.01;
  }
  if (event?.shiftKey || event?.ctrlKey || event?.metaKey) {
    return 0.1;
  }
  if (event?.altKey) {
    return 10;
  }
  return 1;
}

function clampNodeSliderValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrapNodeSliderValue(value, min, max) {
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) {
    return min;
  }
  return min + ((((value - min) % range) + range) % range);
}

function shortestNodeGraphWrapDelta(from, to, min, max) {
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) {
    return to - from;
  }
  let delta = to - from;
  if (delta > range / 2) {
    delta -= range;
  } else if (delta < -range / 2) {
    delta += range;
  }
  return delta;
}

function nodeGraphOnePoleParameterLowpassSample(state, input, frequency, rate) {
  const safeRate = Math.max(1, Number(rate) || nodeGraphMvp?.sampleRate || 44100);
  const safeInput = Number.isFinite(Number(input)) ? Number(input) : state.outputBuffer || 0;
  const frequencyValue = Math.max(0, Number.isFinite(Number(frequency)) ? Number(frequency) : 0);
  const w = Math.min((Math.PI * 2) / safeRate, 0.000142475857) * frequencyValue;
  const a1 = Math.exp(-w);
  const b0 = 1 - a1;
  state.outputBuffer = b0 * safeInput + a1 * (Number(state.outputBuffer) || 0);
  return state.outputBuffer;
}

function normalizeNodeGraphSmootherSignal(value, metadata = {}) {
  if (typeof nodeGraphParameterValueToNormalizedSignal === "function") {
    return nodeGraphParameterValueToNormalizedSignal(value, metadata);
  }
  const min = Number(metadata.min);
  const max = Number(metadata.max);
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) {
    return 0;
  }
  return clampNodeSliderValue((Number(value) - min) / range, 0, 1);
}

function denormalizeNodeGraphSmootherSignal(signal, metadata = {}) {
  if (typeof nodeGraphNormalizedSignalToParameterValue === "function") {
    return nodeGraphNormalizedSignalToParameterValue(signal, metadata);
  }
  const min = Number(metadata.min);
  const max = Number(metadata.max);
  const range = max - min;
  return Number.isFinite(range) && range > 0 ? min + range * clampNodeSliderValue(signal, 0, 1) : signal;
}

function createNodeGraphParameterSmoother(initialValue, metadata = {}) {
  const value = Number(initialValue);
  const safeValue = Number.isFinite(value) ? value : 0;
  const signal = normalizeNodeGraphSmootherSignal(safeValue, metadata);
  return {
    current: safeValue,
    linearSmoothing: metadata.linearSmoothing !== false,
    max: Number.isFinite(Number(metadata.max)) ? Number(metadata.max) : 1,
    metadata,
    min: Number.isFinite(Number(metadata.min)) ? Number(metadata.min) : 0,
    nonlinearSmoothing: Boolean(metadata.nonlinearSlider),
    outputBuffer: signal,
    targetSignal: signal,
    target: safeValue,
    lastFrame: -1,
    lastValue: safeValue,
    wraparound: Boolean(metadata.wraparound),
  };
}

function updateNodeGraphParameterSmoother(smoother, targetValue, metadata = {}) {
  const value = Number(targetValue);
  smoother.target = Number.isFinite(value) ? value : smoother.target;
  smoother.linearSmoothing = metadata.linearSmoothing !== false;
  smoother.max = Number.isFinite(Number(metadata.max)) ? Number(metadata.max) : smoother.max;
  smoother.metadata = metadata;
  smoother.min = Number.isFinite(Number(metadata.min)) ? Number(metadata.min) : smoother.min;
  smoother.nonlinearSmoothing = Boolean(metadata.nonlinearSlider);
  smoother.targetSignal = normalizeNodeGraphSmootherSignal(smoother.target, metadata);
  smoother.wraparound = Boolean(metadata.wraparound);
  if (!smoother.linearSmoothing) {
    smoother.current = smoother.target;
    smoother.outputBuffer = smoother.targetSignal;
    smoother.lastValue = smoother.target;
  }
}

function readNodeGraphSmoothedParameter(smoother, frame, frames) {
  if (!smoother || !smoother.linearSmoothing) {
    return smoother?.target ?? 0;
  }
  if (smoother.nonlinearSmoothing) {
    if (smoother.lastFrame === frame) {
      return smoother.lastValue;
    }
    const smoothingSeconds = clampNodeGraphAutoSmoothingSeconds(nodeGraphMvp?.live?.autoSmoothingSeconds);
    if (smoothingSeconds <= 0) {
      smoother.current = smoother.target;
      smoother.outputBuffer = smoother.targetSignal;
      smoother.lastFrame = frame;
      smoother.lastValue = smoother.target;
      return smoother.target;
    }
    const signal = nodeGraphOnePoleParameterLowpassSample(
      smoother,
      smoother.targetSignal,
      nodeGraphSmoothingFrequencyFromSeconds(smoothingSeconds),
      nodeGraphMvp?.sampleRate || 44100,
    );
    const value = denormalizeNodeGraphSmootherSignal(signal, smoother.metadata);
    smoother.current = value;
    smoother.lastFrame = frame;
    smoother.lastValue = value;
    return value;
  }
  if (frames <= 1) {
    return smoother.target;
  }
  const progress = (frame + 1) / frames;
  const delta = smoother.wraparound
    ? shortestNodeGraphWrapDelta(
      smoother.current,
      smoother.target,
      smoother.min,
      smoother.max,
    )
    : smoother.target - smoother.current;
  const value = smoother.current + delta * progress;
  return smoother.wraparound
    ? wrapNodeSliderValue(value, smoother.min, smoother.max)
    : value;
}

function finishNodeGraphParameterSmoothing(smoothers) {
  for (const smoother of smoothers.values()) {
    if (smoother.nonlinearSmoothing) {
      smoother.current = smoother.lastValue ?? smoother.current;
      smoother.lastFrame = -1;
      continue;
    }
    smoother.current = smoother.wraparound
      ? wrapNodeSliderValue(smoother.target, smoother.min, smoother.max)
      : smoother.target;
  }
}

function normalizeNodeSliderValue(slider, value, min = Number(slider.min), max = Number(slider.max)) {
  if (!Number.isFinite(value)) {
    return Number.isFinite(min) ? min : 0;
  }
  return nodeSliderShouldWraparound(slider)
    ? wrapNodeSliderValue(value, min, max)
    : clampNodeSliderValue(value, min, max);
}

function normalizedNodeSliderMid(slider) {
  const min = Number(slider.min);
  const max = Number(slider.max);
  const mid = clampNodeSliderValue(Number(slider.dataset.mid), min, max);
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) {
    return 0.5;
  }

  return clampNodeSliderValue((mid - min) / range, 0.000001, 0.999999);
}

function nodeSliderSkewExponent(slider) {
  if (!nodeSliderShouldUseNonlinearSlider(slider)) {
    return 1;
  }
  const exponent = Math.log(normalizedNodeSliderMid(slider)) / Math.log(0.5);
  return clampNodeSliderValue(exponent, nodeSliderMinSkewExponent, nodeSliderMaxSkewExponent);
}

function normalizeNodeSliderTravel(slider, travel) {
  const number = Number(travel);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return nodeSliderShouldWraparound(slider)
    ? wrapNodeSliderValue(number, 0, 1)
    : clampNodeSliderValue(number, 0, 1);
}

function nodeSliderValueFromTravel(slider, travel) {
  const min = Number(slider.min);
  const max = Number(slider.max);
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) {
    return min;
  }

  const exponent = nodeSliderSkewExponent(slider);
  const normalizedTravel = normalizeNodeSliderTravel(slider, travel);
  return min + range * normalizedTravel ** exponent;
}

function nodeSliderValueFromPointerTravel(slider, travel) {
  const min = Number(slider.min);
  const max = Number(slider.max);
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) {
    return min;
  }

  const exponent = nodeSliderSkewExponent(slider);
  const normalizedTravel = normalizeNodeSliderTravel(slider, travel);
  return min + range * normalizedTravel ** exponent;
}

function nodeSliderValueFromRelativeTravel(slider, travel) {
  const min = Number(slider.min);
  const max = Number(slider.max);
  const range = max - min;
  const numericTravel = Number(travel);
  if (!Number.isFinite(range) || range <= 0 || !Number.isFinite(numericTravel)) {
    return min;
  }
  if (numericTravel < 0 && slider.dataset.unboundedMin === "true") {
    return min + range * numericTravel;
  }
  if (numericTravel > 1 && slider.dataset.unboundedMax === "true") {
    return max + range * (numericTravel - 1);
  }
  return nodeSliderValueFromPointerTravel(slider, numericTravel);
}

function nodeSliderTravelFromValue(slider, value) {
  const min = Number(slider.min);
  const max = Number(slider.max);
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) {
    return 0;
  }

  const exponent = nodeSliderSkewExponent(slider);
  const normalizedValue = clampNodeSliderValue((value - min) / range, 0, 1);
  return normalizedValue ** (1 / exponent);
}

function nodeSliderElementLayoutWidth(element) {
  const width = Number(element?.clientWidth || element?.offsetWidth || 0);
  if (Number.isFinite(width) && width > 0) {
    return width;
  }
  const rectWidth = Number(element?.getBoundingClientRect?.().width) || 0;
  const zoom = Math.max(0.01, Number(nodeGraphMvp?.zoom) || 1);
  return Math.max(0, rectWidth / zoom);
}

function nodeSliderElementLayoutHeight(element) {
  const height = Number(element?.clientHeight || element?.offsetHeight || 0);
  if (Number.isFinite(height) && height > 0) {
    return height;
  }
  const rectHeight = Number(element?.getBoundingClientRect?.().height) || 0;
  const zoom = Math.max(0.01, Number(nodeGraphMvp?.zoom) || 1);
  return Math.max(0, rectHeight / zoom);
}

function nodeSliderElementVisualScale(element) {
  const layoutWidth = nodeSliderElementLayoutWidth(element);
  const rectWidth = Number(element?.getBoundingClientRect?.().width) || 0;
  if (!Number.isFinite(layoutWidth) || !Number.isFinite(rectWidth) || layoutWidth <= 0 || rectWidth <= 0) {
    return 1;
  }
  return Math.max(0.01, rectWidth / layoutWidth);
}

function nodeSliderVisualLane(surface, slider) {
  const width = nodeSliderElementLayoutWidth(surface);
  const handleHalfWidth = Math.min(nodeSliderHandleHalfWidthPx, width / 2);
  const maxClearance = Math.max(0, width / 2 - handleHalfWidth);
  const leftClearance = nodeSliderShouldWraparound(slider)
    ? 0
    : Math.min(nodeSliderHandleLeftWallClearancePx, maxClearance);
  const rightClearance = nodeSliderShouldWraparound(slider)
    ? 0
    : Math.min(nodeSliderHandleRightWallClearancePx, maxClearance);
  const leftInset = nodeSliderShouldWraparound(slider) ? 0 : handleHalfWidth + leftClearance;
  const rightInset = nodeSliderShouldWraparound(slider) ? 0 : handleHalfWidth + rightClearance;
  return {
    handleHalfWidth,
    inset: leftInset,
    leftInset,
    rightInset,
    travelWidth: Math.max(1, width - leftInset - rightInset),
    width: Math.max(1, width),
  };
}

function nodeSliderVisualCenterFromTravel(slider, surface, travel) {
  const lane = nodeSliderVisualLane(surface, slider);
  const normalizedTravel = normalizeNodeSliderTravel(slider, travel);
  return lane.inset + normalizedTravel * lane.travelWidth;
}

function nodeSliderHandleRangeFromTravel(slider, surface, travel) {
  const lane = nodeSliderVisualLane(surface, slider);
  const center = nodeSliderVisualCenterFromTravel(slider, surface, travel);
  return {
    center,
    end: center + lane.handleHalfWidth,
    handleHalfWidth: lane.handleHalfWidth,
    start: center - lane.handleHalfWidth,
    width: lane.width,
  };
}

function nodeSliderTravelFromPointer(slider, surface, clientX) {
  const rect = surface.getBoundingClientRect();
  const lane = nodeSliderVisualLane(surface, slider);
  const scale = nodeSliderElementVisualScale(surface);
  const x = (clientX - rect.left) / scale;
  return normalizeNodeSliderTravel(slider, (x - lane.inset) / lane.travelWidth);
}

function setNodeSliderMetadata(slider, metadata) {
  const control = slider.closest(".node-parameter-control");
  const alias = normalizeNodeGraphPatchMetadataAlias(metadata.alias);
  slider.dataset.alias = alias;
  if (control) {
    control.dataset.paramLabel = alias || control.dataset.defaultParamLabel || control.dataset.paramLabel || "";
    control.setAttribute("aria-label", control.dataset.paramLabel || slider.dataset.param || slider.id);
  }
  slider.min = String(metadata.min);
  slider.max = String(metadata.max);
  slider.dataset.mid = String(clampNodeSliderValue(metadata.mid, metadata.min, metadata.max));
  slider.dataset.default = String(
    clampNodeSliderValue(metadata.def, metadata.min, metadata.max),
  );
  slider.step = metadata.step > 0 ? String(metadata.step) : "any";
  slider.dataset.step = slider.step;
  slider.dataset.kind = metadata.kind || "decimal";
  slider.dataset.maxDigits = String(
    normalizeNodeGraphMetadataMaxDigits(metadata.maxDigits, metadata.kind),
  );
  slider.dataset.unit = metadata.unit ?? "";
  slider.dataset.choices = formatNodeMetadataChoices(metadata.choices || []);
  slider.dataset.displayChoices = metadata.displayChoices ? "true" : "false";
  slider.dataset.divideChoicesVisibly = metadata.divideChoicesVisibly ? "true" : "false";
  slider.dataset.linearSmoothing = metadata.linearSmoothing ? "true" : "false";
  slider.dataset.nonlinearSlider = metadata.nonlinearSlider ? "true" : "false";
  slider.dataset.showSign = metadata.showSign ? "true" : "false";
  slider.dataset.unboundedMax = metadata.unboundedMax ? "true" : "false";
  slider.dataset.unboundedMin = metadata.unboundedMin ? "true" : "false";
  slider.dataset.wraparound = metadata.wraparound ? "true" : "false";
  slider.value = String(normalizeNodeSliderValue(slider, Number(slider.value), metadata.min, metadata.max));
  syncNodeSliderReadout(slider);
}

function quantizeNodeSliderDragValue(slider, value) {
  const step = Number(slider.dataset.step);
  if (!Number.isFinite(step) || step <= 0) {
    return value;
  }

  const min = Number(slider.min);
  const origin = Number.isFinite(min) ? min : 0;
  return origin + Math.round((value - origin) / step) * step;
}
