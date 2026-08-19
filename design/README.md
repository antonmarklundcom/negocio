# design/

The visual source of truth for negocio.com.py, and nothing else.

| File | What it is |
|---|---|
| `BRIEF.md` | The original design brief and the three rounds of direction that produced the reference. Kept because it records *why* the palette, the type scale and the free/premium split are what they are — the reference file shows the what, this shows the intent. |
| `reference.html` | The approved visual reference. `README.md` → Design points at this; the Tailwind tokens in `tailwind.config.ts` and `app/globals.css` are derived from it. |
| `support.js` | The reference's own runtime. Only meaningful when opening `reference.html` directly in a browser. |

## What was removed, and how to get it back

`chats/` and `project/` were pruned in ROADMAP W1-5.

- `chats/chat1.md` was not deleted — it is `BRIEF.md` above.
- `project/` held Claude Design canvas exports of the same detail page
  (`Negocio Detail.dc.html`, a standalone HTML render, `image-slot.js`) plus a
  byte-identical copy of `support.js`. Every one of them is a working artefact
  that `reference.html` supersedes, and none is referenced by any code, doc or
  build step.

Nothing is lost: `git log --diff-filter=D -- project/` finds the commit that
removed them, and `git show <commit>^:project/<file>` prints any of them back.
