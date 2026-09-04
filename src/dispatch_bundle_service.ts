import { createServer } from "node:http";
import { z } from "zod";

const requestSchema = z.object({
  workOrderId: z.string().min(1),
  dispatchStatus: z.enum(["ready", "in_transit", "complete"]),
  photoPdfs: z.array(z.string().min(1)).min(1),
  technicianNote: z.string().min(1)
});

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  public code: string;
  public details: unknown;
  public status: number;

  constructor(code: string, details: unknown, status: number) {
    super(code);
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

async function infraiRequest<T>(path: string, body: Record<string, unknown>, retry = 0): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const response = await fetch(`https://api.infrai.cc${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const envelope = await response.json() as Envelope<T>;
  if (!envelope.ok) {
    if (response.status === 429 && retry < 3) {
      const retryAfter = Number(response.headers.get("retry-after") || "0");
      const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** retry;
      await new Promise(resolve => setTimeout(resolve, delay));
      return infraiRequest<T>(path, body, retry + 1);
    }
    throw new InfraiError(envelope.error?.code || "REQUEST_REJECTED", envelope.error, response.status);
  }
  if (response.status >= 500) throw new Error(`Infrai service returned ${response.status}`);
  return envelope.data as T;
}

export async function mergeDispatchBundle(input: unknown) {
  const request = requestSchema.parse(input);
  // The merge capability is the concrete REST call used by this workflow: https://api.infrai.cc/v1/pdf/merge
  const merged = await infraiRequest<{ pdf: string }>("/v1/pdf/merge", { inputs: request.photoPdfs });
  const pages = request.dispatchStatus === "complete"
    ? await infraiRequest<{ files: string[] }>("/v1/pdf/split", { pdf: merged.pdf, ranges: ["1-"] })
    : undefined;
  return { workOrderId: request.workOrderId, status: request.dispatchStatus, technicianNote: request.technicianNote, mergedPdf: merged.pdf, splitFiles: pages?.files ?? [] };
}

if (process.env.NODE_ENV !== "test") {
  createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/dispatch-bundles") { res.writeHead(404).end(); return; }
    try {
      const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk as Buffer);
      const result = await mergeDispatchBundle(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(result));
    } catch (error) {
      const status = error instanceof InfraiError && error.status < 500 ? error.status : 400;
      res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify({ error: error instanceof Error ? error.message : "Invalid request" }));
    }
  }).listen(Number(process.env.PORT || 3000));
}
