/**
 * The overlay family — `Modal`, `Drawer`, `ConfirmDialog`, `Tooltip`, `Dropdown`, `Toast`.
 *
 * ┌─ ONE FOCUS TRAP, WRITTEN ONCE ──────────────────────────────────────────────────────────────┐
 * │ Every one of these puts something on top of the page, and every one of them has the same     │
 * │ four obligations: trap Tab inside itself, close on Escape, return focus to whatever opened   │
 * │ it, and be announced. Six components each implementing that is six chances to forget the     │
 * │ fourth one — and the one that gets forgotten is always focus return, because nothing looks   │
 * │ wrong when it is missing. A keyboard user simply finds themselves at the top of the          │
 * │ document with no idea where they were.                                                       │
 * │                                                                                              │
 * │ So `useOverlay` owns all four and the components own their shape.                             │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ NO PORTAL, AND THAT IS A DELIBERATE LIMIT ─────────────────────────────────────────────────┐
 * │ These render inline. `position: fixed` escapes any container that is not itself transformed  │
 * │ or filtered, which no surface in this design system is, so a portal would buy nothing and    │
 * │ cost every consuming app a mount point it has to remember to provide.                        │
 * │                                                                                              │
 * │ The limit is real and worth stating: put a `Modal` inside an element with `transform`,        │
 * │ `filter` or `will-change` and it will be clipped to that element. Nothing here does.          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ `aria-hidden` ON THE SCRIM, NEVER ON THE APP ──────────────────────────────────────────────┐
 * │ The usual advice is to `aria-hidden` the rest of the page while a dialog is open. That needs │
 * │ a reference to the app root, which a component library does not have, and getting it wrong   │
 * │ hides the dialog itself. `aria-modal="true"` plus a real focus trap is what modern screen     │
 * │ readers act on, and it cannot be got wrong from in here.                                      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { Button } from './index.tsx';

/** Everything focusable, in document order. `[tabindex="-1"]` is excluded — it is not tab-reachable. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The four obligations, in one hook.
 *
 * Returns the ref to put on the overlay's own container. It focuses the first focusable child on
 * open, cycles Tab inside, calls `onClose` on Escape, and restores focus on unmount.
 */
export function useOverlay(open: boolean, onClose: () => void) {
  const container = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;

    // The first focusable child, or the container itself. Focusing the container is the fallback
    // for a dialog whose only content is text: Escape must still reach the key handler, and a
    // handler on an unfocused subtree never fires.
    const first = container.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? container.current)?.focus();

    return () => {
      restoreTo.current?.focus();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = [...(container.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
      if (focusable.length === 0) return;

      const firstItem = focusable[0];
      const lastItem = focusable[focusable.length - 1];
      if (firstItem === undefined || lastItem === undefined) return;

      // Wrap at both ends. Without the shift-Tab branch, focus leaves backwards out of the dialog
      // and the trap is only half a trap — which is worse than none, because it passes a casual test.
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    },
    [onClose],
  );

  return { container, onKeyDown };
}

/** The dimming layer. A button so a click closes; `aria-hidden` because the dialog is the surface. */
function Scrim({ onClose }: { readonly onClose: () => void }) {
  return (
    <button
      type="button"
      aria-hidden="true"
      tabIndex={-1}
      onClick={onClose}
      className="absolute inset-0 cursor-default bg-surface-scrim"
    />
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

/**
 * A centred dialog.
 *
 * `title` is required and is the accessible name — a dialog without one announces as "dialog" and
 * tells a screen-reader user nothing about what just took over their screen.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeLabel,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: string;
  readonly children?: ReactNode;
  readonly footer?: ReactNode;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly closeLabel: string;
}) {
  const { container, onKeyDown } = useOverlay(open, onClose);
  if (!open) return null;

  const WIDTH = { sm: 'max-w-form', md: 'max-w-ui', lg: 'max-w-prose' } as const;

  return (
    <div className="fixed inset-0 z-scrim flex items-center justify-center p-inset-md">
      <Scrim onClose={onClose} />
      <div
        ref={container}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        {...(description === undefined ? {} : { 'aria-describedby': 'gm-modal-desc' })}
        onKeyDown={onKeyDown}
        tabIndex={-1}
        className={`relative flex w-full flex-col overflow-hidden rounded-card border border-subtle bg-surface shadow-lg ${WIDTH[size]}`}
      >
        <div className="flex items-start justify-between gap-inline-sm border-b border-subtle px-inset-md py-inset-sm">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-content">{title}</h2>
            {description !== undefined && (
              <p id="gm-modal-desc" className="mt-stack-2xs text-sm text-content-secondary">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="gm-hit-target shrink-0 rounded-control px-inset-2xs text-content-muted transition-colors duration-fast ease-standard hover:text-content"
          >
            {/* A multiplication sign, not the letter x. `aria-label` carries the meaning. */}
            <span aria-hidden="true">&#215;</span>
          </button>
        </div>

        {children !== undefined && (
          <div className="max-h-[60vh] overflow-y-auto px-inset-md py-inset-sm">{children}</div>
        )}

        {footer !== undefined && (
          <div className="flex flex-wrap items-center justify-end gap-inline-2xs border-t border-subtle px-inset-md py-inset-sm">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConfirmDialog
// ---------------------------------------------------------------------------

/**
 * The confirmation an irreversible action must pass through.
 *
 * ┌─ THE REASON FIELD IS PART OF THE CONFIRMATION, NOT A SEPARATE STEP ────────────────────────┐
 * │ Every audited admin mutation in this system carries a reason with a minimum length, and the │
 * │ minimum is deliberately annoying: the alternative is an audit log in which every row says   │
 * │ "admin". Asking for it in the same dialog as the confirmation is what makes it feel like    │
 * │ part of the decision rather than a form to get past.                                        │
 * │                                                                                            │
 * │ `confirm` stays DISABLED until the reason clears the floor, and the counter says how far    │
 * │ there is to go. A submit that fails validation after the click teaches nothing.             │
 * └────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE DESTRUCTIVE BUTTON IS NOT THE DEFAULT FOCUS ──────────────────────────────────────────┐
 * │ `useOverlay` focuses the first focusable child, and the header's close button comes first in │
 * │ document order — so Enter on an unread dialog closes it rather than confirming. That is the │
 * │ correct accident to have.                                                                   │
 * └────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  reversibility,
  tone = 'danger',
  reason,
  typeToConfirm,
  labels,
  busy = false,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Receives the reason when one was asked for, otherwise the empty string. */
  readonly onConfirm: (reason: string) => void;
  readonly title: string;
  /**
   * `DC2` — what will happen TO WHOM, not what the operator is doing.
   *
   * *"This will suspend a tenant with 214 active members"*, never *"Are you sure?"*. `DC1` also
   * requires the figures in it to be SERVER-computed and fetched before the dialog opens, never
   * counted in the client - which is why this is a string the caller assembles rather than
   * something derived here.
   */
  readonly description: string;
  /**
   * `DC5` and `DC6` - REQUIRED, and required for a reason.
   *
   * +- THE SPEC SAYS "IN THE SAME POSITION, EVERY TIME" -----------------------------------------+
   * | `DC5`: where the action is reversible, the dialog says so and NAMES the reverse -           |
   * | *"Reinstate restores the listing and resumes payouts"*. `DC6`: where it is not, the dialog  |
   * | says that too, *"in the same position, every time"*.                                       |
   * |                                                                                          |
   * | An optional prop would be omitted on the one dialog where it mattered, and the omission     |
   * | reads as "reversible" because nothing says otherwise. So the type makes it unrepresentable: |
   * | every caller states the direction and supplies the sentence.                                |
   * +-------------------------------------------------------------------------------------------+
   */
  readonly reversibility:
    | { readonly kind: 'REVERSIBLE'; readonly text: string }
    | { readonly kind: 'PERMANENT'; readonly text: string };
  readonly tone?: 'danger' | 'primary';
  /** Omit to confirm without a reason. Present means the reason is MANDATORY. */
  readonly reason?: { readonly label: string; readonly hint: string; readonly minLength: number };
  /**
   * `DC3` - the blast-radius guard. Omit for everything below the line.
   *
   * +- TYPING THE NAME IS NOT CEREMONY. IT IS THE ONE CONTROL A HABIT CANNOT DEFEAT ------------+
   * | `AdminDashboard.md` DC3 names five actions that require it: tenant suspension, tenant      |
   * | closure, commission-configuration replacement, a feature flag at 100% rollout, and review   |
   * | removal. What they share is that a mis-click is not recoverable by clicking again.          |
   * |                                                                                          |
   * | An operator who suspends thirty gyms a month stops reading confirmation dialogs - that is   |
   * | not carelessness, it is what repetition does. Typing "Iron Temple Fitness LLP" cannot be    |
   * | done by muscle memory on the wrong row, because the wrong row has a different name.         |
   * |                                                                                          |
   * | Matched EXACTLY after trimming, and case-sensitively. A case-insensitive match would        |
   * | accept "iron temple fitness llp", which is a different string from the one on the screen    |
   * | and therefore evidence of nothing.                                                        |
   * +-------------------------------------------------------------------------------------------+
   */
  readonly typeToConfirm?: { readonly expected: string; readonly label: string };
  readonly labels: {
    readonly confirm: string;
    readonly cancel: string;
    readonly close: string;
    /** `{n}` is replaced with how many characters are still needed. */
    readonly charactersShort: string;
  };
  readonly busy?: boolean;
}) {
  const [text, setText] = useState('');
  const [typed, setTyped] = useState('');

  // Cleared on open rather than on close, so a reason typed for one gym cannot be submitted
  // against the next one after a mis-click. The same applies to the typed name, and more sharply:
  // a name left in the box from the previous dialog would defeat the guard entirely.
  useEffect(() => {
    if (open) {
      setText('');
      setTyped('');
    }
  }, [open]);

  const short = reason === undefined ? 0 : Math.max(0, reason.minLength - text.trim().length);
  // Exact after trimming, case-sensitive. See the note on `typeToConfirm`.
  const nameMatches = typeToConfirm === undefined || typed.trim() === typeToConfirm.expected;
  const ready = short === 0 && nameMatches && !busy;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      closeLabel={labels.close}
      footer={
        <>
          <Button onClick={onClose} variant="ghost">
            {labels.cancel}
          </Button>
          <Button
            onClick={() => {
              onConfirm(text.trim());
            }}
            variant={tone}
            disabled={!ready}
          >
            {labels.confirm}
          </Button>
        </>
      }
    >
      {/* The fixed position `DC5`/`DC6` demand. Above the reason box, because it is the fact that
          should change what the operator writes in it - and below `description`, because the
          consequence comes before its reversibility. */}
      <p
        className={`flex items-start gap-inline-2xs rounded-control px-inset-sm py-inset-xs text-sm ${
          reversibility.kind === 'PERMANENT'
            ? 'bg-surface-danger-subtle text-content-danger'
            : 'bg-surface-sunken text-content-secondary'
        }`}
      >
        {/* A glyph AND the tint AND the wording. `AX8`: never colour alone, and "permanent" is the
            single most consequential word in this dialog. */}
        <span aria-hidden="true">{reversibility.kind === 'PERMANENT' ? '\u26A0' : '\u21BA'}</span>
        <span>{reversibility.text}</span>
      </p>

      {reason !== undefined && (
        <label className="mt-stack-sm flex flex-col gap-stack-2xs">
          <span className="text-sm font-medium text-content">{reason.label}</span>
          <textarea
            value={text}
            onChange={(event) => {
              setText(event.target.value);
            }}
            rows={4}
            className="w-full resize-y rounded-control border border-subtle bg-surface-sunken px-inset-sm py-inset-xs text-sm text-content"
          />
          <span className="text-xs text-content-muted">
            {short > 0 ? labels.charactersShort.replace('{n}', String(short)) : reason.hint}
          </span>
        </label>
      )}

      {typeToConfirm !== undefined && (
        <label className="mt-stack-sm flex flex-col gap-stack-2xs">
          <span className="text-sm font-medium text-content">{typeToConfirm.label}</span>
          {/* The expected string is SHOWN, in the same monospace it must be typed in. Hiding it
              would make this a memory test rather than a deliberateness test, and an operator who
              cannot find the name will paste something close enough from elsewhere. */}
          <code className="select-all rounded-control bg-surface-sunken px-inset-sm py-inset-2xs font-mono text-xs text-content-secondary">
            {typeToConfirm.expected}
          </code>
          <input
            type="text"
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
            }}
            autoComplete="off"
            // No `autoCapitalize`/`autoCorrect` help either: a phone that capitalises the first
            // letter would make an exact match impossible to type.
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={typed !== '' && !nameMatches}
            className={`w-full rounded-control border bg-surface-sunken px-inset-sm py-inset-xs font-mono text-sm text-content ${
              typed !== '' && !nameMatches ? 'border-danger' : 'border-subtle'
            }`}
          />
        </label>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Drawer
// ---------------------------------------------------------------------------

/**
 * A panel that slides in from the right.
 *
 * For a dossier beside a list — a drawer keeps the list on screen, which a full-page navigation
 * does not, and an operator clearing thirty applications needs to see what is left.
 *
 * The transition is on `transform` alone. `RM1` reduces every duration to 1ms under
 * `prefers-reduced-motion`, so this needs no branch of its own.
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  closeLabel,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly closeLabel: string;
}) {
  const { container, onKeyDown } = useOverlay(open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-scrim flex justify-end">
      <Scrim onClose={onClose} />
      <div
        ref={container}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={onKeyDown}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-ui flex-col border-l border-subtle bg-surface shadow-lg"
      >
        <div className="flex items-center justify-between gap-inline-sm border-b border-subtle px-inset-md py-inset-sm">
          <h2 className="min-w-0 truncate text-base font-semibold text-content">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="gm-hit-target shrink-0 rounded-control px-inset-2xs text-content-muted transition-colors duration-fast ease-standard hover:text-content"
          >
            <span aria-hidden="true">&#215;</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-inset-md py-inset-sm">{children}</div>

        {footer !== undefined && (
          <div className="border-t border-subtle px-inset-md py-inset-sm">{footer}</div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dropdown
// ---------------------------------------------------------------------------

export interface MenuItem {
  readonly id: string;
  readonly label: string;
  readonly onSelect: () => void;
  readonly disabled?: boolean;
  /** Renders in danger ink and sits below a divider. */
  readonly destructive?: boolean;
  /** Shown in muted ink after the label — a milestone, a shortcut, a reason it is disabled. */
  readonly hint?: string;
}

/**
 * The row overflow menu.
 *
 * ┌─ A DISABLED ITEM STAYS IN THE MENU AND SAYS WHY ───────────────────────────────────────────┐
 * │ Hiding an action an operator cannot take yet makes the menu look complete when it is not,   │
 * │ and the operator concludes the feature does not exist. Showing it disabled with the reason  │
 * │ in `hint` answers the question in place.                                                    │
 * └────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Closes on outside click via a full-viewport invisible layer rather than a document listener: a
 * `mousedown` listener on `document` also fires for the click that OPENED the menu unless the
 * handler checks the event target against the trigger, which is the bug every hand-rolled dropdown
 * ships with once.
 */
export function Dropdown({
  label,
  items,
  align = 'right',
}: {
  readonly label: string;
  readonly items: readonly MenuItem[];
  readonly align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const { container, onKeyDown } = useOverlay(open, () => {
    setOpen(false);
  });

  const enabled = items.filter((item) => item.disabled !== true);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className="gm-hit-target rounded-control px-inset-xs text-sm text-content-muted transition-colors duration-fast ease-standard hover:text-content"
      >
        {/* A midline horizontal ellipsis. */}
        <span aria-hidden="true">&#8943;</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => {
              setOpen(false);
            }}
            className="fixed inset-0 z-sticky-section cursor-default"
          />
          <div
            ref={container}
            role="menu"
            aria-label={label}
            onKeyDown={onKeyDown}
            tabIndex={-1}
            className={`absolute top-full z-scrim mt-stack-2xs min-w-[12rem] overflow-hidden rounded-control border border-subtle bg-surface py-inset-2xs shadow-lg ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            {items.map((item, index) => (
              <div key={item.id}>
                {/* The divider sits above the FIRST destructive item only, so a menu with two
                    destructive actions does not read as two separate groups. */}
                {item.destructive === true &&
                  items[index - 1] !== undefined &&
                  items[index - 1]?.destructive !== true && (
                    <div className="my-inset-2xs border-t border-subtle" />
                  )}
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled === true}
                  title={item.hint}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={`flex w-full items-center justify-between gap-inline-sm px-inset-sm py-inset-2xs text-left text-sm transition-colors duration-fast ease-standard ${
                    item.disabled === true
                      ? 'cursor-not-allowed text-content-disabled'
                      : item.destructive === true
                        ? 'text-content-danger hover:bg-surface-danger-subtle'
                        : 'text-content-secondary hover:bg-surface-sunken hover:text-content'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {item.hint !== undefined && (
                    <span className="shrink-0 text-xs text-content-muted">{item.hint}</span>
                  )}
                </button>
              </div>
            ))}

            {enabled.length === 0 &&
              // Not an empty box. A menu whose every item is disabled has already said so per item;
              // this is the case where there are no items at all.
              items.length === 0 && (
                <p className="px-inset-sm py-inset-2xs text-xs text-content-muted">{label}</p>
              )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

/**
 * A hover/focus hint.
 *
 * ┌─ IT IS NOT A REPLACEMENT FOR `title`, AND IT NEVER CARRIES THE ONLY COPY OF ANYTHING ──────┐
 * │ A tooltip is unreachable on a touch screen and invisible to anyone who navigates by reading │
 * │ the accessible tree without hovering. So `text` is ALSO exposed via `aria-describedby`, and │
 * │ nothing load-bearing may live here alone — a milestone, a formatted figure, a keyboard       │
 * │ shortcut are fine; the reason an action is disabled is not.                                  │
 * └────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Opens on focus as well as hover, because `AX2` makes this console keyboard-first and a hint only
 * a mouse can reach is a hint half the operators never see.
 */
export function Tooltip({
  text,
  children,
  id,
}: {
  readonly text: string;
  readonly children: ReactNode;
  /** Must be unique on the page — it wires `aria-describedby`. */
  readonly id: string;
}) {
  const [shown, setShown] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => {
        setShown(true);
      }}
      onMouseLeave={() => {
        setShown(false);
      }}
      onFocus={() => {
        setShown(true);
      }}
      onBlur={() => {
        setShown(false);
      }}
    >
      <span aria-describedby={id}>{children}</span>
      <span
        id={id}
        role="tooltip"
        // Always in the tree, only visually hidden — so a screen reader reads it without a hover
        // event it can never produce.
        className={
          shown
            ? 'absolute bottom-full left-1/2 z-scrim mb-stack-2xs -translate-x-1/2 whitespace-nowrap rounded-control border border-subtle bg-surface-raised px-inset-xs py-inset-2xs text-xs text-content shadow-lg'
            : 'gm-visually-hidden'
        }
      >
        {text}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

export interface ToastMessage {
  readonly id: string;
  readonly tone: 'success' | 'danger' | 'info';
  readonly text: string;
}

/**
 * Transient confirmations, bottom-right.
 *
 * ┌─ A FAILURE TOAST DOES NOT EXPIRE ──────────────────────────────────────────────────────────┐
 * │ A success message that vanishes after four seconds is fine: the thing happened, and the      │
 * │ screen behind it already shows the new state. A FAILURE that vanishes is a bug report the    │
 * │ operator cannot read twice — they looked away, the gym was not suspended, and nothing on     │
 * │ screen says so. `danger` therefore has no timer and must be dismissed.                       │
 * └────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * `role="status"` with `aria-live="polite"`, not `alert`: an assertive region interrupts whatever
 * a screen reader is mid-sentence on, which for a "saved" confirmation is rude and for a queue of
 * three toasts is unusable.
 */
export function ToastStack({
  messages,
  onDismiss,
  dismissLabel,
}: {
  readonly messages: readonly ToastMessage[];
  readonly onDismiss: (id: string) => void;
  readonly dismissLabel: string;
}) {
  const TONE = {
    success: 'border-success bg-surface-success-subtle text-content-success',
    danger: 'border-danger bg-surface-danger-subtle text-content-danger',
    info: 'border-info bg-surface-info-subtle text-content-info',
  } as const;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-inset-lg right-inset-lg z-scrim flex w-full max-w-form flex-col gap-stack-2xs"
    >
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex items-start justify-between gap-inline-sm rounded-control border px-inset-sm py-inset-xs text-sm shadow-lg ${TONE[message.tone]}`}
        >
          <span className="min-w-0">{message.text}</span>
          <button
            type="button"
            onClick={() => {
              onDismiss(message.id);
            }}
            aria-label={dismissLabel}
            className="gm-hit-target shrink-0 rounded-control px-inset-2xs"
          >
            <span aria-hidden="true">&#215;</span>
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Toast state, with the expiry rule applied in one place.
 *
 * `push` returns nothing: a caller that wanted the id would be about to dismiss its own toast
 * programmatically, which is what the timer is for.
 */
export function useToasts(successMs = 4000) {
  const [messages, setMessages] = useState<readonly ToastMessage[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: string) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastMessage['tone'], text: string) => {
      nextId.current += 1;
      const id = `toast-${String(nextId.current)}`;
      setMessages((current) => [...current, { id, tone, text }]);

      // Only the non-failures expire. See the note on the component.
      if (tone !== 'danger') {
        setTimeout(() => {
          dismiss(id);
        }, successMs);
      }
    },
    [dismiss, successMs],
  );

  return { messages, push, dismiss };
}
