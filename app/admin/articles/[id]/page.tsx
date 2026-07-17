import { ArticleEditor } from "@/components/cms/ArticleEditor";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditArticlePage({ params }: PageProps) {
  const { id } = await params;
  return <ArticleEditor articleId={id} />;
}
