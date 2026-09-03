# Transcription, captions, and sign-language support

Reference for why this works the way it does. Most of what follows is
recorded because the intuitive change is the wrong one, and someone
(including a future us) will otherwise try it again.

Shipped September 2026. Code: `lib/transcription.ts`,
`app/api/captions/[kind]/[id]/route.ts`,
`components/transcript-disclosure.tsx`,
`app/networks/[id]/signed-summary-fields.tsx`. Migrations 72–77.

---

## 1. Why this exists: it's a Level A failure, not a nice-to-have

The accessibility pass that preceded this brought the site to WCAG 2.2
**AA** on structure, keyboard and contrast. Audio and video posts with no
text alternative are a **Level A** failure — the more severe tier.

| Post type | Criterion | Level | Satisfied by |
|---|---|---|---|
| Audio-only | 1.2.1 Audio-only (Prerecorded) | **A** | Transcript |
| Video with speech | 1.2.2 Captions (Prerecorded) | **A** | Time-synced captions during playback |
| Video with speech | 1.2.3 Media Alternative | **A** | Transcript |
| Video, no audio (signed) | 1.2.1 Video-only (Prerecorded) | **A** | Human-written text alternative |

**A transcript does not satisfy 1.2.2.** Captions must be synchronized and
available during playback. Video therefore needs both; audio-only needs
only the transcript.

Before this, a deaf or hard-of-hearing student in a network where
classmates post voice notes got nothing at all.

---

## 2. Vendor: Groq `whisper-large-v3-turbo`

### Why not Azure (the original plan)

The earlier plan specified Azure Speech-to-Text, on the reasoning that the
project already had an Azure Cognitive Services account for the Translator.
It stalled and was abandoned, for two reasons:

1. **Format.** Azure's short-audio REST endpoint accepts only
   `audio/wav; codecs=audio/pcm; samplerate=16000` or `audio/ogg; codecs=opus`.
   `RecordMedia` produces `webm` (Chrome/Firefox) or `mp4` (Safari) —
   neither is accepted, on any browser. That meant an ffmpeg transcoding
   step and media infrastructure this stack does not have.
2. **Cost.** At ~$1.00/hr it was the most expensive option measured, 25×
   Groq.

### Why Groq

- Accepts **`webm` and `mp4` directly** — the exact containers
  `MediaRecorder` already produces. The transcoding blocker disappears
  entirely; it's one `multipart/form-data` POST.
- **OpenAI-API-compatible**, so switching later (OpenAI, Deepgram, or a
  self-hosted `faster-whisper` behind a compatible shim) is a base-URL
  change rather than a rewrite.
- $0.04/hr of audio, ~216× realtime. Measured 266ms round trip for a
  short clip.

### Options compared

| Provider | Per hour | 1 school (~4,300 posts/mo) | 10 schools | 100 schools |
|---|---|---|---|---|
| Cloudflare Workers AI | ~$0.027 | ~$1.00 | ~$10 | ~$97 |
| **Groq turbo (chosen)** | **$0.040** | **~$1.40** | **~$14** | **~$142** |
| Groq large-v3 | $0.111 | ~$4 | ~$40 | ~$400 |
| OpenAI | $0.36 | ~$13 | ~$130 | ~$1,300 |
| Azure Speech | ~$1.00 | ~$31 | ~$310 | ~$3,100 |

*(30s average clip)*

**Why not Cloudflare**, despite being cheaper: it requires the audio
base64-encoded inside a JSON body (~33% payload inflation), and its model
docs don't state which containers it accepts. If it needs raw PCM/wav the
ffmpeg blocker returns — the exact thing that killed the previous attempt.
The saving only reaches ~$45/month at 100-school scale.

**Why not self-hosting.** A Hetzner CPX41 (~$16/mo) running
`faster-whisper` on CPU manages roughly **1× realtime** with the base
model. At 10-school scale (~358 hrs audio/month) one box sits at ~50%
utilisation with no spike headroom and costs **more** than Groq's ~$14 for
the same work, plus ops, monitoring and a queue. Self-hosting wins on
privacy and data residency, not cost — revisit only if a partner school
requires that recordings never leave our infrastructure.

### Free tier and when to pay

| Limit | Free tier |
|---|---|
| Requests/minute | 20 |
| Requests/day | 2,000 |
| Audio seconds/hour | 7,200 (2 hrs) |
| Audio seconds/day | 28,800 (8 hrs) |

~960 clips/day at 30s each, ~240 hrs/month — roughly **six schools** before
the daily ceiling binds.

**The 20 RPM limit will bite first.** Usage is bursty: a class with an
assignment due posts together, not spread across the day. Thirty students
finishing a lab at once exceeds 20/min while using a trivial share of the
daily allowance. Mitigated with one retry on 429; `transcript` is nullable
so a throttled clip is recoverable by the backfill rather than lost.

**Upgrade trigger:** sustained 429s on audio-seconds/day, or the second
school onboarding. Watch the logs, not the monthly total.

---

## 3. Language handling — and a reversal worth understanding

### We pass the language hint. We originally didn't.

The first version deliberately **omitted** Whisper's `language` parameter,
to keep its detected language an independent signal for a soft "this
sounded like it might not be in X" advisory.

Real learner speech destroyed that idea. Two genuinely Mandarin videos
from a second-language speaker were **both detected as `"en"`** — the
transcripts came back correctly in Chinese characters; only the language
label was wrong. The advisory fired on 100% of real posts, telling a
learner their correct Mandarin wasn't Mandarin.

**Whisper's language detection is unreliable for accented L2 speech —
exactly the population this product exists to serve.** So:

- The advisory was **removed**, not tuned. A 100% false-positive rate on
  the only real samples is not a threshold problem.
- With no advisory to protect, the hint is now passed, which also improves
  accuracy and cuts latency.
- `transcript_language` stores the code we know from the network, falling
  back to detection only for place-based networks with no language of
  their own.

### Speech is never blocked on language. Text still is.

Text posts in org-gated networks are blocked by `checkLanguagePurity` when
>25% of classified words are off-language. **That does not carry over to
speech**, deliberately:

1. **The errors compound.** Text purity checks exactly what the user
   typed. Audio purity would dictionary-check *Whisper's guess* at what
   someone said. A beginner with a heavy accent produces a transcript
   already full of mangled words; the check then counts the transcriber's
   mistakes against the speaker.
2. **The failure mode is worse.** Typing the wrong language is nearly
   always deliberate. Speaking the target language *badly* is the thing
   being practised. Recording your voice in a language you're bad at is
   vulnerable in a way typing isn't — "this isn't Spanish enough" is how
   you lose exactly the student the product is for.
3. **Lowering the threshold doesn't fix it**, it just trades false
   rejections for false acceptances while keeping a signal never designed
   for this input.

### Scope: language norms are a school thing

Both the text block and (while it existed) the speech advisory are gated
on `organization_languages` membership — a school's language programme —
never the open site. An adult in a public community network may
reasonably post in whatever language they like.

**Transcription itself runs everywhere.** A deaf user's need for a
transcript doesn't depend on whether the poster is enrolled in a course.

---

## 4. Accuracy: what was tried, what worked, what didn't

Tested against a real 34-second Mandarin recording from an L2 speaker.

### Works: a Simplified-Chinese priming prompt

Without it, Whisper mixed Traditional characters into a Simplified-Chinese
network (`這個狗很可愛` where `这个狗很可爱` was meant, `嗎` for `吗`) and
rendered one whole segment as English prose. A short Simplified-Chinese
prompt fixed both.

### The prompt must contain no Latin text — measured

Whisper decodes autoregressively, conditioning on what it has already
emitted *and* on the prompt. English context biases it toward hearing
following Mandarin as English. Same audio, only prior context varied:

| Prior context | Result for 给你介绍 |
|---|---|
| No prompt | "Kennie Jishal, this is my good friend" |
| Current prompt (no Latin) | "Kenny 介绍,这是我的好朋友。" |
| Same prompt **+ "我叫Ken Chester。"** | "Kenny Jishal,这是我的好朋友。" |

The speaker's own English name, spoken immediately before, primed the
error. **Adding example names to the prompt "to help with proper nouns"
makes transcription measurably worse.**

### Doesn't work: a generic priming prompt for homophones

An early test appeared to fix `我找`→`我叫` and `床室`→`创始`, but that
prompt literally contained the right answers. With a *generic* learner
prompt, the errors return. Priming helps script and language selection; it
does not fix tone/homophone confusion.

### Rejected: an LLM correction pass

Asked to repair `床室人` (nonsense; `创始人`, "founder", was meant):

- `qwen/qwen3.8-27b` → `厨师人` ("chef")
- `openai/gpt-oss-20b` → `中国人` ("Chinese person"), or an empty string

It either fails to fix, or invents plausible words the speaker never said.
**Putting words in a language learner's mouth is far worse than leaving an
obvious nonsense term a reader can decode.**

### The pedagogical argument against "fixing" transcripts

`床室人` is arguably *correct output*. The speaker said *chuáng shì*
instead of *chuàng shǐ*; the transcript faithfully recorded that. An
instructor seeing it learns the student's tones slipped. Silently
correcting to `创始人` erases exactly the signal a Mandarin teacher wants.

Product owner's refinement: intent may matter more than fidelity on the
**public** site, where there's no instructor and no pedagogy — while
academic networks want the faithful version. That's the axis to split on
if correction ever becomes reliable. It isn't today.

---

## 5. Captions

One Whisper call with `response_format: "verbose_json"` and
`timestamp_granularities: ["segment"]` yields **both** artifacts: joined
segment text becomes the transcript, the segments become WebVTT.

Captions are generated per request from stored `transcript_segments`
rather than written to storage — the segments are already persisted, a
`.vtt` file would be a second copy to keep in sync, and it would need its
own bucket, RLS policy and cleanup-on-delete path.

**`crossOrigin="anonymous"` is required on the `<video>`** for a
same-origin `<track>` to attach to cross-origin media (signed Supabase
Storage URLs). Verified Supabase returns `access-control-allow-origin: *`;
without that header this attribute would break video playback entirely.

Transcripts are collapsed behind a `<button aria-expanded>` disclosure.
Conformance requires the alternative be *available*, not permanently
visible, and a feed of expanded 60-second transcripts would bury the
posts. Collapsing the transcript never affects captions, which stay
reachable from the player's own CC control.

---

## 6. Sign languages

### Detection is an explicit flag, never inferred

`languages.is_signed`, set by an admin checkbox. Two tempting shortcuts,
both wrong:

- **Name matching `"sign"`** catches all four languages currently in the
  database, but misses **Auslan**, **Libras**, **Lengua de Señas
  Mexicana**, **Deutsche Gebärdensprache** and **日本手話**.
- **`iso_code IS NULL`** is far worse. All four signed languages have a
  null `iso_code` — but so do **89 of 162** languages, including Bengali,
  Cantonese, Hmong, Tagalog, Cherokee and Hawaiian. Using it would have
  silently denied transcription to ~85 spoken languages,
  disproportionately minority and indigenous ones. The opposite of what
  this feature is for.

### Behaviour in a signed-language network

- **Audio tab hidden.** A signed language has no spoken form, so an audio
  post there is a mistake or off-language.
- **No transcription attempted.** Whisper finds no speech in a signed
  video, and sign-language recognition is not a solved problem at any
  price. The call is skipped entirely, so it also costs nothing.
- **Text purity check off**, automatically — it requires an `iso_code`,
  and signed languages have none. Posting English text there is allowed,
  correctly: there is no written form of ASL to enforce.

### The written summary is a translation, not a transcript

A signed language has no written form, so "summarise your video in
writing" really means "translate your video into a different language."
Consequences:

- **`summary_language_id` is required alongside `summary_text`**, enforced
  by a check constraint. The language is needed both so `translateEntry`
  has a source language and so the text can carry `lang=` — a Spanish
  summary in an English UI read with English pronunciation rules is the
  same class of bug fixed for the language switcher.
- **The language picker excludes signed languages** (`excludeSigned` on
  the search route, not in the shared `search_languages` RPC). Picking ASL
  would store a summary tagged with a language that has no `iso_code`,
  breaking Translate and screen-reader tagging — a wrong answer that fails
  silently.
- **Opt-in and never required.** It's real work, and forcing it would put
  friction squarely on the users the feature exists to serve. A coerced
  one-word summary is worse than none.

### Who the summary is for

The copy names **visually impaired users** first, not only people who
don't sign. A screen reader user gets *nothing* from a signed video — not
reduced access, zero. They have the most to gain from a written summary.

This also fixed a live mistranslation: "a signed video" had been read as
signed-with-a-signature, producing Spanish *"vídeo firmado"*, French
*"vidéo signée"*, Chinese *签名视频* and Arabic *"الفيديو الموقع"* — all
meaning a legally signed document. Leading with "Sign languages" instead
translates correctly.

---

## 7. Two bugs worth remembering

### Azure translate silently no-ops on mixed-script text

`translateEntry` originally passed no source language, so Azure
auto-detected. A transcript containing one English fragment (Whisper
occasionally renders a segment as English) reads as English overall —
Azure then translated `en`→`en` and returned the input **byte-identical**,
surfacing as "the Translate button does nothing." Confirmed directly:
detected `"en"`, output unchanged. The source language is now always
passed when known.

### Re-transcribing left stale translations

`post_translations` is read *before* Azure is ever called. Rewriting a
transcript (a backfill, or a retry after a 429) left the cached
translation of the *previous* transcript winning forever. Both the live
path and the backfill now evict `field='transcript'` rows for any row they
rewrite.

**Related trap:** `service_role` lacked `SELECT` on `post_translations`,
and the Supabase client surfaces a permission denial as an *empty result*
unless `error` is checked explicitly. The cache appeared empty while
holding the stale row that made the first bug look unfixed. Always check
`error` in diagnostic scripts.

---

## 8. Known gaps

- **Sign-language recognition** is not attempted and has no vendor
  solution. The optional written summary is the only answer.
- **Homophone/tone errors** in L2 speech are not correctable by any method
  tested. This is a deliberate accepted limitation, and part of why
  blocking is off.
- **Multi-cue captions** are verified working (5 cues, correct sequential
  timings on a 34s clip), but long-clip timing drift has not been tested.
- **Retention.** Transcripts and media accumulate indefinitely; no
  lifecycle policy exists for either.
- **Speaker diarization** and **live captions** (WCAG 1.2.4, AA, applies
  to live media) are out of scope — the product has no live media.
