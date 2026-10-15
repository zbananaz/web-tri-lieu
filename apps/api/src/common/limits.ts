import { env } from '../config/env.js';

/** Nguong gioi han toc do theo IP. Moi request test cung mot IP nen nuoi long o moi truong test. */
export const rateLimit = (perMinute: number): number => (env.nodeEnv === 'test' ? 100_000 : perMinute);
