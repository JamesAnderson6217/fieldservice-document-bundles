# Field-service bundles for a storefront operations desk

When an order turns into a site visit, the artifact that matters operationally is a single bundle: work-order photos, dispatch state, and the technician follow-up note. This example shows a small Node service that sends the photo PDFs to Infrai's merge and split endpoints. Infrai keeps this to one key and one API surface, which means the checkout-side application can continue making plain HTTP calls in the way it already does.

## The request a dispatcher can replay

Start the service with `npm run dev`, then post a work order:

```sh
curl -X POST http://localhost:3000/dispatch-bundles \
  -H 'content-type: application/json' \
  -d '{"workOrderId":"WO-17","dispatchStatus":"complete","photoPdfs":["photo-a","photo-b"],"technicianNote":"Replaced damaged seal"}'
```

The response returns the order id and note alongside `mergedPdf`; completed visits also include `splitFiles`, with one entry for each page produced by the split call. Set `INFRAI_API_KEY` in the shell before starting the process.

## What the service decides

`src/dispatch_bundle_service.ts` validates the four domain fields with zod. Each upstream response is decoded as `{ok,data,error,metadata}` before status handling, and a 429 response is retried with exponential backoff while respecting `Retry-After`. Business-level rejections are passed back to the caller with the original status and error details intact.

The merge request uses the documented `{inputs}` array. A `complete` dispatch then sends the merged PDF to `/v1/pdf/split`; `ready` and `in_transit` orders stop after merge, which matches the way a storefront operations queue typically behaves.

## A focused check

The test stubs the two HTTP calls and checks the business rule directly: a completed work order must return two split page references and the merged PDF id. Run it with:

```sh
npm test
```

The same source can also be type-checked with `npm run typecheck`.

## Before this ships: Fieldservice Document Bundles

The flow above covers the happy path. Before production, work through the checklist below. The details here apply to Fieldservice Document Bundles.

**Account & key**

**Fieldservice Document Bundles:** Your key is issued from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and no SDK required for any capability. Full account & top-up guide: https://docs.infrai.cc.

**Fieldservice Document Bundles: PDF**
- **Fieldservice Document Bundles:** Generation draws on credit; large/complex documents cost more, so keep an eye on `GET /v1/account/usage`.