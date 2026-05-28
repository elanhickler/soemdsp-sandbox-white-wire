from __future__ import annotations

import argparse
import json
import mimetypes
from datetime import datetime, timezone
from email.utils import formatdate
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
DEFAULT_SOEMDSP_ROOT = ROOT.parent / "soemdsp"
DEFAULT_MANIFEST = (
    DEFAULT_SOEMDSP_ROOT / "runtime_dsp_object_bound_wav_resync_demo.manifest.json"
)
STATIC_MIME_TYPES = {
    ".css": "text/css",
    ".js": "application/javascript",
}
# Mirrors soemdsp::meta::MetaType defaults from ../soemdsp/include/soemdsp/meta.hpp.
NODE_METADATA_KIND_TEMPLATES = {
    "decimal": {
        "def": 0,
        "label": "Decimal",
        "linearSmoothing": True,
        "max": 1,
        "mid": 0.5,
        "min": 0,
        "step": 0.01,
        "unit": "",
    },
    "decimal_bipolar": {
        "def": 0,
        "label": "Decimal Bipolar",
        "linearSmoothing": True,
        "max": 1,
        "mid": 0,
        "min": -1,
        "showPlusMinus": True,
        "step": 0.01,
        "unit": "",
    },
    "amplitude": {
        "def": 1,
        "label": "Amplitude",
        "linearSmoothing": True,
        "max": 3,
        "mid": 1,
        "min": 0,
        "step": 0.01,
        "unit": "amp",
    },
    "decibels": {
        "def": 0,
        "label": "Decibels",
        "linearSmoothing": True,
        "max": 12,
        "mid": 0,
        "min": -60,
        "step": 0.1,
        "unit": "dB",
    },
    "frequency": {
        "def": 1000,
        "label": "Frequency",
        "linearSmoothing": True,
        "max": 20000,
        "mid": 1000,
        "min": 0,
        "step": 1,
        "unit": "Hz",
    },
    "phase": {
        "def": 0,
        "label": "Phase",
        "linearSmoothing": True,
        "max": 1,
        "mid": 0.5,
        "min": 0,
        "step": 0.01,
        "unit": "cycle",
        "wraparound": True,
    },
    "pitch": {
        "def": 0,
        "label": "Pitch",
        "linearSmoothing": True,
        "max": 12,
        "mid": 0,
        "min": -12,
        "step": 0.1,
        "unit": "st",
    },
    "seconds": {
        "def": 0,
        "label": "Seconds",
        "linearSmoothing": True,
        "max": 5,
        "mid": 2.5,
        "min": 0,
        "step": 0.01,
        "unit": "s",
    },
    "sustain": {
        "def": 1,
        "label": "Sustain",
        "linearSmoothing": True,
        "max": 1,
        "mid": 0.7,
        "min": 0,
        "step": 0.01,
        "unit": "amp",
    },
    "descrete": {
        "def": 0,
        "label": "Descrete",
        "linearSmoothing": False,
        "max": 9,
        "mid": 4,
        "min": 0,
        "step": 1,
        "unit": "idx",
    },
    "integer_bipolar": {
        "def": 0,
        "label": "Integer Bipolar",
        "linearSmoothing": False,
        "max": 9,
        "mid": 0,
        "min": -9,
        "showPlusMinus": True,
        "step": 1,
        "unit": "idx",
    },
    "waveform": {
        "choices": ["Saw", "Square", "Triangle", "Sine", "Noise"],
        "def": 0,
        "displayChoices": True,
        "label": "Waveform",
        "linearSmoothing": False,
        "max": 4,
        "mid": 2,
        "min": 0,
        "step": 1,
        "unit": "",
    },
    "bypass": {
        "choices": ["active", "BYPASSED"],
        "def": 0,
        "displayChoices": True,
        "label": "Bypass",
        "linearSmoothing": False,
        "max": 1,
        "mid": 0.5,
        "min": 0,
        "step": 1,
        "unit": "bypass",
    },
    "plusminus": {
        "choices": ["-", "+"],
        "def": -1,
        "displayChoices": True,
        "label": "Plus Minus",
        "linearSmoothing": False,
        "max": 1,
        "mid": 0,
        "min": -1,
        "showPlusMinus": True,
        "step": 1,
        "unit": "plusminus",
    },
    "onoff": {
        "choices": ["off", "on"],
        "def": 1,
        "displayChoices": True,
        "label": "On Off",
        "linearSmoothing": False,
        "max": 1,
        "mid": 0.5,
        "min": 0,
        "step": 1,
        "unit": "onoff",
    },
    "momentary": {
        "choices": ["idle", "on"],
        "def": 0,
        "displayChoices": True,
        "label": "Momentary",
        "linearSmoothing": False,
        "max": 1,
        "mid": 0.5,
        "min": 0,
        "step": 1,
        "unit": "momentary",
    },
}


class SandboxServer(BaseHTTPRequestHandler):
    manifest_path: Path = DEFAULT_MANIFEST
    artifact_root: Path = DEFAULT_SOEMDSP_ROOT
    sending_error: bool = False

    def log_message(self, format: str, *args: object) -> None:
        return

    def send_error(
        self,
        code: int,
        message: str | None = None,
        explain: str | None = None,
    ) -> None:
        self.sending_error = True
        try:
            super().send_error(code, message, explain)
        finally:
            self.sending_error = False

    def end_headers(self) -> None:
        if self.sending_error:
            self.send_no_store_headers()
        super().end_headers()

    def do_GET(self) -> None:
        self.serve_request(send_body=True)

    def do_HEAD(self) -> None:
        self.serve_request(send_body=False)

    def do_POST(self) -> None:
        self.reject_mutation_method()

    def do_PUT(self) -> None:
        self.reject_mutation_method()

    def do_PATCH(self) -> None:
        self.reject_mutation_method()

    def do_DELETE(self) -> None:
        self.reject_mutation_method()

    def do_OPTIONS(self) -> None:
        self.reject_mutation_method()

    def reject_mutation_method(self) -> None:
        self.send_error(405, "Method not allowed")

    def serve_request(self, send_body: bool) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/":
            self.serve_file(PUBLIC / "index.html", send_body=send_body)
            return

        if parsed.path.startswith("/public/"):
            relative = parsed.path.removeprefix("/public/")
            self.serve_public(relative, send_body=send_body)
            return

        if parsed.path == "/api/manifest":
            if not send_body:
                self.send_error(405, "Method not allowed")
                return
            self.serve_manifest()
            return

        if parsed.path == "/api/node-metadata-kinds":
            if not send_body:
                self.send_error(405, "Method not allowed")
                return
            self.serve_node_metadata_kinds()
            return

        if parsed.path == "/artifact":
            self.serve_artifact(parsed.query, send_body=send_body)
            return

        self.send_error(404, "Not found")

    def serve_public(self, relative: str, send_body: bool) -> None:
        path = (PUBLIC / unquote(relative)).resolve()
        if not path.is_relative_to(PUBLIC):
            self.send_error(403, "Forbidden")
            return
        self.serve_file(path, send_body=send_body)

    def serve_manifest(self) -> None:
        manifest_path = self.manifest_path.resolve()
        if not manifest_path.exists():
            self.send_json(
                {
                    "ok": False,
                    "error": "manifest not found",
                    "artifactRoot": str(self.artifact_root.resolve()),
                    "path": str(manifest_path),
                },
                status=404,
            )
            return

        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            self.send_json(
                {
                    "ok": False,
                    "error": "manifest JSON parse failed",
                    "artifactRoot": str(self.artifact_root.resolve()),
                    "message": str(exc),
                    "path": str(manifest_path),
                },
                status=500,
            )
            return

        manifest_stat = manifest_path.stat()
        self.send_json(
            {
                "ok": True,
                "manifestPath": str(manifest_path),
                "artifactRoot": str(self.artifact_root.resolve()),
                "manifestInfo": {
                    "bytes": manifest_stat.st_size,
                    "modifiedUtc": datetime.fromtimestamp(
                        manifest_stat.st_mtime,
                        timezone.utc,
                    )
                    .replace(microsecond=0)
                    .isoformat()
                    .replace("+00:00", "Z"),
                },
                "manifest": manifest,
            }
        )

    def serve_node_metadata_kinds(self) -> None:
        self.send_json(
            {
                "ok": True,
                "templates": NODE_METADATA_KIND_TEMPLATES,
            },
        )

    def serve_artifact(self, query: str, send_body: bool) -> None:
        params = parse_qs(query)
        requested = params.get("path", [""])[0]
        if not requested:
            self.send_error(400, "Missing artifact path")
            return

        root = self.artifact_root.resolve()
        path = (root / requested).resolve()
        if not path.is_relative_to(root):
            self.send_error(403, "Forbidden")
            return

        self.serve_file(path, send_body=send_body)

    def serve_file(self, path: Path, send_body: bool = True) -> None:
        if not path.exists() or not path.is_file():
            self.send_error(404, "Not found")
            return

        mime_type = STATIC_MIME_TYPES.get(path.suffix.lower())
        if mime_type is None:
            mime_type, _ = mimetypes.guess_type(path)
        stat = path.stat()
        try:
            byte_range = self.parse_byte_range(
                self.headers.get("Range"),
                stat.st_size,
            )
        except ValueError:
            self.send_range_error(stat.st_size)
            return

        start = 0
        end = stat.st_size - 1
        if byte_range is not None:
            start, end = byte_range
        content_length = end - start + 1

        self.send_response(206 if byte_range is not None else 200)
        self.send_header("Content-Type", mime_type or "application/octet-stream")
        self.send_header("Content-Length", str(content_length))
        self.send_header("Last-Modified", formatdate(stat.st_mtime, usegmt=True))
        self.send_header("Accept-Ranges", "bytes")
        if byte_range is not None:
            self.send_header("Content-Range", f"bytes {start}-{end}/{stat.st_size}")
        self.send_no_store_headers()
        self.end_headers()
        if send_body:
            with path.open("rb") as handle:
                handle.seek(start)
                self.wfile.write(handle.read(content_length))

    def parse_byte_range(
        self,
        header: str | None,
        file_size: int,
    ) -> tuple[int, int] | None:
        if not header:
            return None

        if not header.startswith("bytes="):
            raise ValueError("unsupported range unit")

        spec = header.removeprefix("bytes=").strip()
        if "," in spec or "-" not in spec:
            raise ValueError("unsupported byte range")

        start_text, end_text = spec.split("-", 1)
        try:
            if start_text == "":
                suffix_length = int(end_text)
                if suffix_length <= 0:
                    raise ValueError("invalid suffix range")
                start = max(0, file_size - suffix_length)
                end = file_size - 1
            else:
                start = int(start_text)
                end = int(end_text) if end_text else file_size - 1
        except ValueError as error:
            raise ValueError("invalid byte range") from error

        if start < 0 or end < start or start >= file_size:
            raise ValueError("unsatisfiable byte range")

        return start, min(end, file_size - 1)

    def send_range_error(self, file_size: int) -> None:
        self.send_response(416)
        self.send_header("Content-Range", f"bytes */{file_size}")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", "0")
        self.send_no_store_headers()
        self.end_headers()

    def send_no_store_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")

    def send_json(self, payload: object, status: int = 200) -> None:
        body = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_no_store_headers()
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8765, type=int)
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    args = parser.parse_args()

    SandboxServer.manifest_path = Path(args.manifest).resolve()
    SandboxServer.artifact_root = SandboxServer.manifest_path.parent.resolve()

    server = ThreadingHTTPServer((args.host, args.port), SandboxServer)
    print(f"soemdsp-sandbox serving http://{args.host}:{args.port}")
    print(f"manifest: {SandboxServer.manifest_path}")
    server.serve_forever()


if __name__ == "__main__":
    main()
