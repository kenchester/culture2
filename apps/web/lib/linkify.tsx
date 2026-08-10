const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

// Renders plain text with any bare URLs turned into clickable links, so
// posts don't need a separate "video link" field for people to paste a
// YouTube/Vimeo/etc URL into.
export function Linkify({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_PATTERN).map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}
