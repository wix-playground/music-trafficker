import snapshot from "./storyboard-snapshot.json";

export const YT_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

export const YT_HEADERS = {
  "User-Agent": YT_UA,
  "Accept-Language": "en",
  Cookie: "CONSENT=YES+; SOCS=CAI",
};

export interface StoryboardMeta {
  cols: number;
  rows: number;
  frames: number;
  intervalMs: number;
}

interface SbEntry {
  at: number;
  sheetUrl: string | null;
  meta: StoryboardMeta | null;
}

const SB_TTL_MS = 20 * 60 * 60 * 1000; // resolved specs
const SB_NEGATIVE_TTL_MS = 2 * 60 * 60 * 1000; // "no storyboard" results — retry sooner

const sbCache = new Map<string, SbEntry>();
const inFlight = new Map<string, Promise<SbEntry>>();

function isFresh(entry: SbEntry) {
  const ttl = entry.meta ? SB_TTL_MS : SB_NEGATIVE_TTL_MS;
  return Date.now() - entry.at < ttl;
}

export function getCachedStoryboardMeta(id: string): StoryboardMeta | null {
  const entry = sbCache.get(id);
  if (entry && isFresh(entry)) return entry.meta;
  return SNAPSHOT[id]?.meta ?? null;
}

/**
 * Storyboards are the seek-preview sprite sheets YouTube generates for every
 * video. The spec lives in the watch page's player response:
 *   <base-url>|w#h#count#cols#rows#intervalMs#nameTemplate#sigh|...
 * One 160x90-level sheet (M0) is a ready-made flipbook atlas.
 */
async function resolveStoryboard(id: string): Promise<SbEntry> {
  const fail = (): SbEntry => {
    const entry = { at: Date.now(), sheetUrl: null, meta: null };
    sbCache.set(id, entry);
    return entry;
  };
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${id}`, {
      headers: YT_HEADERS,
    });
    if (!res.ok) return fail();
    const html = await res.text();
    const match = html.match(/"playerStoryboardSpecRenderer":\{"spec":"([^"]+)"/);
    if (!match) return fail();
    const spec = match[1].replace(/\\u0026/g, "&");
    const levels = spec.split("|");
    const base = levels.shift();
    if (!base || levels.length === 0) return fail();
    let levelIdx = levels.findIndex((l) => l.startsWith("160#"));
    if (levelIdx === -1) levelIdx = levels.length - 1;
    const [, , count, cols, rows, intervalMs, name, sigh] =
      levels[levelIdx].split("#");
    if (!sigh) return fail();
    const sheetUrl =
      base.replace("$L", String(levelIdx)).replace("$N", name.replace("$M", "0")) +
      "&sigh=" +
      sigh;
    const entry: SbEntry = {
      at: Date.now(),
      sheetUrl,
      meta: {
        cols: +cols,
        rows: +rows,
        frames: Math.min(+cols * +rows, +count),
        intervalMs: +intervalMs,
      },
    };
    sbCache.set(id, entry);
    return entry;
  } catch {
    return fail();
  }
}

const SNAPSHOT = snapshot as Record<
  string,
  { sheetUrl: string; meta: StoryboardMeta }
>;

export async function getStoryboardEntry(id: string): Promise<SbEntry> {
  const cached = sbCache.get(id);
  if (cached && isFresh(cached)) return cached;
  // Build-time snapshot first: watch pages are bot-walled from datacenter
  // IPs, so live resolution only stands a chance for videos published after
  // the last deploy (and in local dev).
  const snap = SNAPSHOT[id];
  if (snap) {
    const entry: SbEntry = {
      at: Date.now(),
      sheetUrl: snap.sheetUrl,
      meta: snap.meta,
    };
    sbCache.set(id, entry);
    return entry;
  }
  let pending = inFlight.get(id);
  if (!pending) {
    pending = resolveStoryboard(id).finally(() => inFlight.delete(id));
    inFlight.set(id, pending);
  }
  return pending;
}

/**
 * Resolve a bounded batch of missing storyboards (called from /api/videos so
 * the cache fills over a few client polls instead of blocking one request).
 */
export async function resolveSomeStoryboards(
  ids: string[],
  max = 8,
  budgetMs = 2500,
): Promise<void> {
  const missing = ids
    .filter((id) => {
      const entry = sbCache.get(id);
      return !entry || !isFresh(entry);
    })
    .slice(0, max);
  if (missing.length === 0) return;
  const deadline = Date.now() + budgetMs;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (missing.length > 0 && Date.now() < deadline) {
        const id = missing.shift();
        if (id) await getStoryboardEntry(id);
      }
    }),
  );
}
