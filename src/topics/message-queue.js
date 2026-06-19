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
        'Each frame is one tick of a system with a producer (checkout service) and a consumer (email/invoice worker). Active highlights show messages just enqueued. Removed highlights show the message being processed and ACKed. Swap highlights mark a delivery that failed mid-processing.',
        'Watch queue depth: it rises when producers outpace consumers and falls when consumers catch up. The gap between the two rates is the backlog, and backlog is the core quantity a message queue manages.',
        'In the crash scenario, a message is received but never acknowledged. The broker holds it, then redelivers it on the next consumer attempt. That redelivery frame is the most important one: it shows at-least-once semantics in action and surfaces the idempotency requirement that every production consumer must handle.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A checkout service accepts an order in 50 ms. Sending a receipt email takes 200 ms. Generating an invoice PDF takes 500 ms. Updating a search index takes 300 ms. Running fraud scoring takes 400 ms. If checkout calls each of these synchronously, the customer waits 1,450 ms and any single failure breaks the purchase.',
        'These downstream jobs have different latency profiles, failure modes, and scaling needs. Coupling them to the request path means the slowest, flakiest dependency sets the pace and reliability ceiling for the entire flow.',
        'A message queue breaks that coupling. The producer writes work to a durable broker and returns immediately. Consumers drain the work at their own speed, retry on their own schedule, and scale independently. The queue converts a synchronous chain of dependencies into stored work with delivery guarantees.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is a direct HTTP call or function invocation from producer to consumer. It works when traffic is low, the consumer is fast, and neither side ever crashes. Many early systems run this way for months without trouble.',
        'When the consumer slows down, deploys, rate-limits, or crashes, the producer inherits every downstream problem. A 500 from the email service means checkout either retries (blocking the customer) or drops the email (losing work). Neither is acceptable.',
        'A second reasonable attempt is a jobs table in the application database: INSERT a row, poll it from a worker, DELETE after processing. This works at low scale but quickly needs leases, retry counts, visibility windows, indexes on status columns, dead-letter handling, and concurrency control. At that point the team is building a broker inside a database.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that asynchronous work is not just a FIFO data structure. Production messaging requires durability (the message survives broker restarts), acknowledgment (the message is removed only after the consumer confirms success), redelivery (failed processing causes automatic retry), backpressure (producers slow down or messages are rejected when the queue fills), ordering guarantees (scoped to a partition, group, or queue), and dead-letter handling (poison messages are isolated instead of blocking the stream).',
        'A textbook queue gives you push and pop. A production message broker gives you a durable log, delivery leases, consumer group coordination, offset management, retention policies, schema evolution, and observability hooks. The gap between the two is where real systems fail.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A producer sends a message to a broker. The broker writes it to durable storage (disk, replicated log, or managed storage) before confirming acceptance. Until the broker acknowledges the write, the producer must assume the message may be lost.',
        'In a task-queue model (SQS, RabbitMQ), the broker delivers a message to one consumer and starts a visibility timeout. The message is hidden from other consumers during this window. If the consumer finishes and sends an ACK, the broker deletes the message. If the consumer crashes or the timeout expires, the broker makes the message visible again for redelivery.',
        'In a log model (Kafka, Redpanda, Redis Streams), records are appended to partitions. Consumers track offsets: a committed offset marks the last successfully processed record. The record is not deleted per consumer; retention policy governs cleanup. Consumer groups coordinate which members read which partitions, and rebalancing reassigns partitions when members join or leave.',
        'SQS visibility timeout defaults to 30 seconds. Kafka consumer group rebalance triggers when a member misses heartbeats for session.timeout.ms (default 45 seconds). RabbitMQ uses explicit ACK/NACK per message with optional prefetch limits. NATS JetStream uses explicit ack with configurable ack-wait. Each system scopes its guarantees differently, but the contract is the same: the broker holds the message until the consumer proves it is done.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness invariant is: a message is either durably stored in the broker or successfully processed by a consumer. It is never in neither state (lost) unless the system is configured for at-most-once delivery. The broker maintains this invariant by treating the ACK as the commit boundary: no ACK means the message stays in the system.',
        'Durability comes from writing before confirming. The producer sees a confirmation only after the broker has persisted the message. If the broker crashes after persisting but before the consumer reads, the message survives. If the broker crashes before persisting, the producer never received confirmation and can retry.',
        'Redelivery preserves the invariant after consumer failure. The consumer received the message but did not ACK. The broker does not know whether the consumer processed it, partially processed it, or never started. It redelivers, which may cause duplicate processing. This is at-least-once delivery: the system chooses possible duplication over possible loss.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Enqueue and dequeue are O(1) per message in both task-queue and log-based systems. Kafka appends to a partition log sequentially; SQS and RabbitMQ route to a queue. The dominant cost is not algorithmic but operational: disk I/O for durability, network round-trips for replication, and coordination overhead for consumer groups.',
        'Kafka brokers on commodity hardware sustain 200 MB/s per broker with 3x replication. A single SQS standard queue handles nearly unlimited throughput (AWS does not publish a hard cap but documents millions of messages per second across partitions). RabbitMQ handles roughly 20,000-50,000 messages per second per queue depending on message size, persistence, and acknowledgment mode.',
        'Memory cost scales with in-flight messages for task queues and with retained log size for Kafka. Kafka retention is typically time-based (7 days default) or size-based. SQS retains messages for up to 14 days. The operational surface includes broker monitoring, consumer lag alerting, partition rebalancing, schema registry management, and dead-letter queue inspection.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Queues win when work can happen later, when producers and consumers scale independently, when bursts are normal, and when downstream dependencies fail independently. The access pattern is: record work now, process reliably later, never lose accepted work.',
        'Email delivery, webhook dispatch, thumbnail generation, video transcoding, fraud scoring, search indexing, telemetry ingestion, order fulfillment, cache invalidation, and saga choreography across microservices all fit this pattern. Each involves a producer that should not wait for the side effect and a consumer whose failure should not propagate upstream.',
        'Kafka specifically wins for event sourcing, change data capture, and stream processing where consumers need to replay history. Its log retention means a new consumer can start from the beginning and rebuild derived state. SQS wins for serverless fan-out with Lambda triggers. RabbitMQ wins for complex routing topologies with exchanges, bindings, and per-queue policies. NATS wins for low-latency pub-sub with optional persistence via JetStream.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A queue absorbs bursts but does not erase work. If consumers stay slower than producers, queue depth grows without bound and end-to-end latency rises until the system either scales consumers, sheds load, or accepts that processing is hours behind.',
        'Poison messages fail every time they are processed. Without a max-retry policy and dead-letter queue, one malformed message can block an ordered partition or burn consumer cycles indefinitely. Every production queue needs a dead-letter path.',
        'Retry storms hit when a dependency recovers and thousands of backed-up retries arrive simultaneously. Exponential backoff with jitter, rate-limited retry queues, and circuit breakers are required to prevent the recovered dependency from immediately failing again under the retry surge.',
        'A queue is not a database. It cannot answer "what is the current state of order 12345?" Store state in a database and use the queue to propagate events. A queue is also the wrong tool when the caller genuinely needs the result before continuing: asynchronous messaging only hides latency while making error handling harder.',
        'Queues add operational surface: broker availability, disk provisioning, retention tuning, partition management, consumer lag monitoring, replay policy, schema compatibility, dead-letter inspection, and distributed tracing. Use them when decoupling is worth that surface.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An e-commerce checkout service enqueues an order_created event. Three independent consumers subscribe: an email worker sends a receipt, a fulfillment worker reserves inventory, and a search worker updates the product index. The producer returns a 200 to the customer after the broker acknowledges the event. Total customer-facing latency: 50 ms plus one broker round-trip, regardless of downstream processing time.',
        'The email worker picks up order_created, renders the receipt template, and calls the SMTP relay. The relay accepts the email. The worker sends an ACK to the broker. The broker deletes the message. Elapsed: 200 ms, invisible to the customer.',
        'Now the email worker crashes after sending the email but before sending the ACK. The broker does not know the email was sent. After the visibility timeout expires, it redelivers order_created to the same or a different worker instance. Without idempotency, the customer receives two receipts.',
        'The fix: the email worker maintains a processed_events table with a unique constraint on (order_id, event_type). Before sending the email, it checks the table. If the row exists, the email was already sent; the worker ACKs without resending. If the row does not exist, it inserts the row and sends the email in a transaction (or uses a transactional outbox). This is at-least-once delivery plus idempotent consumers, which is how production systems achieve effectively-once behavior.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Kafka documentation describes topics as partitioned append-only logs with consumer offsets tracking progress: https://kafka.apache.org/documentation/. Amazon SQS documents visibility timeout and at-least-once delivery semantics: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html. RabbitMQ documents acknowledgments and publisher confirms: https://www.rabbitmq.com/docs/confirms. NATS JetStream documents persistent streaming with explicit ack modes: https://docs.nats.io/nats-concepts/jetstream.',
        'Prerequisite: study Queue for FIFO mechanics and Write-Ahead Log for durable append semantics. Extension: study Transactional Outbox for reliable event publishing from a database, Saga Pattern for multi-step workflows across services, and Kafka Log Compaction for building materialized views from event streams. Alternative: study gRPC streaming or server-sent events for cases where synchronous push is a better fit than store-and-forward. Operations: study Dead Letter Queue patterns, Distributed Tracing for following messages across services, and Rate Limiter for protecting consumers from retry storms.',
      ],
    },
  ],
};
