// Pure text-processing utilities — no DOM dependencies.
// Loaded by reader.html and by tests/prose-cleanup.test.html.

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Anna's Archive filename format: "Title -- Author -- ... -- Anna's Archive.zip"
function extractTitle(filename) {
  const base = filename
    .replace(/\.zip$/i, '')
    .replace(/\s*--\s*Anna['']s Archive\s*$/i, '');
  const parts = base.split(/\s+--\s+/);
  return parts[0].trim() || filename;
}

function isBlankPage(text) {
  return text.replace(/\s/g, '').length < 10;
}

function rejoinHyphenatedBreaks(text) {
  return text.replace(/(\w)-\n(\w)/g, '$1$2');
}

// Collapses OCR-spaced characters like "c e r e m o n i a l" → "ceremonial".
// Requires 4+ single letters to avoid false positives on real short words.
function collapseIntraWordSpaces(text) {
  return text.replace(/\b([a-záéíóúüñ] ){3,}[a-záéíóúüñ]\b/gi, m => m.replace(/ /g, ''));
}

function normalizeWhitespace(text) {
  return text
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ \n/g, '\n')
    .trim();
}

function stripPageHeaderFooter(text) {
  const lines = text.split('\n');
  const isNoise = l => {
    const t = l.trim();
    if (!t) return true;
    if (/^\d+$/.test(t)) return true;
    if (t.length < 30 && t === t.toUpperCase() && /[A-Z]/.test(t)) return true;
    return false;
  };
  while (lines.length && isNoise(lines[0])) lines.shift();
  while (lines.length && isNoise(lines[lines.length - 1])) lines.pop();
  return lines.join('\n');
}

function applyProseCleanup(text) {
  text = rejoinHyphenatedBreaks(text);
  text = collapseIntraWordSpaces(text);
  text = normalizeWhitespace(text);
  text = stripPageHeaderFooter(text);
  return text;
}

function renderProse(text) {
  const cleaned = applyProseCleanup(text);
  const paragraphs = cleaned.split(/\n\n+/)
    .filter(p => p.trim())
    .map(p => `<p>${escapeHtml(p.replace(/\n/g, ' '))}</p>`)
    .join('');
  if (!paragraphs) {
    return `<p style="color:var(--accent);font-style:italic">[Page contains no readable text]</p>`;
  }
  return paragraphs;
}

function renderFaithful(text) {
  return `<pre>${escapeHtml(text)}</pre>`;
}
