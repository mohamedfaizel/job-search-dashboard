import { Module } from '@nestjs/common';
import { SalaryResolver } from './salary.resolver';
import { SalaryService } from './salary.service';

/** Salary research and negotiation help for a job. */
@Module({ providers: [SalaryService, SalaryResolver] })
export class SalaryModule {}
