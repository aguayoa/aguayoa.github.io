# Projects

A small web app with a page for each project I'm working on, plus a Markdown tracker and GitHub issue forms.

**Projects:** AI Data Analytics · Javlin Concepts · Aware · Fridge Cig

## Files

| File | Purpose |
|---|---|
| `index.html` | Home page with a button for each project |
| `project.html` | Detail page for each project (`project.html?id=aware`) |
| `assets/projects.js` | **Edit this** to change project info, tasks, and status |
| `assets/style.css` | Styling (light and dark mode) |
| `PROJECT_TRACKER.md` | Checklist version that renders on GitHub |
| `.github/ISSUE_TEMPLATE/` | Forms for tasks, bugs, and features |

## Viewing locally

Double-click `index.html` to open it in your browser.

## Updating

- **Check off a task:** in `assets/projects.js`, change `done: false` to `done: true`.
- **Change status:** set `status` to `active`, `planning`, `talks`, `paused`, or `done`.
- **Add a project:** copy one `{ ... }` block in `assets/projects.js` and give it a new `id`.

## Put it on GitHub (and make it a live website)

```bash
git init
git add .
git commit -m "Add Projects site"
gh repo create projects --public --source=. --push
```

Then on GitHub, go to **Settings → Pages**, choose **Deploy from a branch**, and select `main` / `root`.
Your site will be live at `https://<your-username>.github.io/projects/`.

> GitHub Pages on a free account requires a **public** repo. Don't put anything private in these files.
