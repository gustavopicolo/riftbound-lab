import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { buildAnalysisPrompt, buildPatternsPrompt } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const DAILY_LIMIT = Number(process.env.DAILY_ANALYSIS_LIMIT || 30);

// Contador simples em memória por instância. Serve como freio contra abuso;
// para um limite exato entre instâncias, mova para uma tabela no Supabase.
const usage = new Map();
function overLimit(userId) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `${userId}:${day}`;
  const n = (usage.get(key) || 0) + 1;
  usage.set(key, n);
  return n > DAILY_LIMIT;
}

async function getUser(req) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error) return null;
  return data.user;
}

export async function POST(req) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "A chave da API da Anthropic não está configurada no servidor." }, { status: 500 });
  }
  const user = await getUser(req);
  if (!user) return Response.json({ error: "Entre na sua conta para usar a análise." }, { status: 401 });
  if (overLimit(user.id)) return Response.json({ error: `Limite de ${DAILY_LIMIT} análises por dia atingido.` }, { status: 429 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "Pedido inválido." }, { status: 400 }); }

  let prompt;
  if (body.kind === "patterns") prompt = buildPatternsPrompt(body.matches);
  else {
    if (!String(body.log || "").trim()) return Response.json({ error: "Cole o log da partida." }, { status: 400 });
    prompt = buildAnalysisPrompt(body);
  }

  const client = new Anthropic();
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (e) {
        controller.enqueue(encoder.encode("\n\n[A análise foi interrompida. Tente de novo.]"));
      } finally {
        controller.close();
      }
    },
    cancel() { stream.abort(); },
  });

  return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
