# Plan — Foundation (Task 01, final, pt-BR)

True foundation only. All schema, RLS, helpers, triggers, and extensions land now so every later task plugs in cleanly. Only UI is auth + a one-line authenticated landing.

## Localization rule (applies from Task 01 onward)

- **Code identifiers** (tables, columns, functions, hooks, components, types, variables, enum values, JSON keys, log messages, code comments, technical errors): **English**. No schema changes.
- **All user-facing strings** (buttons, labels, toasts, headings, placeholders, validation messages, empty states): **Portuguese (pt-BR)**.
- **Seeded data that is user-visible** (stage names): **pt-BR**.
- Any later code that references stages by string (e.g. `move_lead_to_stage_by_name`) must use the pt-BR names below. UUID references are unaffected.

## What you'll have at the end

1. Email + password auth (sign up / sign in / sign out) with pt-BR copy.
2. On signup, a workspace is auto-provisioned with the 7 SDR stages (pt-BR), the user is added as `owner`, and a profile row is created.
3. All 9 tables exist with RLS enabled — proven by a two-account cross-tenant check.
4. All helper functions, RPCs, and triggers from DATA_MODEL.md §4–6 are deployed.
5. `ProtectedRoute` redirects unauthenticated users to `/auth`. Authenticated landing renders only:
   `Autenticado como <email> · workspace: <workspace_name>` plus a `Sair` button.

## Auth flow

- `/auth` (public): tabs `Entrar` / `Criar conta`. Email + password only. Success → `/`.
- `/` (protected): the one-line landing above.
- `Sair` clears session and returns to `/auth`.
- No workspace switcher, no nav, no Kanban, no stubs in this task.

## Default stages seeded per new workspace (exact, pt-BR)

| # | Name | required_fields | is_default |
|---|---|---|---|
| 1 | Base | [] | true |
| 2 | Lead Mapeado | name, company, phone, role | true |
| 3 | Tentando Contato | name, company | true |
| 4 | Conexão Iniciada | name, company | true |
| 5 | Desqualificado | [] | true |
| 6 | Qualificado | name, company, email | true |
| 7 | Reunião Agendada | name, company, email | true |

`required_fields` values stay as English column keys (they map to lead column names / custom_field keys).

## Database — 9 tables, all with RLS enabled

1. **profiles** — id (FK auth.users), email, full_name, created_at, updated_at.
2. **workspaces** — id, name, owner_id, created_at.
3. **workspace_members** — workspace_id, user_id, role (`app_role` enum: owner | admin | member), unique(workspace_id, user_id).
4. **stages** — workspace_id, name, position, required_fields text[], is_default bool default false.
5. **custom_fields** — workspace_id, key, label, field_type (`field_type` enum: text | number | date | boolean | select), options jsonb, is_required bool default false, position int default 0, unique(workspace_id, key).
6. **leads** — workspace_id, owner_id, name, email, phone, company, role, source, notes, stage_id, custom_data jsonb default '{}'::jsonb, created_at, updated_at.
7. **campaigns** — workspace_id, name, context, prompt, trigger_stage_id (nullable FK stages), is_active bool, created_at, updated_at.
8. **lead_messages** — workspace_id, lead_id, campaign_id, variations jsonb, sent_at (nullable), created_at.
9. **activity_log** — workspace_id, actor_id, lead_id (nullable), action (`activity_action` enum: lead_created | lead_updated | lead_stage_changed | lead_deleted | message_generated | message_sent | campaign_created | campaign_updated), payload jsonb, created_at.

## Indexes

- `(workspace_id)` on every tenant table.
- `(workspace_id, stage_id)` on leads.
- `(workspace_id, user_id)` on workspace_members.
- GIN on `leads.custom_data` (jsonb_path_ops).
- GIN trigram on `leads.name` and `leads.company` (uses `pg_trgm`).
- `(workspace_id, created_at desc)` on activity_log.

## Extensions enabled

- `pg_trgm`
- `pg_net`

## Functions, RPCs, and triggers (DATA_MODEL.md §4–6)

Helpers (SECURITY DEFINER, search_path=public):
- `is_workspace_member(_user uuid, _workspace uuid) returns bool`
- `is_workspace_admin(_user uuid, _workspace uuid) returns bool` (owner or admin)

Lifecycle:
- `handle_new_user()` trigger on `auth.users` insert → creates profile, creates a personal workspace, inserts owner membership, seeds the 7 pt-BR stages above with `is_default = true`.

Stage validation:
- `validate_lead_for_stage(p_lead_id uuid, p_target_stage_id uuid) returns table (is_valid boolean, missing_fields text[])` — inspects standard columns and `custom_data` for keys declared in `stages.required_fields` and any `custom_fields.is_required`.
- `enforce_stage_required_fields()` — BEFORE INSERT/UPDATE OF stage_id ON leads. Calls validator, raises a Postgres exception (English) listing missing field keys.

Stage automation:
- GUCs configured: `app.settings.supabase_url`, `app.settings.service_role_key`.
- `notify_stage_trigger()` — AFTER INSERT OR UPDATE OF stage_id ON leads. LOOPs over `campaigns` where `workspace_id = NEW.workspace_id AND trigger_stage_id = NEW.stage_id AND is_active = true`. For each match, `pg_net.http_post` directly to `{app.settings.supabase_url}/functions/v1/generate-messages` with body `{ lead_id, campaign_id, trigger_source: 'auto_stage_trigger' }` and header `Authorization: Bearer {app.settings.service_role_key}`. Function ships in a later task; trigger is harmless until then.

RPC:
- `move_lead_to_stage_by_name(_lead_id uuid, _stage_name text) returns leads` — looks up stage by name within the lead's workspace and updates. Stage names are matched against pt-BR seeded values.

## RLS policy shape

- All tenant tables: SELECT/INSERT/UPDATE/DELETE policies use `is_workspace_member(auth.uid(), workspace_id)`.
- Destructive workspace actions gated by `is_workspace_admin` plus owner check on the workspace itself.
- `profiles`: select profiles in shared workspaces; update only own row.
- `workspace_members`: insert/delete restricted to admins; self-row select always allowed.
- All membership checks go through SECURITY DEFINER helpers — no recursive-RLS errors.

## pt-BR copy used in this task

- Auth page: `Entrar`, `Criar conta`, `E-mail`, `Senha`, `Confirmar senha`.
- Errors (toasts): `Credenciais inválidas`, `Não foi possível criar a conta`, `Verifique seu e-mail e senha`.
- Success: `Conta criada com sucesso`, `Bem-vindo de volta`.
- Landing: `Autenticado como {email} · workspace: {workspace_name}`, button `Sair`.

## Acceptance check

- Two browsers, two new accounts → each sees only its own workspace and stages when poking the Supabase client in devtools.
- Refresh keeps session; `Sair` returns to `/auth`.
- `select name, position, required_fields, is_default from public.stages order by position` returns the 7 pt-BR rows above with `is_default = true`.
- Updating a lead's `stage_id` to "Lead Mapeado" with missing required fields raises a Postgres exception listing those keys (verified via SQL editor).
- `pg_trgm` and `pg_net` installed; GIN indexes visible on `leads.custom_data`, `leads.name`, `leads.company`.

## Out of scope (later tasks)

- Workspace switcher / multi-workspace UI (Task 10).
- Left nav and route stubs.
- Kanban board (Task 05).
- Lead/Campaign/Custom Fields CRUD UIs.
- `generate-messages` edge function body.

## Technical notes

- Backend: connecting your **external Supabase project** — you'll be prompted for URL, anon key, and service-role key (stored as a Supabase secret, never shipped to the client). The same URL + service-role key are also written to the `app.settings.*` GUCs used by `notify_stage_trigger`.
- Schema delivered as a single ordered migration: extensions → enums → tables → indexes → helper functions → triggers → RLS enable → policies → seed function → GUC settings.
- Frontend: React + TS + Tailwind + shadcn, TanStack Query, Supabase JS client, sonner toasts. Auth state via `onAuthStateChange` set up before `getSession()`.
- `signUp` uses `emailRedirectTo: window.location.origin`. README will note that disabling email confirmation in Supabase Auth keeps the reviewer flow under 5 minutes.
