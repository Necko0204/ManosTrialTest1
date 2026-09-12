# YouTube Video Info — Manos Corp Trial

A deliberately small full-stack feature: a Next.js/Tailwind form submits a YouTube URL to `POST /api/video-info`; the route executes the Python `yt-dlp` wrapper and returns its JSON (title, thumbnail, duration, views, and upload date) to the browser.

## Run locally

Prerequisites: Node 20+ and Python 3.10+.

```bash
pip install -r requirements.txt
npm install
npm run dev
```

Open `http://localhost:3000`, paste a standard YouTube URL, and select **Fetch**. `npm run dev` uses Vercel's local development server so that both the Next.js app and the Python function run together.

The Python script is also directly usable:

```bash
python scripts/video_info.py "https://www.youtube.com/watch?v=VIDEO_ID"
python scripts/video_info.py "https://www.youtube.com/watch?v=VIDEO_ID" --output video.json
```

`--output` implements the optional local JSON-file save.

## Deploy to Vercel

The project is configured to deploy the UI and a Python function at `POST /api/video-info`. Vercel installs `yt-dlp` from `requirements.txt` and uses Python 3.14 from `.python-version`.

```bash
npm install
npx vercel
```

Follow the CLI prompts to log in and create/link the Vercel project. Once the preview deployment works, publish it with:

```bash
npx vercel --prod
```

The Python function has a 30-second limit. A production version should still add caching and rate limits because metadata extraction depends on an external provider.

## Production notes

The API route uses `spawn` with an argument array (rather than a shell command) and only permits YouTube hosts. In a deployed serverless environment I would put the extraction behind a separate Python worker/service (or a queue), add request-level rate limiting and user/IP quotas, cache results by canonical video ID with a TTL, set observability/structured error reporting, and handle yt-dlp upgrades plus provider/API policy changes. A background worker also avoids tying long external requests to the web request lifecycle.

## Trial write-up

I scaffolded the Next.js project from the terminal and set up the TypeScript/Tailwind structure. I used Codex as an AI coding assistant to help turn the task requirements into an implementation plan and to draft the Python `yt-dlp` metadata wrapper. I then reviewed the flow and adjusted the UI behaviour, URL validation, JSON contract, loading/error states, and the API-to-Python process boundary.

For the visual work, I used Tailwind utility classes for the page layout, form controls, spacing, and responsive card. I added custom CSS in `app/globals.css` for the off-white background, soft colour gradients, transitions, and accessibility-friendly reduced-motion behaviour. I also added an original interactive background using the browser Canvas API inside the TypeScript page: particles drift and connect, the pointer pushes them aside, and clicks create short ripple rings. This keeps the interface more engaging without needing a third-party animation package or copying another site’s code/assets.

For a real feature I would add robust extractor-error mapping, retries where appropriate, caching, rate limits, authentication/abuse protection, tests, monitoring, and move the Python job to a managed worker instead of spawning a process from the request handler.

I did not encounter a product-level blocker in the implementation. With more time, I would run integration tests against a known public video and unavailable/private-video cases, use `yt-dlp`'s verbose output to diagnose extractor failures, and verify deployment-specific Python process support before shipping.
