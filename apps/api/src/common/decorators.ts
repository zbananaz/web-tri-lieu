import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { AuthUser, Role } from '@wtl/shared';
import type { Request } from 'express';

export const IS_PUBLIC = 'isPublic';
/** Route khong can dang nhap (van doc duoc user neu co token). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ALLOW_PASSWORD_PENDING = 'allowPasswordPending';
/** Route van dung duoc khi tai khoan dang phai doi mat khau tam (xem thong tin, doi mat khau, dang xuat). */
export const AllowPasswordPending = () => SetMetadata(ALLOW_PASSWORD_PENDING, true);

export const ROLES_KEY = 'roles';
/** Chi cac vai tro nay duoc goi route. Khong co @Roles => moi nguoi da dang nhap deu duoc. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest<Request>().user!,
);
