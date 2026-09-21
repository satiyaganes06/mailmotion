---
title: JSON format
order: 7
---

# Portable signature JSON

Every signature can be exported as JSON and imported again (builder, CLI, and the future cloud version).

```json
{
  "format": "mailmotion.signature",
  "schemaVersion": 1,
  "exportedAt": "2026-09-22T10:00:00.000Z",
  "config": {
    "details": { "fullName": "Ada Lovelace", "title": "Mathematician" },
    "layout": { "id": "card" },
    "avatar": { "animation": "aurora" }
  }
}
```

A bare `config` object is accepted too. Every field is optional except `details.fullName`; defaults fill the rest. The schema lives in `packages/schema` (`@mailmotion/schema`, MIT) and rejects unknown `schemaVersion`s instead of guessing.

Photos, logos and badges are stored inside the file as base64 PNG/JPEG/WebP/GIF data URLs (SVG is refused because it can carry script). All links must be `https:`; phone numbers use international format.
