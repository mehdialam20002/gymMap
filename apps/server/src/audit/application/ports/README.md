# `audit/application/ports` — intentionally empty

`FolderStructure.md` §8.1 row 7 makes `application/ports/` mandatory on every module: a module's
outbound dependencies are ports, never concrete classes.

**`audit/` has none.** It is a leaf. It writes rows and reads them back, and it asks nothing of
any other module — which is what lets every module depend on it without creating a cycle.

The directory exists rather than being omitted so that the absence is a stated fact rather than
an oversight. A missing directory reads as "nobody got round to it"; this reads as "there is
nothing to put here, and that is the design".

## What `audit/` exposes is one level up

`ports/` at the module root holds the OUTBOUND surface — what other modules consume:

| Port               | Consumer                                              | Note                                                                                                                                                                                                                                                          |
| :----------------- | :---------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AUDIT_READ_PORT`  | `admin/` (`FR-ADMN-09`)                               | Read-only **by signature**. No `append` method exists on it.                                                                                                                                                                                                  |
| `AUDIT_WRITE_PORT` | the `@Audited()` interceptor and `runElevated()` only | **Not exported from `index.ts`.** §8.2: the writer must not be reachable from the administration UI — a module that can write an audit row can write a false one, and a false entry in an append-only log is permanent and indistinguishable from a true one. |

The two are separate interfaces rather than one with two methods precisely so that holding the
read port makes writing impossible, rather than merely discouraged.
