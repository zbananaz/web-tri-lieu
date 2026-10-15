import { ArticleEditor } from '@/components/ArticleEditor';
import { PageTitle } from '@/components/ui';

export default function NewArticlePage() {
  return (
    <>
      <PageTitle title="Viết bài mới" />
      <ArticleEditor />
    </>
  );
}
