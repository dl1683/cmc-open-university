// Idempotency: exactly-once DELIVERY is provably impossible over a lossy
// network, but exactly-once EFFECT is an engineering problem with a clean
// answer — at-least-once retries plus a dedup key. Watch both halves live.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'idempotency',
  title: 'Idempotency & Exactly-Once Delivery',
  category: 'Systems',
  summary: 'Why no protocol can deliver a message exactly once — and how an idempotency key turns retries from double-charges into safety.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['why exactly-once is impossible', 'idempotency keys'], defaultValue: 'why exactly-once is impossible' },
  ],
  run,
};

// Six $50 charge requests over a deterministic lossy channel: every 4th
// network crossing drops a request, every 5th drops an ack. The simulation
// is identical for all three strategies — only the policy changes.
const REQUESTS = 6;
function simulate({ retry, dedup }) {
  let crossing = 0;
  const seen = new Set();
  const rows = [];
  for (let r = 1; r <= REQUESTS; r++) {
    let attempts = 0;
    let charges = 0;
    let acked = false;
    let replayed = false;
    while (!acked && attempts < (retry ? 5 : 1)) {
      attempts++;
      crossing++;
      if (crossing % 4 === 1) continue; // request lost in flight
      if (dedup && seen.has(r)) replayed = true; // key found: return saved response
      else { charges++; seen.add(r); }
      crossing++;
      if (crossing % 5 === 3) continue; // ack lost on the way back
      acked = true;
    }
    rows.push({ r, attempts, charges, acked, replayed });
  }
  return rows;
}
const AT_MOST_ONCE = simulate({ retry: false, dedup: false });
const AT_LEAST_ONCE = simulate({ retry: true, dedup: false });
const WITH_KEYS = simulate({ retry: true, dedup: true });
const sum = (rows, f) => rows.reduce((s, x) => s + f(x), 0);
const LOST = AT_MOST_ONCE.filter((x) => !x.acked && x.charges === 0).length;
const SILENT = AT_MOST_ONCE.filter((x) => !x.acked && x.charges === 1).length;
const DOUBLE = AT_LEAST_ONCE.filter((x) => x.charges > 1).length;

const simMatrix = (title, rows) => matrixState({
  title,
  rows: rows.map((x) => ({ id: `r${x.r}`, label: `charge #${x.r} ($50)` })),
  columns: [
    { id: 'tries', label: 'attempts' },
    { id: 'charged', label: 'times charged' },
    { id: 'knows', label: 'client got ack?' },
  ],
  values: rows.map((x) => [x.attempts, x.charges, x.acked ? 1 : 0]),
  format: (v) => String(v),
});

function* impossible() {
  yield {
    state: matrixState({
      title: 'You sent "charge $50". No response came back. Choose.',
      rows: [
        { id: 'world1', label: 'world 1: the REQUEST was lost' },
        { id: 'world2', label: 'world 2: only the RESPONSE was lost' },
        { id: 'you', label: 'you, who cannot tell which world this is' },
      ],
      columns: [{ id: 'retry', label: 'if you retry' }, { id: 'stop', label: 'if you don\'t' }],
      values: [[1, 2], [3, 4], [5, 6]],
      format: (v) => ['', 'correct: the charge finally lands', 'customer never charged, order lost', 'DOUBLE CHARGE', 'correct: it already landed', 'gamble', 'gamble'][v],
    }),
    highlight: { compare: ['world1:stop', 'world2:retry'] },
    explanation: 'The whole problem in one table. You sent a $50 charge and the response never came. In world 1 the request died in flight — retrying is correct, stopping loses the sale. In world 2 the charge LANDED and only the ack died — stopping is correct, retrying double-charges. The cruelty: both worlds look IDENTICAL from where you sit (silence), and no number of extra confirmation messages fixes it, because the last message can always be the one that dies — the Two Generals argument, proved impossible in 1975. Every system that talks over a network — Message Queues, payment APIs, Retries, Backoff & Jitter — lives inside this table.',
    invariant: 'Silence is ambiguous: lost-request and lost-ack are indistinguishable to the sender, and no protocol can split them.',
  };

  yield {
    state: simMatrix(`At-most-once: fire and forget (${sum(AT_MOST_ONCE, (x) => x.charges)} of ${REQUESTS} charged)`, AT_MOST_ONCE),
    highlight: { removed: AT_MOST_ONCE.filter((x) => x.charges === 0).map((x) => `r${x.r}:charged`) },
    explanation: `Strategy one: never retry. Six charges sent through a lossy network (this page simulates one deterministically: every 4th crossing eats a request, every 5th eats an ack). Result, computed live: ${LOST} ${LOST === 1 ? 'request dies' : 'requests die'} in flight and ${LOST === 1 ? 'is' : 'are'} simply never charged — revenue silently gone. Worse, ${SILENT} ${SILENT === 1 ? 'charge DID land' : 'charges DID land'} but the ack died, so the client doesn't know it succeeded. At-most-once is honest about one thing: it never duplicates. It just loses instead. UDP works this way; so does any metrics pipeline that decides a dropped data point is cheaper than a stalled one.`,
    invariant: 'At-most-once: duplicates impossible, loss guaranteed eventually — every drop is a permanent gap.',
  };

  yield {
    state: simMatrix(`At-least-once: retry until acked (${sum(AT_LEAST_ONCE, (x) => x.charges)} charges for ${REQUESTS} requests)`, AT_LEAST_ONCE),
    highlight: { active: AT_LEAST_ONCE.filter((x) => x.charges > 1).map((x) => `r${x.r}:charged`) },
    explanation: `Strategy two: retry until the ack arrives. Same lossy network, same six requests — now every one eventually completes. But read the charged column: ${DOUBLE} ${DOUBLE === 1 ? 'customer' : 'customers'} got charged TWICE, ${sum(AT_LEAST_ONCE, (x) => x.charges)} total charges for ${REQUESTS} requests. The double-charges are exactly the lost-ack cases from the first step: the server applied the charge, the ack died, the client retried in good faith, and the server — which has no memory of request identity — obediently charged again. Retrying didn't create the ambiguity; it just converted "maybe lost" into "maybe duplicated". This is the default behavior of every queue that redelivers: SQS standard, Kafka consumers after a crash, RabbitMQ requeues.`,
    invariant: 'At-least-once: loss impossible, duplicates guaranteed eventually — every lost ack becomes a replay.',
  };

  yield {
    state: matrixState({
      title: 'The delivery-guarantee menu (one row is a lie)',
      rows: [
        { id: 'amo', label: 'at-most-once' },
        { id: 'alo', label: 'at-least-once' },
        { id: 'eo', label: 'exactly-once DELIVERY' },
        { id: 'ee', label: 'exactly-once EFFECT' },
      ],
      columns: [{ id: 'how', label: 'how' }, { id: 'verdict', label: 'verdict' }],
      values: [[1, 2], [3, 4], [5, 6], [7, 8]],
      format: (v) => ['', 'send once, hope', 'real: loses messages', 'retry until acked', 'real: duplicates messages', 'a protocol where every message arrives once', 'IMPOSSIBLE over a lossy network', 'at-least-once + receiver remembers what it processed', 'real: the actual engineering target'][v],
    }),
    highlight: { removed: ['eo:verdict'], found: ['ee:verdict'] },
    explanation: 'The menu, stated honestly. Exactly-once DELIVERY — a network protocol where each message arrives precisely once — is impossible, full stop; any vendor page claiming it is compressing the truth. But notice what the duplicate problem actually requires: not that the message arrives once, only that its EFFECT happens once. That moves the problem from the channel (unsolvable) to the receiver (solvable with memory): deliver at-least-once, then make the receiver recognize replays and refuse to repeat the work. The industry name is "effectively once," and building it is the entire second view of this page.',
    invariant: 'Move the goal from the channel to the state: delivery can\'t be deduplicated, but effects can.',
  };
}

function* keys() {
  yield {
    state: simMatrix(`Same lossy network, plus an idempotency key (${sum(WITH_KEYS, (x) => x.charges)} charges for ${REQUESTS} requests)`, WITH_KEYS),
    highlight: { found: WITH_KEYS.map((x) => `r${x.r}:charged`) },
    explanation: `The fix, running live on the identical drop pattern: the client attaches a unique IDEMPOTENCY KEY to each logical charge (a UUID minted once, reused verbatim on every retry of that charge), and the server keeps a table of keys it has processed. First arrival of a key: do the work, store the result under the key, ack. A replay — same key again after a lost ack: do NOTHING, return the SAVED response. Every charged cell now reads exactly 1 — ${REQUESTS} charges for ${REQUESTS} requests, retries and all. Note the subtlety: the replay must return the original result, not re-execute and not error, so the client can't tell a replay from a first success — that indistinguishability is the feature.`,
    invariant: 'Key seen before â‡’ return stored response, touch nothing: retries become reads.',
  };

  yield {
    state: matrixState({
      title: 'Some operations are born idempotent',
      rows: [
        { id: 'set', label: 'SET balance = 70' },
        { id: 'inc', label: 'INCREMENT balance BY 50' },
        { id: 'del', label: 'DELETE order 123' },
        { id: 'put', label: 'HTTP PUT (replace resource)' },
        { id: 'post', label: 'HTTP POST (create resource)' },
      ],
      columns: [{ id: 'twice', label: 'applied twice?' }],
      values: [[1], [2], [3], [4], [5]],
      format: (v) => ['', 'same state — naturally idempotent', 'balance off by 50 — needs a key', 'second delete is a no-op — idempotent', 'spec-guaranteed idempotent; retry freely', 'two resources created — the reason POST + retry needs a key'][v],
    }),
    highlight: { active: ['set:twice'], removed: ['inc:twice', 'post:twice'] },
    explanation: 'Before reaching for key infrastructure, check whether the operation is ALREADY idempotent — applying it twice lands in the same state as once. Absolute writes (SET x = 70) and deletes are; relative updates (INCREMENT BY 50) and creations are not. HTTP bakes this into its verbs: GET, PUT, and DELETE are specified idempotent — proxies and clients retry them automatically — while POST is not, which is exactly why Stripe makes you send an Idempotency-Key header on POST. And this is the same algebra CRDTs: Conflict-Free Replicated Data Types build on: a G-counter\'s merge is idempotent BY DESIGN (max(a, a) = a) precisely so that re-delivered gossip is harmless. Designing the operation idempotent beats deduplicating it.',
    invariant: 'Idempotent: f(f(x)) = f(x). Absolute writes qualify; relative updates need a key to fake it.',
  };

  yield {
    state: matrixState({
      title: 'One charge, three systems: where dedup must live',
      rows: [
        { id: 'db', label: '1 Â· debit the account (DB transaction)' },
        { id: 'outbox', label: '2 Â· write "charge succeeded" event to OUTBOX table — same transaction' },
        { id: 'relay', label: '3 Â· relay publishes outbox rows to the queue, at-least-once' },
        { id: 'consumer', label: '4 Â· email service consumes, dedups by event id' },
      ],
      columns: [{ id: 'why', label: 'why this step exists' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'the business effect, exactly once via the key table', 'atomic with the debit: if the debit committed, the event EXISTS — no dual-write gap', 'crash-safe: re-publishing a row is fine, downstream dedups', 'the event id is the idempotency key, one hop later'][v],
    }),
    highlight: { active: ['outbox:why'] },
    explanation: 'Real systems chain effects — debit the account AND publish an event AND send an email — and a crash between any two creates the dual-write problem: database says charged, queue never heard. The TRANSACTIONAL OUTBOX closes the gap: write the event into an outbox table inside the same database transaction as the debit (atomic by Transaction Isolation Levels), then let a relay publish it to the queue at-least-once. Every hop downstream dedups on the event id, so each stage is effectively-once even though every channel between stages is at-least-once. Exactly-once effect is not one mechanism — it is the same key trick applied at every boundary.',
    invariant: 'Atomic write of effect + event, then at-least-once relay + dedup per hop: each stage effectively-once.',
  };

  yield {
    state: matrixState({
      title: 'Production dedup, and the fine print',
      rows: [
        { id: 'stripe', label: 'Stripe Idempotency-Key' },
        { id: 'kafka', label: 'Kafka EOS' },
        { id: 'sqs', label: 'SQS FIFO' },
        { id: 'ttl', label: 'the fine print: keys expire' },
      ],
      columns: [{ id: 'detail', label: 'mechanism' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'header on POST; result replayed for 24h per key', 'idempotent producer (sequence numbers) + transactions across partitions', 'MessageDeduplicationId, 5-minute window', 'dedup memory is finite: a replay AFTER the window is a fresh request again'][v],
    }),
    highlight: { removed: ['ttl:detail'] },
    explanation: 'The production landscape. Stripe stores each key\'s response for 24 hours and replays it verbatim. Kafka\'s "exactly-once semantics" is at-least-once delivery plus producer sequence numbers and transactions — effectively-once processing within the Kafka ecosystem, branded with the impossible name. SQS FIFO dedups by id over a 5-minute window. Read the windows again: ALL dedup memory is finite, because remembering every key forever is an unbounded set. A retry that arrives after the window looks brand-new — so timeouts and retry budgets (Retries, Backoff & Jitter) must be tuned to finish well inside the dedup window, or the safety silently evaporates. Effectively-once is a contract between retry policy and dedup TTL, not a property either side owns alone.',
    invariant: 'Dedup windows are finite: effectively-once holds only while retries land inside the key\'s lifetime.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'why exactly-once is impossible') yield* impossible();
  else if (view === 'idempotency keys') yield* keys();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Idempotency & Exactly-Once Delivery. Why no protocol can deliver a message exactly once — and how an idempotency key turns retries from double-charges into safety..",
        {type: "callout", text: "Retry safety comes from remembered operation identity, not from a perfect network."},
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: `Why this exists`,
      paragraphs: [
        `Distributed systems spend a surprising amount of effort on a simple question: if a client sends a request and hears nothing, what should it do next? The missing response could mean the request never reached the server. It could also mean the server performed the work and only the response was lost. From the client side those two worlds look the same. Silence contains no proof.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif`, alt: `Animated packet switching diagram with packets moving through shared links`, caption: `Packet-switched networks make retries unavoidable: packets and acknowledgements can vanish independently of the operation they represent. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Packet_Switching.gif`},
        `Idempotency exists because most useful systems must retry. Networks drop packets, load balancers close connections, workers crash after committing data, and queues redeliver messages when a consumer dies before acknowledging. If the operation is harmless when repeated, retries are a tool. If the operation creates money movement, inventory reservation, account creation, or email delivery, retries can turn one intended effect into two real effects.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `The first naive policy is at-most-once: send the request once and never retry. That avoids duplicates, but it accepts permanent loss. A payment request can disappear in flight. A queue message can be dropped after a worker crash. A background sync can fail while the user has already moved on. At-most-once is reasonable for metrics, telemetry, or any signal where loss is cheaper than delay, but it is not acceptable for business effects that must eventually happen.`,
        `The second naive policy is at-least-once: retry until an acknowledgement arrives. This avoids loss, but it creates duplicates. The dangerous case is not a malicious retry; it is the ordinary lost-ack case. The server charged the card, committed the row, or sent the message, then the acknowledgement vanished. The client retries in good faith. Without a stable identity for the original logical operation, the server sees a fresh request and repeats the effect.`,
        `Exactly-once delivery sounds like the escape hatch, but it is not available over a lossy network. The last confirmation message can always be lost. Adding more confirmations only creates a new last message. The real target is exactly-once effect: the network may deliver attempts zero, one, or many times, but the state change happens once.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `The core move is to stop treating each transport attempt as a separate operation. The client creates one idempotency key for one logical request and reuses that same key on every retry. The server records the key before, during, or atomically with the effect, then uses that record to recognize replays.`,
        `A repeated request with the same key is not an error and not a second command. It is a request for the already decided result. First arrival executes the operation and stores the response. Later arrivals return the stored response without touching the underlying state again. The client does not need to know whether the response came from first execution or replay. That sameness is the point.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `A typical API implementation has a table keyed by idempotency key and scoped by caller, endpoint, or tenant. The value stores status, request fingerprint, response body, and expiry time. On first arrival, the server claims the key. If the operation succeeds, it stores the final response under the key and returns it. If the same key arrives again, the server returns the stored response. If the same key arrives with a different request body, the server should reject it because the client is trying to reuse an identity for a different logical command.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg`, alt: `Directed graph with arrows between nodes`, caption: `Idempotent workflows are directed state machines: each operation identity should advance through a single decided path. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg`},
        `The hard part is the atomic boundary. If the server stores the key but crashes before the effect, future retries may be falsely suppressed. If it commits the effect but crashes before storing the key result, future retries may repeat the effect. Correct designs tie the dedup record to the business transaction, or record an in-progress state that can be safely completed or retried. In payment and order systems, the idempotency table often lives in the same database transaction as the ledger row or order state transition.`,
        `Multi-step workflows repeat the same pattern at every boundary. The service debits an account and writes an outbox event in one transaction. A relay publishes the outbox event at least once. Consumers deduplicate by event id. The email service, shipment service, and audit writer each need their own idempotent receiver logic. Exactly-once effect is not a global switch. It is a chain of local dedup contracts.`,
      ],
    },
    {
      heading: `How it works (2)`,
      paragraphs: [
        `The first view proves the ambiguity. A missing response gives the sender one observation and two possible histories. If the request was lost, retrying is correct. If the response was lost after the server acted, retrying is dangerous. No client-side rule can distinguish those histories from silence alone.`,
        `The second view proves that idempotency changes the problem. The network still loses requests and acknowledgements. Attempts still repeat. The difference is that a replay carries the same operation identity, so the receiver can turn the retry into a read of stored outcome instead of a second state change. The visual is showing exactly-once effect, not exactly-once delivery.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The reason this works is algebraic. An operation is idempotent when applying it twice leaves the same state as applying it once. Setting a field to 70 is idempotent. Deleting an already deleted row is idempotent. Incrementing a balance by 50 is not. An idempotency key wraps a non-idempotent command in a remembered decision: after the first decision, every duplicate maps to the same result without rerunning the command.`,
        `The remembered decision must include enough information to be stable. Returning a different status on replay can confuse clients and cause compensating actions. Recomputing the operation can repeat side effects. The safe replay path returns the original outcome or a clearly defined terminal state.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `The lookup cost is usually small: a cache lookup, an indexed database lookup, or a unique constraint insert. The operational cost is larger. Dedup records consume storage. Responses may contain sensitive data and need retention rules. Hot keys can become contention points. Cross-region systems must decide whether idempotency is local to one region or globally replicated.`,
        `Key lifetime is a real part of correctness. A system cannot remember every key forever. Stripe-like APIs may retain keys for about a day; queue systems may retain dedup ids for minutes. If the client can retry after the dedup window, the same key may be accepted as new. Retry budgets, backoff, timeout values, and dedup TTL must be designed together.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Payment APIs use idempotency keys because charging twice is worse than waiting. Cloud control planes use request tokens when creating instances, volumes, or databases, because a client may lose the create response and ask again. Message queues use delivery ids, consumer offsets, or application-level event ids because at-least-once delivery is the common durability bargain.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg`, alt: `Rows of servers in a data center rack`, caption: `Real retry paths cross load balancers, workers, queues, and storage systems; the idempotency key is the shared operation identity across that path. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Wikimedia_Foundation_Servers-8055_35.jpg`},
        `Kafka exactly-once semantics is best understood as scoped effectively-once processing: producer sequence numbers, transactions, and committed offsets prevent duplicate effects inside the Kafka transaction model. SQS FIFO uses MessageDeduplicationId inside a finite window. Transactional outbox systems use database atomicity for the local effect, then dedup events downstream. All of these systems still rely on retries; they make retries safe by giving receivers memory.`,
      ],
    },
    {
      heading: `Where it fails (2)`,
      paragraphs: [
        `Bad keys break the guarantee. If the client generates a new key on every retry, the server cannot connect attempts. If the key is too broad, unrelated commands suppress each other. If the key is reused with different parameters, the system may return the wrong saved result unless it fingerprints the request. If the dedup table is eventually consistent, two concurrent first arrivals can both execute unless a unique constraint or compare-and-set protects the claim.`,
        `Idempotency also does not solve semantic conflicts. A replay of the same charge can be suppressed, but two different valid charges still need business rules. A duplicate email can be skipped, but an email already sent cannot be unsent. Long-running workflows need cancellation, compensation, and audit trails in addition to dedup. Idempotency is a precise tool, not a complete distributed transaction system.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Retries, Backoff & Jitter for retry budgets that stay inside dedup windows. Study Message Queue for redelivery semantics and consumer acknowledgements. Study Transactional Outbox for the database-plus-event boundary. Study Transaction Isolation Levels for atomic key claims. Then read CRDTs for operations that are idempotent by construction, and Clocks & Ordering for the limits of knowing what happened first in distributed systems.`,
      ],
    },
      {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },

    {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Idempotency & Exactly-Once Delivery moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

