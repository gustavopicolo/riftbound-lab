export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const safeUrl = (u) => {
  try {
    const x = new URL(String(u));
    return x.protocol === "https:" || x.protocol === "http:" ? x.href : "";
  } catch {
    return "";
  }
};

export const legendShort = (l) => String(l || "").split(",")[0].trim();
export const yt = (q) => "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
export const tw = (q) => "https://www.twitch.tv/search?term=" + encodeURIComponent(q);

// Markdown leve e seguro: escapa tudo antes de aplicar negrito, código, títulos e listas.
export function md(src) {
  const lines = String(src).split("\n");
  let html = "";
  let inList = false;
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");
  for (const raw of lines) {
    const l = raw.trimEnd();
    const li = /^\s*[-*•]\s+(.*)/.exec(l);
    if (li) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += "<li>" + inline(li[1]) + "</li>";
      continue;
    }
    if (inList) { html += "</ul>"; inList = false; }
    if (/^###\s+/.test(l)) html += "<h4>" + inline(l.replace(/^###\s+/, "")) + "</h4>";
    else if (/^#{1,2}\s+/.test(l)) html += "<h3>" + inline(l.replace(/^#{1,2}\s+/, "")) + "</h3>";
    else if (l.trim()) html += "<p>" + inline(l) + "</p>";
  }
  if (inList) html += "</ul>";
  return html;
}

export const lessonsOf = (a) => ((/Lições[^\n]*\n+([\s\S]*)/i.exec(a || "") || [])[1] || "").slice(0, 600);

export function firstLesson(a) {
  const block = lessonsOf(a) || a || "";
  const line = block.split("\n").find((l) => /^\s*[-*•]/.test(l));
  return line ? line.replace(/^\s*[-*•]\s*/, "").replace(/\*\*/g, "") : "";
}
