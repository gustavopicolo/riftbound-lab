# Riftbound Lab

App para estudar Riftbound:

- **Analisador de partidas**: cole o log de uma partida (do RiftAtlas ou escrito à mão) e o Claude aponta os turnos decisivos, linhas melhores e lições. Cada pessoa tem um diário privado de partidas e pode ver os próprios erros recorrentes.
- **Jogadores e decks**: escolha uma lenda e veja quem fez boas campanhas com ela nos torneios do meta atual, com link da lista e atalhos para vídeos.

Stack: Next.js (App Router) na Vercel, Supabase (login por e-mail e diário de partidas), API da Anthropic (análises).

## Configuração (uma vez)

### 1. Supabase
1. Crie um projeto em supabase.com.
2. Abra **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e rode.
3. Em **Authentication → URL Configuration**, coloque a URL do site da Vercel em *Site URL* (ex.: `https://riftbound-lab.vercel.app`).
4. Em **Project Settings → API**, copie a *Project URL* e a *anon public key*.

### 2. Anthropic
1. Em console.anthropic.com, crie uma chave de API.
2. Defina um limite de gasto mensal no console, como proteção.

### 3. Vercel
1. **Add New → Project** e importe este repositório do GitHub.
2. Em **Environment Variables**, cadastre:
   - `ANTHROPIC_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - opcionais: `ANTHROPIC_MODEL` (padrão `claude-sonnet-5-5`), `DAILY_ANALYSIS_LIMIT` (padrão 30 por usuário/dia)
3. **Deploy**. A partir daqui, cada push na branch `main` publica sozinho.

## Como o projeto está organizado

| Caminho | O que é |
|---|---|
| `app/App.js` | Interface (abas, analisador, buscador) |
| `app/api/analyze/route.js` | Rota que chama a API da Anthropic. Exige login e aplica limite diário |
| `lib/prompts.js` | Instruções enviadas ao Claude |
| `data/tournaments.json` | Resultados de torneios (fonte: riftdecks.com) |
| `scripts/merge-tournaments.mjs` | Junta torneios novos ao arquivo de dados |
| `supabase/schema.sql` | Tabela do diário e regras de acesso (cada usuário só vê as próprias partidas) |

## Atualizar torneios

Os torneios ficam em `data/tournaments.json`. Para incluir novos, gere um JSON no mesmo formato e rode:

```
node scripts/merge-tournaments.mjs novos.json
```

Faça commit e push; a Vercel publica a nova versão.

## Rodar localmente

```
cp .env.example .env.local   # preencha as chaves
npm install
npm run dev
```

## Política da Riot

O rodapé traz o aviso exigido pela política "Legal Jibber Jabber" da Riot. O app não exibe arte de cartas, não mostra taxas de uso ou de vitória e não tem ranking de jogadores, para seguir a política de ferramentas digitais de Riftbound. Antes de monetizar, leia https://developer.riotgames.com/docs/riftbound.
