// Storage Access API: embedded cross-site documents, partitioned vs
// unpartitioned storage, user activation, permission grants, and fallbacks.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'storage-access-api-third-party-cookie-case-study',
  title: 'Storage Access API Third-Party Cookie Gate',
  category: 'Security',
  summary: 'How embedded cross-site documents check and request access to third-party cookies and unpartitioned state under modern browser privacy controls.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['embed request', 'fallback design'], defaultValue: 'embed request' },
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

function storageGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'top', label: 'top site', x: 0.5, y: 4.2, note: notes.top ?? 'publisher' },
      { id: 'frame', label: 'iframe', x: 2.8, y: 4.2, note: notes.frame ?? 'idp/embed' },
      { id: 'part', label: 'partition', x: 4.7, y: 2.8, note: notes.part ?? 'top+embed' },
      { id: 'unpart', label: 'unpart', x: 4.7, y: 5.6, note: notes.unpart ?? 'embed site' },
      { id: 'check', label: 'check', x: 6.4, y: 4.2, note: notes.check ?? 'hasAccess' },
      { id: 'prompt', label: 'grant', x: 8.0, y: 2.8, note: notes.prompt ?? 'user/UA' },
      { id: 'cookie', label: 'cookie', x: 8.0, y: 5.6, note: notes.cookie ?? 'session' },
      { id: 'result', label: 'result', x: 9.5, y: 4.2, note: notes.result ?? 'allow/deny' },
    ],
    edges: [
      { id: 'e-top-frame', from: 'top', to: 'frame', weight: '' },
      { id: 'e-frame-part', from: 'frame', to: 'part', weight: '' },
      { id: 'e-frame-unpart', from: 'frame', to: 'unpart', weight: '' },
      { id: 'e-frame-check', from: 'frame', to: 'check', weight: '' },
      { id: 'e-check-prompt', from: 'check', to: 'prompt', weight: '' },
      { id: 'e-prompt-cookie', from: 'prompt', to: 'cookie', weight: '' },
      { id: 'e-cookie-result', from: 'cookie', to: 'result', weight: '' },
      { id: 'e-check-result', from: 'check', to: 'result', weight: '' },
    ],
  }, { title });
}

function* embedRequest() {
  yield {
    state: storageGraph('A cross-site iframe may start with partitioned storage only'),
    highlight: { active: ['top', 'frame', 'part', 'e-top-frame', 'e-frame-part'], compare: ['unpart'] },
    explanation: 'Modern browsers often block or partition third-party cookies. An embedded document should not assume it can read the same unpartitioned cookie jar it has when visited as a top-level site.',
    invariant: 'The top site is part of the storage context for embedded third-party state.',
  };

  yield {
    state: storageGraph('The embed checks whether it already has storage access', { check: 'hasStorageAccess', result: 'false' }),
    highlight: { active: ['frame', 'check', 'result', 'e-frame-check', 'e-check-result'], compare: ['cookie'] },
    explanation: 'The Storage Access API gives the embed a capability check. If access is unavailable, the frame can request access instead of failing silently or assuming cookies work.',
  };

  yield {
    state: labelMatrix(
      'Request gates',
      [
        { id: 'embed', label: 'embedded' },
        { id: 'gesture', label: 'gesture' },
        { id: 'policy', label: 'policy' },
        { id: 'browser', label: 'browser' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'failure' },
      ],
      [
        ['third party', 'top-level only'],
        ['user intent', 'no activation'],
        ['iframe allow', 'blocked'],
        ['privacy gate', 'denied'],
      ],
    ),
    highlight: { active: ['gesture:role', 'policy:role', 'browser:role'], compare: ['embed:failure'] },
    explanation: 'Requests are intentionally gated. Browsers may require user activation, iframe delegation, prior first-party interaction, or other privacy conditions before granting unpartitioned access.',
  };

  yield {
    state: storageGraph('A granted request opens the embed site cookie jar', { prompt: 'granted', cookie: 'unpart ok', result: 'logged in' }),
    highlight: { active: ['prompt', 'cookie', 'result', 'e-prompt-cookie', 'e-cookie-result'], found: ['unpart'] },
    explanation: 'When granted, the embedded document can access its unpartitioned cookies and state according to browser rules. The grant should be treated as scoped and revocable, not a permanent entitlement.',
  };

  yield {
    state: storageGraph('A denied request must degrade without breaking the page', { prompt: 'denied', cookie: 'none', result: 'fallback' }),
    highlight: { removed: ['cookie'], active: ['check', 'prompt', 'result', 'e-check-prompt'], compare: ['part'] },
    explanation: 'The embed needs a fallback: open a top-level login, use a signed one-time token, show a logged-out widget, or use partitioned state. Silent broken iframes are a product bug.',
  };
}

function* fallbackDesign() {
  yield {
    state: labelMatrix(
      'Embed patterns',
      [
        { id: 'sso', label: 'SSO' },
        { id: 'pay', label: 'payment' },
        { id: 'comments', label: 'comments' },
        { id: 'ads', label: 'ads' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'fallback' },
      ],
      [
        ['login state', 'top login'],
        ['session', 'redirect'],
        ['account', 'guest mode'],
        ['tracking?', 'no access'],
      ],
    ),
    highlight: { found: ['sso:fallback', 'pay:fallback'], removed: ['ads:need'] },
    explanation: 'Different embeds have different legitimacy. SSO and payments may need first-party state. Ads and broad tracking usually should not get unpartitioned storage access.',
    invariant: 'Storage access is a narrow compatibility valve, not a tracking entitlement.',
  };

  yield {
    state: storageGraph('A top-level bounce can establish first-party state', { top: 'embed site', frame: 'top login', unpart: 'first party', cookie: 'session set', result: 'return' }),
    highlight: { active: ['top', 'unpart', 'cookie', 'result'], compare: ['frame'] },
    explanation: 'Some flows use a top-level visit to the embedded service for login or consent, then return to the original site. That makes state explicit instead of relying on invisible third-party cookies.',
  };

  yield {
    state: storageGraph('Partitioned state keeps per-top-site isolation', { part: 'per publisher', cookie: 'partitioned', result: 'limited' }),
    highlight: { active: ['frame', 'part', 'cookie', 'result', 'e-frame-part'], compare: ['unpart'] },
    explanation: 'Partitioned cookies or storage can let an embed keep state per top-level site without linking identity across all publishers. That is often better for privacy than requesting unpartitioned state.',
  };

  yield {
    state: labelMatrix(
      'Design checklist',
      [
        { id: 'check', label: 'check first' },
        { id: 'gesture', label: 'gesture UX' },
        { id: 'token', label: 'token alt' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'purpose', label: 'purpose' },
        { id: 'risk' },
      ],
      [
        ['precheck', 'false assume'],
        ['user intent', 'dark pattern'],
        ['one-time flow', 'replay'],
        ['grant history', 'privacy'],
      ],
    ),
    highlight: { active: ['check:purpose', 'gesture:purpose', 'token:purpose'], compare: ['audit:risk'] },
    explanation: 'A well-designed embed checks access, explains the request, supports a top-level or token fallback, and logs the grant path for privacy review.',
  };

  yield {
    state: storageGraph('The complete case study is an embedded identity widget', { top: 'news site', frame: 'idp frame', check: 'request', prompt: 'user click', result: 'sign in' }),
    highlight: { active: ['top', 'frame', 'check', 'prompt', 'cookie', 'result'], found: ['e-top-frame', 'e-check-prompt'] },
    explanation: 'An identity provider embedded on a news site checks storage access. If denied, it asks after a user click or opens a top-level login. If granted, it reads its session cookie and renders the signed-in widget.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'embed request') yield* embedRequest();
  else if (view === 'fallback design') yield* fallbackDesign();
  else throw new InputError('Pick a Storage Access view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a browser-state permission flow. The top-level site is the page in the address bar, the embedded site is the iframe origin, partitioned storage is state keyed by both sites, and unpartitioned storage is the embedded site state it would use as a first party. Active nodes show which state boundary is being tested.',
        'Visited checks are browser decisions already known to the application. Found markers mean a grant, denial, or fallback branch is now the correct product state. The safe inference is that a frame must branch on access; it cannot assume third-party cookies exist.',
        {type:'callout', text:'The API turns ambient cross-site cookie reach into a browser-mediated capability with explicit granted, denied, and fallback states.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Third-party cookies let an embedded origin read the same cookie jar across many unrelated top-level sites. That made sign-in widgets and payment frames convenient, but it also enabled tracking that users could not see or meaningfully control. Modern browsers increasingly block or partition that state.',
        'The Storage Access API exists as a narrow compatibility path. An embedded document can check whether it has access to unpartitioned cookies or state, request access under browser policy, and fall back when the request is denied. The API is not a return to ambient cross-site storage.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The old approach was to read document.cookie inside the iframe and proceed. If idp.example had a login cookie, the idp.example iframe inside news.example could render the signed-in widget. Product code often treated missing cookies as a rare edge case.',
        'That approach broke the privacy boundary. A visible identity widget and a hidden tracker used the same browser mechanism. Since the browser cannot trust every embed to self-police, it makes the top-level site part of the storage decision or blocks unpartitioned access by default.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that the iframe no longer owns the whole context. It may have partitioned state for this top-level site, no unpartitioned cookie access, and no guarantee that a request will be granted. Browser behavior can depend on user activation, iframe sandbox flags, permissions policy, prior interaction, related website sets, private browsing, and user settings.',
        'Application code that has only a success path fails as a product. It produces blank widgets, sign-in loops, or instructions to weaken privacy settings. Denial is an expected branch, not an exception that can be ignored.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat unpartitioned storage as a capability. A capability is permission to do a specific thing, granted by an authority under rules, and possibly unavailable. The frame should first ask what it can do without the capability, then request it only when a visible user task needs it.',
        'Partitioned state is often enough for local preferences, guest comments, or per-publisher widgets. Top-level redirects or signed tokens can handle many login and payment flows. The API should be reserved for cases where unpartitioned browser state is the least invasive way to finish the user-facing task.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Inside the embedded document, code feature-detects the API and calls document.hasStorageAccess when available. If access is already present, it can use the relevant cookies or requested storage handles according to browser rules. If access is absent, it renders a limited state or waits for a user action before requesting access.',
        'A request may need transient user activation such as a click, and sandboxed iframes need the right sandbox tokens. The browser then resolves or rejects the request. A robust embed records the outcome and moves to granted, denied, top-level-login, token, or partitioned-mode behavior.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness is a state-machine argument. The application has explicit states for unknown, no access, request pending, granted, denied, and fallback. Every transition is caused by a browser result or user action, so the UI never depends on a cookie read that the browser may legally hide.',
        'The privacy invariant is that cross-site identity does not flow silently from the embedded origin into every top-level site. A browser grant creates a scoped exception. Without that grant, the top-level site remains part of the storage boundary and the iframe must use partitioned or explicit alternatives.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The runtime cost is small, but the product cost is real. Each embed needs feature detection, branch handling, user-action timing, iframe policy setup, telemetry, fallback UX, and browser compatibility tests. Doubling the number of third-party embeds roughly doubles the audit surface because each one may request different state.',
        'The security cost is that storage access can expose an existing session to an embedded context. It does not authenticate the user, authorize actions, prevent CSRF, or validate postMessage origins. Normal web security still has to carry those jobs.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The fit is visible user tasks: single sign-on widgets, subscription checks, payment flows, comment boxes, support chat, and account panels. The user can connect the request to the action they are taking, and denial can lead to a clear top-level login or guest branch.',
        'It is also useful as migration telemetry. Every request marks a place where a product still depends on unpartitioned third-party state. That inventory can guide moves to partitioned cookies, first-party redirects, server-issued tokens, or direct first-party integrations.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails for hidden tracking and broad analytics joins. Those uses are exactly what partitioning and blocking are meant to reduce. Requesting access on page load or in invisible frames is both brittle and hostile to the browser privacy model.',
        'It also fails if treated as a portable identity protocol. Browser support and policy vary, and newer methods such as top-level requestStorageAccessFor are not universal. Authentication, authorization, and session design need protocols outside this API.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A news site embeds idp.example in an iframe. On load, document.hasStorageAccess returns false, so the iframe renders a signed-out button using public assets and partitioned state. The user clicks Sign in, giving the frame a user activation for the request.',
        'If requestStorageAccess resolves, the frame reads the idp.example session cookie and renders Subscriber: active. If it rejects, the frame opens a top-level login flow with a return URL or asks the server for a one-time token. In both branches, the page remains usable and the state transition is explicit.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources start with MDN Using the Storage Access API at https://developer.mozilla.org/en-US/docs/Web/API/Storage_Access_API/Using. Then read the MDN API reference at https://developer.mozilla.org/en-US/docs/Web/API/Storage_Access_API and the Privacy CG draft at https://privacycg.github.io/storage-access/.',
        'Study SameSite Cookies and CSRF for cookie attachment, then Browser Cache Partitioning Network Key for state partitioning. After that, use Permissions Policy Feature Gate, OAuth PKCE Token Lifecycle, and postMessage Origin Validation to design the surrounding flow.',
      ],
    },
  ],
};
