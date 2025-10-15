


// FIX: Replaced the incorrect Supabase functions type reference with the Deno namespace reference to resolve type errors.
/// <reference lib="deno.ns" />

// File: supabase/functions/refresh-zalo-token/index.ts
// This function automatically refreshes the Zalo OA access token.
// To run this automatically every 23 hours, set up a cron job in your Supabase project's SQL Editor.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Create Supabase Admin client to interact with the database
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 2. Fetch Zalo OA settings from the database
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("settings")
      .select("oa_id, oa_secret_key")
      .eq("id", 1)
      .single();

    if (settingsError || !settings || !settings.oa_id || !settings.oa_secret_key) {
      console.error("Zalo Settings Error:", settingsError);
      throw new Error("Zalo OA ID and Secret Key are not configured in the settings.");
    }

    const { oa_id, oa_secret_key } = settings;

    // 3. Request new access token from Zalo API
    const zaloResponse = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "secret_key": oa_secret_key,
      },
      body: new URLSearchParams({
        app_id: oa_id,
        grant_type: "client_credentials",
      }),
    });

    const zaloData = await zaloResponse.json();

    if (!zaloResponse.ok || !zaloData.access_token) {
      console.error("Zalo API Error:", zaloData);
      const errorMessage = zaloData.error_description || "Failed to fetch access token from Zalo.";
      throw new Error(errorMessage);
    }

    const newAccessToken = zaloData.access_token;

    // 4. Update the access token in the database
    const { error: updateError } = await supabaseAdmin
      .from("settings")
      .update({ access_token: newAccessToken })
      .eq("id", 1);

    if (updateError) {
      console.error("Supabase Update Error:", updateError);
      throw new Error("Failed to save the new Zalo access token to the database.");
    }

    // 5. Return success response
    return new Response(
      JSON.stringify({ message: "Zalo access token refreshed and updated successfully." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Function Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
