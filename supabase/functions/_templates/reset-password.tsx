import {
  Text,
  Link,
  Hr,
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
      Reset Your Password 🔐
    </Text>
    
    <Text style={styles.text}>
      We received a request to reset your password for your Run-Lap account. 
      Click the button below to create a new password.
    </Text>

    <div style={styles.buttonContainer}>
      <Link href={resetUrl} style={styles.button}>
        Reset Password
      </Link>
    </div>

    <Hr style={styles.hr} />

    <Text style={styles.secondaryText}>
      If the button above doesn't work, copy and paste this link into your browser:
    </Text>
    <Text style={{ ...styles.secondaryText, marginTop: '8px' }}>
      <Link href={resetUrl} style={styles.link}>
        {resetUrl}
      </Link>
    </Text>

    {token && (
      <>
        <Text style={{ ...styles.secondaryText, marginTop: '16px' }}>
          Or use this reset code:
        </Text>
        <Text style={{
          ...styles.text,
          backgroundColor: '#f1f5f9',
          padding: '12px 16px',
          borderRadius: '8px',
          fontFamily: 'monospace',
          fontSize: '18px',
          letterSpacing: '2px',
          textAlign: 'center' as const,
          marginTop: '8px',
        }}>
          {token}
        </Text>
      </>
    )}

    <Text style={{ ...styles.secondaryText, marginTop: '24px' }}>
      This link will expire in 24 hours. If you didn't request a password reset, 
      you can safely ignore this email — your password will remain unchanged.
    </Text>
  </BaseEmail>
)

export default ResetPasswordEmail
