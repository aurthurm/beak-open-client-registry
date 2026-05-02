# Certificates

OpenCR uses mutual TLS for direct client access in standalone mode and for local testing. This page explains:

- what the checked-in certificates are for
- when regeneration is necessary
- how to regenerate them safely
- what breaks when you regenerate them

## Certificate Types

This repository keeps two certificate sets under `server/`:

- `server/serverCertificates/`
  - the TLS certificate and private key used by the OpenCR server
  - files: `server_cert.pem`, `server_key.pem`
- `server/clientCertificates/`
  - sample client certificates used by the test scripts and example uploads
  - files: `openmrs_cert.pem`, `openmrs_key.pem`, `openmrs_csr.pem`, `openmrs.p12`

The test helpers and sample upload scripts read these files directly. If they are missing or expired, local uploads will fail until the files are regenerated.

## When Regeneration Is Necessary

Regenerate the certificates when:

- the server certificate has expired
- you change the hostname or IP address that clients use to reach OpenCR
- you want to replace the sample client identity used by the tests
- you intentionally want to reset the trust chain for a local test environment

You do not need to regenerate them for normal application code changes.

## What Regeneration Changes

Regenerating the server certificate changes the TLS identity of the OpenCR server. Any client certificate that was signed by the old server certificate will no longer be trusted by the new server certificate chain.

In practice this means:

- existing test scripts may stop working until they are pointed at the new files
- Docker images that already baked in the old certs must be rebuilt
- any external client that trusts the old server certificate must be updated

For local development this is acceptable. For production, use proper certificate management and avoid self-signed certs.

## Safe Regeneration Order

If you regenerate the sample certificates, do it in this order:

1. Generate the server certificate and key.
2. Generate the client key and CSR.
3. Sign the client certificate with the new server certificate.
4. Rebuild any Docker image that copied the old files.
5. Restart OpenCR and rerun the test uploads.

## How To Regenerate

Run the following from the repository root:

```sh
cd server/serverCertificates
openssl req -nodes -new -x509 -days 365 -keyout server_key.pem -out server_cert.pem -subj "/CN=localhost"

cd ../clientCertificates
openssl req -newkey rsa:4096 -keyout openmrs_key.pem -out openmrs_csr.pem -nodes -days 365 -subj "/CN=openmrs"
openssl x509 -req -in openmrs_csr.pem -CA ../serverCertificates/server_cert.pem -CAkey ../serverCertificates/server_key.pem -out openmrs_cert.pem -set_serial 01 -days 365
openssl pkcs12 -export -in openmrs_cert.pem -inkey openmrs_key.pem -out openmrs.p12
```

If you are testing against a non-localhost hostname or IP address, replace the server certificate subject CN with the host or IP you will use.

Example:

```sh
openssl req -nodes -new -x509 -days 365 -keyout server_key.pem -out server_cert.pem -subj "/CN=172.16.168.172"
```

## How To Verify

After regeneration, confirm the files exist and the dates are correct:

```sh
openssl x509 -in server/serverCertificates/server_cert.pem -noout -subject -dates
openssl x509 -in server/clientCertificates/openmrs_cert.pem -noout -subject -dates
```

Then rerun the local upload scripts or tests that use mutual TLS.

## Local Test Flow

For local development, the simplest sequence is:

1. Regenerate certs only if needed.
2. Rebuild the local OpenCR Docker image if the image copies cert files.
3. Start the stack.
4. Upload the sample patient JSON using `tests/uploadJSON.js`.

## Production Note

Do not use these self-signed certificates for production. Production deployments should use a managed certificate process and a trusted CA.
