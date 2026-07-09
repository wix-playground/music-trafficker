# Music Trafficker — Disco Ball

A single-page 3D experience for the [@MusicTrafficker](https://www.youtube.com/@MusicTrafficker) YouTube channel, built on [Wix Headless](https://dev.wix.com/docs/go-headless) (Astro + React + three.js).

A giant mirror ball spins in a dark club. Its windows are live thumbnails of the channel's videos — click one and it flies out of the ball into a fullscreen player that starts the video from the beginning, with sound. Close it and the tile flies back into the ball.

**Live site:** https://music-traf-ab6ea66c-vytenisu.wix-site-host.com

## Stack

- **Astro 5** + `@wix/astro` (Wix-managed hosting, server routes)
- **React 18** island with **three.js** via `@react-three/fiber` + `@react-three/drei`
- Bloom/vignette via `@react-three/postprocessing`
- YouTube IFrame embed for playback

## How the YouTube feed works

`src/pages/api/videos.ts` is an Astro server route (`GET /api/videos`). No YouTube API key is used:

1. **Primary source** — it fetches `https://www.youtube.com/@MusicTrafficker/videos` and parses the `ytInitialData` JSON embedded in the page. The `/videos` tab lists **full videos only** (Shorts live in a separate tab), includes durations, and returns ~30 items.
2. **Fallback** — if parsing fails (YouTube markup change, consent wall), it falls back to the channel RSS feed (`youtube.com/feeds/videos.xml?channel_id=…`, latest ~15 items). Because RSS mixes in Shorts, each item is probed with a `HEAD` request to `/shorts/<id>` — a `200` there means it's a Short and it gets dropped.
3. Anything shorter than 90 seconds is also filtered out, results are cached in memory for 1 hour, and the response carries `Cache-Control: s-maxage=3600`.

Tiles use `i.ytimg.com/vi/<id>/mqdefault.jpg` thumbnails as the "low-quality preview" textures; the fullscreen flyer upgrades to `maxresdefault.jpg` when available.

## The 3D scene

`src/components/disco/DiscoScene.tsx`:

- ~1,100 instanced mirror facets + ~82 "video window" planes distributed over latitude bands of the sphere (each of the ~30 videos appears 2–3 times).
- Orbiting colored spotlights, an emissive-lightformer environment map for reflections, particle sparkles, bloom + vignette.
- All animation is time-based (`delta`-driven), so it is framerate-independent.
- Click → the tile's world transform is captured and a 16:9 "flyer" plane interpolates position/rotation/scale to a rect that exactly matches the letterboxed frame the fullscreen player will use, while the thumbnail un-crops from window aspect to full 16:9. When it arrives, the DOM overlay with the YouTube iframe fades in (`autoplay=1&start=0`, sound allowed because it follows a user gesture). Closing reverses the flight.
- Drag to orbit the ball manually (OrbitControls, rotation only).

## Develop

```bash
npm install --ignore-scripts   # sharp's native build is dev-only dead weight; skip it
npm run dev                    # wix dev → http://localhost:4321
```

Prefix commands with `AI_AGENT=claude` (or run interactively) when using the Wix CLI from an agent.

## Build & deploy

```bash
npm run build     # wix build
npx wix release   # publishes to Wix hosting, prints the live URL
```

The site and hosting are managed by Wix; `wix.config.json` carries the site/app ids. `.env.local` (gitignored) holds the CLI-managed OAuth secret — never commit it.
