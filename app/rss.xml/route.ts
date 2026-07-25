import { buildPublicSeoArtifacts } from "@/lib/seo/public-artifacts";

export async function GET() {
  const { rssXml } = await buildPublicSeoArtifacts();
  return new Response(rssXml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate",
    },
  });
}
