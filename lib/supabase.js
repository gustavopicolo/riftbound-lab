"use client";
import { createClient } from "@supabase/supabase-js";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/+$/, "");
const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

function validUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === "https:" || x.protocol === "http:";
  } catch {
    return false;
  }
}

// Sem as variáveis configuradas (ou com valor inválido), o site funciona só com o buscador.
export const supabaseProblem = !url || !key
  ? "Login indisponível: o Supabase ainda não foi configurado."
  : !validUrl(url)
    ? "Login indisponível: NEXT_PUBLIC_SUPABASE_URL não é um endereço válido (deve ser algo como https://xxxx.supabase.co)."
    : "";

export const supabase = supabaseProblem ? null : createClient(url, key);
