"""Vercel Python Function for internal POST /api/youtube-info requests."""

from __future__ import annotations

import json
import os
import re
from http.server import BaseHTTPRequestHandler
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import urlopen

from scripts.video_info import get_video_info, is_youtube_url


def video_id_from_url(url: str) -> str:
    """Extract the ID formats supported by the page's YouTube URL validation."""
    parsed = urlparse(url)
    host = parsed.netloc.lower().split(":")[0]
    if host == "youtu.be":
        candidate = parsed.path.strip("/").split("/")[0]
    else:
        candidate = parse_qs(parsed.query).get("v", [""])[0]
        if not candidate:
            segments = [segment for segment in parsed.path.split("/") if segment]
            candidate = segments[1] if len(segments) > 1 and segments[0] in {"shorts", "embed", "live"} else ""
    if not re.fullmatch(r"[A-Za-z0-9_-]{11}", candidate):
        raise ValueError("The URL does not contain a supported YouTube video ID.")
    return candidate


def format_iso_duration(value: str) -> str | None:
    """Convert a YouTube Data API ISO-8601 duration to H:MM:SS or M:SS."""
    match = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", value)
    if not match:
        return None
    hours, minutes, seconds = (int(part or 0) for part in match.groups())
    return f"{hours}:{minutes:02d}:{seconds:02d}" if hours else f"{minutes}:{seconds:02d}"


def get_video_info_from_data_api(url: str, api_key: str) -> dict:
    """Fetch the same public fields through YouTube's supported Data API."""
    params = urlencode({
        "id": video_id_from_url(url),
        "key": api_key,
        "part": "snippet,contentDetails,statistics",
    })
    try:
        with urlopen(f"https://www.googleapis.com/youtube/v3/videos?{params}", timeout=15) as response:
            payload = json.load(response)
    except HTTPError as error:
        raise RuntimeError(f"YouTube Data API returned HTTP {error.code}.") from error
    except URLError as error:
        raise RuntimeError("Could not reach the YouTube Data API.") from error

    items = payload.get("items", [])
    if not items:
        raise RuntimeError("The video was not found or is not publicly available.")

    item = items[0]
    snippet = item.get("snippet", {})
    thumbnails = snippet.get("thumbnails", {})
    thumbnail = next((thumbnails[size]["url"] for size in ("maxres", "standard", "high", "medium", "default") if size in thumbnails), None)
    return {
        "title": snippet.get("title"),
        "thumbnail": thumbnail,
        "duration": format_iso_duration(item.get("contentDetails", {}).get("duration", "")),
        "viewCount": int(item.get("statistics", {}).get("viewCount", 0)) if item.get("statistics", {}).get("viewCount") else None,
        "uploadDate": snippet.get("publishedAt", "")[:10].replace("-", "") or None,
    }


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
            api_key = os.environ.get("YOUTUBE_API_KEY")
            info = get_video_info_from_data_api(url, api_key) if api_key else get_video_info(url)
            self.send_json(info)
        except Exception as error:
            self.log_error("Unable to fetch YouTube metadata: %s", error)
            self.send_json({"error": "Could not fetch video metadata. Check the URL and try again."}, 502)

    def do_GET(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        self.send_json({"error": "This service is used internally by the deployed app."}, 405)
