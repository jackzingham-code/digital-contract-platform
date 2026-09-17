# Digital Contract Platform

A complete two-party contract workflow with:

- Fully custom contract wording
- Draft editing
- Headings, paragraphs, numbered lists, bullet lists and bold text
- Live document preview
- Unique contract IDs
- Private signing links
- Shared contract state
- Two separate signature fields
- Typed or drawn signatures
- Name, date and time recorded for each signature
- Waiting, partially signed and fully signed states
- Contract locking after the first signature
- Dashboard filtering
- Mobile-friendly signing page
- SQLite persistence

## Run

Requires Node.js 20+.

```bash
npm install
npm start
```

Then open:

http://localhost:3000

The SQLite database is created automatically as `contracts.db`.

## How the workflow works

1. Create a contract.
2. Write the entire contract yourself.
3. Save the draft.
4. Select "Send for Signature".
5. Copy the private link.
6. Send that link to the second person.
7. The second person opens the same contract.
8. Either party signs their own signature field.
9. After the first signature, the contract terms are locked.
10. After both signatures, the status becomes "Fully signed".

The server stores both signatures on the same contract record. It never creates a second contract for the signing party.

## Production hardening

Before using this for real legal documents, add account authentication, HTTPS, rate limiting, stronger access controls, audit logs, encrypted backups, email delivery, CSRF protection where applicable, and a legal review of the signing/e-signature requirements for the jurisdictions in which the service will operate.
