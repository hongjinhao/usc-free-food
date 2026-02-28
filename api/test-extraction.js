/**
 * test-extraction.js
 * Run with: node api/test-extraction.js <html-file>
 * Example:  node api/test-extraction.js api/example2.html
 */

import { parse } from "node-html-parser";
import { readFileSync, writeFileSync } from "fs";
import {
  cleanEventDOM,
  extractNodeText,
  processDescriptionText,
} from "../utils/htmlParser.js";

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
  cleanEventDOM(eventDetailsCard);
  const rawText = extractNodeText(eventDetailsCard);
  description = processDescriptionText(rawText);
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
