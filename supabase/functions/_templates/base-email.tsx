import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Hr,
  Link,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

// Brand colors from Run-Lap design system
export const brandColors = {
  primary: '#3b82f6',        // HSL 220 75% 50%
  accent: '#0ea5e9',         // HSL 200 85% 50%
  background: '#f8fafc',     // HSL 210 30% 98%
  foreground: '#1e293b',     // HSL 220 40% 15%
  muted: '#64748b',          // HSL 220 15% 50%
  border: '#e2e8f0',         // HSL 210 25% 90%
  white: '#ffffff',
}

export const styles = {
  main: {
    backgroundColor: brandColors.background,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
  },
  container: {
    backgroundColor: brandColors.white,
    margin: '40px auto',
    padding: '0',
    maxWidth: '560px',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(59, 130, 246, 0.1)',
    overflow: 'hidden',
  },
  header: {
    background: `linear-gradient(135deg, ${brandColors.primary}, ${brandColors.accent})`,
    padding: '32px 40px',
    textAlign: 'center' as const,
  },
  logo: {
    margin: '0 auto',
  },
  logoText: {
    color: brandColors.white,
    fontSize: '28px',
    fontWeight: '700',
    margin: '0',
    letterSpacing: '-0.5px',
  },
  content: {
    padding: '40px',
  },
  heading: {
    color: brandColors.foreground,
    fontSize: '24px',
    fontWeight: '600',
    lineHeight: '1.3',
    margin: '0 0 16px',
  },
  text: {
    color: brandColors.foreground,
    fontSize: '16px',
    lineHeight: '1.6',
    margin: '0 0 24px',
  },
  button: {
    backgroundColor: brandColors.primary,
    borderRadius: '8px',
    color: brandColors.white,
    display: 'inline-block',
    fontSize: '16px',
    fontWeight: '600',
    padding: '14px 32px',
    textDecoration: 'none',
    textAlign: 'center' as const,
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
  },
  buttonContainer: {
    textAlign: 'center' as const,
    margin: '32px 0',
  },
  secondaryText: {
    color: brandColors.muted,
    fontSize: '14px',
    lineHeight: '1.5',
    margin: '24px 0 0',
  },
  link: {
    color: brandColors.primary,
    textDecoration: 'underline',
    wordBreak: 'break-all' as const,
  },
  hr: {
    borderColor: brandColors.border,
    margin: '24px 0',
  },
  footer: {
    backgroundColor: brandColors.background,
    padding: '24px 40px',
    textAlign: 'center' as const,
  },
  footerText: {
    color: brandColors.muted,
    fontSize: '12px',
    lineHeight: '1.5',
    margin: '0',
  },
  footerLink: {
    color: brandColors.muted,
    textDecoration: 'underline',
  },
}

interface BaseEmailProps {
  preview: string
  children: React.ReactNode
}

export const BaseEmail = ({ preview, children }: BaseEmailProps) => (
  <Html>
    <Head />
    <Preview>{preview}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        {/* Header with gradient and logo */}
        <Section style={styles.header}>
          <Text style={styles.logoText}>🏃 Run-Lap</Text>
        </Section>

        {/* Main content */}
        <Section style={styles.content}>
          {children}
        </Section>

        {/* Footer */}
        <Section style={styles.footer}>
          <Text style={styles.footerText}>
            © {new Date().getFullYear()} Run-Lap. All rights reserved.
          </Text>
          <Text style={{ ...styles.footerText, marginTop: '8px' }}>
            <Link href="https://run-lap.com/privacy" style={styles.footerLink}>
              Privacy Policy
            </Link>
            {' • '}
            <Link href="https://run-lap.com/terms" style={styles.footerLink}>
              Terms of Service
            </Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default BaseEmail
