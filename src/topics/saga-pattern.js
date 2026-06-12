// The saga pattern: distributed transactions without locks. Each step
// commits for real, immediately — and if a later step fails, you UNDO the
// earlier ones with compensating actions, in reverse. Microservices' answer
// to two-phase commit.

import { arrayState, InputError } from '../core/state.js';

export const topic = {
  id: 'saga-pattern',
  title: 'Saga Pattern',
  category: 'Systems',
  summary: 'A chain of local transactions plus compensating undos — distributed consistency without holding locks.',
  controls: [
    { id: 'scenario', label: 'Scenario', type: 'select', options: ['all steps succeed', 'step 3 fails'], defaultValue: 'step 3 fails' },
  ],
  run,
};

const STEPS = [
  { name: 'flight', action: 'book the flight', undo: 'refund the flight' },
  { name: 'hotel', action: 'reserve the hotel', undo: 'cancel the hotel' },
  { name: 'car', action: 'rent the car', undo: 'cancel the rental' },
  { name: 'charge', action: 'charge the card', undo: 'refund the card' },
];

export function* run(input) {
  const failing = String(input.scenario) === 'step 3 fails';
  if (!['all steps succeed', 'step 3 fails'].includes(String(input.scenario))) {
    throw new InputError('Pick a scenario.');
  }
  const failAt = failing ? 2 : -1;

  const labels = STEPS.map((s) => s.name);
  const ids = (upto) => Array.from({ length: upto }, (_, i) => `i${i}`);

  yield {
    state: arrayState(labels),
    highlight: {},
    explanation: 'Booking a trip touches four services — flights, hotels, cars, payments — each owning its OWN database. Two-Phase Commit (2PC) could make this atomic, but at the price of every service holding locks while waiting on a coordinator (and blocking if it dies). The saga\'s bargain: give up the single atomic moment, keep the all-or-nothing OUTCOME.',
  };

  yield {
    state: arrayState(labels),
    highlight: { range: ids(STEPS.length) },
    explanation: 'A saga is a CHAIN of ordinary local transactions, run in order — each one commits immediately and completely in its own service (each still using its own Write-Ahead Log (WAL) locally). The price of admission: every step must come with a COMPENSATING ACTION — a prepared undo: book↔refund, reserve↔cancel. No undo plan, no saga.',
    invariant: 'Every committed step has a compensating action ready before the saga starts.',
  };

  let completed = 0;
  for (let i = 0; i < STEPS.length; i += 1) {
    if (i === failAt) break;
    completed += 1;
    yield {
      state: arrayState(labels),
      highlight: { found: ids(completed), active: [`i${i}`] },
      explanation: `Step ${i + 1}: ${STEPS[i].action} — COMMITTED, for real, right now. ${i === 0 ? 'Note what did NOT happen: no lock held, no coordinator consulted, and the airline\'s database is already showing this seat as sold to everyone in the world. Sagas expose intermediate states — that is the trade.' : 'Each service did one normal transaction and moved on.'}`,
    };
  }

  if (failing) {
    yield {
      state: arrayState(labels),
      highlight: { swap: [`i${failAt}`], found: ids(completed) },
      explanation: `Step ${failAt + 1}: ${STEPS[failAt].action}… FAILS — no cars available. In 2PC this is where everyone would have voted no and quietly rolled back. But our first ${completed} steps are ALREADY COMMITTED — there is no rollback button on a committed transaction. There is only the plan we packed: compensate, in REVERSE order.`,
    };

    for (let i = completed - 1; i >= 0; i -= 1) {
      yield {
        state: arrayState(labels),
        highlight: { removed: ids(completed).slice(i), swap: [`i${failAt}`] },
        explanation: `Compensate step ${i + 1}: ${STEPS[i].undo}. This is itself just another local transaction — and it MUST succeed (compensations are designed to be retryable and unfailable: a refund can be retried forever; that is why "charge the card" goes LAST, where it never needs compensating in this saga).`,
      };
    }

    yield {
      state: arrayState(labels),
      highlight: { removed: ids(STEPS.length) },
      explanation: 'The saga ends in the "nothing happened" state: flight refunded, hotel cancelled, customer never charged. Eventually consistent — for a minute, the world COULD see a booked hotel for a trip that would never exist, and any process reading mid-saga must tolerate that (see CAP Theorem: this is choosing availability). The guarantee is weaker than 2PC\'s, the availability is far better: no service ever waited on another.',
    };
    return;
  }

  yield {
    state: arrayState(labels),
    highlight: { found: ids(STEPS.length) },
    explanation: 'All four steps committed — the trip exists, assembled from four independent transactions with zero cross-service locks. Each service stayed autonomous, deployable, and crash-isolated: had any step failed, the compensation chain would have unwound the rest.',
  };

  yield {
    state: arrayState(labels),
    highlight: {},
    explanation: 'Production notes: sagas come in two flavors — ORCHESTRATION (a coordinator service walks the chain; easier to follow) and CHOREOGRAPHY (each service emits events the next one reacts to; no central brain). Every step and compensation must be IDEMPOTENT, because retries are how failures get healed. And some actions cannot be literally undone (an email cannot be unsent) — compensate semantically: send the correction. This is how airlines, Uber, and every e-commerce checkout actually spans services; 2PC remains for the few places (banking ledgers, inventory counts) where exposing intermediate states is unacceptable.',
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `The saga pattern coordinates a long business transaction as a sequence of local transactions plus compensating actions. Garcia-Molina and Salem described sagas in 1987 for long-lived database work; microservices revived the idea because one checkout often touches order, inventory, payment, shipping, tax, email, and analytics services. Instead of holding locks across all of them with Two-Phase Commit (2PC), each service commits locally and records what happened.`,
        `If a later step fails, the saga does not rewind time. It runs semantic repair: release inventory, issue a refund, cancel a shipment, or send a correction event. That is weaker than atomic rollback but much more available. The CAP Theorem flavor is clear: the product accepts temporary inconsistency so individual services can keep making progress during partial failure.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Every step uses the service's ordinary database transaction and Write-Ahead Log (WAL). The order service creates an order, the inventory service reserves stock, the payment service authorizes money, and the shipping service creates a label. Each step emits an event through Message Queues or returns a result to an orchestrator. If shipping fails after payment authorization, compensation might void the authorization and release stock.`,
        `There are two common control styles. Orchestration uses a workflow service, such as Temporal, Cadence, AWS Step Functions, or Camunda, to call each step, persist workflow state, retry, and run compensations. Choreography has services react to events: OrderCreated triggers inventory, InventoryReserved triggers payment, and so on. Choreography removes a central workflow brain but makes the global state harder to see.`,
        `Idempotency is non-negotiable. A compensate_payment command may be delivered twice, so it needs a stable idempotency key and a local record saying the refund or void already happened. Retrying without that guard turns recovery into a duplicate-charge bug.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Sagas reduce lock duration and cross-service blocking, but they move complexity into business logic. Each forward action needs a compensation, timeout policy, retry policy, and human escalation path. A workflow that touches 6 services and allows 3 retries per step can generate dozens of observable states. Rate Limiter (Token Bucket) behavior is needed so retry storms do not crush a recovering dependency. Distributed Tracing is needed so engineers can answer where the order is now.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `E-commerce checkout is the standard example: create order, reserve inventory, authorize payment, create shipment, send confirmation. Travel booking is another: reserve flight, hotel, and car, then compensate reservations if one provider rejects the trip. Ride-hailing uses similar flows for match, driver acceptance, trip start, payment authorization, and cancellation fees. Cache Invalidation & Versioning often becomes part of the saga because users should not keep seeing stale order or inventory status after a compensating event.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The biggest misconception is that compensation restores the exact previous state. It usually creates a new state that is acceptable to the business. A refund is not an uncharge; it is a new ledger event. A cancellation may incur a fee. Inventory released after five minutes may already have affected customer promises. For hard invariants, use a strongly coordinated path or narrow the invariant to one service boundary.`,
        `Sagas also do not remove the need for Transaction Isolation Levels inside each service. A local reservation step still needs to prevent overselling. Finally, avoid mixing orchestration and choreography accidentally. If both the workflow engine and an event subscriber issue the same compensation, idempotency saves you once; clear ownership saves you every day.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Compare directly with Two-Phase Commit (2PC), then use CAP Theorem to name the availability trade-off. Write-Ahead Log (WAL) and Message Queues explain durable local steps and event delivery. Rate Limiter (Token Bucket), Distributed Tracing, Cache Invalidation & Versioning, and Transaction Isolation Levels cover the operational pieces that make sagas survivable in production.`,
      ],
    },
  ],
};
