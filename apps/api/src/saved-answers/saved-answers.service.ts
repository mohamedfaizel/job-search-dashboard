import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';
import type { SavedAnswerModel } from './saved-answer.model';

/** Longest question or answer we keep. */
export const MAX_LENGTH = 2000;

/** "Is 65.000 € gross right?" and "is 65.000 € gross right" are the same question. */
export function questionKey(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}€$%.\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Your answers to Claude's questions (Ask me), kept so the next job can fill them in. */
@Injectable()
export class SavedAnswersService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: number): Promise<SavedAnswerModel[]> {
    return this.prisma.savedAnswer.findMany({
      where: { userId },
      select: { id: true, question: true, answer: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Saves an answer; the same question again replaces the old answer. */
  async save(userId: number, question: string, answer: string): Promise<SavedAnswerModel> {
    const q = question.trim();
    const a = answer.trim();
    const key = questionKey(q);
    if (!key || !a || q.length > MAX_LENGTH || a.length > MAX_LENGTH) {
      throw apiError(
        BadRequestException,
        'ANSWER_LENGTH',
        `A question and its answer are 1 to ${String(MAX_LENGTH)} characters`,
        { max: MAX_LENGTH },
      );
    }
    return this.prisma.savedAnswer.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, question: q, answer: a },
      update: { answer: a },
      select: { id: true, question: true, answer: true, updatedAt: true },
    });
  }

  async remove(userId: number, id: number): Promise<number> {
    const { count } = await this.prisma.savedAnswer.deleteMany({ where: { id, userId } });
    if (count === 0) {
      throw apiError(NotFoundException, 'ANSWER_NOT_FOUND', `Saved answer ${String(id)} not found`);
    }
    return id;
  }
}
