# Security

## Report a problem

Please do not open a public issue for a security problem. Use GitHub's private
report instead: **Security** tab → **Report a vulnerability**. You get an answer within a week.

## What we do

- Secrets live only in `.env` files, which git ignores. `.env.example` lists the names, never
  the values.
- Keys people save in Settings and Gmail tokens are stored encrypted (`SETTINGS_KEY`,
  `GMAIL_TOKEN_KEY`).
- The login cookie is `httpOnly`, `sameSite=lax`, and HTTPS-only in production. `JWT_SECRET`
  must be set in production or the API refuses to start.
- Login and sign-up are rate limited, and the API sends safe browser headers (helmet).
- Dependabot keeps dependencies up to date; CI runs lint, types, tests and SonarCloud on every PR.
