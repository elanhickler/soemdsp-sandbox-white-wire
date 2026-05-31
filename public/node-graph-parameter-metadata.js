function nodeGraphDefaultParamsForType(type) {
  const params = {};
  for (const parameter of nodeGraphModuleDefinitions[type]?.parameters || []) {
    const value = Number(parameter.defaultValue);
    params[parameter.key] = Number.isFinite(value) ? value : 0;
  }
  return params;
}

function nodeGraphModuleOutputPorts(type) {
  const definition = nodeGraphModuleDefinitions[type];
  if (!definition) {
    return [];
  }
  return [
    ...(definition.outputs || []),
    ...(definition.parameters || []).map((parameter) => parameter.key),
  ];
}

function nodeGraphParameterOutputPort(type, port) {
  return nodeGraphModuleDefinitions[type]?.parameters?.find(
    (parameter) => parameter.key === port,
  ) || null;
}

function normalizeNodeGraphMetadataChoices(value, fallback = []) {
  const choices = Array.isArray(value)
    ? value
    : String(value ?? "").split(",");
  const normalized = choices
    .map((choice) => String(choice).trim())
    .filter(Boolean);
  return normalized.length ? normalized : [...fallback];
}

function nodeGraphParameterDefinitionMetadata(parameter) {
  if (!parameter) {
    return null;
  }
  const min = Number(parameter.min);
  const max = Number(parameter.max);
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) && max >= safeMin ? max : safeMin + 1;
  const mid = Number(parameter.mid);
  const def = Number(parameter.defaultValue);
  const step = Number(parameter.step);
  const safeMid = clampNodeSliderValue(Number.isFinite(mid) ? mid : (safeMin + safeMax) / 2, safeMin, safeMax);
  return {
    choices: normalizeNodeGraphMetadataChoices(parameter.choices || []),
    def: clampNodeSliderValue(Number.isFinite(def) ? def : safeMin, safeMin, safeMax),
    displayChoices: Boolean(parameter.displayChoices),
    divideChoicesVisibly: Object.hasOwn(parameter, "divideChoicesVisibly")
      ? Boolean(parameter.divideChoicesVisibly)
      : Boolean(parameter.choices?.length),
    kind: parameter.kind || "decimal",
    linearSmoothing: parameter.linearSmoothing !== false,
    max: safeMax,
    mid: safeMid,
    min: safeMin,
    nonlinearSlider: Object.hasOwn(parameter, "nonlinearSlider")
      ? Boolean(parameter.nonlinearSlider)
      : Math.abs(safeMid - (safeMin + safeMax) / 2) > Number.EPSILON,
    showSign: Boolean(parameter.showSign),
    step: Number.isFinite(step) && step > 0 ? step : 0,
    unit: parameter.unit ?? "",
    wraparound: Boolean(parameter.wraparound),
  };
}

function normalizeNodeMetadataKindTemplate(template = {}) {
  const choices = normalizeNodeGraphMetadataChoices(template.choices || []);
  const min = Number(template.min);
  const max = Number(template.max);
  const mid = Number(template.mid);
  const hasRange = Number.isFinite(min) && Number.isFinite(max) && max > min;
  const nonlinearSlider = Object.hasOwn(template, "nonlinearSlider")
    ? Boolean(template.nonlinearSlider)
    : hasRange && Number.isFinite(mid) && Math.abs(mid - (min + max) / 2) > Number.EPSILON;
  return {
    ...template,
    choices,
    divideChoicesVisibly: Object.hasOwn(template, "divideChoicesVisibly")
      ? Boolean(template.divideChoicesVisibly)
      : Boolean(choices.length),
    nonlinearSlider,
  };
}

function nodeGraphDefaultParamMetaForType(type) {
  const metadata = {};
  for (const parameter of nodeGraphModuleDefinitions[type]?.parameters || []) {
    metadata[parameter.key] = nodeGraphParameterDefinitionMetadata(parameter);
  }
  return metadata;
}

function normalizeNodeGraphPatchParameterMetadata(type, key, metadata = {}) {
  const parameter = nodeGraphModuleDefinitions[type]?.parameters?.find(
    (candidate) => candidate.key === key,
  );
  const fallback = nodeGraphParameterDefinitionMetadata(parameter);
  if (!fallback) {
    return null;
  }
  const source = metadata && typeof metadata === "object" ? metadata : {};
  let min = Number(Object.hasOwn(source, "min") ? source.min : fallback.min);
  let max = Number(Object.hasOwn(source, "max") ? source.max : fallback.max);
  if (!Number.isFinite(min)) {
    min = fallback.min;
  }
  if (!Number.isFinite(max)) {
    max = fallback.max;
  }
  if (min > max) {
    [min, max] = [max, min];
  }
  if (max <= min) {
    max = min + 1;
  }
  const mid = Number(Object.hasOwn(source, "mid") ? source.mid : fallback.mid);
  const def = Number(Object.hasOwn(source, "def") ? source.def : fallback.def);
  const step = Number(Object.hasOwn(source, "step") ? source.step : fallback.step);
  const choices = normalizeNodeGraphMetadataChoices(
    Object.hasOwn(source, "choices") ? source.choices : fallback.choices,
    fallback.choices,
  );
  return {
    choices,
    def: clampNodeSliderValue(Number.isFinite(def) ? def : fallback.def, min, max),
    displayChoices: Object.hasOwn(source, "displayChoices")
      ? Boolean(source.displayChoices)
      : fallback.displayChoices,
    divideChoicesVisibly: Object.hasOwn(source, "divideChoicesVisibly")
      ? Boolean(source.divideChoicesVisibly)
      : Boolean(fallback.divideChoicesVisibly || (choices.length && fallback.displayChoices)),
    kind: normalizeNodeMetadataKind(source.kind || fallback.kind),
    linearSmoothing: Object.hasOwn(source, "linearSmoothing")
      ? Boolean(source.linearSmoothing)
      : fallback.linearSmoothing,
    max,
    mid: clampNodeSliderValue(Number.isFinite(mid) ? mid : fallback.mid, min, max),
    min,
    nonlinearSlider: Object.hasOwn(source, "nonlinearSlider")
      ? Boolean(source.nonlinearSlider)
      : fallback.nonlinearSlider,
    showSign: Object.hasOwn(source, "showSign") ? Boolean(source.showSign) : fallback.showSign,
    step: Number.isFinite(step) && step > 0 ? step : 0,
    unit: String(Object.hasOwn(source, "unit") ? source.unit ?? "" : fallback.unit),
    wraparound: Object.hasOwn(source, "wraparound")
      ? Boolean(source.wraparound)
      : fallback.wraparound,
  };
}
