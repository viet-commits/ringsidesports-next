import { NextRequest, NextResponse } from "next/server";
import { searchClient, PRODUCTS_INDEX } from "@/lib/meilisearch";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

  try {
    const index = searchClient.index(PRODUCTS_INDEX);

    const searchResult = await index.search(query, {
      page,
      hitsPerPage: limit,
      facets: ["categories", "tags", "productType", "stockStatus"],
    });

    return NextResponse.json({
      query,
      page,
      limit,
      totalHits: searchResult.estimatedTotalHits || 0,
      totalPages: Math.ceil(
        (searchResult.estimatedTotalHits || 0) / limit
      ),
      hits: searchResult.hits,
      facets: searchResult.facetDistribution,
      processingTimeMs: searchResult.processingTimeMs,
    });
  } catch (error) {
    console.error("Search error:", error);
    const message =
      error instanceof Error ? error.message : "Search failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
