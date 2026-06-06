function nodeGraphViewportImageFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `soemdsp-modular-view-${stamp}.png`;
}

function nodeGraphViewportReadableStyles() {
  const parts = [];
  for (const sheet of document.styleSheets) {
    try {
      const rules = sheet.cssRules;
      if (!rules) {
        continue;
      }
      for (const rule of rules) {
        parts.push(rule.cssText);
      }
    } catch {
      // Cross-origin sheets are skipped; the sandbox styles are same-origin.
    }
  }
  return parts.join("\n");
}

function nodeGraphViewportCanvasImage(sourceCanvas) {
  const image = document.createElement("img");
  image.className = sourceCanvas.className;
  image.setAttribute("aria-hidden", "true");
  image.style.cssText = sourceCanvas.style.cssText;
  image.style.width = `${sourceCanvas.offsetWidth || sourceCanvas.width}px`;
  image.style.height = `${sourceCanvas.offsetHeight || sourceCanvas.height}px`;
  try {
    image.src = sourceCanvas.toDataURL("image/png");
  } catch {
    const fallback = document.createElement("canvas");
    fallback.width = Math.max(1, sourceCanvas.width || sourceCanvas.offsetWidth || 1);
    fallback.height = Math.max(1, sourceCanvas.height || sourceCanvas.offsetHeight || 1);
    image.src = fallback.toDataURL("image/png");
  }
  return image;
}

function replaceNodeGraphViewportCloneCanvases(source, clone) {
  const sourceCanvases = [...source.querySelectorAll("canvas")];
  const cloneCanvases = [...clone.querySelectorAll("canvas")];
  sourceCanvases.forEach((sourceCanvas, index) => {
    const cloneCanvas = cloneCanvases[index];
    if (!cloneCanvas) {
      return;
    }
    cloneCanvas.replaceWith(nodeGraphViewportCanvasImage(sourceCanvas));
  });
}

function cloneNodeGraphViewportForImage(workspace) {
  const clone = workspace.cloneNode(true);
  clone.querySelector("#nodeGraphResizeHandle")?.remove();
  clone.querySelector("#nodeModularOnlyBackButton")?.remove();
  clone.querySelector("#nodeSelectionMarquee")?.remove();
  clone.querySelector("#nodeCameraOverlayLayer")?.remove();
  replaceNodeGraphViewportCloneCanvases(workspace, clone);
  clone.removeAttribute("id");
  clone.style.width = `${Math.round(workspace.clientWidth)}px`;
  clone.style.height = `${Math.round(workspace.clientHeight)}px`;
  clone.style.margin = "0";
  return clone;
}

function nodeGraphViewportSvgMarkup(clone, width, height) {
  const styles = nodeGraphViewportReadableStyles().replaceAll("]]>", "]]]]><![CDATA[>");
  const bodyClass = document.body.className;
  const html = new XMLSerializer().serializeToString(clone);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" class="${bodyClass}">
      <style><![CDATA[${styles}]]></style>
      ${html}
    </div>
  </foreignObject>
</svg>`;
}

function nodeGraphImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("viewport image decode failed"));
    };
    image.src = url;
  });
}

function nodeGraphCanvasToPngBlob(canvas) {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    } catch {
      resolve(null);
    }
  });
}

async function createNodeGraphViewportImageBlob() {
  const image = await createNodeGraphViewportImage();
  return image?.pngBlob || null;
}

async function createNodeGraphViewportImage() {
  const workspace = document.getElementById("nodeGraphWorkspace");
  if (!workspace) {
    return null;
  }
  if (typeof drawNodeGraphWires === "function") {
    drawNodeGraphWires();
  }
  const width = Math.max(1, Math.round(workspace.clientWidth || workspace.getBoundingClientRect().width));
  const height = Math.max(1, Math.round(workspace.clientHeight || workspace.getBoundingClientRect().height));
  const clone = cloneNodeGraphViewportForImage(workspace);
  const svgBlob = new Blob([nodeGraphViewportSvgMarkup(clone, width, height)], {
    type: "image/svg+xml;charset=utf-8",
  });
  const image = await nodeGraphImageFromBlob(svgBlob);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);
  return {
    height,
    pngBlob: await nodeGraphCanvasToPngBlob(canvas),
    svgBlob,
    width,
  };
}

function setNodeGraphViewportImageButtonStatus(text) {
  const button = document.getElementById("nodeCopyViewportImageButton");
  if (!button) {
    return;
  }
  if (!button.dataset.defaultText) {
    button.dataset.defaultText = button.textContent;
  }
  button.textContent = text;
  window.clearTimeout(Number(button.dataset.statusTimer) || 0);
  button.dataset.statusTimer = String(window.setTimeout(() => {
    button.textContent = button.dataset.defaultText || "Copy Viewport Image";
    button.dataset.statusTimer = "";
  }, 1400));
}

async function copyNodeGraphViewportImageToClipboard() {
  const button = document.getElementById("nodeCopyViewportImageButton");
  if (!navigator.clipboard?.write || typeof ClipboardItem !== "function") {
    setNodeGraphViewportImageButtonStatus("Clipboard Unavailable");
    return;
  }
  let image = null;
  try {
    if (button) {
      button.disabled = true;
    }
    image = await createNodeGraphViewportImage();
    if (!image?.pngBlob && !image?.svgBlob) {
      setNodeGraphViewportImageButtonStatus("Copy Failed");
      return;
    }
  } catch (_error) {
    console.warn("Viewport image capture failed", _error);
    setNodeGraphViewportImageButtonStatus("Copy Failed");
    if (button) {
      button.disabled = false;
    }
    return;
  }
  try {
    const clipboardType = image.pngBlob ? "image/png" : "image/svg+xml";
    const clipboardBlob = image.pngBlob || image.svgBlob;
    await navigator.clipboard.write([
      new ClipboardItem({ [clipboardType]: clipboardBlob }),
    ]);
    setNodeGraphViewportImageButtonStatus(image.pngBlob ? "Viewport Copied" : "SVG Copied");
  } catch (_error) {
    setNodeGraphViewportImageButtonStatus("Copy Blocked");
  } finally {
    if (button) {
      button.disabled = false;
    }
  }
}
