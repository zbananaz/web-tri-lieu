'use client';

import { type Appointment, AppointmentList } from '@/components/Appointments';
import { PageTitle, QueryState } from '@/components/ui';
import { useQuery } from '@/lib/hooks';

export default function ExpertAppointmentsPage() {
  const q = useQuery<{ appointments: Appointment[] }>('/appointments');
  return (
    <>
      <PageTitle title="Lịch hẹn" />
      <QueryState loading={q.loading} error={q.error} />
      {q.data && <AppointmentList items={q.data.appointments} role="expert" onChanged={() => void q.reload()} />}
    </>
  );
}
