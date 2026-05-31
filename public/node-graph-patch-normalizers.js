function normalizeNodeGraphPatchInfo(info = {}) {
  return {
    author: nodeGraphOneLineText(info.author),
    description: String(info.description ?? "").trim(),
    name: nodeGraphOneLineText(info.name),
    tags: nodeGraphOneLineText(info.tags),
  };
}

function normalizeNodeGraphPatchAudio(audio = {}) {
  const targetSampleRate = Number(audio?.targetSampleRate);
  return {
    targetSampleRate: Number.isFinite(targetSampleRate)
      ? Math.max(8000, Math.min(768000, targetSampleRate))
      : 88200,
  };
}

function normalizeNodeGraphPatchGrid(grid = {}) {
  const fallbackSize = Number(grid?.sizePx);
  const fallback = Number.isFinite(fallbackSize) && fallbackSize > 0
    ? fallbackSize
    : nodeGraphGrid.sizePx;
  const width = Number(grid?.widthPx);
  const height = Number(grid?.heightPx);
  const widthPx = Number.isFinite(width) && width > 0 ? width : fallback;
  const heightPx = Number.isFinite(height) && height > 0 ? height : fallback;
  return {
    heightPx: Math.max(8, Math.min(96, heightPx)),
    sizePx: Math.max(8, Math.min(96, Math.min(widthPx, heightPx))),
    widthPx: Math.max(8, Math.min(96, widthPx)),
  };
}

function normalizeNodeGraphWindowPosition(position = {}) {
  const source = position && typeof position === "object" ? position : {};
  const left = source.left === null || source.left === undefined ? NaN : Number(source.left);
  const top = source.top === null || source.top === undefined ? NaN : Number(source.top);
  return {
    left: Number.isFinite(left) ? Math.max(0, left) : null,
    top: Number.isFinite(top) ? Math.max(0, top) : null,
  };
}

function normalizeNodeGraphPatchWindows(windows = {}) {
  return {
    metadata: normalizeNodeGraphWindowPosition(windows.metadata),
    moduleActions: normalizeNodeGraphWindowPosition(windows.moduleActions),
  };
}

const nodeGraphWorkspaceViewLimits = Object.freeze({
  minHeightGu: 4,
  minWidthGu: 4,
});

function normalizeNodeGraphPatchView(view = {}) {
  const widthGu = Math.round(Number(view?.widthGu));
  const heightGu = Math.round(Number(view?.heightGu));
  return {
    heightGu: Number.isFinite(heightGu)
      ? Math.max(0, heightGu)
      : 0,
    widthGu: Number.isFinite(widthGu)
      ? Math.max(0, widthGu)
      : 0,
  };
}
