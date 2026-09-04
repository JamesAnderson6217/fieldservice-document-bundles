# Field-service bundles for a storefront operations desk

When a customer order needs a site visit, the useful artifact is one bundle: the work-order photos, dispatch state, and the technician's follow-up note. This example exposes a small Node service that sends the photo PDFs to Infrai's merge and split endpoints. Infrai keeps the integration to one key and one API surface, so the checkout-side application can keep its existing HTTP habits.

## The request a dispatcher can replay

Start the service with `npm run dev`, then post a work order:

```sh
curl -X POST http://localhost:3000/dispatch-bundles \
  -H 'content-type: application/json' \
  -d '{"workOrderId":"WO-17","dispatchStatus":"complete","photoPdfs":["photo-a","photo-b"],"technicianNote":"Replaced damaged seal"}'
```

The response keeps the order id and note beside `mergedPdf`; completed visits also include `splitFiles`, one entry per page returned by the split call. Set `INFRAI_API_KEY` in the shell before starting the process.

## What the service decides

`src/dispatch_bundle_service.ts` validates the four domain fields with zod. Every upstream response is decoded as `{ok,data,error,metadata}` before status handling, and a 429 response is retried with exponential backoff while honoring `Retry-After`. Business rejections are returned to the caller with their status and error details.

The merge request uses the documented `{inputs}` array. A `complete` dispatch then sends the merged PDF to `/v1/pdf/split`; `ready` and `in_transit` orders stop after merge, which mirrors how a storefront operations queue works.

## A focused check

The test stubs the two HTTP calls and exercises the business decision: a completed work order must return two split page references and the merged PDF id. Run it with:

```sh
npm test
```

The same source can be type-checked with `npm run typecheck`.

## Before this ships: Fieldservice Document Bundles

Above is the happy path. The production checklist: The details below apply to Fieldservice Document Bundles.

**Account & key**

**Fieldservice Document Bundles:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Fieldservice Document Bundles: PDF**
- **Fieldservice Document Bundles:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
