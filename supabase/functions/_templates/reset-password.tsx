import {
  Text,
  Link,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseEmail, styles } from './base-email.tsx'

interface ResetPasswordEmailProps {
  resetUrl: string
  token?: string
}

export const ResetPasswordEmail = ({ resetUrl, token }: ResetPasswordEmailProps) => (
  <BaseEmail preview="Reset your Run-Lap password">
    <Text style={styles.heading} className="email-heading">
      Reset Your Password
    </Text>
    
    <Text style={styles.text} className="email-text">
      No worries! Click below to create a new password and get back to your routes. 
      This link expires in 24 hours.
    </Text>

    <div style={styles.buttonContainer}>
      <Link href={resetUrl} style={styles.button}>
        Reset Password
      </Link>
    </div>

    <div style={styles.divider} className="email-divider" />

    <Text style={styles.secondaryText} className="email-secondary-text">
      If the button doesn't work, copy and paste this link:
    </Text>
    <Text style={{ ...styles.secondaryText, marginTop: '8px' }} className="email-secondary-text">
      <Link href={resetUrl} style={styles.link} className="email-link">
        {resetUrl}
      </Link>
    </Text>

    {token && (
      <>
        <Text style={{ ...styles.secondaryText, marginTop: '20px' }} className="email-secondary-text">
          Or enter this reset code:
        </Text>
        <Text style={styles.codeBox} className="email-code-box">
          {token}
        </Text>
      </>
    )}

    <Text style={{ ...styles.secondaryText, marginTop: '28px' }} className="email-secondary-text">
      Didn't request this? Your password is still safe — just ignore this email.
    </Text>
  </BaseEmail>
)

export default ResetPasswordEmail
