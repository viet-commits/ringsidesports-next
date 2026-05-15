import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with Ringside Sports — Australia's combat sports factory outlet.",
};

export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <h1 className="text-3xl font-bold text-primary mb-2">Contact Us</h1>
      <p className="text-secondary mb-10">
        We&apos;re here to help with any questions about our products, orders, or wholesale enquiries.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        {/* Contact Details */}
        <div>
          <h2 className="text-lg font-bold text-primary mb-4">Get in Touch</h2>
          <ul className="space-y-4 text-secondary">
            <li>
              <span className="block text-sm text-gray-400 mb-1">Email</span>
              <a
                href="mailto:info@ringsidesports.com.au"
                className="text-primary hover:underline font-medium"
              >
                info@ringsidesports.com.au
              </a>
            </li>
            <li>
              <span className="block text-sm text-gray-400 mb-1">Phone</span>
              <a href="tel:+61390000000" className="text-primary hover:underline font-medium">
                (03) 9000 0000
              </a>
            </li>
            <li>
              <span className="block text-sm text-gray-400 mb-1">Address</span>
              <p className="text-primary">
                Melbourne, VIC 3000
                <br />
                Australia
              </p>
            </li>
          </ul>
        </div>

        {/* Business Hours */}
        <div>
          <h2 className="text-lg font-bold text-primary mb-4">Business Hours</h2>
          <ul className="space-y-2 text-secondary">
            <li className="flex justify-between">
              <span>Monday – Friday</span>
              <span className="text-primary">9:00 AM – 5:00 PM</span>
            </li>
            <li className="flex justify-between">
              <span>Saturday</span>
              <span className="text-primary">10:00 AM – 2:00 PM</span>
            </li>
            <li className="flex justify-between">
              <span>Sunday</span>
              <span className="text-gray-400">Closed</span>
            </li>
          </ul>
          <p className="mt-4 text-sm text-gray-400">
            Melbourne time (AEST/AEDT). We aim to respond to all enquiries within 1 business day.
          </p>
        </div>
      </div>

      {/* Wholesale */}
      <div className="mt-12 p-6 rounded-xl border border-gray-200 bg-gray-50">
        <h2 className="text-lg font-bold text-primary mb-2">Wholesale & Bulk Orders</h2>
        <p className="text-secondary mb-4">
          We supply gyms, retailers, and martial arts schools across Australia. Carton quantity
          discounts available — contact us for a tailored quote.
        </p>
        <a
          href="mailto:info@ringsidesports.com.au?subject=Wholesale%20Enquiry"
          className="inline-flex items-center text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg px-4 py-2 transition-colors"
        >
          Email Wholesale Enquiry
        </a>
      </div>
    </div>
  );
}
