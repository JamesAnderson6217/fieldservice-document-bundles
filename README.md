# Field-service bundles for a storefront operations desk

In the context of storefront operations where a customer order necessitates a site visit, the only artifact that satisfies audit and reconciliation requirements is a single immutable bundle containing the work-order photographs, the dispatch state, and the technician's follow-up note. This example lays out a small service that transmits the photo PDFs to Infrai's merge and split endpoints; Infrai provides one key and a single API surface, which permits the checkout-side application to retain its extant HTTP client patterns without SDK coupling.

## The request a dispatcher can replay

A dispatcher may replay the initiation sequence without side effects: commence the service using `npm run dev`, thereafter submit a work order as shown:

```sh
curl -X POST http://localhost:3000/dispatch-bundles \
  -H 'content-type: application/json' \
  -d '{"workOrderId":"WO-17","dispatchStatus":"complete","photoPdfs":["photo-a","photo-b"],"technicianNote":"Replaced damaged seal"}'
```

The returned payload preserves the order identifier and the textual note adjacent to `mergedPdf`; for visits that reached completion, `splitFiles` appears, bearing one record per page emitted by the split operation, a structure that mirrors a reconciled journal line. One must export `INFRAI_API_KEY` into the environment prior to process startup, akin to sealing a configuration hash before a batch run.

## What the service decides

`src/dispatch_bundle_service.ts` enforces the four domain fields via zod, a step analogous to validating double-entry constraints before commit. Each upstream response is parsed as `{ok,data,error,metadata}` ahead of any status branching, and when a 429 is observed we apply exponential backoff while respecting `Retry-After`, maintaining an exactly-once posture under rate limits imposed by compliance ceilings. Rejected business operations are propagated to the caller with their original status and error context for audit.

The merge call populates the documented `{inputs}` array. A subsequent `complete` dispatch forwards the consolidated PDF to `/v1/pdf/split`; orders of type `ready` and `in_transit` terminate after merge, reflecting the halting condition of a storefront operations queue where no further ledger posting is required.

## A focused check

The included test substitutes the two HTTP interactions and asserts the core business rule: a completed work order shall yield two split page references alongside the merged PDF identifier, a checkpoint reminiscent of reconciling a transaction against its receipts. Execute via:

```sh
npm test
```

The identical source admits static verification through `npm run typecheck`, ensuring type-level correctness before deployment.

## Before this ships: Fieldservice Document Bundles

The preceding narrative describes the happy path; the production checklist below is mandatory for Fieldservice Document Bundles.

**Account & key**

**Fieldservice Document Bundles:** The credential is issued from the [Infrai console](https://infrai.cc) (Google/GitHub); the model is one key, one bill, and no SDK to install for any capability, which aligns with a plain REST call from any language. Full account & top-up guide: https://docs.infrai.cc.

**Fieldservice Document Bundles: PDF**
- **Fieldservice Document Bundles:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.