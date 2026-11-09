import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';
import type { StoryInput, StoryModel } from './story.model';

/** Longest title, and longest part (situation, task, action, result, reflection). */
export const MAX_TITLE = 120;
export const MAX_PART = 2000;
/** At most this many tags per story and stories per person. */
export const MAX_TAGS = 10;
export const MAX_STORIES = 100;

const SELECT = {
  id: true,
  title: true,
  situation: true,
  task: true,
  action: true,
  result: true,
  reflection: true,
  tags: true,
  updatedAt: true,
} as const;

const PARTS = ['situation', 'task', 'action', 'result', 'reflection'] as const;

/** The story trimmed, its tags cleaned (no doubles, no empties), or null when it breaks a limit. */
export function cleanStory(input: StoryInput): Omit<StoryModel, 'id' | 'updatedAt'> | null {
  const title = input.title.trim();
  const tags = [
    ...new Map(
      input.tags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => [tag.toLowerCase(), tag]),
    ).values(),
  ];
  const parts = Object.fromEntries(PARTS.map((part) => [part, input[part].trim()])) as Record<
    (typeof PARTS)[number],
    string
  >;
  const ok =
    title.length > 0 &&
    title.length <= MAX_TITLE &&
    PARTS.every((part) => parts[part].length <= MAX_PART) &&
    tags.length <= MAX_TAGS &&
    tags.every((tag) => tag.length <= 40);
  return ok ? { title, ...parts, tags } : null;
}

/** Your story bank: true stories in STAR form, for interview answers. */
@Injectable()
export class StoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Your stories, the one changed last first. */
  list(userId: number): Promise<StoryModel[]> {
    return this.prisma.story.findMany({
      where: { userId },
      select: SELECT,
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Adds a story (no id) or changes yours (with its id). */
  async save(userId: number, input: StoryInput): Promise<StoryModel> {
    const story = cleanStory(input);
    if (!story) {
      throw apiError(
        BadRequestException,
        'STORY_INVALID',
        `A story needs a title (at most ${String(MAX_TITLE)} characters); each part is at most ${String(MAX_PART)} characters, with at most ${String(MAX_TAGS)} tags`,
        { title: MAX_TITLE, part: MAX_PART, tags: MAX_TAGS },
      );
    }
    if (input.id) {
      const { count } = await this.prisma.story.updateMany({
        where: { id: input.id, userId },
        data: story,
      });
      if (count === 0) this.notFound(input.id);
      return this.prisma.story.findUniqueOrThrow({ where: { id: input.id }, select: SELECT });
    }
    if ((await this.prisma.story.count({ where: { userId } })) >= MAX_STORIES) {
      throw apiError(
        BadRequestException,
        'STORIES_FULL',
        `You can keep at most ${String(MAX_STORIES)} stories`,
        { max: MAX_STORIES },
      );
    }
    return this.prisma.story.create({ data: { userId, ...story }, select: SELECT });
  }

  async remove(userId: number, id: number): Promise<number> {
    const { count } = await this.prisma.story.deleteMany({ where: { id, userId } });
    if (count === 0) this.notFound(id);
    return id;
  }

  private notFound(id: number): never {
    throw apiError(NotFoundException, 'STORY_NOT_FOUND', `Story ${String(id)} not found`);
  }
}
