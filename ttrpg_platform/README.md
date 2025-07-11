# TTRPG Platform API

This repository contains the backend API for the TTRPG Platform, built with Python and FastAPI. It's designed to be run locally and serves as the data and logic layer for a separate Next.JS frontend application.

## Project Goals

The overall TTRPG Platform aims to provide:

-   User registration and login.
-   Game creation, where the creator becomes the Game Master (GM/DM).
-   Functionality for players to join existing games.
-   A real-time game chat room equipped with tools to facilitate TTRPG play.
-   A dedicated "Master Mode" for GMs with special controls and views.
-   An accessible and welcoming design for both new and experienced TTRPG players.
-   Night and day mode for user interface comfort (handled by the frontend).
-   An admin/management panel for site administrators.
-   All user data, game information, and related files stored locally.

This backend specifically provides:

-   A robust JSON API built with Python and FastAPI.
-   Database interactions for users, games, and other platform entities.
-   Authentication and authorization mechanisms.

## Backend Setup (FastAPI)

Follow these steps to set up and run the backend API:

1.  **Clone/Setup this Repository:**
    Ensure you have this backend project's files on your local machine.

2.  **Create and Activate a Virtual Environment (Recommended):**
    ```bash
    python -m venv venv
    ```
    Activate the environment:
    *   On Windows: `venv\Scripts\activate`
    *   On macOS/Linux: `source venv/bin/activate`

3.  **Install Dependencies:**
    With the virtual environment activated, install the required Python packages:
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure Environment Variables:**
    Create a `.env` file in the root directory of this backend project (the same directory as `requirements.txt`). Add the following line, adjusting the URL if your Next.JS frontend will run on a different port during development:
    ```
    FRONTEND_URL=http://localhost:3000
    ```
    *Note: Remember to add `.env` to your `.gitignore` file if you are using Git.*

5.  **Set a Secure JWT Secret Key:**
    Open the `app/auth.py` file and locate the `SECRET_KEY` variable. **Change `"YOUR_VERY_SECRET_KEY"` to a long, random, and strong secret string.** This is crucial for security.

6.  **Run the Backend API Server:**
    Navigate to the root directory of this backend project (the one containing the `app/` directory) in your terminal. Run the Uvicorn server:
    ```bash
    uvicorn app.main:app --reload --port 8000
    ```
    *   The `--reload` flag enables auto-reloading when code changes, which is useful for development.
    *   The API will typically be available at `http://127.0.0.1:8000`.
    *   You can access the auto-generated API documentation at `http://127.0.0.1:8000/docs`.

## Frontend Setup (Next.JS)

The frontend for this TTRPG Platform is a **separate Next.JS project**. Please refer to the `README.md` file within that frontend project's repository/directory for its specific setup and run instructions.

Typically, setting up the Next.JS frontend will involve:
-   Navigating to the frontend project directory.
-   Installing Node.js dependencies (e.g., `npm install` or `yarn install`).
-   Running the Next.JS development server (e.g., `npm run dev` or `yarn dev`), which usually makes the frontend accessible at `http://localhost:3000`.

## Next Steps & Future Features (Backend Focus)

The following are key areas for continued development on this backend API:

-   **Game Models & CRUD Operations:**
    *   Define `Game`, `PlayerCharacter`, and other relevant SQLAlchemy models in `app/models.py`.
    *   Create corresponding Pydantic schemas in `app/schemas.py` for data validation and serialization.
    *   Implement CRUD (Create, Read, Update, Delete) functions in `app/crud.py` for these new models.
-   **Game API Endpoints:**
    *   Develop API routes in `app/routers/games.py` (or a similar module) for:
        *   Creating new games.
        *   Listing available/joined games.
        *   Allowing users to join or leave games.
        *   Managing game settings (for GMs).
-   **WebSocket Implementation for Real-Time Chat:**
    *   Set up WebSocket endpoints in FastAPI to handle real-time communication for game chat rooms.
-   **Master Mode Logic:**
    *   Implement API endpoints and logic to support special functionalities for Game Masters.
-   **Admin Panel API Endpoints:**
    *   Expand the `/admin` API routes for comprehensive user and game management by administrators.
-   **Enhanced Security:**
    *   Continuously review and enhance authentication, authorization (e.g., role-based access control), and input validation.
    *   Consider rate limiting and other security best practices.
-   **TTRPG-Specific Tooling APIs:**
    *   Develop backend support for tools like dice rollers, initiative trackers, or simple map/token updates if these require server-side logic or persistence.

This `README.md` should give anyone looking at your backend project a clear understanding of its purpose, how to set it up, and how it fits into the larger application architecture!

## Frontend Next Steps & Placeholders (Next.JS Focus)

This section outlines potential next steps and identifies placeholders within the Next.JS frontend application.

### I. Core Functionality & Feature Completion:

1.  **Implement "Coming Soon" Features:**
    *   **`src/app/create/page.tsx`:**
        *   **"TTRPG" Character Type:**
            *   Design and implement the form for TTRPG-specific characters (e.g., stats, classes, levels, spells, equipment with mechanics).
            *   Backend will need corresponding models and endpoints.
        *   **"New World":**
            *   Form: Name, description, genre, core rules/system, map uploads, key locations, factions.
            *   View page for worlds.
        *   **"New Lore":**
            *   System for creating rich-text lore articles (e.g., for characters, locations, events, items).
            *   Categorization, tagging, linking between lore entries.
        *   **"New Document":**
            *   A flexible document editor (e.g., for session notes, GM plans, player handouts).
            *   Could use a Markdown editor or a more advanced rich-text editor.
    *   **`src/app/page.tsx` (Homepage - Creations Section):**
        *   **"Existing" Button:** Link to a dashboard page listing all user's creations (characters, worlds, lore, docs) with options to view/edit/delete.
        *   **"Role-Play" Button:** Could link to the GDM RP test page for now, or evolve into a hub for finding/joining RP sessions.
    *   **`src/app/settings/page.tsx`:**
        *   **User Account Control:**
            *   "Change Password"
            *   "Manage Email Preferences" (granular controls beyond the single toggle)
            *   "Delete Account" (with proper confirmations and data handling)
        *   **Notifications:**
            *   "Notification Sound Preferences"
        *   **Appearance:**
            *   "Adjust Font Size" (if not handled by browser zoom)
        *   **Privacy & Data:**
            *   "Who can send me Direct Messages?" (e.g., everyone, friends only, no one)
            *   "Export My Data"
        *   **About & Help:**
            *   "Help / FAQ" (link to a static page or a simple CMS)
            *   "Report a Bug" (link to a contact form or issue tracker)
    *   **`src/app/games/page.tsx` (Games List):**
        *   **"Base Game Filter (e.g., D&D)"**: Implement filtering by game system, tags, or other criteria.

2.  **Flesh out Existing Feature Placeholders:**
    *   **`src/app/admin/test/chat/gdm-rp/page.tsx`:**
        *   **Admin Link:** The `&larr; Back to Admin (Placeholder)` link should go to a real admin dashboard.
        *   **World Lore:** The "World details..." section should fetch and display relevant lore for the current RP context.
    *   **`src/app/games/[gameId]/page.tsx` (Game Detail):**
        *   Implement GM actions: "Edit Game" (link to an edit form), "Delete Game" (with confirmation).
    *   **`src/app/my-games/page.tsx` (My Games - GM View):**
        *   Add "Edit" and "Delete" buttons/functionality for each game listed.
    *   **`src/app/view/[userId]/[characterId]/gallery/page.tsx` (Character Gallery):**
        *   Implement `handleDeleteImage` functionality for owners. This requires a backend `DELETE` endpoint.

### II. UI/UX Enhancements & Polish:

1.  **Loading States:**
    *   Implement more skeleton loaders or consistent loading spinners across all pages during data fetching.
2.  **Error Handling:**
    *   Provide more user-friendly and specific error messages.
    *   Consider a global error boundary.
    *   Use `showToast` from `NotificationContext` more consistently.
3.  **Forms:**
    *   **Client-side Validation:** Add more robust client-side validation.
    *   **Rich Text Editors:** For long text fields (bios, lore), consider a rich-text editor.
    *   **Image Handling:** Better previews, client-side cropping/resizing, clearer feedback, allow removal/replacement.
4.  **Navigation & Layout:**
    *   Review overall site navigation (persistent sidebar/top nav).
    *   Ensure consistent responsive design.
5.  **Accessibility (a11y):**
    *   Review forms for labels, keyboard navigability, ARIA attributes, color contrast.
6.  **Empty States:**
    *   Improve "empty state" messages with clear calls to action.

### III. Feature Expansions:

1.  **Direct Messages (`src/app/dm/page.tsx`):**
    *   Real-time: Typing indicators, read receipts, online status.
    *   Message actions: Edit/delete.
    *   Attachments, emoji picker, conversation management (mute, block), search.
2.  **RP Chat (`src/app/admin/test/chat/gdm-rp/page.tsx` & beyond):**
    *   GM Tools: Whisper, impersonation, scene management.
    *   Message editing/deleting.
    *   User presence list, image/file uploads, persistent history (pagination/infinite scroll).
    *   Dedicated RP channels beyond the test page.
3.  **Character System:**
    *   Structured TTRPG character sheets.
    *   Public shareable links (read-only).
    *   Optional: Versioning, comments on profiles.
4.  **Game System:**
    *   Game session scheduling/management.
    *   Integrated play area (link to RP channels/VTT).
    *   Game-specific resources (handouts, maps, linked lore).
5.  **Notifications (`NotificationContext.tsx`, `NotificationBell.tsx`):**
    *   Real-time via WebSockets (instead of polling).
    *   Granular preferences, notification grouping.
    *   Populate "Active Area" in the notification bell.
6.  **User Profiles (`src/app/profile/page.tsx`, `src/app/users/[username]/page.tsx`):**
    *   Display user's public creations.
    *   Optional: Activity feed, friend system/followers.
7.  **Search & Discovery:**
    *   Global search (games, users, public characters, lore).
    *   Advanced filtering/sorting.

### IV. Code Quality & Architecture:

1.  **Shared Types:**
    *   Centralize interfaces in `src/types/index.ts`.
2.  **API Service Layer:**
    *   Abstract `fetch` calls into `src/services/api.ts` or `src/lib/api.ts`.
3.  **Custom Hooks:**
    *   Create hooks for reusable logic (e.g., `useAuth()`, `useFetchData<T>()`, `useWebSocket()`).
4.  **State Management:**
    *   Consider Zustand or Jotai for more complex global state if needed.
5.  **Component Structure:**
    *   Break down large components; organize in `src/components`.
6.  **Styling:**
    *   Create reusable UI primitive components with Tailwind CSS.
7.  **Testing:**
    *   Unit tests (Jest, React Testing Library).
    *   Integration tests.
    *   E2E tests (Playwright, Cypress - later stage).
8.  **Performance:**
    *   Memoization (`React.memo`, `useCallback`, `useMemo`).
    *   Lazy loading (`next/dynamic`, intersection observers).
