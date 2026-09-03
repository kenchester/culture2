"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The keyboard/focus half of the WAI-ARIA menu button pattern, shared by
// the nav's two dropdowns (app/language-switcher.tsx and the user menu in
// app/nav.tsx) so they can't drift apart in behavior. Both previously
// closed only on outside mousedown - unreachable and inescapable by
// keyboard, and invisible to a screen reader since nothing announced that
// a menu had opened at all.
//
// Deliberately additive: none of this changes what a mouse user sees or
// does. Clicking the trigger still toggles, clicking outside still
// closes; this adds the keyboard and assistive-tech half that was missing.
//
// Roving focus (moving real DOM focus between items) rather than
// aria-activedescendant - the items here are genuine <button>/<a>
// elements that are already individually focusable, so moving focus to
// them keeps the DOM and the accessibility tree in agreement with no
// extra bookkeeping.
export function useMenu(itemCount: number) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  // Set when the menu is opened by keyboard, so the effect below knows to
  // move focus into the menu; left null for pointer opens, where stealing
  // focus would be unhelpful and unexpected.
  const pendingFocusRef = useRef<number | null>(null);

  const setItemRef = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      itemRefs.current[index] = el;
    },
    [],
  );

  const focusItem = useCallback(
    (index: number) => {
      if (itemCount === 0) return;
      const wrapped = (index + itemCount) % itemCount;
      itemRefs.current[wrapped]?.focus();
    },
    [itemCount],
  );

  // Returning focus to the trigger on close is what makes the menu
  // escapable: without it, closing with Escape drops focus to <body> and
  // a keyboard user has to Tab from the top of the page again.
  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    pendingFocusRef.current = null;
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const pending = pendingFocusRef.current;
    if (pending !== null) {
      pendingFocusRef.current = null;
      focusItem(pending);
    }
  }, [open, focusItem]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // No focus return here - the user is already interacting
        // somewhere else on the page, so yanking focus back to the
        // trigger would fight them.
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  // ArrowDown/ArrowUp open the menu and land on the first/last item, per
  // the APG menu button pattern; Enter and Space fall through to the
  // button's own click handling.
  function onTriggerKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      pendingFocusRef.current = event.key === "ArrowDown" ? 0 : itemCount - 1;
      setOpen(true);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      close();
    }
  }

  function onMenuKeyDown(event: React.KeyboardEvent) {
    const currentIndex = itemRefs.current.findIndex((el) => el === document.activeElement);
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "ArrowDown":
        event.preventDefault();
        focusItem(currentIndex + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusItem(currentIndex - 1);
        break;
      case "Home":
        event.preventDefault();
        focusItem(0);
        break;
      case "End":
        event.preventDefault();
        focusItem(itemCount - 1);
        break;
      case "Tab":
        // Tabbing out of a menu closes it, but the Tab itself must still
        // move focus onward normally - so no preventDefault, and no
        // focus return to the trigger.
        close(false);
        break;
    }
  }

  return {
    open,
    setOpen,
    close,
    containerRef,
    triggerRef,
    setItemRef,
    onTriggerKeyDown,
    onMenuKeyDown,
  };
}
