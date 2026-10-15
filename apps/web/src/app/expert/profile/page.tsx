'use client';

import type { PublicExpert } from '@wtl/shared';
import { ExpertProfileForm } from '@/components/ExpertProfileForm';
import { PageTitle, QueryState } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@/lib/hooks';

export default function ExpertProfilePage() {
  const { user } = useAuth();
  const q = useQuery<PublicExpert>(user ? `/experts/${user.id}` : null);
  return (
    <>
      <PageTitle title="Hồ sơ chuyên gia" />
      <QueryState loading={q.loading} error={q.error} />
      {q.data && <ExpertProfileForm expert={q.data} endpoint="/experts/me" />}
    </>
  );
}
