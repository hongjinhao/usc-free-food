/**
 * Keywords used to detect free food mentions in event descriptions.
 *
 * Guidelines for adding keywords:
 * - Be specific to avoid false positives
 * - Include common variations and misspellings
 * - Group by category for easier maintenance
 *
 * Last updated: 2024-01-XX
 */

export const freeFoodKeywords = [
    // Explicit "free" phrases - HIGH CONFIDENCE
    "free food",
    "free pizza",
    "free lunch",
    "free dinner",
    "free breakfast",
    "free snacks",
    "free refreshments",
    "free drinks",
    "free beverages",
    "free coffee",
    "free tea",
    "free boba",
    "free bubble tea",

    // Specific free items
    "free cookies",
    "free dessert",
    "free ice cream",
    "free gelato",
    "free pastries",
    "free donuts",
    "free bagels",
    "free cupcakes",
    "free brownies",

    // Free meals
    "free sandwiches",
    "free subs",
    "free burritos",
    "free tacos",
    "free wings",
    "free bbq",
    "free ramen",
    "free sushi",

    // "Provided/served" phrasing - MEDIUM CONFIDENCE
    "food provided",
    "snacks provided",
    "drinks provided",
    "refreshments provided",
    "meal provided",
    "lunch provided",
    "dinner provided",
    "breakfast provided",
    "pizza provided",

    "food will be served",
    "refreshments will be served",
    "snacks will be served",
    "drinks will be served",

    // Complimentary/catering - MEDIUM CONFIDENCE
    "complimentary food",
    "complimentary meal",
    "complimentary refreshments",
    "complimentary snacks",
    "catering provided",
    "catered event",

    // Light food terms - LOW CONFIDENCE (watch for false positives)
    "light refreshments",
    "appetizers provided",
    "hors d'oeuvres",

    // WARNING: These may cause false positives - use with caution
    "treats",
    "bites",
    "munchies",
    "food",
    "snacks",
    "drinks",
];

/**
 * Check if text contains any free food keywords
 * @param {string} text - Text to search (will be lowercased)
 * @returns {boolean} - True if any keyword is found
 */
export function checkFreeFood(text) {
    const lowerText = text.toLowerCase();
    return freeFoodKeywords.some((keyword) => lowerText.includes(keyword));
}

/**
 * Get all matching keywords from text (useful for debugging)
 * @param {string} text - Text to search
 * @returns {string[]} - Array of matched keywords
 */
export function getMatchedKeywords(text) {
    const lowerText = text.toLowerCase();
    return freeFoodKeywords.filter((keyword) => lowerText.includes(keyword));
}
