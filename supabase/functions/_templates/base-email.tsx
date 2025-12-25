import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Link,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

// Brand colors from Run-Lap design system
export const brandColors = {
  // Light mode
  primary: '#3b82f6',
  accent: '#0ea5e9',
  background: '#f8fafc',
  foreground: '#1e293b',
  muted: '#64748b',
  border: '#e2e8f0',
  beige: '#dce8f5',
  white: '#ffffff',
  // Dark mode
  darkBackground: '#0f172a',
  darkForeground: '#f1f5f9',
  darkMuted: '#94a3b8',
  darkBorder: '#334155',
  darkCard: '#1e293b',
  darkFooter: '#1a2744',
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
    borderRadius: '16px',
    boxShadow: '0 8px 30px rgba(59, 130, 246, 0.12)',
    overflow: 'hidden',
  },
  header: {
    background: `linear-gradient(135deg, ${brandColors.primary}, ${brandColors.accent})`,
    padding: '40px',
    textAlign: 'center' as const,
  },
  logo: {
    margin: '0 auto',
  },
  content: {
    padding: '48px 40px',
  },
  heading: {
    color: brandColors.foreground,
    fontSize: '26px',
    fontWeight: '700',
    lineHeight: '1.3',
    margin: '0 0 20px',
    textAlign: 'center' as const,
  },
  text: {
    color: brandColors.foreground,
    fontSize: '16px',
    lineHeight: '1.7',
    margin: '0 0 28px',
    textAlign: 'center' as const,
  },
  button: {
    background: `linear-gradient(135deg, ${brandColors.primary}, ${brandColors.accent})`,
    borderRadius: '12px',
    color: brandColors.white,
    display: 'inline-block',
    fontSize: '16px',
    fontWeight: '600',
    padding: '16px 40px',
    textDecoration: 'none',
    textAlign: 'center' as const,
    boxShadow: '0 6px 20px rgba(59, 130, 246, 0.35)',
  },
  buttonContainer: {
    textAlign: 'center' as const,
    margin: '36px 0',
  },
  secondaryText: {
    color: brandColors.muted,
    fontSize: '14px',
    lineHeight: '1.6',
    margin: '24px 0 0',
    textAlign: 'center' as const,
  },
  link: {
    color: brandColors.primary,
    textDecoration: 'underline',
    wordBreak: 'break-all' as const,
  },
  codeBox: {
    backgroundColor: brandColors.background,
    padding: '16px 24px',
    borderRadius: '10px',
    fontFamily: 'monospace',
    fontSize: '20px',
    letterSpacing: '3px',
    textAlign: 'center' as const,
    marginTop: '12px',
    color: brandColors.foreground,
    border: `1px solid ${brandColors.border}`,
  },
  divider: {
    height: '1px',
    backgroundColor: brandColors.border,
    margin: '32px 0',
    border: 'none',
  },
  footer: {
    backgroundColor: brandColors.beige,
    padding: '32px 40px',
    textAlign: 'center' as const,
  },
  socialContainer: {
    marginBottom: '20px',
  },
  socialLink: {
    display: 'inline-block',
    margin: '0 12px',
    color: brandColors.muted,
    textDecoration: 'none',
    fontSize: '14px',
  },
  footerText: {
    color: brandColors.muted,
    fontSize: '12px',
    lineHeight: '1.6',
    margin: '0',
  },
  footerLink: {
    color: brandColors.muted,
    textDecoration: 'underline',
  },
}

// Dark mode CSS overrides
const darkModeStyles = `
  @media (prefers-color-scheme: dark) {
    body, .email-body {
      background-color: ${brandColors.darkBackground} !important;
    }
    .email-container {
      background-color: ${brandColors.darkCard} !important;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4) !important;
    }
    .email-content {
      background-color: ${brandColors.darkCard} !important;
    }
    .email-heading {
      color: ${brandColors.darkForeground} !important;
    }
    .email-text {
      color: ${brandColors.darkForeground} !important;
    }
    .email-secondary-text {
      color: ${brandColors.darkMuted} !important;
    }
    .email-code-box {
      background-color: ${brandColors.darkBackground} !important;
      border-color: ${brandColors.darkBorder} !important;
      color: ${brandColors.darkForeground} !important;
    }
    .email-divider {
      background-color: ${brandColors.darkBorder} !important;
    }
    .email-footer {
      background-color: ${brandColors.darkFooter} !important;
    }
    .email-footer-text, .email-social-link {
      color: ${brandColors.darkMuted} !important;
    }
    .email-link {
      color: ${brandColors.accent} !important;
    }
  }
`

interface BaseEmailProps {
  preview: string
  children: React.ReactNode
}

export const BaseEmail = ({ preview, children }: BaseEmailProps) => (
  <Html>
    <Head>
      <style dangerouslySetInnerHTML={{ __html: darkModeStyles }} />
    </Head>
    <Preview>{preview}</Preview>
    <Body style={styles.main} className="email-body">
      <Container style={styles.container} className="email-container">
        {/* Header with gradient and logo */}
        <Section style={styles.header}>
          <Img
            src="https://run-lap.com/logo.png?v=2"
            width="180"
            height="auto"
            alt="Run-Lap"
            style={styles.logo}
          />
        </Section>

        {/* Main content */}
        <Section style={styles.content} className="email-content">
          {children}
        </Section>

        {/* Footer with social links */}
        <Section style={styles.footer} className="email-footer">
          <div style={styles.socialContainer}>
            <Link 
              href="https://www.instagram.com/run.lap/" 
              style={styles.socialLink}
              className="email-social-link"
            >
              Instagram
            </Link>
            <Link 
              href="mailto:Contact@run-lap.com" 
              style={styles.socialLink}
              className="email-social-link"
            >
              Contact Us
            </Link>
          </div>
          <Text style={styles.footerText} className="email-footer-text">
            © {new Date().getFullYear()} Run-Lap. All rights reserved.
          </Text>
          <Text style={{ ...styles.footerText, marginTop: '8px' }} className="email-footer-text">
            <Link href="https://run-lap.com/privacy" style={styles.footerLink} className="email-link">
              Privacy Policy
            </Link>
            {' • '}
            <Link href="https://run-lap.com/terms" style={styles.footerLink} className="email-link">
              Terms of Service
            </Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default BaseEmail
