import { Header } from "@/components/Header";
import Footer from "@/components/Footer";
export default function Terms() {
  return <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 max-w-4xl mx-auto px-4 py-12">
        <article className="prose prose-gray max-w-none my-[10px]">
          <h1 className="text-3xl font-bold mb-2">General Terms and Conditions – Run-Lap</h1>
          <p className="text-muted-foreground mb-8">Last updated: 2025-11-22</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">1. General</h2>
            <p className="mb-4">
              These General Terms and Conditions (the "Terms") apply when you as a consumer (the "Customer") 
              use the service Run-Lap or subscribe to a subscription via run-lap.com.
            </p>
            <p className="mb-4">The service is provided by:</p>
            <address className="not-italic mb-4 pl-4 border-l-2 border-beige">
              <strong>Run-Lap</strong> (Reg. no. 20060915-3432)<br />
              Hägerstensvägen 163<br />
              SE-126 53 Hägersten<br />
              Sweden<br />
              Email: <a href="mailto:Contact@run-lap.com" className="text-beige-foreground hover:underline">Contact@run-lap.com</a>
            </address>
            <p>("The Service Provider")</p>
            <p>By using the service or completing a purchase, you agree to these Terms.</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">2. The Service</h2>
            <p className="mb-4">
              Run-Lap is a digital tool that generates suggestions for running routes based on the user's 
              stated preferences (e.g., distance or calorie burn). The service is offered in two tiers:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Free:</strong> A free version limited to generating a maximum of 3 routes per 30-day period.</li>
              <li><strong>Premium:</strong> A paid subscription service granting unlimited access to the service's features.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">3. Orders and Agreement</h2>
            <p>
              To use the service, you must be at least 18 years old. A binding agreement is entered into when 
              you choose to upgrade to Premium at checkout and complete the payment, upon which you will receive 
              a confirmation via email.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">4. Price and Payment</h2>
            <p className="mb-4">Prices are stated in Swedish Kronor (SEK) including 25% VAT. Payment is made monthly in advance.</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>We use <strong>Stripe</strong> as our provider for secure card payments.</li>
              <li>The subscription fee is automatically deducted from your registered payment card each month on the renewal date.</li>
              <li>In the event of a failed transaction (e.g., insufficient funds), the Premium service will be paused or the account will revert to the "Free" tier until payment has been completed.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">5. Right of Withdrawal (Important!)</h2>
            <p className="mb-4">
              According to the Swedish Distance Contracts Act (Lagen om distansavtal och avtal utanför affärslokaler), 
              consumers typically have a 14-day right of withdrawal.
            </p>
            <p className="mb-4">
              However, since this service refers to <strong>digital content not delivered on a physical medium</strong>, 
              an exception to the right of withdrawal applies if delivery begins immediately:
            </p>
            <blockquote className="border-l-4 border-beige bg-beige/10 p-4 my-4 italic">
              By subscribing and starting to use the Premium services, you expressly consent to the immediate 
              commencement of the service delivery and acknowledge that you thereby lose your right of withdrawal.
            </blockquote>
            <p>If you do not consent to this, you cannot use the Premium service.</p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">6. Term and Termination</h2>
            <p className="mb-4">The subscription runs on a monthly basis and renews automatically unless cancelled. There is no binding period.</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You may cancel your subscription at any time via your account settings ("My Pages").</li>
              <li>Cancellation must occur before the next renewal date.</li>
              <li>Upon cancellation, you will continue to have access to the Premium service for the period you have already paid for. After this, the account reverts to the Free tier. No refunds are issued for partial months.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">7. User Account</h2>
            <p>
              You are responsible for keeping your login details confidential and ensuring they are not shared 
              with unauthorized persons. You are responsible for all activity that occurs under your account. 
              The Service Provider reserves the right to suspend accounts in the event of misuse or violation of these Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">8. Limitation of Liability and Safety</h2>
            <p className="mb-4">
              The service generates route suggestions based on map data and algorithms. The Service Provider 
              cannot guarantee that suggested routes are passable, safe, lit, or free from traffic at any given time.
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>All training and running along the generated routes are done strictly at the <strong>Customer's own risk</strong>.</li>
              <li>The Service Provider is not liable for personal injuries, accidents, or property damage that may occur in connection with the Customer following a route generated by the service.</li>
              <li>Information regarding calorie burn and health data are general estimates only and should not be considered medical advice or exact facts.</li>
            </ul>
            <p>
              Furthermore, the Service Provider is not liable for technical errors, maintenance interruptions, 
              or data loss beyond our control (Force Majeure).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">9. Changes to Terms</h2>
            <p className="mb-4">The Service Provider reserves the right to change these terms and the price of the service at any time.</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Price changes will be notified via email at least 30 days before they take effect.</li>
              <li>If you do not accept the new terms or the new price, you have the right to terminate your subscription before the change takes effect.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">10. Personal Data</h2>
            <p>
              We protect your privacy. Information on how we process your personal data can be found in our{" "}
              <a href="/privacy" className="text-beige-foreground hover:underline font-medium">Privacy Policy</a>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">11. Governing Law and Disputes</h2>
            <p>
              Disputes regarding the interpretation or application of these Terms shall primarily be resolved 
              by agreement. If the parties cannot agree, the dispute may be settled by the National Board for 
              Consumer Disputes (ARN) in Sweden or, ultimately, by a Swedish general court.
            </p>
          </section>

          {/* Company Information */}
          <div className="mt-12 pt-8 border-t border-beige/30 text-center text-sm text-muted-foreground space-y-1">
            <p><strong>Run-Lap</strong> Reg. no: 20060915-3432</p>
            <p>Hägerstensvägen 163, 126 53 Hägersten, Sweden</p>
            <p>
              <a href="mailto:Contact@run-lap.com" className="hover:underline">Contact@run-lap.com</a>
              <span className="mx-2">•</span>
              Registered for F-tax (F-skatt)
            </p>
          </div>
        </article>
      </main>

      <Footer />
    </div>;
}