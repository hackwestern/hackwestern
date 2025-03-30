# hackwestern

Welcome to Hack Western :)

## Pre-requisites

- Linux, MacOS, or Windows with [Windows Subsystem For Linux](https://learn.microsoft.com/en-us/windows/wsl/about) installed.
- Node version 21 or higher with `npm`
  - We recommend using [`nvm`](https://github.com/nvm-sh/nvm) to install node and npm
- A modern browser (Chrome 108+, Edge 108+, Firefox 108+, Safari 16+, etc).
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or an alternative such as [colima](https://github.com/abiosoft/colima).
- Git installed, GitHub account setup. Been added to our Hack Western GitHub organization.
- A modern text editor like VSCode or Neovim with the TypeScript LSP, Prettier and ESLint plugins installed and configured to run on save/commit.
- Have cloned this repository, and `cd` into it.

## Development Start

1. Get a copy of the `.env` from a web lead.
   - generate your own `NEXTAUTH_SECRET`with `openssl rand -base64 32`
2. Run `npm install` to install dependencies using the node package manager.
3. Run `npm run db:start` to start your dev Postgres database using Docker (see `./start-database.sh`).
4. Run `npm run db:migrate` to push the drizzle database schema changes to your dev Postgres database using drizzle.
5. Optionally, you can run `npm run db:seed` to seed (some of) the database with fake data to use when testing.
6. Run `npm run dev` to start the development server!
7. Use `npm run db:studio` to use drizzle studio to manage your database

When making changes to the schema, first run `npm run db:generate` to generate the migration SQL scripts, then run `npm run db:migrate` to apply them. DO NOT use `npx drizzle-kit push` anymore.

## Technologies

If you are not familiar with the different technologies used in this project, please refer to their respective docs.

- [Next.js](https://nextjs.org)
- [React.js](https://react.dev)
- [NextAuth.js](https://next-auth.js.org)
- [PostgreSQL](https://www.postgresql.org/)
- [Drizzle](https://orm.drizzle.team)
- [Docker](https://docs.docker.com/)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)
