import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) throw new Error("Nicht angemeldet.");

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const caller = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
    });
    const admin = createClient(url, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await caller.auth.getUser();
    if (userError || !userData.user) throw new Error("Login konnte nicht geprüft werden.");

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!body.clubId || !body.teamKey || !body.playerRef || !body.displayName || !email) {
      throw new Error("Pflichtangaben fehlen.");
    }

    const { data: membership } = await admin.from("club_members").select("role")
      .eq("club_id", body.clubId).eq("user_id", userData.user.id).maybeSingle();
    if (!membership) throw new Error("Nur Coaches dürfen Spielerzugänge verwalten.");

    const { data: profile } = await admin.from("player_profiles")
      .select("id,auth_user_id").eq("club_id", body.clubId).eq("email", email).maybeSingle();

    let authUserId = profile?.auth_user_id ?? null;

    if (body.action === "create" || body.action === "reset_password") {
      const password = String(body.startPassword ?? "");
      if (password.length < 8) throw new Error("Das Startpasswort muss mindestens 8 Zeichen lang sein.");

      if (!authUserId) {
        const { data: created, error } = await admin.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { force_password_change: true, account_type: "player" },
        });
        if (error) throw error;
        authUserId = created.user.id;
      } else {
        const { error } = await admin.auth.admin.updateUserById(authUserId, {
          password,
          user_metadata: { force_password_change: true, account_type: "player" },
        });
        if (error) throw error;
      }

      const { error: upsertError } = await admin.from("player_profiles").upsert({
        club_id: body.clubId, team_key: body.teamKey, player_ref: body.playerRef,
        display_name: body.displayName, email, auth_user_id: authUserId,
        is_enabled: true, updated_at: new Date().toISOString(),
      }, { onConflict: "club_id,email" });
      if (upsertError) throw upsertError;
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message ?? String(error) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
