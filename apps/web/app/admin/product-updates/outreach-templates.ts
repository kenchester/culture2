// Default title/body for the two targeted-outreach audiences (Onboarded
// School / Yet-to-be-onboarded School) in UpdateForm below - drafted from
// learn.culturemesh.com/learn/educators, specifically its "How it closes
// the gap" section, and stored here so the admin never has to retype them.
// Links use plain "[label](url)" markdown - actions.ts's renderEmailBody
// turns that into a real <a href> for the HTML send and "label (url)" for
// the plain-text fallback, since the Body field is just a textarea (no
// rich-text editor anywhere in this app to author real anchors with).
export type OutreachKind = "onboarded" | "prospective";

const GAP_PARAGRAPHS = `Most language apps stop at solo drilling - flashcards, matching games, spaced repetition - which only gets a student so far. Past the beginner stage, the real bottleneck is production: actually saying or signing something to another person and being understood. CultureMesh Learn closes that gap with school-gated practice networks where students post text, audio, or up to 60 seconds of video, and every post is automatically checked to make sure it stays in the target language, so practice never quietly drifts back into English.

Beyond the daily practice space, instructors can set a weekly prompt to give each network direction, and any recognized student or staff member can launch a network for a language your program doesn't offer yet - no vendor contract or IT ticket required. And because video posting is built in from the start, it's one of the only tools that works for languages with no written form at all, like American Sign Language.`;

export const OUTREACH_TEMPLATES: Record<OutreachKind, { title: string; body: string }> = {
  onboarded: {
    title: "Your school now uses CultureMesh for language learning",
    body: `CultureMesh Learn, a pioneering language-learning network for guided student practice, has launched at your school.

${GAP_PARAGRAPHS}

Now that it's all been pushed live on your campus, we encourage you to [sign up](https://learn.culturemesh.com/sign-in) with your university email address and launch some networks yourself, or visit our [introductory page](https://learn.culturemesh.com/learn/educators) to learn more.

If you're ready to move forward with creating networks for your students and adding your class roster, please [reach out](https://learn.culturemesh.com/contact?subject=CultureMesh%20Learn%20Interest&message=I%27d%20like%20to%20bring%20CultureMesh%20Learn%20to%20my%20program.) to have us add you as a class admin.

Welcome to the language revolution!

Team CultureMesh`,
  },
  prospective: {
    title: "Your students are requesting CultureMesh for language learning",
    body: `CultureMesh Learn, a pioneering language-learning network for guided student practice, has been requested by students at [School Name].

${GAP_PARAGRAPHS}

To dig a bit deeper and try our sample networks, visit our [introductory page](https://learn.culturemesh.com/learn/educators) to learn more.

If you're ready to move forward with items such as creating language networks for your students and adding your class roster, please [reach out](https://learn.culturemesh.com/contact?subject=CultureMesh%20Learn%20Interest&message=I%27d%20like%20to%20bring%20CultureMesh%20Learn%20to%20my%20program.) to get started, completely free of charge.

Welcome to the language revolution!

Team CultureMesh`,
  },
};

export const GREETINGS = ["Good morning!", "Good afternoon!", "Good evening!"] as const;
