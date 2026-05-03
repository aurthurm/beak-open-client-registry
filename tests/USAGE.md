# Test Helpers

This folder contains small importer and verification scripts for loading demo data into OpenCR.

## Scripts

### `uploadJSON.ts`
- Sends a JSON file to `POST /fhir/Patient` one patient at a time.
- Accepts either:
  - a single `Patient`
  - or a JSON object with `entry[]` of patients
- Use this for files like `sampleSinglePatient.json` or `sampleMultiplePatients.json`.

### `uploadJSONBundle.ts`
- Sends the JSON file to `POST /fhir` as-is.
- Use this when the input is already a FHIR `Bundle`, or when you want to submit the whole payload in one request instead of splitting patients out.

### `uploadCSV.ts`
- Reads a generic CSV file and turns each row into a `Patient`.
- Expected columns include:
  - `rec_id`
  - `sex`
  - `given_name`
  - `surname`
  - `phone_number`
  - `uganda_nin`
  - `art_number`
  - `date_of_birth`
- Maps those values into a `Patient` with:
  - `identifier[0]` from `rec_id`
  - `identifier` for national ID and ART number when present
  - `name.use = official` with `given_name` and `surname`
  - `gender` normalized to `male`, `female`, or `unknown`
  - `birthDate` normalized to `YYYY-MM-DD`
- Posts each generated patient to `POST /fhir/Patient`.

### `uploadUgandaCSV.ts`
- Similar to `uploadCSV.ts`, but for the Uganda-specific CSV format.
- Expected columns include:
  - `rec_id`
  - `sex`
  - `date_of_birth`
  - `given_name`
  - `surname`
  - `phone_number`
  - `uganda_nin`
  - `art_number`
- Maps those values into the same `Patient` shape as `uploadCSV.ts`, with the meta tag display set to `Uganda CSV Data`.
- Posts each generated patient to `POST /fhir/Patient`.

### `updateConfig.ts`
- Sends config updates to the backend `updateConfig` endpoint.
- Useful for changing system identifier URIs such as the internal ID systems the backend accepts.

### `uploadResults.ts`
- Does not upload patients.
- Compares imported data against a `true links` CSV and prints a match summary.
- The upload scripts call it automatically if you pass a second `.csv` argument.

## Common commands

```sh
# Single patient JSON
node uploadJSON.ts sampleSinglePatient.json

# Multiple patients in one JSON file
node uploadJSON.ts sampleMultiplePatients.json

# JSON bundle upload
node uploadJSONBundle.ts sampleMultiplePatients.json

# Generic CSV import
node uploadCSV.ts somefile.csv

# Uganda CSV import
node uploadUgandaCSV.ts uganda_data_v21_20201501.csv

# Upload plus evaluation summary
node uploadJSON.ts sampleMultiplePatients.json true_links.csv
```

## Support files

- `ports.ts` sets the test backend URL.
- `requireFallback.ts` lets these scripts load dependencies from the server install if `tests/` does not have its own `node_modules`.
