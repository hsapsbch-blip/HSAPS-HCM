
// Fix: Replaced the Supabase functions type reference to resolve Deno-specific type errors.
/// <reference types="https://esm.sh/@supabase/functions-js@2.4.1/src/edge-functions.d.ts" />

// File: supabase/functions/send-email/index.ts
// Hoàn thiện và sử dụng Resend API - một phương pháp đơn giản và đáng tin cậy hơn.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Lấy RESEND_API_KEY từ Supabase Secrets
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY chưa được thiết lập trong mục Secrets của Edge Function.");
    }
    
    // 2. Tạo Supabase Admin client để đọc thông tin người gửi
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 3. Lấy thông tin người gửi từ bảng 'settings'
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("settings")
      .select("sender_name, sender_email")
      .eq("id", 1)
      .single();

    if (settingsError || !settings || !settings.sender_email || !settings.sender_name) {
      console.error("Settings Error:", settingsError);
      throw new Error("Thông tin 'Tên người gửi' và 'Email người gửi' chưa được cấu hình trong Cài đặt Email.");
    }

    // 4. Lấy thông tin email từ request gửi đến
    const { to, subject, html } = await req.json();
    if (!to || !subject || !html) {
      throw new Error("Thiếu thông tin người nhận, tiêu đề hoặc nội dung email.");
    }
    
    // 5. Gọi Resend API để gửi email
    const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
            from: `${settings.sender_name} <${settings.sender_email}>`,
            to: to,
            subject: subject,
            html: html,
        }),
    });

    const responseData = await resendResponse.json();

    if (!resendResponse.ok) {
        console.error("Resend API Error:", responseData);
        // Cố gắng trả về thông báo lỗi cụ thể từ Resend
        const errorMessage = responseData.message || "Gửi email qua Resend thất bại.";
        throw new Error(errorMessage);
    }
    
    // 6. Trả về thông báo thành công
    return new Response(
      JSON.stringify({ message: "Email đã được gửi thành công qua Resend!" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );

  } catch (error) {
    console.error("Send mail error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
