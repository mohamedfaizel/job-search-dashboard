import { registerEnumType } from '@nestjs/graphql';
import { ImportSource } from '../generated/prisma/enums';

registerEnumType(ImportSource, {
  name: 'ImportSource',
  description: 'Where an import looks for jobs. ARBEITSAGENTUR is free and covers Germany only.',
});

export { ImportSource };
