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
    invariant: 'Key seen before ⇒ return stored response, touch nothing: retries become reads.',
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
        { id: 'db', label: '1 · debit the account (DB transaction)' },
        { id: 'outbox', label: '2 · write "charge succeeded" event to OUTBOX table — same transaction' },
        { id: 'relay', label: '3 · relay publishes outbox rows to the queue, at-least-once' },
        { id: 'consumer', label: '4 · email service consumes, dedups by event id' },
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
      heading: `What it is`,
      paragraphs: [
        `Idempotency means applying an operation twice looks identical to applying it once. The Two Generals problem (1975) proves you cannot guarantee exactly-once delivery over a lossy network — silence is ambiguous (lost request vs. lost ack are indistinguishable). But you CAN achieve exactly-once EFFECT by pairing at-least-once retries with an idempotency key: the client sends a UUID minted once and reused on every retry; the server stores key→result and returns the saved response on replays. Watch this page's simulation: six $50 charges through a network that eats every 4th request and every 5th ack. At-most-once loses charges silently. At-least-once doubles them. With keys, exactly 6 of 6 land — every retry becomes indistinguishable from first success.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The client attaches an Idempotency-Key header (UUID) once per logical request, reusing it on every retry. The server keeps a key→result table (cache or database column). First arrival: execute, store the result under the key, respond. Replay (same key again): skip execution, return the stored response verbatim. The client cannot tell a replay from first success — and that indistinguishability IS the feature. Some operations are already idempotent: SET balance = 70 applied twice leaves the same state; DELETE is a no-op if gone; HTTP PUT (replace) is idempotent by spec. INCREMENT BY 50 is not (apply twice and the balance is wrong). POST is not (two POSTs make two resources). When operation is naturally idempotent (or nearly so, like CRDTs: Conflict-Free Replicated Data Types with idempotent merge), you don't need a key — retrying is safe by algebra.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Key lookup is O(1) in cache, O(log n) in a database. Bandwidth cost is one header per request (36 bytes). The real cost is operational: tune retry policy and key TTL so retries land INSIDE the dedup window. Stripe remembers keys for 24 hours. SQS FIFO's MessageDeduplicationId has a 5-minute window. A retry arriving after TTL expiry is a fresh request — dedup memory is finite. Effectively-once is a contract between retry policy (Retries, Backoff & Jitter) and key lifetime, not a property either side owns alone.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Stripe Idempotency-Key (24h replay). Kafka "exactly-once semantics" (idempotent producers + transactions). SQS FIFO (5-min dedup window). Financial systems use the transactional outbox pattern: write the event and business effect (debit account) in one database transaction (via Transaction Isolation Levels), then let an at-least-once relay publish to Message Queues. Consumers dedup by event id, so each hop is effectively-once even though every channel is at-least-once. This is how you build effectively-once over at-least-once infrastructure.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Trap 1: confusing naturally-idempotent operations (PUT) with idempotency keys (POST). Trap 2: forgetting dedup memory expires — a late retry is a fresh request again, so Retries, Backoff & Jitter must finish inside the dedup window or safety evaporates silently. Trap 3: underestimating the cost of storing results at scale. Each key needs a stored result (disk/cache space). At massive scale, 24 hours of results is expensive — choose TTLs carefully.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read "Retries, Backoff & Jitter" for safe retry policies. Study "Message Queues" to see at-least-once delivery and why you dedup per hop. Continue into "Agent Payments Protocol Mandate Ledger Case Study" and "Double-Entry Payment Ledger Execution Trace" for payment retries, mandates, receipts, and audit evidence. Explore "CRDTs: Conflict-Free Replicated Data Types" for idempotency by design. Master "Transaction Isolation Levels" for atomic writes. Review "Clocks & Ordering: Lamport to TrueTime" for distributed causality.`,
      ],
    },
  ],
};
