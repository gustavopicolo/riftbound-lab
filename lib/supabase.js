"use client";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Sem as variáveis configuradas, o app funciona só com o buscador.
export const supabase = url && key ? createClient(url, key) : null;
