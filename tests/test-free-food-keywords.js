import assert from "node:assert/strict";
import {
  checkFreeFood,
  getMatchedKeywords,
} from "../utils/freeFoodKeywords.js";

const text = "We will also be having catering!";

assert.equal(
  checkFreeFood(text),
  true,
  "Expected punctuation after 'catering' to still match as free food",
);

assert.deepEqual(
  getMatchedKeywords(text),
  ["catering"],
  "Expected the matched keyword list to include only 'catering'",
);

console.log("Free food keyword test passed.");
