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
    "followAudioButton",
    "frameCount",
    "inspectionMode",
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
    "phaseCoverage",
    "phaseCoverageStatus",
    "phaseList",
    "phaseStatus",
    "producerProof",
    "producerStatus",
    "refreshButton",
    "reportControls",
    "reportStatus",
    "reportViewer",
    "sourceDetail",
    "sourceError",
    "sourceStatus",
    "waveformCanvas",
    "waveformMeta",
    "waveformPhase",
    "waveformPhaseControls",
    "waveformPhaseRange",
    "waveformPosition",
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
    for index, phase in enumerate(phases):
        require(isinstance(phase, dict), f"phase {index} not object")
        require(phase.get("name"), f"phase {index} name missing")
        require(phase.get("preflightOk") is True, f"phase {index} preflight failed")
        require(phase.get("applyOk") is True, f"phase {index} apply failed")
        require(phase.get("processOk") is True, f"phase {index} process failed")
        samples = int(phase.get("samplesProcessed", 0))
        require(samples > 0, f"phase {index} samples missing")
        total_phase_frames += samples

    require(
        total_phase_frames == wav_frames,
        f"phase frames {total_phase_frames} did not match wav frames {wav_frames}",
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

    first_frequency = float(pairs["first half frequency"])
    second_frequency = float(pairs["second half frequency"])
    first_amplitude = float(pairs["first half amplitude"])
    second_amplitude = float(pairs["second half amplitude"])
    require(second_frequency > first_frequency, "frequency did not resync upward")
    require(second_amplitude > first_amplitude, "amplitude did not resync upward")


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
    require(
        "function seekPrimaryAudioToFrame(frame)" in app_source,
        "waveform seek helper missing",
    )
    require(
        "audio.currentTime = targetTime;" in app_source,
        "waveform seek helper does not seek primary audio",
    )
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
