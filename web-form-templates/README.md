# Web Form Templates

Marketplace web form templates. Each template is one folder containing two files. The
root `catalog.json` is generated automatically — see [Catalog automation](#catalog-automation).

## Folder structure

```
web-form-templates/
  catalog.json              # generated aggregate — do not edit by hand
  <template-folder>/
    metadata.json           # catalog display fields (you edit this)
    template.json           # importable export bundle (you edit this)
  ...
```

To add a template, create a new folder with `metadata.json` and `template.json` and push
to `main`. The catalog regenerates on its own.

## metadata.json

Display fields published to the catalog.

```json
{
  "objGuid": "ADCEF9FE7D568BBDEAF39E1444BD53BC",
  "displayName": "Example Test Form",
  "language": "en",
  "jurisdictions": ["CA", "NZ", "AU"],
  "modified": "2026-06-16T21:00:00Z"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `objGuid` | yes | 32-char uppercase hex GUID. Must match `template.json` and be unique across all templates. The app matches installed templates by this value. |
| `displayName` | yes | Name shown in the Marketplace browser. |
| `language` | yes | Language code, e.g. `"en"`. |
| `jurisdictions` | yes | Non-empty array of ISO 3166 tags (see below). |
| `modified` | yes | ISO 8601 timestamp. The app compares this to the installed copy to show "Update available". Bump it only on real content changes. |

### Jurisdiction tags

Controls which customers see the template (filtered to their configured jurisdiction).

- Countries: `CA`, `NZ`, `AU`
- Canadian subdivisions: `CA-AB`, `CA-BC`, `CA-MB`, `CA-NB`, `CA-NL`, `CA-NS`, `CA-NT`, `CA-NU`, `CA-ON`, `CA-PE`, `CA-QC`, `CA-SK`, `CA-YT`

A country tag applies nationwide; a subdivision tag restricts to that province. For a
template valid everywhere, list every country: `["CA", "NZ", "AU"]`. There is no wildcard.

## template.json

The importable export bundle. The app downloads this file directly when installing.

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-06-16T21:00:00.0000000+00:00",
  "templates": [
    {
      "objGuid": "ADCEF9FE7D568BBDEAF39E1444BD53BC",
      "name": "Example Test Form",
      "description": "...",
      "type": 1,
      "isActive": true,
      "presetsEnabled": true,
      "folderPath": ["Examples"],
      "jsonDefinition": { "title": "...", "fields": [ /* ... */ ] },
      "marketplaceModified": null
    }
  ]
}
```

`objGuid` here must equal the one in `metadata.json`. `folderPath` is the default
destination folder on import. `jsonDefinition` is the form definition itself.

## Catalog automation

`catalog.json` is the single file the backend reads. It is regenerated from every
`metadata.json` by [`scripts/build-web-form-catalog.mjs`](../scripts/build-web-form-catalog.mjs),
run by the [Build Web Form Catalog](../.github/workflows/build-web-form-catalog.yml)
workflow on every push to `main` that touches `web-form-templates/`.

The workflow validates each template, rewrites `catalog.json` (folders sorted
alphabetically), and commits it back. Never edit `catalog.json` by hand — your change
will be overwritten.

Each catalog item is the `metadata.json` fields plus the `folder` name:

```json
{
  "folder": "example-test-form",
  "objGuid": "ADCEF9FE7D568BBDEAF39E1444BD53BC",
  "displayName": "Example Test Form",
  "language": "en",
  "jurisdictions": ["CA", "NZ", "AU"],
  "modified": "2026-06-16T21:00:00Z"
}
```

Validation fails the build (and leaves `catalog.json` untouched) if any template is
missing `metadata.json` or `template.json`, either file is not valid JSON, a required
metadata field is absent, a jurisdiction tag is unrecognized, `modified` is not a valid
timestamp, or two templates share an `objGuid`.

### Run locally

```
node scripts/build-web-form-catalog.mjs           # validate and rewrite catalog.json
node scripts/build-web-form-catalog.mjs --check    # validate only, no write
```
