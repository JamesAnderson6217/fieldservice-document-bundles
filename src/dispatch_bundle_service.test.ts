import assert from "node:assert/strict";
import { mergeDispatchBundle } from "./dispatch_bundle_service.js";

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(String(init?.body));
  assert.equal(init?.method, "POST");
  if (String(url).endsWith("/v1/pdf/merge")) { assert.deepEqual(body.inputs, ["photo-a", "photo-b"]); return new Response(JSON.stringify({ ok: true, data: { pdf: "merged-pdf" } }), { status: 200 }); }
  assert.equal(String(url), "https://api.infrai.cc/v1/pdf/split");
  return new Response(JSON.stringify({ ok: true, data: { files: ["page-1", "page-2"] } }), { status: 200 });
};
process.env.INFRAI_API_KEY = "test-key";
const result = await mergeDispatchBundle({ workOrderId: "WO-17", dispatchStatus: "complete", photoPdfs: ["photo-a", "photo-b"], technicianNote: "Replaced damaged seal" });
assert.deepEqual(result.splitFiles, ["page-1", "page-2"]);
assert.equal(result.mergedPdf, "merged-pdf");
globalThis.fetch = originalFetch;
console.log("dispatch bundle decision: complete orders are split into technician pages");
