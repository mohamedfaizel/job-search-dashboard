// Adds fictional demo jobs through the GraphQL API, so you can try the dashboard
// without spending JobsPipe credits. Adding jobs is admin-only, so it logs in as your admin
// account. Start the API first (pnpm dev), then run (PowerShell):
//   $env:SEED_EMAIL="you@example.com"; $env:SEED_PASSWORD="your password"
//   pnpm --filter @jobsearch/api db:seed
// Set API_URL to seed another server. Running it twice adds the jobs twice.
// Statuses on the demo jobs (Saved, Applied…) go on the admin's own tracker.

const API_URL = process.env.API_URL ?? 'http://localhost:3000/graphql';
const { SEED_EMAIL, SEED_PASSWORD } = process.env;
if (!SEED_EMAIL || !SEED_PASSWORD) {
  console.error('Set SEED_EMAIL and SEED_PASSWORD to your admin account first.');
  process.exit(1);
}

const companies = [
  'Acme Robotics',
  'Northwind Labs',
  'Globex',
  'Initech',
  'Umbrella Health',
  'Stark Mobility',
  'Wayne Fintech',
  'Hooli',
  'Pied Piper',
  'Soylent Foods',
  'Vandelay Imports',
  'Cyberdyne',
];
const industries = [
  'Computer programming',
  'Financial services',
  'Human health activities',
  'Manufacture of motor vehicles',
  'Land transport',
  'Employment activities',
];
const cities = [
  ['New York', 'US'],
  ['San Francisco', 'US'],
  ['Austin', 'US'],
  ['Berlin', 'DE'],
  ['London', 'GB'],
  ['Bengaluru', 'IN'],
  ['Toronto', 'CA'],
  ['Remote', 'US'],
];
const roles = [
  ['Senior Frontend Engineer', 'senior', ['react', 'typescript', 'graphql', 'tailwind']],
  ['Full-Stack Engineer', 'mid', ['react', 'node.js', 'postgresql', 'aws']],
  ['Staff Software Engineer, Platform', 'lead', ['go', 'kubernetes', 'aws', 'terraform']],
  ['Backend Engineer (NestJS)', 'mid', ['node.js', 'nestjs', 'postgresql', 'redis']],
  ['Junior React Developer', 'junior', ['react', 'javascript', 'css']],
  ['Engineering Manager, Web', 'director', ['leadership', 'react', 'hiring']],
];
const workplaces = ['REMOTE', 'HYBRID', 'ONSITE'];
const statuses = ['NONE', 'NONE', 'NONE', 'SAVED', 'APPLIED', 'INTERVIEWING', 'OFFER', 'REJECTED'];

const MUTATION = `mutation Seed($input: CreateJobInput!) { createJob(input: $input) { id } }`;
const LOG_IN = `mutation LogIn($input: LogInInput!) { logIn(input: $input) { role } }`;

async function gql(query, variables, cookie) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ query, variables }),
  }).catch(() => {
    console.error(`Can't reach ${API_URL}. Start the API with "pnpm dev" first.`);
    process.exit(1);
  });
  return { res, body: await res.json() };
}

// Log in once and reuse the session cookie (just its "session=..." part) for every job.
const login = await gql(LOG_IN, { input: { email: SEED_EMAIL, password: SEED_PASSWORD } });
if (login.body.errors) {
  console.error(`Could not log in: ${login.body.errors[0].message}`);
  process.exit(1);
}
if (login.body.data.logIn.role !== 'ADMIN') {
  console.error('Only the admin can add jobs. Use the first account created on this server.');
  process.exit(1);
}
const cookie = login.res.headers.get('set-cookie').split(';')[0];

let created = 0;
for (let i = 0; i < 36; i++) {
  const [title, seniority, skills] = roles[i % roles.length];
  const company = companies[(i * 5) % companies.length];
  const [city, countryCode] = cities[(i * 3) % cities.length];
  const base = 70_000 + ((i * 7919) % 120) * 1_000;
  const hasSalary = i % 4 !== 0;
  const input = {
    title,
    companyName: company,
    url: `https://example.com/jobs/${i + 1}`,
    seniority,
    jobFunction: 'Engineering',
    skills,
    city,
    countryCode,
    workplace: workplaces[i % workplaces.length],
    industry: industries[i % industries.length],
    applicationStatus: statuses[i % statuses.length],
    ...(hasSalary ? { salaryMinUsd: base, salaryMaxUsd: base + 40_000 } : {}),
    description:
      `${company} is hiring a ${title} in ${city}.\n\n` +
      `What you'll do:\n- Build features with ${skills.slice(0, 3).join(', ')}\n- Work with product and design\n\n` +
      `This is fictional demo data created by scripts/seed-demo.mjs.`,
  };

  const { body } = await gql(MUTATION, { input }, cookie);
  if (body.errors) {
    console.error(`Failed on job ${i + 1}: ${body.errors[0].message}`);
    process.exit(1);
  }
  created++;
}
console.log(`Added ${created} demo jobs. Open http://localhost:5173 to see them.`);
