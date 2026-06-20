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
      heading: 'Why scheduling is an interval-index problem',
      paragraphs: [
        {type:'callout', text:'A calendar booking system is an interval overlap index until the user clicks book, then it becomes a serialized check-and-insert problem.'},
        'Scheduling looks simple until the system has to prevent two clients from booking the same room, expand recurring meetings across daylight saving time, hide private event details, and still answer free/busy queries quickly.',
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/7/73/Pert_example_gantt_chart.gif', alt:'Gantt chart showing tasks as horizontal intervals on a time axis', caption:'A Gantt chart draws work as intervals on a time axis; calendar booking uses the same interval shape but adds overlap checks, privacy, recurrence, and atomic reservation. Source: Wikimedia Commons, Dbsheajr, CC BY-SA 3.0/GFDL.'},
        'The core data question is narrow: does this proposed interval overlap any existing busy interval for the same resource? If the answer is yes, reject or propose another slot. If the answer is no, the system may proceed to reservation, but only with a consistency boundary around the write.',
        'That makes calendar booking a practical interval-index problem wrapped in product rules, privacy rules, and transaction rules.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to scan every event on the calendar and check overlap. That works for a personal calendar with a handful of events. It does not scale well to busy conference rooms, appointment systems, shared equipment, or assistants searching many calendars.',
        'A second shallow approach is worse: read free/busy once and treat "free" as a reservation. Two users can both observe the room as free and then both insert conflicting bookings. Availability is not a lock.',
        'The first wall is semantics. Calendars need a precise interval convention, usually half-open `[start, end)`, so a meeting ending at 11:00 and another starting at 11:00 can coexist. The second wall is consistency. The overlap check and insert must be serialized for the resource being booked.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Model every busy object as a half-open interval over comparable instants. For one resource, an interval tree, segment tree, database range index, or ordered interval table can reject conflicts quickly.',
        'For multiple calendars, collect busy intervals, merge their union, invert the union inside the requested search window, and rank the gaps. That gives candidate slots. It does not reserve them.',
        'The final booking step must recheck the resource and insert atomically. The interval index answers "what overlaps?" The transaction boundary answers "can anyone else sneak in between check and insert?"',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the single-resource view, follow the request into the interval index. The conflict node represents the overlap predicate: `start < busyEnd && busyStart < end`. If that predicate is true for any busy interval, the request cannot be accepted for that resource.',
        'The transaction node is not decoration. It is the boundary that prevents two clients from both seeing a slot as free and both inserting. The animation separates lookup from reservation because production systems must separate those ideas.',
        'In the free/busy aggregation view, watch many private calendars collapse into busy intervals, then into merged gaps. The system does not need event titles to find availability. It needs time ranges, privacy boundaries, and a final atomic booking step.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Normalize every event into comparable instants while preserving original time-zone metadata for display and recurrence interpretation. The overlap rule for half-open intervals is `startA < endB && startB < endA`.',
        'Recurring events are expanded over a bounded query horizon. Exceptions remove instances. Overrides replace instances. Only concrete intervals inside the relevant window enter the overlap query.',
        'For a single resource, the booking service queries overlaps. If none exist, it inserts the new busy interval inside the same serialized operation. The serialization can come from a database transaction with range constraints, a single resource owner, a durable object, or another concurrency-control mechanism.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because scheduling conflicts reduce to interval overlap once time is normalized and recurrence is materialized for the query window. Half-open intervals make boundary behavior predictable: adjacent meetings do not overlap; real intersections do.',
        'It works in production only when the read path and write path are separated correctly. Free/busy can propose candidates. Booking must recheck and commit atomically.',
        'The privacy model also works because free/busy answers do not need event contents. A scheduler can know that Alice is busy from 10:00 to 10:30 without knowing why.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A room has bookings `[9:00,10:00)` and `[10:00,11:00)`. A request for `[10:30,11:00)` conflicts because `10:30 < 11:00` and `10:00 < 11:00`. A request for `[11:00,11:30)` is adjacent, not overlapping, and can be accepted if no other interval conflicts.',
        'For a group meeting, Alice is busy `[9:30,10:00)`, Bob is busy `[10:00,10:30)`, and the room is busy `[11:00,12:00)`. The aggregator merges those busy intervals inside the search window, then offers gaps such as `[10:30,11:00)`. When the user chooses that slot, the room booking still rechecks before insert.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The clean data-structure cost is modest. An interval tree can answer overlap queries in O(log n + k), where k is the number of reported overlaps. Merging m busy intervals for free/busy search is typically O(m log m) after sorting.',
        'The hard cost is system correctness. A scheduler needs idempotency keys, retry handling, outbox-style notifications, cancellation semantics, provisional holds, privacy rules, room capacity filters, working hours, travel buffers, and time-zone display rules.',
        'Time zones are a serious source of bugs. A recurring 9 AM meeting is not just a sequence of UTC timestamps if daylight saving rules change. Recurrence should be interpreted in the intended calendar time zone, then expanded into concrete instants for comparison.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Interval indexing wins for rooms, equipment, appointment slots, doctor schedules, maintenance windows, on-call rotations, classroom allocation, livestream booking, and any resource that cannot be double-booked.',
        'Free/busy aggregation wins when many calendars need to be searched without leaking full event details. It is enough to expose busy ranges, not titles, attendees, notes, or locations.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails if availability is treated as a lock. A free result can become stale before insertion. Only the atomic booking step can prevent double booking.',
        'It fails if recurrence rules are compared as rules instead of expanded into concrete instances inside a bounded horizon. It also fails if zero-length, all-day, floating-time, or daylight-saving cases are left implicit.',
        'It fails socially and legally if full event details are exposed when busy intervals would be enough. Privacy-preserving free/busy is a product requirement, not an optional optimization.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A meeting assistant receives a request for Alice, Bob, and Room 12 between 10:00 and 14:00. It asks each calendar for busy intervals, merges them, and finds candidate gaps. It ranks gaps by working hours, room capacity, and time zones, then proposes 11:30-12:00.',
        'When the user confirms, the room booking service rechecks Room 12 inside a transaction or single resource owner and inserts only if the interval is still free. Notifications are published through an outbox so booking and invite delivery do not diverge.',
        'If that final write fails, the assistant should return to search instead of pretending the earlier free/busy result was a reservation.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: RFC 5545 iCalendar at https://datatracker.ietf.org/doc/html/rfc5545, Google Calendar Freebusy query at https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query, RFC 7953 Calendar Availability at https://datatracker.ietf.org/doc/html/rfc7953, and CalDAV free-busy query semantics at https://icalendar.org/CalDAV-Access-RFC-4791/7-10-caldav-free-busy-query-report.html. Study Interval Tree, Segment Tree & Lazy Propagation, Idempotency, Transactional Outbox, and Cloudflare Durable Objects Case Study next.',
      ],
    },
  ],
};
