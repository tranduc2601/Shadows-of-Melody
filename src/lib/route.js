export function getRouteParams() {
  const url = new URL(window.location.href);
  const pathname = url.pathname.replace(/\/$/, '') || '/';
  const segments = pathname.split('/').filter(Boolean);

  const params = {
    query: Object.fromEntries(url.searchParams.entries()),
    pathname,
    segments,
  };

  const readSegmentAfter = (name) => {
    const idx = segments.indexOf(name);
    return idx >= 0 ? segments[idx + 1] || null : null;
  };

  return {
    ...params,
    get(name, fallback = null) {
      return url.searchParams.get(name) ?? fallback;
    },
    getNumber(name, fallback = null) {
      const raw = url.searchParams.get(name);
      if (raw == null || raw === '') return fallback;
      const num = Number(raw);
      return Number.isFinite(num) ? num : fallback;
    },
    getPathParam(name, fallback = null) {
      if (!segments.length) return fallback;
      if (name === 'id') {
        for (let i = segments.length - 1; i >= 0; i--) {
          const seg = segments[i];
          if (seg && !['artist', 'artists', 'album', 'albums', 'search', 'songs', 'playlist'].includes(seg)) return seg;
        }
      }
      return readSegmentAfter(name) ?? fallback;
    },
  };
}
