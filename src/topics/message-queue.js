// Message queues: durable handoff between producers and consumers, with
// backpressure, retries, redelivery, idempotency, and dead-letter handling.

import { sequenceState, InputError } from '../core/state.js';

export const topic = {
  id: 'message-queue',
  title: 'Message Queues',
  category: 'Systems',
  summary: 'A durable buffer that lets producers and consumers run at different speeds while forcing the system to handle retries, duplicates, lag, and poison messages.',
  controls: [
    { id: 'scenario', label: 'Scenario', type: 'select', options: ['steady consumer', 'consumer crashes mid-job'], defaultValue: 'consumer crashes mid-job' },
  ],
  run,
};

// Orders arriving per tick from the checkout service, acting as the producer.
const ARRIVALS = [2, 3, 0, 2, 1];

export function* run(input) {
  const scenario = String(input.scenario);
  const crashy = scenario === 'consumer crashes mid-job';
  if (!['steady consumer', 'consumer crashes mid-job'].includes(scenario)) {
    throw new InputError('Pick a scenario.');
  }

  const queue = [];
  let produced = 0;
  let processed = 0;
  const snapshot = () => sequenceState('queue', queue);

  yield {
    state: snapshot(),
    highlight: {},
    explanation: 'The checkout service accepts orders quickly. The email or invoice worker may take much longer. If checkout calls the worker directly, the slow worker sets the pace and its outage can break the purchase flow. The queue changes the contract: checkout records work durably, returns to the customer, and lets consumers drain the work later.',
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
        explanation: `Tick ${tick}: checkout enqueues ${arriving} order${arriving === 1 ? '' : 's'} and returns after the broker accepts the messages. The queue absorbs the speed mismatch. A burst grows queue depth instead of forcing checkout to wait for every downstream side effect.`,
        invariant: 'Producer speed and consumer speed are decoupled; queue depth records the difference.',
      };
    }

    if (crashy && tick === 3 && !crashed) {
      crashed = true;
      yield {
        state: snapshot(),
        highlight: { swap: [queue[0].id] },
        explanation: `Tick ${tick}: the worker receives ${queue[0].value} and crashes before acknowledging it. The message is not deleted because the broker has not seen a successful ACK. After the visibility timeout or lease expires, that same message can be delivered again.`,
      };
      continue;
    }
    if (crashy && tick === 4) {
      yield {
        state: snapshot(),
        highlight: {},
        explanation: `Tick ${tick}: the consumer is still down. Producers can keep enqueuing, so the queue deepens to ${queue.length} waiting messages. This protects the checkout path, but only within capacity. Real systems alert on lag, cap backlog, shed low-priority work, or slow producers before the queue becomes unbounded debt.`,
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
          ? `Tick ${tick}: the worker restarts and receives ${msg.value} again. That is at-least-once delivery: the broker is protecting against loss, not promising that side effects run once. The consumer must use an idempotency key, processed-message table, unique constraint, or transactional outbox pattern before sending email, charging a card, or mutating state.`
          : `Tick ${tick}: the worker processes ${msg.value} and sends an ACK. Only after the ACK can the broker remove the message from the work queue. ${queue.length - 1} message${queue.length - 1 === 1 ? '' : 's'} remain buffered.`,
      };
      queue.shift();
      processed += 1;
    }
    if (produced === ARRIVALS.reduce((a, b) => a + b, 0) && queue.length === 0) break;
  }

  yield {
    state: snapshot(),
    highlight: {},
    explanation: `Drained: ${processed} orders processed and zero lost${crashy ? ', with one redelivery handled by consumer idempotency' : ''}. The shape to remember is not just FIFO. A production queue is durable storage plus delivery leases, acknowledgments, retry policy, idempotent consumers, lag monitoring, and dead-letter handling.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Each frame is one tick in a system with a producer and a consumer. A producer creates work, a broker stores it, and a consumer processes it later. Active messages were just enqueued, removed messages were acknowledged, and the swap highlight marks a message delivered to a worker that crashed before acknowledging it.',
        'An ACK is an acknowledgment, meaning the consumer has told the broker the message finished successfully. The safe inference rule is this: a broker may delete a message only after a successful ACK, so a crash before ACK must leave the message available for retry. Queue depth is the number of waiting messages, and it is the visible measure of speed mismatch.',
        {type: 'callout', text: 'A production queue is not just FIFO; it is a durable handoff contract around ACKs, retries, leases, and idempotency.'},
        {type: 'image', src: './assets/gifs/message-queue.gif', alt: 'Animated walkthrough of the message queue visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A web request often creates work that does not need to finish before the user gets a response. A checkout service may need to send email, reserve inventory, update search, notify analytics, and call a fraud service. If the request waits for every side effect, the slowest dependency controls user latency.',
        'A message queue changes the contract from "do this now" to "record this work durably and process it later." Durable means the broker keeps the message through crashes according to its persistence settings. The queue lets producers and consumers run at different speeds without pretending downstream failures disappear.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a direct function call or HTTP request from the producer to the consumer. It is simple, traceable, and gives the caller an immediate success or failure. It works when traffic is low and the consumer is fast and reliable.',
        'A second common approach is a jobs table in the application database. The producer inserts a row, workers poll for pending rows, and successful workers mark rows complete. This can work, but leases, retries, indexes, dead-letter handling, and concurrent workers quickly turn the table into an underspecified broker.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is failure between receive and completion. A worker can receive an email job, send the email, and crash before telling the broker it is done. The broker cannot know whether the side effect happened, so it must choose between possible duplicate work and possible lost work.',
        'Production queues usually choose at-least-once delivery, meaning a message is delivered one or more times until it is acknowledged. That protects against loss but creates duplicates. Consumers must be idempotent, meaning repeating the same message does not repeat the harmful side effect.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/52/Data_Queue.svg', alt: 'Queue diagram showing data entering and leaving in order', caption: 'The FIFO picture is only the starting shape; production brokers add durable storage and ACK state around it. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Data_Queue.svg.'},
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A queue is a durable handoff boundary. The producer only needs to know that the broker accepted the message, not that every downstream side effect finished. The consumer owns processing, acknowledgment, retry behavior, and duplicate safety.',
        'The invariant is that accepted work must be either safely stored or successfully acknowledged. A visibility timeout or lease hides a delivered message temporarily, but it does not delete the message. If the lease expires before ACK, the broker makes the message visible again.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A producer sends a message to the broker, and the broker writes it to durable storage before confirming acceptance. A consumer asks for work, receives a message, and gets a lease. During the lease, other consumers should not receive that same message from the same queue partition.',
        'If the consumer finishes, it sends an ACK and the broker removes or advances past the message. If the consumer fails, the lease expires and the message becomes eligible for redelivery. Retry policy controls how many times this can happen and when a poison message moves to a dead-letter queue.',
        'Log-based brokers use a related contract. Records append to partitions, consumers track offsets, and committed offsets say how far each consumer group has processed. Retention may keep records after processing so new consumers can replay history.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is about the ACK boundary. The broker does not delete work merely because it was delivered; it deletes or advances only after the consumer confirms success. Therefore a crash before ACK cannot silently remove the message from the system.',
        'Duplicates are the price of that guarantee. If the side effect happened but the ACK was lost, redelivery is the only safe broker behavior. Idempotency moves correctness to the consumer by using an order id, event id, unique constraint, processed-message table, or transactional outbox so repeated delivery produces one durable effect.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Enqueue and dequeue are usually O(1) per message from an algorithmic view. The real cost is behavior under load: disk writes for durability, network round trips for replication, coordination for consumer groups, and memory for in-flight messages. Queue depth grows whenever arrival rate exceeds service rate.',
        'If producers add 1,000 messages per second and consumers process 800 per second, backlog grows by 200 messages per second. After one minute, 12,000 messages are waiting. A queue absorbs the burst, but it cannot make the work disappear.',
        'Latency is shaped by depth and service rate. A queue with 10,000 waiting jobs and workers draining 500 jobs per second has about 20 seconds of waiting time before new work begins, ignoring job duration. This is why lag alerts and backpressure matter as much as push and pop.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/0/06/Queueing_node_service_digram.png', alt: 'Queueing node diagram with arrivals service positions and departures', caption: 'Queue depth and service rate decide latency once producers can outrun consumers. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Queueing_node_service_digram.png.'},
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Queues fit work that can happen after the caller moves on. Email delivery, invoice generation, webhook dispatch, thumbnail rendering, video transcoding, fraud review, search indexing, cache invalidation, and telemetry ingestion all have this shape. The access pattern is record work now, process later, and retry without losing accepted work.',
        'They also fit multi-step business processes where each step has a different owner and failure mode. A payment event can trigger fulfillment, accounting, notifications, and analytics through separate consumers. Each consumer can scale independently and fail without making the original checkout request wait.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/af/BPMN-AProcessWithNormalFlow.svg', alt: 'BPMN process diagram with tasks gateways events and data object', caption: 'Business workflows often become queued handoffs once each side effect needs its own retry and ownership boundary. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:BPMN-AProcessWithNormalFlow.svg.'},
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A queue is a poor fit when the caller needs the result immediately. If checkout cannot continue without a payment authorization, hiding the payment call behind asynchronous messaging only moves the error handling somewhere harder to reason about. Use queues for deferrable work, not for required answers.',
        'Queues also fail when backlog is treated as harmless. If consumers are permanently slower than producers, lag grows until storage fills, messages expire, or users see stale outcomes. The fix is to scale consumers, slow producers, shed low-value work, or change the product expectation.',
        'Poison messages need explicit handling. A malformed job that fails every retry can block ordered processing or waste capacity. Dead-letter queues, retry caps, jittered backoff, tracing, and replay tools are part of the system, not optional polish.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose checkout accepts 5 orders in one second and each receipt email takes 200 ms to send. One worker can process 5 emails per second, so the queue stays roughly flat at that rate. If a sale burst creates 25 orders in one second, the queue depth jumps by 20 after the worker handles its first 5.',
        'Now the worker receives order 17, sends the email, and crashes before ACK. After a 30-second visibility timeout, the broker redelivers order 17. Without idempotency, the customer gets a second receipt. With a processed_events table keyed by order_id and event_type, the worker sees the prior send and ACKs without sending again.',
        'The numbers show the tradeoff. The customer-facing checkout path may take 50 ms plus one broker write instead of waiting 200 ms for email. The system bought latency isolation, but it now must monitor backlog, handle duplicate delivery, and inspect dead-lettered jobs.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study the official Kafka documentation for partitions and offsets, Amazon SQS documentation for visibility timeouts, RabbitMQ documentation for acknowledgments and publisher confirms, and NATS JetStream documentation for explicit ACK modes. These systems differ in API and retention model, but they all make the ACK boundary explicit.',
        'Study Queue for FIFO mechanics, Write-Ahead Log for durable append semantics, Transactional Outbox for publishing events from a database, and Saga Pattern for multi-step workflows. Then study Dead Letter Queue, Rate Limiter, and Distributed Tracing because production messaging is mostly about failure behavior after the happy path works.',
      ],
    },
  ],
};
