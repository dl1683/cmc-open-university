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
      heading: 'Why message queues exist',
      paragraphs: [
        'A message queue is a durable handoff between a service that produces work and a service that performs it later. The producer writes a message, receives confirmation that the broker accepted it, and moves on. The consumer receives the message, does the work, and acknowledges completion.',
        'The purpose is decoupling. Checkout should not wait for email, invoice generation, fraud scoring, search indexing, warehouse sync, and analytics delivery to finish inside the customer request. Those jobs have different latency profiles, failure modes, and scaling needs.',
        'The queue turns direct coordination into stored work. That is powerful, but it creates new questions: how durable is the write, how many consumers may receive the same message, how ordering is defined, how lag is handled, and what happens to messages that fail forever.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is a direct function call or HTTP request from producer to consumer. It is simple until the consumer slows down, crashes, deploys, rate-limits, or has to process a burst. Then the producer inherits every downstream problem.',
        'A second naive approach is to store work in a database table and poll it. That can be good enough for small systems, but it quickly needs leases, retry counts, indexes, cleanup, concurrency control, dead-letter handling, and visibility rules. At that point the system is rebuilding a broker.',
        'The wall is that asynchronous work is not just a queue data structure from a textbook. Production messaging is FIFO plus durability, acknowledgement, redelivery, backpressure, monitoring, and idempotency.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the steady-consumer scenario, watch queue depth. New messages enter faster than the worker can sometimes drain them, so the queue becomes a buffer between producer speed and consumer speed. That is the main architectural benefit.',
        'In the crash scenario, focus on the ACK. Receiving a message is not the same as completing it. The message should disappear only after the consumer acknowledges success. If the worker dies first, the broker can make the message visible again.',
        'The redelivery frame is the key teaching moment. A queue can protect against loss while still delivering duplicates. The correct response is not to hope duplicates never happen; it is to design consumers so duplicate delivery is safe.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A producer sends a message to a broker. A durable broker writes the message before confirming acceptance. Depending on the system, that write may land in a log, replicated segment, or managed storage layer.',
        'A consumer receives a message under some delivery contract. In a task queue, the broker may hide the message for a visibility timeout while the consumer works. If the consumer acknowledges success, the broker removes it. If the consumer crashes or the timeout expires, the broker can deliver it again.',
        'Kafka has a different shape: records are appended to partitions, and consumers track offsets. The record is not removed for one consumer. Consumer groups coordinate which members read which partitions, and committed offsets describe progress.',
      ],
    },
    {
      heading: 'Delivery guarantees',
      paragraphs: [
        'At-most-once delivery means a message may be lost, but it should not be delivered twice. That is rarely acceptable for important business work.',
        'At-least-once delivery means the broker tries not to lose accepted messages, but duplicates can happen. This is the common default because it is usually better to repeat work than to lose it.',
        'Exactly-once is often narrower than it sounds. Kafka transactions can provide exactly-once processing within Kafka under specific conditions, but an external side effect like sending email, charging a card, or writing to a third-party API still needs idempotency. In practical service design, exactly-once behavior usually means at-least-once delivery plus idempotent side effects.',
      ],
    },
    {
      heading: 'Ordering and scaling',
      paragraphs: [
        'Queues make ordering a scoped promise. A single FIFO queue can preserve order but limits parallelism. Kafka preserves order within a partition, not across a whole topic. SQS FIFO queues preserve order within a message group. RabbitMQ ordering can be affected by acknowledgments, redelivery, and multiple consumers.',
        'Scaling consumers often means weakening global order. If ten workers process one queue, faster jobs may finish before older slower jobs. If strict order matters, partition by a key such as account_id or order_id so all related messages go through the same ordered lane.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An order service enqueues order_created. An email worker sends a receipt. A fulfillment worker reserves inventory. A search worker updates an index. The producer does not wait for all of them; it only needs to know that the event or command was accepted durably.',
        'Now the email worker crashes after sending the email but before acknowledging the message. The broker redelivers it. Without idempotency, the customer gets two receipts. With an idempotency table keyed by message_id or order_id plus side_effect_type, the worker sees the email was already sent and ACKs without repeating the side effect.',
      ],
    },
    {
      heading: 'Backpressure and failure modes',
      paragraphs: [
        'A queue can absorb bursts, but it does not erase work. If consumers stay slower than producers, queue depth grows and latency rises. Eventually the system must scale consumers, slow producers, reject low-priority work, or accept stale processing.',
        'Poison messages are messages that fail every time. Without a policy, one bad message can burn retries forever or block an ordered lane. Dead-letter queues exist so repeated failures can be isolated, inspected, and repaired without stopping the whole stream.',
        'Retry storms are another failure mode. When a dependency recovers, thousands of delayed retries can arrive at once. Good systems use exponential backoff, jitter, rate limits, and circuit breakers rather than retrying everything immediately.',
      ],
    },
    {
      heading: 'Where queues win',
      paragraphs: [
        'Queues win when work can happen later, when producers and consumers scale independently, when bursts are normal, when downstream dependencies fail independently, or when a workflow needs replayable steps.',
        'Common uses include email delivery, webhooks, thumbnail generation, video transcoding, fraud scoring, search indexing, telemetry ingestion, order fulfillment, cache invalidation, and saga choreography across services.',
      ],
    },
    {
      heading: 'Where queues are the wrong tool',
      paragraphs: [
        'A queue is not a substitute for a database when readers need current state. Store state in a database, then publish events to notify other systems. Do not ask a queue to answer "what is true right now?"',
        'A queue is also a poor fit when the caller genuinely needs the result before it can continue. In that case asynchronous messaging may only hide latency while making error handling harder.',
        'Finally, queues add operational surface: broker availability, disk, retention, partitioning, consumer lag, replay policy, schema compatibility, dead-letter handling, and tracing. Use them when decoupling is worth that surface.',
      ],
    },
    {
      heading: 'Sources and broker details',
      paragraphs: [
        'Kafka documentation describes topics as partitioned logs and explains that consumers of a topic-partition read events in the order written: https://kafka.apache.org/documentation/. Kafka implementation notes describe consumer offsets as the mechanism that lets a consumer resume from a committed position after restart: https://kafka.apache.org/22/implementation/distribution/.',
        'Amazon SQS documents visibility timeout as the interval during which a received message is hidden from other consumers; if it is not deleted before the timeout expires, it can be received again: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html. SQS also documents standard queues as at-least-once delivery: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html. RabbitMQ acknowledgements and publisher confirms cover the broker-side handshake between publishing, delivery, processing, and acknowledgement: https://www.rabbitmq.com/docs/confirms.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Start with Queue for FIFO intuition and Write-Ahead Log for durable appends. Then study Transactional Outbox, Saga Pattern, Distributed Tracing, Cache Invalidation & Versioning, Load Balancer, Rate Limiter, Kafka Log Compaction, and Dead Letter Queue patterns. Together they explain how asynchronous systems stay reliable instead of merely delayed.',
      ],
    },
  ],
};
