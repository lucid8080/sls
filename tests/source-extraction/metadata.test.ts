import { describe, expect, it } from "vitest";
import { extractSourceMetadata } from "@/lib/integrations/source-extraction/extract-metadata";
import { extractReadableText } from "@/lib/integrations/source-extraction/extract-readable-text";

describe("source metadata extraction", () => {
  it("extracts bounded Open Graph, canonical, author, date, and readable text", () => {
    const metadata = extractSourceMetadata({
      requestedUrl: "https://example.com/redirect",
      finalUrl: "https://example.com/guides/robot-vacuum",
      status: 200,
      contentType: "text/html",
      redirectCount: 1,
      body: `
        <html>
          <head>
            <title>Fallback title</title>
            <meta property="og:title" content="Robot Vacuum Care &amp; Maintenance">
            <meta name="description" content="A practical guide.">
            <meta property="og:image" content="/images/robot.jpg">
            <meta name="author" content="Alex Editor">
            <meta property="article:published_time" content="2026-06-01T12:00:00Z">
            <link rel="canonical" href="/robot-vacuum-care">
            <script>stealCookies()</script>
          </head>
          <body>
            <nav>Skip this navigation</nav>
            <main><h1>Robot care</h1><p>Clean the filter &amp; inspect the brush.</p></main>
            <footer>Skip this footer</footer>
          </body>
        </html>
      `,
    });

    expect(metadata.pageTitle).toBe("Robot Vacuum Care & Maintenance");
    expect(metadata.pageDescription).toBe("A practical guide.");
    expect(metadata.authorName).toBe("Alex Editor");
    expect(metadata.thumbnailUrl).toBe(
      "https://example.com/images/robot.jpg",
    );
    expect(metadata.canonicalUrl).toBe(
      "https://example.com/robot-vacuum-care",
    );
    expect(metadata.publishedAt).toBe("2026-06-01T12:00:00.000Z");
    expect(metadata.extractedText).toContain(
      "Clean the filter & inspect the brush.",
    );
    expect(metadata.extractedText).not.toContain("stealCookies");
    expect(metadata.extractedText).not.toContain("Skip this navigation");
  });

  it("does not preserve unsafe metadata URL schemes", () => {
    const metadata = extractSourceMetadata({
      requestedUrl: "https://example.com",
      finalUrl: "https://example.com",
      status: 200,
      contentType: "text/html",
      redirectCount: 0,
      body: `
        <meta property="og:image" content="javascript:alert(1)">
        <link rel="canonical" href="file:///etc/passwd">
        <main>Useful source text.</main>
      `,
    });
    expect(metadata.thumbnailUrl).toBeUndefined();
    expect(metadata.canonicalUrl).toBeUndefined();
  });

  it("bounds extracted text", () => {
    expect(extractReadableText(`<main>${"word ".repeat(100)}</main>`, 40)).toHaveLength(
      40,
    );
  });
});
