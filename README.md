# Life Productivity — To-Do App

This repository contains the Life Productivity To-Do application — a client-side, multi-account task manager built with HTML/CSS/JS and stored in the browser's `localStorage`.

## Features
- Create multiple accounts (local only)
- Sections: Personal, Home, School, Work
- Add / edit / delete (archive) tasks with optional due date/time
- Next-task countdown and "next" highlight
- Progress bar per section
- Task history (archived tasks)
- Dark / Light theme toggle
- Responsive, centered, CodePen-style visual design

## How to publish
1. Copy `index.html`, `styles.css`, `script.js` into the root of a GitHub repository.
2. Commit & push to the `main` branch.
3. On GitHub: `Settings` → `Pages` → Source → `main` branch / root → Save.
4. Visit `https://<your-username>.github.io/<repo-name>/` after a short moment.

## Notes
- This is a local demo app. Passwords are stored in plaintext in localStorage — do not use real passwords.
- To back up or move data, use the browser DevTools to copy the `lp_users_v1` localStorage entry, or ask me to add import/export functionality.

Enjoy! — If you want, I can also create a ready zip or show git commands to create the repo locally.
