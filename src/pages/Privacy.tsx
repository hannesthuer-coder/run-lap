import { Helmet } from "react-helmet-async";
import { Header } from "@/components/Header";
import Footer from "@/components/Footer";
export default function Privacy() {
  return <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>Privacy Policy | Run-Lap</title>
        <meta name="description" content="Read the Run-Lap privacy policy. Learn how we collect, use, and protect your personal data when using our running route generator." />
        <link rel="canonical" href="https://run-lap.com/privacy" />
      </Helmet>
      <Header />
      
      <main className="flex-1 max-w-4xl mx-auto px-4 py-12 my-[95px]">
        <article className="prose prose-gray max-w-none">
          <h1 className="text-3xl font-bold mb-2">Privacy Policy – Run-Lap</h1>
          <p className="text-muted-foreground mb-8">Valid from: 2025-12-01</p>

          <p className="mb-8">
            This Privacy Policy explains how Run-Lap collects and uses your personal data when you use our service.
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">1. Data Controller</h2>
            <p className="mb-4">
              Run-Lap (Reg. no. 20060915-3432) is the controller responsible for the processing of your personal data.
            </p>
            <p className="mb-2"><strong>Contact details:</strong></p>
            <address className="not-italic pl-4 border-l-2 border-beige">
              Run-Lap<br />
              Hägerstensvägen 163<br />
              SE-126 53 Hägersten<br />
              Sweden<br />
              Email: <a href="mailto:Contact@run-lap.com" className="text-beige-foreground hover:underline">Contact@run-lap.com</a>
            </address>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">2. What data do we collect?</h2>
            <p className="mb-4">We collect and process the following types of data:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Identity and Contact Data:</strong> Email address (used as username).</li>
              <li><strong>Payment Information:</strong> We can view the status of your payments, but actual card details are handled securely and encrypted directly by our payment partner, Stripe. We do not store full credit card numbers.</li>
              <li><strong>User Data & Health Data:</strong> Information you enter for the service to function, such as desired distance, estimated calorie burn, and geographic starting points for your runs.</li>
              <li><strong>Technical Data:</strong> IP address, information about your device and browser, and logs regarding how you interact with the service.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">3. Why do we process your data? (Legal Basis)</h2>
            
            <h3 className="text-lg font-medium mt-6 mb-2">A. To deliver the service (Performance of Contract)</h3>
            <p className="mb-4">
              We need your email to create your account and your preferences (distance/location) for the algorithm 
              to generate a running route for you. Without this data, we cannot deliver the service.
            </p>

            <h3 className="text-lg font-medium mt-6 mb-2">B. To handle payments (Performance of Contract)</h3>
            <p className="mb-4">We process payment data to charge for Premium subscriptions.</p>

            <h3 className="text-lg font-medium mt-6 mb-2">C. To fulfill legal obligations (Legal Obligation)</h3>
            <p className="mb-4">
              We retain transaction history (receipts/invoices) to comply with the Swedish Accounting Act (Bokföringslagen).
            </p>

            <h3 className="text-lg font-medium mt-6 mb-2">D. To improve the service (Legitimate Interest)</h3>
            <p>We analyze anonymized user data to understand how the service is used and to improve it.</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">4. Who do we share data with?</h2>
            <p className="mb-4">
              We never sell your personal data to third parties. We only share necessary data with selected 
              sub-processors who help us operate the service:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Stripe:</strong> Payment service provider. Handles payments securely.</li>
              <li><strong>Resend:</strong> Email service. Used to send system emails (e.g., "Welcome," "Reset Password," or receipts).</li>
              <li><strong>Hosting/Database Provider:</strong> Server provider where our database is stored (within the EU/EEA or in accordance with applicable protection regulations).</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">5. How long do we keep your data?</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Active accounts:</strong> We keep your data as long as you have an account with us (Free or Premium).</li>
              <li><strong>Bookkeeping:</strong> Data required for bookkeeping (e.g., payment history) is kept for 7 years in accordance with Swedish law.</li>
              <li><strong>Deletion:</strong> If you choose to delete your account, your personal user data will be deleted from our active systems within 30 days.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">6. Security</h2>
            <p>
              We take appropriate technical and organizational measures to protect your personal data against 
              unauthorized access, alteration, or loss. Traffic to and from the website is encrypted using SSL/TLS.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">7. Cookies</h2>
            <p>
              We use cookies to keep you logged in and to analyze traffic on the website. You can control 
              the use of cookies via your browser settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">8. Your Rights</h2>
            <p className="mb-4">Under the GDPR, you have the right to:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Request an extract of the personal data we process about you.</li>
              <li>Request rectification of incorrect data.</li>
              <li>Request erasure of your data ("the right to be forgotten"), provided we are not required to keep it by law (e.g., bookkeeping).</li>
              <li>Object to processing based on legitimate interest.</li>
            </ul>
            <p className="mb-4">
              If you wish to exercise any of these rights, please contact us at{" "}
              <a href="mailto:Contact@run-lap.com" className="text-beige-foreground hover:underline">Contact@run-lap.com</a>.
            </p>
            <p>
              If you believe that we are processing your personal data incorrectly, you have the right to lodge 
              a complaint with the Swedish Authority for Privacy Protection (Integritetsskyddsmyndigheten - IMY).
            </p>
          </section>
        </article>
      </main>

      <Footer />
    </div>;
}