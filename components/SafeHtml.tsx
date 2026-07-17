import { ProductComparisonTable } from "@/components/ProductComparisonTable";
import { SpecChart } from "@/components/SpecChart";
import { injectInContentAds } from "@/lib/ads/in-content";
import type { AdSettings } from "@/lib/ads/types";
import { enhanceArticleHtml } from "@/lib/article-enhance";
import { addHeadingIds } from "@/lib/content";
import { normalizeArticleHtmlEntities } from "@/lib/html";
import { rewriteMediaAndEmbeds } from "@/lib/media";
import { splitProductDisplaySegments } from "@/lib/product-displays";

type SafeHtmlProps = {
  html: string;
  injectAds?: boolean;
  adSettings?: AdSettings;
};

export function SafeHtml({ html, injectAds = false, adSettings }: SafeHtmlProps) {
  const segments = splitProductDisplaySegments(normalizeArticleHtmlEntities(html));

  return (
    <div className="article-body">
      {segments.map((segment, index) => {
        if (segment.type === "html") {
          let renderedHtml = rewriteMediaAndEmbeds(addHeadingIds(enhanceArticleHtml(segment.html)));
          if (injectAds) {
            renderedHtml = injectInContentAds(renderedHtml, adSettings);
          }
          if (!renderedHtml.trim()) {
            return null;
          }
          return (
            <div
              key={`html-${index}`}
              className="article-html-segment"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          );
        }

        if (segment.type === "tablepress") {
          return <SpecChart key={`tablepress-${segment.id}-${index}`} tableId={segment.id} />;
        }

        return <ProductComparisonTable key={`aawp-${segment.id}-${index}`} tableId={segment.id} />;
      })}
    </div>
  );
}
