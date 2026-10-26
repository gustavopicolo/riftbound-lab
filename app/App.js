"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { md, legendShort, lessonsOf, firstLesson, safeUrl, yt, tw } from "@/lib/util";
import { EXAMPLE_LOG } from "@/lib/example";

const VIEWS = ["analisador", "buscador"];

export default function App({ events }) {
  const [view, setView] = useState("analisador");
  useEffect(() => {
    const route = () => {
      const h = (location.hash || "").replace("#", "");
      setView(VIEWS.includes(h) ? h : "analisador");
    };
    route();
    addEventListener("hashchange", route);
    return () => removeEventListener("hashchange", route);
  }, []);

  const session = useSession();

  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <h1>Riftbound Lab</h1>
          <p>Revise suas partidas e encontre quem joga bem cada lenda.</p>
        </div>
        <nav className="tabs" aria-label="Ferramentas">
          <a href="#analisador" aria-current={view === "analisador" ? "page" : undefined}>Analisador de partidas</a>
          <a href="#buscador" aria-current={view === "buscador" ? "page" : undefined}>Jogadores e decks</a>
        </nav>
      </header>

      <section className="view" hidden={view !== "analisador"}>
        <Analyzer session={session} legends={useLegendList(events)} />
      </section>
      <section className="view" hidden={view !== "buscador"}>
        <Finder events={events} />
      </section>

      <footer className="legal">
        Riftbound Lab was created under Riot Games&apos; &quot;Legal Jibber Jabber&quot; policy using assets owned by Riot Games.
        Riot Games does not endorse or sponsor this project. Resultados de torneios: riftdecks.com.
      </footer>
    </div>
  );
}

/* ---------------- Sessão ---------------- */
function useSession() {
  const [session, setSession] = useState(null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return session;
}

function AuthBox({ session }) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  if (!supabase) return <p className="note">Login indisponível: o Supabase ainda não foi configurado.</p>;
  if (session) {
    return (
      <div className="auth">
        <span>Conectado como {session.user.email}</span>
        <button className="btn small" type="button" onClick={() => supabase.auth.signOut()}>Sair</button>
      </div>
    );
  }
  const send = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setMsg("Enviando…");
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: location.origin } });
    setMsg(error ? "Não deu para enviar o link. Confira o e-mail." : "Link de acesso enviado. Abra seu e-mail.");
  };
  return (
    <form className="auth" onSubmit={send}>
      <label htmlFor="login-email" style={{ margin: 0 }}>Entre para analisar e salvar partidas:</label>
      <input id="login-email" type="text" inputMode="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="btn small" type="submit">Receber link</button>
      {msg && <span>{msg}</span>}
    </form>
  );
}

/* ---------------- Analisador ---------------- */
function Analyzer({ session, legends }) {
  const [my, setMy] = useState("");
  const [opp, setOpp] = useState("");
  const [result, setResult] = useState("L");
  const [format, setFormat] = useState("bo1");
  const [log, setLog] = useState("");
  const [notes, setNotes] = useState("");
  const [out, setOut] = useState({ label: "Análise", text: "", state: "empty", error: "" });
  const [last, setLast] = useState(null);
  const [saveState, setSaveState] = useState("hidden");
  const [matches, setMatches] = useState([]);
  const ctl = useRef(null);

  const token = session?.access_token;

  useEffect(() => {
    if (!supabase || !session) { setMatches([]); return; }
    supabase.from("matches").select("*").order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => setMatches(data || []));
  }, [session]);

  const stream = async (payload, label, onDone) => {
    if (!token) { setOut({ label, text: "", state: "error", error: "Entre na sua conta para usar a análise." }); return; }
    ctl.current = new AbortController();
    setOut({ label, text: "", state: "thinking", error: "" });
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
        signal: ctl.current.signal,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setOut({ label, text: "", state: "error", error: j.error || "A análise falhou. Tente de novo." });
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let text = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        setOut({ label, text, state: "streaming", error: "" });
      }
      setOut({ label, text, state: "done", error: "" });
      onDone?.(text);
    } catch (e) {
      if (e.name !== "AbortError") setOut((o) => ({ ...o, state: "error", error: "A conexão caiu. Tente de novo." }));
      else setOut((o) => ({ ...o, state: "done" }));
    }
  };

  const analyze = () => {
    if (!log.trim()) { setOut({ label: "Análise", text: "", state: "error", error: "Cole o log da partida antes de analisar." }); return; }
    const f = { myLegend: my, oppLegend: opp, result, format, log, notes };
    setSaveState("hidden");
    stream({ kind: "match", ...f }, "Análise", (text) => { setLast({ ...f, analysis: text }); setSaveState("ready"); });
  };

  const save = async () => {
    if (!last || !supabase) return;
    setSaveState("saving");
    const { data, error } = await supabase.from("matches").insert({
      my_legend: last.myLegend, opp_legend: last.oppLegend, result: last.result, format: last.format,
      log: last.log.slice(0, 60000), notes: last.notes, analysis: last.analysis,
    }).select().single();
    if (error) { setSaveState("error"); return; }
    setMatches((m) => [data, ...m]);
    setSaveState("saved");
  };

  const patterns = () => {
    const items = matches.slice(0, 30).map((m) => ({ myLegend: m.my_legend, oppLegend: m.opp_legend, result: m.result, lessons: lessonsOf(m.analysis) }));
    setSaveState("hidden");
    stream({ kind: "patterns", matches: items }, "Seus padrões");
  };

  const openMatch = (m) => {
    setMy(m.my_legend || ""); setOpp(m.opp_legend || ""); setResult(m.result || "L"); setFormat(m.format || "bo1");
    setLog(m.log || ""); setNotes(m.notes || "");
    setOut({ label: "Partida salva · " + new Date(m.created_at).toLocaleDateString("pt-BR"), text: m.analysis || "", state: "done", error: "" });
    setSaveState("hidden");
  };

  const busy = out.state === "thinking" || out.state === "streaming";

  return (
    <div className="grid">
      <div className="panel">
        <h2>Nova partida</h2>
        <p className="sub">Cole o log da partida do RiftAtlas (ou escreva os turnos do seu jeito). O Claude aponta os momentos decisivos e linhas melhores.</p>
        <div className="fields">
          <div className="row">
            <div className="f"><label htmlFor="my-legend">Sua lenda</label><input type="text" id="my-legend" list="legend-list" placeholder="ex.: Diana" value={my} onChange={(e) => setMy(e.target.value)} /></div>
            <div className="f"><label htmlFor="opp-legend">Lenda do oponente</label><input type="text" id="opp-legend" list="legend-list" placeholder="ex.: Riven" value={opp} onChange={(e) => setOpp(e.target.value)} /></div>
          </div>
          <datalist id="legend-list">{legends.map((l) => <option key={l} value={l} />)}</datalist>
          <div className="row">
            <div><label>Resultado</label>
              <Seg value={result} onChange={setResult} options={[["W", "Vitória"], ["L", "Derrota"]]} />
            </div>
            <div><label>Formato</label>
              <Seg value={format} onChange={setFormat} options={[["bo1", "Bo1"], ["bo3", "Bo3"]]} />
            </div>
          </div>
          <div>
            <label htmlFor="log">Log da partida</label>
            <textarea id="log" rows={13} spellCheck={false} value={log} onChange={(e) => setLog(e.target.value)} />
          </div>
          <div>
            <label htmlFor="notes">O que você quer revisar? <span className="note">(opcional)</span></label>
            <input type="text" id="notes" placeholder="ex.: perdi o controle do campo no turno 5, não sei onde errei" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="actions">
            <button className="btn primary" type="button" onClick={analyze} disabled={busy}>Analisar partida</button>
            {busy && <button className="btn" type="button" onClick={() => ctl.current?.abort()}>Parar</button>}
            <button className="btn" type="button" onClick={() => { setMy("Diana"); setOpp("Riven"); setResult("L"); setFormat("bo1"); setLog(EXAMPLE_LOG); setNotes("Perdi o controle dos campos no T3–T4. Onde errei?"); }}>Carregar exemplo</button>
            <button className="btn" type="button" onClick={() => { setMy(""); setOpp(""); setLog(""); setNotes(""); }}>Limpar</button>
          </div>
          <AuthBox session={session} />
        </div>
      </div>

      <div className="panel out">
        <div className="actions" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <span className="eyebrow">{out.label}</span>
          {saveState !== "hidden" && session && (
            <button className="btn small" type="button" onClick={save} disabled={saveState === "saving" || saveState === "saved"}>
              {saveState === "saved" ? "Salvo" : saveState === "error" ? "Não salvou, tente de novo" : "Salvar no diário"}
            </button>
          )}
        </div>
        {out.state === "empty" && <div className="empty">A análise aparece aqui. Use <strong>Carregar exemplo</strong> para ver como funciona com uma partida fictícia.</div>}
        {out.state === "thinking" && <p className="thinking">Analisando…</p>}
        {out.text && <div className="md" dangerouslySetInnerHTML={{ __html: md(out.text) }} />}
        {out.error && <div className="empty">{out.error}</div>}

        <div className="divider" />
        <div className="actions" style={{ justifyContent: "space-between" }}>
          <span className="eyebrow">Diário de partidas</span>
          <button className="btn small" type="button" onClick={patterns} disabled={matches.length < 2 || busy}>Ver meus padrões</button>
        </div>
        <div className="hist">
          {!session && <p className="note">Entre na sua conta para salvar partidas. Só você vê o seu diário.</p>}
          {session && !matches.length && <p className="note">Nenhuma partida salva ainda. Depois de uma análise, use <strong>Salvar no diário</strong>.</p>}
          {matches.map((m) => (
            <button key={m.id} type="button" onClick={() => openMatch(m)}>
              <span className={`res ${m.result === "W" ? "W" : "L"}`}>{m.result === "W" ? "V" : "D"}</span>
              <span className="t">{m.my_legend || "?"} × {m.opp_legend || "?"} — {firstLesson(m.analysis) || "sem lição"}</span>
              <span className="d">{new Date(m.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Seg({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map(([v, label]) => (
        <button key={v} type="button" data-v={v} aria-pressed={value === v} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  );
}

/* ---------------- Buscador ---------------- */
function useLegendList(events) {
  return useMemo(() => {
    const s = new Set();
    for (const e of events) for (const r of e.standings) if (r.legend) s.add(legendShort(r.legend));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [events]);
}

function Finder({ events }) {
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState("");
  const legends = useLegendList(events);
  const rows = useMemo(() => {
    const out = [];
    for (const ev of events) for (const s of ev.standings) out.push({ ...s, ev });
    return out;
  }, [events]);
  const total = rows.length;
  const evSorted = useMemo(() => events.slice().sort((a, b) => (b.players || 0) - (a.players || 0)), [events]);

  const better = (a, b) => ((a.rank || 999) - (b.rank || 999)) || ((b.ev.players || 0) - (a.ev.players || 0));
  const query = q.trim().toLowerCase();
  let filtered = rows;
  if (sel) filtered = filtered.filter((r) => legendShort(r.legend) === sel);
  if (query) filtered = filtered.filter((r) => [r.player, r.legend, r.ev.name].some((x) => String(x || "").toLowerCase().includes(query)));
  filtered = filtered.slice().sort(better);
  const groups = new Map();
  for (const r of filtered) {
    const k = String(r.player).trim().toLowerCase() + "|" + legendShort(r.legend);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const list = [...groups.values()].map((g) => ({ best: g[0], all: g }))
    .sort((a, b) => (Number(b.all.length >= 2) - Number(a.all.length >= 2)) || better(a.best, b.best));
  const many = list.filter((x) => x.all.length >= 2).length;

  const title = sel ? (filtered[0]?.legend || sel) : query ? `Busca: “${q.trim()}”` : "Selecione uma lenda";

  return (
    <div className="grid">
      <div className="panel">
        <h2>Escolha uma lenda</h2>
        <p className="sub">Jogadores que fizeram boas campanhas com cada lenda em torneios, com a lista e atalhos para vídeos deles jogando.</p>
        <div className="fields">
          <div><label htmlFor="q">Buscar jogador ou lenda</label><input type="search" id="q" placeholder="ex.: Riven, Sithis, Kennen" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="legends">
            {legends.map((l) => (
              <button key={l} type="button" className="chip" aria-pressed={l === sel} onClick={() => setSel(sel === l ? null : l)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="divider" />
        <span className="eyebrow">Torneios na base</span>
        <div className="events" style={{ marginTop: 8 }}>
          {evSorted.slice(0, 6).map((e) => <EventRow key={e.id} e={e} />)}
          {evSorted.length > 6 && (
            <details>
              <summary className="note" style={{ cursor: "pointer" }}>Ver mais {evSorted.length - 6} torneios</summary>
              <div className="events" style={{ marginTop: 6 }}>{evSorted.slice(6).map((e) => <EventRow key={e.id} e={e} />)}</div>
            </details>
          )}
        </div>
        <p className="statusline">{total} colocações em {events.length} torneios do meta Radiance. Fonte: riftdecks.com.</p>
      </div>

      <div className="panel">
        <div className="lg-head">
          <div><span className="eyebrow">{sel ? "Lenda" : query ? "Jogadores" : "Resultados"}</span><h2>{title}</h2></div>
          {sel && (
            <div className="links">
              <a href={yt(`Riftbound ${sel} gameplay`)} target="_blank" rel="noopener noreferrer">Vídeos no YouTube</a>
              <a href={tw("Riftbound")} target="_blank" rel="noopener noreferrer">Twitch</a>
              <a href="https://riftatlas.com/decks" target="_blank" rel="noopener noreferrer">Decks no RiftAtlas</a>
            </div>
          )}
        </div>
        {!sel && !query && <div className="empty note" style={{ border: "1px dashed var(--line)", borderRadius: 8, padding: 18 }}>Escolha uma lenda à esquerda ou busque um jogador pelo nome.</div>}
        {(sel || query) && !list.length && <p className="note">Nada encontrado nos torneios da base.</p>}
        {(sel || query) && list.length > 0 && (
          <>
            {sel && <p className="note" style={{ margin: "0 0 10px" }}>{list.length} jogadores com bons resultados de {sel}{many ? `; ${many} aparecem em mais de um torneio e vêm primeiro` : ""}.</p>}
            <div className="tablewrap">
              <table>
                <thead><tr><th>Melhor</th><th>Jogador</th>{!sel && <th>Lenda</th>}<th>Torneios</th><th>Estudar</th></tr></thead>
                <tbody>
                  {list.slice(0, 150).map(({ best: r, all }) => {
                    const deck = safeUrl(r.deck);
                    return (
                      <tr key={r.player + r.legend + r.ev.id}>
                        <td className="num">{r.place || `${r.rank}º`}</td>
                        <td>
                          <strong>{r.player}</strong>
                          {all.length > 1 ? (
                            <details>
                              <summary className="ev" style={{ cursor: "pointer" }}>Ver os {all.length} resultados</summary>
                              <div className="ev">
                                {all.map((x) => (
                                  <div key={x.ev.id + x.place}>
                                    {x.place || `${x.rank}º`} · {x.ev.name} ({x.ev.players || "?"} jog.)
                                    {safeUrl(x.deck) && <> · <a href={safeUrl(x.deck)} target="_blank" rel="noopener noreferrer" style={{ color: "var(--rune)" }}>lista</a></>}
                                  </div>
                                ))}
                              </div>
                            </details>
                          ) : (
                            <div className="ev">{r.ev.name} · {r.ev.players || "?"} jog.{r.record ? ` · ${r.record}` : ""}</div>
                          )}
                        </td>
                        {!sel && <td>{legendShort(r.legend)}</td>}
                        <td className="num">{all.length}</td>
                        <td>
                          <div className="links">
                            {deck && <a href={deck} target="_blank" rel="noopener noreferrer">Lista</a>}
                            <a href={yt(`Riftbound ${r.player} ${legendShort(r.legend)}`)} target="_blank" rel="noopener noreferrer">YouTube</a>
                            <a href={tw(r.player)} target="_blank" rel="noopener noreferrer">Twitch</a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="callout" style={{ marginTop: 14 }}><strong>Como estudar com isto:</strong> abra a lista do jogador, depois os vídeos dele com a mesma lenda. Os links de vídeo abrem buscas no YouTube e na Twitch, então confira se o vídeo é mesmo da pessoa.</div>
      </div>
    </div>
  );
}

function EventRow({ e }) {
  const url = safeUrl(e.source);
  const d = String(e.date || "").slice(5).split("-").reverse().join("/");
  return (
    <div>
      <span>{url ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--rune)" }}>{e.name}</a> : e.name}</span>
      <span>{d} · {e.players || "?"} jog.</span>
    </div>
  );
}
