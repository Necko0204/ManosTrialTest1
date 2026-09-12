"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

type VideoInfo = {
  title: string | null;
  thumbnail: string | null;
  duration: string | null;
  viewCount: number | null;
  uploadDate: string | null;
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isValidUrl = isYouTubeUrl(url);

  function moveBackground(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    event.currentTarget.style.setProperty("--pointer-x", `${x}%`);
    event.currentTarget.style.setProperty("--pointer-y", `${y}%`);
  }

  function resetBackground(event: ReactPointerEvent<HTMLElement>) {
    event.currentTarget.style.setProperty("--pointer-x", "50%");
    event.currentTarget.style.setProperty("--pointer-y", "50%");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setVideo(null);
    try {
      const response = await fetch("/api/video-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = (await response.json()) as VideoInfo & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to fetch video information.");
      setVideo(body);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell min-h-screen px-4 py-16 text-slate-900" onPointerLeave={resetBackground} onPointerMove={moveBackground}>
      <InteractiveBackdrop />
      <section className="relative z-10 mx-auto max-w-xl rounded-2xl border border-sky-100 bg-white/90 p-6 shadow-[0_12px_50px_rgba(37,99,235,0.10)] backdrop-blur-sm sm:p-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-red-600">Manos Corp trial</p>
        <h1 className="text-2xl font-bold">YouTube video information</h1>
        <p className="mt-2 text-sm text-slate-600">Paste a YouTube video URL to retrieve its public metadata.</p>

        <form className="mt-6 flex gap-3" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="youtube-url">YouTube URL</label>
          <div className="relative min-w-0 flex-1">
            <input
              aria-describedby="url-status"
              aria-invalid={url.length > 0 && !isValidUrl}
              className="w-full rounded-md border border-slate-300 px-3 py-2 pr-9 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100 aria-[invalid=true]:border-red-400"
              id="youtube-url"
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              required
              type="url"
              value={url}
            />
            {url && (
              <button aria-label="Clear URL" className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 text-lg leading-none text-slate-400 transition hover:text-slate-700" onClick={() => { setUrl(""); setVideo(null); setError(null); }} type="button">×</button>
            )}
          </div>
          <button className="rounded-md bg-red-600 px-4 py-2 font-medium text-white transition hover:-translate-y-0.5 hover:bg-red-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60" disabled={loading || !isValidUrl} type="submit">
            {loading ? "Fetching…" : "Fetch"}
          </button>
        </form>

        <p className={`mt-2 min-h-5 text-xs ${url && isValidUrl ? "text-emerald-600" : "text-slate-500"}`} id="url-status" aria-live="polite">
          {url ? (isValidUrl ? "✓ YouTube link ready to fetch" : "Use a youtube.com or youtu.be video link") : "Paste a public YouTube video link to begin"}
        </p>

        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}

        {video && (
          <section className="result-card mt-6 overflow-hidden rounded-lg border border-slate-200">
            {video.thumbnail && (
              // A standard image keeps this lightweight and avoids configuring every YouTube thumbnail host for next/image.
              <img alt={`Thumbnail for ${video.title ?? "YouTube video"}`} className="aspect-video w-full bg-slate-100 object-cover" src={video.thumbnail} />
            )}
            <dl className="divide-y divide-slate-100">
              <InfoRow label="Title" value={video.title ?? "Unavailable"} />
              <InfoRow label="Duration" value={video.duration ?? "Unavailable"} />
              <InfoRow label="Views" value={video.viewCount?.toLocaleString() ?? "Unavailable"} />
              <InfoRow label="Upload date" value={video.uploadDate ?? "Unavailable"} />
            </dl>
          </section>
        )}
      </section>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 px-4 py-3 text-sm transition hover:bg-sky-50/70"><dt className="font-medium text-slate-500">{label}</dt><dd className="text-right">{value}</dd></div>;
}

function isYouTubeUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "youtu.be" || hostname === "youtube.com" || hostname.endsWith(".youtube.com");
  } catch {
    return false;
  }
}

type Particle = { x: number; y: number; vx: number; vy: number; radius: number };
type Pulse = { x: number; y: number; radius: number; opacity: number };

function InteractiveBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    let particles: Particle[] = [];
    let pulses: Pulse[] = [];
    const pointer = { x: -1000, y: -1000 };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const createParticles = () => {
      const count = Math.min(110, Math.max(46, Math.floor((width * height) / 12000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.32,
        vy: (Math.random() - 0.5) * 0.32,
        radius: Math.random() * 1.9 + 0.9,
      }));
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      createParticles();
    };

    const movePointer = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      const withinCanvas = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
      pointer.x = withinCanvas ? event.clientX - bounds.left : -1000;
      pointer.y = withinCanvas ? event.clientY - bounds.top : -1000;
    };

    const addPulse = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      if (event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom) {
        pulses.push({ x: event.clientX - bounds.left, y: event.clientY - bounds.top, radius: 4, opacity: 0.72 });
      }
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);

      for (const particle of particles) {
        const dx = particle.x - pointer.x;
        const dy = particle.y - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 175 && distance > 0) {
          const push = (175 - distance) / 175;
          particle.vx += (dx / distance) * push * 0.15;
          particle.vy += (dy / distance) * push * 0.15;
        }
        particle.vx *= 0.987;
        particle.vy *= 0.987;
        particle.x += particle.vx;
        particle.y += particle.vy;
        if (particle.x < -8 || particle.x > width + 8) particle.vx *= -1;
        if (particle.y < -8 || particle.y > height + 8) particle.vy *= -1;
      }

      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        for (let next = index + 1; next < particles.length; next += 1) {
          const neighbor = particles[next];
          const distance = Math.hypot(particle.x - neighbor.x, particle.y - neighbor.y);
          if (distance < 145) {
            context.beginPath();
            context.moveTo(particle.x, particle.y);
            context.lineTo(neighbor.x, neighbor.y);
            context.strokeStyle = `rgba(14, 165, 233, ${0.32 * (1 - distance / 145)})`;
            context.lineWidth = 1.15;
            context.stroke();
          }
        }
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fillStyle = "rgba(2, 132, 199, 0.72)";
        context.fill();
      }

      pulses = pulses.filter((pulse) => {
        pulse.radius += 2.6;
        pulse.opacity -= 0.013;
        if (pulse.opacity <= 0) return false;
        context.beginPath();
        context.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2);
        context.strokeStyle = `rgba(239, 68, 68, ${pulse.opacity})`;
        context.lineWidth = 1.8;
        context.stroke();
        return true;
      });

      if (!reducedMotion) frame = window.requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    if (!reducedMotion) {
      window.addEventListener("pointermove", movePointer);
      window.addEventListener("pointerdown", addPulse);
    }
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", movePointer);
      window.removeEventListener("pointerdown", addPulse);
    };
  }, []);

  return <canvas aria-hidden="true" className="interactive-backdrop" ref={canvasRef} />;
}
