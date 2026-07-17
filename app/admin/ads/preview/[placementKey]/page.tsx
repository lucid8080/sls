import Link from "next/link";
import { notFound } from "next/navigation";
import { MockAd } from "@/components/ads/MockAd";
import { getPlacementByKey } from "@/lib/ads/placements";

type PageProps = {
  params: Promise<{ placementKey: string }>;
};

function PreviewArticleShell({ placementKey }: { placementKey: string }) {
  const placement = getPlacementByKey(placementKey);
  if (!placement) {
    return null;
  }

  const isSidebar = placement.location === "sidebar_rail" || placement.location === "sidebar_rail_secondary";
  const isAfterArticle = placement.location === "after_article";
  const isInContent = placement.location === "in_content";

  return (
    <div className="mock-article-page">
      <header className="mock-article-header">
        <p className="mock-article-eyebrow">Smart Cleaning</p>
        <h1>Sample article layout for placement preview</h1>
        <p className="mock-article-meta">Victoria Parkley · 8 min read</p>
      </header>

      <div className={`mock-article-shell${isSidebar ? " mock-article-shell--with-rail" : ""}`}>
        <div className="mock-article-body">
          <p>
            This wireframe mirrors the public article page. Paragraph one introduces the guide and shows how the opening
            content flows before the first in-content slot.
          </p>
          <p>Paragraph two continues with practical context and keeps the reader moving through the intro.</p>
          <p>Paragraph three is where the legacy under-first-paragraph ad typically appears on long guides.</p>

          {isInContent && placement.afterParagraph && placement.afterParagraph <= 3 ? (
            <div className="mock-placement-anchor">
              <MockAd placementKey={placementKey} highlighted />
            </div>
          ) : null}

          <p>Paragraph four adds more detail about tools, materials, or the problem being solved.</p>
          <p>Paragraph five expands with step-by-step guidance and scannable tips.</p>
          <p>Paragraph six is another common in-content breakpoint on the recovered WordPress map.</p>

          {isInContent && placement.afterParagraph && placement.afterParagraph > 3 && placement.afterParagraph <= 6 ? (
            <div className="mock-placement-anchor">
              <MockAd placementKey={placementKey} highlighted />
            </div>
          ) : null}

          <p>Paragraph seven through nine continue the article body for longer guides.</p>
          <p>Paragraph eight includes a comparison note or troubleshooting advice.</p>
          <p>Paragraph nine is the mid-content breakpoint used by the old Ezoic configuration.</p>

          {isInContent && placement.afterParagraph && placement.afterParagraph > 6 ? (
            <div className="mock-placement-anchor">
              <MockAd placementKey={placementKey} highlighted />
            </div>
          ) : null}
        </div>

        {isSidebar ? (
          <aside className="mock-article-rail">
            <div className="mock-rail-block">
              <p>In this guide</p>
              <ol>
                <li>Why it matters</li>
                <li>What you need</li>
                <li>Step-by-step</li>
              </ol>
            </div>
            <div className="mock-placement-anchor">
              {placement.location === "sidebar_rail" ? (
                <MockAd placementKey={placementKey} highlighted />
              ) : (
                <MockAd placementKey="sidebar_primary" />
              )}
            </div>
            <div className="mock-rail-block">
              <p>Trending</p>
              <ol>
                <li>Robot vacuum maintenance</li>
                <li>Best steam mop pads</li>
              </ol>
            </div>
            <div className="mock-placement-anchor">
              {placement.location === "sidebar_rail_secondary" ? (
                <MockAd placementKey={placementKey} highlighted />
              ) : (
                <MockAd placementKey="sidebar_bottom" />
              )}
            </div>
          </aside>
        ) : null}
      </div>

      {isAfterArticle ? (
        <div className="mock-placement-anchor mock-placement-anchor--wide">
          <MockAd placementKey={placementKey} highlighted />
        </div>
      ) : null}

      <div className="mock-article-share">Share · Facebook · X · Email</div>
    </div>
  );
}

export default async function AdminAdPreviewPage({ params }: PageProps) {
  const { placementKey } = await params;
  const placement = getPlacementByKey(placementKey);

  if (!placement) {
    notFound();
  }

  return (
    <div className="admin-grid">
      <section className="admin-card">
        <div className="admin-ads-header">
          <div>
            <p className="admin-preview-kicker">Mock ad preview</p>
            <h1>{placement.label}</h1>
            <p>
              Ezoic placeholder <strong>{placement.ezoicId}</strong> · {placement.description}
            </p>
          </div>
          <Link className="admin-button secondary" href="/admin/ads">
            Back to ad manager
          </Link>
        </div>
      </section>

      <section className="admin-card admin-preview-canvas">
        <PreviewArticleShell placementKey={placementKey} />
      </section>
    </div>
  );
}
