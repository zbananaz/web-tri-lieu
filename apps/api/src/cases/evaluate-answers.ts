import { BadRequestException } from '@nestjs/common';
import type { AnswerSnapshot, RiskLevel, SubmitScreeningInput } from '@wtl/shared';
import type { QuestionRow } from './screening.service.js';

const RISK_RANK: Record<RiskLevel, number> = { none: 0, elevated: 1, urgent: 2 };

export interface EvaluatedAnswers {
  snapshot: AnswerSnapshot[];
  riskLevel: RiskLevel;
}

/**
 * Doi chieu cau tra loi voi bo cau hoi dang hoat dong: kiem tra bat buoc, lua chon hop le,
 * chup lai noi dung cau hoi va tinh muc nguy co cao nhat tu cac dap an da chon.
 */
export function evaluateAnswers(questions: QuestionRow[], input: SubmitScreeningInput): EvaluatedAnswers {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const given = new Map<string, string | string[]>();
  for (const a of input.answers) {
    if (!byId.has(a.questionId)) throw new BadRequestException('Có câu trả lời cho câu hỏi không tồn tại');
    if (given.has(a.questionId)) throw new BadRequestException('Một câu hỏi bị trả lời nhiều lần');
    given.set(a.questionId, a.value);
  }

  const snapshot: AnswerSnapshot[] = [];
  let riskLevel: RiskLevel = 'none';

  for (const q of questions) {
    const raw = given.get(q.id);
    const missing = raw === undefined || (typeof raw === 'string' && raw.trim() === '') || (Array.isArray(raw) && raw.length === 0);
    if (missing) {
      if (q.required) throw new BadRequestException(`Vui lòng trả lời câu hỏi: ${q.prompt}`);
      continue;
    }

    if (q.type === 'text') {
      if (typeof raw !== 'string') throw new BadRequestException('Câu trả lời dạng văn bản không hợp lệ');
      snapshot.push({ questionId: q.id, prompt: q.prompt, type: q.type, values: [], labels: [], text: raw.trim(), specialties: [] });
      continue;
    }

    const values = Array.isArray(raw) ? raw : [raw as string];
    if (q.type === 'single' && values.length !== 1) throw new BadRequestException('Câu hỏi này chỉ được chọn một đáp án');
    const chosen = values.map((v) => {
      const opt = q.options.find((o) => o.value === v);
      if (!opt) throw new BadRequestException('Đáp án không hợp lệ');
      return opt;
    });
    if (new Set(values).size !== values.length) throw new BadRequestException('Đáp án bị chọn trùng');

    let risk: 'elevated' | 'urgent' | undefined;
    for (const o of chosen) {
      if (o.risk && RISK_RANK[o.risk] > RISK_RANK[risk ?? 'none']) risk = o.risk;
    }
    if (risk && RISK_RANK[risk] > RISK_RANK[riskLevel]) riskLevel = risk;

    snapshot.push({
      questionId: q.id,
      prompt: q.prompt,
      type: q.type,
      values,
      labels: chosen.map((o) => o.label),
      ...(risk ? { risk } : {}),
      specialties: chosen.flatMap((o) => o.specialties ?? []),
    });
  }

  return { snapshot, riskLevel };
}
