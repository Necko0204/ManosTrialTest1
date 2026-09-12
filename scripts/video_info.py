#!/usr/bin/env python3
"""Fetch basic YouTube metadata using yt-dlp and emit one JSON object."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


def is_youtube_url(value: str) -> bool:
    """Accept standard youtube.com and youtu.be URLs only."""
    parsed = urlparse(value)
    host = parsed.netloc.lower().split(":")[0]
    return parsed.scheme in {"http", "https"} and (
        host == "youtu.be" or host.endswith(".youtube.com") or host == "youtube.com"
    )


def format_duration(seconds: int | None) -> str | None:
    if seconds is None:
        return None
    hours, remainder = divmod(int(seconds), 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours}:{minutes:02d}:{seconds:02d}" if hours else f"{minutes}:{seconds:02d}"


def get_video_info(url: str) -> dict[str, Any]:
    """Retrieve metadata without downloading video content."""
    try:
        from yt_dlp import YoutubeDL
    except ImportError as error:
        raise RuntimeError("yt-dlp is not installed. Run: pip install -r requirements.txt") from error

    options = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
    }
    with YoutubeDL(options) as downloader:
        info = downloader.extract_info(url, download=False)

    return {
        "title": info.get("title"),
        "thumbnail": info.get("thumbnail"),
        "duration": format_duration(info.get("duration")),
        "viewCount": info.get("view_count"),
        "uploadDate": info.get("upload_date"),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", help="YouTube video URL")
    parser.add_argument("--output", "-o", type=Path, help="Optional path to save the JSON result")
    args = parser.parse_args()

    if not is_youtube_url(args.url):
        print(json.dumps({"error": "Please provide a valid YouTube URL."}), file=sys.stderr)
        return 2

    try:
        result = get_video_info(args.url)
    except Exception as error:  # yt-dlp has several network/extractor-specific errors
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 1

    payload = json.dumps(result, indent=2)
    if args.output:
        args.output.write_text(payload + "\n", encoding="utf-8")
    print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
