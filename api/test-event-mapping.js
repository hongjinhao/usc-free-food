/**
 * test-event-mapping.js
 * Run with: node api/test-event-mapping.js <json-file>
 * Example:  node api/test-event-mapping.js api/example-event-item.json
 */

import { readFileSync, writeFileSync } from "fs";
import { extractAriaLabelsAsCategory, parseDate } from "../utils/htmlParser.js";
import { ENGAGE_API_BASE } from "../utils/engageClient.js";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node api/test-event-mapping.js <path-to-json-file>");
  process.exit(1);
}

const raw = JSON.parse(readFileSync(filePath, "utf8"));

// Replicate mapEventItem logic
const { p1, p3, p4, p6, p9, p10, p11, p18, p22 } = raw;
const { display: dates } = parseDate(p4);
const result = {
  id: p1,
  title: p3,
  dates,
  location: p6 || "Location TBA",
  imageUrl: p11 ? `${ENGAGE_API_BASE}${p11}` : null,
  organizer: p9 || "Unknown",
  category: extractAriaLabelsAsCategory(p22),
  detailUrl: `${ENGAGE_API_BASE}${p18}`,
  attendees: p10 || "0",
};

const outPath = filePath.replace(/\.json$/, "-mapping-output.md");
const md = `# Event Mapping Test: \`${filePath}\`

## Result

\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\`

## Raw Input (relevant fields)

\`\`\`json
${JSON.stringify({ p1, p3, p4, p6, p9, p10, p11, p18, p22 }, null, 2)}
\`\`\`
`;

writeFileSync(outPath, md);
console.log(`Output written to: ${outPath}`);
console.log("\n--- RESULT ---");
console.log(JSON.stringify(result, null, 2));
