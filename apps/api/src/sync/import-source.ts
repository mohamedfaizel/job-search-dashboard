import { registerEnumType } from '@nestjs/graphql';
import { ImportSource } from '../generated/prisma/enums';

registerEnumType(ImportSource, {
  name: 'ImportSource',
  description:
    'Where an import looks for jobs. ARBEITSAGENTUR (Germany only) and COMPANY_BOARDS (Greenhouse, Lever, Ashby) are free.',
});

export { ImportSource };
