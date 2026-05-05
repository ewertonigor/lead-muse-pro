# SDR CRM with AI Message Generator

A multi-tenant CRM for SDR (Sales Development Representative) teams that generates personalized outreach messages using an LLM, considering campaign context and lead-specific data (standard and custom fields).

🌐 **Live app:** https://id-preview--9e73ea9f-8a48-4431-b05c-e71f65bd18c0.lovable.app
🎥 **Demo video (≤ 10 min):** _<paste your YouTube/Drive link here before submitting>_

> The app is open to public sign-up. Just create an account; the workspace and 7 default funnel stages are auto-provisioned.

---

## Stack

| Layer        | Technology                                          |
| ------------ | --------------------------------------------------- |
| Frontend     | React + TypeScript + Tailwind + shadcn/ui (Lovable) |
| State        | TanStack Query                                      |
| Backend      | Supabase Edge Functions (Deno + TypeScript)         |
| Database     | Supabase Postgres + RLS                             |
| Auth         | Supabase Auth (email + password)                    |
| LLM          | Lovable AI Gateway — `google/gemini-2.5-flash` with tool-calling for structured output |
| Drag & drop  | `@dnd-kit/core`                                     |
| Charts       | `recharts`                                          |
| Hosting      | Lovable Publish (frontend) + Supabase (backend)     |

---

## How the AI generation works

1. The user opens a lead, picks an active campaign, clicks **Gerar**.
2. The frontend invokes the `generate-messages` Edge Function with the user's JWT.
3. The function:
   - Reads the lead, the campaign, and the workspace's custom field metadata under RLS.
   - Serializes the lead as Markdown (only fields with values).
   - Builds a system prompt combining campaign context, campaign instructions, and lead data.
   - Calls the Lovable AI Gateway with a tool-call schema, ensuring the response is always a valid array of `{ subject?, body, tone }` variations.
   - Persists the result into `lead_messages`.
   - Logs the action into `activity_log`.

The runtime prompt lives in `supabase/functions/generate-messages/index.ts`.

---

## Multi-tenancy and RLS

Every domain table has a `workspace_id`. RLS is enabled on all tables. Membership is resolved via `workspace_members` and a `SECURITY DEFINER` helper `is_workspace_member(uuid, uuid)` keeps policies simple and indexable.

A trigger on `auth.users` (`handle_new_user`) auto-provisions:

- A `profiles` row.
- A workspace owned by the user.
- A `workspace_members` row with role `owner`.
- 7 default funnel stages (Base → Reunião Agendada).

This makes onboarding zero-click for the reviewer.

---

## Trigger-stage auto-generation

A campaign can declare a `trigger_stage_id`. When a lead is inserted in or moved to that stage, a Postgres trigger (`notify_stage_trigger`) calls the `generate-messages` Edge Function via `pg_net.http_post` for every active campaign bound to that stage. The function recognizes the service-role auth context only when `trigger_source === "auto_stage_trigger"` and runs under elevated privileges; user-initiated calls always run under the user's JWT and RLS.

A 60-second deduplication window prevents double-generation when triggers fire repeatedly.

The service-role key is stored in Supabase Vault (`vault.decrypted_secrets`), never exposed to the client.

---

## Custom fields

Custom field **definitions** live in `custom_fields` (per workspace). Custom field **values** live in `leads.custom_data` as JSONB. We chose JSONB over EAV because it's dramatically faster on read paths, ~3× smaller, atomic on multi-field writes, and a single primary-key lookup loads a whole lead instead of a join + N row reads.

---

## Stage transition validation

Each stage carries `required_fields text[]`. A `validate_lead_for_stage(lead_id, stage_id)` RPC returns `(is_valid, missing_fields)`. The Kanban calls this before issuing a stage update for instant UX, and a `BEFORE INSERT/UPDATE` trigger (`enforce_stage_required_fields`) enforces the same rule at the database level so it cannot be bypassed by a malicious client.

---

## Repository layout

```
.
├── README.md
├── src/
│   ├── components/
│   │   ├── kanban/                 ← Kanban board, columns, cards, filters
│   │   ├── leads/                  ← LeadForm, LeadMessagesTab, LeadActivityTab
│   │   └── campaigns/              ← CampaignForm
│   ├── hooks/                      ← useLeads, useStages, useCampaigns, useKanbanLeads, ...
│   ├── lib/
│   │   ├── leadValidation.ts       ← centralized required-fields helper
│   │   └── activity.ts             ← activity_log helper
│   └── pages/                      ← Auth, Index (Kanban), Dashboard, LeadDetail, Campaigns, Settings/...
└── supabase/
    ├── migrations/                 ← SQL migrations (schema, RLS, triggers, RPCs)
    └── functions/
        └── generate-messages/      ← LLM integration (auto + manual)
```

---

## Implemented features

### Mandatory

- [x] Email + password auth
- [x] Workspace auto-provisioned per user, isolated via RLS
- [x] Standard lead fields: name, email, phone, company, role, source, notes
- [x] Custom fields per workspace (text, number, date, boolean, select)
- [x] Lead owner (workspace member) — optional
- [x] Kanban funnel with 7 default stages, drag & drop between stages
- [x] Lead detail with edit and delete
- [x] Campaigns with name, context, prompt, optional trigger stage, active/inactive
- [x] AI message generation (structured output, 3 variations)
- [x] Regenerate, copy, simulated send (auto-moves lead to "Tentando Contato")
- [x] Required-fields validation per stage (RPC + DB trigger)
- [x] Dashboard with leads/stage and totals

### Differentials

- [x] Trigger-stage auto-generation (background, via `pg_net` + Edge Function)
- [x] Funnel reordering and editing (`/settings/funnel`)
- [x] Custom-fields management UI (`/settings/custom-fields`)
- [x] Filters and search on Kanban (URL-persisted)
- [x] Activity log tab on lead detail
- [x] Lead message history (older generations collapsible)
- [x] Realtime updates on Kanban and lead detail (Supabase Realtime)
- [x] Dashboard extras: active campaigns, messages generated, messages sent

### Not shipped (out of time)

- [ ] Multi-workspace switcher
- [ ] Member invites UI

---

## Key technical decisions

### Why Lovable AI Gateway instead of a direct OpenAI key

The gateway gives access to multiple frontier models behind a single key managed by the platform — no extra secret ceremony for the reviewer, no leaked keys, and easy model swaps. We use `google/gemini-2.5-flash` for low latency and high quality on short structured outputs.

### Why JSONB for custom fields

EAV (`lead_custom_field_values` table) was the obvious alternative. JSONB wins on every dimension that matters here: faster reads, less storage, atomic multi-field writes, and a single primary index lookup to load a lead instead of a join + N row reads. Workspaces will not have thousands of custom fields per lead.

### Why structured outputs

Free-text parsing produces flaky pipelines. We force the model to call a `submit_messages` tool whose JSON schema describes exactly the shape the function persists. The contract between the model and the function is a single schema.

### Why a DB trigger for auto-generation, not application code

Auto-generation must fire whether the lead change comes from the UI, from a future bulk import, or from any backend job. Putting the trigger at the database level guarantees the rule cannot be bypassed.

### Challenges encountered

- The Edge Function had to support **two auth modes** (user JWT vs service role) so manual generation runs under RLS while trigger-driven generation runs with elevated privileges. Resolved with a hard check on `trigger_source` plus an explicit comparison against the service-role secret.
- Empty optional fields had to be normalized to `null` (not `""`) before insertion to keep `custom_data` JSONB clean for the LLM serializer.
- Postgres triggers calling Edge Functions require `pg_net` enabled and the service-role key stored in Vault — both wired via migrations.

---

## Local development

```bash
npm install
npm run dev
```

Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) are auto-injected by Lovable Cloud — no `.env` file is checked in.

To run the Edge Function locally:

```bash
npx supabase functions serve generate-messages
```

---

## Reviewer checklist

1. Sign up with any email/password at the live URL.
2. You'll land on the Kanban with 7 stages, all empty.
3. (Optional) Create a custom field at `/settings/custom-fields`.
4. Create a campaign at `/campaigns`. Optionally set a trigger stage (e.g. "Lead Mapeado").
5. Create a lead via **+ Novo lead**. Open it. Switch to **Mensagens IA**, pick the campaign, click **Gerar**.
6. Click **Enviar** on a variation — message is copied to clipboard and the lead is moved to "Tentando Contato".
7. If you set a trigger stage, create another lead directly in that stage and watch messages auto-appear within ~10s on the **Mensagens IA** tab.
8. Visit `/dashboard` to see counts and the per-stage funnel chart.
9. Open an incognito window, sign up as a second user, and confirm zero data is shared.

---

## License

MIT.
