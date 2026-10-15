import argon2 from 'argon2';

// Thong so argon2id theo khuyen nghi toi thieu cua OWASP (19 MiB, t=2, p=1).
const OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/** Tinh toan gia khi khong tim thay user de thoi gian phan hoi khong lo email co ton tai hay khong. */
export async function burnPasswordCheck(plain: string): Promise<void> {
  dummyHash ??= hashPassword('dummy-password-for-timing-1');
  await verifyPassword(await dummyHash, plain);
}
