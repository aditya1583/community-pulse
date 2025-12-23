export type LocalNewsArticle = {
  title: string;
  source: string;
  publishedAt: string;
  url: string;
  description: string | null;
  urlToImage: string | null;
  _fallbackSource?: string;
};

export type LocalNewsSummary = {
  paragraph: string;
  bulletPoints: string[];
};

export type LocalNewsResponse = {
  articles: LocalNewsArticle[];
  aiSummary: LocalNewsSummary | null;
  city: string;
  sourceCity: string;
  fallbackSources: string[];
  isNearbyFallback: boolean;
  fetchedAt: string;
  notConfigured?: boolean;
  provider?: "gnews" | "newsapi";
};
