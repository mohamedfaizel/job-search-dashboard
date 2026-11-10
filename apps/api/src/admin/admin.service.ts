import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '../common/api-error';
import type { Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminUserModel } from './admin.model';

const USER_FIELDS = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  lastSeenAt: true,
  disabledAt: true,
} as const;

/**
 * Admin › Users. Admins manage accounts (role, on or off, delete) and see counts only: no
 * jobs, resumes, letters or keys of anyone else ever come back from here.
 *
 * Nobody changes their own account here, so the admin doing it always stays an admin who can
 * log in: the app can't lose its last admin.
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async users(): Promise<AdminUserModel[]> {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const [users, keys, imports] = await Promise.all([
      this.prisma.user.findMany({
        select: USER_FIELDS,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.apiKey.findMany({ where: { kind: 'JOBHUNTER' }, select: { userId: true } }),
      this.prisma.syncRun.groupBy({
        by: ['userId'],
        where: { userId: { not: null }, finishedAt: { gte: monthStart } },
        _count: { _all: true },
      }),
    ]);
    const withKey = new Set(keys.map((key) => key.userId));
    const importCount = new Map(imports.map((row) => [row.userId, row._count._all]));
    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      joinedAt: user.createdAt,
      lastSeenAt: user.lastSeenAt,
      disabled: user.disabledAt !== null,
      hasJobKey: withKey.has(user.id),
      importsThisMonth: importCount.get(user.id) ?? 0,
    }));
  }

  async setRole(adminId: number, userId: number, role: Role): Promise<AdminUserModel> {
    await this.target(adminId, userId);
    await this.prisma.user.update({ where: { id: userId }, data: { role } });
    return this.one(userId);
  }

  async setDisabled(adminId: number, userId: number, disabled: boolean): Promise<AdminUserModel> {
    const user = await this.target(adminId, userId);
    await this.prisma.user.update({
      where: { id: userId },
      // Switching on again keeps nothing of the old date.
      data: { disabledAt: disabled ? (user.disabledAt ?? new Date()) : null },
    });
    return this.one(userId);
  }

  /** Deletes the account and everything in it (every table that belongs to a user cascades). */
  async remove(adminId: number, userId: number, confirmEmail: string): Promise<number> {
    const user = await this.target(adminId, userId);
    if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      throw apiError(
        BadRequestException,
        'CONFIRM_EMAIL_MISMATCH',
        'Type the email of the account you delete',
      );
    }
    await this.prisma.user.delete({ where: { id: userId } });
    return userId;
  }

  private async target(adminId: number, userId: number) {
    if (adminId === userId) {
      throw apiError(
        BadRequestException,
        'NOT_ON_YOURSELF',
        'You can’t change your own account here. Ask another admin',
      );
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: USER_FIELDS });
    if (!user) throw apiError(NotFoundException, 'USER_NOT_FOUND', 'This account no longer exists');
    return user;
  }

  private async one(userId: number): Promise<AdminUserModel> {
    const found = (await this.users()).find((user) => user.id === userId);
    if (!found)
      throw apiError(NotFoundException, 'USER_NOT_FOUND', 'This account no longer exists');
    return found;
  }
}
