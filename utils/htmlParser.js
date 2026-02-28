import { parse } from "node-html-parser";

export const BLOCK_TAGS = new Set([
  "div",
  "p",
  "br",
  "li",
  "tr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);

/**
 * Clean a single label string.
 * e.g. "Lecture slash Presentation" -> "Lecture / Presentation"
 */
function cleanLabel(label) {
  return label
    .replace(/\s+slash\s+/gi, " / ")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts aria-label values from p22 HTML (event category tags).
 * Returns a deduplicated, slash-separated string.
 */
export function extractAriaLabelsAsCategory(html) {
  if (!html || typeof html !== "string") return "";

  const root = parse(html);
  const elements = root.querySelectorAll("[aria-label]");

  const labels = elements
    .map((el) => (el.getAttribute("aria-label") || "").trim())
    .filter(Boolean)
    .map(cleanLabel);

  // remove duplicates (case-insensitive) while preserving order
  const unique = [];
  const seen = new Set();
  for (const l of labels) {
    const key = l.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(l);
    }
  }

  return unique.join(" / ");
}

/**
 * Decodes common HTML entities in a string.
 */
export function decodeHtmlEntities(str) {
  if (!str || typeof str !== "string") return "";

  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

/**
 * Formats a Date object into a human-readable event date string.
 */
export function formatEventDate(date) {
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Extracts and normalizes date text from the p4 HTML field in the events list API.
 */
export function parseDateInfoFromHtml(html) {
  if (!html || typeof html !== "string") return "";

  // Decode entities first (so &ndash; becomes –)
  const decoded = decodeHtmlEntities(html);
  const root = parse(decoded);

  // Join all <p> lines (some responses wrap the same date across multiple <p>)
  const paragraphs = root.querySelectorAll("p");

  const text =
    paragraphs.length > 0
      ? paragraphs
          .map((p) => p.text.trim())
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()
      : root.text.replace(/\s+/g, " ").trim();

  return text.replace(/\s*[–-]\s*$/, "").trim();
}

/**
 * Parses event date HTML into a { date, display } object.
 */
export function parseEngageSingleDate(html) {
  const cleaned = parseDateInfoFromHtml(html);

  const d = cleaned ? new Date(cleaned) : null;
  const valid = d instanceof Date && !isNaN(d);

  const display = valid ? formatEventDate(d) : cleaned;

  return { date: valid ? d : null, display };
}

/**
 * Removes non-content elements from an event detail card DOM node (mutates in place).
 */
export function cleanEventDOM(card) {
  const title = card.querySelector(".card-block__title");
  const border = card.querySelector(".card-border");
  if (title) title.remove();
  if (border) border.remove();

  // Remove "Copy Link" buttons and their parent divs
  card.querySelectorAll('a[aria-label*="Copy link"]').forEach((el) => {
    const parent = el.parentNode;
    if (parent) parent.remove();
  });

  // Remove all buttons and links with btn class
  card.querySelectorAll("a.btn, button").forEach((el) => el.remove());

  // Remove image wrappers (flyer images add no text value)
  card.querySelectorAll("img, .text-center").forEach((el) => el.remove());
}

/**
 * Recursively walks a DOM node tree and extracts plain text,
 * preserving block-level newlines.
 */
export function extractNodeText(node) {
  if (node.nodeType === 3) {
    // Trim each text node so bare whitespace nodes produce nothing
    return node.rawText
      .replace(/\u00A0/g, " ")
      .replace(/[ \t]+/g, " ")
      .trim();
  }
  const tag = (node.rawTagName || "").toLowerCase();
  // <br> emits a bare newline so consecutive <br><br> produces \n\n
  if (tag === "br") return "\n";
  const isBlock = BLOCK_TAGS.has(tag);
  const parts = (node.childNodes || [])
    .map(extractNodeText)
    .filter((s) => s.length > 0);
  // Top-level block elements are separated by a blank line (\n\n);
  // nested blocks use a single newline
  const sep = isBlock ? "\n\n" : " ";
  return parts.join(sep).trim();
}

/**
 * Normalizes extracted raw text: collapses whitespace and decodes HTML entities.
 */
export function processDescriptionText(rawText) {
  return (
    rawText
      .replace(/[ \t]+/g, " ") // collapse runs of spaces/tabs
      .replace(/[ \t]*\n[ \t]*/g, "\n") // trim spaces around newlines
      .replace(/\n{3,}/g, "\n\n") // collapse 3+ newlines to a blank line
      // Decode HTML entities
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&ndash;/g, "\u2013")
      .replace(/&mdash;/g, "\u2014")
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16)),
      )
      .trim()
  );
}
