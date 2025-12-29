import type { LocalNewsArticle } from "@/types/news";

// Deduplication settings
const SIMILARITY_THRESHOLD = 0.50; // 50% word overlap = duplicate (lowered to catch rephrased wire stories)

// Wire services and aggregators (lower priority - prefer local sources)
const WIRE_SERVICE_PATTERNS = [
  "associated press", "ap news", "reuters", "afp",
  "upi", "bloomberg", "u.s. news", "us news",
  "yahoo", "msn", "aol", "google news", "wtop",
  "bangor daily", "world report",
];

// Local source indicators (higher priority)
const LOCAL_SOURCE_PATTERNS = [
  "tribune", "times", "herald", "gazette", "chronicle",
  "journal", "register", "observer", "examiner", "post",
  "daily", "weekly", "sun", "star", "democrat",
  "republican", "courier", "dispatch", "sentinel",
];

/**
 * Normalize a title for comparison by:
 * - Converting to lowercase
 * - Removing wire service tags like (AP), (Reuters), etc.
 * - Stripping punctuation except hyphens between words
 * - Collapsing whitespace
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*\([^)]*(?:ap|reuters|afp|upi|bloomberg)[^)]*\)\s*/gi, " ")
    .replace(/^(?:ap|reuters|afp|upi|bloomberg)\s*:\s*/gi, "")
    .replace(/\s*[-|]\s*(?:ap|reuters|afp|upi|bloomberg)\s*$/gi, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract significant words from a normalized title.
 * Filters out common stop words.
 */
function extractSignificantWords(normalizedTitle: string): Set<string> {
  const stopWords = new Set([
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
    "be", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "must", "shall", "can", "need",
    "it", "its", "this", "that", "these", "those", "he", "she", "they",
    "we", "you", "i", "my", "your", "his", "her", "their", "our",
    "what", "which", "who", "whom", "when", "where", "why", "how",
    "all", "each", "every", "both", "few", "more", "most", "other",
    "some", "such", "no", "nor", "not", "only", "own", "same", "so",
    "than", "too", "very", "just", "also", "now", "new", "says", "said",
  ]);

  const words = normalizedTitle.split(/\s+/).filter(word =>
    word.length > 2 && !stopWords.has(word)
  );

  return new Set(words);
}

/**
 * Calculate Jaccard similarity between two sets of words.
 */
function calculateSimilarity(words1: Set<string>, words2: Set<string>): number {
  if (words1.size === 0 || words2.size === 0) {
    return 0;
  }

  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Calculate source priority score. Higher = better (more local).
 */
function getSourcePriority(sourceName: string): number {
  const lowerSource = sourceName.toLowerCase();

  const isWireService = WIRE_SERVICE_PATTERNS.some(pattern =>
    lowerSource.includes(pattern)
  );
  if (isWireService) {
    return 0;
  }

  const isLocalSource = LOCAL_SOURCE_PATTERNS.some(pattern =>
    lowerSource.includes(pattern)
  );
  if (isLocalSource) {
    return 2;
  }

  return 1;
}

/**
 * Deduplicate articles based on title similarity.
 * When duplicates are found, keeps the one from the most local source.
 */
export function deduplicateArticles(
  articles: LocalNewsArticle[],
  debug: boolean = false
): {
  articles: LocalNewsArticle[];
  duplicatesRemoved: number;
} {
  if (articles.length <= 1) {
    return { articles, duplicatesRemoved: 0 };
  }

  if (debug) {
    console.log("[DEDUPE] Starting deduplication of", articles.length, "articles");
  }

  const articleData = articles.map((article, index) => {
    const normalized = normalizeTitle(article.title);
    const words = extractSignificantWords(normalized);
    const priority = getSourcePriority(article.source);

    if (debug) {
      console.log("[DEDUPE] Article " + index + ": " + words.size + " words, priority: " + priority + ", source: " + article.source);
    }

    return { article, index, normalized, words, priority };
  });

  const keepIndices = new Set<number>();
  const processed = new Set<number>();

  for (let i = 0; i < articleData.length; i++) {
    if (processed.has(i)) continue;

    const current = articleData[i];
    const duplicateGroup: typeof articleData = [current];
    processed.add(i);

    for (let j = i + 1; j < articleData.length; j++) {
      if (processed.has(j)) continue;

      const candidate = articleData[j];
      const similarity = calculateSimilarity(current.words, candidate.words);

      if (similarity >= SIMILARITY_THRESHOLD) {
        if (debug) {
          console.log("[DEDUPE] DUPLICATE: " + (similarity * 100).toFixed(1) + "% match");
          console.log("[DEDUPE]   " + current.article.source + ": " + current.article.title.substring(0, 50));
          console.log("[DEDUPE]   " + candidate.article.source + ": " + candidate.article.title.substring(0, 50));
        }
        duplicateGroup.push(candidate);
        processed.add(j);
      }
    }

    const best = duplicateGroup.reduce((a, b) => b.priority > a.priority ? b : a);

    if (duplicateGroup.length > 1 && debug) {
      console.log("[DEDUPE] Keeping: " + best.article.source + " (priority " + best.priority + ")");
    }

    keepIndices.add(best.index);
  }

  const dedupedArticles = articleData
    .filter(data => keepIndices.has(data.index))
    .sort((a, b) => a.index - b.index)
    .map(data => data.article);

  const duplicatesRemoved = articles.length - dedupedArticles.length;

  if (debug) {
    console.log("[DEDUPE] Complete: " + articles.length + " -> " + dedupedArticles.length + " (" + duplicatesRemoved + " removed)");
  }

  return { articles: dedupedArticles, duplicatesRemoved };
}
