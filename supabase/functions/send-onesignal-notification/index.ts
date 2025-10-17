// File: supabase/functions/send-onesignal-notification/index.ts

// Declare the Deno global to provide types for the Deno runtime environment.
declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get secrets from Supabase environment variables
    const appId = Deno.env.get("ONESIGNAL_APP_ID");
    const restApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

    if (!appId || !restApiKey) {
      throw new Error("OneSignal App ID hoặc REST API Key chưa được cấu hình trong Secrets.");
    }

    // Get notification details from the request body (sent by the trigger)
    const { userIds, title, message, url } = await req.json();
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0 || !title || !message) {
      throw new Error("Thiếu các tham số bắt buộc: userIds (mảng), title, hoặc message.");
    }

    // Prepare the payload for the OneSignal API
    const notificationPayload = {
      app_id: appId,
      include_external_user_ids: userIds, // Target specific users
      headings: { "en": title },
      contents: { "en": message },
      url: url, // URL to open when the notification is clicked
    };

    // Call the OneSignal REST API
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${restApiKey}`,
      },
      body: JSON.stringify(notificationPayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OneSignal API Error:", errorData);
      throw new Error(`Lỗi từ OneSignal: ${JSON.stringify(errorData.errors)}`);
    }

    return new Response(JSON.stringify({ success: true, message: "Thông báo đã được gửi thành công." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Function Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
