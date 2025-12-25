import {
  Text,
  Link,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseEmail, styles } from './base-email.tsx'

interface MagicLinkEmailProps {
  magicLinkUrl: string
  token?: string
}

export const MagicLinkEmail = ({ magicLinkUrl, token }: MagicLinkEmailProps) => (
  <BaseEmail preview="Your Run-Lap login link is ready">
    <Text style={styles.heading}>
      Your Login Link
    </Text>
    
    <Text style={styles.text}>
      Click below to securely access your Run-Lap account. 
      No password needed — this link expires in 1 hour.
    </Text>

    <div style={styles.buttonContainer}>
      <Link href={magicLinkUrl} style={styles.button}>
        Log In Now
      </Link>
    </div>

    <div style={styles.divider} />

    <Text style={styles.secondaryText}>
      If the button doesn't work, copy and paste this link:
    </Text>
    <Text style={{ ...styles.secondaryText, marginTop: '8px' }}>
      <Link href={magicLinkUrl} style={styles.link}>
        {magicLinkUrl}
      </Link>
    </Text>

    {token && (
      <>
        <Text style={{ ...styles.secondaryText, marginTop: '20px' }}>
          Or enter this login code:
        </Text>
        <Text style={styles.codeBox}>
          {token}
        </Text>
      </>
    )}

    <Text style={{ ...styles.secondaryText, marginTop: '28px' }}>
      Didn't request this? Just ignore this email — no action needed.
    </Text>
  </BaseEmail>
)

export default MagicLinkEmail
