/**
 * `CommandPalette` — ⌘K navigation.
 *
 * ┌─ THIS NAVIGATES. IT DOES NOT SEARCH. ───────────────────────────────────────────────────────┐
 * │ It filters a list the caller supplies — the route table — and nothing else. Searching gyms,   │
 * │ accounts and orders needs the `§B3.2` matrix to decide which results an operator may even see, │
 * │ and a palette that quietly returned rows from every tenant would be the authorisation gap the │
 * │ matrix exists to close. That arrives with `M-023`.                                             │
 * │                                                                                              │
 * │ So the placeholder says "Jump to…", not "Search". Naming it search and having it only find    │
 * │ pages is the kind of small lie that costs a demo its credibility on the first try.             │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ KEYBOARD IS THE POINT, NOT A FEATURE ──────────────────────────────────────────────────────┐
 * │ `AX2` makes the console keyboard-first, and an operator clearing thirty approvals reaches for │
 * │ ⌘K rather than the mouse. Arrows move, Enter opens, Escape closes, and focus RETURNS to what  │
 * │ opened it — a dialog that drops focus on close leaves a keyboard user at the top of the       │
 * │ document with no idea where they are.                                                         │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Rendered inline rather than in a portal: the overlay is `fixed`, so it escapes its container
 * without one, and a portal would add a mount point every consuming app has to provide.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

export interface CommandItem {
  readonly id: string;
  readonly label: string;
  /** The group heading this sits under. Groups render in first-seen order. */
  readonly group: string;
  /** Shown after the label in muted ink — a path, or a hint like "in development". */
  readonly hint?: string;
  readonly disabled?: boolean;
  readonly onSelect: () => void;
}

export function CommandPalette({
  open,
  onClose,
  items,
  labels,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly items: readonly CommandItem[];
  readonly labels: {
    readonly placeholder: string;
    readonly empty: string;
    readonly dialogLabel: string;
    readonly hintKeys: string;
  };
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  /** What had focus when the palette opened, so it can be given back. */
  const restoreTo = useRef<HTMLElement | null>(null);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    const enabled = items.filter((item) => item.disabled !== true);
    if (term === '') return enabled;
    // Every word must appear, so "gym reg" finds "All gyms" but "gym" alone does not surface
    // everything with the word in it and bury the one match.
    const words = term.split(/\s+/).filter((word) => word !== '');
    return enabled.filter((item) => {
      const haystack = `${item.label} ${item.group} ${item.hint ?? ''}`.toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    setQuery('');
    setActive(0);
    inputRef.current?.focus();

    return () => {
      // Focus goes back to the trigger. Without this a keyboard user lands at the top of the
      // document after closing and has to tab through the whole shell to find their place.
      restoreTo.current?.focus();
    };
  }, [open]);

  // Clamped, not reset. A narrowing query should keep the selection near where it was rather than
  // jumping to the first row on every keystroke.
  useEffect(() => {
    setActive((current) => Math.min(current, Math.max(0, matches.length - 1)));
  }, [matches.length]);

  if (!open) return null;

  const choose = (item: CommandItem | undefined) => {
    if (item === undefined) return;
    item.onSelect();
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => (current + 1) % Math.max(1, matches.length));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => (current - 1 + matches.length) % Math.max(1, matches.length));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      choose(matches[active]);
    }
  };

  const groups = matches.reduce<Map<string, CommandItem[]>>((acc, item) => {
    const bucket = acc.get(item.group) ?? [];
    bucket.push(item);
    acc.set(item.group, bucket);
    return acc;
  }, new Map());

  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-scrim flex items-start justify-center px-inset-md pt-region-sm">
      {/* The scrim closes on click, and is `aria-hidden` — the dialog below is the accessible
          surface, and announcing a backdrop adds nothing a screen-reader user can act on. */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-surface-scrim"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={labels.dialogLabel}
        onKeyDown={onKeyDown}
        className="relative w-full max-w-ui overflow-hidden rounded-card border border-subtle bg-surface shadow-lg"
      >
        <div className="border-b border-subtle px-inset-md py-inset-sm">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder={labels.placeholder}
            aria-label={labels.placeholder}
            className="w-full bg-transparent text-base text-content outline-none placeholder:text-content-muted"
          />
        </div>

        <div className="max-h-[24rem] overflow-y-auto p-inset-2xs">
          {matches.length === 0 && (
            <p className="px-inset-sm py-inset-md text-sm text-content-muted">{labels.empty}</p>
          )}

          {[...groups.entries()].map(([group, entries]) => (
            <div key={group} className="mb-stack-2xs">
              <p className="px-inset-sm pb-inset-2xs pt-inset-xs text-xs font-semibold uppercase tracking-wide text-content-muted">
                {group}
              </p>
              <ul>
                {entries.map((item) => {
                  flatIndex += 1;
                  const selected = flatIndex === active;
                  const index = flatIndex;

                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          choose(item);
                        }}
                        // Hover moves the selection, so the mouse and the keyboard share one
                        // notion of "current" instead of showing two highlights at once.
                        onMouseEnter={() => {
                          setActive(index);
                        }}
                        aria-current={selected}
                        className={`gm-hit-target flex w-full items-center justify-between gap-inline-sm rounded-control px-inset-sm py-inset-2xs text-left text-sm ${
                          selected
                            ? 'bg-surface-brand-subtle font-medium text-content-brand'
                            : 'text-content-secondary'
                        }`}
                      >
                        <span className="truncate">{item.label}</span>
                        {item.hint !== undefined && (
                          <span className="shrink-0 text-xs text-content-muted">{item.hint}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <p className="border-t border-subtle px-inset-md py-inset-2xs text-xs text-content-muted">
          {labels.hintKeys}
        </p>
      </div>
    </div>
  );
}

/** Binds ⌘K / Ctrl-K. Returns nothing; the caller owns the open state. */
export function useCommandKey(onOpen: () => void): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k') return;
      if (!event.metaKey && !event.ctrlKey) return;
      // `preventDefault` because Ctrl-K is "focus the search bar" in some browsers and the
      // palette is the better answer to the same intent.
      event.preventDefault();
      onOpen();
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [onOpen]);
}
