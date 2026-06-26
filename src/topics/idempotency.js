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
        'Read the animation as the execution trace for one logical payment request crossing an unreliable network. A logical request is the user intent, such as charge order 913 once; a transport attempt is one HTTP request, queue delivery, or retry carrying that intent.',
        {type: "callout", text: "Retry safety comes from remembered operation identity, not from a perfect network."},
        'Active rows show the attempt currently being sent or received. Visited rows show attempts whose outcome has already been decided by the server. Found rows show a stored result that can be replayed without running the side effect again.',
        'The safe inference rule is simple: if two attempts carry the same idempotency key and the same request fingerprint, the receiver must treat them as the same operation. Watch where the key is recorded, because that storage boundary is what turns a retry into a lookup instead of a second charge.',
      
        {type: 'image', src: './assets/gifs/idempotency.gif', alt: 'Animated walkthrough of the idempotency visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Distributed systems must decide what to do after silence. A client sends a payment request and times out after 2 seconds. The server may have received nothing, or it may have charged the card and lost only the response. From the client side, those histories are indistinguishable.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif`, alt: `Animated packet switching diagram with packets moving through shared links`, caption: `Packet-switched networks make retries unavoidable: packets and acknowledgements can vanish independently of the operation they represent. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Packet_Switching.gif`},
        'Idempotency exists because useful systems must retry anyway. Load balancers close connections, workers crash after committing data, and queues redeliver messages when a consumer dies before acknowledging. If the operation creates money movement, inventory reservation, account creation, or email delivery, a blind retry can turn one intended effect into two real effects.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable policy is at-most-once delivery: send once and never retry. That avoids duplicates, and it is fine for telemetry where losing one metric point is cheaper than blocking the caller. It fails for business effects because a real payment, order, or account creation can disappear forever.',
        'The second reasonable policy is at-least-once delivery: retry until an acknowledgement arrives. That avoids permanent loss, and it is the normal bargain for durable queues. It fails when the first attempt performed the effect but the acknowledgement was lost, because the retry looks like a new command.',
        'A third instinct is to ask the network for exactly-once delivery. The last confirmation message can always be lost, so adding another confirmation only creates a new last message. The practical target is exactly-once effect: attempts may arrive zero, one, or many times, but the state change happens once.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is ambiguity after a timeout. Suppose the client sends charge $40 for order 913 and hears nothing. Retrying is correct if the request was lost; retrying is dangerous if the response was lost after the server committed the charge.',
        'No client-side rule can distinguish those two cases from silence alone. Waiting longer reduces some errors but cannot prove what happened. The receiver needs memory of the logical operation, not more confidence in the transport attempt.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Give the logical operation a stable identity. The client creates one idempotency key for order 913 and reuses that same key on every retry. The server records the key with the request fingerprint and the final outcome, then treats later arrivals with that key as replays.',
        'A replay is not a second command. It is a request for the already decided result. The client does not need to know whether the response came from first execution or replay, because both carry the same logical meaning.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A typical API stores idempotency records keyed by caller, endpoint, and idempotency key. The record includes status, request fingerprint, response body, and expiry time. The fingerprint prevents a client from reusing the same key for a different command.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg`, alt: `Directed graph with arrows between nodes`, caption: `Idempotent workflows are directed state machines: each operation identity should advance through a single decided path. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg`},
        'On first arrival, the server claims the key and runs the business transaction. If the transaction succeeds, it stores the final response under the key and returns it. If the same key arrives again with the same fingerprint, the server returns the stored response without touching the underlying state again.',
        'The hard part is the atomic boundary. If the server stores the key but crashes before the effect, future retries may be falsely suppressed. If it commits the effect but crashes before storing the key result, future retries may repeat the effect. Correct designs put the idempotency record and business effect in the same transaction, or store an in-progress state that can be completed safely.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'An operation is idempotent when applying it twice leaves the same state as applying it once. Setting account_status to closed is idempotent; incrementing balance by 50 is not. An idempotency key wraps a non-idempotent command in a remembered decision.',
        'The invariant is: one scoped key maps to one request fingerprint and one terminal outcome. If that invariant holds, every duplicate attempt reads the same outcome rather than rerunning the side effect. The system is correct because all repeated attempts collapse onto the first committed decision.',
        'Multi-step workflows need the same invariant at each boundary. A service can debit an account and write an outbox event in one transaction; the relay can publish the event at least once; consumers can deduplicate by event id. Exactly-once effect is a chain of local dedup contracts, not a network property.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The hot-path cost is usually one indexed lookup or one unique-key insert, so the time cost is O(1) for a single request against a hash index or B-tree index. The storage cost is O(k), where k is the number of retained idempotency records. If a service processes 2 million keyed requests per day and keeps records for 24 hours, it must budget storage and cleanup for about 2 million records.',
        'Cost shows up as behavior under retries. A retry storm with 100,000 duplicate attempts should become 100,000 cheap reads of stored outcomes, not 100,000 repeated charges. Hot keys can still create contention, because many duplicates may race to claim or read the same record.',
        'Key lifetime is part of correctness. If records expire after 24 hours and a client retries after 25 hours, the same key may be accepted as new. Retry budgets, backoff, timeout values, and dedup retention must be designed together.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Payment APIs use idempotency keys because charging twice is worse than waiting. Cloud control planes use request tokens when creating instances, volumes, or databases, because a client may lose the create response and ask again. Message queues use delivery ids, consumer offsets, or application-level event ids because at-least-once delivery is the common durability bargain.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg`, alt: `Rows of servers in a data center rack`, caption: `Real retry paths cross load balancers, workers, queues, and storage systems; the idempotency key is the shared operation identity across that path. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Wikimedia_Foundation_Servers-8055_35.jpg`},
        'Kafka exactly-once semantics is scoped to its transaction model: producer sequence numbers, transactions, and committed offsets prevent duplicate effects inside that boundary. SQS FIFO uses MessageDeduplicationId inside a finite window. Transactional outbox systems use database atomicity for the local effect, then deduplicate events downstream.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Bad keys break the guarantee. If the client generates a new key on every retry, the server cannot connect attempts. If the key is too broad, unrelated commands suppress each other. If the key is reused with different parameters, the server must reject it rather than return the wrong saved result.',
        'Weak storage breaks the guarantee too. If two concurrent first arrivals can both insert the same key because the dedup table is eventually consistent, both may execute. The claim step needs a unique constraint, compare-and-set, or equivalent serialization point.',
        'Idempotency does not solve semantic conflicts. A replay of the same charge can be suppressed, but two different valid charges still need business rules. A duplicate email can be skipped, but an email already sent cannot be unsent.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A client wants to charge order 913 for $40 and generates key pay_913_a7. Attempt 1 reaches the server, the server inserts an idempotency record in progress, charges the card, stores response charge_id ch_55 with status 200, and sends the response. The response packet is lost, so the client sees a timeout.',
        'Attempt 2 uses the same key pay_913_a7 and the same request fingerprint. The server finds the completed record and returns status 200 with charge_id ch_55. The charge count stays 1, even though the network delivered two attempts.',
        'If the client accidentally retries with key pay_913_b9, the server sees a different logical operation and may charge again. If the client reuses pay_913_a7 for $45 instead of $40, the fingerprint check rejects the request. Those two numbers show the whole contract: same key plus same body means replay; different key or different body is not the same operation.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Stripe API idempotent requests for a production API contract, AWS client tokens for control-plane create operations, Amazon SQS FIFO deduplication for finite-window message identity, and Kafka transactions for scoped exactly-once processing. These sources show the same idea under different storage and retention constraints.',
        'Study retries, backoff, and jitter before this topic if timeout behavior is unfamiliar. Study transaction isolation and unique constraints to understand atomic key claims. Study transactional outbox, message queues, and CRDTs next to see how local idempotency combines with larger distributed workflows.',
      ],
    },
  ],
};
