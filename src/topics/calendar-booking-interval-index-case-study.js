// Calendar booking interval index: applying interval trees and free/busy
// semantics to real scheduling and double-booking prevention.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'calendar-booking-interval-index-case-study',
  title: 'Calendar Booking Interval Index Case Study',
  category: 'Systems',
  summary: 'A production scheduling case study: normalize half-open intervals, expand recurrence, query free/busy ranges, and atomically check then insert to prevent double booking.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['single resource booking', 'free busy aggregation'], defaultValue: 'single resource booking' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function bookingGraph(title) {
  return graphState({
    nodes: [
      { id: 'req', label: 'request', x: 0.8, y: 3.6, note: '[10:30,11)' },
      { id: 'index', label: 'index', x: 2.8, y: 3.6, note: 'intervals' },
      { id: 'busy1', label: 'busy A', x: 5.0, y: 2.0, note: '[9,10)' },
      { id: 'busy2', label: 'busy B', x: 5.0, y: 5.2, note: '[10,11)' },
      { id: 'conflict', label: 'conflict', x: 7.0, y: 5.2, note: 'reject' },
      { id: 'insert', label: 'insert', x: 7.0, y: 2.0, note: 'if free' },
      { id: 'txn', label: 'txn', x: 8.8, y: 3.6, note: 'atomic' },
    ],
    edges: [
      { id: 'e-req-index', from: 'req', to: 'index' },
      { id: 'e-index-busy1', from: 'index', to: 'busy1' },
      { id: 'e-index-busy2', from: 'index', to: 'busy2' },
      { id: 'e-busy2-conflict', from: 'busy2', to: 'conflict' },
      { id: 'e-index-insert', from: 'index', to: 'insert' },
      { id: 'e-insert-txn', from: 'insert', to: 'txn' },
      { id: 'e-conflict-txn', from: 'conflict', to: 'txn' },
    ],
  }, { title });
}

function freeBusyGraph(title) {
  return graphState({
    nodes: [
      { id: 'alice', label: 'Alice', x: 0.8, y: 2.0, note: 'busy' },
      { id: 'bob', label: 'Bob', x: 0.8, y: 5.2, note: 'busy' },
      { id: 'room', label: 'Room', x: 2.8, y: 3.6, note: 'busy' },
      { id: 'merge', label: 'merge', x: 5.0, y: 3.6, note: 'union' },
      { id: 'gaps', label: 'gaps', x: 7.0, y: 2.0, note: 'free' },
      { id: 'privacy', label: 'privacy', x: 7.0, y: 5.2, note: 'no titles' },
      { id: 'offer', label: 'offer', x: 8.8, y: 3.6, note: 'slots' },
    ],
    edges: [
      { id: 'e-alice-merge', from: 'alice', to: 'merge' },
      { id: 'e-bob-merge', from: 'bob', to: 'merge' },
      { id: 'e-room-merge', from: 'room', to: 'merge' },
      { id: 'e-merge-gaps', from: 'merge', to: 'gaps' },
      { id: 'e-merge-privacy', from: 'merge', to: 'privacy' },
      { id: 'e-gaps-offer', from: 'gaps', to: 'offer' },
      { id: 'e-privacy-offer', from: 'privacy', to: 'offer' },
    ],
  }, { title });
}

function* singleResourceBooking() {
  yield {
    state: bookingGraph('A room owns an interval index of busy bookings'),
    highlight: { active: ['req', 'index', 'busy2', 'e-req-index', 'e-index-busy2'], found: ['conflict'] },
    explanation: 'A booking request is an interval. The room calendar stores existing busy intervals. Query the interval index for overlap before accepting the new booking.',
    invariant: 'A resource is bookable only if the proposed interval overlaps no busy interval for that resource.',
  };

  yield {
    state: labelMatrix(
      'Half-open interval semantics',
      [
        { id: 'overlap', label: '[10:30,11)' },
        { id: 'adjacent', label: '[11,11:30)' },
        { id: 'zero', label: '[11,11)' },
        { id: 'tz', label: 'time zones' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'result' },
      ],
      [
        ['start < busyEnd and busyStart < end', 'conflict'],
        ['end equals next start', 'allowed'],
        ['no duration', 'reject or ignore'],
        ['normalize to instants', 'compare UTC'],
      ],
    ),
    highlight: { found: ['overlap:result', 'adjacent:result'], compare: ['tz:rule'] },
    explanation: 'Calendars should define intervals precisely. Half-open [start, end) intervals make back-to-back meetings legal while still catching true overlaps.',
  };

  yield {
    state: bookingGraph('Check and insert must be one serialized operation'),
    highlight: { active: ['index', 'insert', 'txn', 'e-index-insert', 'e-insert-txn'], compare: ['conflict'] },
    explanation: 'The classic race is two clients both seeing the room as free and then both inserting. The overlap check and insertion need one transaction, one durable object owner, or another serialization boundary.',
    invariant: 'Availability lookup is advisory; booking requires atomic check-and-insert.',
  };

  yield {
    state: labelMatrix(
      'Complete room-booking path',
      [
        { id: 'normalize', label: 'normalize' },
        { id: 'query', label: 'query index' },
        { id: 'reserve', label: 'reserve' },
        { id: 'publish', label: 'publish event' },
      ],
      [
        { id: 'data', label: 'data step' },
        { id: 'failure' },
      ],
      [
        ['TZID -> instant', 'DST mistakes'],
        ['find overlaps', 'stale free slot'],
        ['insert atomically', 'double booking'],
        ['send invites', 'outbox needed'],
      ],
    ),
    highlight: { active: ['query:data', 'reserve:data'], found: ['reserve:failure'], compare: ['publish:failure'] },
    explanation: 'The data-structure query is only one part of production scheduling. Time-zone normalization, recurrence expansion, idempotency, transactions, and notifications all matter.',
  };
}

function* freeBusyAggregation() {
  yield {
    state: freeBusyGraph('Free/busy aggregation unions busy intervals, then finds gaps'),
    highlight: { active: ['alice', 'bob', 'room', 'merge'], found: ['gaps', 'offer'] },
    explanation: 'Scheduling across people and rooms starts by collecting busy intervals for each calendar, merging them, and inverting the union inside the requested time window to find candidate free slots.',
  };

  yield {
    state: labelMatrix(
      'What free/busy returns',
      [
        { id: 'detail', label: 'event titles' },
        { id: 'busy', label: 'busy intervals' },
        { id: 'window', label: 'query window' },
        { id: 'limits', label: 'limits' },
      ],
      [
        { id: 'visible', label: 'visible?' },
        { id: 'why' },
      ],
      [
        ['no', 'privacy'],
        ['yes', 'scheduling enough'],
        ['required', 'bound expansion'],
        ['provider-specific', 'protect service'],
      ],
    ),
    highlight: { found: ['busy:visible', 'detail:why'], compare: ['limits:why'] },
    explanation: 'Free/busy APIs expose availability without exposing meeting content. That privacy boundary is why scheduling assistants often use busy intervals rather than full event objects.',
  };

  yield {
    state: labelMatrix(
      'Recurring event handling',
      [
        { id: 'rrule', label: 'weekly standup' },
        { id: 'exdate', label: 'holiday exception' },
        { id: 'override', label: 'moved occurrence' },
        { id: 'horizon', label: 'query horizon' },
      ],
      [
        { id: 'step', label: 'step' },
        { id: 'indexInput', label: 'index input' },
      ],
      [
        ['expand instances', 'many intervals'],
        ['remove instance', 'gap restored'],
        ['replace instance', 'new interval'],
        ['cap expansion', 'bounded work'],
      ],
    ),
    highlight: { active: ['rrule:indexInput', 'override:indexInput'], found: ['horizon:step'] },
    explanation: 'Interval indexes usually store concrete instances for the query horizon, not an infinite recurrence rule. Recurrence is expanded, exceptions are applied, and only then do interval overlap queries run.',
  };

  yield {
    state: freeBusyGraph('Rank candidate gaps by constraints, then book atomically'),
    highlight: { active: ['gaps', 'offer', 'e-gaps-offer'], found: ['privacy'], compare: ['merge'] },
    explanation: 'After gaps are found, product logic ranks slots by working hours, travel buffers, room capacity, time zones, and user preferences. The final chosen slot still has to pass the atomic booking check.',
    invariant: 'Finding a free slot and reserving it are separate consistency problems.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'single resource booking') yield* singleResourceBooking();
  else if (view === 'free busy aggregation') yield* freeBusyAggregation();
  else throw new InputError('Pick a calendar-booking view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A calendar booking interval index is the production version of the interval-tree problem. Every event, hold, maintenance block, room reservation, or out-of-office marker becomes a time interval. The central question is whether a proposed interval overlaps anything already busy.',
        'This case study builds on Interval Tree, Segment Tree, and Cloudflare Durable Objects Case Study. The data-structure part finds overlaps quickly; the systems part prevents two clients from booking the same resource after both observe a stale free slot.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Normalize every event into a comparable instant range, usually UTC instants plus the original time-zone metadata for display. Use half-open intervals [start, end). Two intervals overlap when startA < endB and startB < endA. With half-open semantics, a meeting ending at 11:00 and another starting at 11:00 do not conflict.',
        'For one resource, an interval tree can answer "does this proposed booking overlap an existing busy interval?" in logarithmic time for the first overlap and O(log n + k) for all overlaps. For many people and rooms, free/busy aggregation fetches or computes busy intervals per calendar, unions them, and inverts the union inside the requested scheduling window to produce candidate gaps.',
        'Recurring events are not stored as infinite intervals. A scheduler expands recurrence rules over a bounded query horizon, applies exceptions and overrides, and then indexes concrete instances. This keeps query work finite and makes daylight-saving-time edge cases explicit rather than hidden in a comparison function.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The clean data-structure cost is modest: O(log n) overlap checks per resource and O(m log m) merging for m busy intervals across calendars. The real cost is correctness at the boundary. Checking availability and inserting a booking must be one serialized operation. Otherwise two clients can both read "free" and then both write conflicting events.',
        'A production scheduler also needs idempotency keys for retries, outbox-style notification publishing, cancellation semantics, provisional holds, visibility rules, room capacity filters, working-hours constraints, and time-zone display rules. The interval tree answers overlap; it does not own the whole product.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A meeting assistant receives a request for Alice, Bob, and Room 12 between 10:00 and 14:00. It asks each calendar for busy intervals, merges the intervals, and finds candidate gaps. It ranks gaps by working hours and room capacity, then proposes 11:30-12:00. When the user confirms, the room booking service rechecks Room 12 inside a transaction or single resource owner and inserts the reservation only if the interval is still free.',
        'If recurrence is involved, the assistant expands Alice\'s weekly standup, removes holiday exceptions, applies moved occurrences, and only includes concrete busy intervals that intersect the query window. The final free/busy response can hide titles and attendees while still exposing enough interval information to schedule safely.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first trap is treating the availability result as a reservation. Free/busy is a read. Booking is a write. They need different consistency guarantees. The second trap is ambiguous interval boundaries. Closed intervals make back-to-back events look like conflicts; half-open intervals avoid that. The third trap is ignoring recurrence and daylight saving time. A weekly 9 AM meeting is a local-time rule, not a fixed UTC offset forever.',
        'Another mistake is exposing full event details when free/busy intervals are enough. Scheduling usually needs busy ranges, not titles, participants, or descriptions. Privacy-preserving free/busy views are a product and compliance feature, not just an API convenience.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 5545 iCalendar at https://datatracker.ietf.org/doc/html/rfc5545, Google Calendar Freebusy query at https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query, RFC 7953 Calendar Availability at https://datatracker.ietf.org/doc/html/rfc7953, and CalDAV free-busy query semantics at https://icalendar.org/CalDAV-Access-RFC-4791/7-10-caldav-free-busy-query-report.html. Study Interval Tree, Segment Tree & Lazy Propagation, Idempotency, Transactional Outbox, and Cloudflare Durable Objects Case Study next.',
      ],
    },
  ],
};
