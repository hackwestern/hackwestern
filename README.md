# hackwestern

Welcome to Hack Western :)

## Pre-requisites

- Linux, MacOS, or Windows with [Windows Subsystem For Linux](https://learn.microsoft.com/en-us/windows/wsl/about) installed.
- Node version 16.14.0 or higher (Node 12.x and 14.x have reached end-of-life as of April 2023) with `npm`, I'd recommend Node 20.12.2 as it's the most recent LTS version.
- A modern browser (Chrome 64+, Edge 79+, Firefox 67+, Safari 12+, etc).
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or an alternative such as [colima](https://github.com/abiosoft/colima).
- Git installed, GitHub account setup. Been added to our Hack Western GitHub organization.
- A modern text editor like VSCode or Neovim with the TypeScript LSP, Prettier and ESLint plugins installed and configured to run on save/commit.
- Have cloned this repository, and `cd` into it.

## Development Start

1. Get a copy of the `.env` from a web lead.
2. Run `npm install` to install dependencies using the node package manager.
3. Run `npm run db:start` to start your dev Postgres database using Docker (see `./start-database.sh`).
4. Run `npm run db:push` to push the drizzle database schema changes to your dev Postgres database using drizzle.
5. Run `npm run dev` to start the development server!

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
