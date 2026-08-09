import Link from "next/link";

const sections = [
  {
    heading: "Information We Collect",
    body: (
      <>
        <p>
          <span className="font-medium text-ink">Account information.</span>{" "}
          When you create an account, we collect your email address and
          password.
        </p>
        <p>
          <span className="font-medium text-ink">Profile information.</span>{" "}
          You may add a username, first and last name, a profile photo, and
          a short &ldquo;about me&rdquo; description.
        </p>
        <p>
          <span className="font-medium text-ink">Network activity.</span> We
          collect the networks you join or launch, the posts and replies
          you write, the events you host or RSVP to, and your notification
          preferences.
        </p>
        <p>
          <span className="font-medium text-ink">Messages.</span> If you
          message another user through the Service, we store the content
          of that message.
        </p>
        <p>
          <span className="font-medium text-ink">
            Suggested-network submissions.
          </span>{" "}
          If you suggest a network that doesn&apos;t exist yet, we collect
          the origin and location text you submit.
        </p>
        <p>
          <span className="font-medium text-ink">Contact form.</span> If
          you contact us, we collect your name, email address, and message.
        </p>
        <p>
          <span className="font-medium text-ink">Usage information.</span>{" "}
          We collect standard technical information necessary to operate
          the Service, such as your IP address, browser type, and the
          pages you visit, primarily through server logs.
        </p>
      </>
    ),
  },
  {
    heading: "How We Use Information",
    body: (
      <p>
        We use the information we collect to: operate and maintain the
        Service; connect you with networks, events, and other members;
        deliver notifications you&apos;ve opted into; communicate with you
        about your account; detect and prevent fraud, abuse, and
        violations of our Terms and Conditions; and comply with legal
        obligations. We do not sell your personal information, and we do
        not currently use advertising or analytics services that track you
        across other websites.
      </p>
    ),
  },
  {
    heading: "How We Share Information",
    body: (
      <>
        <p>
          We share information with the following service providers, each
          of which processes information on our behalf and only for the
          purposes described in this policy:
        </p>
        <p>
          <span className="font-medium text-ink">Supabase, Inc.</span> &mdash;
          hosts our database, authentication, and file storage, including
          profile data, posts, messages, and event records.
        </p>
        <p>
          <span className="font-medium text-ink">Resend</span> &mdash;
          delivers transactional emails, such as account confirmation and
          password reset emails, and messages sent through our contact
          form.
        </p>
        <p>
          <span className="font-medium text-ink">Vercel Inc.</span> &mdash;
          hosts and serves the Service.
        </p>
        <p>
          We may also share information if required by law, to protect the
          rights, property, or safety of CultureMesh, our users, or the
          public, or in connection with a merger, acquisition, or sale of
          assets, in which case we will require the recipient to honor the
          commitments in this policy.
        </p>
        <p>
          Other members of a network see the profile information, posts,
          and replies you choose to make visible within that network, and
          the content of messages you exchange with them directly. If an
          embassy or partner organization operates a white-label embed of
          CultureMesh, and you launch or join a network through it, the
          same information described in this policy is collected &mdash;
          the partner does not receive any additional access to your
          account.
        </p>
      </>
    ),
  },
  {
    heading: "Cookies",
    body: (
      <p>
        We use only the cookies necessary to keep you signed in and to
        operate the Service securely. We do not currently use advertising
        or third-party tracking cookies.
      </p>
    ),
  },
  {
    heading: "Data Retention",
    body: (
      <p>
        We retain your information for as long as your account is active
        or as needed to provide the Service, comply with our legal
        obligations, resolve disputes, and enforce our agreements.
      </p>
    ),
  },
  {
    heading: "Your Rights and Choices",
    body: (
      <>
        <p>
          You can access and update most of your profile information
          directly from your account settings. You may request access to,
          correction of, or deletion of your personal information at any
          time by contacting us. We will respond to verified requests
          within a reasonable time.
        </p>
        <p>
          Depending on where you live, you may have additional rights over
          your personal information under applicable law. You can exercise
          any of these rights by contacting us.
        </p>
      </>
    ),
  },
  {
    heading: "Children's Privacy",
    body: (
      <p>
        The Service is not directed to, and is not available to, anyone
        under 13. We do not knowingly collect information from anyone
        under 13. If we learn that we have collected information from
        someone under 13, we will delete it.
      </p>
    ),
  },
  {
    heading: "Security",
    body: (
      <p>
        We use reasonable technical and organizational measures to protect
        the information we hold. No method of transmission or storage is
        completely secure, and we cannot guarantee absolute security.
      </p>
    ),
  },
  {
    heading: "Changes to This Policy",
    body: (
      <p>
        We may update this Privacy Policy from time to time. If we make
        material changes, we will provide notice through the Service or by
        other reasonable means before the changes take effect.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-16">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-4xl text-ink">Privacy Policy</h1>
        <p className="text-sm text-muted">Last updated August 9, 2026.</p>
      </div>

      <p className="text-body">
        This Privacy Policy explains how CultureMesh LLC (&ldquo;CultureMesh,&rdquo;
        &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects,
        uses, and shares information when you use our website and services
        (the &ldquo;Service&rdquo;). By using the Service, you agree to the
        collection and use of information as described here.
      </p>

      {sections.map((section) => (
        <div key={section.heading} className="flex flex-col gap-2">
          <h2 className="font-display text-xl text-ink">{section.heading}</h2>
          <div className="flex flex-col gap-2 text-body">{section.body}</div>
        </div>
      ))}

      <p className="text-body">
        If you have questions about this Privacy Policy or want to
        exercise any of the rights described above, reach us through our{" "}
        <Link href="/contact" className="text-primary underline">
          Contact Us
        </Link>{" "}
        page.
      </p>
    </div>
  );
}
