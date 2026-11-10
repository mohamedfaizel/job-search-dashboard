import { Module } from '@nestjs/common';
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';

/** Admin pages: manage accounts. */
@Module({
  providers: [AdminService, AdminResolver],
})
export class AdminModule {}
