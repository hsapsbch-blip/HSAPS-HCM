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
      channel_for_external_user_ids: "push", // Explicitly specify the push channel
      isAnyWeb: true, // Explicitly target web push subscribers to avoid channel ambiguity
      headings: { "en": title },
      contents: { "en": message },
      url: url, // URL to open when the notification is clicked
    };

    // Call the OneSignal REST API
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${restApiKey}`,
      },
      body: JSON.stringify(notificationPayload),
    });

    if (!response.ok) {
      let errorBody;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        errorBody = await response.json();
      } else {
        errorBody = await response.text();
      }
      console.error("OneSignal API Error:", { status: response.status, body: errorBody });
      const errorMessage = (typeof errorBody === 'object' && errorBody.errors)
        ? JSON.stringify(errorBody.errors)
        : (typeof errorBody === 'string' && errorBody.length > 0)
        ? errorBody
        : `Yêu cầu đến OneSignal thất bại với mã trạng thái ${response.status}.`;
      
      throw new Error(`Lỗi từ OneSignal: ${errorMessage}`);
    }

    const responseData = await response.json();

    return new Response(JSON.stringify({ success: true, message: "Thông báo đã được gửi thành công.", data: responseData }), {
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