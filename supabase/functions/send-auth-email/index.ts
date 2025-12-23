import React from 'npm:react@18.3.1'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { ConfirmSignupEmail } from '../_templates/confirm-signup.tsx'
import { ResetPasswordEmail } from '../_templates/reset-password.tsx'
import { MagicLinkEmail } from '../_templates/magic-link.tsx'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string

interface AuthEmailPayload {
  user: {
    email: string
    user_metadata?: {
      display_name?: string
    }
  }
  email_data: {
    token: string
    token_hash: string
    redirect_to: string
    email_action_type: string
    site_url: string
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    console.log('[SEND-AUTH-EMAIL] Method not allowed:', req.method)
    return new Response('Method not allowed', { status: 405 })
  }

  console.log('[SEND-AUTH-EMAIL] Received webhook request')

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)

  let emailData: AuthEmailPayload

  try {
    // Verify webhook signature
    const wh = new Webhook(hookSecret)
    emailData = wh.verify(payload, headers) as AuthEmailPayload
    console.log('[SEND-AUTH-EMAIL] Webhook verified successfully')
  } catch (error) {
    console.error('[SEND-AUTH-EMAIL] Webhook verification failed:', error)
    return new Response(
      JSON.stringify({ error: { http_code: 401, message: 'Invalid webhook signature' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { user, email_data } = emailData
  const { token, token_hash, redirect_to, email_action_type, site_url } = email_data
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? site_url

  console.log('[SEND-AUTH-EMAIL] Processing email:', {
    email: user.email,
    type: email_action_type,
  })

  try {
    let html: string
    let subject: string

    // Build the confirmation/action URL
    const actionUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`

    switch (email_action_type) {
      case 'signup':
      case 'email_confirmation':
        subject = 'Welcome to Run-Lap! Please confirm your email'
        html = await renderAsync(
          React.createElement(ConfirmSignupEmail, {
            confirmationUrl: actionUrl,
            token: token,
          })
        )
        break

      case 'recovery':
      case 'reset_password':
        subject = 'Reset your Run-Lap password'
        html = await renderAsync(
          React.createElement(ResetPasswordEmail, {
            resetUrl: actionUrl,
            token: token,
          })
        )
        break

      case 'magiclink':
      case 'magic_link':
        subject = 'Your Run-Lap login link'
        html = await renderAsync(
          React.createElement(MagicLinkEmail, {
            magicLinkUrl: actionUrl,
            token: token,
          })
        )
        break

      case 'email_change':
        subject = 'Confirm your new email address'
        html = await renderAsync(
          React.createElement(ConfirmSignupEmail, {
            confirmationUrl: actionUrl,
            token: token,
          })
        )
        break

      default:
        console.log('[SEND-AUTH-EMAIL] Unknown email type:', email_action_type)
        // Default to confirmation email for unknown types
        subject = 'Action required for your Run-Lap account'
        html = await renderAsync(
          React.createElement(ConfirmSignupEmail, {
            confirmationUrl: actionUrl,
            token: token,
          })
        )
    }

    console.log('[SEND-AUTH-EMAIL] Sending email via Resend...')

    const { data, error } = await resend.emails.send({
      from: 'Run-Lap <noreply@runlap.app>',
      to: [user.email],
      subject: subject,
      html: html,
    })

    if (error) {
      console.error('[SEND-AUTH-EMAIL] Resend error:', error)
      throw error
    }

    console.log('[SEND-AUTH-EMAIL] Email sent successfully:', data)

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('[SEND-AUTH-EMAIL] Error sending email:', error)
    return new Response(
      JSON.stringify({
        error: {
          http_code: error.statusCode || 500,
          message: error.message || 'Failed to send email',
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
