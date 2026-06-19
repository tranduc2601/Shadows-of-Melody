# React Migration Plan

## Goal

Migrate the frontend from Astro to React + Vite gradually while preserving the existing backend, database, and API contracts.

## Non-goals

Do not:

* rewrite the backend
* change API contracts
* change database schema
* migrate all pages at once
* start with Admin
* change business logic
* change auth behavior without confirmation
* change payment/subscription contracts
* break existing PlayerBar behavior
* break song/favorite/playlist behavior

## Target stack

Recommended frontend stack:

```txt
Vite
React
React Router
Plain CSS/Tailwind reuse if available
Existing API client adapted from src/lib/api.js
```

Optional later:

```txt
React Query / TanStack Query
Zustand
```

Do not add optional packages until there is a clear need and user approval.

## Proposed React structure

```txt
react-frontend/
  src/
    main.jsx
    App.jsx
    router/
      routes.jsx
    layouts/
      MainLayout.jsx
      AdminLayout.jsx
    pages/
      Home.jsx
      Songs.jsx
      Artists.jsx
      Liked.jsx
      Playlist.jsx
      Subscription.jsx
      Admin.jsx
      Login.jsx
      Signup.jsx
      Profile.jsx
      Settings.jsx
    components/
      PlayerBar.jsx
      Sidebar.jsx
      SongCard.jsx
      SongTable.jsx
      ArtistCard.jsx
      PlaylistCard.jsx
    providers/
      AuthProvider.jsx
      PlayerProvider.jsx
      FavoritesProvider.jsx
    lib/
      api.js
      constants.js
      formatters.js
    styles/
      global.css
```

## Migration phases

### Phase 0 - Stabilize current broken state

Before migration, restore:

* PlayerBar title/artist/cover
* play/pause
* skip
* like/favorite
* speed
* liked page loading
* songs page play flow

Do not migrate while the current app is broken.

### Phase 1 - Create migration branch

Create a dedicated branch:

```bash
git checkout -b migrate-react
```

Do not work on main/master directly.

### Phase 2 - Create React skeleton

Create a React + Vite frontend in a separate folder or controlled structure.

Do not delete Astro yet.

Expected result:

* React app starts
* empty routes work
* build passes

### Phase 3 - Port API client

Port or adapt:

* base API URL
* auth token handling
* apiFetch helper
* refreshMe/get current user
* error handling

No UI migration yet.

### Phase 4 - Port AuthProvider

Centralize:

* current user
* token
* login state
* logout
* refreshMe in-flight guard
* no duplicate `/me` request

### Phase 5 - Port MainLayout and Sidebar

Port:

* global layout
* sidebar
* navigation
* route rendering
* basic protected routes

### Phase 6 - Port PlayerBar

PlayerBar must be migrated before interaction-heavy pages.

Requirements:

* one global PlayerBar instance
* one source of truth for current song
* no duplicate global listeners
* no direct DOM manipulation
* no page-specific DOM refresh from PlayerBar
* player state should live in provider/store

Verify:

* play song
* pause
* skip
* speed
* favorite
* title/artist/cover
* no duplicate play-session request

### Phase 7 - Port Songs page

Port:

* song list
* search
* sort
* filter
* play from row/card
* favorite
* add to playlist if currently supported

Verify:

* songs load
* no duplicate `/songs`
* no duplicate `/is-favorite`
* PlayerBar updates correctly

### Phase 8 - Port Liked page

Port:

* favorites list
* unlike
* play from liked
* return to liked after navigation
* no DOM null crash

Verify:

* liked loads
* unlike updates UI
* PlayerBar favorite state syncs
* no page refresh after unmount

### Phase 9 - Port Playlist page

Port:

* user playlists
* create playlist
* playlist detail if present
* add/remove songs if present

### Phase 10 - Port Artists and Subscription

Port:

* artists list/detail
* subscription plans
* payments view
* current subscription state

### Phase 11 - Port Admin last

Admin should be migrated after core user music flows are stable.

Admin is high risk because it includes:

* many tables
* filters
* modals
* analytics
* section switching
* manager permissions
* heavy DOM

## Verification after every phase

Run:

```bash
npm run build
```

Then manually verify the specific phase.

Do not claim complete without browser verification.

## Rollback plan

Each phase must be small enough to revert.

If a phase breaks core behavior:

1. stop immediately
2. inspect diff
3. revert only the broken phase
4. restore last known working behavior
5. do not stack additional fixes on top of broken code
