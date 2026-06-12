// Message queues: put a durable buffer between services that produce work
// and services that do it. Bursts get absorbed, crashes get survived —
// and one new question appears: what if a message arrives twice?

import { sequenceState, InputError } from '../core/state.js';

export const topic = {
  id: 'message-queue',
  title: 'Message Queues',
  category: 'Systems',
  summary: 'Producers rush, consumers plod, the queue absorbs the difference — plus the at-least-once catch.',
  controls: [
    { id: 'scenario', label: 'Scenario', type: 'select', options: ['steady consumer', 'consumer crashes mid-job'], defaultValue: 'consumer crashes mid-job' },
  ],
  run,
};

// orders arriving per tick from the checkout service (the producer)
const ARRIVALS = [2, 3, 0, 2, 1];

export function* run(input) {
  const crashy = String(input.scenario) === 'consumer crashes mid-job';
  if (!['steady consumer', 'consumer crashes mid-job'].includes(String(input.scenario))) {
    throw new InputError('Pick a scenario.');
  }

  const queue = [];
  let produced = 0;
  let processed = 0;
  const snapshot = () => sequenceState('queue', queue);

  yield {
    state: snapshot(),
    highlight: {},
    explanation: 'A checkout service takes orders in milliseconds; the email/invoice service behind it takes a full second per order. Wire them DIRECTLY and the slow one sets everyone\'s pace — checkout blocks, customers wait, a crash in emails fails the purchase. The fix is architectural: put a durable QUEUE between them, and let the two services stop knowing each other exists.',
  };

  let crashed = false;
  let redelivered = false;
  for (let tick = 1; tick <= ARRIVALS.length + 5; tick += 1) {
    const arriving = ARRIVALS[tick - 1] ?? 0;
    for (let a = 0; a < arriving; a += 1) {
      produced += 1;
      queue.push({ id: `m${produced}`, value: `o${produced}` });
    }
    if (arriving > 0) {
      yield {
        state: snapshot(),
        highlight: { active: queue.slice(-arriving).map((m) => m.id) },
        explanation: `Tick ${tick}: checkout enqueues ${arriving} order${arriving === 1 ? '' : 's'} and IMMEDIATELY returns success to the customer${tick === 2 ? ' — a burst of 3 at once, absorbed without anyone slowing down. The queue is the shock absorber' : ''}. The message is written durably first (a Write-Ahead Log (WAL) under the hood), so "enqueued" means "will not be lost".`,
        invariant: 'Producer speed and consumer speed are fully decoupled; the queue depth absorbs the difference.',
      };
    }

    // consumer side
    if (crashy && tick === 3 && !crashed) {
      crashed = true;
      yield {
        state: snapshot(),
        highlight: { swap: [queue[0].id] },
        explanation: `Tick ${tick}: the email service pulls ${queue[0].value}, starts working… and ⚡ CRASHES before sending its ACK. Watch what does NOT happen: the message is not lost. Unacknowledged messages stay owned by the queue — after a visibility timeout, ${queue[0].value} becomes deliverable again. The customer's order survived a consumer dying mid-job.`,
      };
      continue;
    }
    if (crashy && tick === 4) {
      yield {
        state: snapshot(),
        highlight: {},
        explanation: `Tick ${tick}: the consumer is still down; orders keep arriving and the queue simply deepens (${queue.length} waiting). Nothing fails, nothing blocks — this isolation is why an outage in one microservice doesn't cascade. (If the consumer stayed down for hours, BACKPRESSURE policies kick in: bound the queue, alert, shed load.)`,
      };
      continue;
    }
    if (queue.length > 0) {
      const msg = queue[0];
      const isRedelivery = crashy && msg.id === 'm3' && crashed && !redelivered;
      if (isRedelivery) redelivered = true;
      yield {
        state: snapshot(),
        highlight: { removed: [msg.id] },
        explanation: isRedelivery
          ? `Tick ${tick}: the consumer restarts and the queue REDELIVERS ${msg.value} — but the crashed worker might have already sent that email before dying! This is AT-LEAST-ONCE delivery: the queue guarantees "never lost", not "never duplicated". The consumer must be IDEMPOTENT — check an idempotency key ("did I already process m3?") before acting, the same discipline the Saga Pattern demands. ("Exactly-once" in practice = at-least-once + idempotent consumers.)`
          : `Tick ${tick}: the consumer pulls ${msg.value}, does its slow work, sends the ACK — only then is the message truly gone. ${queue.length - 1} left in the buffer.`,
      };
      queue.shift();
      processed += 1;
    }
    if (produced === ARRIVALS.reduce((a, b) => a + b, 0) && queue.length === 0) break;
  }

  yield {
    state: snapshot(),
    highlight: {},
    explanation: `Drained: ${processed} orders processed, zero lost${crashy ? ', one delivered twice — and handled, because the consumer checked before acting' : ''}. The shape to remember: a Queue made durable (Write-Ahead Log (WAL)) with delivery rules on top. Kafka IS this — an append-only log where consumers track their own offsets; RabbitMQ and SQS are the broker flavors. Queues are how Uber matches rides, how Stripe processes webhooks, and the backbone of the Saga Pattern's choreography — the data structure you met in week one, run as planetary infrastructure.`,
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A message queue is a durable handoff between producers and consumers. The producer records work, receives an acknowledgment that the broker has accepted it, and moves on. The consumer pulls or receives the message later, does the work, and acknowledges completion. That decoupling is the point: checkout should not wait for email, thumbnail rendering, fraud scoring, and warehouse sync to all finish inside one HTTP request.`,
        `The structure resembles a Queue, but production brokers add persistence, retries, ordering rules, visibility timeouts, dead-letter handling, and fan-out. SQS, RabbitMQ, Google Pub/Sub, NATS JetStream, and Kafka all solve versions of this problem. Some are task queues where a message disappears after acknowledgment; Kafka is closer to an append-only log where consumers track offsets and can replay history.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `A basic broker writes the message to durable storage, often through a Write-Ahead Log (WAL), before acknowledging the producer. A consumer receives the message and either ACKs success or lets the lease expire. In SQS the default visibility timeout is 30 seconds; if the consumer dies before ACK, the message becomes visible again. RabbitMQ uses acknowledgments and redelivery. Kafka stores records in partitions, and a consumer group commits offsets to mark progress.`,
        `Most queues default to at-least-once delivery: no lost messages if the broker is configured durably, but duplicates are possible. Consumers therefore need idempotency keys, transaction IDs, or unique constraints. A payment worker should record event_id before charging so a retry does not double charge. Ordering is also scoped. Kafka preserves order within one partition, not across every topic; SQS FIFO queues preserve order within a message group; higher throughput often means weaker global ordering.`,
        `Backpressure is explicit. If consumers lag, queue depth grows and end-to-end latency rises. Systems alert on lag, scale consumer groups, route through a Load Balancer, slow producers, or shed low-priority work. Poison messages that fail repeatedly go to dead-letter queues for inspection instead of blocking the hot path forever.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Enqueue and dequeue are usually O(1), but durability, replication, and network hops add milliseconds. Kafka scales by appending sequentially to partitions and letting consumers read in batches; RabbitMQ excels at flexible routing; SQS trades direct control for managed operations. The real cost is operational: monitor depth, lag, retry rate, dead-letter count, disk use, and Tail Latency & p99 Thinking for the user-visible workflow that depends on queued work.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Stripe-style webhooks, email delivery, video transcoding, search indexing, telemetry ingestion, and order fulfillment all use queues. A Saga Pattern often rides on events: reserve inventory, request payment, arrange shipment, compensate if a later step fails. Distributed Tracing becomes essential because one user action may cross five asynchronous workers over minutes. Cache Invalidation & Versioning frequently uses queues too: publish product_changed, let many cache holders invalidate or refresh independently.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The phrase exactly once is easy to overread. Kafka transactions can give exactly-once processing inside Kafka topics, but an email sent, card charged, or file written outside the broker still needs idempotency. A short visibility timeout creates duplicate work; a long one slows recovery. A queue is also not a database cache. If you need current state, store state in a database and use events to notify readers. Finally, retries need Rate Limiter (Token Bucket) behavior; otherwise a recovering dependency gets hit by every delayed retry at once.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Start with Queue for FIFO intuition and Write-Ahead Log (WAL) for durable appends. Then connect Saga Pattern, Distributed Tracing, and Cache Invalidation & Versioning to see how asynchronous systems stay understandable. Load Balancer and Rate Limiter (Token Bucket) explain how consumers scale and how retries avoid overwhelming dependencies.`,
      ],
    },
  ],
};
