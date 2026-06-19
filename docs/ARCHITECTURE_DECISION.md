# Architecture Decision - Astro Stabilization vs React Migration

## Current problem

The Astro frontend currently has severe runtime instability.

Observed symptoms:

* Rapid navigation can cause duplicated requests.
* Backend/local server can become unresponsive or crash.
* PlayerBar and Liked page are fragile.
* Multiple requests often appear in backend logs as paired duplicates:

  * `GET /me`
  * `GET /`
  * `GET /:id/is-favorite`
  * `POST /play-session`
  * `GET /plans`
  * `GET /payments`
* Page-level scripts and global components can continue running after navigation.
* Some async callbacks try to write to DOM that has already been removed.

## Important clarification

The backend is the place that crashes, but the likely root cause is frontend request storm and duplicated runtime behavior.

The frontend can create too many duplicated API calls through:

* repeated page boot
* repeated event listener registration
* global PlayerBar listeners
* page scripts re-running after Astro client navigation
* missing request in-flight guards
* missing cleanup after route changes
* page-specific DOM refresh running after page unmount

## Why Astro is struggling here

Astro is excellent for:

* content websites
* landing pages
* blogs
* documentation
* mostly static pages
* SEO-heavy pages
* low-interaction pages

This project is closer to a full SPA/web app:

* global music player
* persistent PlayerBar
* real-time like/favorite state
* playlists
* liked page
* subscriptions
* admin dashboard
* auth state
* many client-side interactions
* many route transitions
* many API calls

Astro can support this, but the current implementation uses many page-level scripts and global events, which makes lifecycle control difficult.

## Bad direction

Do not convert Astro into a custom vanilla JS SPA where:

* Astro only renders shell/images
* JS manually renders all item lists
* JS manually manages lifecycle, cleanup, state, and routing

This would remove many benefits of Astro while still not providing the structured state/lifecycle system of React.

## Recommended direction

Preferred long-term direction:

* React + Vite + React Router frontend
* keep existing backend/API unchanged
* migrate gradually
* do not rewrite everything at once

React is a better fit for this project because it can centralize:

* auth state
* player state
* favorite state
* playlist state
* route cleanup
* request cancellation
* component lifecycle
* global UI state

## Decision

Recommended path:

1. Restore the current broken PlayerBar/Liked functionality first.
2. Stop deep patching Astro performance randomly.
3. Create a separate migration branch.
4. Build a React + Vite frontend in parallel.
5. Keep backend/API contracts unchanged.
6. Port features gradually.
7. Admin page should be migrated later, not first.
