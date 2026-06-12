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
      heading: 'What it is',
      paragraphs: [
        `A message queue is a durable buffer between two services that run at different speeds. A producer (like a checkout service) writes messages to the queue and returns immediately—customers don't wait for the slow backend. A consumer (like an email or payment processor) pulls messages at its own pace, processes them, and acknowledges success. The queue is not temporary RAM; it's backed by a Write-Ahead Log (WAL) so that messages survive power failures and crashes.`,
        `The second part of the contract is "at-least-once delivery": a message is never lost, but it *might arrive twice*. If a consumer crashes mid-job without sending an ACK, the message stays in the queue and is redelivered after a visibility timeout expires—usually seconds to minutes. Amazon SQS uses a 30-second default, but the timeout is configurable. This design trades duplicate risk for durability.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The producer calls enqueue() and gets an acknowledgment immediately, without waiting for processing. The message is written to disk (WAL) first, so "enqueued" means "will survive a power cut". Meanwhile the consumer polls the queue for available messages, pulls one, does the work, and sends an ACK. Once the queue receives the ACK, the message is deleted and never seen again. If the consumer crashes or the network breaks before sending the ACK, the message automatically becomes available again after the visibility timeout.`,
        `At-least-once delivery means your consumer must be idempotent: it must safely handle the same message arriving twice. The standard solution is an idempotency key—a unique ID in each message. Before processing, check if you've already seen that ID (via a cache or database row). Stripe webhooks require this; Kafka consumer offsets enforce it at the broker level. Kafka is a special case: instead of discarding messages after ACK, it's an append-only log where each consumer tracks its own read position (offset), so consumers can replay history and scale horizontally.`,
        `Backpressure handles outages. If a consumer stays down for hours and the queue grows unbounded, memory and latency explode. Production systems bound the queue depth, emit alerts when it reaches 80% capacity, and shed load (drop or reroute messages) if it fills. RabbitMQ and SQS both support dead-letter queues to catch messages that fail repeatedly, preventing poison messages from jamming the pipeline.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `A message queue adds latency (the time between "enqueued" and "processing starts") and durability overhead (writing to disk costs I/O). For high-throughput systems, this cost is worth it: Kafka handles millions of messages per second across distributed clusters. For small systems, the complexity of setting up a broker (Kafka, RabbitMQ, SQS) may outweigh the benefit; you might inline the queue in your application or use a simpler async mechanism. The real cost is operational: you now have to monitor queue depth, tune visibility timeouts, and handle the mental model that "sent" no longer means "done".`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Uber uses message queues to match ride requests (producer) with available drivers (consumer). Stripe uses them to retry webhooks that fail; each webhook delivery is an idempotent event with a unique event ID so that duplicate deliveries don't double-charge customers. Microservices communicate via queues to isolate failures: if the payment service crashes, orders keep arriving and waiting; the purchase never fails in the customer's hands. Saga Pattern choreography (distributed transactions across services) is built on reliable message delivery—each service publishes events, others subscribe, and idempotency keys ensure that replayed messages don't create duplicate ledger entries.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Misconception: "Exactly-once delivery exists." It doesn't. Every major system—Kafka, SQS, RabbitMQ—offers at-least-once by default. Exactly-once requires consumer idempotence AND broker coordination; it's expensive and only matters for financial transactions. Pitfall: setting the visibility timeout too short (consumer crashes and the message redelivers before the crash is even detected) or too long (outages cause long delays). Pitfall: treating the queue as a cache instead of a durable inbox; if you don't ACK, the message never leaves, and your consumer must be prepared to see the same message on restart. Pitfall: not monitoring queue depth—an outage in one service silently fills the queue until disk is full and the broker dies.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Read Queue to understand the underlying FIFO data structure. Read Write-Ahead Log (WAL) to see how durability is actually enforced. Read Saga Pattern to see how queues choreograph transactions across services. Read Load Balancer to understand how multiple consumers pull from the same queue in parallel (consumer groups in Kafka). Read Rate Limiter (Token Bucket) to understand backpressure and how to prevent a queue from overflowing during spikes.`,
      ],
    },
  ],
};

