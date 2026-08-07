# `notifications/application/ports` — one port, and it points at the vendors

`FolderStructure.md` §8.1 row 7: a module's outbound dependencies are **ports, never concrete
classes**. `notifications/` has exactly one at M-018, and it is the one that matters most.

| Port                  | Points at                             | Adapters today                                         |
| :-------------------- | :------------------------------------ | :----------------------------------------------------- |
| `NotificationChannel` | the delivery vendors — `EP-17 F-17.1` | `MailpitEmailAdapter`, `local`/`test` only (`T-17.03`) |

## Why this file exists

Three documents give this port three different paths, and the disagreement is worth recording
rather than silently picking a winner:

| Document                                    | Path it names                                                     | Rank                     |
| :------------------------------------------ | :---------------------------------------------------------------- | :----------------------- |
| `PROJECT_CONSTITUTION.md` §1311             | `notifications/application/ports/notification-channel.port.ts`    | highest                  |
| `docs/apis/Notifications.md` §2.9           | `src/modules/notifications/ports/notification-channel.port.ts`    | binding derived spec     |
| `docs/roadmap/Milestones_000-029.md` §M-021 | `notifications/ports/{email,sms,in-app,web-push}.channel.port.ts` | plan of work, not a spec |

`CLAUDE.md` §2 resolves it without a judgement call: the constitution outranks the API spec, which
outranks the roadmap — and a roadmap "is a plan of work, never a source of requirements". The
constitution's path is also the one §8.1 row 7 requires of an outbound dependency, and
`Notifications.md`'s `src/modules/` prefix does not exist anywhere in this repository.

The roadmap's **four files** were reconciled the same way. One interface with a `key` discriminant
is the constitution's own Open/Closed worked example (§1295); four interfaces reproduce the
if-chain it is written to argue against, because the dispatcher would have to know which of the
four to inject. The four **keys** all survive — `EMAIL`, `SMS`, `IN_APP`, `PUSH`.

The port's **shape** is `Notifications.md` §2.9's, which is strictly richer and not in conflict:
the constitution sketches `key` and `supports()` in the course of making a SOLID argument, while
§2.9 specifies the `ChannelSendResult` the §2.8 D3 attempt record needs, the status callback and
the DLT binding. Both documents' members are present.

## What is NOT here

The inbound surface — how another module asks for a notification — is deliberately absent. It
arrives with EP-17, and until then no module can send one. `ModuleDependency.md` §4.2 is the
reason: publishing modules emit a domain fact and stop, and the decision to turn a fact into a
message (and the decision not to) lives inside this module.
