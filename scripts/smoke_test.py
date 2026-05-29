from __future__ import annotations

import argparse
from html.parser import HTMLParser
import json
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Callable
from wave import Error as WaveError
from wave import open as open_wave


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
DEFAULT_MANIFEST = (
    ROOT.parent / "soemdsp" / "runtime_dsp_object_bound_wav_resync_demo.manifest.json"
)
SOEMDSP_META_HEADER = ROOT.parent / "soemdsp" / "include" / "soemdsp" / "meta.hpp"
EXPECTED_CONTRACT = "soemdsp-demo-local-sandbox-handoff"
EXPECTED_CONTRACT_VERSION = 1
EXPECTED_INSPECTION_MODE = "mouse-and-ears"
EXPECTED_META_KINDS = {
    "amplitude",
    "bypass",
    "decibels",
    "decimal",
    "decimal_bipolar",
    "descrete",
    "frequency",
    "integer_bipolar",
    "momentary",
    "onoff",
    "phase",
    "pitch",
    "plusminus",
    "seconds",
    "sustain",
    "waveform",
}
REQUIRED_FLAGS = {
    "callerOwnsProcessingOrder": True,
    "callerOwnsDspObjects": True,
    "circuitOwnsDspObjects": False,
    "dspObjectsKnowCircuit": False,
    "serializesPatch": False,
    "ownsAudioEngine": False,
    "ownsScheduler": False,
}
REQUIRED_ARTIFACT_KINDS = {
    "entry-point",
    "audio",
    "manifest",
    "text-summary",
    "wav-report",
}
EXPECTED_DEMOS = {
    "runtime_dsp_object_bound_wav_resync_demo":
        "demo-local-bound-wav-resync-artifacts",
    "runtime_dsp_object_circuit_connected_wav_demo":
        "demo-local-circuit-connected-wav-artifacts",
    "runtime_dsp_object_circuit_connected_bias_wav_demo":
        "demo-local-circuit-connected-bias-wav-artifacts",
}
EXPECTED_CALLER_PROCESSING_STEPS = {
    "runtime_dsp_object_circuit_connected_wav_demo": [
        {
            "index": 0,
            "sourceNode": "Tiny Oscillator",
            "sourcePort": "Out",
            "destinationNode": "Tiny Gain",
            "destinationPort": "A",
            "callerStep": "oscillator.processSample -> gain.processSample",
        },
        {
            "index": 1,
            "sourceNode": "Tiny Gain",
            "sourcePort": "Out",
            "destinationNode": "Audio Out",
            "destinationPort": "In",
            "callerStep": "gain.processSample -> output sample",
        },
    ],
    "runtime_dsp_object_circuit_connected_bias_wav_demo": [
        {
            "index": 0,
            "sourceNode": "Tiny Oscillator",
            "sourcePort": "Out",
            "destinationNode": "Tiny Gain",
            "destinationPort": "A",
            "callerStep": "oscillator.processSample -> gain.processSample",
        },
        {
            "index": 1,
            "sourceNode": "Tiny Gain",
            "sourcePort": "Out",
            "destinationNode": "Tiny Bias",
            "destinationPort": "A",
            "callerStep": "gain.processSample -> bias.processSample",
        },
        {
            "index": 2,
            "sourceNode": "Tiny Bias",
            "sourcePort": "Out",
            "destinationNode": "Audio Out",
            "destinationPort": "In",
            "callerStep": "bias.processSample -> output sample",
        },
    ],
}
REPORT_ARTIFACT_KINDS = {
    "manifest",
    "text-summary",
    "wav-report",
    "phase-report",
}
SUMMARY_PARAMETER_KEYS = (
    "first half frequency",
    "first half amplitude",
    "second half frequency",
    "second half amplitude",
)
REQUIRED_SHELL_IDS = {
    "artifactCoverage",
    "artifactCoverageStatus",
    "artifactList",
    "artifactRoot",
    "artifactStatus",
    "audioPlayer",
    "audioPosition",
    "audioTitle",
    "boundaryFlags",
    "checklist",
    "checklistStatus",
    "circuitChain",
    "circuitChainStatus",
    "contractStatus",
    "currentAmplitude",
    "currentFrequency",
    "currentMeasuredFrequency",
    "currentMeasuredFrequencyDelta",
    "currentMeasuredPeak",
    "currentMeasuredPeakDelta",
    "currentMeasuredStatus",
    "currentParameterStatus",
    "followAudioButton",
    "frameCount",
    "handsOnReadiness",
    "handsOnReadinessStatus",
    "inspectionCursor",
    "inspectionCursorAudio",
    "inspectionCursorDelta",
    "inspectionCursorDivergence",
    "inspectionCursorPlayback",
    "inspectionCursorPreview",
    "inspectionCursorSeek",
    "inspectionCursorSeekTarget",
    "inspectionCursorSeekSync",
    "inspectionCursorSource",
    "inspectionCursorStatus",
    "inspectionCursorTarget",
    "inspectionCursorTransport",
    "inspectionCursorView",
    "inspectionMode",
    "levelEnvelopeCanvas",
    "levelEnvelopeMeta",
    "levelEnvelopePeak",
    "levelEnvelopeProbe",
    "levelEnvelopeRms",
    "levelEnvelopeStatus",
    "manifestBytes",
    "manifestCacheControl",
    "manifestExpires",
    "manifestHttpStatus",
    "manifestLoadedAt",
    "manifestModified",
    "manifestPath",
    "manifestPragma",
    "manifestStatus",
    "loadNodeGraphScriptButton",
    "nodeAudioStats",
    "nodeConnectionList",
    "nodeDefaultButton",
    "nodeDeleteButton",
    "nodeExecutionPlanDebug",
    "nodeExecutionPolicy",
    "nodeExecutionPlanSummary",
    "nodeExecutionPlanStatus",
    "nodeExecutionOrder",
    "nodeExecutionWireModes",
    "nodeCopyExecutionJsonButton",
    "nodeExecutionJsonStatus",
    "nodeCopyRuntimeSketchButton",
    "nodeRuntimeSketch",
    "nodeRuntimeSketchStatus",
    "nodeGraphNodes",
    "nodeGraphRenderStatus",
    "nodeGraphResizeHandle",
    "nodeGraphSource",
    "nodeGraphStatus",
    "nodeGraphValidation",
    "nodeGraphWorkspace",
    "nodeGraphZoomSurface",
    "nodeInteractionHelp",
    "nodeLiveEngineStatus",
    "nodeLiveMeter",
    "nodeLivePlanStatus",
    "nodeLiveRouteStatus",
    "nodeLiveStatus",
    "nodeVisualOutputCanvas",
    "nodeVisualOutputMeta",
    "nodeSaveVisualOutputButton",
    "nodeVisualOutputStatus",
    "patchVisualScaleValue",
    "patchVisualStyleValue",
    "patchVisualThemeValue",
    "patchVisualTrailValue",
    "nodeZoomInButton",
    "nodeZoomOutButton",
    "nodeModularViewButton",
    "nodeSettingsView",
    "nodeSettingsViewButton",
    "nodeParameterMetadataPopover",
    "nodePalette",
    "nodePatchScript",
    "nodePatchScriptFileInput",
    "nodePatchNameHeader",
    "nodePatchTagsHeader",
    "nodePlayButton",
    "nodeRedoButton",
    "nodeRenderButton",
    "nodeSceneAddBias",
    "nodeSceneAddGain",
    "nodeSceneAddNoise",
    "nodeSceneAddOsc",
    "nodeSceneCloseMenu",
    "nodeSceneContextMenu",
    "nodeSceneDragHandle",
    "nodeScriptStatus",
    "nodeScriptView",
    "nodeScriptViewButton",
    "nodeSignalPlotCanvas",
    "nodeLiveInputButton",
    "nodeLiveOutputButton",
    "nodeUndoButton",
    "nodeWaveformCanvas",
    "nodeWireSvg",
    "patchAuthorValue",
    "patchDescriptionValue",
    "patchNameValue",
    "patchTagsValue",
    "patchVisualModeValue",
    "saveNodeGraphScriptButton",
    "metadataDefaultValue",
    "metadataDivideChoicesValue",
    "metadataDisplayChoicesValue",
    "metadataKindValue",
    "metadataLinearSmoothingValue",
    "metadataNonlinearSliderValue",
    "metadataChoicesValue",
    "metadataMaxValue",
    "metadataMidLabel",
    "metadataMidValue",
    "metadataMinValue",
    "metadataPopoverClose",
    "metadataPopoverDragHandle",
    "metadataPopoverTitle",
    "metadataSetDefaultButton",
    "metadataShowSignValue",
    "metadataWraparoundValue",
    "metadataStepValue",
    "metadataUnitValue",
    "parameterSummary",
    "parameterSummaryStatus",
    "parameterTimeline",
    "parameterTimelinePhase",
    "parameterTimelineProbe",
    "parameterTimelineStatus",
    "phaseAudioStats",
    "phaseAudioStatsProbe",
    "phaseAudioStatsStatus",
    "phaseCoverage",
    "phaseCoverageStatus",
    "phaseList",
    "phaseProbe",
    "phaseStatus",
    "producerProof",
    "producerStatus",
    "refreshButton",
    "reportControls",
    "reportStatus",
    "reportViewer",
    "sandboxContract",
    "sandboxContractStatus",
    "sourceDetail",
    "sourceError",
    "sourceStatus",
    "signalPlotCanvas",
    "signalPlotControls",
    "signalPlotLagSummary",
    "signalPlotMeta",
    "signalPlotModeSummary",
    "signalPlotPoint",
    "signalPlotProbe",
    "signalPlotProbeSource",
    "signalPlotStatus",
    "signalPlotWindowSummary",
    "waveformCanvas",
    "waveformMeta",
    "waveformPhase",
    "waveformPhaseControls",
    "waveformPhaseJumpTarget",
    "waveformPhaseRange",
    "waveformPlayButton",
    "waveformPosition",
    "waveformProbe",
    "waveformSample",
    "waveformScrubber",
    "waveformStatus",
    "toggleDebugButton",
}


class ShellContractParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.duplicate_ids: set[str] = set()
        self.elements_by_id: dict[str, tuple[str, dict[str, str]]] = {}
        self.ids: set[str] = set()
        self.inline_script_count = 0
        self.scripts: set[str] = set()
        self.stylesheets: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {key: value if value is not None else "" for key, value in attrs}
        element_id = attributes.get("id")
        if element_id:
            if element_id in self.ids:
                self.duplicate_ids.add(element_id)
            self.ids.add(element_id)
            self.elements_by_id[element_id] = (tag, attributes)

        if tag == "script":
            src = attributes.get("src")
            if src:
                self.scripts.add(src)
            else:
                self.inline_script_count += 1

        if tag == "link" and attributes.get("rel") == "stylesheet":
            href = attributes.get("href")
            if href:
                self.stylesheets.add(href)


@dataclass
class Response:
    status: int
    reason: str
    headers: dict[str, str]
    body: bytes


def request(
    url: str,
    method: str = "GET",
    headers: dict[str, str] | None = None,
) -> Response:
    request = urllib.request.Request(url, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            return Response(
                status=response.status,
                reason=response.reason,
                headers={key.lower(): value for key, value in response.headers.items()},
                body=response.read(),
            )
    except urllib.error.HTTPError as error:
        return Response(
            status=error.code,
            reason=error.reason,
            headers={key.lower(): value for key, value in error.headers.items()},
            body=error.read(),
        )
    except urllib.error.URLError as error:
        return Response(
            status=0,
            reason=str(error.reason),
            headers={},
            body=b"",
        )


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def read_soemdsp_meta_kinds() -> set[str]:
    source = SOEMDSP_META_HEADER.read_text(encoding="utf-8")
    enum_start = source.index("enum class MetaType")
    body_start = source.index("{", enum_start) + 1
    body_end = source.index("};", body_start)
    names: set[str] = set()
    for line in source[body_start:body_end].splitlines():
        line = line.split("//", 1)[0].strip().rstrip(",")
        if line:
            names.add(line)
    return names


def require_soemdsp_wire_meta_traits() -> None:
    source = SOEMDSP_META_HEADER.read_text(encoding="utf-8")
    for snippet in [
        "std::string_view unit_;",
        ", unit_(WireTypeTraits::get(type).unit_)",
        ", divideChoicesVisibly(!customchoices.empty() ? true : WireTypeTraits::get(type).divideChoicesVisibly)",
        ", def_(!customchoices.empty() ? 0.0 : WireTypeTraits::get(type).def_)",
        ", min_(!customchoices.empty() ? 0.0 : WireTypeTraits::get(type).min_)",
        "? static_cast<double>(customchoices.size() - 1)",
        ": WireTypeTraits::get(type).max_)",
        'static_assert(WireMeta{ "frequency", "", MetaType::frequency }.unit_ == "Hz");',
        'static_assert(WireMeta{ "frequency", "", MetaType::frequency }.max_ == 20000.0);',
        'static_assert(WireMeta{ "waveform", "", MetaType::waveform }.choices.size() == 5);',
        'static_assert(WireMeta{ "waveform", "", MetaType::waveform }.max_ == 4.0);',
        'static_assert(WireMeta{ "custom", "", MetaType::waveform, choice::onoff }.choices.size() == 2);',
        'static_assert(WireMeta{ "custom", "", MetaType::waveform, choice::onoff }.def_ == 0.0);',
        'static_assert(WireMeta{ "custom", "", MetaType::waveform, choice::onoff }.max_ == 1.0);',
    ]:
        require(snippet in source, f"soemdsp WireMeta trait contract missing {snippet}")


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
        server.bind(("127.0.0.1", 0))
        return int(server.getsockname()[1])


def require_port_available(port: int) -> None:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
            server.bind(("127.0.0.1", port))
    except OSError as error:
        raise RuntimeError(f"port {port} is not available: {error}") from error


def run_step(label: str, action: Callable[[], None]) -> None:
    print(f"[smoke] {label}...", flush=True)
    try:
        action()
    except Exception as error:
        raise AssertionError(f"{label} failed: {error}") from error
    print(f"[smoke] {label}: ok", flush=True)


def require_no_store(response: Response, label: str) -> None:
    require(
        "no-store" in response.headers.get("cache-control", ""),
        f"{label} missing no-store cache-control",
    )
    require(
        response.headers.get("pragma") == "no-cache",
        f"{label} missing no-cache pragma",
    )
    require(response.headers.get("expires") == "0", f"{label} missing expires 0")


def require_content_type(response: Response, expected: str | tuple[str, ...], label: str) -> None:
    content_type = response.headers.get("content-type", "")
    expected_values = (expected,) if isinstance(expected, str) else expected
    require(
        any(content_type.startswith(value) for value in expected_values),
        f"{label} content-type was {content_type!r}, expected {expected_values!r}",
    )


def require_json_response_metadata(response: Response, label: str) -> None:
    require_no_store(response, label)
    require_content_type(response, "application/json", label)
    require(
        response.headers.get("content-length") == str(len(response.body)),
        f"{label} content-length mismatch",
    )


def require_manifest_file_info(
  payload: dict[str, object],
  manifest_file: Path,
  label: str,
) -> None:
    manifest_info = payload.get("manifestInfo")
    require(isinstance(manifest_info, dict), f"{label} manifest info missing")
    require(
        manifest_info.get("bytes") == manifest_file.stat().st_size,
        f"{label} manifest byte count mismatch",
    )
    require(
        isinstance(manifest_info.get("modifiedUtc"), str),
        f"{label} manifest modified time missing",
    )


def require_shell_element(
  parser: ShellContractParser,
  element_id: str,
  tag: str,
  expected_attrs: dict[str, str],
) -> None:
    element = parser.elements_by_id.get(element_id)
    require(element is not None, f"shell element {element_id} missing")
    actual_tag, actual_attrs = element
    require(actual_tag == tag, f"shell element {element_id} was {actual_tag}, expected {tag}")
    for key, expected in expected_attrs.items():
        actual = actual_attrs.get(key)
        require(
            actual == expected,
            f"shell element {element_id} {key} was {actual!r}, expected {expected!r}",
        )


def require_shell_contract(html: str) -> None:
    parser = ShellContractParser()
    parser.feed(html)

    duplicate_ids = sorted(parser.duplicate_ids)
    require(not duplicate_ids, f"shell duplicate ids: {duplicate_ids}")
    missing_ids = sorted(REQUIRED_SHELL_IDS - parser.ids)
    require(not missing_ids, f"shell missing required ids: {missing_ids}")
    require(parser.inline_script_count == 0, "shell includes inline script")
    require(
        parser.scripts == {"/public/app.js"},
        f"shell scripts were {sorted(parser.scripts)!r}",
    )
    require(
        parser.stylesheets == {"/public/styles.css"},
        f"shell stylesheets were {sorted(parser.stylesheets)!r}",
    )
    require_shell_element(
        parser,
        "refreshButton",
        "button",
        {
            "type": "button",
            "aria-label": "Reload manifest",
            "aria-busy": "false",
            "data-loading": "false",
            "title": "Reload manifest and artifacts",
        },
    )
    require_shell_element(
        parser,
        "audioPlayer",
        "audio",
        {"controls": "", "preload": "metadata"},
    )
    require_shell_element(
        parser,
        "nodeGraphWorkspace",
        "div",
        {"aria-label": "Drag wires between DSP node ports; right-click empty scene space to add modules"},
    )
    require_shell_element(
        parser,
        "nodeWireSvg",
        "svg",
        {"aria-hidden": "true", "focusable": "false"},
    )
    require_shell_element(
        parser,
        "nodeRenderButton",
        "button",
        {"type": "button"},
    )
    require_shell_element(
        parser,
        "nodePlayButton",
        "button",
        {"type": "button", "disabled": ""},
    )
    require_shell_element(
        parser,
        "nodeLiveInputButton",
        "button",
        {"type": "button", "aria-pressed": "false"},
    )
    require_shell_element(
        parser,
        "nodeLiveOutputButton",
        "button",
        {"type": "button", "aria-pressed": "false"},
    )
    require_shell_element(
        parser,
        "nodeLiveStatus",
        "span",
        {},
    )
    require_shell_element(
        parser,
        "nodeWaveformCanvas",
        "canvas",
        {"width": "720", "height": "180", "aria-label": "Node graph rendered waveform"},
    )
    require_shell_element(
        parser,
        "nodeSignalPlotCanvas",
        "canvas",
        {"width": "720", "height": "300", "aria-label": "Node graph rendered signal plot"},
    )
    require_shell_element(
        parser,
        "nodeVisualOutputCanvas",
        "canvas",
        {"width": "720", "height": "300", "aria-label": "Node graph visual output"},
    )
    require_shell_element(
        parser,
        "followAudioButton",
        "button",
        {"type": "button", "aria-pressed": "true"},
    )
    require_shell_element(
        parser,
        "waveformPlayButton",
        "button",
        {"type": "button", "aria-pressed": "false", "disabled": ""},
    )
    require_shell_element(
        parser,
        "waveformCanvas",
        "canvas",
        {"width": "1120", "height": "180", "aria-label": "Primary WAV waveform"},
    )
    require_shell_element(
        parser,
        "waveformProbe",
        "span",
        {
            "data-probe-source": "none",
            "data-probe-frame": "none",
            "title": "Waveform probe idle",
        },
    )
    require_shell_element(
        parser,
        "parameterTimelineProbe",
        "span",
        {
            "data-probe-source": "none",
            "data-probe-frame": "none",
            "title": "Parameter timeline probe idle",
        },
    )
    require_shell_element(
        parser,
        "phaseAudioStatsProbe",
        "span",
        {
            "data-probe-source": "none",
            "data-probe-frame": "none",
            "title": "Phase audio stats probe idle",
        },
    )
    require_shell_element(
        parser,
        "phaseProbe",
        "span",
        {
            "data-probe-source": "none",
            "data-probe-frame": "none",
            "title": "Phase list probe idle",
        },
    )
    require_shell_element(
        parser,
        "signalPlotCanvas",
        "canvas",
        {"width": "720", "height": "360", "aria-label": "Primary WAV signal plot"},
    )
    require_shell_element(
        parser,
        "signalPlotProbe",
        "span",
        {
            "data-probe-source": "none",
            "data-probe-frame": "none",
            "title": "Signal plot probe idle",
        },
    )
    require_shell_element(
        parser,
        "signalPlotProbeSource",
        "span",
        {
            "data-probe-source": "none",
            "data-probe-frame": "none",
            "title": "Signal plot source probe idle",
        },
    )
    require_shell_element(
        parser,
        "levelEnvelopeCanvas",
        "canvas",
        {"width": "1120", "height": "140", "aria-label": "Primary WAV level envelope"},
    )
    require_shell_element(
        parser,
        "levelEnvelopeProbe",
        "span",
        {
            "data-probe-source": "none",
            "data-probe-frame": "none",
            "title": "Level envelope probe idle",
        },
    )
    require_shell_element(
        parser,
        "waveformScrubber",
        "input",
        {
            "type": "range",
            "min": "0",
            "max": "1",
            "step": "0.001",
            "value": "0",
            "aria-label": "Waveform position",
            "aria-valuetext": "0.000s / unknown / phase unknown / follow",
            "data-follow-mode": "follow",
            "title": "Waveform position 0.000s / unknown / phase unknown / Follow Audio",
        },
    )


def require_handoff_contract(payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")
    require(manifest.get("allOk") is True, "manifest allOk was not true")

    handoff = manifest.get("sandboxHandoff")
    require(isinstance(handoff, dict), "sandbox handoff missing")
    require(handoff.get("contract") == EXPECTED_CONTRACT, "handoff contract mismatch")
    require(
        handoff.get("contractVersion") == EXPECTED_CONTRACT_VERSION,
        "handoff contract version mismatch",
    )
    require(
        handoff.get("inspectionMode") == EXPECTED_INSPECTION_MODE,
        "handoff inspection mode mismatch",
    )

    for key, expected in REQUIRED_FLAGS.items():
        require(handoff.get(key) is expected, f"handoff flag {key} mismatch")


def require_producer_proof(payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")
    demo = manifest.get("demo")
    require(demo in EXPECTED_DEMOS, "demo name mismatch")
    require(manifest.get("kind") == EXPECTED_DEMOS[demo], "artifact kind mismatch")
    require(manifest.get("runtimeApi") is False, "runtime API flag mismatch")
    require(manifest.get("scheduler") is False, "scheduler flag mismatch")
    require(manifest.get("audioEngine") is False, "audio engine flag mismatch")

    setters = manifest.get("parameterSetters")
    require(isinstance(setters, dict), "parameter setters missing")
    require(setters.get("frequency") is True, "frequency setter missing")
    require(setters.get("amplitude") is True, "amplitude setter missing")


def require_artifact_contract(payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")
    handoff = manifest.get("sandboxHandoff")
    require(isinstance(handoff, dict), "sandbox handoff missing")

    links = manifest.get("artifactLinks")
    require(isinstance(links, list), "artifact links missing")
    require(all(isinstance(link, dict) for link in links), "artifact link not object")
    require(all(link.get("path") for link in links), "artifact link path missing")

    kinds = {str(link.get("kind")) for link in links}
    missing_kinds = REQUIRED_ARTIFACT_KINDS - kinds
    require(not missing_kinds, f"required artifact kinds missing: {sorted(missing_kinds)}")
    for kind in REQUIRED_ARTIFACT_KINDS - {"phase-report"}:
        count = sum(1 for link in links if link.get("kind") == kind)
        require(count == 1, f"{kind} artifact link count mismatch")

    links_by_kind = {str(link.get("kind")): link for link in links}
    entry_point = handoff.get("entryPoint")
    primary_audio = handoff.get("primaryAudioArtifact")
    require(
        links_by_kind["entry-point"].get("path") == entry_point,
        "entry-point link did not match handoff entry point",
    )
    require(
        links_by_kind["audio"].get("path") == primary_audio,
        "audio link did not match handoff primary audio",
    )

    wav = manifest.get("wav")
    require(isinstance(wav, dict), "wav metadata missing")
    require(wav.get("path") == primary_audio, "wav path did not match primary audio")

    phases = manifest.get("phases")
    require(isinstance(phases, list), "phases missing")
    phase_report_count = sum(1 for link in links if link.get("kind") == "phase-report")
    require(
        phase_report_count == len(phases),
        "phase report count did not match phase count",
    )
    phase_names = {
        str(phase.get("name"))
        for phase in phases
        if isinstance(phase, dict) and phase.get("name")
    }
    report_phases: set[str] = set()
    for index, link in enumerate(links):
        if link.get("kind") != "phase-report":
            continue
        phase = link.get("phase")
        require(isinstance(phase, str) and phase, f"phase report {index} phase missing")
        require(phase in phase_names, f"phase report {index} phase unknown")
        require(phase not in report_phases, f"phase report {index} phase duplicate")
        report_phases.add(phase)
    require(report_phases == phase_names, "phase report phases did not match phases")


def artifact_contract_fixture() -> dict[str, object]:
    return {
        "manifest": {
            "sandboxHandoff": {
                "entryPoint": "runtime_dsp_object_bound_wav_resync_demo.html",
                "primaryAudioArtifact": "runtime_dsp_object_bound_wav_resync_demo.wav",
            },
            "artifactLinks": [
                {
                    "label": "HTML report",
                    "kind": "entry-point",
                    "path": "runtime_dsp_object_bound_wav_resync_demo.html",
                },
                {
                    "label": "Primary WAV",
                    "kind": "audio",
                    "path": "runtime_dsp_object_bound_wav_resync_demo.wav",
                },
                {
                    "label": "Manifest",
                    "kind": "manifest",
                    "path": "runtime_dsp_object_bound_wav_resync_demo.manifest.json",
                },
                {
                    "label": "Summary",
                    "kind": "text-summary",
                    "path": "runtime_dsp_object_bound_wav_resync_demo_summary.txt",
                },
                {
                    "label": "WAV report",
                    "kind": "wav-report",
                    "path": "runtime_dsp_object_bound_wav_resync_demo_wav_report.txt",
                },
                {
                    "label": "Phase report",
                    "kind": "phase-report",
                    "path": "runtime_dsp_object_bound_wav_resync_demo_first_phase.txt",
                    "phase": "first",
                },
            ],
            "wav": {
                "path": "runtime_dsp_object_bound_wav_resync_demo.wav",
            },
            "phases": [
                {
                    "name": "first",
                },
            ],
        },
    }


def require_artifact_contract_failure(
  label: str,
  mutate: Callable[[dict[str, object]], None],
  expected: str,
) -> None:
    payload = json.loads(json.dumps(artifact_contract_fixture()))
    manifest = payload["manifest"]
    require(isinstance(manifest, dict), f"{label} fixture manifest missing")
    mutate(manifest)
    try:
        require_artifact_contract(payload)
    except AssertionError as error:
        require(expected in str(error), f"{label} produced {error}, expected {expected}")
        return

    raise AssertionError(f"{label} did not fail")


def require_artifact_contract_negative_cases() -> None:
    require_artifact_contract(artifact_contract_fixture())
    require_artifact_contract_failure(
        "entry point link mismatch",
        lambda manifest: manifest["artifactLinks"][0].update({"path": "other.html"}),
        "entry-point link did not match handoff entry point",
    )
    require_artifact_contract_failure(
        "audio link mismatch",
        lambda manifest: manifest["artifactLinks"][1].update({"path": "other.wav"}),
        "audio link did not match handoff primary audio",
    )
    require_artifact_contract_failure(
        "wav path mismatch",
        lambda manifest: manifest["wav"].update({"path": "other.wav"}),
        "wav path did not match primary audio",
    )
    require_artifact_contract_failure(
        "duplicate entry point",
        lambda manifest: manifest["artifactLinks"].append(
            {
                "label": "Duplicate HTML report",
                "kind": "entry-point",
                "path": "duplicate.html",
            },
        ),
        "entry-point artifact link count mismatch",
    )
    require_artifact_contract_failure(
        "duplicate audio",
        lambda manifest: manifest["artifactLinks"].append(
            {
                "label": "Duplicate WAV",
                "kind": "audio",
                "path": "duplicate.wav",
            },
        ),
        "audio artifact link count mismatch",
    )
    require_artifact_contract_failure(
        "phase report phase missing",
        lambda manifest: manifest["artifactLinks"][-1].pop("phase"),
        "phase report 5 phase missing",
    )
    require_artifact_contract_failure(
        "phase report phase unknown",
        lambda manifest: manifest["artifactLinks"][-1].update({"phase": "other"}),
        "phase report 5 phase unknown",
    )
    require_artifact_contract_failure(
        "phase report phase duplicate",
        lambda manifest: (
            manifest["phases"].append({"name": "second"}),
            manifest["artifactLinks"].append(
                {
                    "label": "Second phase report",
                    "kind": "phase-report",
                    "path": "runtime_dsp_object_bound_wav_resync_demo.second.txt",
                    "phase": "first",
                },
            ),
        ),
        "phase report 6 phase duplicate",
    )


def require_phase_contract(payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")

    wav = manifest.get("wav")
    require(isinstance(wav, dict), "wav metadata missing")
    wav_frames = int(wav.get("frames", 0))
    require(wav_frames > 0, "wav frame count missing")

    phases = manifest.get("phases")
    require(isinstance(phases, list), "phases missing")
    require(phases, "phases empty")

    total_phase_frames = 0
    expected_start_frame = 0
    for index, phase in enumerate(phases):
        require(isinstance(phase, dict), f"phase {index} not object")
        require(phase.get("name"), f"phase {index} name missing")
        require(phase.get("preflightOk") is True, f"phase {index} preflight failed")
        require(phase.get("applyOk") is True, f"phase {index} apply failed")
        require(phase.get("processOk") is True, f"phase {index} process failed")
        samples = int(phase.get("samplesProcessed", 0))
        require(samples > 0, f"phase {index} samples missing")
        start_frame = int(phase.get("startFrame", -1))
        end_frame = int(phase.get("endFrame", -1))
        require(
            start_frame == expected_start_frame,
            f"phase {index} start frame mismatch",
        )
        require(
            end_frame == start_frame + samples,
            f"phase {index} end frame mismatch",
        )
        expected_start_frame = end_frame
        total_phase_frames += samples

    require(
        total_phase_frames == wav_frames,
        f"phase frames {total_phase_frames} did not match wav frames {wav_frames}",
    )

    measurements = manifest.get("phaseAudioMeasurements")
    require(isinstance(measurements, list), "phase audio measurements missing")
    require(
        len(measurements) == len(phases),
        "phase audio measurement count did not match phase count",
    )
    measurements_by_name = {
        measurement.get("name"): measurement
        for measurement in measurements
        if isinstance(measurement, dict)
    }
    resync = manifest.get("parameterResync")
    require(isinstance(resync, dict), "parameter resync missing")
    frequency = resync.get("frequency")
    amplitude = resync.get("amplitude")
    bias = resync.get("bias", {})
    require(isinstance(frequency, dict), "frequency resync missing")
    require(isinstance(amplitude, dict), "amplitude resync missing")
    require(isinstance(bias, dict), "bias resync invalid")
    for phase in phases:
        require(isinstance(phase, dict), "phase not object")
        name = phase.get("name")
        require(isinstance(name, str) and name, "phase name missing")
        measurement = measurements_by_name.get(name)
        require(isinstance(measurement, dict), f"{name} measurement missing")
        measured_frequency = float(measurement.get("measuredFrequency", 0))
        peak = float(measurement.get("peak", 0))
        rms = float(measurement.get("rms", 0))
        dc_offset = float(measurement.get("dcOffset", 0))
        target_amplitude = float(amplitude.get(name, 0))
        target_bias = float(bias.get(name, 0))
        target_peak = target_amplitude + abs(target_bias)
        require(
            abs(measured_frequency - float(frequency.get(name, 0))) < 0.5,
            f"{name} producer measured frequency mismatch",
        )
        require(
            abs(peak - target_peak) < 0.001,
            f"{name} producer measured peak mismatch",
        )
        require(
            abs(dc_offset - target_bias) < 0.001,
            f"{name} producer measured dc offset mismatch",
        )
        require(rms > 0, f"{name} producer measured rms missing")


def phase_audio_contract_fixture() -> dict[str, object]:
    return {
        "manifest": {
            "wav": {
                "frames": 200,
            },
            "phases": [
                {
                    "name": "first",
                    "preflightOk": True,
                    "applyOk": True,
                    "processOk": True,
                    "samplesProcessed": 100,
                    "startFrame": 0,
                    "endFrame": 100,
                },
                {
                    "name": "second",
                    "preflightOk": True,
                    "applyOk": True,
                    "processOk": True,
                    "samplesProcessed": 100,
                    "startFrame": 100,
                    "endFrame": 200,
                },
            ],
            "parameterResync": {
                "frequency": {
                    "first": 220,
                    "second": 440,
                },
                "amplitude": {
                    "first": 0.2,
                    "second": 0.35,
                },
            },
            "phaseAudioMeasurements": [
                {
                    "name": "first",
                    "measuredFrequency": 220,
                    "peak": 0.2,
                    "rms": 0.141421,
                },
                {
                    "name": "second",
                    "measuredFrequency": 440,
                    "peak": 0.35,
                    "rms": 0.247487,
                },
            ],
        }
    }


def require_phase_audio_contract_failure(
  label: str,
  mutate: Callable[[dict[str, object]], None],
  expected: str,
) -> None:
    payload = json.loads(json.dumps(phase_audio_contract_fixture()))
    manifest = payload["manifest"]
    require(isinstance(manifest, dict), f"{label} fixture manifest missing")
    mutate(manifest)
    try:
        require_phase_contract(payload)
    except AssertionError as error:
        require(expected in str(error), f"{label} produced {error}, expected {expected}")
        return

    raise AssertionError(f"{label} did not fail")


def require_phase_audio_contract_negative_cases() -> None:
    require_phase_contract(phase_audio_contract_fixture())
    require_phase_audio_contract_failure(
        "missing measurements",
        lambda manifest: manifest.pop("phaseAudioMeasurements"),
        "phase audio measurements missing",
    )
    require_phase_audio_contract_failure(
        "measurement count mismatch",
        lambda manifest: manifest["phaseAudioMeasurements"].pop(),
        "phase audio measurement count did not match phase count",
    )
    require_phase_audio_contract_failure(
        "measurement name mismatch",
        lambda manifest: manifest["phaseAudioMeasurements"][0].update({"name": "other"}),
        "first measurement missing",
    )
    require_phase_audio_contract_failure(
        "producer frequency mismatch",
        lambda manifest: manifest["phaseAudioMeasurements"][0].update(
            {"measuredFrequency": 221},
        ),
        "first producer measured frequency mismatch",
    )
    require_phase_audio_contract_failure(
        "producer peak mismatch",
        lambda manifest: manifest["phaseAudioMeasurements"][0].update({"peak": 0.25}),
        "first producer measured peak mismatch",
    )
    require_phase_audio_contract_failure(
        "producer rms missing",
        lambda manifest: manifest["phaseAudioMeasurements"][0].update({"rms": 0}),
        "first producer measured rms missing",
    )


def parameter_resync_contract_fixture() -> dict[str, object]:
    return {
        "manifest": {
            "parameterResync": {
                "frequency": {
                    "changed": True,
                    "first": 220,
                    "second": 440,
                },
                "amplitude": {
                    "changed": True,
                    "first": 0.2,
                    "second": 0.35,
                },
            },
        },
    }


def require_parameter_resync_contract(payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")
    resync = manifest.get("parameterResync")
    require(isinstance(resync, dict), "parameter resync missing")

    for key in ("frequency", "amplitude"):
        values = resync.get(key)
        require(isinstance(values, dict), f"{key} resync missing")
        require(values.get("changed") is True, f"{key} resync changed flag missing")
        first = float(values.get("first", 0))
        second = float(values.get("second", 0))
        require(first > 0, f"{key} first value invalid")
        require(second > 0, f"{key} second value invalid")
        require(second > first, f"{key} did not resync upward")


def require_parameter_resync_contract_failure(
  label: str,
  mutate: Callable[[dict[str, object]], None],
  expected: str,
) -> None:
    payload = json.loads(json.dumps(parameter_resync_contract_fixture()))
    manifest = payload["manifest"]
    require(isinstance(manifest, dict), f"{label} fixture manifest missing")
    mutate(manifest)
    try:
        require_parameter_resync_contract(payload)
    except AssertionError as error:
        require(expected in str(error), f"{label} produced {error}, expected {expected}")
        return

    raise AssertionError(f"{label} did not fail")


def require_parameter_resync_contract_negative_cases() -> None:
    require_parameter_resync_contract(parameter_resync_contract_fixture())
    require_parameter_resync_contract_failure(
        "missing parameter resync",
        lambda manifest: manifest.pop("parameterResync"),
        "parameter resync missing",
    )
    require_parameter_resync_contract_failure(
        "missing frequency",
        lambda manifest: manifest["parameterResync"].pop("frequency"),
        "frequency resync missing",
    )
    require_parameter_resync_contract_failure(
        "frequency changed flag false",
        lambda manifest: manifest["parameterResync"]["frequency"].update(
            {"changed": False},
        ),
        "frequency resync changed flag missing",
    )
    require_parameter_resync_contract_failure(
        "amplitude first invalid",
        lambda manifest: manifest["parameterResync"]["amplitude"].update({"first": 0}),
        "amplitude first value invalid",
    )
    require_parameter_resync_contract_failure(
        "amplitude not upward",
        lambda manifest: manifest["parameterResync"]["amplitude"].update(
            {"second": 0.1},
        ),
        "amplitude did not resync upward",
    )


def caller_processing_order_contract_fixture() -> dict[str, object]:
    demo = "runtime_dsp_object_circuit_connected_wav_demo"
    steps = EXPECTED_CALLER_PROCESSING_STEPS[demo]
    return {
        "manifest": {
            "demo": demo,
            "circuitConnections": {
                "count": len(steps),
                "describesProcessingChain": True,
            },
            "callerProcessingOrderProof": {
                "matchesCircuitConnections": True,
            },
            "callerProcessingOrder": {
                "matchesCircuitConnections": True,
                "callerOwnsProcessingOrder": True,
                "steps": json.loads(json.dumps(steps)),
            },
        },
    }


def require_caller_processing_order_contract(payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")
    expected_steps = EXPECTED_CALLER_PROCESSING_STEPS.get(str(manifest.get("demo")))
    if expected_steps is None:
        return

    connections = manifest.get("circuitConnections")
    require(isinstance(connections, dict), "circuit connections missing")
    require(
        int(connections.get("count", 0)) == len(expected_steps),
        "circuit connection count mismatch",
    )
    require(
        connections.get("describesProcessingChain") is True,
        "circuit connection chain flag missing",
    )

    proof = manifest.get("callerProcessingOrderProof")
    require(isinstance(proof, dict), "caller processing proof missing")
    require(
        proof.get("matchesCircuitConnections") is True,
        "caller processing order mismatch",
    )

    order = manifest.get("callerProcessingOrder")
    require(isinstance(order, dict), "caller processing order missing")
    require(
        order.get("matchesCircuitConnections") is True,
        "caller processing order match flag missing",
    )
    require(
        order.get("callerOwnsProcessingOrder") is True,
        "caller processing ownership missing",
    )

    steps = order.get("steps")
    require(isinstance(steps, list), "caller processing steps missing")
    require(
        len(steps) == len(expected_steps),
        "caller processing step count mismatch",
    )
    for index, expected in enumerate(expected_steps):
        step = steps[index]
        require(isinstance(step, dict), "caller processing step invalid")
        for key, expected_value in expected.items():
            require(
                step.get(key) == expected_value,
                f"caller processing step {index} {key} mismatch",
            )


def require_caller_processing_order_contract_failure(
  label: str,
  mutate: Callable[[dict[str, object]], None],
  expected: str,
) -> None:
    payload = json.loads(json.dumps(caller_processing_order_contract_fixture()))
    manifest = payload["manifest"]
    require(isinstance(manifest, dict), f"{label} fixture manifest missing")
    mutate(manifest)
    try:
        require_caller_processing_order_contract(payload)
    except AssertionError as error:
        require(expected in str(error), f"{label} produced {error}, expected {expected}")
        return

    raise AssertionError(f"{label} did not fail")


def require_caller_processing_order_contract_negative_cases() -> None:
    require_caller_processing_order_contract(caller_processing_order_contract_fixture())
    require_caller_processing_order_contract_failure(
        "missing circuit connections",
        lambda manifest: manifest.pop("circuitConnections"),
        "circuit connections missing",
    )
    require_caller_processing_order_contract_failure(
        "wrong circuit connection count",
        lambda manifest: manifest["circuitConnections"].update({"count": 1}),
        "circuit connection count mismatch",
    )
    require_caller_processing_order_contract_failure(
        "chain flag false",
        lambda manifest: manifest["circuitConnections"].update(
            {"describesProcessingChain": False},
        ),
        "circuit connection chain flag missing",
    )
    require_caller_processing_order_contract_failure(
        "proof false",
        lambda manifest: manifest["callerProcessingOrderProof"].update(
            {"matchesCircuitConnections": False},
        ),
        "caller processing order mismatch",
    )
    require_caller_processing_order_contract_failure(
        "order flag false",
        lambda manifest: manifest["callerProcessingOrder"].update(
            {"matchesCircuitConnections": False},
        ),
        "caller processing order match flag missing",
    )
    require_caller_processing_order_contract_failure(
        "ownership false",
        lambda manifest: manifest["callerProcessingOrder"].update(
            {"callerOwnsProcessingOrder": False},
        ),
        "caller processing ownership missing",
    )
    require_caller_processing_order_contract_failure(
        "step count mismatch",
        lambda manifest: manifest["callerProcessingOrder"]["steps"].pop(),
        "caller processing step count mismatch",
    )
    require_caller_processing_order_contract_failure(
        "step mismatch",
        lambda manifest: manifest["callerProcessingOrder"]["steps"][0].update(
            {"destinationNode": "Audio Out"},
        ),
        "caller processing step 0 destinationNode mismatch",
    )


def require_artifact_reachability(base_url: str, payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")
    artifact_root = payload.get("artifactRoot")
    require(isinstance(artifact_root, str) and artifact_root, "artifact root missing")
    artifact_root_path = Path(artifact_root).resolve()
    links = manifest.get("artifactLinks")
    require(isinstance(links, list), "artifact links missing")

    for index, link in enumerate(links):
        require(isinstance(link, dict), f"artifact link {index} not object")
        path = link.get("path")
        require(isinstance(path, str) and path, f"artifact link {index} path missing")
        local_path = (artifact_root_path / path).resolve()
        require(
            local_path.is_relative_to(artifact_root_path),
            f"artifact link {index} escapes artifact root",
        )
        require(local_path.is_file(), f"artifact link {index} local file missing")
        artifact_response = request(
            f"{base_url}/artifact?path={urllib.parse.quote(path)}",
            method="HEAD",
        )
        require(
            artifact_response.status == 200,
            f"artifact link {index} did not return 200",
        )
        require_no_store(artifact_response, f"artifact link {index}")
        content_length = int(artifact_response.headers.get("content-length", "0"))
        require(
            content_length == local_path.stat().st_size,
            f"artifact link {index} content length mismatch",
        )
        require(
            artifact_response.headers.get("accept-ranges") == "bytes",
            f"artifact link {index} did not advertise byte ranges",
        )
        require(
            bool(artifact_response.headers.get("last-modified")),
            f"artifact link {index} last-modified missing",
        )


def require_report_documents(base_url: str, payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")
    artifact_root = payload.get("artifactRoot")
    require(isinstance(artifact_root, str) and artifact_root, "artifact root missing")
    artifact_root_path = Path(artifact_root).resolve()
    links = manifest.get("artifactLinks")
    require(isinstance(links, list), "artifact links missing")

    report_links = [
        link
        for link in links
        if isinstance(link, dict) and link.get("kind") in REPORT_ARTIFACT_KINDS
    ]
    require(report_links, "report artifact links missing")

    for index, link in enumerate(report_links):
        path = link.get("path")
        kind = link.get("kind")
        require(isinstance(path, str) and path, f"report link {index} path missing")
        local_path = (artifact_root_path / path).resolve()
        require(
            local_path.is_relative_to(artifact_root_path),
            f"report link {index} escapes artifact root",
        )
        expected = local_path.read_bytes()
        response = request(f"{base_url}/artifact?path={urllib.parse.quote(path)}")
        require(response.status == 200, f"report link {index} did not return 200")
        require_no_store(response, f"report link {index}")
        require(
            response.headers.get("content-length") == str(len(expected)),
            f"report link {index} content-length mismatch",
        )
        require(response.body == expected, f"report link {index} did not match local bytes")
        text = response.body.decode("utf-8")
        require(text.strip(), f"report link {index} was empty")
        if kind == "manifest":
            json.loads(text)


def parse_summary_pairs(text: str) -> dict[str, str]:
    pairs: dict[str, str] = {}
    for line in text.splitlines():
        key, separator, value = line.partition(":")
        if separator and key.strip():
            pairs[key.strip()] = value.strip()
    return pairs


def require_parameter_summary(base_url: str, payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")

    resync = manifest.get("parameterResync")
    require(isinstance(resync, dict), "parameter resync missing")
    frequency = resync.get("frequency")
    amplitude = resync.get("amplitude")
    require(isinstance(frequency, dict), "frequency resync missing")
    require(isinstance(amplitude, dict), "amplitude resync missing")
    require(frequency.get("changed") is True, "frequency resync changed flag missing")
    require(amplitude.get("changed") is True, "amplitude resync changed flag missing")

    first_frequency = float(frequency.get("first", 0))
    second_frequency = float(frequency.get("second", 0))
    first_amplitude = float(amplitude.get("first", 0))
    second_amplitude = float(amplitude.get("second", 0))
    require(first_frequency > 0, "manifest first frequency was not positive")
    require(second_frequency > 0, "manifest second frequency was not positive")
    require(first_amplitude > 0, "manifest first amplitude was not positive")
    require(second_amplitude > 0, "manifest second amplitude was not positive")
    require(second_frequency > first_frequency, "manifest frequency did not resync upward")
    require(second_amplitude > first_amplitude, "manifest amplitude did not resync upward")

    links = manifest.get("artifactLinks")
    require(isinstance(links, list), "artifact links missing")
    summary_links = [
        link
        for link in links
        if isinstance(link, dict) and link.get("kind") == "text-summary"
    ]
    require(len(summary_links) == 1, "expected exactly one text summary")

    path = summary_links[0].get("path")
    require(isinstance(path, str) and path, "text summary path missing")
    response = request(f"{base_url}/artifact?path={urllib.parse.quote(path)}")
    require(response.status == 200, "text summary did not return 200")
    require_no_store(response, "text summary")
    pairs = parse_summary_pairs(response.body.decode("utf-8"))

    for key in SUMMARY_PARAMETER_KEYS:
        require(key in pairs, f"text summary missing {key}")
        number = float(pairs[key])
        require(number > 0, f"text summary {key} was not positive")

    require(
        float(pairs["first half frequency"]) == first_frequency,
        "text summary first frequency did not match manifest",
    )
    require(
        float(pairs["second half frequency"]) == second_frequency,
        "text summary second frequency did not match manifest",
    )
    require(
        float(pairs["first half amplitude"]) == first_amplitude,
        "text summary first amplitude did not match manifest",
    )
    require(
        float(pairs["second half amplitude"]) == second_amplitude,
        "text summary second amplitude did not match manifest",
    )


def decode_mono_float_samples(
    frames: bytes,
    channels: int,
    sample_width: int,
) -> list[float]:
    require(sample_width == 2, "WAV sample width was not 16-bit")
    samples: list[float] = []
    frame_width = channels * sample_width
    frame_count = len(frames) // frame_width
    for frame_index in range(frame_count):
        total = 0.0
        for channel in range(channels):
            offset = frame_index * frame_width + channel * sample_width
            total += int.from_bytes(
                frames[offset : offset + sample_width],
                byteorder="little",
                signed=True,
            ) / 32768
        samples.append(total / channels)
    return samples


def estimate_positive_crossing_frequency(
    samples: list[float],
    start_frame: int,
    end_frame: int,
    sample_rate: int,
) -> float | None:
    start = max(0, min(len(samples), start_frame))
    end = max(start, min(len(samples), end_frame))
    if end - start < 2 or sample_rate <= 0:
        return None

    crossings: list[float] = []
    previous = samples[start]
    for frame in range(start + 1, end):
        current = samples[frame]
        if previous < 0 <= current:
            span = current - previous
            offset = 0 if span == 0 else -previous / span
            crossings.append(frame - 1 + offset)
        previous = current

    if len(crossings) < 2:
        return None

    seconds = (crossings[-1] - crossings[0]) / sample_rate
    if seconds <= 0:
        return None
    return (len(crossings) - 1) / seconds


def require_phase_audio_measurements(
    manifest: dict[str, object],
    samples: list[float],
    sample_rate: int,
) -> None:
    phases = manifest.get("phases")
    require(isinstance(phases, list), "phase measurement phases missing")
    resync = manifest.get("parameterResync")
    require(isinstance(resync, dict), "phase measurement resync missing")
    frequency = resync.get("frequency")
    amplitude = resync.get("amplitude")
    bias = resync.get("bias", {})
    require(isinstance(frequency, dict), "phase measurement frequency missing")
    require(isinstance(amplitude, dict), "phase measurement amplitude missing")
    require(isinstance(bias, dict), "phase measurement bias invalid")
    producer_measurements = manifest.get("phaseAudioMeasurements")
    require(
        isinstance(producer_measurements, list),
        "producer phase measurements missing",
    )
    producer_measurements_by_name = {
        measurement.get("name"): measurement
        for measurement in producer_measurements
        if isinstance(measurement, dict)
    }

    for index, phase in enumerate(phases):
        require(isinstance(phase, dict), f"phase measurement {index} not object")
        name = phase.get("name")
        require(isinstance(name, str) and name, f"phase measurement {index} name missing")
        start_frame = int(phase.get("startFrame", -1))
        end_frame = int(phase.get("endFrame", -1))
        require(start_frame >= 0 and end_frame > start_frame, f"{name} range invalid")

        target_frequency = float(frequency.get(name, 0))
        target_amplitude = float(amplitude.get(name, 0))
        target_bias = float(bias.get(name, 0))
        target_peak = target_amplitude + abs(target_bias)
        require(target_frequency > 0, f"{name} target frequency missing")
        require(target_amplitude > 0, f"{name} target amplitude missing")

        measured_frequency = estimate_positive_crossing_frequency(
            samples,
            start_frame,
            end_frame,
            sample_rate,
        )
        require(measured_frequency is not None, f"{name} measured frequency missing")
        require(
            abs(measured_frequency - target_frequency) < 0.5,
            f"{name} measured frequency {measured_frequency} did not match {target_frequency}",
        )

        phase_samples = samples[start_frame:end_frame]
        peak = max(abs(sample) for sample in phase_samples)
        rms = (sum(sample * sample for sample in phase_samples) / len(phase_samples)) ** 0.5
        dc_offset = sum(phase_samples) / len(phase_samples)
        require(
            abs(peak - target_peak) < 0.001,
            f"{name} peak {peak} did not match target peak {target_peak}",
        )
        require(
            abs(dc_offset - target_bias) < 0.001,
            f"{name} dc offset {dc_offset} did not match target bias {target_bias}",
        )
        producer_measurement = producer_measurements_by_name.get(name)
        require(
            isinstance(producer_measurement, dict),
            f"{name} producer measurement missing",
        )
        producer_frequency = float(producer_measurement.get("measuredFrequency", 0))
        producer_peak = float(producer_measurement.get("peak", 0))
        producer_rms = float(producer_measurement.get("rms", 0))
        require(
            abs(producer_frequency - measured_frequency) < 0.5,
            f"{name} producer frequency {producer_frequency} did not match decoded {measured_frequency}",
        )
        require(
            abs(producer_peak - peak) < 0.001,
            f"{name} producer peak {producer_peak} did not match decoded {peak}",
        )
        require(
            abs(producer_rms - rms) < 0.001,
            f"{name} producer rms {producer_rms} did not match decoded {rms}",
        )


def require_primary_audio_wav(base_url: str, payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")

    handoff = manifest.get("sandboxHandoff")
    require(isinstance(handoff, dict), "sandbox handoff missing")
    audio_path = handoff.get("primaryAudioArtifact")
    require(isinstance(audio_path, str) and audio_path, "primary audio artifact missing")

    wav = manifest.get("wav")
    require(isinstance(wav, dict), "wav metadata missing")
    expected_frames = int(wav.get("frames", 0))
    expected_sample_rate = int(wav.get("sampleRate", 0))
    expected_channels = int(wav.get("channels", 0))
    expected_bit_depth = int(wav.get("bitDepth", 0))
    expected_data_bytes = int(wav.get("dataBytes", 0))
    expected_file_bytes = int(wav.get("fileBytes", 0))
    require(expected_frames > 0, "wav frame count missing")
    require(expected_sample_rate > 0, "wav sample rate missing")
    require(expected_channels > 0, "wav channel count missing")
    require(expected_bit_depth > 0, "wav bit depth missing")
    require(expected_data_bytes > 0, "wav data byte count missing")
    require(expected_file_bytes > 0, "wav file byte count missing")

    response = request(f"{base_url}/artifact?path={urllib.parse.quote(audio_path)}")
    require(response.status == 200, "primary audio WAV did not return 200")
    require_no_store(response, "primary audio WAV")
    require(
        response.headers.get("accept-ranges") == "bytes",
        "primary audio WAV did not advertise byte ranges",
    )
    require(len(response.body) == expected_file_bytes, "WAV file byte count mismatch")

    range_url = f"{base_url}/artifact?path={urllib.parse.quote(audio_path)}"
    range_response = request(range_url, headers={"Range": "bytes=0-15"})
    require(range_response.status == 206, "primary audio range did not return 206")
    require_no_store(range_response, "primary audio range")
    require(
        range_response.headers.get("accept-ranges") == "bytes",
        "primary audio range did not advertise byte ranges",
    )
    require(
        range_response.headers.get("content-range")
        == f"bytes 0-15/{expected_file_bytes}",
        "primary audio range content-range mismatch",
    )
    require(len(range_response.body) == 16, "primary audio range byte count mismatch")

    open_range = request(range_url, headers={"Range": "bytes=16-"})
    require(open_range.status == 206, "open-ended primary audio range did not return 206")
    require_no_store(open_range, "open-ended primary audio range")
    require(
        open_range.headers.get("content-range") == f"bytes 16-{expected_file_bytes - 1}/{expected_file_bytes}",
        "open-ended primary audio range content-range mismatch",
    )
    require(
        open_range.body == response.body[16:],
        "open-ended primary audio range bytes mismatch",
    )

    suffix_range = request(range_url, headers={"Range": "bytes=-16"})
    require(suffix_range.status == 206, "suffix primary audio range did not return 206")
    require_no_store(suffix_range, "suffix primary audio range")
    require(
        suffix_range.headers.get("content-range")
        == f"bytes {expected_file_bytes - 16}-{expected_file_bytes - 1}/{expected_file_bytes}",
        "suffix primary audio range content-range mismatch",
    )
    require(suffix_range.body == response.body[-16:], "suffix primary audio range bytes mismatch")

    unsatisfied_range = request(
        range_url,
        headers={"Range": f"bytes={expected_file_bytes + 1}-"},
    )
    require(
        unsatisfied_range.status == 416,
        "unsatisfied primary audio range did not return 416",
    )
    require_no_store(unsatisfied_range, "unsatisfied primary audio range")
    require(
        unsatisfied_range.headers.get("content-range") == f"bytes */{expected_file_bytes}",
        "unsatisfied primary audio range content-range mismatch",
    )
    require(
        unsatisfied_range.headers.get("content-length") == "0",
        "unsatisfied primary audio range content-length mismatch",
    )

    for label, header in [
        ("unsupported unit", "samples=0-15"),
        ("multi range", "bytes=0-1,4-5"),
        ("reversed range", "bytes=15-0"),
        ("zero suffix", "bytes=-0"),
    ]:
        invalid_range = request(range_url, headers={"Range": header})
        require(invalid_range.status == 416, f"{label} primary audio range did not return 416")
        require_no_store(invalid_range, f"{label} primary audio range")
        require(
            invalid_range.headers.get("content-range") == f"bytes */{expected_file_bytes}",
            f"{label} primary audio range content-range mismatch",
        )
        require(
            invalid_range.headers.get("content-length") == "0",
            f"{label} primary audio range content-length mismatch",
        )
        require(invalid_range.body == b"", f"{label} primary audio range returned a body")

    try:
        with tempfile.TemporaryFile() as handle:
            handle.write(response.body)
            handle.seek(0)
            with open_wave(handle, "rb") as wave_file:
                require(wave_file.getnframes() == expected_frames, "WAV frame mismatch")
                require(
                    wave_file.getframerate() == expected_sample_rate,
                    "WAV sample rate mismatch",
                )
                require(
                    wave_file.getnchannels() == expected_channels,
                    "WAV channel count mismatch",
                )
                require(
                    wave_file.getsampwidth() * 8 == expected_bit_depth,
                    "WAV bit depth mismatch",
                )
                require(
                    expected_frames * expected_channels * wave_file.getsampwidth()
                    == expected_data_bytes,
                    "WAV data byte count mismatch",
                )
                wave_file.rewind()
                samples = decode_mono_float_samples(
                    wave_file.readframes(expected_frames),
                    expected_channels,
                    wave_file.getsampwidth(),
                )
                require(len(samples) == expected_frames, "decoded WAV sample count mismatch")
                require_phase_audio_measurements(
                    manifest,
                    samples,
                    expected_sample_rate,
                )
    except WaveError as error:
        raise AssertionError(f"primary audio WAV parse failed: {error}") from error


def require_read_only_method_rejections(base_url: str) -> None:
    for method, path in [
        ("POST", "/api/manifest"),
        ("POST", "/api/node-metadata-kinds"),
        ("PUT", "/artifact?path=runtime_dsp_object_bound_wav_resync_demo.wav"),
        ("PATCH", "/public/app.js"),
        ("DELETE", "/"),
        ("OPTIONS", "/api/manifest"),
    ]:
        response = request(f"{base_url}{path}", method=method)
        label = f"{method} {path}"
        require(response.status == 405, f"{label} did not return 405")
        require_no_store(response, label)


def require_root_shell(base_url: str) -> None:
    expected = (PUBLIC / "index.html").read_bytes()
    expected_size = str(len(expected))
    root_response: Response | None = None
    for path in ["/", "/public/index.html"]:
        response = request(f"{base_url}{path}")
        require(response.status == 200, f"{path} shell did not return 200")
        require_no_store(response, f"{path} shell")
        require_content_type(response, "text/html", f"{path} shell")
        require(
            response.headers.get("content-length") == expected_size,
            f"{path} shell content-length mismatch",
        )
        require(response.body == expected, f"{path} shell did not match local index.html")
        if path == "/":
            root_response = response

    require(root_response is not None, "root shell response missing")
    require_shell_contract(root_response.body.decode("utf-8"))


def require_static_assets(base_url: str) -> None:
    for path, content_type, source_path in [
        ("/public/app.js", ("application/javascript", "text/javascript"), PUBLIC / "app.js"),
        (
            "/public/node-live-audio-worklet.js",
            ("application/javascript", "text/javascript"),
            PUBLIC / "node-live-audio-worklet.js",
        ),
        ("/public/styles.css", "text/css", PUBLIC / "styles.css"),
    ]:
        expected = source_path.read_bytes()
        expected_size = str(len(expected))
        head_response = request(f"{base_url}{path}", method="HEAD")
        require(head_response.status == 200, f"{path} HEAD did not return 200")
        require(head_response.body == b"", f"{path} HEAD returned a body")
        require_no_store(head_response, f"{path} HEAD")
        require_content_type(head_response, content_type, f"{path} HEAD")
        require(
            head_response.headers.get("content-length") == expected_size,
            f"{path} HEAD content-length mismatch",
        )

        get_response = request(f"{base_url}{path}")
        require(get_response.status == 200, f"{path} GET did not return 200")
        require_no_store(get_response, f"{path} GET")
        require_content_type(get_response, content_type, f"{path} GET")
        require(
            get_response.headers.get("content-length") == expected_size,
            f"{path} GET content-length mismatch",
        )
        require(get_response.body == expected, f"{path} GET did not match local file bytes")


def require_waveform_seek_source_contract() -> None:
    app_source = (PUBLIC / "app.js").read_text(encoding="utf-8")
    style_source = (PUBLIC / "styles.css").read_text(encoding="utf-8")
    require(
        "function seekPrimaryAudioToFrame(frame, source = inspectionSources.waveform)" in app_source,
        "waveform seek helper missing",
    )
    require(
        "audio.currentTime = targetTime;" in app_source,
        "waveform seek helper does not seek primary audio",
    )
    for snippet in [
        "function analyzeWaveform(samples)",
        '["peak", formatCompactNumber(stats.peak)]',
        '["rms", formatCompactNumber(stats.rms)]',
        '["dc offset", formatCompactNumber(stats.dcOffset)]',
        "function analyzeSampleRange(samples, startFrame, endFrame)",
        "function estimateZeroCrossingFrequency(samples, startFrame, endFrame, sampleRate)",
        "function activeParameterValue(name, region)",
        "function producerPhaseAudioMeasurement(region)",
        "function measuredPhaseAudio(region)",
        "function targetPeakFor(targetAmplitude, targetBias)",
        "function measuredPhaseAudioMatches(measurement, targetFrequency, targetAmplitude, targetBias = 0)",
        "function measuredPhaseDelta(measuredValue, targetValue)",
        "const measuredFrequency = document.getElementById(\"currentMeasuredFrequency\")",
        "const measuredPeak = document.getElementById(\"currentMeasuredPeak\")",
        "const measuredFrequencyDelta = document.getElementById(\"currentMeasuredFrequencyDelta\")",
        "const measuredPeakDelta = document.getElementById(\"currentMeasuredPeakDelta\")",
        "const measuredStatus = document.getElementById(\"currentMeasuredStatus\")",
        "measurement?.frequency === null || measurement?.frequency === undefined",
        "`measured ${formatCompactNumber(measurement.frequency)} Hz`",
        "`peak ${formatCompactNumber(measurement.peak)}`",
        "`freq delta ${formatSignedNumber(frequencyDelta)}`",
        "`peak delta ${formatSignedNumber(peakDelta)}`",
        '"measured ok"',
        '"measured mismatch"',
        "Math.abs(measurement.frequency - targetFrequency) <= phaseAudioFrequencyToleranceHz",
        "Math.abs(measurement.peak - targetPeak) <= phaseAudioAmplitudeTolerance",
        "Math.abs(measurement.dcOffset - (targetBias || 0)) <= phaseAudioAmplitudeTolerance",
        "function phaseAudioMeasurementIssues(manifest)",
        "const phaseAudioFrequencyToleranceHz = 0.5",
        "const phaseAudioAmplitudeTolerance = 0.001",
        "const phaseAudioRmsTolerance = 0.001",
        "function renderCurrentParameters(region)",
        "const frames = Math.max(0, region.endFrame - region.startFrame)",
        ")} / ${frames} frames`",
        "waveformProbeSource: null",
        "function labelInspectionCursorPill(element, label, value, stateName)",
        "element.dataset.inspectionPill = label",
        "element.dataset.inspectionValue = value",
        "element.dataset.inspectionState = stateName",
        "function labelInspectionCursorSurface(cursor, value, stateName)",
        'cursor.dataset.inspectionCursorLabel = "inspection cursor"',
        "cursor.dataset.inspectionCursorValue = value",
        "cursor.dataset.inspectionCursorState = stateName",
        'cursor.setAttribute("role", "group")',
        "function setInspectionCursorSource(sourceName, mode)",
        "source.className = `pill inspection-source ${mode}`",
        "labelInspectionCursorPill(source, \"inspection source\", value, mode)",
        "manifestLoading: false",
        "function renderRefreshButton(loading = state.manifestLoading)",
        'const button = document.getElementById("refreshButton")',
        "button.disabled = loading",
        'button.textContent = loading ? "Loading Manifest" : "Reload Manifest"',
        "button.setAttribute(\"aria-busy\", String(loading))",
        "button.dataset.loading = String(loading)",
        "button.title = loading ? \"Manifest reload in progress\" : \"Reload manifest and artifacts\"",
        "if (state.manifestLoading) {",
        "state.manifestLoading = true",
        "state.manifestLoading = false",
        ".addEventListener(\"click\", loadManifest)",
        "function formatInspectionDelta(deltaFrame, sampleRate)",
        "function setInspectionCursorDelta(deltaFrame, sampleRate)",
        "const inspectionModes = Object.freeze(",
        'none: "none"',
        'transport: "transport"',
        'hover: "hover"',
        'probe: "probe"',
        "deltaFrame === null ? inspectionModes.none : inspectionModes.hover",
        "function formatAudioDuration(duration)",
        "function setInspectionCursorAudio(time, duration)",
        "formatAudioDuration(duration)",
        "const positionText = `audio ${formatSeconds(Number.isFinite(time) ? time : 0)} / ${formatAudioDuration(duration)}`",
        'labelWaveformHeaderPill(',
        '"primary audio position"',
        "Boolean(audio.getAttribute(\"src\"))",
        'labelWaveformHeaderPill(position, "waveform position", "0.000s / unknown", false)',
        "formatAudioDuration(waveform.frames / waveform.sampleRate)",
        'labelWaveformHeaderPill(sample, "waveform sample", "frame 0 / unknown / sample 0", false)',
        "const sampleText = `frame ${state.playheadFrame} / ${waveform.frames} / sample ${formatCompactNumber(",
        "function resetSharedProbeState()",
        "function resetWaveformTransientState()",
        "resetSharedProbeState();",
        "resetWaveformTransientState();",
        "function setProbePillMetadata(probe, source, frame, title)",
        "function resetProbePill(id, text, title)",
        "function resetIdleProbePill(id, title)",
        "resetProbePill(id, inspectionModes.probe, title)",
        "probe.dataset.probeSource = source",
        'probe.dataset.probeFrame = frame === null || frame === undefined ? "none" : String(frame)',
        "probe.title = title",
        'resetIdleProbePill("waveformProbe", "Waveform probe idle")',
        "`Waveform probe ${source}",
        'resetIdleProbePill("levelEnvelopeProbe", "Level envelope probe idle")',
        "`Level envelope probe ${source}",
        'resetIdleProbePill("parameterTimelineProbe", "Parameter timeline probe idle")',
        "`Parameter timeline probe ${source}",
        'resetIdleProbePill("phaseAudioStatsProbe", "Phase audio stats probe idle")',
        "Phase audio stats probe ${source}",
        'resetIdleProbePill("phaseProbe", "Phase list probe idle")',
        "Phase list probe ${source}",
        'resetIdleProbePill("signalPlotProbe", "Signal plot probe idle")',
        'resetProbePill("signalPlotProbeSource", "near frame", "Signal plot source probe idle")',
        "Signal plot probe ${probeSource}",
        "Signal plot source ${probeSource}",
        "function updateWaveformScrubberLabel(scrubber, waveform, activeRegion)",
        "scrubber.setAttribute(\"aria-valuetext\"",
        "scrubber.dataset.followMode = followText",
        "scrubber.title = `Waveform position ${timeText} / frame ${state.playheadFrame} / ${phaseText} / ${followTitle}`",
        "setInspectionCursorAudio(time, duration)",
        "setInspectionCursorAudio(0, Number.NaN)",
        "function setInspectionCursorPlayback(audio)",
        "labelInspectionCursorPill(playback, \"inspection playback\", value, stateName)",
        "setInspectionCursorPlayback(audio)",
        "setInspectionCursorPlayback(null)",
        'canvas.dataset.waveformSource = "decoded primary WAV"',
        "canvas.dataset.waveformSampleRate = String(state.waveform.sampleRate)",
        "canvas.dataset.waveformChannels = String(state.waveform.channels)",
        "canvas.dataset.waveformBitDepth = String(state.waveform.bitsPerSample)",
        "canvas.dataset.waveformFrames = String(state.waveform.frames)",
        "canvas.dataset.waveformDataBytes = String(state.waveform.dataBytes)",
        "canvas.dataset.waveformFileBytes = String(state.waveform.fileBytes)",
        "canvas.dataset.waveformPeak = formatCompactNumber(stats.peak)",
        "canvas.dataset.waveformRms = formatCompactNumber(stats.rms)",
        "`Primary WAV waveform / ${state.waveform.frames} frames / `",
        "function renderWaveformPlayControl(audio = document.getElementById(\"audioPlayer\"))",
        '"Pause primary audio"',
        '"Replay primary audio from start"',
        '"Play primary audio"',
        "const ended = ready && audio.ended",
        'const value = playing ? "Pause Audio" : ended ? "Replay Audio" : "Play Audio"',
        "const actionValue = playing",
        'const stateName = !ready ? "disabled" : playing ? "playing" : ended ? "ended" : "idle"',
        "button.textContent = value",
        "button.setAttribute(\"aria-pressed\", String(playing))",
        'labelWaveformControlButton(button, "waveform playback", actionValue, stateName)',
        "function togglePrimaryAudioPlayback()",
        "if (audio.ended) {",
        "audio.currentTime = 0;",
        "if (state.followAudio && state.waveform) {",
        "setPlayheadFrame(0);",
        "await audio.play();",
        "audio.pause();",
        "function syncWaveformToAudioEnd()",
        "setPlayheadFrame(state.waveform.frames);",
        '.addEventListener("ended", syncWaveformToAudioEnd)',
        ".addEventListener(\"click\", togglePrimaryAudioPlayback)",
        "function probeSourceText()",
        "function currentProbeSource()",
        "return state.waveformProbeSource || inspectionModes.probe",
        "source === inspectionModes.probe ? inspectionModes.probe : `${inspectionModes.probe} ${source}`",
        "function setInspectionCursorView(followAudio)",
        "labelInspectionCursorPill(view, \"inspection view\", value, stateName)",
        "setInspectionCursorView(state.followAudio)",
        'view.className = `pill inspection-view ${stateName}`',
        '.addEventListener("play", renderAudioPosition)',
        '.addEventListener("pause", renderAudioPosition)',
        '.addEventListener("ended", syncWaveformToAudioEnd)',
        "function setInspectionCursorPreview(active)",
        "labelInspectionCursorPill(preview, \"inspection preview\", value, stateName)",
        'setInspectionCursorPreview(false)',
        "lastSeekSource: null",
        "lastSeekFrame: null",
        "function setInspectionCursorSeek(sourceName)",
        "labelInspectionCursorPill(seek, \"inspection seek\", value, stateName)",
        'seek.className = `pill inspection-seek ${stateName}`',
        "function setInspectionCursorSeekTarget(region, frame, sampleRate)",
        '`seek target ${region.name} / ${formatSeconds(frame / sampleRate)} / frame ${frame}`',
        '"seek target none"',
        'target.className = `pill inspection-seek-target ${hasTarget ? "active" : "none"}`',
        "labelInspectionCursorPill(",
        "function setInspectionCursorSeekSync(match)",
        'match === "aligned"',
        'match === "diverged"',
        '"seek drift"',
        '"seek sync idle"',
        'sync.className = `pill inspection-seek-sync ${match}`',
        "setInspectionCursorSeek(state.lastSeekSource)",
        "setInspectionCursorSeekTarget(lastSeekRegion, lastSeekFrame, waveform.sampleRate)",
        "setInspectionCursorSeekSync(lastSeekTransportMatch)",
        "setInspectionCursorSeekTarget(null, null, 1)",
        'setInspectionCursorSeekSync("none")',
        "setInspectionCursorSeek(null)",
        "const lastSeekFrame =",
        "state.lastSeekFrame === null ? null : clampFrame(state.lastSeekFrame, waveform)",
        '["last seek source", state.lastSeekSource || "none"]',
        '"last seek mode"',
        "state.lastSeekFollowAudio === null",
        '"follow audio"',
        '"free view"',
        "function labelWaveformControlButton(button, label, value, stateName)",
        "button.dataset.waveformControlLabel = label",
        "button.dataset.waveformControlValue = valueText",
        "button.dataset.waveformControlState = stateName",
        'labelWaveformControlButton(button, "waveform playback", actionValue, stateName)',
        'labelWaveformControlButton(button, "waveform view mode", actionValue, stateName)',
        "function waveformControlsLabeled()",
        'return waveformControlButtonsLabeled(["waveformPlayButton", "followAudioButton"])',
        "function waveformPlayControlLabeled()",
        'return waveformControlButtonsLabeled(["waveformPlayButton"])',
        "function followAudioControlLabeled()",
        'return waveformControlButtonsLabeled(["followAudioButton"])',
        "function waveformControlButtonsLabeled(ids)",
        '["last seek frame", lastSeekFrame === null ? "none" : String(lastSeekFrame)]',
        '"last seek time"',
        '["last seek phase", lastSeekRegion?.name || "none"]',
        "const lastSeekTransportDeltaFrame =",
        '"last seek transport match"',
        '"last seek transport delta"',
        "lastSeekTransportDeltaFrame === 0",
        "formatInspectionDelta(lastSeekTransportDeltaFrame, waveform.sampleRate)",
        "const lastSeekHoverDeltaFrame =",
        '"last seek hover match"',
        '"last seek hover delta"',
        "lastSeekHoverDeltaFrame === 0",
        "formatInspectionDelta(lastSeekHoverDeltaFrame, waveform.sampleRate)",
        "state.lastSeekFrame = targetFrame",
        "state.lastSeekFollowAudio = state.followAudio",
        "scrubberPointerActive: false",
        "function beginScrubberDrag(event)",
        "function endScrubberDrag(event)",
        "state.lastSeekFrame = null",
        "state.lastSeekFollowAudio = null",
        "state.scrubberPointerActive = false",
        "const inspectionSources = Object.freeze(",
        'waveform: "waveform"',
        'scrubber: "scrubber"',
        'levelEnvelope: "level envelope"',
        'signalPlot: "signal plot"',
        'parameterTimeline: "parameter timeline"',
        'phaseAudioStats: "phase audio stats"',
        'phaseList: "phase list"',
        'phaseJump: "phase jump"',
        "button.dataset.phaseName = region.name || \"\"",
        "button.dataset.phaseStartFrame = String(region.startFrame)",
        "button.dataset.phaseEndFrame = String(region.endFrame)",
        "button.dataset.phaseStartTime = formatSeconds(region.startFrame / waveform.sampleRate)",
        "button.dataset.phaseEndTime = formatSeconds(region.endFrame / waveform.sampleRate)",
        '`Jump waveform to ${region.name} phase from frame ${region.startFrame} to ${region.endFrame}`',
        "`Jump to ${region.name} from ${button.dataset.phaseStartTime} to ${button.dataset.phaseEndTime}`",
        "seekPrimaryAudioToFrame(region.startFrame, inspectionSources.phaseJump)",
        "seekPrimaryAudioToFrame(waveformFrameAtClientX(clientX), inspectionSources.waveform)",
        "seekPrimaryAudioToFrame(Math.round(ratio * waveform.frames), inspectionSources.scrubber)",
        "function setInspectionCursorTarget(region, frame, sampleRate)",
        '`target ${region.name} / ${formatSeconds(frame / sampleRate)} / frame ${frame}`',
        '"target none"',
        'target.className = `pill inspection-target ${hasTarget ? "active" : "none"}`',
        'labelInspectionCursorPill(target, "inspection target", value, hasTarget ? "active" : "none")',
        "setInspectionCursorTarget(null, null, 1)",
        "function setInspectionCursorTransport(region, frame, sampleRate)",
        '`transport ${region.name} / ${formatSeconds(frame / sampleRate)} / frame ${frame}`',
        '"transport none"',
        'transport.className = `pill inspection-transport ${hasTransport ? "active" : "none"}`',
        "labelInspectionCursorPill(",
        "setInspectionCursorTransport(null, null, 1)",
        "function setInspectionCursorDivergence(transportRegion, targetRegion)",
        "`phase diverged ${transportRegion.name} -> ${targetRegion.name}`",
        '"phase aligned"',
        "divergence.className = `pill inspection-divergence ${diverged ? \"diverged\" : \"aligned\"}`",
        "setInspectionCursorDivergence(null, null)",
        "setInspectionCursorSource(inspectionModes.none, inspectionModes.none)",
        "setInspectionCursorDelta(null, 1)",
        "hoverFrame === null ? inspectionModes.transport : inspectionModes.hover",
        "setInspectionCursorDelta(hoverDeltaFrame, waveform.sampleRate)",
        "setInspectionCursorPreview(hoverFrame !== null)",
        "setInspectionCursorTransport(transportRegion, transportFrame, waveform.sampleRate)",
        "setInspectionCursorTarget(hoverRegion, hoverFrame, waveform.sampleRate)",
        "setInspectionCursorDivergence(transportRegion, hoverRegion)",
        '["hover source", hoverFrame === null ? "none" : hoverSource]',
        "const hoverDeltaFrame = hoverFrame === null ? null : hoverFrame - transportFrame",
        '"hover delta"',
        "state.waveformProbeSource = inspectionSources.waveform",
        "state.waveformProbeSource = inspectionSources.levelEnvelope",
        "function formatProbeFrame(frame, waveform, region = waveformRegionAtFrameFor(waveform, frame))",
        "function probeFrameLabelsReady()",
        "const label = formatProbeFrame(0, waveform)",
        'label.includes("0.000s")',
        'label.includes("frame 0")',
        "function waveformRegionAtFrameFor(waveform, frame)",
        "formatProbeFrame(frame, waveform, region)} / peak ${formatCompactNumber(",
        "state.waveformProbeFrame === null ? null : inspectionSources.signalPlot",
        "state.waveformProbeSource = inspectionSources.parameterTimeline",
        "state.waveformProbeSource = inspectionSources.phaseAudioStats",
        "state.waveformProbeSource = inspectionSources.phaseList",
        "setSharedProbeFrame(region.startFrame, inspectionSources.phaseJump)",
        "function renderSandboxContract(manifest)",
        '["allowed", "display manifest artifacts", Boolean(handoff.entryPoint)]',
        '["allowed", "play browser-native WAV", Boolean(handoff.primaryAudioArtifact)]',
        '["allowed", "inspect decoded WAV data", handoff.inspectionMode === expectedInspectionMode]',
        '["forbidden", "own DSP objects", handoff.circuitOwnsDspObjects === false]',
        '["forbidden", "make DSP know Circuit", handoff.dspObjectsKnowCircuit === false]',
        '["forbidden", "own scheduler", handoff.ownsScheduler === false]',
        '["forbidden", "own audio engine", handoff.ownsAudioEngine === false]',
        '["forbidden", "serialize patches", handoff.serializesPatch === false]',
        '["required", "caller owns processing order", handoff.callerOwnsProcessingOrder === true]',
        "item.dataset.contractKind = kind",
        "item.dataset.contractLabel = label",
        'item.dataset.contractState = rowOk ? "ok" : "check"',
        'item.setAttribute("role", "group")',
        "item.setAttribute(\"aria-label\", `${kind}: ${label} / ${item.dataset.contractState}`)",
        "item.title = `${kind}: ${label} / ${item.dataset.contractState}`",
        "function sandboxContractRowsLabeled()",
        'setStatus("sandboxContractStatus", ok ? "Bounded" : "Check", ok)',
        'frequencyValue === null ? "freq" : `freq ${formatCompactNumber(frequencyValue)} Hz`',
        'amplitudeValue === null ? "amp" : `amp ${formatCompactNumber(amplitudeValue)}`',
        'const statusText = ok ? `params ${region?.name || "synced"}` : "params missing"',
        'labelWaveformHeaderPill(status, "current parameter status", statusText, ok)',
        "function parameterTimelineRows(manifest)",
        "function renderParameterTimeline(manifest)",
        "function renderUnavailableParameterSummary()",
        '["first half frequency", "unavailable"]',
        "renderUnavailableParameterSummary()",
        "function renderUnavailableParameterTimeline()",
        'label.textContent = "resync"',
        'value.textContent = "manifest required"',
        "renderUnavailableParameterTimeline()",
        "function updateParameterTimelinePlayhead(region)",
        'phase.textContent = region',
        '`phase ${region.name} / freq ${',
        '} / amp ${amplitude === null ? "missing" : formatCompactNumber(amplitude)}`',
        "function updateParameterTimelinePreview(region)",
        'segment.classList.toggle("preview", segment.dataset.phaseName === region?.name)',
        "function renderParameterTimelineProbe()",
        "function probeParameterTimelineSegment(event)",
        "function clearParameterTimelineProbe()",
        'marker.id = "parameterTimelinePlayhead"',
        'probeMarker.id = "parameterTimelineProbeMarker"',
        'segment.dataset.phaseName = phase.name || ""',
        "segment.dataset.parameterName = name",
        "segment.dataset.parameterValue = valueText",
        "segment.dataset.startFrame = String(span.startFrame)",
        "segment.dataset.endFrame = String(span.endFrame)",
        "segment.dataset.startTime = startTime",
        "segment.dataset.endTime = endTime",
        'segment.setAttribute("aria-label", segmentLabel)',
        'segment.setAttribute("role", "group")',
        "segment.title = `${segmentLabel} / ${startTime} to ${endTime}`",
        '.addEventListener("pointermove", probeParameterTimelineSegment)',
        "function buildLevelEnvelope(waveform)",
        "function drawLevelEnvelope()",
        "function renderLevelEnvelope()",
        'canvas.dataset.envelopeSource = "decoded primary WAV"',
        "canvas.dataset.envelopeWindowMs = String(envelope.windowMs)",
        "canvas.dataset.envelopeWindowFrames = String(envelope.windowFrames)",
        "canvas.dataset.envelopeWindows = String(envelope.windows.length)",
        "canvas.dataset.envelopePeak = formatCompactNumber(envelope.peak)",
        "canvas.dataset.envelopeRms = formatCompactNumber(envelope.rms)",
        "canvas.dataset.envelopeFrames = String(waveform.frames)",
        "`Primary WAV level envelope / ${formatCompactNumber(envelope.windowMs)} ms window / `",
        "function renderUnavailableLevelEnvelopeMeta()",
        '["source", "manifest/audio required", "decoded primary WAV"]',
        "renderUnavailableLevelEnvelopeMeta()",
        "function levelEnvelopeWindowAtFrame(frame)",
        "function renderLevelEnvelopeProbe()",
        "function probeLevelEnvelopeAtClientX(clientX)",
        "function clearLevelEnvelopeProbe()",
        'state.waveformProbeFrame = waveformFrameAtClientXForCanvas(clientX, "levelEnvelopeCanvas")',
        '.addEventListener("pointerleave", clearLevelEnvelopeProbe)',
        "function renderPhaseAudioStats()",
        "function renderUnavailablePhaseAudioStats()",
        'name.textContent = "Phase audio stats unavailable"',
        '["producer compare", "unavailable", "present"]',
        "renderUnavailablePhaseAudioStats()",
        "function updatePhaseAudioStatsActive(region)",
        "function updatePhaseProbeTargets()",
        'document.querySelectorAll(".phase, .phase-stat")',
        'item.classList.toggle("preview", item.dataset.phaseName === region?.name)',
        "function renderPhaseAudioStatsProbe()",
        "${probeSourceText()} ${formatProbeFrame(frame, waveform, region)}",
        "function probePhaseAudioStats(event)",
        "function clearPhaseAudioStatsProbe()",
        "item.dataset.startTime = startTime",
        "item.dataset.endTime = endTime",
        "item.dataset.targetFrequency = targetFrequencyText",
        "item.dataset.measuredFrequency = measuredFrequencyText",
        "item.dataset.targetAmplitude = targetPeakText",
        "item.dataset.peak = peakText",
        "item.dataset.rms = rmsText",
        "item.dataset.producerMatch = String(Boolean(producerOk))",
        'item.setAttribute("aria-label", itemLabel)',
        'item.setAttribute("role", "group")',
        "item.dataset.startFrame = String(region.startFrame)",
        'item.addEventListener("pointermove", probePhaseAudioStats)',
        "function renderPhaseProbe()",
        "function probePhaseList(event)",
        "${probeSourceText()} ${formatProbeFrame(frame, waveform, region)}",
        "function clearPhaseListProbe()",
        'item.dataset.phaseIndex = String(index)',
        'item.dataset.phaseName = phase.name || ""',
        "item.dataset.startFrame = String(span.startFrame)",
        "item.dataset.endFrame = String(span.endFrame)",
        "item.dataset.startTime = startTime",
        "item.dataset.endTime = endTime",
        "item.dataset.duration = duration",
        "item.dataset.wavShare = share",
        'item.setAttribute("aria-label", itemLabel)',
        'item.setAttribute("role", "group")',
        "item.title = `${itemLabel} / ${startTime} to ${endTime} / ${duration}`",
        'item.addEventListener("pointermove", probePhaseList)',
        '["window", `${formatCompactNumber(envelope.windowMs)} ms`]',
        '["source", "decoded primary WAV"]',
        '["target freq", targetFrequencyText]',
        '["measured freq", measuredFrequencyText]',
        '["freq delta", frequencyDelta]',
        '["producer freq", Number.isFinite(producerFrequency) ? `${formatCompactNumber(producerFrequency)} Hz` : "missing"]',
        '["producer freq delta", producerFrequencyDeltaText]',
        '["target amp", targetAmplitudeText]',
        '["target bias", formatCompactNumber(biasValue)]',
        '["target peak", targetPeakText]',
        '["peak", peakText]',
        '["peak delta", peakDelta]',
        '["producer peak", Number.isFinite(producerPeak) ? formatCompactNumber(producerPeak) : "missing"]',
        '["producer peak delta", producerPeakDeltaText]',
        '["producer rms", Number.isFinite(producerRms) ? formatCompactNumber(producerRms) : "missing"]',
        '["producer rms delta", producerRmsDeltaText]',
        '["rms", rmsText]',
        'status.textContent = allOk ? "Verified" : "Check"',
        "function renderUnavailableProducerProof()",
        '["runtime API", "unavailable", boolText(false)]',
        "renderUnavailableProducerProof()",
        "function renderUnavailableSandboxContract()",
        '"caller-owned processing order"',
        "renderUnavailableSandboxContract()",
        "function renderUnavailableBoundaryFlags()",
        "requiredFlags.map(([key, expected]) => [",
        "renderUnavailableBoundaryFlags()",
        "function renderUnavailablePhaseCoverage()",
        '["wav frames", "unavailable", "present"]',
        "renderUnavailablePhaseCoverage()",
        "function renderUnavailablePhases()",
        'name.textContent = "Phases unavailable"',
        '["resync proof", "unavailable", "present"]',
        "renderUnavailablePhases()",
        "function renderUnavailableArtifactCoverage()",
        '["artifact links", "unavailable", "available"]',
        "renderUnavailableArtifactCoverage()",
        "function renderUnavailableArtifacts()",
        'label.textContent = "Artifact packet"',
        'path.textContent = "manifest required"',
        "row.dataset.artifactKind = \"unavailable\"",
        "row.dataset.artifactLabel = \"Artifact packet\"",
        'row.setAttribute("aria-label", "Missing artifact packet (unavailable)")',
        "renderUnavailableArtifacts()",
        '["entry-point matches handoff", entryPointPath === handoff.entryPoint]',
        '["audio matches handoff", primaryAudioPath === handoff.primaryAudioArtifact]',
        '["phase report coverage", phaseReportIssue === "" ? "match" : phaseReportIssue, "match"]',
        '["phase report coverage", phaseReportIssue === ""]',
        '["parameter resync", parameterResyncIssue === ""]',
        "function parameterResyncContractIssue(manifest)",
        'return "parameter resync missing"',
        'return `${key} resync changed flag missing`',
        'return `${key} did not resync upward`',
        '["phase audio measurements", phaseAudioIssues.length === 0]',
        "function renderUnavailableChecklist()",
        '["sandbox handoff", false]',
        "renderUnavailableChecklist()",
        "const statusStripLabels = Object.freeze({",
        "function labelStatusStripValue(element, label, value, ok)",
        "element.dataset.statusLabel = label",
        "element.dataset.statusValue = valueText",
        "element.dataset.statusState = stateName",
        "function statusStripItemsLabeled()",
        '["status strip labels", statusStripItemsLabeled()]',
        "function labelPrimaryAudio(path, ok)",
        "audio.dataset.audioLabel = \"Primary Audio\"",
        "audio.dataset.audioPath = pathText",
        "audio.dataset.audioState = stateName",
        "function primaryAudioLabeled(manifest)",
        '["primary audio labels", primaryAudioLabeled(manifest)]',
        "function labelPrimaryAudioTitle(path, ok)",
        "title.dataset.audioTitlePath = pathText",
        "function primaryAudioTitleLabeled(manifest)",
        '["primary audio title labels", primaryAudioTitleLabeled(manifest)]',
        "function primaryAudioPositionLabeled()",
        'return waveformHeaderPillsLabeled(["audioPosition"])',
        '["primary audio position labels", primaryAudioPositionLabeled()]',
        "function labelWaveformHeaderPill(element, label, value, ok)",
        "element.dataset.waveformHeaderLabel = label",
        "element.dataset.waveformHeaderValue = valueText",
        "element.dataset.waveformHeaderState = stateName",
        "function waveformHeaderPillsLabeled(ids)",
        "function currentParameterPillsLabeled()",
        'waveformHeaderPillsLabeled(["currentFrequency", "currentAmplitude", "currentParameterStatus"])',
        "currentMeasuredAudioPillsLabeled()",
        "function currentMeasuredAudioPillsLabeled()",
        '"currentMeasuredFrequency"',
        '"currentMeasuredPeak"',
        '"currentMeasuredFrequencyDelta"',
        '"currentMeasuredPeakDelta"',
        '"currentMeasuredStatus"',
        '["current parameter labels", waveformReady && currentParameterPillsLabeled()]',
        'labelWaveformHeaderPill(position, "waveform position", positionText, true)',
        'labelWaveformHeaderPill(sample, "waveform sample", sampleText, true)',
        'labelWaveformHeaderPill(phase, "waveform phase", phaseText, Boolean(activeRegion))',
        "function waveformTransportPillsLabeled()",
        '["waveform transport labels", waveformReady && waveformTransportPillsLabeled()]',
        'labelWaveformHeaderPill(target, "phase jump target", targetText, Boolean(waveform))',
        "function phaseJumpTargetLabeled()",
        '["phase jump target labels", waveformReady && phaseJumpTargetLabeled()]',
        "function reloadManifestControlLabeled()",
        '["Reload manifest", "Loading manifest"].includes(label)',
        '["reload manifest labels", reloadManifestControlLabeled()]',
        "item.dataset.summaryLabel = label",
        "item.dataset.summaryValue = valueText",
        "item.dataset.summaryKind = kind || \"value\"",
        "item.dataset.summaryState = stateName",
        'item.setAttribute("role", "group")',
        "item.setAttribute(\"aria-label\", `${label}: ${valueText}`)",
        "function parameterSummaryCardsLabeled()",
        "item.dataset.checkLabel = label",
        "item.dataset.checkState = stateName",
        "item.setAttribute(\"aria-label\", `${label}: ${stateName}`)",
        "function checkRowsLabeled(containerId, expectedRows)",
        "function checkRowsHaveUniqueLabels(rows)",
        "new Set(labels).size === labels.length",
        "function consumerChecklistRowsLabeled()",
        'return checkRowsLabeled("checklist", 22)',
        "function setSourceText(id, key, value, expected = \"present\", ok = true)",
        "element.dataset.sourceKey = key",
        "element.dataset.sourceValue = valueText",
        "element.dataset.sourceExpected = expectedText",
        'element.dataset.sourceState = ok ? "ok" : "check"',
        "element.setAttribute(\"aria-label\", `${key}: ${valueText}`)",
        "function sourceRowsLabeled()",
        "function renderKeyValue(container, rows)",
        "dt.dataset.kvKey = key",
        "dd.dataset.kvKey = key",
        "dd.dataset.kvValue = valueText",
        "dd.dataset.kvExpected = expected === undefined ? \"none\" : expectedText",
        "dd.dataset.kvState = stateName",
        "dd.setAttribute(\"aria-label\", `${key}: ${valueText}`)",
        "function keyValueRowsLabeled(containerId, expectedRows)",
        "function producerProofRowsLabeled()",
        'keyValueRowsLabeled("producerProof", 9)',
        'keyValueRowsLabeled("producerProof", 10)',
        "function circuitChainRowsLabeled()",
        'document.querySelectorAll("#circuitChain .chain-row")',
        "function renderCircuitChain(manifest)",
        "function renderUnavailableCircuitChain()",
        "formatCircuitStep(step)",
        "Circuit connection",
        "Caller processing step",
        '["circuit chain rows", circuitChainRowsLabeled()]',
        "function boundaryFlagRowsLabeled()",
        "function phaseCoverageRowsLabeled()",
        "function artifactCoverageRowsLabeled()",
        "function renderReportControls()",
        "const label = `Show report ${report.label}`",
        "button.dataset.reportIndex = String(index)",
        "button.dataset.reportKind = report.kind",
        'button.dataset.reportPath = report.path || ""',
        'button.setAttribute("aria-label", label)',
        'button.setAttribute("aria-pressed", String(active))',
        "button.title = label",
        "function reportControlsLabeled()",
        'label.startsWith("Show report ")',
        '["report control labels", reportControlsLabeled()]',
        "viewer.dataset.reportLabel = report.label || \"\"",
        "viewer.dataset.reportKind = report.kind || \"\"",
        "viewer.dataset.reportState = stateName",
        "viewer.setAttribute(\"aria-label\", `Report viewer ${report.label}: ${stateName}`)",
        "function reportViewerLabeled()",
        '["report viewer labels", state.reports.length > 0 && reportViewerLabeled()]',
        "function artifactRowLabel(link)",
        "row.dataset.artifactKind = link.kind || \"\"",
        "row.dataset.artifactPath = link.path || \"\"",
        "row.dataset.artifactLabel = link.label || \"\"",
        'row.setAttribute("aria-label", rowLabel)',
        "function artifactRowsLabeled(manifest)",
        "rows.length === links.length",
        "label === artifactRowLabel(link)",
        'row.getAttribute("href") === artifactUrl(link.path)',
        '["artifact row labels", artifactRowsLabeled(manifest)]',
        '["artifact coverage row labels", artifactCoverageRowsLabeled()]',
        '["source row labels", sourceRowsLabeled()]',
        "renderHandsOnReadiness(state.response?.manifest, Boolean(state.waveform))",
        "function renderHandsOnReadiness(manifest, waveformReady = Boolean(state.waveform))",
        "function phaseJumpButtonsLabeled(manifest)",
        "function waveformScrubberLabeled()",
        "function waveformCanvasLabeled()",
        "function levelEnvelopeCanvasLabeled()",
        "function probePillLabeled(id)",
        "function probePillsLabeled(ids)",
        "function waveformProbeLabeled()",
        "function levelEnvelopeProbeLabeled()",
        "function parameterTimelineProbeLabeled()",
        "function parameterTimelineSegmentsLabeled()",
        "function parameterTimelinePreviewAvailable()",
        "return parameterTimelineSegmentsLabeled()",
        "function phaseAudioStatsProbeLabeled()",
        "function phaseListProbeLabeled()",
        "function phaseListItemsLabeled()",
        "function phasePreviewTargetAvailable()",
        "return phaseListItemsLabeled() && phaseAudioStatsItemsLabeled()",
        "function phaseAudioStatsItemsLabeled()",
        "function signalPlotPointProbeLabeled()",
        "function signalPlotSourceProbeLabeled()",
        "function signalPlotProbeLabeled()",
        'return probePillLabeled("waveformProbe")',
        'return probePillLabeled("levelEnvelopeProbe")',
        'return probePillLabeled("parameterTimelineProbe")',
        'label.startsWith("Parameter ")',
        '["parameter timeline segment labels", waveformReady && parameterTimelineSegmentsLabeled()]',
        'return probePillLabeled("phaseAudioStatsProbe")',
        'label.startsWith("Phase audio stats ")',
        '["phase audio stats item labels", waveformReady && phaseAudioStatsItemsLabeled()]',
        'return probePillLabeled("phaseProbe")',
        'label.startsWith("Phase ")',
        '["phase list item labels", waveformReady && phaseListItemsLabeled()]',
        'return probePillLabeled("signalPlotProbe")',
        'return probePillLabeled("signalPlotProbeSource")',
        'return probePillsLabeled(["signalPlotProbe", "signalPlotProbeSource"])',
        "function waveformToSignalProbeAvailable()",
        "const probe = signalPlotProbeAtFrame(0)",
        "probe.nearest?.frame === 0",
        "probe.nearest.distance === 0",
        "function signalToWaveformProbeAvailable()",
        "return waveformProbeLabeled()",
        'label.startsWith("Jump waveform to ")',
        'label.includes(" phase from frame ")',
        'button.title.startsWith("Jump to ")',
        'setStatus("handsOnReadinessStatus", ok ? "Ready" : "Check", ok)',
        '"native audio",',
        '["decoded waveform", waveformReady]',
        '["producer proof row labels", producerProofRowsLabeled()]',
        '["boundary flag row labels", boundaryFlagRowsLabeled()]',
        '["phase coverage row labels", phaseCoverageRowsLabeled()]',
        '["waveform seek", waveformReady && Number(manifest?.wav?.frames) > 0]',
        '["waveform canvas labels", waveformReady && waveformCanvasLabeled()]',
        '["waveform play control", waveformPlayControlLabeled()]',
        '["waveform control labels", waveformControlsLabeled()]',
        '["waveform scrubber labels", waveformReady && waveformScrubberLabeled()]',
        '["waveform hover probe", waveformReady && waveformProbeLabeled()]',
        '["waveform probe labels", waveformReady && waveformProbeLabeled()]',
        '["level envelope probe", waveformReady && levelEnvelopeProbeLabeled()]',
        '["level envelope probe labels", waveformReady && levelEnvelopeProbeLabeled()]',
        '["level envelope canvas labels", waveformReady && levelEnvelopeCanvasLabeled()]',
        '["parameter timeline probe", waveformReady && parameterTimelineProbeLabeled()]',
        '["parameter timeline probe labels", waveformReady && parameterTimelineProbeLabeled()]',
        '["parameter timeline segment labels", waveformReady && parameterTimelineSegmentsLabeled()]',
        '["parameter timeline preview", waveformReady && parameterTimelinePreviewAvailable()]',
        '["probe frame labels", waveformReady && probeFrameLabelsReady()]',
        '["follow/free view", followAudioControlLabeled()]',
        '["current measured audio", waveformReady && currentMeasuredAudioPillsLabeled()]',
        '["phase list probe", waveformReady && phaseListProbeLabeled()]',
        '["phase list probe labels", waveformReady && phaseListProbeLabeled()]',
        '["phase list item labels", waveformReady && phaseListItemsLabeled()]',
        '["phase jump preview", waveformReady && phaseJumpButtonsLabeled(manifest)]',
        '["phase jump labels", waveformReady && phaseJumpButtonsLabeled(manifest)]',
        '["phase jump target", waveformReady && phaseJumpTargetLabeled()]',
        '["phase parameter readout", parameterResyncContractIssue(manifest) === ""]',
        '["parameter summary card labels", parameterResyncContractIssue(manifest) === "" && parameterSummaryCardsLabeled()]',
        '["phase preview target", waveformReady && phasePreviewTargetAvailable()]',
        '["producer measurement compare", phaseAudioMeasurementIssues(manifest).length === 0]',
        "function callerProcessingOrderIssue(manifest)",
        "runtime_dsp_object_circuit_connected_bias_wav_demo",
        "callerProcessingOrderProof",
        "matchesCircuitConnections",
        '["caller processing order", callerProcessingIssue === ""]',
        '["caller processing order", boolText(callerProcessingIssue === ""), true]',
        '["phase audio stats probe", waveformReady && phaseAudioStatsProbeLabeled()]',
        '["phase audio stats probe labels", waveformReady && phaseAudioStatsProbeLabeled()]',
        '["phase audio stats item labels", waveformReady && phaseAudioStatsItemsLabeled()]',
        '["signal inspection", waveformReady && signalPlotCanvasLabeled()]',
        '["signal plot probe", waveformReady && signalPlotPointProbeLabeled()]',
        '["signal plot probe labels", waveformReady && signalPlotProbeLabeled()]',
        "function renderUnavailableHandsOnReadiness()",
        '["manifest loaded", false]',
        "renderUnavailableHandsOnReadiness()",
        '["signal plot source probe", waveformReady && signalPlotSourceProbeLabeled()]',
        '["waveform-to-signal probe", waveformReady && waveformToSignalProbeAvailable()]',
        '["signal-to-waveform probe", waveformReady && signalToWaveformProbeAvailable()]',
        '["inspection cursor", waveformReady && inspectionCursorLabeled()]',
        "const inspectionCursorPillIds = [",
        "function inspectionCursorPillLabeled(id)",
        '["inspection source pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorSource")]',
        '["inspection delta pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorDelta")]',
        '["inspection audio pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorAudio")]',
        '["inspection playback pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorPlayback")]',
        '["inspection view pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorView")]',
        '["inspection preview pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorPreview")]',
        '["inspection seek pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorSeek")]',
        '["inspection seek target pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorSeekTarget")]',
        '["inspection seek sync pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorSeekSync")]',
        '["inspection transport pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorTransport")]',
        '["inspection target pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorTarget")]',
        '["inspection divergence pill", waveformReady && inspectionCursorPillLabeled("inspectionCursorDivergence")]',
        "function inspectionCursorPillsLabeled()",
        "function inspectionCursorKeyValueLabeled(key)",
        "function inspectionCursorHoverDeltaLabeled()",
        'return inspectionCursorKeyValueLabeled("hover delta")',
        "function inspectionCursorLabeled()",
        'cursor.dataset.inspectionCursorState === "ok"',
        'inspectionCursorKeyValueLabeled("transport frame")',
        'inspectionCursorKeyValueLabeled("hover signal")',
        '["inspection pill labels", waveformReady && inspectionCursorPillsLabeled()]',
        '["inspection hover delta", waveformReady && inspectionCursorHoverDeltaLabeled()]',
        '["read-only boundary", validateConsumerChecklist(manifest).accepted]',
        '["consumer checklist row labels", validateConsumerChecklist(manifest).accepted && consumerChecklistRowsLabeled()]',
        '["sandbox contract row labels", validateConsumerChecklist(manifest).accepted && sandboxContractRowsLabeled()]',
        '["readiness row labels",',
        "function phaseReportCoverageIssue(manifest)",
        'return "phase report phase missing"',
        'return "phase report phase unknown"',
        'return "phase report phase duplicate"',
        '["entry point path", entryPointMatches ? "match" : "mismatch", "match"]',
        '["audio path", primaryAudioMatches ? "match" : "mismatch", "match"]',
        'countArtifactKind(links, "entry-point") === 1',
        'countArtifactKind(links, "audio") === 1',
        'countArtifactKind(links, "manifest") === 1',
        'countArtifactKind(links, "text-summary") === 1',
        'countArtifactKind(links, "wav-report") === 1',
        'return `${kind} artifact link count mismatch`',
        'return "entry-point link mismatch"',
        'return "audio link mismatch"',
        "function drawSignalPlot()",
        "function renderSignalPlot()",
        'canvas.dataset.signalSource = "decoded primary WAV"',
        "canvas.dataset.signalFocus = focusName",
        "canvas.dataset.signalMode = state.signalPlotMode",
        "canvas.dataset.signalScale = String(state.signalPlotScale)",
        "canvas.dataset.signalWindow = windowName",
        "canvas.dataset.signalWindowMs = String(state.signalPlotWindowMs)",
        "canvas.dataset.signalLagMs = String(state.signalLagMs)",
        "canvas.dataset.signalLagFrames = String(lagFrames)",
        "canvas.dataset.signalPoints = String(pointCount)",
        "canvas.dataset.signalFocusPeak = formatCompactNumber(focusStats.peak)",
        "canvas.dataset.signalFocusRms = formatCompactNumber(focusStats.rms)",
        "`Primary WAV signal plot / ${focusName} / ${state.signalPlotMode} / `",
        "function renderUnavailableSignalPlotMeta()",
        '["source", "manifest/audio required", "decoded primary WAV"]',
        "renderUnavailableSignalPlotMeta()",
        "function renderSignalPlotControls()",
        "function labelSignalPlotButton(button, label, active = false)",
        'button.setAttribute("aria-pressed", String(active))',
        "button.title = label",
        "function signalPlotWindowFrameRange(waveform, drawableFrames)",
        "function signalPlotWindowName(waveform, drawableFrames)",
        "function signalPlotRegions(waveform, drawableFrames)",
        "function signalPlotFocusName(waveform)",
        "function restoreSignalPlotFocusIndex()",
        "function signalPlotPointCount(waveform, drawableFrames)",
        "function signalPlotFocusStats(waveform, drawableFrames)",
        "function signalPlotRegionColor(index)",
        "function renderSignalPlotSummary()",
        "function renderSignalPlotPoint()",
        "function signalPlotLagFrames(waveform)",
        "function signalPlotProbeAtClientPoint(clientX, clientY)",
        "function signalPlotProbeAtFrame(frame)",
        "function renderSignalPlotProbe()",
        "waveformRegionAtFrame(frame)?.name",
        "nearest.frame",
        "`probe ${formatProbeFrame(nearest.frame, state.waveform)} / ${pointText}`",
        "${probeSourceText()} / near frame ${nearest.frame}",
        "state.waveformProbeFrame = state.signalPlotProbe.nearest?.frame ?? null",
        "clampFrame(state.waveformProbeFrame, waveform) / waveform.frames",
        "const nearestProbe = state.signalPlotProbe?.nearest",
        'context.strokeStyle = "#f6c96d"',
        "drawSignalPlot();",
        "state.signalPlotProbe = signalPlotProbeAtFrame(state.waveformProbeFrame)",
        "function probeSignalPlot(event)",
        "function clearSignalPlotProbe()",
        '.addEventListener("pointermove", probeSignalPlot)',
        '.addEventListener("pointerleave", clearSignalPlotProbe)',
        "const signalPlotSettingsKey",
        "function loadSignalPlotSettings()",
        "function saveSignalPlotSettings()",
        "function resetSignalPlotSettings()",
        "signalLagMs: 1",
        "signalPhaseFocusIndex: null",
        'signalPhaseFocusName: "all"',
        'signalPlotMode: "trace"',
        "signalPlotScale: 1",
        'signalPlotWindow: "full"',
        "signalPlotWindowMs: 80",
        "state.signalPhaseFocusIndex = index;",
        "state.signalPhaseFocusName = region.name;",
        "state.signalLagMs = lagMs;",
        "state.signalPlotMode = mode;",
        "state.signalPlotScale = scale;",
        "state.signalPlotWindow = windowMode;",
        "state.signalPlotWindowMs = windowMs;",
        'className = "control-group"',
        'dataset.signalFocus = "all"',
        "dataset.signalFocus = region.name",
        "dataset.signalLagMs = String(lagMs)",
        "dataset.signalMode = mode",
        "dataset.signalScale = String(scale)",
        "dataset.signalWindow = windowMode",
        "dataset.signalWindowMs = String(windowMs)",
        'dataset.signalReset = "settings"',
        "Signal plot focus",
        "Signal plot lag",
        "Signal plot mode",
        "Signal plot scale",
        "Signal plot window",
        "Signal plot window size",
        "Signal plot reset",
        "function signalPlotControlsLabeled()",
        "function signalPlotCanvasLabeled()",
        "groups.length === 7",
        'button.title === label',
        '["signal plot control labels", waveformReady && signalPlotControlsLabeled()]',
        '["signal plot canvas labels", waveformReady && signalPlotCanvasLabeled()]',
        '["focus", focusName]',
        '["mode", state.signalPlotMode]',
        '["scale", `x${state.signalPlotScale}`]',
        '["window", windowName]',
        '["window size", `${state.signalPlotWindowMs} ms`]',
        "frame ${pointFrame} / ${formatSeconds(pointFrame / waveform.sampleRate)} / ${region?.name || \"phase\"} / x ${formatCompactNumber(x)} / y ${formatCompactNumber(y)}",
        '["x", "sample[n]"]',
        '["y", "sample[n + lag]"]',
        '["points", String(pointCount)]',
        '["focus peak", formatCompactNumber(focusStats.peak)]',
        '["focus rms", formatCompactNumber(focusStats.rms)]',
    ]:
        require(snippet in app_source, f"waveform analysis source missing {snippet}")
    for snippet in [
        "function beginWaveformDrag(event)",
        "function dragWaveform(event)",
        "function endWaveformDrag(event)",
        "function setSharedProbeFrame(frame, source = inspectionModes.probe)",
        "function clearSharedProbeFrame()",
        "function probePhaseButton(index)",
        "function clearPhaseButtonProbe()",
        "function clearPhaseButtonProbeFromOutside(event)",
        'target.closest("#waveformPhaseControls")',
        'document.addEventListener("pointermove", clearPhaseButtonProbeFromOutside)',
        "function renderPhaseJumpTarget()",
        'target.textContent =',
        '`jump ${region.name} / ${formatSeconds(',
        '} / frame ${region.startFrame}`',
        ': "jump idle";',
        "phaseJumpPreviewIndex: null",
        "state.phaseJumpPreviewIndex = null",
        'button.classList.toggle("preview", index === state.phaseJumpPreviewIndex)',
        "renderPhaseJumpTarget();",
        "function waveformFrameAtClientX(clientX)",
        "function probeWaveformAtClientX(clientX)",
        "function renderWaveformProbe()",
        "function renderUnavailableWaveformMeta()",
        '["data bytes", "unavailable", "present"]',
        "renderUnavailableWaveformMeta()",
        "function renderInspectionCursor()",
        'labelInspectionCursorSurface(cursor, "unavailable", "check")',
        'labelInspectionCursorSurface(',
        '"transport inspection"',
        '"hover inspection"',
        'setStatus("inspectionCursorStatus", hoverFrame === null ? "Transport" : "Hover", true)',
        "const hoverDeltaFrame = hoverFrame === null ? null : hoverFrame - transportFrame",
        'const hoverFrequency = activeParameterValue("frequency", hoverRegion)',
        'const hoverAmplitude = activeParameterValue("amplitude", hoverRegion)',
        "const hoverEnvelope = hoverFrame !== null ? levelEnvelopeWindowAtFrame(hoverFrame) : null",
        '"hover delta"',
        '"hover frequency"',
        '"hover amplitude"',
        '"hover envelope peak"',
        '"hover envelope rms"',
        '["hover signal",',
        "function clearWaveformProbe()",
        "function clampFrame(frame, waveform)",
        '.addEventListener("pointerdown", beginWaveformDrag)',
        '.addEventListener("pointermove", dragWaveform)',
        '.addEventListener("pointerleave", clearWaveformProbe)',
        '.addEventListener("pointerup", endWaveformDrag)',
        '.addEventListener("pointermove", () => probePhaseButton(index))',
        '.addEventListener("focus", () => probePhaseButton(index))',
        '.addEventListener("blur", clearPhaseButtonProbe)',
        'button.dataset.phaseIndex === String(state.phaseJumpPreviewIndex)',
        "button.dataset.phaseName !== undefined",
        "button.dataset.phaseEndFrame !== undefined",
        "button.dataset.phaseEndTime !== undefined",
        'label.includes(" phase from frame ")',
    ]:
        require(snippet in app_source, f"waveform drag source missing {snippet}")
    for snippet in [
        'classList.add("dragging")',
        'classList.remove("dragging")',
    ]:
        require(snippet in app_source, f"waveform drag state missing {snippet}")
    for snippet in [
        "touch-action: none;",
        "user-select: none;",
        ".waveform.dragging",
        ".control-group",
        ".parameter-timeline",
        ".parameter-segment.active",
        ".parameter-segment.preview",
        ".parameter-timeline-marker",
        ".parameter-timeline-marker.probe",
        ".phase-stat-list",
        ".phase-stat.active",
        ".phase.preview",
        ".phase-stat.preview",
        ".phase-button.preview",
        ".pill.inspection-source.none",
        ".pill.inspection-source.transport",
        ".pill.inspection-source.hover",
        ".pill.inspection-delta.none",
        ".pill.inspection-delta.hover",
        ".pill.inspection-playback.paused",
        ".pill.inspection-playback.playing",
        ".pill.inspection-playback.ended",
        ".pill.inspection-view.follow",
        ".pill.inspection-view.free",
        ".pill.inspection-preview.idle",
        ".pill.inspection-preview.active",
        ".pill.inspection-seek.idle",
        ".pill.inspection-seek.active",
        ".pill.inspection-seek-sync.none",
        ".pill.inspection-seek-sync.aligned",
        ".pill.inspection-seek-sync.diverged",
        ".pill.inspection-target.none",
        ".pill.inspection-target.active",
        ".pill.inspection-transport.none",
        ".pill.inspection-transport.active",
        ".pill.inspection-divergence.aligned",
        ".pill.inspection-divergence.diverged",
        ".contract-list",
        ".contract-row",
        ".readiness-list",
    ]:
        require(snippet in style_source, f"waveform drag style missing {snippet}")
    require(
        "setFollowAudio(false, false);" not in app_source,
        "waveform controls still force free-view mode",
    )


def require_manifest_error_surface_contract() -> None:
    app_source = (PUBLIC / "app.js").read_text(encoding="utf-8")
    start = app_source.index("function renderError(message, details = {})")
    end = app_source.index("async function loadManifest()", start)
    render_error = app_source[start:end]
    required_unavailable_renderers = [
        "renderUnavailableProducerProof();",
        "renderUnavailableHandsOnReadiness();",
        "renderUnavailableSandboxContract();",
        "renderUnavailableParameterSummary();",
        "renderUnavailableParameterTimeline();",
        "renderUnavailableWaveformMeta();",
        "renderUnavailableLevelEnvelopeMeta();",
        "renderUnavailablePhaseAudioStats();",
        "renderUnavailableSignalPlotMeta();",
        "renderUnavailableBoundaryFlags();",
        "renderUnavailablePhaseCoverage();",
        "renderUnavailablePhases();",
        "renderUnavailableChecklist();",
        "renderUnavailableArtifactCoverage();",
        "renderUnavailableArtifacts();",
    ]
    for renderer in required_unavailable_renderers:
        require(renderer in render_error, f"manifest error surface missing {renderer}")
    for resetter in [
        'resetIdleProbePill("waveformProbe", "Waveform probe idle");',
        'resetIdleProbePill("parameterTimelineProbe", "Parameter timeline probe idle");',
        'resetIdleProbePill("levelEnvelopeProbe", "Level envelope probe idle");',
        'resetIdleProbePill("signalPlotProbe", "Signal plot probe idle");',
        'resetProbePill("signalPlotProbeSource", "near frame", "Signal plot source probe idle");',
        'resetIdleProbePill("phaseAudioStatsProbe", "Phase audio stats probe idle");',
        'resetIdleProbePill("phaseProbe", "Phase list probe idle");',
    ]:
        require(resetter in render_error, f"manifest error surface missing {resetter}")
    require(
        "clearElement(" not in render_error,
        "manifest error surface clears a user-facing panel",
    )


def require_follow_free_seek_contract() -> None:
    app_source = (PUBLIC / "app.js").read_text(encoding="utf-8")
    start = app_source.index(
        "function seekPrimaryAudioToFrame(frame, source = inspectionSources.waveform)",
    )
    end = app_source.index("function seekWaveformAtClientX(clientX)", start)
    seek_function = app_source[start:end]
    sync_start = app_source.index("function syncWaveformToAudio()")
    sync_end = app_source.index(
        "function seekPrimaryAudioToFrame(frame, source = inspectionSources.waveform)",
        sync_start,
    )
    sync_function = app_source[sync_start:sync_end]
    require(
        "if (state.followAudio) {" in seek_function,
        "waveform seek no longer gates native audio seeking behind follow mode",
    )
    require(
        "audio.currentTime = targetTime;" in seek_function,
        "waveform seek no longer updates native audio in follow mode",
    )
    require(
        "setPlayheadFrame(targetFrame);" in seek_function,
        "waveform seek no longer updates local inspection playhead",
    )
    require(
        "state.lastSeekFollowAudio = state.followAudio;" in seek_function,
        "waveform seek no longer records follow/free mode at seek time",
    )
    require(
        seek_function.index("audio.currentTime = targetTime;") <
        seek_function.index("setPlayheadFrame(targetFrame);"),
        "waveform seek updates local playhead before native audio",
    )
    require(
        "state.scrubberPointerActive" in sync_function,
        "audio sync no longer defers while the waveform scrubber is being dragged",
    )
    for snippet in [
        "function beginScrubberDrag(event)",
        "function endScrubberDrag(event)",
        "state.scrubberPointerActive = true;",
        "state.scrubberPointerActive = false;",
        '.addEventListener("pointerdown", beginScrubberDrag)',
        '.addEventListener("pointerup", endScrubberDrag)',
        '.addEventListener("pointercancel", endScrubberDrag)',
        '.addEventListener("lostpointercapture", endScrubberDrag)',
    ]:
        require(snippet in app_source, f"scrubber drag guard missing {snippet}")


def require_node_graph_mvp_contract() -> None:
    index_source = (PUBLIC / "index.html").read_text(encoding="utf-8")
    app_source = (PUBLIC / "app.js").read_text(encoding="utf-8")
    style_source = (PUBLIC / "styles.css").read_text(encoding="utf-8")
    worklet_source = (PUBLIC / "node-live-audio-worklet.js").read_text(encoding="utf-8")

    for snippet in [
        "Modular View",
        "Script View",
        "Patch settings",
        "Patch Name",
        "Patch Author",
        "Patch Tags",
        "Patch Description",
        "Current Sample Rate",
        "Target Sample Rate",
        "Resulting Oversampling",
        "Output Sample Rate",
        "Visual Output Mode",
        "Visual Output Scale",
        "Visual Output Style",
        "Visual Output Theme",
        "Visual Output Trail",
        "Load Script",
        "Save Script",
        "loadNodeGraphScriptButton",
        "saveNodeGraphScriptButton",
        "nodePatchScriptFileInput",
        "nodePatchNameHeader",
        "nodePatchTagsHeader",
        'data-patch-header-info-field="name"',
        'data-patch-header-info-field="tags"',
        "Live Audio",
        "nodeLiveInputButton",
        "nodeLiveOutputButton",
        "nodeLiveStatus",
        "nodeLiveEngineStatus",
        "nodeLiveMeter",
        "nodeLivePlanStatus",
        "nodeLiveRouteStatus",
        "nodeInteractionHelp",
        "nodeModularViewButton",
        "nodeScriptViewButton",
        "nodeSettingsViewButton",
        "nodeSettingsView",
        "patchNameValue",
        "patchAuthorValue",
        "patchTagsValue",
        "patchDescriptionValue",
        "patchCurrentSampleRateValue",
        "patchTargetSampleRateValue",
        "patchResultingOversamplingValue",
        "patchOutputSampleRateValue",
        "data-patch-audio-field",
        "patchVisualModeValue",
        "patchVisualScaleValue",
        "patchVisualStyleValue",
        "patchVisualThemeValue",
        "patchVisualTrailValue",
        "nodeZoomOutButton",
        "nodeZoomInButton",
        "nodeUndoButton",
        "nodeRedoButton",
        "nodeScriptStatus",
        "nodePatchScript",
        "nodeWaveformCanvas",
        "nodeSignalPlotCanvas",
        "nodeVisualOutputCanvas",
        "nodeVisualOutputMeta",
        "nodeSaveVisualOutputButton",
        "nodeVisualOutputStatus",
        "nodeCopyExecutionJsonButton",
        "nodeExecutionJsonStatus",
        "nodeCopyRuntimeSketchButton",
        "nodeRuntimeSketch",
        "nodeRuntimeSketchStatus",
        "nodeGraphZoomSurface",
        "nodeSelectionMarquee",
        "node-selection-marquee",
        "nodePalette",
        "nodeSceneContextMenu",
        "nodeSceneAddOsc",
        "nodeSceneAddSpiral",
        "nodeSceneAddNoise",
        "nodeSceneAddGain",
        "nodeSceneAddBias",
        "nodeSceneCopyModule",
        "Copy",
        "Ctrl+C",
        "nodeSceneWidthControls",
        "nodeSceneWidthDecrease",
        "nodeSceneWidthValue",
        "nodeSceneWidthIncrease",
        "nodeSceneDeleteModule",
        "Delete",
        "nodeSceneCloseMenu",
        "Close module actions",
        "[ X ]",
        "nodeDeleteButton",
        "toggleDebugButton",
        '<body class="debug-collapsed">',
        'aria-pressed="false">Show Evidence</button>',
        "nodeParameterMetadataPopover",
        "metadataMinValue",
        "metadataMidLabel",
        "metadataMidValue",
        "metadataMaxValue",
        "metadataDefaultValue",
        "metadataStepValue",
        "metadataKindValue",
        "metadataUnitValue",
        "metadataChoicesValue",
        "Choices",
        "metadataDisplayChoicesValue",
        "Display choices",
        "metadataDivideChoicesValue",
        "Divide choices visibly",
        "metadataShowSignValue",
        "Always show +/-",
        "metadataWraparoundValue",
        "Wraparound",
        "metadataLinearSmoothingValue",
        "Linear smoothing",
        "metadataNonlinearSliderValue",
        "Nonlinear slider",
        "metadataPopoverDragHandle",
        "Set Defaults from Kind",
        'data-context-module="spiral"',
        'data-palette-node="spiral"',
    ]:
        require(snippet in index_source, f"node graph shell missing {snippet}")

    for snippet in [
        "nodeClearButton",
        "Clear Wires",
    ]:
        require(snippet not in index_source, f"dangerous clear wires control should be absent: {snippet}")

    for snippet in [
        "Browser Patch Proof",
        "Node Wiring MVP",
    ]:
        require(snippet not in index_source, f"static patch header should be absent: {snippet}")

    settings_order = [
        index_source.index("patchNameValue"),
        index_source.index("patchTagsValue"),
        index_source.index("patchAuthorValue"),
        index_source.index("patchDescriptionValue"),
    ]
    require(settings_order == sorted(settings_order), "settings fields should be ordered name, tags, author, description")

    workspace_index = index_source.index("nodeGraphWorkspace")
    audio_index = index_source.index("audioPlayer")
    controls_index = index_source.index("nodeRenderButton")
    require(
        workspace_index < audio_index < controls_index,
        "primary audio widget should sit below node workspace and above render controls",
    )

    fallback_index = app_source.index("const fallbackNodeMetadataKindTemplates")
    fallback_waveform_index = app_source.index("waveform: {", fallback_index)
    fallback_waveform_end = app_source.index("bypass: {", fallback_waveform_index)
    fallback_waveform_source = app_source[fallback_waveform_index:fallback_waveform_end]
    for snippet in [
        "max: 4",
        "mid: 2",
        "min: 0",
    ]:
        require(snippet in fallback_waveform_source, f"fallback waveform metadata missing {snippet}")

    for snippet in [
        "const nodeGraphDefaultConnections",
        "const nodeGraphAudioBlockSize = 512",
        "const nodeGraphModuleDefinitions",
        "spiral: \"Spiral\"",
        "spiral: {",
        'outputs: ["X", "Y", "Z"]',
        "sharpCurveMult",
        "key: \"waveform\"",
        "nodeOscWaveform",
        "choices: [\"Saw\", \"Square\", \"Triangle\", \"Sine\", \"Noise\"]",
        "const nodeGraphOutputInputPorts",
        'inputs: ["Left", "Right"]',
        'destinationPort: "Left"',
        'destinationPort: "Right"',
        "const nodeGraphDefaultNodeConfigs",
        "params: nodeGraphDefaultParamsForType",
        "const nodeGraphZoomLimits",
        "const fallbackNodeMetadataKindTemplates",
        "let nodeMetadataKindTemplates = Object.freeze(Object.fromEntries(",
        'amplitude: { def: 1, label: "Amplitude"',
        'label: "Decibels"',
        'decimal_bipolar: {',
        'frequency: { def: 1000, label: "Frequency"',
        'phase: {',
        'label: "Phase"',
        'wraparound: true',
        'descrete: { def: 0, label: "Descrete"',
        'integer_bipolar: {',
        'label: "Integer Bipolar"',
        'waveform: {',
        'bypass: {',
        'plusminus: {',
        'onoff: {',
        'momentary: {',
        'unit: "dB"',
        "const nodeMetadataKindAliases",
        "function normalizeNodeMetadataKind(kind)",
        "function applyNodeMetadataKindTemplates(templates)",
        "async function loadNodeMetadataKindTemplates()",
        'fetch("/api/node-metadata-kinds"',
        "function normalizeNodeGraphPatchInfo(info = {})",
        "function normalizeNodeGraphPatchAudio(audio = {})",
        "targetSampleRate: Number.isFinite(targetSampleRate)",
        "function nodeGraphBaseSampleRate()",
        "function nodeGraphTargetSampleRate(patch = nodeGraphMvp.patch)",
        "function nodeGraphOversamplingMultiplier(baseRate, targetRate)",
        "Math.min(4, target / base)",
        "function nodeGraphEffectiveSampleRate(baseRate, multiplier)",
        "function nodeGraphFormatSampleRate(sampleRate)",
        "function nodeGraphFormatOversamplingRatio(ratio)",
        "function nodeGraphAudioDerivation(patch = nodeGraphMvp.patch)",
        "clampedEngineSampleRate",
        "outputSampleRate",
        "oversamplingRatio",
        "function nodeGraphTemporaryPrefilterForResample(samples, sourceRate, outputRate)",
        "function nodeGraphResampleLinear(samples, outputFrames)",
        "function nodeGraphResampleRenderedChannel(samples, sourceRate, outputRate, outputFrames)",
        "function normalizeNodeGraphPatchVisual(visual = {})",
        "function normalizeNodeGraphPatchWindows(windows = {})",
        "function normalizeNodeGraphWindowPosition(position = {})",
        "duplicate connection",
        "duplicate modulation",
        "function syncNodeGraphSettingsView()",
        "function readNodeGraphSettingsView()",
        "function readNodeGraphAudioSettingsView()",
        "function readNodeGraphVisualSettingsView()",
        "audio: normalizeNodeGraphPatchAudio(patch.audio)",
        "visual: normalizeNodeGraphPatchVisual(patch.visual)",
        "windows: normalizeNodeGraphPatchWindows(patch.windows)",
        "nodePatchNameHeader",
        "nodePatchTagsHeader",
        "function handleNodeGraphHeaderInfoInput(event)",
        "dataset?.patchHeaderInfoField",
        'field.addEventListener("input", handleNodeGraphHeaderInfoInput)',
        "function handleNodeGraphSettingsInput()",
        "patch.audio = readNodeGraphAudioSettingsView()",
        'field.addEventListener("input", handleNodeGraphSettingsInput)',
        "function commitNodeGraphSettingsHistory()",
        "settings saved",
        "info: normalizeNodeGraphPatchInfo(patch.info)",
        "function beginNodeGraphWireDrag(event)",
        "function dragNodeGraphWire(event)",
        "function endNodeGraphWireDrag(event)",
        "const connected = nodeGraphConnectWireEndpoints(dragging.endpoint, targetEndpoint);",
        "if (nodeGraphWireEndpointsShouldBurst(dragging.endpoint, targetEndpoint)) {\n      burstNodeGraphZap(nodeGraphClientPoint(event));\n    }",
        "function connectNodeGraphPorts(",
        "function connectNodeGraphModulation(",
        "function disconnectNodeGraphConnection(index, kind = \"signal\")",
        "selection.index > index",
        "setNodeGraphSelection({ ...selection, index: selection.index - 1 })",
        "Render current patch sample",
        "Render blocked: ${validation.issues.join(\", \")}",
        "function createNodeSliderReadout(slider)",
        "function updateNodeSliderCurrentValue(slider, rawValue)",
        "function syncNodeGraphPatchParameterFromSlider(slider, options = {})",
        "if (options.deferUi)",
        "function syncNodeSliderReadout(slider)",
        "function parseNodeMetadataChoices(value)",
        "function formatNodeMetadataChoices(choices)",
        "function nodeSliderShouldDisplayChoices(slider)",
        "function nodeSliderShouldDivideChoicesVisibly(slider)",
        "function nodeSliderShouldUseLinearSmoothing(slider)",
        "function nodeSliderShouldWraparound(slider)",
        "function nodeSliderChoiceLabel(slider)",
        "function nodeSliderChoiceIndexFromText(slider, value)",
        "prefixMatches.length === 1",
        "function nodeSliderShouldShowSign(slider)",
        "function nodeSliderMetadata(slider)",
        "function formatNodeSliderMetadataTooltip(slider)",
        "reserveSignSpace",
        "showPlusMinus",
        "divideChoicesVisibly",
        "function normalizeNodeMetadataKindTemplate(template = {})",
        "Boolean(choices.length)",
        "linearSmoothing",
        "wraparound",
        "function syncNodeSliderMetadataTooltip(slider)",
        "function nodeSliderDebugPath(slider)",
        "function nodeGraphNodeType(node)",
        "function nodeGraphReadNodeNumber(node, key)",
        'input[data-param="${CSS.escape(key)}"]',
        "function nodeGraphDefaultParamsForType(type)",
        "function nodeGraphZoom()",
        "function nodeGraphZoomSurface()",
        "function nodeGraphGraphRect()",
        "function applyNodeGraphZoom()",
        "function setNodeGraphZoom(nextZoom)",
        "function zoomNodeGraphBy(delta)",
        "const nodeGraphGrid",
        "const nodeGraphPatchFormat",
        "soemdsp-sandbox-node-patch",
        "const nodeGraphDefaultPatch",
        "bypassedNodes: []",
        "view: { widthGu: 0, heightGu: 0 }",
        "function cloneNodeGraphPatch(patch)",
        "bypassedNodes: Array.isArray(patch.bypassedNodes) ? [...patch.bypassedNodes] : []",
        "format: { ...(patch.format || nodeGraphPatchFormat) }",
        "function cloneNodeGraphParamMeta(paramMeta = {})",
        "paramMeta: cloneNodeGraphParamMeta(node.paramMeta)",
        "function nodeGraphDefaultParamMetaForType(type)",
        "function createNodeGraphPatchNode(type, options = {})",
        "node.widthGu = normalizeNodeGraphModuleWidthUnits(type, options.widthGu)",
        "patch.nodes.push(createNodeGraphPatchNode(type",
        "function normalizeNodeGraphPatchParameterMetadata(type, key, metadata = {})",
        "function nodeGraphGridSnapOffset()",
        "return 6;",
        "function normalizeNodeGraphPatchView(view = {})",
        "function applyNodeGraphWorkspaceView()",
        "function beginNodeGraphWorkspaceResize(event)",
        "function dragNodeGraphWorkspaceResize(event)",
        "function endNodeGraphWorkspaceResize(event)",
        "function beginNodeGraphWorkspacePan(event)",
        "function dragNodeGraphWorkspacePan(event)",
        "function endNodeGraphWorkspacePan(event)",
        "function preventNodeGraphMiddleMouseAuxClick(event)",
        "function nodeGraphGridToPixel(point)",
        "function nodeGraphPixelToGrid(point)",
        "function snapNodeGraphPointToGrid(point)",
        "function applyNodeGraphPatchToDom()",
        "function serializeNodeGraphPatch(patch = nodeGraphMvp.patch)",
        "audio: normalizeNodeGraphPatchAudio(patch.audio)",
        "bypassedNodes: patch.bypassedNodes || []",
        "format: { ...nodeGraphPatchFormat }",
        "unsupported patch format",
        "view.widthGu must be 0 or at least",
        "view: normalizeNodeGraphPatchView(patch.view)",
        "output module id must be output",
        "output module cannot be bypassed",
        "patchNode.paramMeta?.[parameter.key]",
        "function normalizeNodeGraphPatchParameter(type, key, value, metadata = null)",
        "function nodeGraphReadPatchParameterValue(node, key)",
        "function nodeGraphReadPatchParameterMetadata(node, key)",
        "function nodeGraphPatchChoiceLabel(metadata, value)",
        "function loadNodeGraphPatchFromScript(text)",
        "script JSON parse failed:",
        "script validation failed:",
        "function commitNodeGraphPatch(patch, options = {})",
        "function nodeGraphPatchScriptStatus(message = \"script synced\", ok = true)",
        "message: `${message}; schedule blocked`, ok: false",
        "scriptCommitDelayMs: 250",
        "scriptDirty: false",
        "scriptCommitTimer: 0",
        "function clearNodeGraphScriptCommitTimer()",
        "function scheduleNodeGraphScriptCommit(text)",
        "nodeGraphMvp.scriptDirty = true",
        "setNodeGraphScriptStatus(\"script editing\", true)",
        "function flushNodeGraphScriptCommit()",
        "function nodeGraphScriptReadyForGraphAction(action = \"graph action\")",
        "Fix script before ${action}",
        "function markNodeGraphRenderScriptBlocked()",
        "Play blocked: fix script before render",
        "function markNodeGraphLiveScriptBlocked()",
        "fix script before live audio",
        "function clearNodeGraphRenderScriptBlock()",
        "function clearNodeGraphLiveScriptBlock()",
        "function clearNodeGraphScriptBlockedActions()",
        "clearNodeGraphScriptBlockedActions();",
        "schedule blocked: fix script before live audio",
        "nodeGraphScriptReadyForGraphAction(\"render\")",
        "nodeGraphScriptReadyForGraphAction(\"live audio\")",
        "nodeGraphScriptReadyForGraphAction(\"save\")",
        "nodeGraphScriptReadyForGraphAction(\"undo\")",
        "nodeGraphScriptReadyForGraphAction(\"redo\")",
        "if (mode !== \"script\")",
        "function recordNodeGraphHistory()",
        "Undo patch edit",
        "Undo unavailable",
        "Redo patch edit",
        "Redo unavailable",
        "function undoNodeGraphPatch()",
        "function redoNodeGraphPatch()",
        "function setNodeGraphViewMode(mode)",
        "const settingsMode = mode === \"settings\"",
        "nodeSettingsViewButton",
        "settingsVisible ? \"modular\" : \"settings\"",
        "nodeSettingsView",
        "function handleNodePatchScriptInput(event)",
        "scheduleNodeGraphScriptCommit(event.currentTarget.value)",
        "function nodeGraphPatchFileName()",
        "const tagName = info.tags && info.tags !== \"tags\"",
        "function saveNodeGraphScript()",
        "function loadNodeGraphScript()",
        "function handleNodeGraphScriptFileLoad(event)",
        'field.addEventListener("change", commitNodeGraphSettingsHistory)',
        "serializeNodeGraphPatch()",
        "function syncNodeGraphPatchMetadataFromSlider(slider, options = {})",
        "syncNodeGraphPatchParameterFromSlider(slider)",
        "window.setTimeout(() => URL.revokeObjectURL(url), 0)",
        "loadNodeGraphPatchFromScript(String(reader.result || \"\"))",
        "readAsText(file)",
        "[data-patch-info-field]",
        "[data-patch-audio-field]",
        "modulations: []",
        "patch.modulations || []",
        "nodeGraphMvp.patch.modulations.map",
        "function createNodeParameterModulationPort(node, type, parameter)",
        "function createNodeParameterOutputPort(node, type, parameter)",
        "function createNodeGraphIoColumn(node, type, ports, io)",
        "node-param-port modulation-input",
        "node-param-port parameter-output node-port output",
        "dataset.io = \"modulation\"",
        "dataset.io = \"output\"",
        "button.dataset.alias = nodeGraphLabel(node, port)",
        "button.dataset.alias = `${nodeGraphNodeDisplayName(node)}.${parameter.key} slider`",
        "button.dataset.alias = `${nodeGraphNodeDisplayName(node)}.${parameter.key} mod`",
        "function ensureNodeGraphDragHandle(node)",
        "function attachNodeGraphNodeEvents(node)",
        'for (const port of node.querySelectorAll(".node-param-port.modulation-input"))',
        "function createNodeGraphModuleElement(type, node)",
        "function nodeGraphModuleBodyRowCount(type)",
        "function nodeGraphModuleGridWidthUnits(type)",
        "const nodeGraphModuleWidthLimits",
        "function normalizeNodeGraphModuleWidthUnits(type, widthGu)",
        "function nodeGraphPatchNodeGridWidthUnits(node)",
        "const nodeGraphModuleLayout",
        "bodyRowGapGu: 3 / 28",
        "function nodeGraphModuleSliderBodyHeightGu(type)",
        "function nodeGraphModuleIoRowCount(type)",
        "function nodeGraphModuleIoSectionHeightGu(type)",
        "function nodeGraphModuleRequiredHeightUnits(type)",
        "function nodeGraphModuleGridHeightUnits(type)",
        "Math.max(roughGridUnits, requiredGridUnits)",
        "node-header-actions",
        "node-header-title-row",
        "node-header-title",
        "node-action-button",
        "node-bypass-button",
        "bypassButton.textContent = \"⌽\"",
        "node-execution-order-badge",
        "toggleNodeGraphModuleBypass",
        "adjustNodeGraphModuleWidthFromContext",
        "Module actions",
        "--node-grid-width-units",
        "--node-grid-height-units",
        "function registerExistingNodeGraphNodes()",
        "metadataEditorTarget",
        "metadataDragging",
        "metadataPopoverPosition",
        "moduleActionWindowPosition",
        "function syncNodeGraphPatchWindowPosition(key, position)",
        "function setNodeSliderMetadata(slider, metadata)",
        "function normalizedNodeSliderMid(slider)",
        "function nodeSliderSkewExponent(slider)",
        "function nodeSliderShouldUseNonlinearSlider(slider)",
        "function nodeSliderValueFromTravel(slider, travel)",
        "function nodeSliderTravelFromValue(slider, value)",
        "function wrapNodeSliderValue(value, min, max)",
        "function shortestNodeGraphWrapDelta(from, to, min, max)",
        "function createNodeGraphParameterSmoother(initialValue",
        "function updateNodeGraphParameterSmoother(smoother",
        "function readNodeGraphSmoothedParameter(smoother, frame, frames)",
        "function finishNodeGraphParameterSmoothing(smoothers)",
        "function normalizeNodeSliderValue(slider, value",
        "function openNodeMetadataPopover(event, readout)",
        "function beginNodeMetadataPopoverDrag(event)",
        "function dragNodeMetadataPopover(event)",
        "function endNodeMetadataPopoverDrag(event)",
        "nodeGraphMvp.metadataPopoverPosition = { left, top }",
        "savedPosition?.left ?? event.clientX",
        "savedPosition?.top ?? event.clientY",
        "function populateNodeMetadataKindChoices()",
        "function readNodeMetadataEditorValues(slider)",
        "function syncNodeMetadataMidVisibility()",
        "function applyNodeMetadataEditor()",
        "function closeNodeMetadataPopover()",
        "function closeNodeSceneContextMenu()",
        "function positionNodeSceneContextMenu(menu, x, y, remember = false)",
        "function beginNodeSceneContextMenuDrag(event)",
        "function dragNodeSceneContextMenu(event)",
        "function endNodeSceneContextMenuDrag(event)",
        "function stopNodeGraphRenderedPlayback()",
        "stopNodeGraphRenderedPlayback();",
        "function markNodeGraphRenderPending(summary = \"\")",
        "function nodeGraphOutputClipCountText(count = 0)",
        "function nodeGraphClampOutputSample(value)",
        "function nodeGraphOutputSampleClipped(value)",
        "setNodeGraphAudioStats();",
        "audioStats.dataset.renderClips = String(clipCount)",
        "nodeGraphOutputClipCountText(clipCount)",
        "outputSummary.textContent = summary",
        "drawNodeRenderedAudio();",
        "function setNodeMetadataDefaultsFromKind()",
        "const max = hasChoices ? choices.length - 1 : template.max",
        "const mid = hasChoices ? (min + max) / 2 : template.mid",
        "const def = clampNodeSliderValue(template.def, min, max)",
        "function handleNodeMetadataKindChange()",
        "metadataSetDefaultButton",
        'classList.add("armed")',
        'classList.remove("armed")',
        "function handleNodeMetadataEditorInput()",
        "metadataNonlinearSliderValue",
        "nodeParameterMetadataPopover",
        "metadataPopoverDragHandle",
        "sceneContextPoint",
        "function positionNodeGraphNode(node, point, options = {})",
        "function openNodeSceneContextMenu(event)",
        "function showNodeGraphModule(node, point = null)",
        "function nodeGraphFindCopiedModuleGridPoint(sourceNode, nodes = nodeGraphMvp.patch.nodes)",
        "function nodeGraphPatchNodeGridRect(node)",
        "function nodeGraphBypassedNodeIds(patch = nodeGraphMvp.patch)",
        "function nodeGraphNodeIsBypassed(nodeId, patch = nodeGraphMvp.patch)",
        "function nodeGraphGridRectsOverlap(a, b)",
        "function addNodeGraphModuleFromContext(event)",
        "nodeTypeCounts",
        "slider.dataset.mid",
        "slider.dataset.default",
        "slider.dataset.step",
        'slider.step = "any"',
        "slider.dataset.kind",
        "slider.dataset.unit",
        "slider.dataset.choices",
        "slider.dataset.displayChoices",
        "slider.dataset.divideChoicesVisibly",
        "slider.dataset.linearSmoothing",
        "slider.dataset.nonlinearSlider",
        "slider.dataset.showSign",
        "slider.dataset.wraparound",
        "function beginNodeSliderReadoutEdit(readout)",
        "function commitNodeSliderReadoutEdit(input)",
        'input.type = "text"',
        'input.inputMode = nodeSliderShouldDisplayChoices(slider) ? "text" : "decimal"',
        "const normalizedValue = String(rawValue).trim()",
        "const choiceIndex = nodeSliderChoiceIndexFromText(slider, normalizedValue)",
        "function quantizeNodeSliderDragValue(slider, value)",
        "function setNodeSliderValue(slider, value)",
        "function nodeSliderSegmentValueFromPointer(slider, surface, clientX)",
        "function setNodeChoiceSliderFromPointer(slider, surface, clientX)",
        "function nodeSliderValueFromPointer(slider, surface, clientX)",
        "function nodeSliderFineTuneScale(event)",
        "event.ctrlKey && event.shiftKey",
        "return 0.001",
        "return 0.01",
        "return 0.1",
        "const pointerMode = event.altKey ? \"absolute\" : \"relative\"",
        "pointerMode === \"absolute\"",
        "pointerMode,",
        "fineScale: nodeSliderFineTuneScale(event)",
        "drag.fineScale",
        "Math.floor(progress * choices.length)",
        "syncNodeGraphPatchParameterFromSlider(slider, { deferUi: true })",
        "function populateNodeSliderReadoutShell(readout)",
        "markNodeGraphRenderPending();",
        "function beginNodeSliderDrag(event)",
        "function dragNodeSlider(event)",
        "function endNodeSliderDrag(event)",
        "let startTravel = nodeSliderTravelFromValue(slider, Number(slider.value))",
        "setNodeChoiceSliderFromPointer(slider, surface, event.clientX)",
        "startTravel = nodeSliderTravelFromValue(slider, Number(slider.value))",
        "if (drag.pointerMode === \"absolute\")",
        "nodeSliderValueFromPointer(drag.slider, drag.surface, event.clientX)",
        "const verticalDelta = drag.startY - event.clientY",
        "const travelDelta = ((horizontalDelta + verticalDelta) / drag.width) * drag.fineScale",
        "nodeSliderValueFromTravel(drag.slider, drag.startTravel + travelDelta)",
        'document.addEventListener("mousemove", dragNodeSlider)',
        'document.addEventListener("mouseup", endNodeSliderDrag)',
        'readout.addEventListener("contextmenu"',
        "node-slider-readout",
        "node-slider-readout-value",
        "node-slider-readout-unit",
        "unitText.classList.toggle(\"is-empty\", !unit)",
        "readout.dataset.choiceCount = usesChoices ? String(choices.length) : \"0\"",
        "readout.classList.toggle(\"choices-divided\", dividesChoices)",
        "readout.style.setProperty(\"--value-start\"",
        "readout.style.setProperty(\"--value-end\"",
        "readout.style.setProperty(\"--choice-divider-width\"",
        "function nodeGraphValidate()",
        "function nodeGraphModuleOutputPorts(type)",
        "function nodeGraphParameterOutputPort(type, port)",
        "function compileNodeGraphExecutionPlan(patch = nodeGraphMvp.patch)",
        "function compileValidatedNodeGraphExecutionPlan(patch = nodeGraphMvp.patch)",
        "function nodeGraphBuildDependencyMap(patch = nodeGraphMvp.patch)",
        "bypassedNodes.has(connection.sourceNode) || bypassedNodes.has(connection.destinationNode)",
        "bypassedNodes.has(modulation.sourceNode) || bypassedNodes.has(modulation.destinationNode)",
        "function nodeGraphTopologicalOrder(nodes, dependencies, reachableNodes)",
        "function nodeGraphDependencyPathExists(dependencies, startNode, targetNode)",
        "function nodeGraphNodeOrderIndexes(nodes)",
        "function nodeGraphCompareSchedulingEdges(a, b)",
        "function nodeGraphSchedulingEdge(sourceNode, destinationNode, kind, index, payload, nodeOrder)",
        "function nodeGraphBuildSchedulingDependencies(planGraph, reachableNodes)",
        "const orderDependencies = new Map",
        "const nodeOrder = nodeGraphNodeOrderIndexes(planGraph.nodes)",
        "const schedulingEdges = []",
        "const validSignalWires = new Set",
        "for (const [index, connection] of planGraph.connections.entries())",
        "nodeGraphDependencyPathExists(orderDependencies, edge.sourceNode, edge.destinationNode)",
        "for (const [index, modulation] of planGraph.modulations.entries())",
        "schedulingEdges.sort(nodeGraphCompareSchedulingEdges)",
        "nodeGraphTopologicalOrder(graph.nodes, scheduling.orderDependencies, reachableNodes)",
        "function readNodeGraphRuntimeOutput(runtime, frameValues, nodeId, port = \"Out\")",
        "output[port] ?? output.Out",
        "function readNodeGraphRuntimePortOutput(runtime, frameValues, nodeId, port = \"Out\"",
        "function normalizeNodeGraphParameterOutputValue(value, metadata = {})",
        "function nodeGraphSignalWireIdentity(connection)",
        "function nodeGraphModulationWireIdentity(modulation)",
        "function nodeGraphFeedbackIdentitySets(plan)",
        "function nodeGraphActiveNodeIds(plan)",
        "function nodeGraphPlanBypassedNodeIds(plan)",
        "function nodeGraphWireTouchesBypassed(wire, plan)",
        "function nodeGraphActiveSignalConnections(plan)",
        "function nodeGraphActiveModulations(plan)",
        "function nodeGraphInactiveWireReads(plan)",
        "function nodeGraphExecutionWireReads(plan)",
        "function nodeGraphExecutionWireRows(plan)",
        "function nodeGraphWireModeHelp(mode)",
        "function renderNodeGraphExecutionSummarySelection()",
        "function nodeGraphStateReadCount(plan)",
        "function nodeGraphStateReadText(count)",
        "function nodeGraphActiveNodeText(plan)",
        "function nodeGraphActiveWireCount(plan)",
        "function nodeGraphPatchWireCount(plan)",
        "function nodeGraphActiveWireText(plan)",
        "Execution model: single-pass stored-output",
        "connections: graph.connections",
        "inactiveNodes,",
        "modulations: graph.modulations",
        "reachableNodes: [...reachableNodes]",
        "function nodeGraphExecutionParameterSnapshot(plan)",
        "const nodesById = new Map((plan.nodes || []).map",
        "function nodeGraphLastRenderDebug()",
        "function nodeGraphRuntimeBoundaryDebug(plan)",
        "function nodeGraphSoemdspRuntimeMapping(plan)",
        "nodeGraphSoemdspObjectConcept",
        "Binding syncs parameter/control memory; DSP objects do not know Circuit",
        "Circuit/patch describes nodes, parameters, and raw connections; it does not own concrete DSP objects",
        "Compiler filters authoring state and emits order, active wires, parameter bindings, and state-read edges",
        "Caller owns concrete DSP objects and invokes them in compiled order",
        "soemdspMapping: nodeGraphSoemdspRuntimeMapping(plan)",
        "soemdspMapping(patch = nodeGraphMvp.patch)",
        "function nodeGraphSoemdspRuntimeSketch(plan)",
        "soemdspRuntimeSketch: nodeGraphSoemdspRuntimeSketch(plan)",
        "soemdspRuntimeSketch(patch = nodeGraphMvp.patch)",
        "processCallerOwnedDspObject(node, externalParameterMemory, storedOutputs);",
        "Binding::apply(circuit, externalParameterMemory);",
        "const sketch = document.getElementById(\"nodeRuntimeSketch\")",
        "const jsonStatus = document.getElementById(\"nodeExecutionJsonStatus\")",
        "const sketchStatus = document.getElementById(\"nodeRuntimeSketchStatus\")",
        "sketch.textContent = plan.valid",
        "runtime sketch blocked:",
        "Caller-owned C++ runtime mapping sketch",
        "function fallbackCopyTextToClipboard(text)",
        "async function copyTextToClipboard(text)",
        "async function copyNodeGraphRuntimeSketch()",
        "async function copyNodeGraphExecutionJson()",
        "navigator.clipboard?.writeText",
        "Clipboard API unavailable",
        "clipboard fallback failed",
        "document.execCommand(\"copy\")",
        "range.selectNodeContents(sketch)",
        "selection.addRange(range)",
        "sketchStatus.textContent = \"selected\"",
        "jsonStatus.textContent = \"selected\"",
        'document.getElementById("nodeCopyExecutionJsonButton").addEventListener("click", copyNodeGraphExecutionJson)',
        'document.getElementById("nodeCopyRuntimeSketchButton").addEventListener("click", copyNodeGraphRuntimeSketch)',
        "Mouse: click to copy the full compiled execution JSON.",
        "Mouse: click to copy the caller-owned C++ runtime sketch.",
        "Compiled order: ${element.textContent}",
        "Compiled order ${order}: ${nodeName}",
        "Selection only happens from move handles or marquee.",
        "Mouse: click to select. Drag to move selected module(s).",
        "item.dataset.executionOrder = String(index + 1)",
        "This module runs at this step in the current execution plan.",
        "This module is ignored by the compiled engine.",
        "This module is not reachable from Output.",
        "slider.removeAttribute(\"title\")",
        "readout.removeAttribute(\"title\")",
        "function nodeGraphPatchFingerprint(patch = nodeGraphMvp.patch)",
        "lastRender: nodeGraphLastRenderDebug()",
        "connectionCount: Number(rendered.connectionCount) || 0",
        "clipCount: Number(rendered.clipCount) || 0",
        "feedbackConnectionCount: Number(rendered.feedbackConnectionCount) || 0",
        "feedbackModulationCount: Number(rendered.feedbackModulationCount) || 0",
        "modulationCount: Number(rendered.modulationCount) || 0",
        "nodeCount: Number(rendered.nodeCount) || 0",
        "matchesCurrentPatch: rendered.patchFingerprint === currentPatchFingerprint",
        "patchFingerprint,",
        "renderNodeGraphExecutionPlanDebug();\n    drawNodeRenderedAudio();",
        "renderNodeGraphExecutionPlanDebug();\n  drawNodeRenderedAudio();",
        "function drawNodeRenderedVisualOutput(options = {})",
        "options.canvas || document.getElementById(\"nodeVisualOutputCanvas\")",
        "const includePlaybackCursor = options.includePlaybackCursor !== false",
        "const updateUi = options.updateUi !== false",
        "function renderNodeVisualOutputMeta(entries = {})",
        "drawNodeRenderedVisualOutput();",
        "canvas.dataset.visualSource = \"node graph rendered audio\"",
        "canvas.dataset.visualMode = visualMode",
        "canvas.dataset.visualModeSetting = visualSettings.mode",
        "canvas.dataset.visualPlaybackFrame",
        "canvas.dataset.visualPlaybackProgress",
        "canvas.dataset.visualPlaybackState",
        "canvas.dataset.visualExportIncludesPlaybackCursor",
        "canvas.dataset.visualExportReady",
        "canvas.dataset.visualPatchFingerprint",
        "canvas.dataset.visualScale = String(visualSettings.scale)",
        "canvas.dataset.visualStyle = visualSettings.style",
        "canvas.dataset.visualTheme = visualSettings.theme",
        "canvas.dataset.visualTrail = String(visualSettings.trail)",
        "context.globalAlpha = visualSettings.trail",
        "function startNodeGraphRenderedPlaybackCursor()",
        "function tickNodeGraphRenderedPlaybackCursor()",
        "function resetNodeGraphRenderedPlaybackCursor(redraw = true)",
        "function nodeGraphRenderedPlaybackFrame(maxFrames = 0)",
        "function nodeGraphVisualOutputFileName(fingerprint = nodeGraphMvp.rendered?.patchFingerprint || nodeGraphPatchFingerprint())",
        "const fingerprintSuffix = fingerprint ? `-${fingerprint}` : \"\"",
        "function setNodeVisualOutputExportReady(ready, title = \"\")",
        "function saveNodeGraphVisualOutputPng()",
        "const exportCanvas = document.createElement(\"canvas\")",
        "canvas: exportCanvas",
        "includePlaybackCursor: false",
        "updateUi: false",
        'document.getElementById("nodeSaveVisualOutputButton").addEventListener("click", saveNodeGraphVisualOutputPng)',
        "exportCanvas.toBlob((blob) =>",
        "function nodeGraphVisualThemeColors(theme = \"cyan-violet\")",
        "visualTheme.trace",
        "const visualScale = 0.42 * visualSettings.scale",
        "function drawVisualTrace({ lineWidth, strokeStyle })",
        "visualSettings.style === \"points\"",
        "renderNodeVisualOutputMeta({",
        "function serializeNodeGraphExecutionPlanDebug(plan)",
        "function serializeNodeGraphExecutionPlanApiDebug(plan)",
        "currentPatchFingerprint: nodeGraphPatchFingerprint()",
        "function installNodeGraphDebugApi()",
        "window.soemdspSandboxDebug = Object.freeze",
        "compileExecutionPlan(patch = nodeGraphMvp.patch)",
        "compileValidatedNodeGraphExecutionPlan(patch)",
        "currentPatchFingerprint()",
        "lastRender()",
        "live()",
        "function renderNodeGraphExecutionPlanDebug(plan = compileNodeGraphExecutionPlan())",
        "function renderNodeGraphExecutionOrderBadges(plan)",
        "function renderNodeGraphExecutionPlanSummary(plan)",
        "badge.dataset.executionState = \"active\"",
        "badge.dataset.executionState = \"bypassed\"",
        "setNodeGraphSelection({ type: \"wire\", kind: row.kind, index: row.index })",
        "nodeGraphWireModeHelp(row.mode)",
        "item.dataset.connectionKind = row.kind",
        "item.dataset.wireMode = row.mode",
        "const activeNodeText = nodeGraphActiveNodeText(plan)",
        "const activeWireText = nodeGraphActiveWireText(plan)",
        "].filter(Boolean).join(\" / \")",
        "function evaluateNodeGraphPlanFrame(runtime, sampleRate, frame, frames)",
        "function jerobeamSpiralSample(options)",
        "function spiralRender(inX, inY, inZ, zDepth)",
        "function spiralShape(lophas, phasor, dense, div, morph)",
        "function spiralRotate(inX, inY, inZ, rotX, rotY)",
        "function spiralNextPhasor(state, key, frequency, offset, sampleRate, bipolar = false)",
        "spiralStates",
        "nodeGraphFeedbackText(feedbackConnections = [], feedbackModulations = [])",
        "renderNodeGraphExecutionPlanDebug(plan)",
        "function nodeGraphRenderPendingSummary()",
        "function nodeGraphPlayBlockedTitle()",
        "function setNodeGraphAudioStats(peak = 0, rms = 0, details = {})",
        "audioStats.dataset.renderFrames = String(frames)",
        "audioStats.dataset.renderStateReads = String(stateReadCount)",
        "stateReadCount",
        "Rendered sample:",
        "outputSummary.textContent = summary || nodeGraphRenderPendingSummary()",
        "if (outputSummary) {\n      outputSummary.textContent = validation.scheduleText;\n    }",
        "Play blocked: render a sample first",
        "Play blocked: ${validation.issues.join(\", \")}",
        "Play rendered sample",
        "signalInputs",
        "modulationInputs",
        "feedbackSignals",
        "feedbackModulations",
        "inactiveNodes: plan.inactiveNodes || []",
        "bypassedNodes: plan.bypassedNodes || []",
        "inactiveWireReads: nodeGraphInactiveWireReads(plan)",
        "patchNodeCount: plan.nodes?.length || 0",
        "activeNodeCount: plan.reachableNodes?.length || 0",
        "patchWireCount: nodeGraphPatchWireCount(plan)",
        "activeWireCount: nodeGraphActiveWireCount(plan)",
        "wireReads: nodeGraphExecutionWireReads(plan)",
        "nodeGraphActiveSignalConnections(plan).map",
        "nodeGraphActiveModulations(plan).map",
        'executionModel: "single-pass stored-output"',
        'schedulerPolicy: "same-pass acyclic edges; patch-node-order cycle-closing edges read stored outputs"',
        "samePassDependencies",
        "stateReadCount: nodeGraphStateReadCount(plan)",
        "storedOutputInitialValue: 0",
        "mode: feedbackSets.signal.has",
        '"state-read"',
        '"same-pass"',
        "parameters: nodeGraphExecutionParameterSnapshot(plan)",
        "runtimeBoundary: nodeGraphRuntimeBoundaryDebug(plan)",
        "DSP nodes do not know patch authoring or display fields",
        "partialOrder: plan.valid ? [] : plan.order",
        "schedule:",
        "schedule blocked:",
        "function beginNodeGraphNodeDrag(event)",
        "node.querySelector(\".node-drag-handle\")?.addEventListener(\"pointerdown\", beginNodeGraphNodeDrag)",
        "node.querySelector(\".node-bypass-button\")?.addEventListener(\"click\", toggleNodeGraphModuleBypass)",
        "node.querySelector(\".node-action-button\")?.addEventListener(\"click\", openNodeModuleActionMenu)",
        "handle.setPointerCapture(event.pointerId)",
        "handle.classList.add(\"dragging\")",
        "wasSelectedAtStart",
        "new Set([node.dataset.node])",
        "Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1",
        "if (!moved) {",
        "setNodeGraphSelection(null)",
        "function dragNodeGraphNode(event)",
        "positionNodeGraphNode(dragged.element, {\n      x: dragged.startX + deltaX,\n      y: dragged.startY + deltaY,\n    });",
        "function endNodeGraphNodeDrag(event)",
        "node.style.setProperty(\"--node-x\"",
        "node.style.setProperty(\"--node-y\"",
        "function renderNodeGraphAudio()",
        'document.getElementById("nodeRenderButton").addEventListener("click", renderNodeGraphAudio)',
        "function nodeGraphBuildLivePlan()",
        "const activeSignalConnections = nodeGraphActiveSignalConnections(compiled)",
        "const activeModulations = nodeGraphActiveModulations(compiled)",
        "modulations: activeModulations",
        "feedbackConnections: compiled.feedbackConnections.map",
        "feedbackModulations: compiled.feedbackModulations.map",
        "order: [...compiled.order]",
        "function createNodeGraphLiveRuntime(plan)",
        "const modulationConnections = new Map()",
        "nodeOutputs: new Map",
        "state read",
        "function updateNodeGraphLiveRuntimePlan(runtime, plan)",
        "runtime.modulationConnections = new Map()",
        "runtime.order = [...(plan.order || [])]",
        "function nodeGraphApplyParameterBounds(value, metadata = {})",
        "function readNodeGraphLiveEffectiveParam(",
        "function evaluateNodeGraphPlanFrame(",
        "function renderNodeGraphLiveScriptBlock(event)",
        "function nodeGraphPhaseRadians(value)",
        "function nodeGraphOscillatorWaveformSample(runtime, nodeId, phase, waveform)",
        "function nextNodeGraphNoiseSample(runtime, nodeId)",
        'node?.type === "spiral"',
        "function readNodeGraphLiveSmoothedParam(runtime, node, key, fallback, frame, frames)",
        'readNodeGraphLiveEffectiveParam(',
        "function setNodeGraphLiveMeter(",
        "meter.dataset.liveClips = String(clipCount)",
        "nodeGraphOutputSampleClipped(frameOutput.left)",
        "nodeGraphClampOutputSample(frameOutput.left)",
        "runtime.meterClipCount",
        "function setNodeGraphLiveOutputMuted(muted)",
        "function setNodeGraphLiveEngineStatus(text = \"engine idle\", state = \"\")",
        "function setNodeGraphLiveEngineTitle(text = \"\")",
        "function clearNodeGraphLiveStatusTitle()",
        "function setNodeGraphLiveProcessorError(message = \"AudioWorklet processor error\")",
        "function setNodeGraphLivePlanStatus(text = \"plan idle\", state = \"\")",
        "function setNodeGraphLivePlanTitle(text = \"\")",
        "function setNodeGraphLiveEvidence(kind = \"idle\", details = {})",
        "function nodeGraphLiveDebug()",
        "connectionCount: Number(details.connectionCount ?? planEvidence.connectionCount) || 0",
        "feedbackConnectionCount: Number(details.feedbackConnectionCount ?? planEvidence.feedbackConnectionCount) || 0",
        "feedbackModulationCount: Number(details.feedbackModulationCount ?? planEvidence.feedbackModulationCount) || 0",
        "feedbackModulations: [",
        "feedbackSignals: [",
        "message: String(details.message || \"\")",
        "modulationCount: Number(details.modulationCount ?? planEvidence.modulationCount) || 0",
        "stateReadCount: Number(details.stateReadCount ?? planEvidence.stateReadCount) || 0",
        "function nodeGraphLivePlanEvidenceDetails(plan, details = {})",
        "nodeGraphMvp.live.lastEvidence",
        "connectionCount: plan.connections.length",
        "feedbackConnectionCount: plan.feedbackConnections.length",
        "feedbackModulationCount: plan.feedbackModulations.length",
        "feedbackModulations: plan.feedbackModulations.map",
        "feedbackSignals: plan.feedbackConnections.map",
        "modulationCount: plan.modulations.length",
        "stateReadCount: nodeGraphStateReadCount(plan)",
        "setNodeGraphLiveEvidence(\"plan-sent\"",
        "setNodeGraphLiveEvidence(\"plan-applied\"",
        "setNodeGraphLiveEvidence(\"params-sent\"",
        "setNodeGraphLiveEvidence(\"params-applied\"",
        "setNodeGraphLiveEvidence(\"script-blocked\"",
        "setNodeGraphLiveEvidence(\"processor-error\"",
        "setNodeGraphLiveEvidence(\"stopped\");",
        "setNodeGraphLiveEvidence(\"stopped\")",
        "function nodeGraphLivePlanStatusText(plan, serial = nodeGraphMvp.live.planSerial)",
        "const fingerprintText = plan.patchFingerprint ?",
        "function nodeGraphLiveBlockedStatusText(kind, error)",
        "function setNodeGraphLiveBlockedError(kind, error, options = {})",
        "function nodeGraphLivePlanScheduleTitle(order = [])",
        "worklet order:",
        "function nodeGraphLivePlanSentStatusText(serial = nodeGraphMvp.live.planSerial)",
        "function nodeGraphLiveParameterCount(nodes = [])",
        "function nodeGraphLiveParametersSentStatusText(nodes = [], serial = nodeGraphMvp.live.planSerial)",
        "function nodeGraphLiveParametersAppliedStatusText(message)",
        "function nodeGraphLivePlanAppliedStatusText(message)",
        "feedbackConnectionCount",
        "feedbackModulationCount",
        "message.patchFingerprint ?",
        "function nodeGraphBuildLiveParameterNodes(activeNodeIds = null)",
        "nodeGraphMvp.live.activeNodeIds = new Set(plan.order)",
        "patchFingerprint: nodeGraphPatchFingerprint()",
        "nodeGraphBuildLiveParameterNodes(activeNodeIds)",
        "nodeGraphBuildLiveParameterNodes(nodeGraphMvp.live.activeNodeIds)",
        "function updateNodeGraphLiveRuntimeParameters(runtime, nodes)",
        "`plan${serialText}",
        "return `plan${serialText} sent`",
        "return `params${serialText} sent ${nodes.length} nodes / ${nodeGraphLiveParameterCount(nodes)} params`",
        "parameterCount: nodeGraphLiveParameterCount(nodes)",
        'message.type === "paramsApplied"',
        "function sendNodeGraphLiveParameterUpdate()",
        "function scheduleNodeGraphLiveParameterSync()",
        "error.issues = [...compiled.issues]",
        "setNodeGraphLiveOutputMuted(false)",
        "setNodeGraphLiveOutputMuted(true)",
        "renderNodeGraphLiveControls(true)",
        "setNodeGraphLiveBlockedError(\"plan\", error)",
        "setNodeGraphLiveBlockedError(\"params\", error, { schedule: false })",
        "message.sessionId !== nodeGraphMvp.live.sessionId",
        "message.planSerial !== nodeGraphMvp.live.planSerial",
        "planSerial: nodeGraphMvp.live.planSerial",
        "patchFingerprint,",
        "sessionId: nodeGraphMvp.live.sessionId",
        "engine worklet",
        "engine fallback",
        "engine error",
        "workletNode.onprocessorerror",
        "function setNodeGraphLiveScheduleStatus(",
        "function renderNodeGraphLiveControls(",
        "const statusText = document.getElementById(\"nodeLiveStatus\")?.textContent || \"\"",
        "const outputActive = (running || starting) && statusText !== \"error\"",
        "createScriptProcessor(nodeGraphAudioBlockSize, 0, 2)",
        "function startNodeGraphLiveAudio()",
        "function stopNodeGraphLiveAudio()",
        "if (nodeGraphMvp.live.node || nodeGraphMvp.live.context)",
        "function scheduleNodeGraphLivePlanSync()",
        "function sendNodeGraphLivePlan()",
        "function handleNodeGraphLiveWorkletMessage(event)",
        "function createNodeGraphLiveWorkletNode(context)",
        'context.audioWorklet.addModule("/public/node-live-audio-worklet.js")',
        "new AudioWorkletNode(",
        "function createNodeGraphLiveScriptProcessorNode(context, plan)",
        'document.getElementById("nodeLiveInputButton").addEventListener("click", toggleNodeGraphLiveInput)',
        'document.getElementById("nodeLiveOutputButton").addEventListener("click", toggleNodeGraphLiveOutput)',
        "function nodeGraphStableSeed(text)",
        "function drawNodeRenderedWaveform()",
        "function drawNodeRenderedSignalPlot()",
        "async function playNodeGraphAudio()",
        "function setNodeGraphSelection(selection)",
        "function nodeGraphSelectedNodeIds(selection = nodeGraphMvp.selected)",
        "function setNodeGraphNodeSelection(ids)",
        "function renderNodeGraphMarqueeSelection()",
        "function nodeGraphWireSelectionExists(selection = nodeGraphMvp.selected)",
        "function nodeGraphSelectionCanDelete(selection = nodeGraphMvp.selected)",
        "function nodeGraphDeleteTitle(selection = nodeGraphMvp.selected)",
        "Delete unavailable: Output module is required",
        "Delete selected wire",
        "function pruneNodeGraphSelectionAfterPatch()",
        "function beginNodeGraphMarqueeSelection(event)",
        "function dragNodeGraphMarqueeSelection(event)",
        "function endNodeGraphMarqueeSelection(event)",
        "draggedNodes",
        "function selectNodeGraphWire(event, index, kind = \"signal\")",
        "function drawNodeGraphWirePath(svg, options)",
        "alias = \"\"",
        "mode = \"same-pass\"",
        "hitPath.dataset.alias = alias",
        "hitPath.dataset.interactionMode = mode",
        "path.dataset.alias = alias",
        "path.dataset.interactionMode = mode",
        "const activeNodeIds = nodeGraphActiveNodeIds(plan)",
        "const isInactive = !nodeGraphSignalConnectionIsActive(connection, activeNodeIds)",
        "const isInactive = !nodeGraphModulationIsActive(modulation, activeNodeIds)",
        "isInactive ? \"inactive-wire\" : \"\"",
        "isBypassed ? \" (bypassed)\" : isInactive ? \" (inactive)\" : \"\"",
        "function configureNodeSceneContextMenu(mode)",
        "function openNodeModuleActionMenu(event)",
        "MODULE ACTIONS",
        "copyButton.title = canCopy ? \"Copy module (Ctrl+C)\"",
        "deleteButton.title = canDelete ? \"Delete module (Delete)\"",
        "function copyNodeGraphModule(sourceNode)",
        "function copyNodeGraphModuleFromContext()",
        "function copySelectedNodeGraphModule()",
        "const gridPoint = nodeGraphFindCopiedModuleGridPoint(sourceNode, patch.nodes)",
        "module copied",
        "Copy unavailable: Output module is required",
        "function deleteNodeGraphModuleFromContext()",
        "const targetNode = nodeGraphPatchNode(nodeGraphMvp.sceneContextTargetNode)",
        "function nodeGraphPath(from, to)",
        "function createNodeGraphWireGradient(svg, id, from, to, stopClass = \"node-wire-gradient-stop\")",
        "linearGradient",
        "gradientUnits",
        '["50%", "0.16"]',
        "data-connection-row-index",
        "event.stopPropagation();",
        "function deleteSelectedNodeGraphItem()",
        "function nodeGraphEventTargetIsEditable(target)",
        "target.closest(\"input, textarea, select, [contenteditable='true']\")",
        "if (nodeGraphEventTargetIsEditable(event.target))",
        "(event.ctrlKey || event.metaKey) && event.key.toLowerCase() === \"c\"",
        "function showPaletteNode(node)",
        'addEventListener("contextmenu", openNodeSceneContextMenu)',
        'addEventListener("auxclick", preventNodeGraphMiddleMouseAuxClick)',
        'addEventListener("pointerdown", beginNodeGraphWorkspacePan, true)',
        'addEventListener("pointerdown", beginNodeGraphMarqueeSelection)',
        'addEventListener("pointermove", dragNodeGraphMarqueeSelection)',
        'addEventListener("pointerup", endNodeGraphMarqueeSelection)',
        'addEventListener("pointerdown", beginNodeGraphWorkspaceResize)',
        'addEventListener("pointermove", dragNodeGraphWorkspaceResize)',
        'addEventListener("pointerup", endNodeGraphWorkspaceResize)',
        'addEventListener("pointermove", dragNodeGraphWorkspacePan)',
        'addEventListener("pointerup", endNodeGraphWorkspacePan)',
        'getElementById("nodeSceneDeleteModule")',
        'getElementById("nodeSceneCopyModule")',
        'getElementById("nodeSceneCloseMenu")',
        'event.target.closest(".dsp-node")',
        'event.target.closest(".node-port, .node-param-port, .node-slider-readout")',
        'closest?.(".node-port, .node-param-port.modulation-input")',
        'for (const port of node.querySelectorAll(".node-port"))',
        'for (const port of node.querySelectorAll(".node-param-port.modulation-input"))',
        'endpoint.io === "modulation"\n    ? nodeGraphModulationPortCenter',
        "function nodeGraphWireEndpointFromElement(element)",
        "parameterOutput: element.classList.contains(\"parameter-output\")",
        "function nodeGraphConnectWireEndpoints(a, b)",
        "function nodeGraphWireEndpointsShouldBurst(a, b)",
        "if (a.parameterOutput) {\n      return false;\n    }\n    return connectNodeGraphModulation",
        "if (b.parameterOutput) {\n      return false;\n    }\n    return connectNodeGraphModulation",
        'a.io === "output" && b.io === "output"',
        'a.io === "input" && b.io === "input"',
        'a.io === "output" && a.parameterOutput && b.io === "modulation"',
        'a.io === "modulation" && b.io === "output" && b.parameterOutput',
        "function burstNodeGraphZap(point)",
        "connectNodeGraphPorts(b.node, b.port, a.node, a.port)",
        "particle.textContent = \"⌁\"",
        "--zap-color",
        "--zap-glow",
        "--zap-rotate",
        "--zap-scale",
        '!document.getElementById("nodeSceneContextMenu").hidden',
        'getElementById("nodeSceneCloseMenu")\n    .addEventListener("click", closeNodeSceneContextMenu)',
        'addEventListener("click", () => zoomNodeGraphBy(-nodeGraphZoomLimits.step))',
        'addEventListener("click", () => zoomNodeGraphBy(nodeGraphZoomLimits.step))',
        "[data-context-module]",
        "function nodeInteractionHelpText(target)",
        "function nodeInteractionMouseHint(element)",
        "const alias = element.dataset.alias || \"\"",
        "Alias: ${alias}",
        "const mode = element.dataset.interactionMode || \"same-pass\"",
        "Mode: ${mode}",
        "Mouse: click to select this wire. Delete removes selected wire.",
        "Mouse: drag to a signal input or modulation input.",
        "Mouse: drag to or from this signal input.",
        "Mouse: drop an output here to modulate this parameter.",
        "Mouse: drag adjusts, Alt+click jumps, Ctrl/Shift drag fine tunes, double-click types, right-click edits metadata.",
        "Mouse: click a segment to choose, Alt+click jumps, double-click types, right-click edits metadata.",
        "Mouse: click to select. Drag to move selected module(s).",
        "Mouse: click to open module actions.",
        "Mouse: click to switch view.",
        "function setNodeInteractionHelp(text = \"\")",
        "if (help.textContent === text)",
        "function handleNodeInteractionHelp(event)",
        "function attachNodeInteractionHelpTarget(element)",
        "element.dataset.interactionHelpReady = \"true\"",
        "const showHelp = () => setNodeInteractionHelp(nodeInteractionHelpText(element))",
        ".addEventListener(\"pointerover\", handleNodeInteractionHelp)",
        ".addEventListener(\"pointermove\", handleNodeInteractionHelp)",
        ".addEventListener(\"pointerover\", showHelp)",
        ".addEventListener(\"mouseover\", handleNodeInteractionHelp)",
        ".addEventListener(\"mousemove\", handleNodeInteractionHelp)",
        ".addEventListener(\"mouseover\", showHelp)",
        ".addEventListener(\"pointerdown\", handleNodeInteractionHelp)",
        ".addEventListener(\"pointerdown\", showHelp)",
        ".addEventListener(\"click\", showHelp)",
        ".addEventListener(\"click\", handleNodeInteractionHelp)",
        ".addEventListener(\"focusin\", handleNodeInteractionHelp)",
        "data-ready",
        "attachNodeInteractionHelpTarget(element)",
        "function toggleDebugSections()",
        "document.addEventListener(\"keydown\", handleNodeGraphKeydown)",
        "missing Output speaker input",
        "const mixInput = (nodeId, port = \"In\")",
        "readNodeGraphRuntimePortOutput(",
        "modulation.sourcePort",
        "\"waveform\"",
        "nodeGraphOscillatorWaveformSample(",
        "sourceNodes",
        "stateReadCount,",
        "connectionCount: plan.connections.length",
        "feedbackConnectionCount: plan.feedbackConnections.length",
        "feedbackModulationCount: plan.feedbackModulations.length",
        "modulationCount: plan.modulations.length",
        "nodeCount: plan.nodes.length",
        "leftSamples",
        "rightSamples",
        "durationSeconds: outputFrames / outputSampleRate",
        "engineSampleRate",
        "sampleRate: outputSampleRate",
        "channels: 2",
        "const frameOutput = evaluateNodeGraphPlanFrame(",
        'node?.type === "gain"',
        'value = mixInput(nodeId) * readNodeGraphLiveEffectiveParam(',
        'node?.type === "bias"',
        'value = mixInput(nodeId) + readNodeGraphLiveEffectiveParam(',
        "disconnect-wire-button",
        "new AudioContext({ sampleRate: renderedSampleRate })",
        "initNodeGraphMvp();",
    ]:
        require(snippet in app_source, f"node graph source missing {snippet}")

    require(
        "Math.max(68" not in app_source,
        "node graph wire path should not enforce the old 68px minimum span",
    )

    require(
        "feedback cycle unsupported at" not in app_source,
        "node graph scheduler should allow feedback cycles as state reads",
    )

    require(
        "if (!menu.hidden && !menu.contains(event.target))" not in app_source,
        "node scene context menu should close by explicit Close button, not outside click",
    )

    require(
        "route: plan.order" not in app_source,
        "node graph validation should expose schedule order, not stale route aliases",
    )

    for snippet in [
        "zoomNodeGraphAt",
        'addEventListener("wheel"',
        "nodeHoverTooltip",
        "node-hover-tooltip",
        "nodeHoverTooltipText",
        "nodeHoverTooltipMouseHint",
        "handleNodeHoverTooltip",
        "attachNodeHoverTooltipTarget",
        'addEventListener("mouseout"',
    ]:
        require(snippet not in app_source, f"node graph obsolete interaction code should be absent: {snippet}")

    require(
        'node.addEventListener("pointerdown", beginNodeGraphNodeDrag)' not in app_source,
        "module body should not start node drag",
    )

    for snippet in [
        'item.addEventListener("click", () => setNodeGraphSelection({ type: "node", id: nodeId }))',
        'setNodeGraphSelection({ type: "node", id })',
    ]:
        require(snippet not in app_source, f"module selection should be limited to move handles or marquee, not {snippet}")

    require(
        ".node-slider-readout:hover" not in style_source,
        "parameter readout border should not change on hover",
    )

    for snippet in [
        'if (event.key === "Escape" && nodeGraphMvp.metadataEditorTarget)',
        "closeNodeMetadataPopover();\n  nodeGraphMvp.sceneContextPoint",
        "!popover.contains(event.target)",
    ]:
        require(snippet not in app_source, f"metadata popover should not close implicitly via {snippet}")

    for snippet in [
        ".node-graph-workspace",
        "--node-graph-zoom: 1",
        "--node-graph-pan-x: 0px",
        "--node-graph-pan-y: 0px",
        "--node-header-height: calc(var(--node-grid-size) * 2.7142857)",
        "--node-body-row-height: calc(var(--node-grid-size) * 1.0714286)",
        "--node-param-port-width: 57%",
        "aspect-ratio: 1 / 1",
        ".node-graph-workspace.panning",
        "cursor: grabbing",
        ".node-graph-zoom-surface",
        "left: var(--node-graph-pan-x)",
        "top: var(--node-graph-pan-y)",
        "cursor: grab",
        ".node-interaction-help",
        ".node-interaction-help:empty",
        "justify-content: center",
        "min-height: 72px",
        "height: 72px",
        "white-space: pre-line",
        "--node-module-grid-inset: calc(var(--node-grid-size) * 0.2142857)",
        "--node-grid-width-units",
        "--node-grid-height-units",
        ".node-settings-view",
        ".node-settings-actions",
        ".node-settings-grid",
        "grid-template-columns: minmax(0, 1fr)",
        ".node-settings-sample-rate-row",
        "grid-template-columns: repeat(4, minmax(0, 1fr))",
        "transform: scale(var(--node-graph-zoom));",
        ".node-graph-workspace.resizing",
        ".node-graph-resize-handle",
        "cursor: nwse-resize",
        ".node-wiring-panel .audio-panel",
        ".node-patch-header-fields",
        ".node-patch-header-field",
        ".node-patch-header-field.name",
        ".node-patch-header-field.tags",
        ".node-wire-svg",
        ".node-wire-path",
        ".node-wire-gradient-stop",
        ".node-modulation-wire-gradient-stop",
        ".node-modulation-wire-path",
        ".node-wire-path.state-read",
        ".node-wire-path.inactive-wire",
        ".node-wire-path.inactive-wire.selected",
        ".node-wire-path.selected",
        ".node-wire-hit-path",
        ".node-wire-path.temp",
        ".node-selection-marquee",
        ".dsp-node",
        ".dsp-node-header",
        "box-sizing: border-box;",
        "min-width: 0;",
        "grid-template-rows: minmax(0, 1fr) var(--node-header-title-row-height)",
        "border-radius: 5px",
        "grid-template-rows: var(--node-header-height) auto minmax(0, 1fr)",
        ".dsp-node-body",
        "grid-auto-rows: minmax(var(--node-body-row-height), 1fr)",
        "gap: var(--node-body-row-gap)",
        ".dsp-node-io-section",
        ".node-io-column",
        ".node-io-column.input",
        ".node-io-column.output",
        ".node-io-row.input",
        ".node-io-row.output",
        ".node-io-label",
        ".node-header-actions",
        "align-self: stretch",
        "align-items: stretch",
        "grid-auto-columns: minmax(0, 1fr)",
        "grid-auto-flow: column",
        "width: calc(100% + (var(--node-header-button-overflow) * 2))",
        "height: 100%",
        "calc(var(--node-header-padding-block-start) * -1)",
        "overflow: hidden",
        ".node-header-title-row",
        "justify-content: center",
        ".node-header-title",
        "text-align: center",
        "text-transform: none",
        ".node-parameter-row",
        "grid-template-columns: var(--node-port-column-width) minmax(0, 1fr) var(--node-port-column-width)",
        "grid-template-rows: minmax(0, 1fr)",
        "padding: var(--node-slider-row-padding-block) 0",
        ".node-slider-readout-label",
        "font-family: \"Cascadia Mono\", \"Cascadia Code\", Consolas, \"Courier New\", monospace",
        ".node-parameter-control",
        ".dsp-node.dragging",
        ".dsp-node.selected",
        ".dsp-node.bypassed",
        ".dsp-node.removed",
        ".node-drag-handle",
        ".node-drag-handle:hover",
        ".node-drag-handle.dragging",
        ".node-action-button",
        ".node-action-button:hover",
        ".node-bypass-button",
        ".node-bypass-button:hover",
        "border-color: transparent",
        ".node-bypass-button[aria-pressed=\"true\"]",
        ".node-bypass-button[aria-pressed=\"true\"]:hover",
        "rgba(122, 28, 28, 0.72)",
        ".node-execution-order-badge",
        "width: 100%",
        "height: 100%",
        "min-height: 0",
        ".node-execution-order-badge[data-execution-state=\"bypassed\"]",
        ".node-execution-order-badge[data-execution-state=\"inactive\"]",
        ".node-runtime-sketch-heading",
        ".node-runtime-sketch",
        "max-height: 260px",
        "pointer-events: auto;",
        ".node-port.output",
        ".node-port.input",
        ".node-param-port",
        "grid-column: 1",
        "grid-row: 1",
        "align-self: center",
        "width: var(--node-param-port-width)",
        "height: var(--node-param-port-height)",
        ".node-param-port.modulation-input",
        ".node-param-port.parameter-output",
        "grid-column: 3",
        ".node-zap-particle",
        "@keyframes node-zap-burst",
        "border-left-width: 0",
        "rgba(177, 132, 255",
        ".node-palette",
        ".node-live-controls",
        ".node-visual-output",
        ".node-visual-output-heading",
        ".node-visual-output-meta",
        ".node-execution-plan-summary",
        ".node-execution-policy",
        ".node-execution-order",
        ".node-execution-wire-modes",
        ".node-execution-order li.selected",
        ".node-execution-wire-modes li.selected",
        ".node-execution-wire-modes li.state-read",
        ".node-execution-wire-modes li.bypassed",
        ".node-execution-plan-debug",
        "body.debug-collapsed",
        ".node-slider-readout",
        ".node-slider-readout.choices-divided",
        "height: 100%",
        "padding: var(--node-slider-padding-block) var(--node-slider-padding-inline)",
        "var(--value-start",
        "var(--value-end",
        "var(--choice-divider-width",
        "grid-template-columns: minmax(0, 1fr) auto",
        "grid-template-rows: minmax(0, 1fr) minmax(0, 1fr)",
        "row-gap: 0",
        "cursor: all-scroll;",
        ".node-slider-readout.value-dragging",
        ".node-slider-readout-label",
        ".node-slider-readout-value",
        "white-space: pre;",
        ".node-slider-readout-unit",
        ".node-slider-readout-unit.is-empty",
        ".node-slider-readout-input",
        ".node-parameter-metadata-popover",
        ".metadata-popover-title-group",
        ".metadata-popover-drag-handle",
        ".metadata-popover-drag-handle.dragging",
        ".metadata-choices-label",
        ".metadata-checkbox-label",
        ".metadata-popover-grid",
        ".metadata-popover-grid button.armed",
        ".node-scene-context-menu",
        ".node-scene-context-menu[hidden]",
        ".scene-context-heading",
        ".scene-context-drag-handle",
        ".scene-context-drag-handle.dragging",
        ".scene-context-title",
        "min-height: 2.1em",
        ".scene-context-add-group",
        ".scene-context-add-group[hidden]",
        ".scene-context-width-controls",
        ".scene-context-width-controls[hidden]",
        ".panel-close-button",
        ".scene-context-danger",
        ".node-scene-context-menu button kbd",
        "display: none;",
        ".disconnect-wire-button",
        ".node-connection-list li.selected",
        ".node-connection-list li.state-read",
        ".node-connection-list li.inactive-wire",
        ".node-connection-list li.inactive-wire.selected",
        ".node-graph-output",
        ".node-waveform",
        ".node-signal-plot",
    ]:
        require(snippet in style_source, f"node graph style missing {snippet}")

    for snippet in [
        "class NodeLiveAudioProcessor extends AudioWorkletProcessor",
        'registerProcessor("node-live-audio-processor", NodeLiveAudioProcessor)',
        'message.type === "setPlan"',
        'message.type === "setParams"',
        'message.type === "stop"',
        "setParams(nodes, message = {})",
        "const patchFingerprint = message.patchFingerprint || plan?.patchFingerprint || \"\"",
        "const patchFingerprint = message.patchFingerprint || \"\"",
        "this.planSerial = message.planSerial || 0",
        "this.sessionId = message.sessionId || 0",
        "let parameterCount = 0",
        "parameterCount += Object.keys(current.params || {}).length",
        "planSerial: this.planSerial",
        "sessionId: this.sessionId",
        "stateReadCount:",
        "feedbackModulations: (Array.isArray(plan?.feedbackModulations)",
        "feedbackSignals: (Array.isArray(plan?.feedbackConnections)",
        "parameterCount,",
        "patchFingerprint,",
        'type: "planApplied"',
        'type: "paramsApplied"',
        'type: "meter"',
        "this.meterClipCount = 0",
        "outputSampleClipped(value)",
        "clipCount: this.meterClipCount",
        "buildModulationConnectionMap(modulations, ids)",
        "this.nodeOutputs = new Map()",
        "this.spiralStates = new Map()",
        "readRuntimeOutput(frameValues, nodeId, port = \"Out\")",
        "output[port] ?? output.Out",
        "readRuntimePortOutput(frameValues, nodeId, port = \"Out\"",
        "normalizeParameterOutputValue(value, metadata = {})",
        "jerobeamSpiralSample(options)",
        "spiralRender(inX, inY, inZ, zDepth)",
        "spiralShape(lophas, phasor, dense, div, morph)",
        "spiralRotate(inX, inY, inZ, rotX, rotY)",
        "spiralNextPhasor(state, key, frequency, offset, sampleRate, bipolar = false)",
        'node?.type === "spiral"',
        "readEffectiveParameter(node, key, fallback, frame, frames, frameValues)",
        "evaluateFrame(frame, frames)",
        'mixInput(this.outputNode || "output", "Left")',
        "modulation.sourcePort",
        "this.clampValue(frameOutput.left, -0.95, 0.95)",
        "for (const channel of output)",
    ]:
        require(snippet in worklet_source, f"live audio worklet source missing {snippet}")


def require_readme_scheduler_contract() -> None:
    readme_source = (ROOT / "README.md").read_text(encoding="utf-8")
    readme_text = " ".join(readme_source.split())
    for snippet in [
        "single-pass stored-output",
        "acyclic edges are evaluated as same-pass dependencies",
        "patch-node-order cycle-closing signal or modulation edges are allowed as state reads",
        "each node starts with stored output `0`",
        "disconnected modules remain in the editable patch but are omitted from the audio runtime plan",
        "patch scripts preserve each node's current parameter values and parameter metadata",
        "rendered samples store the patch fingerprint that produced them",
        "Render Sample and Live Audio evidence include active graph counts",
        "Live Audio evidence also lists the state-read feedback wire identities",
        "Live Audio error evidence includes the blocking message",
        "Live Audio plan and parameter acknowledgements show the current patch fingerprint",
        "the execution debug panel also reports a `soemdspMapping` block",
        "the debug surface includes a pseudo-C++ `soemdspRuntimeSketch`",
        "the Runtime Sketch panel renders that pseudo-C++ block separately from the full JSON debug dump",
        "the Runtime Sketch panel can copy the pseudo-C++ sketch to the clipboard",
        "execution badges expose fixed help text for compiled order",
        "the Execution JSON panel can copy or select the full debug dump",
        "rendered visual output can be saved from the browser as a clean PNG without the playback cursor overlay",
        "the filename includes the rendered patch fingerprint",
        "`window.soemdspSandboxDebug` exposes `compileExecutionPlan()`, `currentPatchFingerprint()`, `lastRender()`, `live()`, and `soemdspMapping()` / `soemdspRuntimeSketch()`",
        "Feedback routing is intentionally simple stateful patch behavior",
    ]:
        require(snippet in readme_text, f"README scheduler contract missing {snippet}")
    for snippet in [
        "Feedback routing remains blocked",
        "acyclic browser patches",
    ]:
        require(snippet not in readme_text, f"README scheduler contract still has stale text: {snippet}")


def fetch_valid_manifest_payload(base_url: str) -> dict[str, object]:
    manifest_response = request(f"{base_url}/api/manifest")
    require(manifest_response.status == 200, "manifest endpoint did not return 200")
    require_json_response_metadata(manifest_response, "manifest endpoint")
    payload = json.loads(manifest_response.body.decode("utf-8"))
    require(isinstance(payload, dict), "manifest response payload was not object")
    require(payload.get("ok") is True, "manifest payload was not ok")
    manifest_path = payload.get("manifestPath")
    artifact_root = payload.get("artifactRoot")
    require(isinstance(manifest_path, str) and manifest_path, "manifest path missing")
    require(isinstance(artifact_root, str) and artifact_root, "artifact root missing")
    manifest_file = Path(manifest_path).resolve()
    require(manifest_file.is_file(), "manifest path does not point to a file")
    require(Path(artifact_root).resolve() == manifest_file.parent, "artifact root mismatch")
    require_manifest_file_info(payload, manifest_file, "manifest endpoint")
    return payload


def require_node_metadata_kinds_transport(base_url: str) -> None:
    response = request(f"{base_url}/api/node-metadata-kinds")
    require(response.status == 200, "node metadata kinds endpoint did not return 200")
    require_json_response_metadata(response, "node metadata kinds endpoint")
    payload = json.loads(response.body.decode("utf-8"))
    require(isinstance(payload, dict), "node metadata kinds payload was not object")
    require(payload.get("ok") is True, "node metadata kinds payload was not ok")
    templates = payload.get("templates")
    require(isinstance(templates, dict), "node metadata kind templates missing")
    meta_kinds = read_soemdsp_meta_kinds()
    require(meta_kinds == EXPECTED_META_KINDS, "soemdsp meta kind fixture drifted")
    template_kinds = set(templates)
    missing = meta_kinds - template_kinds
    require(not missing, f"node metadata kind templates missing meta.hpp kinds: {sorted(missing)}")
    amplitude = templates.get("amplitude")
    decibels = templates.get("decibels")
    decimal_bipolar = templates.get("decimal_bipolar")
    frequency = templates.get("frequency")
    phase = templates.get("phase")
    descrete = templates.get("descrete")
    integer_bipolar = templates.get("integer_bipolar")
    waveform = templates.get("waveform")
    bypass = templates.get("bypass")
    plusminus = templates.get("plusminus")
    onoff = templates.get("onoff")
    momentary = templates.get("momentary")
    require(isinstance(amplitude, dict), "amplitude metadata kind missing")
    require(isinstance(decibels, dict), "decibels metadata kind missing")
    require(isinstance(decimal_bipolar, dict), "decimal_bipolar metadata kind missing")
    require(isinstance(frequency, dict), "frequency metadata kind missing")
    require(isinstance(phase, dict), "phase metadata kind missing")
    require(isinstance(descrete, dict), "descrete metadata kind missing")
    require(isinstance(integer_bipolar, dict), "integer_bipolar metadata kind missing")
    require(isinstance(waveform, dict), "waveform metadata kind missing")
    require(isinstance(bypass, dict), "bypass metadata kind missing")
    require(isinstance(plusminus, dict), "plusminus metadata kind missing")
    require(isinstance(onoff, dict), "onoff metadata kind missing")
    require(isinstance(momentary, dict), "momentary metadata kind missing")
    require(amplitude.get("label") == "Amplitude", "amplitude metadata label mismatch")
    require(amplitude.get("unit") == "amp", "amplitude metadata unit mismatch")
    require(amplitude.get("linearSmoothing") is True, "amplitude linearSmoothing mismatch")
    require(decibels.get("label") == "Decibels", "decibels metadata label mismatch")
    require(decibels.get("unit") == "dB", "decibels metadata unit mismatch")
    require(decimal_bipolar.get("unit") == "", "decimal_bipolar metadata unit mismatch")
    require(decimal_bipolar.get("showPlusMinus") is True, "decimal_bipolar showPlusMinus mismatch")
    require("showPlusMinus" not in decibels, "decibels should not default showPlusMinus")
    require(frequency.get("unit") == "Hz", "frequency metadata unit mismatch")
    require(frequency.get("linearSmoothing") is True, "frequency linearSmoothing mismatch")
    require(phase.get("unit") == "cycle", "phase metadata unit mismatch")
    require(phase.get("wraparound") is True, "phase wraparound mismatch")
    require(phase.get("linearSmoothing") is True, "phase linearSmoothing mismatch")
    require("showPlusMinus" not in templates.get("pitch", {}), "pitch should not default showPlusMinus")
    require(descrete.get("unit") == "idx", "descrete metadata unit mismatch")
    require(descrete.get("linearSmoothing") is False, "descrete linearSmoothing mismatch")
    require(integer_bipolar.get("label") == "Integer Bipolar", "integer_bipolar metadata label mismatch")
    require(integer_bipolar.get("unit") == "idx", "integer_bipolar metadata unit mismatch")
    require(integer_bipolar.get("min") == -9, "integer_bipolar metadata min mismatch")
    require(integer_bipolar.get("max") == 9, "integer_bipolar metadata max mismatch")
    require(integer_bipolar.get("showPlusMinus") is True, "integer_bipolar showPlusMinus mismatch")
    require(integer_bipolar.get("linearSmoothing") is False, "integer_bipolar linearSmoothing mismatch")
    require(
        waveform.get("choices") == ["Saw", "Square", "Triangle", "Sine", "Noise"],
        "waveform choices mismatch",
    )
    require(waveform.get("displayChoices") is True, "waveform displayChoices mismatch")
    require(waveform.get("divideChoicesVisibly") is True, "waveform divideChoicesVisibly mismatch")
    require(waveform.get("linearSmoothing") is False, "waveform linearSmoothing mismatch")
    require(waveform.get("min") == 0, "waveform metadata min mismatch")
    require(waveform.get("max") == 4, "waveform metadata max mismatch")
    require(waveform.get("mid") == 2, "waveform metadata mid mismatch")
    require(bypass.get("choices") == ["active", "BYPASSED"], "bypass choices mismatch")
    require(bypass.get("displayChoices") is True, "bypass displayChoices mismatch")
    require(bypass.get("divideChoicesVisibly") is True, "bypass divideChoicesVisibly mismatch")
    require(bypass.get("linearSmoothing") is False, "bypass linearSmoothing mismatch")
    require(plusminus.get("choices") == ["-", "+"], "plusminus choices mismatch")
    require(plusminus.get("displayChoices") is True, "plusminus displayChoices mismatch")
    require(plusminus.get("divideChoicesVisibly") is True, "plusminus divideChoicesVisibly mismatch")
    require(plusminus.get("showPlusMinus") is True, "plusminus showPlusMinus mismatch")
    require(onoff.get("choices") == ["off", "on"], "onoff choices mismatch")
    require(onoff.get("displayChoices") is True, "onoff displayChoices mismatch")
    require(onoff.get("divideChoicesVisibly") is True, "onoff divideChoicesVisibly mismatch")
    require(momentary.get("choices") == ["idle", "on"], "momentary choices mismatch")
    require(momentary.get("displayChoices") is True, "momentary displayChoices mismatch")
    require(momentary.get("divideChoicesVisibly") is True, "momentary divideChoicesVisibly mismatch")


def require_manifest_contracts(payload: dict[str, object]) -> None:
    require_producer_proof(payload)
    require_handoff_contract(payload)
    require_artifact_contract(payload)
    require_phase_contract(payload)
    require_parameter_resync_contract(payload)
    require_caller_processing_order_contract(payload)


def require_artifact_report_and_audio_contracts(
  base_url: str,
  payload: dict[str, object],
) -> None:
    require_artifact_reachability(base_url, payload)
    require_report_documents(base_url, payload)
    require_parameter_summary(base_url, payload)
    require_primary_audio_wav(base_url, payload)

    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")
    handoff = manifest.get("sandboxHandoff", {})
    require(isinstance(handoff, dict), "sandbox handoff missing")
    audio_path = handoff.get("primaryAudioArtifact")
    require(audio_path, "primary audio artifact missing from handoff")
    audio_response = request(
        f"{base_url}/artifact?path={urllib.parse.quote(str(audio_path))}",
        method="HEAD",
    )
    require(audio_response.status == 200, "primary audio artifact did not return 200")
    require_no_store(audio_response, "primary audio artifact")


def require_server_error_contracts(base_url: str) -> None:
    missing_path = request(f"{base_url}/artifact", method="HEAD")
    require(missing_path.status == 400, "missing artifact path did not return 400")
    require_no_store(missing_path, "missing artifact path")

    missing_route = request(f"{base_url}/missing", method="HEAD")
    require(missing_route.status == 404, "missing route did not return 404")
    require_no_store(missing_route, "missing route")

    missing_public = request(f"{base_url}/public/missing.js", method="HEAD")
    require(missing_public.status == 404, "missing public file did not return 404")
    require_no_store(missing_public, "missing public file")

    missing_artifact = request(
        f"{base_url}/artifact?path=missing.wav",
        method="HEAD",
    )
    require(missing_artifact.status == 404, "missing artifact did not return 404")
    require_no_store(missing_artifact, "missing artifact")

    forbidden_artifact = request(
        f"{base_url}/artifact?path=../server.py",
        method="HEAD",
    )
    require(forbidden_artifact.status == 403, "artifact traversal did not return 403")
    require_no_store(forbidden_artifact, "artifact traversal")

    forbidden_encoded_artifact = request(
        f"{base_url}/artifact?path=%2e%2e/server.py",
        method="HEAD",
    )
    require(
        forbidden_encoded_artifact.status == 403,
        "encoded artifact traversal did not return 403",
    )
    require_no_store(forbidden_encoded_artifact, "encoded artifact traversal")

    forbidden_public = request(
        f"{base_url}/public/%2e%2e/server.py",
        method="HEAD",
    )
    require(forbidden_public.status == 403, "public traversal did not return 403")
    require_no_store(forbidden_public, "public traversal")

    manifest_head = request(f"{base_url}/api/manifest", method="HEAD")
    require(manifest_head.status == 405, "manifest HEAD did not return 405")
    require_no_store(manifest_head, "manifest HEAD")

    metadata_head = request(f"{base_url}/api/node-metadata-kinds", method="HEAD")
    require(metadata_head.status == 405, "node metadata kinds HEAD did not return 405")
    require_no_store(metadata_head, "node metadata kinds HEAD")

    require_read_only_method_rejections(base_url)


def wait_for_server(base_url: str, process: subprocess.Popen[bytes]) -> None:
    deadline = time.monotonic() + 5
    last_status = ""
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(
                f"sandbox server exited before becoming ready: {process.returncode}",
            )
        response = request(f"{base_url}/public/index.html", method="HEAD")
        last_status = f"{response.status} {response.reason}"
        if response.status == 200:
            if process.poll() is not None:
                raise RuntimeError(
                    f"sandbox server exited during readiness check: {process.returncode}",
                )
            require_no_store(response, "public index")
            return
        time.sleep(0.1)
    raise RuntimeError(f"sandbox server did not become ready: {last_status}")


def start_server(port: int, manifest: Path) -> subprocess.Popen[bytes]:
    require_port_available(port)
    process = subprocess.Popen(
        [
            sys.executable,
            str(ROOT / "server.py"),
            "--port",
            str(port),
            "--manifest",
            str(manifest),
        ],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(0.05)
    if process.poll() is not None:
        raise RuntimeError(f"sandbox server exited immediately: {process.returncode}")
    return process


def stop_server(process: subprocess.Popen[bytes]) -> None:
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def run_valid_manifest_smoke(port: int, manifest: Path) -> None:
    base_url = f"http://127.0.0.1:{port}"
    process = start_server(port, manifest)

    try:
        wait_for_server(base_url, process)

        run_step("root shell contract", lambda: require_root_shell(base_url))
        run_step("static assets", lambda: require_static_assets(base_url))
        run_step("waveform seek source contract", require_waveform_seek_source_contract)
        run_step("manifest error surface contract", require_manifest_error_surface_contract)
        run_step("follow/free seek contract", require_follow_free_seek_contract)
        run_step("node graph MVP contract", require_node_graph_mvp_contract)
        run_step("README scheduler contract", require_readme_scheduler_contract)
        run_step("soemdsp WireMeta traits", require_soemdsp_wire_meta_traits)
        run_step(
            "node metadata kinds transport",
            lambda: require_node_metadata_kinds_transport(base_url),
        )

        payload: dict[str, object] = {}

        def fetch_payload() -> None:
            nonlocal payload
            payload = fetch_valid_manifest_payload(base_url)

        run_step("manifest transport", fetch_payload)
        run_step("manifest contracts", lambda: require_manifest_contracts(payload))
        run_step(
            "artifact contract negative cases",
            require_artifact_contract_negative_cases,
        )
        run_step(
            "phase audio contract negative cases",
            require_phase_audio_contract_negative_cases,
        )
        run_step(
            "parameter resync contract negative cases",
            require_parameter_resync_contract_negative_cases,
        )
        run_step(
            "caller processing order negative cases",
            require_caller_processing_order_contract_negative_cases,
        )
        run_step(
            "artifact reports and audio",
            lambda: require_artifact_report_and_audio_contracts(base_url, payload),
        )
        run_step("server error responses", lambda: require_server_error_contracts(base_url))
    finally:
        stop_server(process)


def run_manifest_error_smoke(port: int) -> None:
    with tempfile.TemporaryDirectory() as directory:
        fixture_root = Path(directory)
        missing_manifest = fixture_root / "missing_manifest.json"
        invalid_manifest = fixture_root / "invalid_manifest.json"
        invalid_manifest.write_text('{ "ok": true, ', encoding="utf-8")

        cases = [
            (missing_manifest, 404, "manifest not found", ""),
            (
                invalid_manifest,
                500,
                "manifest JSON parse failed",
                "Expecting property name",
            ),
        ]

        for index, (path, status, error, detail) in enumerate(cases):
            case_port = find_free_port() if port == 0 else port + index
            base_url = f"http://127.0.0.1:{case_port}"
            process = start_server(case_port, path)
            try:
                wait_for_server(base_url, process)
                response = request(f"{base_url}/api/manifest")
                require(response.status == status, f"{error} status mismatch")
                require_json_response_metadata(response, error)
                payload = json.loads(response.body.decode("utf-8"))
                require(payload.get("ok") is False, f"{error} payload was not false")
                require(payload.get("error") == error, f"{error} payload mismatch")
                require(payload.get("path") == str(path.resolve()), f"{error} path missing")
                require(
                    payload.get("artifactRoot") == str(fixture_root.resolve()),
                    f"{error} artifact root mismatch",
                )
                if detail:
                    require(detail in payload.get("message", ""), f"{error} detail missing")
            finally:
                stop_server(process)


def run_readable_malformed_manifest_smoke(port: int) -> None:
    with tempfile.TemporaryDirectory() as directory:
        fixture_root = Path(directory)
        malformed_manifest = fixture_root / "malformed_manifest.json"
        malformed_manifest.write_text(json.dumps({"allOk": True}), encoding="utf-8")

        case_port = find_free_port() if port == 0 else port
        base_url = f"http://127.0.0.1:{case_port}"
        process = start_server(case_port, malformed_manifest)
        try:
            wait_for_server(base_url, process)
            response = request(f"{base_url}/api/manifest")
            require(response.status == 200, "readable malformed manifest status mismatch")
            require_json_response_metadata(response, "readable malformed manifest")
            payload = json.loads(response.body.decode("utf-8"))
            require(payload.get("ok") is True, "readable malformed manifest was not ok")
            require(
                payload.get("manifestPath") == str(malformed_manifest.resolve()),
                "readable malformed manifest path missing",
            )
            require(
                payload.get("artifactRoot") == str(fixture_root.resolve()),
                "readable malformed manifest artifact root mismatch",
            )
            require_manifest_file_info(payload, malformed_manifest, "readable malformed manifest")
            require(
                payload.get("manifest") == {"allOk": True},
                "readable malformed manifest payload mismatch",
            )
            require("error" not in payload, "readable malformed manifest had error field")
        finally:
            stop_server(process)


def run_smoke(port: int, manifest: Path) -> None:
    valid_manifest_port = find_free_port() if port == 0 else port
    error_manifest_port = 0 if port == 0 else port + 1
    malformed_manifest_port = 0 if port == 0 else port + 3
    run_step(
        "valid manifest packet",
        lambda: run_valid_manifest_smoke(valid_manifest_port, manifest),
    )
    run_step(
        "manifest error responses",
        lambda: run_manifest_error_smoke(error_manifest_port),
    )
    run_step(
        "readable malformed manifest source",
        lambda: run_readable_malformed_manifest_smoke(malformed_manifest_port),
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--port",
        default=0,
        type=int,
        help="Port for the first smoke server. Defaults to 0 for automatic ports.",
    )
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    args = parser.parse_args()

    run_smoke(args.port, Path(args.manifest).resolve())
    print("soemdsp-sandbox smoke test passed")


if __name__ == "__main__":
    main()
