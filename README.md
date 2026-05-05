# SDR.ai — Mini CRM com Geração de Mensagens por IA

> Mini CRM para times de SDR (Sales Development Representatives) com geração de mensagens personalizadas via IA, considerando o contexto da campanha e os dados do lead (campos padrão e personalizados).
>
> **Prova técnica — Desenvolvedor Vibe Coding Full Stack.**

🌐 **App:** https://lead-muse-pro.lovable.app/
📦 **Repositório:** https://github.com/ewertonigor/lead-muse-pro
🎥 **Demo (≤ 10 min):** https://youtu.be/Cq-Ib-N_d74

> 📝 **Como o avaliador testa:** o cadastro está aberto. Crie uma conta nova em `/auth` — um workspace com as 7 etapas do funil é provisionado automaticamente no signup. Em menos de 5 minutos você consegue criar lead, gerar mensagens com IA e ver o gatilho automático em ação.

---

## Sumário

- [Visão geral](#visão-geral)
- [Stack](#stack)
- [Funcionalidades implementadas](#funcionalidades-implementadas)
- [Arquitetura](#arquitetura)
- [Como funciona a geração de mensagens com IA](#como-funciona-a-geração-de-mensagens-com-ia)
- [Multi-tenancy e segurança (RLS)](#multi-tenancy-e-segurança-rls)
- [Decisões técnicas](#decisões-técnicas)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Roteiro do avaliador (5 minutos)](#roteiro-do-avaliador-5-minutos)
- [Desafios encontrados](#desafios-encontrados)
- [O que ficaria com mais tempo](#o-que-ficaria-com-mais-tempo)

---

## Visão geral

O produto resolve uma dor real de equipes de pré-vendas: **gerar mensagens personalizadas em escala** sem perder qualidade. O SDR cria uma campanha com **contexto** (sobre a oferta) e **prompt** (persona, tom, formato), e o sistema produz variações de mensagem para cada lead, considerando os dados do lead e os campos personalizados do workspace.

O grande diferencial entregue: **geração automática por etapa gatilho**. Quando um lead entra em uma etapa configurada como gatilho (ex: "Lead Mapeado"), o sistema gera as mensagens em background, via trigger Postgres + `pg_net.http_post` chamando uma Edge Function. Quando o SDR abre o lead, as mensagens já estão lá.

---

## Stack

| Camada            | Tecnologia                                                                  |
| ----------------- | --------------------------------------------------------------------------- |
| Frontend          | React + TypeScript + Tailwind + shadcn/ui (construído na Lovable)           |
| Estado / dados    | TanStack Query                                                              |
| Backend           | Supabase Edge Functions (Deno + TypeScript)                                 |
| Banco de dados    | Supabase Postgres + Row Level Security                                      |
| Autenticação      | Supabase Auth (e-mail + senha)                                              |
| LLM               | Lovable AI Gateway (compatível com OpenAI, Gemini etc; structured outputs)  |
| Drag & drop       | `@dnd-kit/core`                                                             |
| Hospedagem        | Lovable Publish (frontend) + Lovable Cloud (backend Supabase)               |
| Versionamento     | Git + GitHub                                                                |

---

## Funcionalidades implementadas

### Obrigatórios (100%)

- [x] Autenticação de e-mail + senha (Supabase Auth)
- [x] Workspace por usuário, isolado por RLS
- [x] Cadastro de leads com campos padrão (nome, e-mail, telefone, empresa, cargo, origem, observações)
- [x] **Campos personalizados** por workspace (texto, número, data, sim/não, lista de opções) com chave imutável e bloqueio de chaves reservadas
- [x] **Responsável pelo lead** (membro do workspace, opcional)
- [x] **Kanban** com as 7 etapas em pt-BR conforme o edital: Base, Lead Mapeado, Tentando Contato, Conexão Iniciada, Desqualificado, Qualificado, Reunião Agendada
- [x] Drag-and-drop entre etapas com validação de campos obrigatórios
- [x] Visualização e edição de detalhes do lead (abas: Visão geral, Mensagens IA, Atividade)
- [x] **Campanhas** com nome, contexto, prompt e etapa gatilho opcional
- [x] **Geração de mensagens IA** (3 variações com Assunto + Corpo + Tom, structured output validado por schema Zod)
- [x] Regerar, copiar e enviar (simulado — copia para clipboard, marca `sent_at`, move o lead para "Tentando Contato")
- [x] **Validação de campos obrigatórios por etapa** (RPC + trigger BEFORE UPDATE no banco)
- [x] **Dashboard** com leads por etapa, total, mensagens geradas e enviadas, campanhas ativas

### Diferenciais entregues (7 de 9)

- [x] ⚡ **Geração automática por gatilho** — diferencial principal. Trigger Postgres com `pg_net.http_post` chamando a Edge Function quando o lead entra na etapa configurada. Frontend escuta via Supabase Realtime e exibe banner indicando geração automática
- [x] **Edição do funil** — reordenar via drag-and-drop persistido por RPC, editar nome e campos obrigatórios, com proteção de etapas padrão
- [x] **Histórico de atividades** — `activity_log` com timeline por lead (Visão / Editado / Etapa alterada / Mensagens geradas / Mensagem enviada) em pt-BR + timestamps relativos com `date-fns/locale/pt-BR`
- [x] **Histórico de mensagens enviadas** — registro em `lead_messages` com `sent_at` + bloco "Gerações anteriores" colapsável no detalhe do lead
- [x] **Filtros e busca** — busca por nome/empresa (índice `pg_trgm`), filtro por etapa e por responsável, com persistência em query string
- [x] **Métricas** — dashboard com cards de KPIs + bar chart "Leads por estágio" + atividade recente
- [x] **RLS bem implementada** — todas as 9 tabelas com políticas que passam no teste cross-tenant (dois usuários em janelas anônimas, nenhum vê dados do outro)

### Fora de escopo (decisão consciente)

- [ ] Multi-workspace por usuário — cada usuário tem um workspace
- [ ] Convite de usuários para o workspace — workspace single-user

> Essas funcionalidades foram **deliberadamente cortadas** para priorizar qualidade e o diferencial principal (gatilho automático) dentro do prazo da prova.

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Lovable)                          │
│  React + TS + Tailwind + shadcn/ui  •  TanStack Query  •  @dnd-kit  │
└──────────────────────┬─────────────────────────────────┬────────────┘
                       │                                 │
       supabase-js     │                                 │  realtime
       (anon + JWT)    ▼                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SUPABASE / LOVABLE CLOUD                       │
│                                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐     │
│  │  Auth        │   │  Postgres    │   │  Edge Functions      │     │
│  │  (e-mail +   │   │  + RLS em    │   │  generate-messages   │     │
│  │   senha)     │   │  9 tabelas   │   │  (Deno + Zod)        │     │
│  └──────────────┘   └──────┬───────┘   └─────────┬────────────┘     │
│                            │                     │                  │
│            trigger         │  pg_net.http_post   │                  │
│            handle_new_user │  (etapa gatilho)    │                  │
│            (provisionamento)                     │                  │
└────────────────────────────┼─────────────────────┼──────────────────┘
                             │                     │
                             ▼                     ▼
                       ┌─────────────────────────────────┐
                       │   LLM Gateway (Lovable AI)      │
                       │   structured output (Zod)       │
                       └─────────────────────────────────┘
```

**Pontos-chave:**

- Sem servidor próprio: tudo é serverless (Supabase Edge Functions + Lovable Cloud).
- **RLS é a fonte da verdade da autorização.** O frontend usa apenas a `anon key` + JWT do usuário.
- A automação de gatilho roda 100% no banco: a trigger faz `pg_net.http_post` direto da Postgres para a Edge Function, autenticando com a `service_role_key` armazenada em vault. A função aceita esse modo só se `trigger_source = "auto_stage_trigger"` e o `Authorization` bater com o secret real (proteção contra spoofing).

---

## Como funciona a geração de mensagens com IA

```
1. Usuário abre o lead → seleciona campanha → clica "Gerar mensagens"
2. Frontend chama supabase.functions.invoke('generate-messages', { ... })
3. Edge Function:
   a. Valida JWT do usuário (RLS aplica em todas as queries seguintes)
   b. Lê: lead, campanha, custom_fields do workspace
   c. Confirma que lead.workspace_id == campanha.workspace_id
   d. Serializa o lead em Markdown (apenas campos preenchidos, com rótulos pt-BR)
   e. Monta o system prompt: contexto da campanha + instruções (prompt) + dados do lead
   f. Chama o LLM com response_format = zodResponseFormat(MessagesResponse)
   g. Insere em lead_messages e activity_log
4. Frontend recebe a row e renderiza as variações
5. Click "Enviar":
   - Copia para clipboard
   - update lead_messages set sent_at = now(), sent_variation_index = N
   - rpc move_lead_to_stage_by_name(p_stage_name => 'Tentando Contato')
   - logActivity message_sent
```

**Schema Zod das variações** (única fonte de verdade — TypeScript em compile-time + LLM em runtime):

```ts
const MessageVariation = z.object({
  subject: z.string().nullable(),
  body: z.string(),
  tone: z.string()
});

const MessagesResponse = z.object({
  variations: z.array(MessageVariation).min(2).max(5)
});
```

---

## Multi-tenancy e segurança (RLS)

Todas as 9 tabelas têm `workspace_id` e RLS habilitado.

**Funções helper SECURITY DEFINER (evitam recursão):**

```sql
is_workspace_member(_user uuid, _workspace uuid) → bool
is_workspace_admin(_user uuid, _workspace uuid)  → bool
```

**Padrão das policies:**

```sql
create policy "leads: read if member"
  on public.leads for select
  using (public.is_workspace_member(auth.uid(), workspace_id));
```

**Trigger de provisionamento automático no signup** (`handle_new_user` em `auth.users`):

1. Cria a row em `profiles`
2. Cria um workspace com o usuário como `owner`
3. Adiciona em `workspace_members`
4. Popula as 7 etapas padrão em pt-BR com `is_default = true` e os `required_fields` corretos

Resultado: zero clique de configuração para o avaliador.

**Validação de transição de etapa em duas camadas:**

- **Frontend:** chama `validate_lead_for_stage(p_lead_id, p_target_stage_id)` antes de qualquer drag-and-drop e exibe um toast em pt-BR com os campos faltantes (mapeando keys padrão para rótulos pt-BR e custom keys para `custom_fields.label`).
- **Banco:** trigger `BEFORE UPDATE OF stage_id ON leads` (`enforce_stage_required_fields`) que executa a mesma validação. Mesmo se o cliente burlasse o frontend, o banco rejeita.

**Teste cross-tenant aprovado:** dois usuários em janelas anônimas, queries diretas via `supabase-js` no console do DevTools — nenhum vê dados do outro.

---

## Decisões técnicas

### 1. JSONB para campos personalizados (em vez de EAV)

`leads.custom_data jsonb` armazena os valores; `custom_fields` armazena os metadados (key, label, tipo).

**Trade-offs avaliados:**

| Critério                | EAV  | JSONB         |
| ----------------------- | ---- | ------------- |
| Leitura sem índice      | 1×   | **~50.000×**  |
| Leitura com índice GIN  | 1×   | **~1.3×**     |
| Storage                 | 1×   | **~3× menor** |
| Atomicidade multi-campo | Não  | **Sim**       |
| Complexidade do schema  | Alta | **Baixa**     |

Decisão: **JSONB** com índice GIN em `custom_data`. Simplifica queries, melhora performance, reduz storage.

### 2. Structured Outputs no LLM (em vez de parsear texto livre)

Free-text parsing é frágil. Usando `response_format` com schema Zod:

- O **mesmo schema** é validado em compile-time (TypeScript) e em runtime (resposta do LLM).
- Elimina retries por formato inválido.
- Simplifica drasticamente o front: a tipagem chega "pronta".

### 3. Trigger no banco para auto-geração (em vez de orquestração no frontend)

A regra "se entrar em etapa X, gerar mensagens da campanha Y" precisa funcionar **independente da origem** do evento (UI, importação em lote, integração futura, webhook). Colocar isso no banco — via `AFTER INSERT OR UPDATE OF stage_id ON leads` + `pg_net.http_post` — garante que a regra é universal e não pode ser burlada.

**Detalhes da segurança:**

- A `service_role_key` fica no Vault do Supabase, não em GUC plain text.
- A Edge Function só aceita o modo `auto_stage_trigger` se o `Authorization` bater com a chave real (proteção contra spoofing por usuários autenticados).
- Dedup de 60s evita geração duplicada se o lead entrar e sair da etapa rapidamente.

### 4. Validação de etapa em duas camadas

Frontend chama a RPC antes de mover (UX melhor — toast com campos faltantes em pt-BR antes do roundtrip falhar). Banco bloqueia via trigger (segurança — mesmo se o cliente burlar a verificação prévia).

### 5. Lovable + Lovable Cloud como Vibe Coding stack

A escolha cumpre o requisito do edital ("Lovable, Bolt.new, v0, Replit, ou similar") e elimina o tempo de provisionamento de Supabase manual. Trade-off documentado: a Lovable Cloud é uma abstração hospedada por cima do Supabase real, então o dashboard direto do Supabase não é exposto, mas todas as features funcionam (Edge Functions, RLS, `pg_net`, Vault, Realtime).

---

## Estrutura do repositório

```
.
├── README.md                       ← este arquivo
├── PROJECT_CONTEXT.md              ← contexto e princípios usados durante o build
├── DATA_MODEL.md                   ← schema, RLS, triggers e RPCs
├── PROMPTS/
│   └── message-generation.md       ← template versionado do prompt do LLM
├── TASKS/                          ← specs incrementais usadas no desenvolvimento
├── VIDEO_SCRIPT.md                 ← roteiro do vídeo demo
├── src/                            ← frontend (React + TS)
│   ├── components/                 ← UI (kanban, leads, campaigns, settings, ui/)
│   ├── hooks/                      ← TanStack Query hooks (useLeads, useStages, etc.)
│   ├── lib/                        ← supabase client, validation, activity helper
│   ├── routes/                     ← páginas e roteamento
│   └── types/                      ← tipos gerados do Supabase
└── supabase/
    ├── migrations/                 ← schema, RLS, triggers, RPCs
    └── functions/
        └── generate-messages/      ← Edge Function de geração com IA
```

---

## Roteiro do avaliador (5 minutos)

1. Abra `https://lead-muse-pro.lovable.app/auth` e crie uma conta nova.
2. Você será levado ao **Kanban** com as 7 etapas do funil já populadas.
3. Vá em **avatar → Configurações → Campos personalizados** e crie um campo (ex: `Segmento`, tipo Texto).
4. Vá em **Campanhas → Nova campanha**. Preencha nome, um contexto descrevendo a oferta, e um prompt definindo persona/tom. Salve.
5. Volte ao Kanban → **+ Novo lead** → preencha os campos. Crie ele em "Base".
6. Abra o lead → aba **Mensagens IA** → selecione a campanha → **Gerar mensagens**. Em ~5–10s você vê 3 variações personalizadas.
7. Clique em **Enviar** numa variação → o lead é movido automaticamente para "Tentando Contato".
8. **(Diferencial)** Edite a campanha e configure a **Etapa gatilho** como "Lead Mapeado" → salve. Crie outro lead já preenchendo nome, empresa, telefone e cargo, com etapa = Lead Mapeado. Aguarde ~10s e abra o lead — as mensagens estarão lá automaticamente, com banner ⚡ indicando geração automática.
9. Vá em **Dashboard** para ver as métricas.
10. No detalhe do lead, abra a aba **Atividade** para ver a timeline em pt-BR.

---

## Desafios encontrados

- **Dois modos de auth na Edge Function.** A função precisa aceitar JWT do usuário (geração manual sob RLS) e service-role (geração automática via trigger). Resolvido com checagem dupla: o `trigger_source` precisa ser `auto_stage_trigger` **e** o `Authorization` precisa bater com a chave do Vault. Caso contrário, cai no fluxo de usuário.
- **Validação de transição de etapa entre frontend e banco.** A RPC e a trigger validam o mesmo conjunto de regras, mas com caminhos de erro diferentes (UI mostra labels pt-BR; banco lança exceção SQL). Padronizei a estrutura `(is_valid, missing_fields)` em ambos para reaproveitar a lógica.
- **Empty strings vs NULL no JSONB.** Sem cuidado, campos opcionais virariam `""` no `custom_data`, poluindo o serializador do LLM. Adicionei normalização no submit do form e no Edge Function.
- **Dedup de gatilho.** Quando um lead entra e sai rapidamente da etapa gatilho, o trigger dispara duas vezes. Implementei janela de 60s consultando `lead_messages.generated_at` antes de gerar.

---

## O que ficaria com mais tempo

- **Multi-workspace por usuário e convites por e-mail** — schema já comporta (`workspace_members.role` está pronto), faltou a UI e o fluxo de invite via Edge Function.
- **Métricas avançadas no dashboard** — taxa de conversão entre etapas, tempo médio em cada etapa, volume de mensagens geradas por dia.
- **Testes automatizados** — vitest no frontend e testes de integração na Edge Function (mockando o LLM).
- **Streaming das mensagens IA** — hoje a geração é síncrona; usar SSE deixaria a UX mais responsiva (mostrar tokens chegando).
- **Acesso direto ao dashboard Supabase** — atualmente o backend roda via Lovable Cloud, que abstrai o Supabase Dashboard. Migrar para um projeto Supabase próprio daria mais controle de logs e configurações.

---

## Autor

**Ewerton Igor**
GitHub: [@ewertonigor](https://github.com/ewertonigor)

---

> 🎥 Vídeo de apresentação (≤ 10 min): https://youtu.be/Cq-Ib-N_d74
