
// Fix: Replaced the Supabase functions type reference to resolve Deno-specific type errors.
/// <reference types="https://esm.sh/@supabase/functions-js@2.4.1/src/edge-functions.d.ts" />
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
    // 1. Create Supabase Admin client to get credentials securely
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 2. Fetch Abitstore API URL from the database
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("settings")
      .select("abitstore_api_url")
      .eq("id", 1)
      .single();

    if (settingsError || !settings || !settings.abitstore_api_url) {
      console.error("Abitstore Settings Error:", settingsError);
      throw new Error("URL API Abitstore chưa được cấu hình trong Cài đặt.");
    }

    const apiUrl = settings.abitstore_api_url;

    // 3. Get message parameters from the request body
    const { send_from_number, send_to_number, message, action } = await req.json();
    if (!send_from_number || !send_to_number || !message) {
        throw new Error("Thiếu các tham số bắt buộc: SĐT gửi, SĐT nhận, và nội dung tin nhắn.");
    }

    // 4. Make the POST request to the configured Abitstore API URL
    const abitstoreResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            send_from_number,
            send_to_number,
            message,
            action: action || "", // Ensure action is an empty string if not provided
        }),
    });
    
    // Abitstore API might not return JSON on success, so we check status first.
    if (!abitstoreResponse.ok) {
      // Try to parse error response as JSON, but fall back to text.
      let errorBody;
      try {
        errorBody = await abitstoreResponse.json();
      } catch (e) {
        errorBody = await abitstoreResponse.text();
      }
      console.error("Abitstore API Error:", { status: abitstoreResponse.status, body: errorBody });
      const errorMessage = (typeof errorBody === 'object' && errorBody?.message) ? errorBody.message : (typeof errorBody === 'string' ? errorBody : "Yêu cầu đến Abitstore thất bại.");
      throw new Error(errorMessage);
    }
    
    // Assuming success if response is OK, as per many non-standard APIs.
    const responseText = await abitstoreResponse.text();

    // 5. Return success response
    return new Response(
      JSON.stringify({ message: "Yêu cầu gửi tin nhắn đã được gửi đến Abitstore thành công.", apiResponse: responseText }),
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
