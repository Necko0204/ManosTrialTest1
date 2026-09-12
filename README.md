# YouTube Video Info — Manos Corp Trial

A deliberately small full-stack feature: a Next.js/Tailwind form submits a YouTube URL to `POST /api/video-info`; the route executes the Python `yt-dlp` wrapper and returns its JSON (title, thumbnail, duration, views, and upload date) to the browser.

## Run locally

Prerequisites: Node 20+ and Python 3.10+.

```bash
pip install -r requirements.txt
npm install
npm run dev
```

Open `http://localhost:3000`, paste a standard YouTube URL, and select **Fetch**.

The Python script is also directly usable:

```bash
python scripts/video_info.py "https://www.youtube.com/watch?v=VIDEO_ID"
python scripts/video_info.py "https://www.youtube.com/watch?v=VIDEO_ID" --output video.json
```

`--output` implements the optional local JSON-file save.

## Production notes

The API route uses `spawn` with an argument array (rather than a shell command) and only permits YouTube hosts. In a deployed serverless environment I would put the extraction behind a separate Python worker/service (or a queue), add request-level rate limiting and user/IP quotas, cache results by canonical video ID with a TTL, set observability/structured error reporting, and handle yt-dlp upgrades plus provider/API policy changes. A background worker also avoids tying long external requests to the web request lifecycle.

## Trial write-up

I used Codex as an AI coding assistant to scaffold the small Next.js/Python structure and to sanity-check the design. I directed the requirements and reviewed/adjusted the implementation decisions: JSON contract, URL validation, process boundary, loading/error states, and production trade-offs.

For a real feature I would add robust extractor-error mapping, retries where appropriate, caching, rate limits, authentication/abuse protection, tests, monitoring, and move the Python job to a managed worker instead of spawning a process from the request handler.

The provided workspace had no starter project and its global `npm` executable was broken (`npm-cli.js` missing), so I could not install dependencies or run a Next.js production build here. The Python script can still be syntax-checked locally; with more time I would install dependencies in a healthy Node environment, run integration tests against a known public video, and verify deployment-specific Python process support.
