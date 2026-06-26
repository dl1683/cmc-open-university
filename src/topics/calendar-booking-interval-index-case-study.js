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
    { heading: 'How to read the animation', paragraphs: [
      {type:'callout', text:'A calendar booking system is an interval overlap index until the user clicks book, then it becomes a serialized check-and-insert problem.'},
      {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/7/73/Pert_example_gantt_chart.gif', alt:'Gantt chart showing tasks as horizontal intervals on a time axis', caption:'A Gantt chart draws work as intervals on a time axis; calendar booking uses the same interval shape but adds overlap checks, privacy, recurrence, and atomic reservation. Source: Wikimedia Commons, Dbsheajr, CC BY-SA 3.0/GFDL.'},
      'Read every event as a half-open interval [start, end). The start instant is included and the end instant is excluded, so [10:00, 11:00) and [11:00, 11:30) can touch without overlapping. Active nodes show the request and busy intervals being tested; the transaction node marks the write boundary.',
    ] },
    { heading: 'Why this exists', paragraphs: [
      'Calendar booking exists to allocate scarce time without double booking. The resource can be a room, doctor, tutor, machine, or shared equipment. The system must answer quickly while respecting recurrence, time zones, privacy, and concurrent users.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is scanning every event and checking overlap. That works for one small personal calendar. It becomes expensive when an assistant searches many calendars, many rooms, and many candidate slots.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is concurrent mutation. Two users can both see Room 12 as free from 10:30 to 11:00 and both try to insert a booking. Availability is not a lock; only a serialized check-and-insert can prevent both writes from succeeding.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Split scheduling into query and commit. The query layer normalizes busy objects into half-open intervals and uses an interval index to find conflicts or gaps. The commit layer rechecks the chosen interval and inserts it inside one transaction, lock, durable object, or resource owner.',
    ] },
    { heading: 'How it works', paragraphs: [
      'Recurring events are expanded over a bounded query window, exceptions remove instances, and overrides replace instances. After time-zone interpretation, each concrete busy interval can be compared by instant. The overlap predicate is proposedStart < busyEnd and busyStart < proposedEnd.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The interval argument is exact for half-open intervals: two intervals overlap if and only if each starts before the other ends. The system argument needs serialization. If every accepted booking for one resource is checked and inserted in one serial order, a later overlapping request must see the earlier booking and be rejected.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'A balanced interval tree can answer overlap queries in O(log n + k), where n is stored intervals and k is returned conflicts. Merging m busy intervals for group scheduling costs O(m log m) if sorting is needed. When calendars double, aggregation and recurrence expansion roughly double before ranking and product rules run.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'This pattern fits room booking, appointment scheduling, equipment rental, classroom allocation, on-call rotations, maintenance windows, and interview scheduling. Free/busy aggregation is useful because it can expose busy ranges without leaking titles, notes, attendees, or locations.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'It fails when a free result is treated as a reservation. It also fails when recurrence, all-day events, zero-length events, daylight saving transitions, or floating times are left implicit. Time semantics become correctness bugs when two clients race or when an event repeats across a clock change.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'Room 12 has [9:00, 10:00) and [10:00, 11:00). A request for [10:30, 11:00) conflicts because 10:30 < 11:00 and 10:00 < 11:00. A request for [11:00, 11:30) does not conflict because 11:00 < 11:00 is false.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: RFC 5545 iCalendar at https://datatracker.ietf.org/doc/html/rfc5545, Google Calendar Freebusy query at https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query, RFC 7953 Calendar Availability at https://datatracker.ietf.org/doc/html/rfc7953, and CalDAV free-busy semantics at https://datatracker.ietf.org/doc/html/rfc4791.',
      'Study Interval Tree, Segment Tree and Lazy Propagation, Database Range Constraints, Idempotency Keys, Transactional Outbox, Time Zone Database Semantics, and Cloudflare Durable Objects Case Study next.',
    ] },
  ],
};
