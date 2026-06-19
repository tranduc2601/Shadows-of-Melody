# Agent Usage Guide

## Core rule

Always follow:

* `.cursor/rules/project-workflow.mdc`

At the start of each task:

1. Check whether a Superpowers skill applies.
2. If it applies, read and follow it.
3. Inspect before editing.
4. Plan before editing.
5. Wait for user approval before editing.
6. Run verification after editing.
7. Do not claim complete without evidence.

## Important project constraints

Do not change these unless explicitly approved:

* backend API contracts
* database schema
* auth behavior
* payment/subscription contracts
* PlayerBar behavior
* song/favorite behavior
* admin business logic
* permission/authorization behavior

## Current development priority

The current priority is:

```txt
Restore broken PlayerBar/Liked behavior first.
Then decide between Astro stabilization and React migration.
```

## When working on stability

Use small passes only.

Bad task:

```txt
Fix all performance issues.
```

Good task:

```txt
Audit why PlayerBar play-session request is duplicated.
Do not edit code.
Report exact cause and smallest safe patch.
```

## When working on migration

Do not rewrite the whole app.

Bad task:

```txt
Convert the Astro project to React.
```

Good task:

```txt
Create a React migration plan.
Do not edit code.
List phases and first safe implementation step.
```

## Recommended task order

1. Recover PlayerBar/Liked.
2. Verify core flow.
3. Create migration branch.
4. Create React skeleton.
5. Port API client.
6. Port AuthProvider.
7. Port Layout/Sidebar.
8. Port PlayerBar.
9. Port Songs.
10. Port Liked.
11. Port Playlist.
12. Port Artists.
13. Port Subscription.
14. Port Admin last.

## Required reports after code changes

After every implementation pass, report:

* files changed
* functions changed
* why the change was made
* verification command result
* what still needs browser verification
* what was not touched
