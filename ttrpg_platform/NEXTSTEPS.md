# Next Steps for TTRPG Platform Development

This document outlines potential future features and improvements for both the backend (FastAPI) and frontend (Next.js) parts of the TTRPG Platform.

## Backend Next Steps (FastAPI):

1.  **Enhanced User Profiles:**
    *   Allow users to add more details (bio, social links, profile picture/avatar URL).
    *   Update `User` model and `schemas.User` to include these new fields.
    *   Create CRUD operations and API endpoints for managing these profile details.
2.  **Password Reset Functionality:**
    *   Implement a secure flow for users to request password resets (e.g., via email with a unique token).
    *   Endpoints for initiating reset, validating token, and setting a new password.
3.  **Game Invitations & Notifications System:**
    *   Allow GMs to invite specific users to their games.
    *   Develop a basic notification system (e.g., "User X invited you to Game Y," "Your message was read"). This could involve new database models and WebSocket enhancements.
4.  **Advanced Game Search & Filtering:**
    *   Allow searching games by name, description, GM username, or even tags (if you add a tagging system).
    *   Implement more complex filtering options (e.g., games with open slots, specific game systems if you plan to support them).
5.  **Character Sheet Management (Basic):**
    *   Design a basic model for character sheets (e.g., name, game_id, user_id, and a JSON field for stats).
    *   CRUD APIs for users to create, view, update, and delete their character sheets for specific games.
6.  **Rate Limiting:**
    *   Implement rate limiting on sensitive endpoints (like login, registration) to prevent abuse using a library like `slowapi`.
7.  **Admin Panel Enhancements:**
    *   Expand the `/admin/users` endpoint or create new ones for GMs/admins to manage games (e.g., edit game details, deactivate games).
    *   Consider more robust user management (e.g., deactivating users).
8.  **Audit Logging (Basic):**
    *   Log important actions like user registration, game creation, or administrative changes to a separate table or logging system for traceability.
9.  **API for Game System Tags/Categories:**
    *   If you plan to support different TTRPG systems (D&D, Pathfinder, etc.), create a way to tag games with their system.
    *   Endpoints to list available systems and filter games by system.
10. **Background Tasks for Notifications (Celery/RQ):**
    *   For more complex or non-real-time notifications (like email summaries), integrate a task queue like Celery or RQ. This is a more advanced step but good for scalability.

## Frontend Next Steps (Next.js):

1.  **User Profile Page:**
    *   Create a page where users can view and edit their profile information (username, email, and any new fields from backend step #1).
    *   Implement avatar display.
2.  **Password Reset UI Flow:**
    *   Forms for requesting a password reset (entering email).
    *   A page for entering a new password using the token received via email.
3.  **Notifications UI:**
    *   A dedicated section or a dropdown to display notifications received via WebSockets or fetched from the API.
    *   Mark notifications as read.
4.  **Game Invitation UI:**
    *   For GMs: An interface within the game management view to search for users and send game invitations.
    *   For Players: A way to see and accept/decline game invitations (could be part of notifications).
5.  **Character Sheet Interface (Basic):**
    *   A UI for users to create, view, and edit their character sheets within a game's context.
    *   Display a list of their characters.
6.  **Enhanced Game Discovery Page:**
    *   Implement UI elements for the advanced search and filtering capabilities developed on the backend (search bars, dropdowns for filters).
7.  **Improved State Management for User/Auth:**
    *   Consider using React Context or a lightweight state manager (like Zustand) to manage global user authentication state more robustly across components, rather than just relying on `localStorage` directly in every component.
8.  **Admin/GM Game Management UI:**
    *   If you add backend features for GMs to edit their games, create the corresponding UI forms and views.
9.  **UI for Game System Tags/Filtering:**
    *   Display game system tags on game cards/details.
    *   Allow users to filter the game list by system.
10. **Refine Mobile Responsiveness & UX:**
    *   Go through all existing pages and ensure they are fully responsive and provide a good user experience on various screen sizes.
    *   Improve loading states, error handling visuals, and overall flow.