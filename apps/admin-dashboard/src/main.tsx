/**
 * The admin SPA entry — React 18 + Vite. `FolderStructure.md` §6.
 *
 * TanStack Query is the server-state layer (A-08, ADR-0021) — not Redux, Zustand or MobX, which
 * `STACK_ADDITIONS.md` rejects explicitly for this role.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AdminRouter } from './routes/router.tsx';
import { SessionProvider } from './shared/auth/session.tsx';
import './styles/globals.css';

/**
 * ┌─ THE DEFAULTS ARE NOT TASTE ────────────────────────────────────────────────────────────────┐
 * │ `retry: 1` and not 3. This console performs administrative writes, and a mutation retried    │
 * │ automatically is a duplicate approval, a duplicate refund or a duplicate suspension. Reads   │
 * │ get one retry for a transient network blip; writes get NONE, and idempotency keys (M-017)    │
 * │ are what make a deliberate retry safe.                                                        │
 * │                                                                                              │
 * │ `refetchOnWindowFocus: false`. An admin reads a settlement figure, switches to a spreadsheet │
 * │ to check it, and comes back — a silent refetch changes the number under them mid-comparison. │
 * │ `A-08`'s "a stale figure presented as live is a defect" is answered by the mandatory         │
 * │ LastUpdatedIndicator and an explicit refresh, not by refetching behind the operator's back.  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // 30s: long enough that navigating between screens does not re-fetch, short enough that a
      // returning operator is not reading minutes-old data without the indicator saying so.
      staleTime: 30_000,
    },
    mutations: { retry: 0 },
  },
});

const container = document.getElementById('root');
if (!container) {
  // Loud rather than a silent blank page. A missing #root means index.html and this file
  // disagree, and a white screen sends whoever hits it looking at the network tab first.
  throw new Error('#root is missing from index.html — the admin shell cannot mount.');
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <AdminRouter />
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
);
