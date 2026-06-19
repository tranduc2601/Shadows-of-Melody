# Stability Recovery Task

## Current priority

Before any migration or new optimization, restore the current broken functionality.

## Current regression

After recent defensive patches, these features became unstable or broken:

* PlayerBar does not reliably load song information.
* play/pause may not work.
* like/favorite may not work.
* liked page may not load data correctly.
* backend/local server can crash quickly during interactions.

## Immediate goal

Restore the last known working state for:

* PlayerBar
* Songs play flow
* Like/favorite
* Liked page

## Do not do yet

Do not:

* optimize performance further
* redesign permissions
* migrate to React
* change backend
* change database
* change API contracts
* touch Admin
* add packages
* refactor broadly

## Required recovery steps

1. Inspect current git diff.
2. Focus on recent changes in:

   * `src/pages/liked.astro`
   * `src/components/PlayerBar.astro`
   * any recently changed frontend page boot guards if relevant
3. Identify which changes caused the regression.
4. Revert unsafe changes first.
5. Prefer restoring PlayerBar to last known working behavior.
6. Keep only defensive guards that do not break normal page behavior.
7. Run build.
8. Ask user to verify browser behavior.

## Last known working behavior

Before the regression:

* Songs page loaded correctly.
* Clicking a song updated PlayerBar.
* PlayerBar showed title, artist, and cover.
* play/pause worked.
* skip worked.
* speed worked.
* like/favorite worked.
* liked page loaded.
* The remaining issue was duplicate requests and a possible liked null DOM crash.

## Browser verification checklist

After recovery:

```txt
/songs:
- Songs list loads
- Click song
- PlayerBar title/artist/cover correct
- play/pause works
- skip works
- like/favorite works

/liked:
- Page loads
- liked songs appear
- unlike works
- return to /songs and play still works

Console:
- no new red errors

Backend:
- server should not immediately crash under normal interaction
```
