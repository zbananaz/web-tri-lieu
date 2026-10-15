import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '@wtl/shared';
import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser, Public, Roles } from '../common/decorators.js';
import { rateLimit } from '../common/limits.js';
import { env } from '../config/env.js';

export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const UPLOAD_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

type Ext = 'png' | 'jpg' | 'webp';
const NAME_PATTERN = /^[a-f0-9]{32}\.(?:png|jpg|webp)$/;
const MIME_BY_EXT: Record<Ext, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

/** Nhan dang loai anh theo byte dau (khong tin Content-Type/ten file do khach gui). */
export function sniffImage(b: Buffer): Ext | null {
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

@Roles('admin')
@Controller('admin/uploads')
export class AdminUploadsController {
  constructor(private readonly audit: AuditService) {}

  /** Tai anh bai viet len: body la byte anh tho (Content-Type image/png|jpeg|webp), toi da 3 MB. */
  @Throttle({ default: { limit: rateLimit(20), ttl: 60_000 } })
  @HttpCode(201)
  @Post()
  async upload(@CurrentUser() actor: AuthUser, @Req() req: Request) {
    const declared = (req.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
    if (!UPLOAD_MIME_TYPES.includes(declared)) throw new UnsupportedMediaTypeException('Chỉ nhận ảnh PNG, JPEG hoặc WebP');
    const body: unknown = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) throw new BadRequestException('Không có dữ liệu ảnh');
    const ext = sniffImage(body);
    if (!ext || MIME_BY_EXT[ext] !== declared) throw new UnsupportedMediaTypeException('Nội dung tệp không phải ảnh hợp lệ');
    const name = `${randomBytes(16).toString('hex')}.${ext}`;
    await mkdir(env.uploadDir, { recursive: true });
    await writeFile(join(env.uploadDir, name), body, { flag: 'wx' });
    await this.audit.log({ actorId: actor.id, action: 'upload.image', entity: 'upload', entityId: name, ip: req.ip, meta: { bytes: body.length } });
    return { url: `/api/uploads/${name}` };
  }
}

@Controller('uploads')
export class UploadsController {
  /** Anh cong khai (dung trong bai viet). Ten ngau nhien 128 bit, chi nhan dung mau ten do API tao. */
  @Public()
  @Get(':name')
  serve(@Param('name') name: string, @Res() res: Response): void {
    if (!NAME_PATTERN.test(name)) throw new NotFoundException();
    const ext = name.slice(name.lastIndexOf('.') + 1) as Ext;
    res.setHeader('Content-Type', MIME_BY_EXT[ext]);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.sendFile(name, { root: env.uploadDir, dotfiles: 'deny' }, (err) => {
      if (err && !res.headersSent) res.status(404).json({ statusCode: 404, message: 'Not Found' });
    });
  }
}
