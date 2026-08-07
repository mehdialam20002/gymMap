# `iam/controllers` — no endpoints at M-019, and the first one is one milestone away

`FolderStructure.md` §8.1 row 4 makes `controllers/` mandatory on every module that is not one of
the four provider-only modules of §8.2. `iam` is not one of them — it has the largest public HTTP
surface in the platform, specified in [`docs/apis/Authentication.md`](../../../../../docs/apis/Authentication.md).

**None of it exists at M-019.** This milestone delivers the five tables with their tenancy class
and the seeded §B3.1 / §B3.2 catalogue. Nothing can log in yet, because nothing can hash a
password or mint a token.

| Surface                                                        | Anchor                                     | Arrives with     |
| :------------------------------------------------------------- | :----------------------------------------- | :--------------- |
| `POST /v1/auth/register`, `/login`, `/password/{forgot,reset}` | `Authentication.md` §8.3, §8.4, §8.7, §8.8 | `M-020`          |
| `POST /v1/auth/otp/{request,verify}`                           | `FR-AUTH-05`                               | `M-021`          |
| `POST /v1/auth/token/refresh`, session list and revoke         | `FR-AUTH-09`, `FR-AUTH-10`, ADR-0011       | `M-022`, `M-023` |
| TOTP enrolment and challenge                                   | `NFR-SEC-11`                               | `M-025`          |
| Platform user administration (`SCR-ADM-005`)                   | `FR-RBAC-05`                               | `M-114`          |

The directory exists rather than being omitted so that the absence is a stated fact rather than an
oversight — the same reason [`../application/ports/README.md`](../application/ports/README.md)
exists.
