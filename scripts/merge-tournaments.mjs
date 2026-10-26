// Junta torneios novos em data/tournaments.json, substituindo os que tiverem o mesmo id.
// Uso: node scripts/merge-tournaments.mjs novos.json
import fs from "node:fs";

const file = new URL("../data/tournaments.json", import.meta.url);
const current = JSON.parse(fs.readFileSync(file, "utf8"));
const incoming = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

const byId = new Map(current.map((e) => [e.id, e]));
let added = 0, updated = 0;
for (const e of incoming) {
  if (!e.id || !Array.isArray(e.standings)) continue;
  byId.has(e.id) ? updated++ : added++;
  byId.set(e.id, e);
}
const merged = [...byId.values()].sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.players || 0) - (a.players || 0));
fs.writeFileSync(file, JSON.stringify(merged, null, 1) + "\n");
console.log(`${added} novos, ${updated} atualizados, ${merged.length} torneios no total.`);
