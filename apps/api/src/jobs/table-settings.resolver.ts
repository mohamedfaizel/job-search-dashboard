import { BadRequestException } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';

/** A saved table is a few filters and a sort; anything bigger is not one. */
const MAX_LENGTH = 4000;

/** Keeps each user's Job posts filters and sort, so the table opens the way they left it. */
@Resolver()
export class TableSettingsResolver {
  constructor(private readonly prisma: PrismaService) {}

  @Query(() => String, {
    nullable: true,
    description: 'Your saved Job posts filters and sort, as JSON text. Null if you never saved any',
  })
  async myTableSettings(@CurrentUser() user: SessionUser): Promise<string | null> {
    const row = await this.prisma.tableSettings.findUnique({ where: { userId: user.id } });
    return row?.settings ?? null;
  }

  @Mutation(() => Boolean, {
    description: 'Saves your Job posts filters and sort (JSON text), replacing the ones before',
  })
  async saveTableSettings(
    @CurrentUser() user: SessionUser,
    @Args('settings') settings: string,
  ): Promise<boolean> {
    if (settings.length > MAX_LENGTH || !isJsonObject(settings)) {
      throw new BadRequestException('Table settings must be a small JSON object');
    }
    await this.prisma.tableSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, settings },
      update: { settings },
    });
    return true;
  }
}

function isJsonObject(text: string): boolean {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  } catch {
    return false;
  }
}
