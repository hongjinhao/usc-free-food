/**
 * test-extraction.js
 * Run with: node api/test-extraction.js <html-file>
 * Example:  node api/test-extraction.js api/example2.html
 */

import { parse } from "node-html-parser";
import { readFileSync, writeFileSync } from "fs";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node api/test-extraction.js <path-to-html-file>");
  process.exit(1);
}

const html = readFileSync(filePath, "utf8");
const root = parse(html);

// Support both full pages (#event_details .card-block) and bare card-block snippets
const eventDetailsCard =
  root.querySelector("#event_details .card-block") ||
  root.querySelector(".card-block");

let description = "No description available";

if (eventDetailsCard) {
  // Remove title and decorative border
  eventDetailsCard.querySelector(".card-block__title")?.remove();
  eventDetailsCard.querySelector(".card-border")?.remove();

  // Remove "Copy Link" button wrappers
  eventDetailsCard
    .querySelectorAll('a[aria-label*="Copy link"]')
    .forEach((el) => el.parentNode?.remove());

  // Remove all buttons and btn-class links
  eventDetailsCard
    .querySelectorAll("a.btn, button")
    .forEach((el) => el.remove());

  // Remove flyer images and their wrappers
  eventDetailsCard
    .querySelectorAll("img, .text-center")
    .forEach((el) => el.remove());

  // Walk the node tree: trim text nodes, join block children with newlines
  const BLOCK_TAGS = new Set([
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

  function extractText(node) {
    if (node.nodeType === 3) {
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
      .map(extractText)
      .filter((s) => s.length > 0);
    // Top-level block elements are separated by a blank line (\n\n);
    // nested blocks use a single newline
    const sep = isBlock ? "\n\n" : " ";
    return parts.join(sep).trim();
  }

  description = extractText(eventDetailsCard)
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n") // collapse 3+ newlines to a blank line
    // Decode common HTML entities left over after text extraction
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .trim();
}

// Write markdown output
const outPath = filePath.replace(/\.html$/, "-extraction-output.md");
const md = `# Extraction Test: \`${filePath}\`

## Result

\`\`\`
${description}
\`\`\`

## Raw (JSON-escaped to show whitespace characters)

\`\`\`json
${JSON.stringify(description)}
\`\`\`
`;

writeFileSync(outPath, md);
console.log(`Output written to: ${outPath}`);
console.log("\n--- RESULT ---\n" + description);
