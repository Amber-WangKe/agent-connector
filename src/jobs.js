import crypto from "node:crypto";

function jobId(now = new Date()) {
  const stamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `job-${stamp}-${crypto.randomBytes(4).toString("hex")}`;
}

export class JobQueue {
  constructor({ maxConcurrency, maxJobsPerUser, execute, onStarted, onFinished, now = () => new Date() }) {
    this.maxConcurrency = maxConcurrency;
    this.maxJobsPerUser = maxJobsPerUser;
    this.execute = execute;
    this.onStarted = onStarted || (() => {});
    this.onFinished = onFinished || (() => {});
    this.now = now;
    this.queue = [];
    this.active = new Map();
    this.jobs = new Map();
  }

  submit({ agentId, prompt, chatId, userId }) {
    const userActive = [...this.active.values()].filter((job) => job.userId === userId).length;
    const userQueued = this.queue.filter((job) => job.userId === userId).length;
    if (userActive + userQueued >= this.maxJobsPerUser) {
      throw new Error(`You already have ${userActive + userQueued} active job(s). Wait for one to finish.`);
    }

    const createdAt = this.now();
    const job = {
      id: jobId(createdAt),
      agentId,
      prompt,
      chatId,
      userId,
      status: "queued",
      createdAt: createdAt.toISOString(),
      startedAt: null,
      finishedAt: null,
      output: "",
      error: null,
    };
    this.queue.push(job);
    this.jobs.set(job.id, job);
    queueMicrotask(() => this.pump());
    return job;
  }

  get(id) {
    return this.jobs.get(id) || null;
  }

  stats() {
    return {
      queued: this.queue.length,
      running: this.active.size,
      total: this.jobs.size,
    };
  }

  pump() {
    while (this.active.size < this.maxConcurrency && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) return;
      this.active.set(job.id, job);
      this.run(job);
    }
  }

  async run(job) {
    job.status = "running";
    job.startedAt = this.now().toISOString();
    try {
      this.onStarted(job);
    } catch {
      // Notification failures must not prevent the job from running.
    }

    try {
      const result = await this.execute(job);
      job.output = String(result?.text || "");
      job.status = "succeeded";
    } catch (error) {
      job.error = error instanceof Error ? error.message : String(error);
      job.status = "failed";
    } finally {
      job.finishedAt = this.now().toISOString();
      this.active.delete(job.id);
      try {
        await this.onFinished(job);
      } catch {
        // The result remains queryable even when delivery fails.
      }
      this.pump();
    }
  }
}

export { jobId };
