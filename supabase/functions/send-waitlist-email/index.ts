import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WaitlistEmailRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: WaitlistEmailRequest = await req.json();

    if (!email || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[WAITLIST-EMAIL] Sending confirmation to: ${email}`);

    const emailResponse = await resend.emails.send({
      from: "Run-Lap <hello@run-lap.com>",
      to: [email],
      subject: "you're on the list! 🏃",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    
                    <!-- Header with Logo -->
                    <tr>
                      <td align="center" style="padding: 40px 40px 30px 40px; background-color: #ffffff;">
                        <img src="https://rxzubvqznmvvarmfsioe.supabase.co/storage/v1/object/public/avatars/logo-black.png" alt="Run-Lap" width="80" height="80" style="display: block; width: 80px; height: 80px;">
                      </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                      <td style="padding: 0 40px 40px 40px;">
                        <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: 600; color: #1a1a1a; text-align: center;">
                          you're on the list!
                        </h1>
                        
                        <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 26px; color: #4a4a4a; text-align: center;">
                          put on your running shoes and get ready to explore new running laps.
                        </p>
                        
                        <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 26px; color: #4a4a4a; text-align: center;">
                          we're launching on <strong style="color: #1a1a1a;">march 1st, 2026</strong> and we'll notify you as soon as run-lap goes live.
                        </p>
                        
                        <div style="text-align: center; margin: 32px 0;">
                          <span style="display: inline-block; background-color: #e8d5b7; color: #1a1a1a; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
                            whatever distance you want to run, we will find a way.
                          </span>
                        </div>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 24px 40px; background-color: #fafafa; border-top: 1px solid #eee;">
                        <p style="margin: 0; font-size: 13px; line-height: 20px; color: #888888; text-align: center;">
                          follow us on <a href="https://instagram.com/runlap" style="color: #1a73e8; text-decoration: none;">instagram</a>
                        </p>
                        <p style="margin: 12px 0 0 0; font-size: 12px; color: #aaaaaa; text-align: center;">
                          © ${new Date().getFullYear()} run-lap · hägerstensvägen 163, se-126 53 hägersten, sweden
                        </p>
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

    console.log("[WAITLIST-EMAIL] Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[WAITLIST-EMAIL] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
