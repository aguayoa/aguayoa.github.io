# aguayoa.github.io

My personal homepage: a Projects section with a page per project, and a walk-in VR Calendar.

**Projects:** AI Data Analytics · Javlin Concepts · Aware · Fridge Cig

## Pages

| Page | URL | File |
|---|---|---|
| Home | `/` | `index.html` |
| Projects | `/projects/` | `projects/index.html`, `projects/project.html` |
| Calendar (VR) | `/calendar/` | `calendar/index.html` |

## Files you edit

| File | What it controls |
|---|---|
| `assets/projects.js` | Project info, tasks, status |
| `assets/events.js` | Events shown on the Calendar wall |
| `index.html` | Greeting name (`OWNER`) |
| `calendar/index.html` | Fiscal year settings (`FY_START_MONTH`, `FY_CHOICES`) |

## Updating

- **Check off a task:** in `assets/projects.js`, change `done: false` to `done: true`.
- **Change status:** set `status` to `active`, `planning`, `talks`, `paused`, or `done`.
- **Add a project:** copy one `{ ... }` block in `assets/projects.js` and give it a new `id`.
- **Add a calendar event:** add `{ date: "2026-03-15", title: "Short title" }` to `assets/events.js`.

## Calendar in VR

Open `https://aguayoa.github.io/calendar/` in your headset's browser (e.g. Meta Quest Browser) and press **VR**.
Left stick walks, right stick turns, trigger picks a month to bring it close.

## Publishing

Live at **https://aguayoa.github.io/**. Push to `main` and GitHub Pages updates within a minute:

```bash
git add .
git commit -m "Update site"
git push
```

> GitHub Pages on a free account requires a **public** repo. Don't put anything private in these files.
