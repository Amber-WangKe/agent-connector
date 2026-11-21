import test from "node:test";
import assert from "node:assert/strict";
import { JobQueue } from "../src/jobs.js";

test("queues jobs, limits concurrency and finishes asynchronously", async () => {
  const releases = [];
  const finished = [];
  const queue = new JobQueue({
    maxConcurrency: 1,
    maxJobsPerUser: 2,
    execute: (job) => new Promise((resolve) => {
      releases.push(() => resolve({ text: `done:${job.prompt}` }));
    }),
    onFinished: (job) => finished.push(job),
  });
  const first = queue.submit({ agentId: "a", prompt: "one", chatId: "c", userId: "u" });
  const second = queue.submit({ agentId: "a", prompt: "two", chatId: "c", userId: "u" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(queue.stats().running, 1);
  assert.equal(queue.stats().queued, 1);
  releases.shift()();
  await new Promise((resolve) => setTimeout(resolve, 10));
  releases.shift()();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(first.status, "succeeded");
  assert.equal(second.status, "succeeded");
  assert.equal(finished.length, 2);
});
