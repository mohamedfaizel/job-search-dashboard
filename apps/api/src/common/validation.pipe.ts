import type { ValidationError } from '@nestjs/common';
import { BadRequestException, ValidationPipe } from '@nestjs/common';

function messages(errors: ValidationError[], prefix = ''): string[] {
  return errors.flatMap((error) => {
    const path = prefix ? `${prefix}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((msg) =>
      prefix ? msg.replace(error.property, path) : msg,
    );
    return [...own, ...messages(error.children ?? [], path)];
  });
}

/**
 * Runs the class-validator rules on every input. Failures come back as one readable
 * GraphQL error, e.g. "title should not be empty; url must be a URL address".
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    exceptionFactory: (errors) => new BadRequestException(messages(errors).join('; ')),
  });
}
