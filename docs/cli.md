---
title: Command line
order: 5
---

# Command line

```bash
npx mailmotion presets
npx mailmotion init --preset neon --name "Grace Hopper"     # writes signature.json
npx mailmotion validate signature.json
npx mailmotion render signature.json --out dist --base-url https://img.example.com --check
```

`render` writes content-hashed images to `images/`, plus `<name>.html`, `<name>.htm` (classic Outlook), `<name>.mailsignature` (Apple Mail) and the portable `<name>.mailmotion.json`.

| Option                          | Meaning                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `--base-url <https url>`        | Where you will host the images. Without it the HTML uses an obviously fake placeholder                        |
| `--upload <endpoint>`           | Upload to a MailMotion storage server (token from `--token` or `MM_UPLOAD_TOKEN`) and use the URLs it returns |
| `--variant full\|reply\|mobile` | Render a saved version                                                                                        |
| `--zip`                         | Also write a ZIP bundle                                                                                       |
| `--check`                       | Exit 1 if any budget fails: 10,000 characters, 300 KB per GIF, 12 fps, lint                                   |
| `--json`                        | Machine-readable report                                                                                       |

Exit codes: `0` ok, `1` budget or validation failure, `2` usage error. Use `--check` in CI to keep brand signatures within the limits.
