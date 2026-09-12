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

### Make deployed Fetch work reliably

YouTube can challenge requests from cloud-server IP addresses, which can prevent `yt-dlp` from retrieving metadata on Vercel. The deployed function therefore uses the official YouTube Data API when a server-side `YOUTUBE_API_KEY` is configured; local use continues to fall back to `yt-dlp`.

1. In Google Cloud Console, create/select a project, enable **YouTube Data API v3**, and create an API key.
2. Restrict that key to the YouTube Data API v3, then copy it.
3. In Vercel: **Project → Settings → Environment Variables**, add `YOUTUBE_API_KEY` for Production, Preview, and Development. Do not use a `NEXT_PUBLIC_` prefix and do not commit the key to Git.
4. Redeploy the project.

The API's `videos.list` endpoint can return the required `snippet`, `contentDetails`, and `statistics` metadata in one request.

## Production notes

The API route uses `spawn` with an argument array (rather than a shell command) and only permits YouTube hosts. In a deployed serverless environment I would put the extraction behind a separate Python worker/service (or a queue), add request-level rate limiting and user/IP quotas, cache results by canonical video ID with a TTL, set observability/structured error reporting, and handle yt-dlp upgrades plus provider/API policy changes. A background worker also avoids tying long external requests to the web request lifecycle.

## Trial write-up

I scaffolded the Next.js project from the terminal and set up the TypeScript/Tailwind structure. I used Codex as an AI coding assistant to help turn the task requirements into an implementation plan and to draft the Python `yt-dlp` metadata wrapper. I then reviewed the flow and adjusted the UI behaviour, URL validation, JSON contract, loading/error states, and the API-to-Python process boundary.

For the visual work, I used Tailwind utility classes for the page layout, form controls, spacing, and responsive card. I added custom CSS in `app/globals.css` for the off-white background, soft colour gradients, transitions, and accessibility-friendly reduced-motion behaviour. I also added an original interactive background using the browser Canvas API inside the TypeScript page: particles drift and connect, the pointer pushes them aside, and clicks create short ripple rings. This keeps the interface more engaging without needing a third-party animation package or copying another site’s code/assets.

For a real feature I would add robust extractor-error mapping, retries where appropriate, caching, rate limits, authentication/abuse protection, tests, monitoring, and move the Python job to a managed worker instead of spawning a process from the request handler.

One issue I encountered during deployment was Vercel reporting that it could not detect a Next.js version. I checked the Git status and found that the GitHub branch only contained the initial commit; the new `package.json` and application files had not yet been committed and pushed. After pushing the project files, Vercel detected the Next.js app, installed the Python dependencies from `requirements.txt`, and built the Python API function successfully. The completed build also flagged the initially pinned Next.js version as vulnerable, so I updated the dependency before final production use. With more time, I would run integration tests against known public videos and unavailable/private-video cases, use `yt-dlp`'s verbose output to diagnose extractor failures, and verify deployment-specific Python process support before shipping.
