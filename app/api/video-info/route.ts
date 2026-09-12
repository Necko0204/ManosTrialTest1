import { spawn } from "node:child_process";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const YOUTUBE_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"];

function isYouTubeUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) && YOUTUBE_HOSTS.includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function runLocalPython(url: string): Promise<unknown> {
  const executable = process.env.PYTHON_EXECUTABLE || (process.platform === "win32" ? "python" : "python3");
  const script = path.join(process.cwd(), "scripts", "video_info.py");

  return new Promise((resolve, reject) => {
    const child = spawn(/* turbopackIgnore: true */ executable, [script, url], { shell: false });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => child.kill(), 20_000);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => { clearTimeout(timeout); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error(stderr || "The metadata process failed."));
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error("The metadata process returned invalid JSON.")); }
    });
  });
}

async function runVercelPython(url: string, request: NextRequest): Promise<NextResponse> {
  const functionUrl = new URL("/api/youtube-info", request.url);
  const response = await fetch(functionUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const payload = await response.json().catch(() => ({ error: "The metadata service returned an invalid response." }));
  return NextResponse.json(payload, { status: response.status });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  if (!body || typeof body.url !== "string" || !isYouTubeUrl(body.url)) {
    return NextResponse.json({ error: "Please provide a valid YouTube URL." }, { status: 400 });
  }

  try {
    if (process.env.VERCEL) return runVercelPython(body.url, request);
    return NextResponse.json(await runLocalPython(body.url));
  } catch (error) {
    console.error("video-info failed", error);
    return NextResponse.json({ error: "Could not fetch video metadata. Check the URL and try again." }, { status: 502 });
  }
}
