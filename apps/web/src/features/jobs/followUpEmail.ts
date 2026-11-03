import type { Application } from '@jobsearch/data';

/**
 * A short, polite follow-up email for an application with no news. Written in the job ad's
 * language (German ads get a German email), with your name from My profile. No AI: you read it,
 * change what you like, and send it yourself.
 */
export function followUpEmail(app: Pick<Application, 'updatedAt' | 'job'>, name: string): string {
  const { title, company, language } = app.job;
  const german = language === 'de';
  const date = new Intl.DateTimeFormat(german ? 'de-DE' : 'en-GB', { dateStyle: 'long' }).format(
    new Date(app.updatedAt),
  );
  const signature = name.trim() || (german ? '[Ihr Name]' : '[Your name]');

  if (german) {
    return [
      `Betreff: Nachfrage zu meiner Bewerbung als ${title}`,
      '',
      'Sehr geehrte Damen und Herren,',
      '',
      `am ${date} habe ich mich bei ${company.name} auf die Stelle als ${title} beworben. Ich interessiere mich weiterhin sehr für die Position und reiche gerne weitere Unterlagen nach.`,
      '',
      'Können Sie mir sagen, wie der aktuelle Stand ist?',
      '',
      'Mit freundlichen Grüßen',
      signature,
    ].join('\n');
  }
  return [
    `Subject: Following up on my application: ${title}`,
    '',
    'Hello,',
    '',
    `I applied for the ${title} position at ${company.name} on ${date} and wanted to follow up. I am still very interested in the role and happy to send anything else you need.`,
    '',
    'Could you let me know where things stand?',
    '',
    'Kind regards,',
    signature,
  ].join('\n');
}
