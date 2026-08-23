// A form that only has a password field and no visible username field
// (the email is already known - shown as plain text, not as an editable
// input) leaves browsers guessing at what the "username" is when they
// offer to save the credential, and they tend to guess wrong, grabbing
// whatever text input sits nearest the password field. A hidden username
// field with autocomplete="username" is the standard fix (see
// web.dev/sign-in-form-best-practices): type="hidden" is invisible to
// this heuristic entirely, so this uses a type="text" field that's
// visually hidden instead (same off-screen technique as a honeypot,
// minus aria-hidden/tabIndex so it stays legitimate to password
// managers) - readOnly since the user never edits it directly.
export function HiddenUsernameField({ email }: { email: string }) {
  return (
    <input
      type="text"
      name="email"
      autoComplete="username"
      value={email}
      readOnly
      className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden"
    />
  );
}
