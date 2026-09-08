// A photo for a searched place, from Wikimedia Commons — free and keyless, like
// the rest of the stack. Commons' geosearch returns photos geotagged near a
// coordinate, so a place doesn't need a Wikipedia article to have one.
//
// Two things this is careful about:
//   - Commons photos are CC-licensed and REQUIRE crediting the author + license,
//     so every result carries a `credit` string the UI must show.
//   - Coverage is partial and the nearest photo isn't always the right subject,
//     so the caller keeps its icon fallback and this only ever *offers* a photo.

export interface PlacePhoto {
  url: string;
  credit: string; // "Author / License" — must be displayed with the image
  sourceUrl: string; // the Commons file page
}

const ENDPOINT = 'https://commons.wikimedia.org/w/api.php';
const UA = 'chirpy-travel-companion/0.1 (Expo)';

// One lookup per place is plenty; cache by rounded coordinate (~11m) and cache
// misses too, so a photo-less place isn't queried again every time it's opened.
const cache = new Map<string, PlacePhoto | null>();
const keyOf = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

function stripHtml(s: string | undefined): string {
  return s ? String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
}

export async function fetchPlacePhoto(lat: number, lng: number): Promise<PlacePhoto | null> {
  const key = keyOf(lat, lng);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const url =
    `${ENDPOINT}?action=query&format=json&formatversion=2&origin=*` +
    `&generator=geosearch&ggsnamespace=6&ggscoord=${lat}%7C${lng}&ggsradius=1000&ggslimit=8` +
    `&prop=imageinfo&iiprop=url%7Cmime%7Cextmetadata&iiurlwidth=800`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`commons ${res.status}`);
    const json = await res.json();
    const pages: any[] = json?.query?.pages ?? [];
    // geosearch returns nearest-first via `index`; take the closest real photo.
    const photo = pages
      .filter((p) => p.imageinfo && /image\/(jpe?g|png)/i.test(p.imageinfo[0].mime))
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))[0];

    if (!photo) {
      cache.set(key, null);
      return null;
    }
    const ii = photo.imageinfo[0];
    const meta = ii.extmetadata ?? {};
    const artist = stripHtml(meta.Artist?.value) || 'Wikimedia Commons';
    const license = stripHtml(meta.LicenseShortName?.value);
    const result: PlacePhoto = {
      url: ii.thumburl ?? ii.url,
      credit: license ? `${artist} / ${license}` : artist,
      sourceUrl: ii.descriptionurl ?? 'https://commons.wikimedia.org',
    };
    cache.set(key, result);
    return result;
  } catch {
    // A failed lookup isn't cached — a later attempt (back online) can succeed.
    return null;
  }
}
