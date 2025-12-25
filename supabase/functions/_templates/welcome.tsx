import {
  Text,
  Link,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseEmail, styles, brandColors } from './base-email.tsx'

interface WelcomeEmailProps {
  displayName?: string
}

export const WelcomeEmail = ({ displayName }: WelcomeEmailProps) => (
  <BaseEmail preview="Welcome to Run-Lap! Your running journey starts now.">
    <Text style={styles.heading} className="email-heading">
      {displayName ? `Hey ${displayName}, welcome aboard!` : 'Welcome aboard!'}
    </Text>
    
    <Text style={styles.text} className="email-text">
      You're officially part of the Run-Lap community. We're excited to help you 
      discover amazing running routes tailored just for you.
    </Text>

    <div style={styles.buttonContainer}>
      <Link href="https://run-lap.com" style={styles.button}>
        Start Exploring Routes
      </Link>
    </div>

    <div style={styles.divider} className="email-divider" />

    <Text style={{ ...styles.text, fontSize: '15px', marginBottom: '16px' }} className="email-text">
      Here's what you can do with Run-Lap:
    </Text>

    <div style={featureListStyles.container}>
      <div style={featureListStyles.item}>
        <Text style={featureListStyles.icon}>🗺️</Text>
        <Text style={featureListStyles.text} className="email-text">
          Generate custom running routes based on your preferred distance
        </Text>
      </div>
      <div style={featureListStyles.item}>
        <Text style={featureListStyles.icon}>📍</Text>
        <Text style={featureListStyles.text} className="email-text">
          Choose any starting point and explore new neighborhoods
        </Text>
      </div>
      <div style={featureListStyles.item}>
        <Text style={featureListStyles.icon}>💾</Text>
        <Text style={featureListStyles.text} className="email-text">
          Save your favorite routes and access them anytime
        </Text>
      </div>
      <div style={featureListStyles.item}>
        <Text style={featureListStyles.icon}>🔗</Text>
        <Text style={featureListStyles.text} className="email-text">
          Share routes with friends and running buddies
        </Text>
      </div>
    </div>

    <Text style={{ ...styles.secondaryText, marginTop: '32px' }} className="email-secondary-text">
      Have questions? Just reply to this email or reach out on{' '}
      <Link href="https://www.instagram.com/run.lap/" style={styles.link} className="email-link">
        Instagram
      </Link>
      . We'd love to hear from you!
    </Text>
  </BaseEmail>
)

const featureListStyles = {
  container: {
    margin: '0',
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: '12px',
  },
  icon: {
    fontSize: '18px',
    marginRight: '12px',
    marginTop: '0',
    marginBottom: '0',
    lineHeight: '1.5',
  },
  text: {
    color: brandColors.foreground,
    fontSize: '14px',
    lineHeight: '1.5',
    margin: '0',
    flex: '1',
  },
}

export default WelcomeEmail
