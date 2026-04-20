# SecondBrain - Your Course Management Assistant

[![CI](https://github.com/mhd-hi/SecondBrain-ETS/actions/workflows/ci.yml/badge.svg)](https://github.com/mhd-hi/second-brain/actions/workflows/ci.yml)
  
SecondBrain uses AI to parse ETS course plans and break them down into manageable tasks, helping students stay organized and on track with their studies.

<img alt="dashboard image" src="https://github.com/user-attachments/assets/76c97796-fc4f-43cf-a9df-e49b66c0a0aa" />

## Tech Stack

- [Next.js](https://nextjs.org)
- [NextAuth.js](https://next-auth.js.org)
- [Drizzle](https://orm.drizzle.team)
- [Tailwind CSS](https://tailwindcss.com)
- [OpenAI API](https://openai.com)

## Getting Started

### Prerequisites
- [Bun](https://bun.sh) >= 1.0.0
- Node.js

### Installation

1. Clone the repository
2. Install dependencies using Bun (recommended):
   ```bash
   bun install
   ```
3. Set up environment variables :
- By copying `.env.example` to `.env`

4. Set up the database:
   ```bash
   bun run db:generate
   bun run db:push
   ```

5. Run the development server:
   ```bash
   bun dev
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Development Scripts

### Essential Commands
- `bun dev` - Start development server
- `bun build` - Build for production
- `bun start` - Start production server
- `bun lint` - Run ESLint
- `bun typecheck` - Run TypeScript compiler check
