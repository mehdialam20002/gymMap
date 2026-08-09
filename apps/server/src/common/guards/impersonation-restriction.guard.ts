/**
 * `M-025` · No money moves under a borrowed identity — `BR-DAT-02`, `E1.8`, acceptance criterion 4.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * A DENYLIST OF ROUTES WOULD BE THE WRONG SHAPE, AND THIS IS WHY
 *
 * `AC-4`: *"No financial mutation is executable under the token: refunds, payouts, price changes,
 * credit notes and manual ledger adjustments all refuse with a registry code."*
 *
 * The obvious implementation is a list of paths in this file. It fails the moment somebody adds the
 * eleventh money route and does not know this list exists — which is the normal case, because the
 * person writing a refund endpoint is not thinking about impersonation. The list stays green,
 * coverage looks complete, and one route quietly accepts a borrowed identity.
 *
 * So the marker lives ON the handler as `@FinancialMutation()`, and `api-gates` cross-references
 * the `§14.2.1` money-affecting class against the decorated set — a money route without the marker
 * fails the build rather than failing silently at runtime.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  applyDecorators,
} from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';
import { Reflector } from '@nestjs/core';

import { BusinessRuleException } from '../errors/domain-exception.js';

export const FINANCIAL_MUTATION = Symbol('FinancialMutation');

/**
 * Marks a handler that moves money — `§14.2.1`'s money-affecting class.
 *
 * Refunds, payouts, price changes, credit notes, manual ledger adjustments. If a handler could
 * change what somebody is owed or has paid, it carries this.
 */
export const FinancialMutation = (): MethodDecorator & ClassDecorator =>
  applyDecorators(
    SetMetadata(FINANCIAL_MUTATION, true),
    /*
     * Emitted into the contract as well as into Nest's metadata, and that is the load-bearing half.
     *
     * The guard reads the metadata at RUNTIME, which only helps for routes somebody remembered to
     * decorate. The extension puts the same fact in `openapi.json`, where `api-gates` PG-6 can
     * cross-reference it against `§14.2.1`'s money-affecting list and fail the BUILD on a money
     * route that has no marker — the gap the guard cannot close on its own.
     */
    ApiExtension('x-gymmap-financial-mutation', true),
  );

interface GuardedRequest {
  readonly principal?: { readonly sub: string; readonly typ?: string };
}

@Injectable()
export class ImpersonationRestrictionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const principal = context.switchToHttp().getRequest<GuardedRequest>().principal;

    /*
     * Ordinary sessions pass without the metadata being read at all.
     *
     * Checked in this order because it is the common case by orders of magnitude, and because the
     * question this guard answers is "is this an impersonation?" — not "is this route financial?".
     * A route being financial is uninteresting until somebody is borrowing an identity.
     */
    if (principal?.typ !== 'IMPERSONATION') return true;

    const financial = this.reflector.getAllAndOverride<boolean>(FINANCIAL_MUTATION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (financial !== true) return true;

    /*
     * 403, not 422.
     *
     * Different from `MFA_MANDATORY_FOR_ROLE`, and the difference is real: that operation is
     * available to nobody, whereas this one is available to the agent's own identity — they can end
     * the impersonation and do it as themselves, and the message says so. The refusal IS about who
     * is asking, which is what 403 means.
     */
    throw new BusinessRuleException(
      'IMPERSONATION_FINANCIAL_MUTATION_REFUSED',
      'Money cannot be moved while impersonating another user. End the session and act as yourself.',
    );
  }
}
