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
    <Text style={styles.heading}>
      Reset Your Password
    </Text>
    
    <Text style={styles.text}>
      No worries! Click below to create a new password and get back to your routes. 
      This link expires in 24 hours.
    </Text>

    <div style={styles.buttonContainer}>
      <Link href={resetUrl} style={styles.button}>
        Reset Password
      </Link>
    </div>

    <div style={styles.divider} />

    <Text style={styles.secondaryText}>
      If the button doesn't work, copy and paste this link:
    </Text>
    <Text style={{ ...styles.secondaryText, marginTop: '8px' }}>
      <Link href={resetUrl} style={styles.link}>
        {resetUrl}
      </Link>
    </Text>

    {token && (
      <>
        <Text style={{ ...styles.secondaryText, marginTop: '20px' }}>
          Or enter this reset code:
        </Text>
        <Text style={styles.codeBox}>
          {token}
        </Text>
      </>
    )}

    <Text style={{ ...styles.secondaryText, marginTop: '28px' }}>
      Didn't request this? Your password is still safe — just ignore this email.
    </Text>
  </BaseEmail>
)

export default ResetPasswordEmail
