# TASKS — execution order

Run these in order. Each task is self-contained but **assumes all previous tasks are complete and merged**.

For each task:

1. Open the file.
2. Copy its full contents.
3. Paste it as a new prompt to Lovable.
4. Wait for completion.
5. Verify the **Acceptance criteria** section before moving on.
6. Commit (Lovable auto-syncs to GitHub).

---

## Sequence

| #   | File                                  | Time | Mandatory? |
| --- | ------------------------------------- | ---- | ---------- |
| 00  | `00-bootstrap.md`                     | 30m  | ✅ Yes     |
| 01  | `01-auth-and-workspace.md`            | 45m  | ✅ Yes     |
| 02  | `02-stages-and-funnel-config.md`      | 45m  | ✅ Yes     |
| 03  | `03-custom-fields.md`                 | 45m  | ✅ Yes     |
| 04  | `04-leads-crud.md`                    | 60m  | ✅ Yes     |
| 05  | `05-kanban-and-drag-drop.md`          | 60m  | ✅ Yes     |
| 06  | `06-campaigns.md`                     | 45m  | ✅ Yes     |
| 07  | `07-edge-function-generate-messages.md` | 90m | ✅ Yes    |
| 08  | `08-trigger-stage-auto-generation.md` | 60m  | 🟡 Differential |
| 09  | `09-dashboard.md`                     | 30m  | ✅ Yes     |
| 10  | `10-differentials-polish.md`          | 60m  | 🟡 Differential |
| 11  | `11-readme-and-deploy.md`             | 45m  | ✅ Yes     |

**Total minimum (mandatory only):** ~8h
**Total with differentials:** ~11h

---

## Stop-and-test checkpoints

- After **04**: create 5 leads as User A, sign up as User B → confirm User B sees zero leads.
- After **07**: generate messages for a lead, regenerate, click "send", confirm lead moves to "Trying Contact".
- After **08**: create a lead directly in the trigger stage → wait 5–10s → confirm messages appear without manual generation.
- After **11**: open the live URL in an incognito tab, sign up fresh, walk the full happy path.

---

## If you fall behind

The minimum viable submission is **00–07 + 09 + 11**. Skip 08 and 10 if time is short. The README must mention which differentials were skipped.
