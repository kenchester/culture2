import Link from "next/link";

const sections = [
  {
    heading: "Eligibility",
    body: (
      <p>
        You must be at least 13 years old to create an account or use the
        Service. By using the Service, you represent that you meet this
        requirement and that all information you provide is accurate.
      </p>
    ),
  },
  {
    heading: "What CultureMesh Is",
    body: (
      <p>
        CultureMesh is a platform that connects people by a language or
        place of origin combined with where they currently live. You can
        search for an existing network for that combination, join it, or
        launch a new one if it doesn&apos;t exist yet. Within a network,
        members can post, reply, message each other, and host or attend
        events.
      </p>
    ),
  },
  {
    heading: "Accounts",
    body: (
      <p>
        You are responsible for maintaining the confidentiality of your
        account credentials and for all activity under your account.
        Notify us immediately if you suspect unauthorized use of your
        account by contacting us. You agree to provide accurate information
        when creating your account and to keep it up to date.
      </p>
    ),
  },
  {
    heading: "Your Content",
    body: (
      <>
        <p>
          You are solely responsible for the content of any profile
          information, post, reply, message, or event listing you submit
          through the Service. You retain ownership of the content you
          submit, but you grant CultureMesh a license to host, display, and
          distribute that content as needed to operate the Service.
        </p>
        <p>
          We may remove content that violates these Terms, and we may
          suspend or terminate accounts that repeatedly violate them.
        </p>
      </>
    ),
  },
  {
    heading: "Community Conduct",
    body: (
      <p>
        You agree not to: use the Service for any unlawful purpose; harass,
        threaten, or discriminate against another user; impersonate any
        person or misrepresent your affiliation with a person or entity;
        scrape, reverse-engineer, or interfere with the operation of the
        Service; or use the Service to exploit or endanger a minor.
      </p>
    ),
  },
  {
    heading: "Embassy and Partner Embeds",
    body: (
      <p>
        CultureMesh offers a white-label embed option that lets embassies
        and cultural organizations surface a scoped, CultureMesh-branding-
        free version of network search on their own website. These
        partnerships are configured directly by CultureMesh staff.
        Launching or joining a network through an embedded page is still
        subject to these Terms.
      </p>
    ),
  },
  {
    heading: "Intellectual Property",
    body: (
      <p>
        The Service, including its design, text, graphics, and underlying
        software, is owned by CultureMesh LLC or our licensors and is
        protected by intellectual property laws. You may not copy, modify,
        or distribute any part of the Service except as the Service itself
        permits.
      </p>
    ),
  },
  {
    heading: "Disclaimers",
    body: (
      <p className="uppercase">
        The service is provided &ldquo;as is&rdquo; and &ldquo;as
        available,&rdquo; without warranties of any kind, whether express or
        implied, including warranties of merchantability, fitness for a
        particular purpose, and non-infringement. CultureMesh does not
        control and is not responsible for the conduct of any user, on or
        off the Service. You are solely responsible for your interactions
        with other users.
      </p>
    ),
  },
  {
    heading: "Limitation of Liability",
    body: (
      <p className="uppercase">
        To the maximum extent permitted by law, CultureMesh will not be
        liable for any indirect, incidental, special, consequential, or
        punitive damages arising out of or related to your use of the
        Service. To the maximum extent permitted by law, CultureMesh&apos;s
        total liability for any claim arising out of or related to the
        Service will not exceed one hundred U.S. dollars.
      </p>
    ),
  },
  {
    heading: "Indemnification",
    body: (
      <p>
        You agree to indemnify and hold CultureMesh harmless from any
        claim, loss, or expense (including reasonable attorneys&apos; fees)
        arising out of your use of the Service, your violation of these
        Terms, or your interactions with another user.
      </p>
    ),
  },
  {
    heading: "Governing Law",
    body: (
      <p>
        These Terms are governed by the laws of the State of Michigan,
        without regard to its conflict-of-laws principles. Any dispute
        arising out of or relating to these Terms or the Service will be
        brought exclusively in the state or federal courts located in
        Michigan, and you consent to the jurisdiction of those courts.
      </p>
    ),
  },
  {
    heading: "Termination",
    body: (
      <p>
        You may stop using the Service and delete your account at any time
        by contacting us. We may suspend or terminate your access to the
        Service if you violate these Terms, or for any other reason with
        reasonable notice, except where immediate action is necessary to
        protect the Service or its users.
      </p>
    ),
  },
  {
    heading: "Changes to These Terms",
    body: (
      <p>
        We may update these Terms from time to time. If we make material
        changes, we will provide notice through the Service before the
        changes take effect. Continuing to use the Service after changes
        take effect means you accept the updated Terms.
      </p>
    ),
  },
  {
    heading: "Miscellaneous",
    body: (
      <p>
        If any provision of these Terms is found unenforceable, the
        remaining provisions will remain in full effect. Our failure to
        enforce any provision is not a waiver of it. These Terms, together
        with our Privacy Policy, are the entire agreement between you and
        CultureMesh regarding the Service.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-16">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-4xl text-ink">Terms and Conditions</h1>
        <p className="text-sm text-muted">Last updated August 9, 2026.</p>
      </div>

      <p className="text-body">
        These Terms and Conditions (&ldquo;Terms&rdquo;) govern your access
        to and use of CultureMesh (&ldquo;CultureMesh,&rdquo; &ldquo;we,&rdquo;
        &ldquo;us,&rdquo; or &ldquo;our&rdquo;) and the website and services
        we make available (together, the &ldquo;Service&rdquo;). By
        creating an account or otherwise using the Service, you agree to be
        bound by these Terms. If you do not agree, do not use the Service.
        CultureMesh is operated by CultureMesh LLC, a Michigan limited
        liability company.
      </p>

      {sections.map((section) => (
        <div key={section.heading} className="flex flex-col gap-2">
          <h2 className="font-display text-xl text-ink">{section.heading}</h2>
          <div className="flex flex-col gap-2 text-body">{section.body}</div>
        </div>
      ))}

      <p className="text-body">
        Questions about these Terms can be sent through our{" "}
        <Link href="/contact" className="text-primary underline">
          Contact Us
        </Link>{" "}
        page.
      </p>
    </div>
  );
}
