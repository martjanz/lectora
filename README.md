# Lectora

A single-file offline book reader for Anna's Archive ZIP+TXT books, with fallback support for PDF, EPUB, DjVu, and comic formats.

No server required — open `index.html` directly in any modern browser.

**[Try it live →](https://martjanz.github.io/lectora/)**

## Usage

1. Open `index.html` in your browser (or use the [live version](https://martjanz.github.io/lectora/))
2. Drop a book file onto the drop zone, or click to browse

## Supported Formats

| Format | Handler |
|--------|---------|
| `.zip` (OCR text pages) | Built-in ZIP+TXT reader |
| `.pdf` | PDF.js (requires Anna's Archive server) |
| `.epub`, `.fb2`, `.mobi`, `.azw3` | Foliate.js (requires server) |
| `.djvu` | DjVu.js (bundled) |
| `.cbz`, `.cbr` | Kthoom (requires server) |
| `.rar`, `.zip` (images) | Villain comic reader (bundled) |

> PDF, EPUB, CBZ/CBR readers depend on paths served by Anna's Archive's local server (`/pdfjs/`, `/foliatejs/`, `/kthoom/`). DjVu and comic ZIP/RAR work fully offline.

## ZIP+TXT Reader

Anna's Archive books downloaded as ZIP files contain one `.txt` file per scanned page. Lectora reads these directly with two display modes:

**Prose mode** (default) — OCR cleanup pipeline runs on each page:
- Rejoins hyphenated line breaks (`cer-\nemonial` → `ceremonial`)
- Collapses OCR-spaced characters (`c e r e m o n i a l` → `ceremonial`)
- Strips running page headers and footers
- Renders as flowing paragraphs with comfortable typography

**Faithful mode** — raw OCR text, monospace, preserving original layout

Toggle with the `Prose` / `Faithful` button or press `f`.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `→` / `l` / `Space` | Next page |
| `←` / `h` | Previous page |
| `Home` | First page |
| `End` | Last page |
| `f` | Toggle Faithful ↔ Prose mode |
| `d` | Toggle dark mode |
| `+` / `=` | Increase font size |
| `-` | Decrease font size |

Click the left or right edge of the page area to navigate. Click the progress bar to jump to any page.

Reading position and font/theme preferences are saved to `localStorage` per book.

## Project Structure

```
index.html           — thin HTML shell, loads all scripts
src/
  cleanup.js         — pure OCR text-processing functions (no DOM)
  reader.js          — app state, routing, DOM event handling
  reader.css         — all styles
vendor/              — third-party libraries (see THIRD_PARTY_LICENSES.md)
tests/
  prose-cleanup.test.html  — browser-based unit tests (open in browser to run)
```

## Running Tests

Open `tests/prose-cleanup.test.html` in a browser. All results render inline — no build step or test runner needed.

## License

Lectora source code is licensed under [GPL-2.0](LICENSE).

Third-party libraries in `vendor/` carry their own licenses — see [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) for details. The GPL-2.0 license was chosen because the bundled `djvu.js` / `djvu_viewer.js` are GPL-2.0, and their copyleft terms extend to the combined work.
