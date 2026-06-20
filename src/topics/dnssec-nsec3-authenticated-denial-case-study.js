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
      heading: 'Why authenticated denial exists',
      paragraphs: [
        'DNSSEC signs DNS answers so a resolver can reject forged data. That promise is incomplete unless absence is signed too. An attacker who can forge NXDOMAIN can make a real host look missing, block mail delivery, or hide a service even though the positive records are protected.',
        'A signed negative answer has to prove a precise fact: this owner name does not exist, or this owner exists but does not have the requested RR type. The resolver must verify that fact from signed zone data instead of trusting the response code.',
        'NSEC3 is the hashed version of authenticated denial. It keeps the signed gap proof from NSEC, but the sorted chain is built over hashes of owner names instead of literal owner names.',
        {type: 'callout', text: 'Authenticated denial is not an empty answer; it is a signed proof that the hash of the missing name falls inside a committed gap and that no wildcard can legitimately answer.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Illustration_of_NSEC_and_NSEC3_chains_in_DNSSEC.svg', alt: 'Diagram of NSEC and NSEC3 chains showing a missing DNS name mapped into a hashed interval proof.', caption: 'NSEC and NSEC3 chain illustration by Matthäus Wander, own work, CC0 1.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first idea is to sign a statement that says "no such name." That is easy to say but hard to scope. DNS does not only ask whether a name exists. It asks whether a name exists at a type, whether a wildcard could synthesize an answer, and whether a delegation changes the authority boundary.',
        'Classic NSEC gives the missing scope a clean structure. Put all owner names in canonical order. Each signed NSEC record names the next owner and carries a bitmap of record types at the current owner. If the queried name falls between two signed owners, the gap proves nonexistence.',
        'That design is correct and simple. It also reveals the neighboring names. Repeating negative queries can walk the NSEC chain and enumerate much of the zone.',
      ],
    },
    {
      heading: 'Where the naive approach breaks',
      paragraphs: [
        'The problem is not only privacy. A negative DNSSEC answer can be several facts at once. For NXDOMAIN, the resolver needs a closest-encloser proof and a wildcard denial. For NODATA, the resolver needs proof that the owner exists but the requested type is absent. For DS at a delegation, the rules change again.',
        'Literal NSEC keeps those facts inspectable, but the price is disclosure. NSEC3 reduces direct disclosure by hashing names before ordering them. It does not make predictable names secret. It changes zone walking from reading names directly into collecting hashes and attempting an offline dictionary attack.',
      ],
    },
    {
      heading: 'The core idea',
      paragraphs: [
        'NSEC3 sorts hashed owner names in a cyclic order. Each NSEC3 record commits to three things: this hashed owner exists, the next hashed owner is a specific value, and the type bitmap at the original owner contains these RR types.',
        'A resolver canonicalizes the query name, applies the zone NSEC3 parameters, and checks whether the query hash is covered by a signed interval. The empty answer is not trusted. The signed interval is the evidence.',
        'The hash is not the security boundary by itself. The signature is. Hashing changes what the interval reveals; RRSIG validation makes the interval authoritative.',
      ],
    },
    {
      heading: 'How the proof is built',
      paragraphs: [
        'The signer chooses NSEC3 parameters for the zone, hashes each authoritative owner name, sorts the hashes, and writes a next-hashed-owner pointer into each NSEC3 record. The last record points back to the first, so the chain covers the whole hash ring.',
        'For an existing owner, the type bitmap says which RRsets exist there. If the owner exists but the requested type bit is absent, the response can prove NODATA. If the owner name does not exist, the response needs records that prove the closest existing ancestor, the next closer name that does not exist, and the absence of a matching wildcard when one would matter.',
        'Every NSEC3 record in a proof must validate under the DNSSEC chain of trust. The resolver also checks that the NSEC3 records use one consistent hash algorithm, iteration count, salt, and flag value shape for the proof it is processing.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a resolver asks for typo.example.com A and the signed zone has no such owner. The authoritative server hashes typo.example.com with the zone parameters, then returns an NSEC3 record whose owner hash and next-hashed-owner field cover that query hash.',
        'That interval alone is not enough for NXDOMAIN. The resolver also needs to know which existing ancestor is the closest encloser and whether *.example.com, or another relevant wildcard candidate, could have answered. A valid NXDOMAIN denial rules out both the exact name path and wildcard synthesis.',
        'For a NODATA case, the shape is different. If www.example.com exists but has no AAAA record, the resolver expects an NSEC3 record matching the hash of www.example.com, plus a type bitmap that does not contain AAAA or CNAME in the relevant case.',
      ],
    },
    {
      heading: 'How to read the visualization',
      paragraphs: [
        'In the denial-proof view, start at qname and watch it move through the hash node before it reaches the signed interval. That state change matters because the resolver is no longer comparing literal names. It is comparing the query hash against the zone commit points.',
        'The prev and next nodes are the denial proof. When they are highlighted together, the animation is showing the covered gap: no signed owner hash can sit between those two values unless the zone signer lied or the signature chain is invalid.',
        'The wildcard branch is a separate obligation, not decoration. A missing exact name can still receive a synthesized answer from a wildcard, so the proof is unfinished until the wildcard candidate is also ruled out.',
        'In the hash-tradeoff view, read each matrix row as an operational tax. Hashed intervals reduce direct name disclosure, but iteration count, salt, opt-out, and negative-cache scope decide how expensive and how fragile the deployment becomes.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is coverage of the sorted hash ring. If the zone signer has signed adjacent hash points H1 and H2, and the query hash falls between them, then the signed zone data commits that no represented owner hash exists in that interval.',
        'For NODATA, the bitmap is the invariant. The owner is represented, and the signed bitmap lists the RR types present at that owner. If the requested type bit is absent under the DNSSEC signature, the resolver has a signed reason to return no data.',
        'For wildcard denial, the resolver proves that the candidate wildcard owner is absent or cannot answer. This prevents a malicious server from hiding a valid wildcard response behind a false NXDOMAIN.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'NSEC3 adds signer work, response bytes, resolver hash work, signature validation, and implementation complexity. A negative response can carry multiple NSEC3 records and signatures, so the cost is not the same as a small unsigned NXDOMAIN.',
        'Current operational guidance is conservative. RFC 9276 updates RFC 5155 and recommends NSEC instead of NSEC3 unless NSEC3 is needed. If NSEC3 is used, the recommended parameters are SHA-1 with zero extra iterations and an empty salt. Extra iterations increase resolver and authoritative-server work and can amplify CPU-exhaustion attacks.',
        'Negative caching still matters. A validated denial can be cached for the appropriate negative TTL, but the cache entry must stay scoped to the name, type, class, and proof interval that the records actually justify.',
      ],
    },
    {
      heading: 'Where NSEC3 wins',
      paragraphs: [
        'NSEC3 is useful when a signed zone needs authenticated negative answers and direct NSEC zone walking is an unacceptable disclosure. It is most natural for large zones where exposing literal neighboring names is more harmful than the added operational cost.',
        'Opt-out can help very large delegation-heavy zones avoid signing every unsigned child delegation. That is a registry-scale tool, not a default setting for ordinary zones.',
        'The deeper lesson is authenticated absence. NSEC3 teaches the same shape used by Merkle non-membership proofs: a system proves absence by showing where the missing item would have to be in an authenticated order.',
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        'NSEC3 is not confidentiality for DNS names. Public, human-guessable labels such as www, mail, login, api, and staging can be hashed and checked offline. If the name itself must remain secret, DNS publication is already the wrong primitive.',
        'For small zones, static zones, or zones where name disclosure is not a real issue, classic NSEC is simpler and usually easier to operate. The proof is easier to inspect, and the resolver does not pay the NSEC3 hashing path.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'A resolver should reject proofs with bad signatures, unsupported hash algorithms, inconsistent NSEC3 parameters, intervals that do not cover the needed hash, or bitmaps that contradict the denial. Those are not cacheable misses; they are bogus responses or validation failures.',
        'Opt-out is easy to misunderstand. An opt-out span can cover unsigned delegations without asserting their existence or nonexistence. Treating it like an ordinary full denial can produce the wrong validation result.',
        'Hash collisions are designed to be highly unlikely, but the protocol has to define behavior. If a nonexistent query hash collides with an existing NSEC3 owner in a way that prevents a valid denial, the authoritative server cannot prove the denial normally.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 5155, DNSSEC Hashed Authenticated Denial of Existence, at https://www.rfc-editor.org/rfc/rfc5155; RFC 9276, Guidance for NSEC3 Parameter Settings, at https://www.rfc-editor.org/rfc/rfc9276; and RFC 4035, DNSSEC Protocol Modifications, at https://www.rfc-editor.org/rfc/rfc4035.',
        'Study DNSSEC Chain of Trust Validation for the signature path, DNS Negative Cache & NXDOMAIN for scoped negative reuse, Sparse Merkle Tree Non-Membership for the authenticated-absence pattern, Merkle Tree for signed commitment structure, Hash Table for hash behavior, and Cache Invalidation & Versioning for TTL tradeoffs.',
      ],
    },
  ],
};
