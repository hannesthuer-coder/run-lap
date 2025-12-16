import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReminderRequest {
  reminderType: "one_week" | "one_day" | "launch_day";
}

const getEmailContent = (reminderType: string) => {
  switch (reminderType) {
    case "one_week":
      return {
        subject: "One week to go!",
        heading: "run-lap launches in 7 days!",
        body: "The wait is almost over. In just one week, you'll be able to discover new running laps tailored to your exact distance preferences.",
        cta: "Get ready to lace up your shoes and explore your neighborhood like never before.",
      };
    case "one_day":
      return {
        subject: "tomorrow's the day!",
        heading: "run-lap launches tomorrow!",
        body: "We're just 24 hours away from launch. tomorrow at midnight, run-lap goes live and you'll be one of the first people to use it.",
        cta: "Lace up your running shoes and get ready!",
      };
    case "launch_day":
      return {
        subject: "We're live! Time to go for a run.",
        heading: "run-lap is officially live!",
        body: "The wait is over. run-lap is now available and ready to help you find the perfect running laps.",
        cta: "Click below to generate a new running lap and start your journey today!",
        buttonText: "start running",
        buttonUrl: "https://run-lap.com/app",
      };
    default:
      return {
        subject: "run-lap update",
        heading: "run-lap news",
        body: "we have an update for you.",
        cta: "stay tuned for more!",
      };
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reminderType }: ReminderRequest = await req.json();

    console.log(`[LAUNCH-REMINDER] Starting ${reminderType} reminder campaign`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all waitlist emails
    const { data: waitlistEntries, error: fetchError } = await supabase.from("waitlist").select("email");

    if (fetchError) {
      console.error("[LAUNCH-REMINDER] Error fetching waitlist:", fetchError);
      throw fetchError;
    }

    if (!waitlistEntries || waitlistEntries.length === 0) {
      console.log("[LAUNCH-REMINDER] No waitlist entries found");
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const content = getEmailContent(reminderType);
    const emails = waitlistEntries.map((entry) => entry.email);

    console.log(`[LAUNCH-REMINDER] Sending ${reminderType} reminder to ${emails.length} subscribers`);

    // Send emails in batches of 50 to avoid rate limits
    const batchSize = 50;
    let sentCount = 0;
    let errorCount = 0;

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      for (const email of batch) {
        try {
          await resend.emails.send({
            from: "Run-Lap <hello@run-lap.com>",
            to: [email],
            subject: content.subject,
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
                                ${content.heading}
                              </h1>
                              
                              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 26px; color: #4a4a4a; text-align: center;">
                                ${content.body}
                              </p>
                              
                              <div style="text-align: center; margin: 32px 0;">
                                <span style="display: inline-block; background-color: #3366CC; color: #ffffff; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
                                  ${content.cta}
                                </span>
                              </div>

                              ${
                                content.buttonUrl
                                  ? `
                              <div style="text-align: center; margin: 32px 0;">
                                <a href="${content.buttonUrl}" style="display: inline-block; background-color: #1a73e8; color: #ffffff; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; text-decoration: none;">
                                  ${content.buttonText}
                                </a>
                              </div>
                              `
                                  : ""
                              }
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
          sentCount++;
        } catch (emailError) {
          console.error(`[LAUNCH-REMINDER] Failed to send to ${email}:`, emailError);
          errorCount++;
        }
      }

      // Small delay between batches to avoid rate limits
      if (i + batchSize < emails.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log(`[LAUNCH-REMINDER] Campaign complete. Sent: ${sentCount}, Errors: ${errorCount}`);

    return new Response(JSON.stringify({ success: true, sent: sentCount, errors: errorCount }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[LAUNCH-REMINDER] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
