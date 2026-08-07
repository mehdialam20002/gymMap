# `notifications/controllers` — no endpoints yet, and the directory says so

`FolderStructure.md` §8.1 row 4 makes `controllers/` mandatory on every module that is not one of
the four provider-only modules of §8.2 — `common`, `tenancy`, `ledger`, `audit`. `notifications` is
not one of them: it has a real HTTP surface, specified in full in [`docs/apis/Notifications.md`](../../../../../docs/apis/Notifications.md).

**None of it exists at M-018.** This milestone delivers the outbound channel port and the local
Mailpit adapter (`T-17.03`) so that nine sprints of feature work exercise the port before `A-19`
picks a vendor. The endpoints — templates, preferences, the delivery log, the provider status
callback (`T-17.37`) — belong to EP-17 and arrive with it.

The directory exists rather than being omitted so that the absence is a stated fact rather than an
oversight, exactly as [`../application/ports/README.md`](../application/ports/README.md) does for
the inbound side. A missing directory reads as "nobody got round to it"; this reads as "the surface
is specified, and its milestone has not run".

## What will land here, and under which milestone

| Surface                                   | Anchor                                 | Arrives with |
| :---------------------------------------- | :------------------------------------- | :----------- |
| Template CRUD and versioning              | `FR-NOTF-03`, `Notifications.md` §5    | `M-112`      |
| Recipient preference matrix               | `FR-USER-04`, `FR-NOTF-02`             | `M-111`      |
| Delivery log read + attempt detail        | `AC-NOTF-01.4`, `Notifications.md` §11 | EP-17        |
| Provider status callback (signed ingress) | `T-17.37`, `Notifications.md` §2.8 D8  | EP-17        |

Until then, `CHANNEL_NOT_AVAILABLE` (422) — `README.md` §9.5.11 — is the registered, honest answer
for any channel with no configured adapter.
