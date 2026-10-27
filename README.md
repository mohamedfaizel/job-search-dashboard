# Job Search Dashboard

A full-stack job search dashboard. It pulls live job postings from the
[JobsPipe](https://jobspipe.dev) API, stores them in PostgreSQL, and shows them in a
sortable, filterable table. You can also add jobs by hand.

> **Status:** step 3 of 4 (dashboard UI). See the [roadmap](#roadmap).

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    shell["shell (host app)<br/>:5173"]
    dashboard["dashboard (microfrontend)<br/>:5174"]
    jobForm["job-form (microfrontend)<br/>:5175"]
    profile["profile (microfrontend)<br/>:5176"]
    shell -- loads at runtime --> dashboard
    shell -- loads at runtime --> jobForm
    shell -- loads at runtime --> profile
  end
  api["api (NestJS)<br/>:3000"]
  db[(PostgreSQL<br/>:5432)]
  jobspipe[[JobsPipe API]]
  dashboard -- GraphQL --> api
  jobForm -- GraphQL --> api
  profile -- GraphQL + resume upload --> api
  api -- Prisma --> db
  api -- sync --> jobspipe
```

| App              | What it is                                                        | Port |
| ---------------- | ----------------------------------------------------------------- | ---- |
| `apps/shell`     | Host app: page layout and navigation. Loads the microfrontends.   | 5173 |
| `apps/dashboard` | Microfrontend: the job posts table.                               | 5174 |
| `apps/job-form`  | Microfrontend: form for adding a job by hand.                     | 5175 |
| `apps/profile`   | Microfrontend: your profile and master resume (PDF/Word upload).  | 5176 |
| `apps/api`       | NestJS backend. Holds the JobsPipe token so it never hits the UI. | 3000 |
| `apps/storybook` | Storybook: a catalogue of the UI components, used by Chromatic.   | 6006 |
| `packages/data`  | Shared data layer: GraphQL client, TanStack Query hooks, Redux.   |      |

The microfrontends are separate Vite apps joined with
[Module Federation](https://module-federation.io/). Each can also run on its own,
which is handy while developing.

### How the frontend handles data

- **TanStack Query** owns _server_ state: it fetches jobs over GraphQL, caches them, and
  refetches after a change (adding a job, updating a status).
- **Redux Toolkit** owns _UI_ state that more than one microfrontend cares about: the table's
  search, column filters, sort and page.
- Both live in `packages/data` and are shared as Module Federation **singletons**, so the
  dashboard and the form use the same store and cache. Add a job in the form, go back to the
  table, and it is already there with your filters still applied.

Sorting, filtering and paging happen in PostgreSQL (through the API), not in the browser, so
the table stays fast with thousands of jobs.

## Tech stack

- **Frontend:** React 19, Vite, TypeScript (strict), Tailwind CSS 4, Module Federation,
  TanStack Query + Table, Redux Toolkit, React Hook Form + Zod
- **Backend:** NestJS, GraphQL (Apollo, code-first), Prisma 7, PostgreSQL (Docker)
- **Quality:** ESLint (typescript-eslint, react-hooks, jsx-a11y, import-x), Prettier,
  Husky + lint-staged, GitHub Actions CI
- **Tests:** Vitest + React Testing Library, MSW (mocks the GraphQL API and JobsPipe), API
  end-to-end tests against a real PostgreSQL, Storybook + Chromatic visual tests; Playwright
  arrives in step 4
- **Monorepo:** pnpm workspaces + Turborepo

## Getting started

### 1. Install the tools (once)

| Tool                                                                                                                                             | Why               | Check it works                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | -------------------------------------- |
| [Git](https://git-scm.com/downloads)                                                                                                             | Version control   | `git --version`                        |
| [Node.js 24 LTS](https://nodejs.org/)                                                                                                            | Runs JavaScript   | `node --version`                       |
| pnpm (`npm install -g pnpm@10` after installing Node)                                                                                            | Installs packages | `pnpm --version`                       |
| PostgreSQL 16: [Docker Desktop](https://www.docker.com/products/docker-desktop/) **or** a [native install](https://www.postgresql.org/download/) | Database          | `docker --version` or `psql --version` |
| [VS Code](https://code.visualstudio.com/)                                                                                                        | Editor            |                                        |

On Windows, if PowerShell says _"running scripts is disabled on this system"_, run
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once. After installing any tool,
restart VS Code so its terminal can find it.

### 2. Get the code

```bash
git clone https://github.com/mohamedfaizel/job-search-dashboard.git
cd job-search-dashboard
pnpm install
```

When VS Code opens the folder, accept the prompt to install the recommended extensions.

### 3. Configure environment variables

```bash
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
```

`.env` is git-ignored. Put your JobsPipe API token in `JOBSPIPE_API_TOKEN`. Never commit it.

### 4. Run everything

```bash
pnpm db:up                                 # start PostgreSQL in Docker
pnpm --filter @jobsearch/api db:deploy     # create the tables (first time, and after pulling new migrations)
pnpm dev                                   # start the api and all four frontends
```

Open <http://localhost:5173>. Check the API at <http://localhost:3000/health>.

**Log in:** the first time, click _Create an account_. The first account on a server becomes the
**admin**: only the admin sees **Add jobs**, because imports and saved searches spend the server's
JobsPipe credits. Accounts created after that are regular users who can browse the jobs and track
their status. Passwords are stored as argon2 hashes, and the session lives in an httpOnly cookie
for 7 days. Set `JWT_SECRET` in `.env` (see `.env.example`); `ALLOW_SIGNUP=false` closes sign-up.

**Tracker:** give a job a status (Saved, Applied, Interviewing, Offer, Rejected) from the table or
its popup and it lands on your **Tracker** board. Drag cards between columns, or use each card's
status menu (works with a keyboard). Every user has their own statuses and board; _Not applied_
takes a job off the board.

**Hide jobs:** click _Hide_ on any row to drop a job from your table. Only you stop seeing it.
_Hidden jobs (n)_ above the table lists them, with _Unhide_ to bring one back, and _Undo_ right
after hiding fixes a slip.

**My profile** holds your headline, the roles and places you want, your skills and links, and your
**master resume**. Upload a PDF or Word (.docx) file and the API reads the text out of it (scanned
images can't be read); you can fix that text by hand. Match scores and tailored resumes will start
from it. On _Import from JobsPipe_, **Fill from my profile** copies your roles, skills and places
into the search.

The **Add jobs** page has three tabs: _Saved searches_, _Import from JobsPipe_ and _Add a job by hand_.
_Import history_ sits below the tabs, so it shows on all three.

**Fill the table:** either open **Add jobs** and use _Import from JobsPipe_ (needs your token
in `.env`, and each job costs one credit), or load 36 made-up demo jobs for free while the API
is running. Adding jobs is admin-only, so the script logs in as your admin account (PowerShell):

```powershell
$env:SEED_EMAIL="you@example.com"; $env:SEED_PASSWORD="your password"
pnpm --filter @jobsearch/api db:seed
```

**Importing again** only asks JobsPipe for postings it found since your last import of the same
search (the _Only jobs new since my last import_ box). Untick it to fetch everything again. A job
is never stored twice: each JobsPipe posting has a stable id, saved in a unique `externalId`
column, so a re-import updates the row instead. JobsPipe also doesn't charge twice for the same
job in one calendar month.

**Bigger imports:** JobsPipe returns jobs newest first, one page at a time. _Jobs per page_ is
capped by your plan (Free 25, Builder/Growth 100, Scale/Business 500) and _Max pages_ limits how
many pages one import fetches. When an import stops with pages left, the panel shows how many jobs
match in total and a **Continue import** button that picks up from the next page.

**Saved searches:** type a name under _Save this search as_ to keep a search. Each saved search
gets a card with **Run now**, **Edit** (loads it into the import form; save with the same name to
update it) and **Delete**. _Import history_ lists the last 20 imports with what each brought in.

**Scheduled imports:** on a saved search card, pick _Run automatically_ (every hour, every day or
weekdays), a time, and **Save schedule**. While the API is running it checks every minute for due
searches and imports only jobs new since the last run. Times are the API computer's local time. To
protect your credits, a scheduled run is skipped when it could push today's total over
`DAILY_CREDIT_CAP` (default 100, in `.env`); the card says why, and the header shows today's usage.
Scheduled runs are tagged in _Import history_.

**Without Docker:** install PostgreSQL 16 natively (keep port 5432), skip `pnpm db:up`, and point
`.env` at it with the password you chose during setup:

```bash
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/jobsearch
TEST_DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/jobsearch_test
```

`db:deploy` creates the database if it doesn't exist yet.

### Tailor your resume with Resume-Matcher (optional)

[Resume-Matcher](https://github.com/srbhr/Resume-Matcher) (Apache-2.0) tailors a resume to one job
description: match score, keyword tips, a rewritten resume, a cover letter and PDF export. It runs
as an optional Docker container beside this project:

```bash
pnpm rm:up      # the first run downloads the image, which takes a while
pnpm rm:down    # stop it
```

It uses Anthropic's **Claude Sonnet 5.5** by default. Put your key in `.env` (create one at
[console.anthropic.com](https://console.anthropic.com), Settings > API Keys) and run `pnpm rm:up`
again so the container picks it up:

```bash
ANTHROPIC_API_KEY=sk-ant-...        # keep this secret: .env is git-ignored
RM_LLM_MODEL=claude-sonnet-5-5      # or claude-haiku-5-5 (cheaper), claude-opus-5-5 (smartest)
```

For a free local model, install [Ollama](https://ollama.com), run `ollama pull gemma3:4b` and set
`RM_LLM_PROVIDER=ollama`, `RM_LLM_MODEL=gemma3:4b` and
`RM_LLM_API_BASE=http://host.docker.internal:11434`. It is slower and less accurate.

Our API talks to Resume-Matcher at `RESUME_MATCHER_URL` (default `http://localhost:3100`). The
**My profile** page shows whether it is running, and **Test AI connection** sends one tiny message
to the AI provider to check the key and model. Resume-Matcher has no logins, so the port is bound
to `127.0.0.1` and the browser never calls it directly. You can still open <http://localhost:3100>
to use its own screens. Its data lives in the `resume-data` Docker volume.

When you upload your resume (PDF or Word) on **My profile**, it is also sent to Resume-Matcher,
which reads it into sections with its AI (one AI call). **Send again** re-sends it. Each user has
one copy there, and the old one is deleted first, because Resume-Matcher keeps at most 5 master
resumes in total. Resume text you typed in by hand isn't sent: Resume-Matcher needs the file.

## Using the API

Open <http://localhost:3000/graphql> in your browser. It shows Apollo Sandbox, where you can
browse the whole schema and run operations. The schema is also written to
[`apps/api/schema.gql`](apps/api/schema.gql).

**Fetch jobs from JobsPipe** (each job fetched costs one JobsPipe credit):

```graphql
mutation {
  syncJobs(
    input: { titles: ["frontend"], skills: ["react"], countryCodes: ["DE"], maxAgeDays: 2 }
  ) {
    fetched
    created
    updated
    hasMore
    creditsRemaining
  }
}
```

**Query the table**, with filters, sorting and pages:

```graphql
query {
  jobsPage(
    filter: { skills: ["react"], workplaces: [REMOTE] }
    sort: { field: SALARY, direction: DESC }
    page: 1
    pageSize: 25
  ) {
    total
    items {
      title
      company {
        name
      }
      city
      salaryMinUsd
      salaryMaxUsd
      applicationStatus
    }
  }
}
```

**Add a job by hand** and **track your application**:

```graphql
mutation {
  createJob(input: { title: "Frontend Engineer", companyName: "Acme", skills: ["react"] }) {
    id
  }
}

mutation {
  updateJobStatus(id: "<id from above>", status: APPLIED) {
    id
    applicationStatus
  }
}
```

To look at the raw tables, run `pnpm --filter @jobsearch/api db:studio` and open
<http://localhost:5555>. `Job` holds the postings, `SavedSearch` your saved searches and `SyncRun` one row per import.

### Database changes

The schema lives in [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma). After
editing it, run `pnpm --filter @jobsearch/api db:migrate` and give the migration a name. That
creates a SQL file under `prisma/migrations` which is committed with your change.

## Storybook and visual tests

```bash
pnpm --filter @jobsearch/storybook storybook   # opens http://localhost:6006
```

Storybook shows each component (table, badges, description popup, forms) on its own with
sample data, without the API or database. The stories live in
[`apps/storybook/stories`](apps/storybook/stories).

[Chromatic](https://www.chromatic.com/) screenshots every story on each pull request and
highlights pixel changes. To turn it on: sign in to Chromatic with GitHub, create a project for
this repo, then add its project token as a repository secret named `CHROMATIC_PROJECT_TOKEN`
(GitHub → Settings → Secrets and variables → Actions). Until then the Chromatic workflow skips
itself.

## Scripts

| Command             | What it does                     |
| ------------------- | -------------------------------- |
| `pnpm dev`          | Run every app in watch mode      |
| `pnpm build`        | Build every app                  |
| `pnpm test`         | Run all unit and component tests |
| `pnpm test:e2e`     | API tests against PostgreSQL     |
| `pnpm lint`         | Lint the whole repo              |
| `pnpm typecheck`    | Type-check every app             |
| `pnpm format`       | Format all files with Prettier   |
| `pnpm db:up`/`down` | Start or stop PostgreSQL         |
| `pnpm rm:up`/`down` | Start or stop Resume-Matcher     |

Run a script for one app with a filter, for example `pnpm --filter @jobsearch/dashboard test`.

A pre-commit hook (Husky + lint-staged) lints and formats the files you commit, so
unformatted code never lands in the repo.

## Roadmap

1. **Foundation:** monorepo, apps, tooling, CI
2. **Backend:** Prisma schema, JobsPipe sync into PostgreSQL, GraphQL API
   (jobs query with filters/sorting, add-job and status mutations)
3. **Frontend** (this step): sortable table with column filters, job description popup,
   application status button, add-job form, JobsPipe import, TanStack Query + Redux Toolkit,
   Storybook + Chromatic, MSW
4. **End-to-end and publish:** Playwright tests, screenshots, live deploy

Done since: saved and scheduled searches with a daily credit cap.

Later: a Claude-powered resume builder.
