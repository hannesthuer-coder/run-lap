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
    <Text style={styles.heading} className="email-heading">
      Your Login Link
    </Text>
    
    <Text style={styles.text} className="email-text">
      Click below to securely access your Run-Lap account. 
      No password needed — this link expires in 1 hour.
    </Text>

    <div style={styles.buttonContainer}>
      <Link href={magicLinkUrl} style={styles.button}>
        Log In Now
      </Link>
    </div>

    <div style={styles.divider} className="email-divider" />

    <Text style={styles.secondaryText} className="email-secondary-text">
      If the button doesn't work, copy and paste this link:
    </Text>
    <Text style={{ ...styles.secondaryText, marginTop: '8px' }} className="email-secondary-text">
      <Link href={magicLinkUrl} style={styles.link} className="email-link">
        {magicLinkUrl}
      </Link>
    </Text>

    {token && (
      <>
        <Text style={{ ...styles.secondaryText, marginTop: '20px' }} className="email-secondary-text">
          Or enter this login code:
        </Text>
        <Text style={styles.codeBox} className="email-code-box">
          {token}
        </Text>
      </>
    )}

    <Text style={{ ...styles.secondaryText, marginTop: '28px' }} className="email-secondary-text">
      Didn't request this? Just ignore this email — no action needed.
    </Text>
  </BaseEmail>
)

export default MagicLinkEmail
