// DNSSEC NSEC3 authenticated denial: hashed owner-name intervals, signed
// non-existence proofs, wildcard denial, and opt-out risk.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'dnssec-nsec3-authenticated-denial-case-study',
  title: 'DNSSEC NSEC3 Authenticated Denial',
  category: 'Security',
  summary: 'How NSEC3 proves NXDOMAIN or NODATA by signing hashed owner-name intervals instead of returning a bare cacheable miss.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['denial proof', 'hash tradeoff'], defaultValue: 'denial proof' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function denialGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'q', label: 'qname', x: 0.8, y: 4.0, note: notes.q ?? 'missing' },
      { id: 'hash', label: 'hash', x: 2.1, y: 4.0, note: notes.hash ?? 'salt+iter' },
      { id: 'prev', label: 'prev', x: 3.6, y: 2.4, note: notes.prev ?? 'NSEC3' },
      { id: 'next', label: 'next', x: 5.2, y: 2.4, note: notes.next ?? 'covers' },
      { id: 'wild', label: 'wild', x: 3.6, y: 5.8, note: notes.wild ?? '*.zone' },
      { id: 'sig', label: 'sig', x: 6.7, y: 4.0, note: notes.sig ?? 'RRSIG' },
      { id: 'key', label: 'key', x: 8.0, y: 5.8, note: notes.key ?? 'DNSKEY' },
      { id: 'nx', label: 'NX', x: 8.4, y: 2.5, note: notes.nx ?? 'denial' },
      { id: 'cache', label: 'cache', x: 9.3, y: 4.0, note: notes.cache ?? 'SOA TTL' },
    ],
    edges: [
      { id: 'e-q-hash', from: 'q', to: 'hash' },
      { id: 'e-hash-prev', from: 'hash', to: 'prev' },
      { id: 'e-prev-next', from: 'prev', to: 'next' },
      { id: 'e-hash-wild', from: 'hash', to: 'wild' },
      { id: 'e-prev-sig', from: 'prev', to: 'sig' },
      { id: 'e-wild-sig', from: 'wild', to: 'sig' },
      { id: 'e-key-sig', from: 'key', to: 'sig' },
      { id: 'e-sig-nx', from: 'sig', to: 'nx' },
      { id: 'e-nx-cache', from: 'nx', to: 'cache' },
    ],
  }, { title });
}

function* denialProof() {
  yield {
    state: denialGraph('A missing owner name is hashed before interval lookup'),
    highlight: { active: ['q', 'hash', 'e-q-hash'], compare: ['prev', 'next'] },
    explanation: 'For a signed zone using NSEC3, the queried owner name is canonicalized and hashed with the zone parameters. The resolver is no longer looking for the literal missing name; it is looking for where that hash would fall.',
    invariant: 'Authenticated denial is a proof that absence is covered, not just an empty answer.',
  };

  yield {
    state: denialGraph('A signed NSEC3 interval covers the missing hash'),
    highlight: { active: ['hash', 'prev', 'next', 'e-hash-prev', 'e-prev-next'], compare: ['wild'] },
    explanation: 'The authoritative server returns an NSEC3 record whose hashed owner name and next-hashed-owner field bracket the missing query hash. That interval proves no exact owner name with that hash exists in the zone.',
  };

  yield {
    state: denialGraph('Wildcard absence is denied with its own NSEC3 proof', { wild: '*.no', sig: '2 sigs' }),
    highlight: { active: ['hash', 'wild', 'sig', 'e-hash-wild', 'e-wild-sig'], found: ['prev', 'next'] },
    explanation: 'NXDOMAIN and NODATA proofs also have to rule out wildcard synthesis when applicable. A signed denial usually proves both the exact queried name is absent and a matching wildcard cannot legitimately answer.',
  };

  yield {
    state: denialGraph('DNSKEY validation turns the denial into a cacheable negative answer', { nx: 'valid NX', cache: 'neg TTL' }),
    highlight: { found: ['key', 'sig', 'nx', 'cache', 'e-key-sig', 'e-sig-nx', 'e-nx-cache'], active: ['prev', 'wild'] },
    explanation: 'The resolver validates the NSEC3 RRSIGs through the DNSSEC chain of trust, then can cache the negative result under normal negative-cache rules. Without the signatures, this would be only an unsigned miss.',
  };
}

function* hashTradeoff() {
  yield {
    state: labelMatrix(
      'NSEC vs NSEC3',
      [
        { id: 'name', label: 'names' },
        { id: 'walk', label: 'walk' },
        { id: 'cost', label: 'cost' },
        { id: 'proof', label: 'proof' },
      ],
      [
        { id: 'nsec', label: 'NSEC' },
        { id: 'nsec3', label: 'NSEC3' },
      ],
      [
        ['plain', 'hashed'],
        ['easy', 'harder'],
        ['lower', 'higher'],
        ['range', 'h-range'],
      ],
    ),
    highlight: { active: ['name:nsec3', 'walk:nsec3', 'proof:nsec3'], compare: ['cost:nsec3'] },
    explanation: 'Classic NSEC exposes the next owner name and can make zone walking easy. NSEC3 stores hashed owner-name intervals, raising the work factor for casual enumeration while preserving signed denial proofs.',
    invariant: 'NSEC3 is about authenticated absence with less direct disclosure, not secrecy against all guessing.',
  };

  yield {
    state: labelMatrix(
      'NSEC3 parameters',
      [
        { id: 'alg', label: 'alg' },
        { id: 'salt', label: 'salt' },
        { id: 'iter', label: 'iter' },
        { id: 'opt', label: 'opt' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['hash', 'old alg'],
        ['mix input', 'reuse'],
        ['work', 'CPU load'],
        ['skip', 'gap'],
      ],
    ),
    highlight: { active: ['salt:job', 'iter:job', 'opt:job'], compare: ['iter:risk', 'opt:risk'] },
    explanation: 'NSEC3 adds parameters: hash algorithm, salt, iteration count, and flags such as opt-out. More iterations raise attacker and resolver work together, so the value is operationally constrained.',
  };

  yield {
    state: denialGraph('Opt-out lets large delegation-heavy zones avoid every unsigned child', { prev: 'opt', next: 'cover', nx: 'proof?' }),
    highlight: { active: ['prev', 'next', 'nx', 'e-prev-next', 'e-sig-nx'], compare: ['wild'], removed: ['cache'] },
    explanation: 'Opt-out allows a signed parent with many unsigned delegations to omit some insecure child names from the NSEC3 chain. That reduces zone size, but the resolver must account for a different denial shape.',
  };

  yield {
    state: labelMatrix(
      'Denial cache entries',
      [
        { id: 'nx', label: 'NX' },
        { id: 'nodata', label: 'NODATA' },
        { id: 'wild', label: 'wild' },
        { id: 'bogus', label: 'bogus' },
      ],
      [
        { id: 'proof', label: 'proof' },
        { id: 'reuse', label: 'reuse' },
      ],
      [
        ['span', 'neg TTL'],
        ['absent', 'neg TTL'],
        ['no match', 'scoped'],
        ['bad sig', 'no'],
      ],
    ),
    highlight: { found: ['nx:reuse', 'nodata:reuse'], compare: ['wild:reuse'], removed: ['bogus:reuse'] },
    explanation: 'A good resolver keeps the proof scope narrow. A signed absence proof can suppress repeated misses, but only for the name, type, class, and interval that the NSEC3 records actually justify.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'denial proof') yield* denialProof();
  else if (view === 'hash tradeoff') yield* hashTradeoff();
  else throw new InputError('Pick an NSEC3 view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'NSEC3 is the DNSSEC mechanism for authenticated denial of existence using hashed owner-name intervals. It lets an authoritative server prove that a name or type does not exist without returning an unsigned "no". The resolver validates the proof just like it validates positive DNSSEC data.',
        'RFC 5155 defines NSEC3 hashed authenticated denial of existence at https://www.rfc-editor.org/rfc/rfc5155. It builds on the DNSSEC validation model from RFC 4035 at https://www.rfc-editor.org/rfc/rfc4035.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'An NSEC3 chain is a sorted cyclic list over hashed owner names. Each record says: this hashed owner name exists, the next hashed owner name is X, and these record types exist at the owner. A missing query is hashed, then the server returns signed records showing the query hash falls between two adjacent hashes.',
        'For NXDOMAIN, the proof must also rule out wildcard answers that could synthesize a result. For NODATA, the owner name can exist while the requested type does not. The resolver has to interpret exact denial, type denial, wildcard denial, and opt-out flags carefully.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A client asks for typo.example.com A. The zone is signed with NSEC3. The authoritative server returns no A record, plus NSEC3 records covering the hash of typo.example.com and covering any relevant wildcard candidate. The resolver validates the RRSIGs with the zone DNSKEY, checks that the hash interval actually covers the query, and caches the negative answer using the SOA-derived negative TTL.',
        'The value over ordinary negative caching is authenticity. DNS Negative Cache & NXDOMAIN explains how absence can be reused. NSEC3 adds a signed proof that the absence was not invented by an attacker or a broken middlebox.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'NSEC3 does not make low-entropy names secret. Attackers can still guess likely names, hash them with the public parameters, and compare them with the chain. It primarily prevents easy zone walking where the zone hands out literal next names.',
        'High iteration counts are not free. They increase work for resolvers and authoritative servers as well as attackers. Opt-out reduces data for delegation-heavy zones, but it adds validation subtleties and can create surprising proof shapes.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study DNSSEC Chain of Trust Validation first, then DNS Negative Cache & NXDOMAIN, Sparse Merkle Tree Non-Membership, Merkle Tree, Hash Table, and Cache Invalidation & Versioning. The common pattern is authenticated absence: the system must prove not only what is present, but also what cannot be present in a committed set.',
      ],
    },
  ],
};
