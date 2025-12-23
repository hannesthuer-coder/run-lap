import {
  Text,
  Link,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseEmail, styles } from './base-email.tsx'

interface ConfirmSignupEmailProps {
  confirmationUrl: string
  token?: string
}

export const ConfirmSignupEmail = ({ confirmationUrl, token }: ConfirmSignupEmailProps) => (
  <BaseEmail preview="Welcome to Run-Lap! Please confirm your email address.">
    <Text style={styles.heading}>
      Welcome to Run-Lap! 👋
    </Text>
    
    <Text style={styles.text}>
      Thanks for signing up! We're excited to help you discover amazing running routes. 
      Please confirm your email address to get started.
    </Text>

    <div style={styles.buttonContainer}>
      <Link href={confirmationUrl} style={styles.button}>
        Confirm Email Address
      </Link>
    </div>

    <Hr style={styles.hr} />

    <Text style={styles.secondaryText}>
      If the button above doesn't work, copy and paste this link into your browser:
    </Text>
    <Text style={{ ...styles.secondaryText, marginTop: '8px' }}>
      <Link href={confirmationUrl} style={styles.link}>
        {confirmationUrl}
      </Link>
    </Text>

    {token && (
      <>
        <Text style={{ ...styles.secondaryText, marginTop: '16px' }}>
          Or use this confirmation code:
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
      If you didn't create an account with Run-Lap, you can safely ignore this email.
    </Text>
  </BaseEmail>
)

export default ConfirmSignupEmail
