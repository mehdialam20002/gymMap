/**
 * `@gymmap/ui` — the public surface. `FolderStructure.md` §10, constitution §7.1.1 **R3**.
 *
 * ┌─ WHAT MAY NOT BE ADDED HERE ────────────────────────────────────────────────────────────────┐
 * │ no API call, no TanStack Query hook   a component that fetches cannot be reused across three │
 * │                                       surfaces with different auth models                    │
 * │ no domain component                   <MembershipCard/>, <SettlementStatement/> and          │
 * │                                       <CheckInDeskScanner/> live in the consuming app's      │
 * │                                       feature folder (constitution §3.5.2)                   │
 * │ no formatting logic                   MoneyDisplay RECEIVES "₹2,50,000". The Indian grouping │
 * │                                       is computed by @gymmap/utils. A second implementation  │
 * │                                       here would diverge from the PDF renderer, which is not │
 * │                                       React — and LAUNCH_MARKET_INDIA §2 names divergent     │
 * │                                       grouping as a trust defect                             │
 * │ no import of @gymmap/utils            R3, enforced by `no-ui-to-utils` in dependency-cruiser │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Consumed as SOURCE, not as build output — Next.js `transpilePackages` and Vite both compile
 * workspace TypeScript directly, so a `dist/` step here would add a build edge to every front-end
 * change for no benefit. That is why imports below carry `.ts` extensions.
 */

export * from './tokens/index.ts';

/**
 * §3's four-state contract, and the composed patterns of §2.
 *
 * `StateBoundary` is exported before the patterns on purpose: it is the piece a screen reaches
 * for first, and the one whose absence produced five hand-rolled loading states in `admin/`
 * before it existed.
 */
export { StateBoundary, EmptyState, type StateBoundaryProps } from './state/state-boundary.tsx';
export {
  toSurfaceState,
  type SurfaceState,
  type EmptyReason,
  type EmptyStateProps,
  type ApiProblem,
} from './state/surface-state.ts';

export {
  Panel,
  Badge,
  Button,
  FilterTabs,
  DataTable,
  Pagination,
  TableSkeleton,
  type Tone,
  type FilterTab,
  type Column,
} from './patterns/index.tsx';
