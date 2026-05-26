const state = {
  response: null,
};

const requiredFlags = [
  ["callerOwnsProcessingOrder", true],
  ["callerOwnsDspObjects", true],
  ["circuitOwnsDspObjects", false],
  ["dspObjectsKnowCircuit", false],
  ["serializesPatch", false],
  ["ownsAudioEngine", false],
  ["ownsScheduler", false],
];

function artifactUrl(path) {
  return `/artifact?path=${encodeURIComponent(path)}`;
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function boolText(value) {
  return value ? "true" : "false";
}

function statusText(ok) {
  return ok ? "OK" : "Check";
}

function renderKeyValue(container, rows) {
  container.replaceChildren();
  for (const [key, value, expected] of rows) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = key;
    dd.textContent = value;
    if (expected !== undefined && value !== boolText(expected)) {
      dd.className = "warn";
    }
    container.append(dt, dd);
  }
}

function renderArtifacts(links) {
  const list = document.getElementById("artifactList");
  list.replaceChildren();
  for (const link of links) {
    const anchor = document.createElement("a");
    anchor.className = "artifact-row";
    anchor.href = artifactUrl(link.path);
    anchor.target = "_blank";
    anchor.rel = "noreferrer";

    const label = document.createElement("span");
    label.textContent = link.label;

    const kind = document.createElement("strong");
    kind.textContent = link.kind;

    const path = document.createElement("code");
    path.textContent = link.path;

    anchor.append(label, kind, path);
    list.append(anchor);
  }
}

function renderPhases(phases) {
  const list = document.getElementById("phaseList");
  list.replaceChildren();
  for (const phase of phases) {
    const item = document.createElement("div");
    item.className = "phase";

    const name = document.createElement("h3");
    name.textContent = phase.name;

    const body = document.createElement("dl");
    body.className = "kv compact";
    renderKeyValue(body, [
      ["preflight", boolText(phase.preflightOk), true],
      ["apply", boolText(phase.applyOk), true],
      ["process", boolText(phase.processOk), true],
      ["bindings", String(phase.bindingsChecked)],
      ["parameters", String(phase.parametersApplied)],
      ["samples", String(phase.samplesProcessed)],
    ]);

    item.append(name, body);
    list.append(item);
  }
}

function render(response) {
  state.response = response;
  const manifest = response.manifest;
  const handoff = manifest.sandboxHandoff;

  setText("manifestStatus", statusText(manifest.allOk));
  setText("contractStatus", `${handoff.contract} v${handoff.contractVersion}`);
  setText("inspectionMode", handoff.inspectionMode);
  setText("frameCount", String(manifest.wav.frames));
  setText("audioTitle", handoff.primaryAudioArtifact);
  setText("manifestPath", response.manifestPath);
  setText("artifactRoot", response.artifactRoot);

  const audio = document.getElementById("audioPlayer");
  audio.src = artifactUrl(handoff.primaryAudioArtifact);

  renderKeyValue(
    document.getElementById("boundaryFlags"),
    requiredFlags.map(([key, expected]) => [
      key,
      boolText(handoff[key]),
      expected,
    ]),
  );
  renderPhases(manifest.phases || []);
  renderArtifacts(manifest.artifactLinks || []);
}

function renderError(message) {
  setText("manifestStatus", "Check");
  setText("contractStatus", message);
  setText("inspectionMode", "Unavailable");
  setText("frameCount", "0");
}

async function loadManifest() {
  try {
    const response = await fetch("/api/manifest", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      renderError(payload.error || "Manifest failed");
      return;
    }
    render(payload);
  } catch (error) {
    renderError(error instanceof Error ? error.message : String(error));
  }
}

document
  .getElementById("refreshButton")
  .addEventListener("click", loadManifest);

loadManifest();
