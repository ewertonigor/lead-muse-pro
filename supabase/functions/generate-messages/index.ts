import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Lead = Record<string, unknown> & {
  id: string;
  workspace_id: string;
  custom_data: Record<string, unknown> | null;
};
type Campaign = {
  id: string;
  workspace_id: string;
  context: string | null;
  prompt: string | null;
};
type CustomField = { key: string; label: string };

function serializeLead(lead: Lead, customFields: CustomField[]): string {
  const lines: string[] = [];
  const standard: Array<[string, string]> = [
    ["Nome", "name"],
    ["E-mail", "email"],
    ["Telefone", "phone"],
    ["Empresa", "company"],
    ["Cargo", "role"],
    ["Origem", "source"],
    ["Notas", "notes"],
  ];
  for (const [label, key] of standard) {
    const v = (lead as Record<string, unknown>)[key];
    if (v && String(v).trim()) lines.push(`- ${label}: ${v}`);
  }
  const cd = (lead.custom_data ?? {}) as Record<string, unknown>;
  for (const cf of customFields) {
    const v = cd[cf.key];
    if (v !== null && v !== undefined && String(v).trim()) {
      lines.push(`- ${cf.label}: ${v}`);
    }
  }
  return lines.join("\n");
}

function buildSystemPrompt(args: {
  campaignContext: string;
  campaignPrompt: string;
  leadDataSerialized: string;
  variationCount: number;
}): string {
  const today = new Date().toISOString().slice(0, 10);
  return `You are an expert SDR (Sales Development Representative) writing personalized outreach messages.

You will receive:
1. CAMPAIGN CONTEXT: background about the offer, product, company, period.
2. CAMPAIGN INSTRUCTIONS: persona, tone, format, style.
3. LEAD DATA: structured info about the prospect (standard and custom fields).

Your task: produce exactly ${args.variationCount} distinct message variations that:
- Apply the campaign instructions precisely.
- Reference the lead's data naturally — never fabricate facts not in the lead data.
- Avoid generic openers like "I hope this message finds you well".
- Are ready to send. No placeholders like "[name]" — use the actual values.
- Vary in approach across the ${args.variationCount} variations.

If a piece of information is missing from the lead data, do not invent it. Either omit that part or rephrase to avoid needing it.

The current date is ${today}.

---
CAMPAIGN CONTEXT
================
${args.campaignContext}

---
CAMPAIGN INSTRUCTIONS
=====================
${args.campaignPrompt}

---
LEAD DATA
=========
${args.leadDataSerialized}`;
}

const VariationsTool = {
  type: "function",
  function: {
    name: "return_variations",
    description: "Return the generated message variations.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        variations: {
          type: "array",
          minItems: 2,
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              subject: { type: ["string", "null"] },
              body: { type: "string" },
              tone: { type: "string" },
            },
            required: ["subject", "body", "tone"],
          },
        },
      },
      required: ["variations"],
    },
  },
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const lead_id = String(body.lead_id ?? "");
    const campaign_id = String(body.campaign_id ?? "");
    const trigger_source =
      body.trigger_source === "auto_stage_trigger" ? "auto_stage_trigger" : "manual";
    const variation_count = Math.max(2, Math.min(5, Number(body.variation_count ?? 3)));

    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(lead_id) || !uuidRe.test(campaign_id)) {
      return new Response(JSON.stringify({ error: "Invalid lead_id or campaign_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role mode is allowed only for the trigger path AND requires the auth header
    // to actually be the service role key (cannot be forged from the client).
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const isServiceCall =
      trigger_source === "auto_stage_trigger" &&
      serviceRoleKey.length > 0 &&
      auth === `Bearer ${serviceRoleKey}`;
    const supabaseKey = isServiceCall ? serviceRoleKey : Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, supabaseKey, {
      global: isServiceCall ? {} : { headers: { Authorization: auth } },
    });

    // Dedup: skip if a generation for this (lead, campaign) happened in the last 60s
    // (only for auto path — manual users may legitimately regenerate quickly).
    if (isServiceCall) {
      const since = new Date(Date.now() - 60_000).toISOString();
      const { data: recent } = await supabase
        .from("lead_messages")
        .select("id")
        .eq("lead_id", lead_id)
        .eq("campaign_id", campaign_id)
        .gte("created_at", since)
        .limit(1);
      if (recent && recent.length > 0) {
        return new Response(JSON.stringify({ skipped: "recent_generation_exists" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const [{ data: lead, error: leadErr }, { data: campaign, error: campErr }] =
      await Promise.all([
        supabase.from("leads").select("*").eq("id", lead_id).single(),
        supabase.from("campaigns").select("*").eq("id", campaign_id).single(),
      ]);
    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: `Lead not found: ${leadErr?.message ?? ""}` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (campErr || !campaign) {
      return new Response(JSON.stringify({ error: `Campaign not found: ${campErr?.message ?? ""}` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const _lead = lead as Lead;
    const _campaign = campaign as Campaign;
    if (_lead.workspace_id !== _campaign.workspace_id) {
      return new Response(JSON.stringify({ error: "Lead and campaign belong to different workspaces" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: customFields } = await supabase
      .from("custom_fields")
      .select("key, label")
      .eq("workspace_id", _lead.workspace_id);

    const leadDataSerialized = serializeLead(_lead, (customFields ?? []) as CustomField[]);
    if (!leadDataSerialized.trim()) {
      return new Response(
        JSON.stringify({
          error: "Lead has no data to personalize. Add at least name and company.",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemPrompt = buildSystemPrompt({
      campaignContext: _campaign.context ?? "",
      campaignPrompt: _campaign.prompt ?? "",
      leadDataSerialized,
      variationCount: variation_count,
    });

    const startedAt = Date.now();
    const logAutoFailure = async (errMessage: string) => {
      if (!isServiceCall) return;
      try {
        await supabase.from("activity_log").insert({
          workspace_id: _lead.workspace_id,
          lead_id: _lead.id,
          action: "message_generated",
          payload: {
            status: "failed",
            campaign_id: _campaign.id,
            error: errMessage,
            trigger_source,
          },
        });
      } catch (_) { /* best effort */ }
    };
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Generate the message variations now." },
        ],
        tools: [VariationsTool],
        tool_choice: { type: "function", function: { name: "return_variations" } },
      }),
    });

    if (aiRes.status === 429) {
      await logAutoFailure("rate_limited");
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      await logAutoFailure("credits_exhausted");
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits to continue." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      await logAutoFailure(`ai_gateway_error: ${txt.slice(0, 200)}`);
      return new Response(JSON.stringify({ error: `AI gateway error: ${txt}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      await logAutoFailure("model_no_tool_call");
      return new Response(JSON.stringify({ error: "Model returned no tool call" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let parsed: { variations: { subject: string | null; body: string; tone: string }[] };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      await logAutoFailure("invalid_json_from_model");
      return new Response(JSON.stringify({ error: "Invalid JSON from model" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!parsed.variations || parsed.variations.length < 2) {
      await logAutoFailure("too_few_variations");
      return new Response(JSON.stringify({ error: "Model returned too few variations" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const durationMs = Date.now() - startedAt;

    const { data: insertResult, error: insertErr } = await supabase
      .from("lead_messages")
      .insert({
        workspace_id: _lead.workspace_id,
        lead_id: _lead.id,
        campaign_id: _campaign.id,
        variations: parsed.variations,
      })
      .select()
      .single();
    if (insertErr) {
      await logAutoFailure(`insert_failed: ${insertErr.message}`);
      return new Response(JSON.stringify({ error: `Insert failed: ${insertErr.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("activity_log").insert({
      workspace_id: _lead.workspace_id,
      lead_id: _lead.id,
      action: "message_generated",
      payload: {
        campaign_id: _campaign.id,
        variation_count: parsed.variations.length,
        trigger_source,
        duration_ms: durationMs,
      },
    });

    console.log(JSON.stringify({
      event: "message_generation",
      workspace_id: _lead.workspace_id,
      lead_id: _lead.id,
      campaign_id: _campaign.id,
      duration_ms: durationMs,
      trigger_source,
    }));

    return new Response(JSON.stringify(insertResult), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("generate-messages error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
