from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = (
    ROOT.parent / "soemdsp" / "runtime_dsp_object_bound_wav_resync_demo.manifest.json"
)


@dataclass
class Response:
    status: int
    reason: str
    headers: dict[str, str]
    body: bytes


def request(url: str, method: str = "GET") -> Response:
    request = urllib.request.Request(url, method=method)
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


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


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


def wait_for_server(base_url: str) -> None:
    deadline = time.monotonic() + 5
    last_status = ""
    while time.monotonic() < deadline:
        response = request(f"{base_url}/public/index.html", method="HEAD")
        last_status = f"{response.status} {response.reason}"
        if response.status == 200:
            require_no_store(response, "public index")
            return
        time.sleep(0.1)
    raise RuntimeError(f"sandbox server did not become ready: {last_status}")


def start_server(port: int, manifest: Path) -> subprocess.Popen[bytes]:
    return subprocess.Popen(
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
        wait_for_server(base_url)

        root_response = request(f"{base_url}/", method="HEAD")
        require(root_response.status == 200, "root shell did not return 200")
        require_no_store(root_response, "root shell")
        require_content_type(root_response, "text/html", "root shell")

        for path, content_type in [
            ("/public/app.js", ("application/javascript", "text/javascript")),
            ("/public/styles.css", "text/css"),
        ]:
            static_response = request(f"{base_url}{path}", method="HEAD")
            require(static_response.status == 200, f"{path} did not return 200")
            require_no_store(static_response, path)
            require_content_type(static_response, content_type, path)

        manifest_response = request(f"{base_url}/api/manifest")
        require(manifest_response.status == 200, "manifest endpoint did not return 200")
        require_no_store(manifest_response, "manifest endpoint")
        payload = json.loads(manifest_response.body.decode("utf-8"))
        require(payload.get("ok") is True, "manifest payload was not ok")
        require(payload.get("manifestPath"), "manifest path missing")
        require(payload.get("artifactRoot"), "artifact root missing")

        handoff = payload["manifest"].get("sandboxHandoff", {})
        audio_path = handoff.get("primaryAudioArtifact")
        require(audio_path, "primary audio artifact missing from handoff")
        audio_response = request(
            f"{base_url}/artifact?path={urllib.parse.quote(audio_path)}",
            method="HEAD",
        )
        require(audio_response.status == 200, "primary audio artifact did not return 200")
        require_no_store(audio_response, "primary audio artifact")

        missing_path = request(f"{base_url}/artifact", method="HEAD")
        require(missing_path.status == 400, "missing artifact path did not return 400")
        require_no_store(missing_path, "missing artifact path")

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

        forbidden_public = request(
            f"{base_url}/public/%2e%2e/server.py",
            method="HEAD",
        )
        require(forbidden_public.status == 403, "public traversal did not return 403")
        require_no_store(forbidden_public, "public traversal")

        manifest_head = request(f"{base_url}/api/manifest", method="HEAD")
        require(manifest_head.status == 405, "manifest HEAD did not return 405")
        require_no_store(manifest_head, "manifest HEAD")
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
            case_port = port + index
            base_url = f"http://127.0.0.1:{case_port}"
            process = start_server(case_port, path)
            try:
                wait_for_server(base_url)
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


def run_smoke(port: int, manifest: Path) -> None:
    run_valid_manifest_smoke(port, manifest)
    run_manifest_error_smoke(port + 1)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", default=18765, type=int)
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    args = parser.parse_args()

    run_smoke(args.port, Path(args.manifest).resolve())
    print("soemdsp-sandbox smoke test passed")


if __name__ == "__main__":
    main()
