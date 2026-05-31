function populateNodeMetadataKindChoices() {
  const select = document.getElementById("metadataKindValue");
  if (select.options.length) {
    return;
  }
  for (const [kind, template] of Object.entries(nodeMetadataKindTemplates)) {
    const option = document.createElement("option");
    option.value = kind;
    option.textContent = template.label;
    select.append(option);
  }
}

function normalizeNodeMetadataKind(kind) {
  return nodeMetadataKindAliases[kind] || kind || "decimal";
}

function applyNodeMetadataKindTemplates(templates) {
  if (!templates || typeof templates !== "object") {
    return;
  }

  nodeMetadataKindTemplates = Object.freeze(Object.fromEntries(
    Object.entries(templates).map(([kind, template]) => [
      kind,
      normalizeNodeMetadataKindTemplate(template),
    ]),
  ));
  const select = document.getElementById("metadataKindValue");
  if (select) {
    select.replaceChildren();
    populateNodeMetadataKindChoices();
  }
  if (nodeGraphMvp.metadataEditorTarget) {
    const slider = document.getElementById(nodeGraphMvp.metadataEditorTarget);
    if (slider) {
      fillNodeMetadataPopover(slider);
    }
  }
}

async function loadNodeMetadataKindTemplates() {
  try {
    const response = await fetch("/api/node-metadata-kinds", { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const payload = await response.json();
    if (payload?.ok === true) {
      applyNodeMetadataKindTemplates(payload.templates);
    }
  } catch (_error) {
    nodeMetadataKindTemplates = Object.freeze(Object.fromEntries(
      Object.entries(fallbackNodeMetadataKindTemplates).map(([kind, template]) => [
        kind,
        normalizeNodeMetadataKindTemplate(template),
      ]),
    ));
  }
}

function syncNodeMetadataMidVisibility() {
  const label = document.getElementById("metadataMidLabel");
  const checkbox = document.getElementById("metadataNonlinearSliderValue");
  if (label && checkbox) {
    label.hidden = !checkbox.checked;
  }
}
