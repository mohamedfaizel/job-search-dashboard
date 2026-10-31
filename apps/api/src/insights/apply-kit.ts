/** Everything the Apply kit page shows. Text fields are empty strings when not given. */
export interface ApplyKitInput {
  job: { title: string; company: string; url: string | null };
  me: {
    name: string;
    firstName: string;
    lastName: string;
    /** female, male, diverse, not_specified or empty. */
    gender: string;
    /** "YYYY-MM-DD" or empty. */
    dateOfBirth: string;
    nationality: string;
    email: string;
    phone: string;
    address: string;
    linkedinUrl: string | null;
    githubUrl: string | null;
    websiteUrl: string | null;
    yearsExperience: number | null;
    languages: string[];
    workPermit: string;
    noticePeriod: string;
    salaryExpectation: string;
    relocation: string;
    employmentType: string;
    workplacePreference: string;
    drivingLicence: string;
    applicationNotes: string;
    customFields: { label: string; value: string }[];
  };
  /** The resume you saved for this job, with the cover letter and answers from Claude's reply. */
  jobResume: { text: string; coverLetter: string; formAnswers: string } | null;
  /** Where the resume file for this job downloads from. */
  resumeUrl: string;
}

const NOT_GIVEN = '(not given: leave this field empty and tell me)';
const value = (text: string | null | undefined) => (text?.trim() ? text.trim() : NOT_GIVEN);
const GENDER_WORDS: Record<string, string> = {
  female: 'Female',
  male: 'Male',
  diverse: 'Diverse',
  not_specified: 'Prefer not to say',
};

const block = (text: string | undefined, missing: string) => (text?.trim() ? text.trim() : missing);

/**
 * The Apply kit page: plain text for Claude in Chrome to read before it fills in an application
 * form, with the rules first. Claude never presses Submit: you check the form and send it.
 */
export function buildApplyKit({ job, me, jobResume, resumeUrl }: ApplyKitInput): string {
  const noReply =
    "(none yet: paste Claude's reply into this job's Apply kit first. Leave these fields empty.)";
  return `APPLY KIT: ${job.title} at ${job.company}
Posting: ${job.url ?? '(no link saved: use the posting I have open)'}

INSTRUCTIONS FOR CLAUDE IN CHROME
1. Go to the posting above, or use the tab I already have open on it, and open its application form.
2. Fill in each field from this page only. Copy facts exactly as written: never change my name, contact details, language levels, dates, numbers, salary or work permit.
3. For questions about motivation or fit, use the form answers below, then the cover letter. Shorten them to fit the field, but don't add new claims.
4. If the form asks for something that isn't on this page, leave it empty and tell me.
5. Never sign in, create an account, or tick consent, privacy or terms boxes for me. Don't upload files: I attach the resume myself.
6. Never click Submit, Apply, Send or anything that sends the application. Stop, then tell me what you filled in, what you left empty, and which files I still need to attach.

MY DETAILS
Name: ${value(me.name)}
First name: ${value(me.firstName)}
Last name: ${value(me.lastName)}
Gender: ${value(GENDER_WORDS[me.gender])}
Date of birth (YYYY-MM-DD): ${value(me.dateOfBirth)}
Nationality: ${value(me.nationality)}
Email: ${value(me.email)}
Phone: ${value(me.phone)}
Address / location: ${value(me.address)}
LinkedIn: ${value(me.linkedinUrl)}
GitHub: ${value(me.githubUrl)}
Website: ${value(me.websiteUrl)}
Years of experience: ${me.yearsExperience === null ? NOT_GIVEN : String(me.yearsExperience)}
Languages (my real levels, copy exactly): ${me.languages.length ? me.languages.join(', ') : NOT_GIVEN}
Work permit: ${value(me.workPermit)}
Notice period / earliest start: ${value(me.noticePeriod)}
Salary expectation: ${value(me.salaryExpectation)}
Willing to relocate: ${value(me.relocation)}
Employment type: ${value(me.employmentType)}
Remote / hybrid / on-site: ${value(me.workplacePreference)}
Driving licence: ${value(me.drivingLicence)}
${me.customFields.map((f) => `${f.label}: ${value(f.value)}`).join('\n')}

FORM ANSWERS FOR THIS JOB
${block(jobResume?.formAnswers, noReply)}

COVER LETTER FOR THIS JOB
${block(jobResume?.coverLetter, noReply)}

MY SAVED ANSWERS
${block(me.applicationNotes, '(none)')}

RESUME FOR THIS JOB
File for me to attach: ${jobResume ? resumeUrl : '(none saved yet: I will attach my master resume)'}
${block(jobResume?.text, '(none saved yet)')}
`;
}
