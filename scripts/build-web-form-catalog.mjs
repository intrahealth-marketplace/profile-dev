#!/usr/bin/env node
// Regenerates web-form-templates/catalog.json from each template's metadata.json.
//
// Each template lives in its own folder under web-form-templates/ and contains:
//   - metadata.json : display fields published in the catalog (hand-edited by contributors)
//   - template.json : the importable export bundle (not read here)
//   - <preview>.png : optional preview image referenced by metadata.previewImageFilename
//
// The catalog is the single file the backend reads (see Web Form Template Import/Export
// PRD, Marketplace Catalogue section), so this script is the only writer of catalog.json.
// Contributors edit only their own metadata.json and never hand-edit the aggregate.
//
// Usage:
//   node scripts/build-web-form-catalog.mjs           # validate + write catalog.json
//   node scripts/build-web-form-catalog.mjs --check    # validate only, do not write (CI gate)

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATES_DIR = join(REPO_ROOT, 'web-form-templates');
const CATALOG_PATH = join(TEMPLATES_DIR, 'catalog.json');
const SCHEMA_VERSION = 1;

// Recognized jurisdiction tags at launch (PRD Marketplace Catalogue 6.5).
const COUNTRIES = ['CA', 'NZ', 'AU'];
const CA_SUBDIVISIONS = [
  'CA-AB', 'CA-BC', 'CA-MB', 'CA-NB', 'CA-NL', 'CA-NS', 'CA-NT',
  'CA-NU', 'CA-ON', 'CA-PE', 'CA-QC', 'CA-SK', 'CA-YT',
];
const VALID_JURISDICTIONS = new Set([...COUNTRIES, ...CA_SUBDIVISIONS]);

const checkOnly = process.argv.includes('--check');
const errors = [];

function fail(folder, message) {
  errors.push(`  ${folder}/metadata.json: ${message}`);
}

function listTemplateFolders() {
  return readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort(); // deterministic order so catalog.json diffs are stable
}

function buildItem(folder) {
  const folderPath = join(TEMPLATES_DIR, folder);
  const metadataPath = join(folderPath, 'metadata.json');
  const templatePath = join(folderPath, 'template.json');

  if (!existsSync(metadataPath)) {
    fail(folder, 'missing metadata.json');
    return null;
  }
  if (!existsSync(templatePath)) {
    fail(folder, 'missing template.json (every published template must ship its bundle)');
    return null;
  }

  let meta;
  try {
    meta = JSON.parse(readFileSync(metadataPath, 'utf8'));
  } catch (e) {
    fail(folder, `is not valid JSON (${e.message})`);
    return null;
  }

  // Required fields.
  for (const field of ['objGuid', 'displayName', 'language', 'jurisdictions', 'modified']) {
    if (meta[field] === undefined || meta[field] === null) {
      fail(folder, `missing required field "${field}"`);
    }
  }

  // jurisdictions: non-empty array of recognized ISO 3166 tags.
  if (meta.jurisdictions !== undefined) {
    if (!Array.isArray(meta.jurisdictions) || meta.jurisdictions.length === 0) {
      fail(folder, '"jurisdictions" must be a non-empty array');
    } else {
      for (const j of meta.jurisdictions) {
        if (!VALID_JURISDICTIONS.has(j)) {
          fail(folder, `unrecognized jurisdiction tag "${j}"`);
        }
      }
    }
  }

  // modified: ISO 8601 timestamp.
  if (typeof meta.modified === 'string' && Number.isNaN(Date.parse(meta.modified))) {
    fail(folder, `"modified" is not a valid timestamp ("${meta.modified}")`);
  }

  // previewImageFilename: optional; if set, the file must exist in the folder.
  const previewImageFilename = meta.previewImageFilename ?? null;
  if (previewImageFilename !== null) {
    if (typeof previewImageFilename !== 'string') {
      fail(folder, '"previewImageFilename" must be a string or null');
    } else if (!existsSync(join(folderPath, previewImageFilename))) {
      fail(folder, `previewImageFilename "${previewImageFilename}" does not exist in the folder`);
    }
  }

  // template.json must parse.
  try {
    JSON.parse(readFileSync(templatePath, 'utf8'));
  } catch (e) {
    fail(folder, `../template.json is not valid JSON (${e.message})`);
  }

  // Fixed field order keeps the generated catalog stable and reviewable.
  return {
    folder,
    objGuid: meta.objGuid,
    displayName: meta.displayName,
    language: meta.language,
    jurisdictions: meta.jurisdictions,
    modified: meta.modified,
    previewImageFilename,
  };
}

function main() {
  if (!existsSync(TEMPLATES_DIR) || !statSync(TEMPLATES_DIR).isDirectory()) {
    console.error(`web-form-templates directory not found at ${TEMPLATES_DIR}`);
    process.exit(1);
  }

  const folders = listTemplateFolders();
  const items = [];
  const seenObjGuids = new Map();

  for (const folder of folders) {
    const item = buildItem(folder);
    if (!item) continue;
    // ObjGuid uniqueness: two catalog entries with the same ObjGuid would both
    // match the same local template and make installed-status ambiguous.
    if (item.objGuid) {
      if (seenObjGuids.has(item.objGuid)) {
        fail(folder, `duplicate objGuid "${item.objGuid}" (also in ${seenObjGuids.get(item.objGuid)})`);
      } else {
        seenObjGuids.set(item.objGuid, folder);
      }
    }
    items.push(item);
  }

  if (errors.length > 0) {
    console.error(`Catalog validation failed with ${errors.length} error(s):`);
    console.error(errors.join('\n'));
    process.exit(1);
  }

  const catalog = { schemaVersion: SCHEMA_VERSION, items };
  const json = JSON.stringify(catalog, null, 2) + '\n';

  if (checkOnly) {
    console.log(`Validated ${items.length} template(s). (--check: not writing catalog.json)`);
    return;
  }

  writeFileSync(CATALOG_PATH, json);
  console.log(`Wrote ${items.length} template(s) to web-form-templates/catalog.json`);
}

main();
