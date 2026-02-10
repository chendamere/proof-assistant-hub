import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface WelcomeEmailRequest {
  email: string;
  displayName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userId = claimsData.claims.sub;
    const userEmail = claimsData.claims.email;

    const { email, displayName }: WelcomeEmailRequest = await req.json();

    // Only allow sending to the authenticated user's own email
    if (email !== userEmail) {
      return new Response(
        JSON.stringify({ error: "Can only send welcome email to your own address" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!email) {
      throw new Error("Email is required");
    }

    const name = displayName || "there";

    const emailResponse = await resend.emails.send({
      from: "Universal Language <noreply@contact.thewayofmachinethinking.com>",
      to: [email],
      subject: "Welcome to Universal Language",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f5f0e8;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f0e8;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(180,140,60,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#b8860b,#d4a017);padding:40px 40px 30px;text-align:center;">
              <div style="display:inline-block;width:48px;height:48px;border-radius:8px;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);line-height:48px;font-family:monospace;font-weight:bold;color:#fff;font-size:18px;margin-bottom:16px;">UL</div>
              <h1 style="margin:12px 0 0;color:#ffffff;font-size:28px;font-weight:600;letter-spacing:-0.5px;">Welcome to Universal Language</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="color:#2d2d2d;font-size:18px;line-height:1.6;margin:0 0 20px;">Hello ${name},</p>
              <p style="color:#4a4a4a;font-size:16px;line-height:1.7;margin:0 0 24px;">
                Thank you for joining Universal Language — a formal system for reasoning about tree-structured data with mathematical precision.
              </p>
              <p style="color:#4a4a4a;font-size:16px;line-height:1.7;margin:0 0 24px;">
                You now have access to our proof verifier, theorem library, and interactive tools for exploring the language's operators and inference rules.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:32px 0;">
                <tr>
                  <td style="background:#b8860b;border-radius:6px;">
                    <a href="https://universal-language.onrender.com" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;">Explore the System</a>
                  </td>
                </tr>
              </table>
              <p style="color:#888;font-size:14px;line-height:1.6;margin:0;">
                If you have any questions, feel free to reach out. We're glad to have you.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background:#faf8f4;border-top:1px solid #e8e0d0;text-align:center;">
              <p style="color:#999;font-size:12px;margin:0;">© 2026 Universal Language. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    });

    console.log("Welcome email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
