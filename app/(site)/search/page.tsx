import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchClient } from "@/components/SearchClient";
import { getSearchIndex } from "@/lib/search-index-server";

export const metadata: Metadata = {
  title: "Search",
  description: "Search recovered Simple Life Saver guides.",
};

export default async function SearchPage() {
  const index = await getSearchIndex();

  return (
    <main id="main">
      <Suspense
        fallback={
          <section className="archive-header">
            <p className="eyebrow">Search</p>
            <h1>Find practical guides</h1>
          </section>
        }
      >
        <SearchClient index={index} />
      </Suspense>
    </main>
  );
}
