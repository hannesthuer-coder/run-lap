import {
  Text,
  Link,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseEmail, styles } from './base-email.tsx'

interface ConfirmSignupEmailProps {
  confirmationUrl: string
  token?: string
}

export const ConfirmSignupEmail = ({ confirmationUrl, token }: ConfirmSignupEmailProps) => (
  <BaseEmail preview="Welcome to Run-Lap! Confirm your email to start exploring.">
    <Text style={styles.heading} className="email-heading">
      Welcome to Run-Lap!
    </Text>
    
    <Text style={styles.text} className="email-text">
      You're one step away from discovering your perfect running routes. 
      Confirm your email to start exploring amazing trails and tracks near you.
    </Text>

    <div style={styles.buttonContainer}>
      <Link href={confirmationUrl} style={styles.button}>
        Confirm My Email
      </Link>
    </div>

    <div style={styles.divider} className="email-divider" />

    <Text style={styles.secondaryText} className="email-secondary-text">
      If the button doesn't work, copy and paste this link:
    </Text>
    <Text style={{ ...styles.secondaryText, marginTop: '8px' }} className="email-secondary-text">
      <Link href={confirmationUrl} style={styles.link} className="email-link">
        {confirmationUrl}
      </Link>
    </Text>

    {token && (
      <>
        <Text style={{ ...styles.secondaryText, marginTop: '20px' }} className="email-secondary-text">
          Or enter this confirmation code:
        </Text>
        <Text style={styles.codeBox} className="email-code-box">
          {token}
        </Text>
      </>
    )}

    <Text style={{ ...styles.secondaryText, marginTop: '28px' }} className="email-secondary-text">
      Didn't create an account? You can safely ignore this email.
    </Text>
  </BaseEmail>
)

export default ConfirmSignupEmail
