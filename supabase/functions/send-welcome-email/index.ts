import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { Resend } from "npm:resend@4.0.0"
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { WelcomeEmail } from '../_templates/welcome.tsx'

const resendApiKey = Deno.env.get('RESEND_API_KEY')

if (!resendApiKey) {
  console.error('[SEND-WELCOME-EMAIL] RESEND_API_KEY is not configured')
}

const resend = new Resend(resendApiKey as string)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WelcomeEmailRequest {
  userId: string
  email: string
  displayName?: string
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('[SEND-WELCOME-EMAIL] Processing request...')

    // Verify the user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('[SEND-WELCOME-EMAIL] No authorization header')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with the user's token
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('[SEND-WELCOME-EMAIL] Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { displayName }: Partial<WelcomeEmailRequest> = await req.json()

    console.log('[SEND-WELCOME-EMAIL] Sending welcome email to:', user.email)

    // Render the welcome email
    const html = await renderAsync(
      React.createElement(WelcomeEmail, {
        displayName: displayName || undefined,
      })
    )

    // Send the email
    const { data, error } = await resend.emails.send({
      from: 'Run-Lap <noreply@run-lap.com>',
      to: [user.email!],
      subject: 'Welcome to Run-Lap! 🏃',
      html: html,
    })

    if (error) {
      console.error('[SEND-WELCOME-EMAIL] Resend error:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[SEND-WELCOME-EMAIL] Email sent successfully:', data)

    return new Response(
      JSON.stringify({ success: true, messageId: data?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('[SEND-WELCOME-EMAIL] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

serve(handler)
