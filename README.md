# YouTube Video Info — Manos Corp Trial

A deliberately small full-stack feature: a Next.js/Tailwind form submits a YouTube URL to `POST /api/video-info`; the route executes the Python `yt-dlp` wrapper and returns its JSON (title, thumbnail, duration, views, and upload date) to the browser.

## Run locally

Prerequisites: Node 20+ and Python 3.10+.

```bash
pip install -r requirements.txt
npm install
npm run dev
```

Open `http://localhost:3000`, paste a standard YouTube URL, and select **Fetch**. Local development uses the Next.js API route, which runs `scripts/video_info.py` directly. In Vercel, that same public route forwards to the separately deployed Python Function.

The Python script is also directly usable:

```bash
python scripts/video_info.py "https://www.youtube.com/watch?v=VIDEO_ID"
python scripts/video_info.py "https://www.youtube.com/watch?v=VIDEO_ID" --output video.json
```

`--output` implements the optional local JSON-file save.

## Production notes

The API route uses `spawn` with an argument array (rather than a shell command) and only permits YouTube hosts. In a deployed serverless environment I would put the extraction behind a separate Python worker/service (or a queue), add request-level rate limiting and user/IP quotas, cache results by canonical video ID with a TTL, set observability/structured error reporting, and handle yt-dlp upgrades plus provider/API policy changes. A background worker also avoids tying long external requests to the web request lifecycle.

## Trial write-up

I scaffolded the Next.js project from the terminal and set up the TypeScript/Tailwind structure. I used Codex as an AI coding assistant to help turn the task requirements into an implementation plan and to draft the Python `yt-dlp` metadata wrapper. I then reviewed the flow and adjusted the UI behaviour, URL validation, JSON contract, loading/error states, and the API-to-Python process boundary.

For the visual work, I used Tailwind utility classes for the page layout, form controls, spacing, and responsive card. I added custom CSS in `app/globals.css` for the off-white background, soft colour gradients, transitions, and accessibility-friendly reduced-motion behaviour. I also added an original interactive background using the browser Canvas API inside the TypeScript page: particles drift and connect, the pointer pushes them aside, and clicks create short ripple rings. This keeps the interface more engaging without needing a third-party animation package or copying another site’s code/assets.

For a real feature I would add robust extractor-error mapping, retries where appropriate, caching, rate limits, authentication/abuse protection, tests, monitoring, and move the Python job to a managed worker instead of spawning a process from the request handler.

I encountered two deployment issues. First, Vercel initially could not detect Next.js because the GitHub branch only contained the initial commit; the new `package.json` and application files had not yet been pushed. After committing the project files, Vercel detected the Next.js app, installed the Python dependencies from `requirements.txt`, and built the Python Function successfully. Vercel also flagged the initially pinned Next.js version as vulnerable, so I updated it to a patched release.

The feature works locally: the Next.js route launches the Python script, and `yt-dlp` retrieves the metadata from my local connection. In Vercel, the same `yt-dlp` request was rejected by YouTube's cloud-IP anti-bot challenge. I diagnosed this through the Vercel function logs rather than treating it as a generic frontend failure. To handle that production constraint, I added a server-side fallback to the official YouTube Data API, activated by a `YOUTUBE_API_KEY` Vercel environment variable. I deliberately did not provision a personal Google Cloud key for this short assessment: it would introduce an external credential, quota ownership, and billing/security configuration that should belong to the production project owner. The README documents the exact environment-variable setup needed to enable the deployed Fetch flow.

With more time, I would add integration tests for public, private, and unavailable videos; cache results by video ID; enforce rate limits; monitor extractor/API errors; and configure a restricted API key with quota alerts in the production environment.
