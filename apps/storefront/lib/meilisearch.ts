import { MeiliSearch } from "meilisearch";

export const searchClient = new MeiliSearch({
  host:
    process.env.NEXT_PUBLIC_MEILISEARCH_HOST ||
    "https://search.ringsidesports.com.au",
  apiKey:
    process.env.NEXT_PUBLIC_MEILISEARCH_API_KEY ||
    "ringsidesports-meili-key",
});

export const PRODUCTS_INDEX = "products";
