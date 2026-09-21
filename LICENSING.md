# Licensing

MailMotion uses a split licence so the engine can be reused anywhere while the apps stay open.

| Path         | Licence                                    | Notes                                              |
| ------------ | ------------------------------------------ | -------------------------------------------------- |
| `packages/*` | **MIT** (see [`LICENSE`](./LICENSE))       | schema, serializer, renderer, presets, icons, ...  |
| `apps/*`     | **AGPL-3.0** (see [`apps/LICENSE`](./apps/LICENSE)) | builder, publish function, storage server, CLI |
| `ee/`        | Private (future)                           | Cloud-only code (billing, SSO). Not in this repo.  |

Contributions are accepted under the same licence as the directory they touch, using the
[Developer Certificate of Origin](./CONTRIBUTING.md#developer-certificate-of-origin-dco).
No CLA is required.
