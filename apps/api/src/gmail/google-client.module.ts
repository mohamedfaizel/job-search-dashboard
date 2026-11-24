import { Module } from '@nestjs/common';
import { GmailClient } from './gmail.client';

/** The one Google sign-in client, shared by Gmail and Google Calendar. */
@Module({ providers: [GmailClient], exports: [GmailClient] })
export class GoogleClientModule {}
