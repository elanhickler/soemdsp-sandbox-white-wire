from __future__ import annotations

import argparse
import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
DEFAULT_SOEMDSP_ROOT = ROOT.parent / "soemdsp"
DEFAULT_MANIFEST = (
    DEFAULT_SOEMDSP_ROOT / "runtime_dsp_object_bound_wav_resync_demo.manifest.json"
)


class SandboxServer(BaseHTTPRequestHandler):
    manifest_path: Path = DEFAULT_MANIFEST
    artifact_root: Path = DEFAULT_SOEMDSP_ROOT

    def log_message(self, format: str, *args: object) -> None:
        return

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/":
            self.serve_file(PUBLIC / "index.html")
            return

        if parsed.path.startswith("/public/"):
            relative = parsed.path.removeprefix("/public/")
            self.serve_public(relative)
            return

        if parsed.path == "/api/manifest":
            self.serve_manifest()
            return

        if parsed.path == "/artifact":
            self.serve_artifact(parsed.query)
            return

        self.send_error(404, "Not found")

    def serve_public(self, relative: str) -> None:
        path = (PUBLIC / unquote(relative)).resolve()
        if not path.is_relative_to(PUBLIC):
            self.send_error(403, "Forbidden")
            return
        self.serve_file(path)

    def serve_manifest(self) -> None:
        manifest_path = self.manifest_path.resolve()
        if not manifest_path.exists():
            self.send_json(
                {
                    "ok": False,
                    "error": "manifest not found",
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
                    "message": str(exc),
                    "path": str(manifest_path),
                },
                status=500,
            )
            return

        self.send_json(
            {
                "ok": True,
                "manifestPath": str(manifest_path),
                "artifactRoot": str(self.artifact_root.resolve()),
                "manifest": manifest,
            }
        )

    def serve_artifact(self, query: str) -> None:
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

        self.serve_file(path)

    def serve_file(self, path: Path) -> None:
        if not path.exists() or not path.is_file():
            self.send_error(404, "Not found")
            return

        mime_type, _ = mimetypes.guess_type(path)
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime_type or "application/octet-stream")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, payload: object, status: int = 200) -> None:
        body = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
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
