/**
 * Writes text to the clipboard, or reports that it couldn't.
 *
 * Extracted from components/copy-link-button.tsx so the share control can
 * use the same fallback path rather than carrying a second copy of it.
 * navigator.clipboard is undefined outside a secure context and is still
 * refused by some mobile browsers inside one, so the deprecated
 * textarea/execCommand route remains necessary. iOS additionally needs the
 * explicit selection range - select() alone does nothing there.
 *
 * Returns false rather than throwing, because the caller's next move is to
 * suppress a "copied" confirmation that would otherwise be a lie.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const scratch = document.createElement("textarea");
    scratch.value = text;
    scratch.setAttribute("readonly", "");
    scratch.style.position = "fixed";
    scratch.style.top = "0";
    scratch.style.opacity = "0";
    document.body.appendChild(scratch);
    scratch.select();
    scratch.setSelectionRange(0, text.length);
    try {
      document.execCommand("copy");
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(scratch);
    }
  }
}
