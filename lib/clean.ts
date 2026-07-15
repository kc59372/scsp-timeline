/**
 * Plain-text cleaning for scraped copy.
 *
 * Scraped .mil/.gov RSS/JSON descriptions arrive full of HTML — <img> tags,
 * <a> links, <br />, and undecoded entities (&rsquo;, &ndash;, &#39;) — none of
 * which belong on a policymaker-facing card. This turns that markup into clean,
 * readable prose. Kept dependency-free (pure regex + a small entity table) so
 * it runs identically server-side (lib/ingest.ts) and in the browser
 * (display components).
 */

// Named HTML entities that actually show up in DoD/DARPA feeds. Numeric
// entities (&#39; / &#x2019;) are handled generically below.
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  ccedil: "ç",
  ouml: "ö",
  uuml: "ü",
  auml: "ä",
  deg: "°",
  frac12: "½",
  trade: "™",
  reg: "®",
  copy: "©",
  bull: "•",
  middot: "·",
  euro: "€",
  pound: "£",
  cent: "¢",
  times: "×",
  hyphen: "-",
  ensp: " ",
  emsp: " ",
  thinsp: " ",
};

/** Decode named + numeric HTML entities. */
function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : whole;
    }
    const mapped = NAMED_ENTITIES[body.toLowerCase()];
    return mapped ?? whole;
  });
}

/**
 * Strip all HTML and links from a scraped string and normalize whitespace.
 *
 *  - <br>/<p>/<li>/<div> become spaces so words don't run together;
 *  - <img>, <a>, and every other tag are removed (the alt text of an image is
 *    dropped along with the tag — it's not part of the story);
 *  - HTML entities are decoded to real characters;
 *  - bare URLs left in the prose are removed ("remove all links");
 *  - runs of whitespace collapse to single spaces.
 */
export function cleanText(input: string | null | undefined): string {
  if (!input) return "";
  let s = input;

  // Drop <img> and <a>…</a> entirely (including inner text of anchors — it's
  // usually the URL or "click here", not narrative).
  s = s.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, " ");
  s = s.replace(/<img\b[^>]*>/gi, " ");

  // Turn block-level boundaries into spaces before stripping the rest.
  s = s.replace(/<(?:br|p|div|li|ul|ol|tr|td|h[1-6])\b[^>]*>/gi, " ");
  s = s.replace(/<\/(?:p|div|li|ul|ol|tr|td|h[1-6])>/gi, " ");

  // Remove every remaining tag.
  s = s.replace(/<[^>]+>/g, " ");

  s = decodeEntities(s);

  // Remove bare URLs and leftover empty markdown link brackets.
  s = s.replace(/\bhttps?:\/\/\S+/gi, " ");
  s = s.replace(/\bwww\.\S+/gi, " ");

  // Collapse whitespace (incl. the newlines feeds embed) to single spaces.
  s = s.replace(/\s+/g, " ").trim();

  return s;
}
