"""Vercel Python Function for POST /api/video-info."""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler

from scripts.video_info import get_video_info, is_youtube_url


class handler(BaseHTTPRequestHandler):
    """Expose the shared yt-dlp metadata logic as a Vercel Function."""

    def send_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(content_length))
        except (TypeError, ValueError, json.JSONDecodeError):
            self.send_json({"error": "Request body must be valid JSON."}, 400)
            return

        url = body.get("url") if isinstance(body, dict) else None
        if not isinstance(url, str) or not is_youtube_url(url):
            self.send_json({"error": "Please provide a valid YouTube URL."}, 400)
            return

        try:
            self.send_json(get_video_info(url))
        except Exception as error:
            # Log the original error in Vercel's function logs without exposing internals to clients.
            self.log_error("Unable to fetch YouTube metadata: %s", error)
            self.send_json({"error": "Could not fetch video metadata. Check the URL and try again."}, 502)

    def do_OPTIONS(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        self.send_response(204)
        self.send_header("Allow", "POST, OPTIONS")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        self.send_json({"error": "Use POST with a JSON body containing a YouTube URL."}, 405)
