// File: supabase/functions/send-bulk-email/index.ts

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 100; // Giới hạn của Resend API

type Recipient = {
  email: string;
  name?: string;
};

// Hàm kiểm tra quyền của người dùng
const checkPermissions = async (req: Request, supabaseClient: SupabaseClient): Promise<void> => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing auth header.");
  }
  const { data: { user } } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!user) {
    throw new Error("Invalid JWT.");
  }

  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    throw new Error("Could not retrieve user profile.");
  }
  
  // Quản trị viên luôn có quyền
  if (profile.role === 'Quản trị viên') {
    return;
  }
  
  const { data: permissions, error: permError } = await supabaseClient
    .from('role_permissions')
    .select('permission')
    .eq('role', profile.role)
    .eq('permission', 'email:send_bulk');
    
  if (permError || !permissions || permissions.length === 0) {
    throw new Error("User does not have 'email:send_bulk' permission.");
  }
};


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!resendApiKey || !supabaseUrl || !serviceRoleKey) {
      throw new Error("Thiếu các biến môi trường cần thiết (API key hoặc URL).");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    // Kiểm tra quyền trước khi làm bất cứ điều gì khác
    await checkPermissions(req, supabaseAdmin);

    // Lấy thông tin người gửi từ CSDL
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("settings")
      .select("sender_name, sender_email")
      .eq("id", 1)
      .single();

    if (settingsError || !settings?.sender_email || !settings?.sender_name) {
      throw new Error("Tên và email người gửi chưa được cấu hình trong Cài đặt.");
    }
    const fromAddress = `${settings.sender_name} <${settings.sender_email}>`;

    // Lấy dữ liệu từ request body
    const { recipients, subject, html } = await req.json();
    if (!Array.isArray(recipients) || recipients.length === 0 || !subject || !html) {
      throw new Error("Thiếu các trường bắt buộc: recipients (mảng), subject, html.");
    }
    
    // Logic chia lô để gửi
    let successfulSends = 0;
    const allErrors: string[] = [];

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = recipients.slice(i, i + BATCH_SIZE);
        
        const emailPayloads = batch.map((recipient: Recipient) => {
          // Cá nhân hóa nội dung cho từng người
          const personalizedHtml = html
            .replace(/{{name}}/g, recipient.name || '')
            .replace(/{{email}}/g, recipient.email);
            
          return {
            from: fromAddress,
            to: [recipient.email],
            subject: subject,
            html: personalizedHtml,
          };
        });

        const resendResponse = await fetch("https://api.resend.com/emails/batch", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify(emailPayloads),
        });

        const responseData = await resendResponse.json();

        if (!resendResponse.ok) {
            console.error(`Resend Batch API Error (Batch ${i / BATCH_SIZE + 1}):`, responseData);
            const errorMessage = responseData.message || `Gửi lô ${i / BATCH_SIZE + 1} thất bại.`;
            allErrors.push(errorMessage);
        } else {
            successfulSends += batch.length;
        }
    }

    if (allErrors.length > 0) {
      throw new Error(`Hoàn thành với lỗi. Đã gửi: ${successfulSends}/${recipients.length}. Lỗi: ${allErrors.join(', ')}`);
    }
    
    return new Response(
      JSON.stringify({ message: `Đã đưa ${recipients.length} email vào hàng đợi để gửi thành công.` }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Bulk mail error:", error.message);
    const isPermissionError = error.message.includes("permission") || error.message.includes("JWT");
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: isPermissionError ? 403 : 500,
      }
    );
  }
});
