import { getStore } from "@netlify/blobs";

// Polled by the browser with ?jobId=. Returns {status:"pending"} until the
// background function has written a {status:"done", resultDataUrl} or
// {status:"error", error}. Terminal results are deleted on read (one-shot).
export default async (req: Request) => {
  const jobId = new URL(req.url).searchParams.get("jobId") ?? "";
  if (!jobId) return Response.json({ error: "jobId is required." }, { status: 400 });

  const store = getStore("enhance-jobs");
  const job = (await store.get(jobId, { type: "json" })) as
    | { status: "done"; resultDataUrl: string }
    | { status: "error"; error: string }
    | null;

  if (!job) return Response.json({ status: "pending" });
  if (job.status === "done" || job.status === "error") {
    await store.delete(jobId);
  }
  return Response.json(job);
};
