# GEMINI.md

## Project Overview

This is a **Community Pulse** web application, a real-time dashboard that provides a "vibe" of a city based on user-submitted "pulses". The application is built with a modern web stack and includes features like real-time updates, weather information, traffic conditions, city mood analysis, news feeds, and AI-powered summaries.

**Key Technologies:**

*   **Framework:** Next.js
*   **Language:** TypeScript
*   **UI:** React, Tailwind CSS
*   **Backend:** Next.js API Routes, Supabase
*   **Database:** Supabase (PostgreSQL)
*   **AI:** OpenAI API (for summaries and username generation)
*   **Linting:** ESLint

**Architecture:**

The project is a monolithic Next.js application. The main UI is a single-page application located in `src/app/page.tsx`. It fetches data from a set of Next.js API routes under `src/app/api/` and directly from Supabase for real-time data.

## Building and Running

### Prerequisites

*   Node.js and npm (or yarn/pnpm/bun)
*   A Supabase project for the database and authentication.
*   API keys for OpenAI and a weather service (like OpenWeatherMap).

### Setup

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Environment Variables:**
    Create a `.env.local` file in the root of the project and add the following environment variables:
    ```
    NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
    OPENAI_API_KEY=<OPENAI_API_KEY>
    WEATHER_API_KEY=YOUR_WEATHER_API_KEY
    NEWS_API_KEY=YOUR_NEWS_API_KEY
    ```

### Running the Application

*   **Development:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:3000`.

*   **Production Build:**
    ```bash
    npm run build
    ```

*   **Start Production Server:**
    ```bash
    npm run start
    ```

*   **Linting:**
    ```bash
    npm run lint
    ```

## Development Conventions

*   **TypeScript:** The project is written in TypeScript with `strict` mode enabled. All new code should be strongly typed.
*   **Components:** The UI is built with React functional components and hooks.
*   **Styling:** Tailwind CSS is used for styling.
*   **API:** Backend logic is implemented as Next.js API routes.
*   **Database:** Supabase is the primary database. The client is initialized in `lib/supabaseClient.ts`.
*   **Code Quality:** ESLint is used for code linting. Run `npm run lint` to check for issues.
*   **File Structure:**
    *   `src/app/page.tsx`: The main page component.
    *   `src/app/api/`: Contains all the API routes.
    *   `src/app/data/`: Contains data-related files, like `cities.ts`.
    *   `lib/`: Contains shared library code, like the Supabase client.
    *   `public/`: Contains static assets.
