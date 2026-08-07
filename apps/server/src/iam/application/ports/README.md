# `iam/application/ports` — empty at M-019, and the shape of what lands here is already known

`FolderStructure.md` §8.1 row 7: a module's outbound dependencies are **ports, never concrete
classes**. `iam/` has none yet, because M-019 delivers tables and a catalogue and nothing that
calls out.

It will not stay empty, and the ports below are named now so that M-020 and M-021 add adapters
rather than reach for a vendor SDK at a call site:

| Port                   | Points at                                  | Arrives with | Anchor               |
| :--------------------- | :----------------------------------------- | :----------- | :------------------- |
| `PasswordHasherPort`   | Argon2id, with recorded parameters         | `M-020`      | `A-12`, `NFR-SEC-01` |
| `BreachedPasswordPort` | a k-anonymity range API                    | `M-020`      | `FR-AUTH-04`         |
| `OtpDeliveryPort`      | `notifications/`, never a channel directly | `M-021`      | `FR-AUTH-05`         |
| `TotpPort`             | the TOTP implementation                    | `M-025`      | `NFR-SEC-11`         |

**`OtpDeliveryPort` is the one worth stating in advance.** `notifications/` owns the decision to
turn a fact into a message — `ModuleDependency.md` §4.2 forbids any other module choosing a
channel, resolving an address or evaluating a preference. So `iam/` must not inject
`NOTIFICATION_CHANNELS`; it asks for an OTP to be delivered and stops there. The channel
port that M-018 built lives at
[`notifications/application/ports/notification-channel.port.ts`](../../../notifications/application/ports/notification-channel.port.ts)
and is not exported from that module's `index.ts` for exactly this reason.

## What is NOT an outbound port

The five identity tables. `iam/` **owns** them, so they are reached through this module's own
repositories in `infrastructure/`, not through a port. A port to your own table is indirection
with no seam in it.
