import {
  Text,
  Link,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseEmail, styles } from './base-email.tsx'

interface MagicLinkEmailProps {
  magicLinkUrl: string
  token?: string
}

export const MagicLinkEmail = ({ magicLinkUrl, token }: MagicLinkEmailProps) => (
  <BaseEmail preview="Your Run-Lap login link">
    <Text style={styles.heading}>
      Your Magic Login Link ✨
    </Text>
    
    <Text style={styles.text}>
      Click the button below to securely log in to your Run-Lap account. 
      No password needed!
    </Text>

    <div style={styles.buttonContainer}>
      <Link href={magicLinkUrl} style={styles.button}>
        Log In to Run-Lap
      </Link>
    </div>

    <Hr style={styles.hr} />

    <Text style={styles.secondaryText}>
      If the button above doesn't work, copy and paste this link into your browser:
    </Text>
    <Text style={{ ...styles.secondaryText, marginTop: '8px' }}>
      <Link href={magicLinkUrl} style={styles.link}>
        {magicLinkUrl}
      </Link>
    </Text>

    {token && (
      <>
        <Text style={{ ...styles.secondaryText, marginTop: '16px' }}>
          Or use this login code:
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
      This link will expire in 1 hour. If you didn't request this login link, 
      you can safely ignore this email.
    </Text>
  </BaseEmail>
)

export default MagicLinkEmail
