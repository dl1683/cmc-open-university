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
    explanation: `Booking a trip touches four services -- flights, hotels, cars, payments -- each owning its OWN database. Two-Phase Commit (2PC) could make this atomic, but at the price of every service holding locks while waiting on a coordinator and blocking if it dies. The saga bargain: give up the single atomic moment, keep the all-or-nothing OUTCOME.`,
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
      explanation: `Step ${i + 1}: ${STEPS[i].action} -- COMMITTED, for real, right now. ${i === 0 ? "Note what did NOT happen: no lock held, no coordinator consulted, and the airline database is already showing this seat as sold to everyone in the world. Sagas expose intermediate states -- that is the trade." : 'Each service did one normal transaction and moved on.'}`,
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
      explanation: `The saga ends in the "nothing happened" state: flight refunded, hotel cancelled, customer never charged. Eventually consistent -- for a minute, the world COULD see a booked hotel for a trip that would never exist, and any process reading mid-saga must tolerate that (see CAP Theorem: this is choosing availability). The guarantee is weaker than 2PC, the availability is far better: no service ever waited on another.`,
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
    { heading: 'How to read the animation', paragraphs: [
      'The animation shows a saga, which is a business workflow made from committed local transactions. A highlighted step is not a vote; it is already durable in its own service, so failure later requires compensating actions in reverse order.',
      {type: 'image', src: './assets/gifs/saga-pattern.gif', alt: 'Animated walkthrough of the saga pattern visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
    ]},
    { heading: 'Why this exists', paragraphs: [
      'A checkout or trip booking crosses services with separate databases and owners. The user still expects one coherent outcome, so the system needs a recoverable workflow rather than a pile of unrelated calls.',
      {type: 'callout', text: 'A saga trades one global commit for durable local steps plus compensations that repair the business outcome.'},
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A saga is easiest to reason about as directed workflow state: forward commands, failure edges, and reverse compensation edges. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
    ]},
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is two-phase commit. A coordinator asks every participant to prepare, then commits only if every participant agrees, which works for short transactions under one administrative boundary.',
    ]},
    { heading: 'The wall', paragraphs: [
      'Long workflows cross slow providers, external APIs, deploys, and user-visible actions. Holding locks while a payment network or hotel partner responds damages availability, and many actions need semantic repair rather than byte rollback.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Data_Queue.svg/250px-Data_Queue.svg.png', alt: 'Queue diagram with one input end and one output end', caption: 'Retries and compensations usually move through durable queues; the saga state machine decides which command enters the queue next. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Data_Queue.svg.'},
    ]},
    { heading: 'The core insight', paragraphs: [
      'A saga splits one global transaction into ordered local transactions plus compensations. The invariant is that every committed forward step has an idempotent recovery path, meaning retries do not duplicate the real-world effect.',
    ]},
    { heading: 'How it works', paragraphs: [
      'The workflow stores a saga id, current state, completed steps, idempotency keys, retry counts, deadlines, and final status. Each forward command commits locally, then the workflow records the result and chooses the next command, retry, compensation, or escalation.',
    ]},
    { heading: 'Why it works', paragraphs: [
      'Local transactions preserve local invariants, while the saga record preserves cross-service intent. The correctness target is eventual business outcome: complete every forward step, or run compensations until the business state is repaired.',
    ]},
    { heading: 'Cost and complexity', paragraphs: [
      'Sagas reduce distributed lock time but add state-machine cost. Every step needs timeout behavior, retry policy, idempotency key, compensation, metrics, and operator visibility, so adding one service adds a new failure branch.',
    ]},
    { heading: 'Real-world uses', paragraphs: [
      'Sagas fit checkout, travel booking, ride-hailing, marketplace payouts, account onboarding, claims processing, and cloud provisioning. These domains already have pending, cancelled, refunded, rejected, and manual-review states.',
    ]},
    { heading: 'Where it fails', paragraphs: [
      'Sagas fail when compensation is fake or intermediate visibility is unacceptable. If an action cannot be cancelled, refunded, corrected, or escalated, the workflow needs a stronger boundary or a manual policy rather than a pretend undo.',
    ]},
    { heading: 'Worked example', paragraphs: [
      'A trip saga books a flight, reserves a hotel, rents a car, and charges a card. If the flight and hotel succeed but the car fails, the workflow cancels the hotel with key trip-123-hotel-cancel and refunds the flight with key trip-123-flight-refund.',
      'If either compensation times out, the same key is retried. The final state is compensated, not rolled back, because the original flight and hotel commits were real events followed by real repair events.',
    ]},
    { heading: 'Sources and study next', paragraphs: [
      'Primary source: Garcia-Molina and Salem, Sagas, ACM SIGMOD 1987. Study two-phase commit, write-ahead logging, idempotency keys, transactional outbox, durable queues, and workflow engines such as Temporal or Step Functions.',
    ]},
  ],
};