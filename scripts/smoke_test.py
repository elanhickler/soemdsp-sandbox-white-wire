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
EXPECTED_CONTRACT = "soemdsp-demo-local-sandbox-handoff"
EXPECTED_CONTRACT_VERSION = 1
EXPECTED_INSPECTION_MODE = "mouse-and-ears"
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
EXPECTED_DEMO = "runtime_dsp_object_bound_wav_resync_demo"
EXPECTED_KIND = "demo-local-bound-wav-resync-artifacts"
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
    "contractStatus",
    "currentAmplitude",
    "currentFrequency",
    "currentParameterStatus",
    "followAudioButton",
    "frameCount",
    "handsOnReadiness",
    "handsOnReadinessStatus",
    "inspectionCursor",
    "inspectionCursorStatus",
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
    "waveformPhaseRange",
    "waveformPosition",
    "waveformProbe",
    "waveformSample",
    "waveformScrubber",
    "waveformStatus",
}


class ShellContractParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.duplicate_ids: set[str] = set()
        self.elements_by_id: dict[str, tuple[str, dict[str, str]]] = {}
        self.ids: set[str] = set()
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
    require("/public/app.js" in parser.scripts, "shell missing app.js script")
    require(
        "/public/styles.css" in parser.stylesheets,
        "shell missing styles.css stylesheet",
    )
    require_shell_element(
        parser,
        "audioPlayer",
        "audio",
        {"controls": "", "preload": "metadata"},
    )
    require_shell_element(
        parser,
        "followAudioButton",
        "button",
        {"type": "button", "aria-pressed": "true"},
    )
    require_shell_element(
        parser,
        "waveformCanvas",
        "canvas",
        {"width": "1120", "height": "180", "aria-label": "Primary WAV waveform"},
    )
    require_shell_element(
        parser,
        "signalPlotCanvas",
        "canvas",
        {"width": "720", "height": "360", "aria-label": "Primary WAV signal plot"},
    )
    require_shell_element(
        parser,
        "levelEnvelopeCanvas",
        "canvas",
        {"width": "1120", "height": "140", "aria-label": "Primary WAV level envelope"},
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
    require(manifest.get("demo") == EXPECTED_DEMO, "demo name mismatch")
    require(manifest.get("kind") == EXPECTED_KIND, "artifact kind mismatch")
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
    require(isinstance(frequency, dict), "frequency resync missing")
    require(isinstance(amplitude, dict), "amplitude resync missing")
    for phase in phases:
        require(isinstance(phase, dict), "phase not object")
        name = phase.get("name")
        require(isinstance(name, str) and name, "phase name missing")
        measurement = measurements_by_name.get(name)
        require(isinstance(measurement, dict), f"{name} measurement missing")
        measured_frequency = float(measurement.get("measuredFrequency", 0))
        peak = float(measurement.get("peak", 0))
        rms = float(measurement.get("rms", 0))
        require(
            abs(measured_frequency - float(frequency.get(name, 0))) < 0.5,
            f"{name} producer measured frequency mismatch",
        )
        require(
            abs(peak - float(amplitude.get(name, 0))) < 0.001,
            f"{name} producer measured peak mismatch",
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


def require_artifact_reachability(base_url: str, payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")
    links = manifest.get("artifactLinks")
    require(isinstance(links, list), "artifact links missing")

    for index, link in enumerate(links):
        require(isinstance(link, dict), f"artifact link {index} not object")
        path = link.get("path")
        require(isinstance(path, str) and path, f"artifact link {index} path missing")
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
        require(content_length > 0, f"artifact link {index} content length missing")


def require_report_documents(base_url: str, payload: dict[str, object]) -> None:
    manifest = payload.get("manifest")
    require(isinstance(manifest, dict), "manifest object missing")
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
        response = request(f"{base_url}/artifact?path={urllib.parse.quote(path)}")
        require(response.status == 200, f"report link {index} did not return 200")
        require_no_store(response, f"report link {index}")
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
    require(isinstance(frequency, dict), "phase measurement frequency missing")
    require(isinstance(amplitude, dict), "phase measurement amplitude missing")
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
        require(
            abs(peak - target_amplitude) < 0.001,
            f"{name} peak {peak} did not match target amplitude {target_amplitude}",
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
    root_response = request(f"{base_url}/")
    require(root_response.status == 200, "root shell did not return 200")
    require_no_store(root_response, "root shell")
    require_content_type(root_response, "text/html", "root shell")
    require_shell_contract(root_response.body.decode("utf-8"))


def require_static_assets(base_url: str) -> None:
    for path, content_type in [
        ("/public/app.js", ("application/javascript", "text/javascript")),
        ("/public/styles.css", "text/css"),
    ]:
        static_response = request(f"{base_url}{path}", method="HEAD")
        require(static_response.status == 200, f"{path} did not return 200")
        require_no_store(static_response, path)
        require_content_type(static_response, content_type, path)


def require_waveform_seek_source_contract() -> None:
    app_source = (PUBLIC / "app.js").read_text(encoding="utf-8")
    style_source = (PUBLIC / "styles.css").read_text(encoding="utf-8")
    require(
        "function seekPrimaryAudioToFrame(frame)" in app_source,
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
        "function phaseAudioMeasurementIssues(manifest)",
        "const phaseAudioFrequencyToleranceHz = 0.5",
        "const phaseAudioAmplitudeTolerance = 0.001",
        "const phaseAudioRmsTolerance = 0.001",
        "function renderCurrentParameters(region)",
        "waveformProbeSource: null",
        '["hover source", hoverFrame === null ? "none" : state.waveformProbeSource || "probe"]',
        'state.waveformProbeSource = "waveform"',
        'state.waveformProbeSource = "level envelope"',
        'state.waveformProbeSource = state.waveformProbeFrame === null ? null : "signal plot"',
        'state.waveformProbeSource = "parameter timeline"',
        'state.waveformProbeSource = "phase audio stats"',
        'state.waveformProbeSource = "phase list"',
        'setSharedProbeFrame(region.startFrame, "phase jump")',
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
        'setStatus("sandboxContractStatus", ok ? "Bounded" : "Check", ok)',
        'frequencyValue === null ? "freq" : `freq ${formatCompactNumber(frequencyValue)} Hz`',
        'amplitudeValue === null ? "amp" : `amp ${formatCompactNumber(amplitudeValue)}`',
        'status.textContent = ok ? "params synced" : "params missing"',
        "function parameterTimelineRows(manifest)",
        "function renderParameterTimeline(manifest)",
        "function updateParameterTimelinePlayhead(region)",
        "function renderParameterTimelineProbe()",
        "function probeParameterTimelineSegment(event)",
        "function clearParameterTimelineProbe()",
        'marker.id = "parameterTimelinePlayhead"',
        'probeMarker.id = "parameterTimelineProbeMarker"',
        'segment.dataset.phaseName = phase.name || ""',
        "segment.dataset.startFrame = String(span.startFrame)",
        '.addEventListener("pointermove", probeParameterTimelineSegment)',
        "function buildLevelEnvelope(waveform)",
        "function drawLevelEnvelope()",
        "function renderLevelEnvelope()",
        "function levelEnvelopeWindowAtFrame(frame)",
        "function renderLevelEnvelopeProbe()",
        "function probeLevelEnvelopeAtClientX(clientX)",
        "function clearLevelEnvelopeProbe()",
        'state.waveformProbeFrame = waveformFrameAtClientXForCanvas(clientX, "levelEnvelopeCanvas")',
        '.addEventListener("pointerleave", clearLevelEnvelopeProbe)',
        "function renderPhaseAudioStats()",
        "function updatePhaseAudioStatsActive(region)",
        "function renderPhaseAudioStatsProbe()",
        "function probePhaseAudioStats(event)",
        "function clearPhaseAudioStatsProbe()",
        "item.dataset.startFrame = String(region.startFrame)",
        'item.addEventListener("pointermove", probePhaseAudioStats)',
        "function renderPhaseProbe()",
        "function probePhaseList(event)",
        "function clearPhaseListProbe()",
        'item.addEventListener("pointermove", probePhaseList)',
        '["window", `${formatCompactNumber(envelope.windowMs)} ms`]',
        '["source", "decoded primary WAV"]',
        '["target freq", frequencyValue === null ? "missing" : `${formatCompactNumber(frequencyValue)} Hz`]',
        '["measured freq", measuredFrequency === null ? "missing" : `${formatCompactNumber(measuredFrequency)} Hz`]',
        '["freq delta", frequencyDelta]',
        '["producer freq", Number.isFinite(producerFrequency) ? `${formatCompactNumber(producerFrequency)} Hz` : "missing"]',
        '["producer freq delta", producerFrequencyDeltaText]',
        '["target amp", amplitudeValue === null ? "missing" : formatCompactNumber(amplitudeValue)]',
        '["peak delta", peakDelta]',
        '["producer peak", Number.isFinite(producerPeak) ? formatCompactNumber(producerPeak) : "missing"]',
        '["producer peak delta", producerPeakDeltaText]',
        '["producer rms", Number.isFinite(producerRms) ? formatCompactNumber(producerRms) : "missing"]',
        '["producer rms delta", producerRmsDeltaText]',
        'status.textContent = allOk ? "Verified" : "Check"',
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
        "function renderHandsOnReadiness(manifest, waveformReady = Boolean(state.waveform))",
        'setStatus("handsOnReadinessStatus", ok ? "Ready" : "Check", ok)',
        '"native audio",',
        '["decoded waveform", waveformReady]',
        '["waveform seek", waveformReady && Number(manifest?.wav?.frames) > 0]',
        '["waveform hover probe", waveformReady && Boolean(document.getElementById("waveformProbe"))]',
        '["level envelope probe", waveformReady && Boolean(document.getElementById("levelEnvelopeProbe"))]',
        '["parameter timeline probe", waveformReady && Boolean(document.getElementById("parameterTimelineProbe"))]',
        '["follow/free view", Boolean(document.getElementById("followAudioButton"))]',
        '["phase list probe", waveformReady && Boolean(document.getElementById("phaseProbe"))]',
        '["phase jump preview", waveformReady && Boolean(document.querySelector("#waveformPhaseControls button"))]',
        '["phase parameter readout", parameterResyncContractIssue(manifest) === ""]',
        '["producer measurement compare", phaseAudioMeasurementIssues(manifest).length === 0]',
        '["phase audio stats probe", waveformReady && Boolean(document.getElementById("phaseAudioStatsProbe"))]',
        '["signal inspection", waveformReady && Boolean(document.getElementById("signalPlotCanvas"))]',
        '["signal plot probe", waveformReady && Boolean(document.getElementById("signalPlotProbe"))]',
        '["signal plot source probe", waveformReady && Boolean(document.getElementById("signalPlotProbeSource"))]',
        '["waveform-to-signal probe", waveformReady && Boolean(signalPlotProbeAtFrame(0))]',
        '["signal-to-waveform probe", waveformReady && Boolean(document.getElementById("waveformProbe"))]',
        '["inspection cursor", waveformReady && Boolean(document.getElementById("inspectionCursor"))]',
        '["read-only boundary", validateConsumerChecklist(manifest).accepted]',
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
        "function renderSignalPlotControls()",
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
        '["focus", signalPlotFocusName(waveform)]',
        '["mode", state.signalPlotMode]',
        '["scale", `x${state.signalPlotScale}`]',
        '["window", signalPlotWindowName(waveform, drawableFrames)]',
        '["window size", `${state.signalPlotWindowMs} ms`]',
        "x ${formatCompactNumber(x)} / y ${formatCompactNumber(y)}",
        '["x", "sample[n]"]',
        '["y", "sample[n + lag]"]',
        '["focus peak", formatCompactNumber(focusStats.peak)]',
        '["focus rms", formatCompactNumber(focusStats.rms)]',
    ]:
        require(snippet in app_source, f"waveform analysis source missing {snippet}")
    for snippet in [
        "function beginWaveformDrag(event)",
        "function dragWaveform(event)",
        "function endWaveformDrag(event)",
        'function setSharedProbeFrame(frame, source = "probe")',
        "function clearSharedProbeFrame()",
        "function probePhaseButton(index)",
        "function clearPhaseButtonProbe()",
        "phaseJumpPreviewIndex: null",
        'button.classList.toggle("preview", index === state.phaseJumpPreviewIndex)',
        "function waveformFrameAtClientX(clientX)",
        "function probeWaveformAtClientX(clientX)",
        "function renderWaveformProbe()",
        "function renderInspectionCursor()",
        'setStatus("inspectionCursorStatus", hoverFrame === null ? "Transport" : "Hover", true)',
        'const hoverFrequency = activeParameterValue("frequency", hoverRegion)',
        'const hoverAmplitude = activeParameterValue("amplitude", hoverRegion)',
        "const hoverEnvelope = hoverFrame !== null ? levelEnvelopeWindowAtFrame(hoverFrame) : null",
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
        ".parameter-timeline-marker",
        ".parameter-timeline-marker.probe",
        ".phase-stat-list",
        ".phase-stat.active",
        ".phase-button.preview",
        ".contract-list",
        ".contract-row",
        ".readiness-list",
    ]:
        require(snippet in style_source, f"waveform drag style missing {snippet}")
    require(
        "setFollowAudio(false, false);" not in app_source,
        "waveform controls still force free-view mode",
    )


def fetch_valid_manifest_payload(base_url: str) -> dict[str, object]:
    manifest_response = request(f"{base_url}/api/manifest")
    require(manifest_response.status == 200, "manifest endpoint did not return 200")
    require_no_store(manifest_response, "manifest endpoint")
    payload = json.loads(manifest_response.body.decode("utf-8"))
    require(isinstance(payload, dict), "manifest response payload was not object")
    require(payload.get("ok") is True, "manifest payload was not ok")
    require(payload.get("manifestPath"), "manifest path missing")
    require(payload.get("artifactRoot"), "artifact root missing")
    return payload


def require_manifest_contracts(payload: dict[str, object]) -> None:
    require_producer_proof(payload)
    require_handoff_contract(payload)
    require_artifact_contract(payload)
    require_phase_contract(payload)
    require_parameter_resync_contract(payload)


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
                require_no_store(response, error)
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
            require_no_store(response, "readable malformed manifest")
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
