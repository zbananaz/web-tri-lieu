'use client';

import { CASE_STATUS_LABELS, CASE_TRANSITIONS, type CaseStatus, type Role } from '@wtl/shared';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { Alert, Button, Card, TextArea } from './ui';

const ACTION_LABEL: Partial<Record<`${CaseStatus}>${CaseStatus}`, string>> = {
  'assigned>contacted': 'Đã liên hệ khách',
  'assigned>approved': 'Từ chối ca này',
  'contacted>in_treatment': 'Bắt đầu trị liệu',
  'contacted>closed': 'Kết thúc ca',
  'in_treatment>closed': 'Kết thúc ca',
};

/** Cac buoc chuyen trang thai ma vai tro hien tai duoc phep (nguon: @wtl/shared; may chu van kiem tra lai). */
export function allowedTargets(status: CaseStatus, role: Role): CaseStatus[] {
  return CASE_TRANSITIONS[status].filter((r) => r.roles.includes(role)).map((r) => r.to);
}

export function TransitionPanel({
  caseId,
  status,
  role,
  exclude = [],
  onDone,
}: {
  caseId: string;
  status: CaseStatus;
  role: Role;
  exclude?: CaseStatus[];
  onDone: () => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const targets = allowedTargets(status, role).filter((t) => !exclude.includes(t));
  if (targets.length === 0) return null;

  const go = async (to: CaseStatus) => {
    if ((to === 'closed' || to === 'approved' || to === 'rejected') && !window.confirm('Bạn chắc chắn thực hiện thao tác này?')) return;
    setBusy(to);
    setError(null);
    try {
      await api(`/cases/${caseId}/transition`, { body: { to, ...(note.trim() ? { note: note.trim() } : {}) } });
      setNote('');
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="space-y-3">
      <h3 className="font-semibold">Cập nhật trạng thái</h3>
      <TextArea label="Ghi chú (không bắt buộc)" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <Alert>{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {targets.map((t) => (
          <Button
            key={t}
            variant={t === 'rejected' || t === 'closed' ? 'secondary' : 'primary'}
            loading={busy === t}
            onClick={() => go(t)}
          >
            {ACTION_LABEL[`${status}>${t}`] ?? CASE_STATUS_LABELS[t]}
          </Button>
        ))}
      </div>
    </Card>
  );
}
