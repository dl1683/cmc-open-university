// Page bootstrap: decides between homepage and topic page, wires search,
// navigation, and the theme toggle. All content comes from the registry.

import { topics, categories, searchTopics, linkifyByTitle } from './registry.js';
import {
  learningTracks,
  learningProfiles,
  getLearningProfileById,
  domainGuides,
  trackTopicIds,
  uniqueTrackTopicIds,
  getTopicTrackPlacements,
  searchTracks,
  getTrackById,
  getTrackPrerequisiteIds,
  getTracksByIds,
  getLearningProfilesForTrack,
} from './tracks.js';
import { createTopicRuntime } from './core/visualizer.js';

// Render text with explicit URLs as external links, and the first mention of
// any other topic's title as an inline link to that topic's page. Used for
// explanations and study notes.
const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;
const topicById = new Map(topics.map((entry) => [entry.id, entry]));
const COURSE_STATE_KEY = 'dsjs-course-state-v1';
const COURSE_STATE_DEFAULT = {
  topics: {},
  autoCompactNotes: true,
  updatedAt: 0,
};

function loadCourseState() {
  try {
    const raw = JSON.parse(localStorage.getItem(COURSE_STATE_KEY) || '{}');
    return {
      topics: raw.topics ?? {},
      autoCompactNotes: raw.autoCompactNotes ?? true,
      updatedAt: raw.updatedAt ?? Date.now(),
    };
  } catch {
    return { ...COURSE_STATE_DEFAULT };
  }
}

function saveCourseState(state) {
  state.updatedAt = Date.now();
  localStorage.setItem(COURSE_STATE_KEY, JSON.stringify(state));
}

const courseState = loadCourseState();
const FRAME_LOG_LIMIT = 40;
const PROFILE_QUERY_KEY = 'profile';

function getActiveProfileFromQuery() {
  const value = new URLSearchParams(location.search).get(PROFILE_QUERY_KEY);
  return getLearningProfileById(value);
}

function getTopicProgressState(topicId) {
  return {
    lastStep: 0,
    totalSteps: 0,
    completed: false,
    ...(courseState.topics[topicId] ?? {}),
  };
}

function setTopicProgress(topicId, patch) {
  const current = getTopicProgressState(topicId);
  courseState.topics[topicId] = {
    ...current,
    ...patch,
    lastVisited: Date.now(),
  };
  saveCourseState(courseState);
}

function isTopicCompleted(topicId) {
  return Boolean(getTopicProgressState(topicId).completed);
}

function getTrackCompletion(track) {
  const topicIds = uniqueTrackTopicIds(track);
  const total = topicIds.length;
  let completed = 0;
  let nextIndex = -1;
  for (let i = 0; i < topicIds.length; i += 1) {
    if (isTopicCompleted(topicIds[i])) completed += 1;
    else if (nextIndex === -1) nextIndex = i;
  }
  const nextTopicId = nextIndex === -1 ? (topicIds[0] ?? null) : topicIds[nextIndex];
  return {
    topicIds,
    total,
    completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    nextTopicId,
    isComplete: completed === total && total > 0,
  };
}

function atModulo(position, step) {
  return Number.isFinite(position) && Number.isFinite(step) && step > 0 && position % step === 0;
}

function getTrackLockState(track) {
  const prerequisiteIds = getTrackPrerequisiteIds(track);
  if (!prerequisiteIds.length) {
    return {
      isLocked: false,
      requiredCount: 0,
      missing: [],
    };
  }

  const missing = [];
  for (const prerequisiteId of prerequisiteIds) {
    const prerequisiteTrack = getTrackById(prerequisiteId);
    if (!prerequisiteTrack) {
      missing.push({
        id: prerequisiteId,
        title: prerequisiteId,
        completed: 0,
        total: 0,
      });
      continue;
    }
    const prerequisiteCompletion = getTrackCompletion(prerequisiteTrack);
    if (!prerequisiteCompletion.isComplete) {
      missing.push({
        id: prerequisiteTrack.id,
        title: prerequisiteTrack.shortTitle ?? prerequisiteTrack.title,
        completed: prerequisiteCompletion.completed,
        total: prerequisiteCompletion.total,
      });
    }
  }

  return {
    isLocked: missing.length > 0,
    requiredCount: prerequisiteIds.length,
    missing,
  };
}

function trackChipText(track) {
  return track.shortTitle ?? track.title;
}

function getAutoCompactNotes() {
  return courseState.autoCompactNotes !== false;
}

function setAutoCompactNotes(value) {
  courseState.autoCompactNotes = Boolean(value);
  saveCourseState(courseState);
}

function formatTopicState(topicId) {
  const state = getTopicProgressState(topicId);
  if (!state.totalSteps || state.totalSteps < 1) return null;
  const lastStep = Math.min(state.lastStep + 1, state.totalSteps);
  if (state.completed) return `Completed • step ${lastStep}/${state.totalSteps}`;
  return `In progress • step ${lastStep}/${state.totalSteps}`;
}

function setProgressText(root, topicId) {
  const target = root?.querySelector?.('[data-topic-progress]');
  if (!target) return;
  target.textContent = formatTopicState(topicId) || 'Not started yet';
}

function resetFrameLog(log, topicId) {
  if (!log) return;
  log.dataset.topicId = topicId;
  log.replaceChildren();
}

function updateFrameLog(log, topicId, step, index, total) {
  if (!log) return;
  if (log.dataset.topicId !== topicId) resetFrameLog(log, topicId);
  const preview = getFramePreview(step, index, total);
  const item = document.createElement('li');
  item.className = 'frame-log-item';
  item.dataset.index = String(index);
  item.textContent = `Frame ${index + 1}/${total}: ${preview}`;
  item.title = step.explanation;
  log.appendChild(item);

  for (const previous of log.children) previous.classList.remove('active');
  item.classList.add('active');

  while (log.children.length > FRAME_LOG_LIMIT) log.removeChild(log.firstChild);

  item.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function getFramePreview(step, index, total) {
  const text = String(step.explanation ?? '').replace(/\s+/g, ' ').trim();
  const base = text.length > 0 ? text : `Frame ${index + 1} of ${total}`;
  return base.length <= 120 ? base : `${base.slice(0, 117)}…`;
}

function setStudySectionsCompact(root, compactMode, activeIndex = Number.NaN) {
  if (!root) return;
  const sections = [...root.querySelectorAll('[data-study-section]')];
  sections.forEach((section, index) => {
    const idx = Number.parseInt(section.dataset.studySectionIndex, 10);
    const isActive = Number.isInteger(activeIndex) && idx === activeIndex;
    const nearby = Number.isInteger(activeIndex) && Math.abs(idx - activeIndex) <= 1;
    section.open = (!compactMode || Number.isNaN(idx) || idx < 2 || isActive || nearby);
  });
}

function normalizeHeading(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, '')
    .trim();
}

function getArticleHeadings(articleSections) {
  const sections = Array.isArray(articleSections) ? articleSections : [];
  const headings = new Set();
  for (const section of sections) headings.add(normalizeHeading(section?.heading));
  return headings;
}

function appendStudyBlock(body, block, excludeId) {
  if (!body) return;
  if (typeof block === 'string') {
    const p = document.createElement('p');
    renderLinkedText(p, block, excludeId);
    body.appendChild(p);
    return;
  }
  if (!block || typeof block !== 'object') return;
  if (block.type === 'bullets' && Array.isArray(block.items)) {
    const list = document.createElement('ul');
    list.className = 'study-list';
    for (const item of block.items) {
      const li = document.createElement('li');
      renderLinkedText(li, String(item), excludeId);
      list.appendChild(li);
    }
    body.appendChild(list);
    return;
  }
  if (block.type === 'quote' && typeof block.text === 'string') {
    const bq = document.createElement('blockquote');
    bq.className = 'study-quote';
    const p = document.createElement('p');
    renderLinkedText(p, block.text, excludeId);
    bq.appendChild(p);
    if (block.attribution) {
      const cite = document.createElement('cite');
      cite.textContent = `— ${block.attribution}`;
      bq.appendChild(cite);
    }
    body.appendChild(bq);
    return;
  }
  if (block.type === 'table' && Array.isArray(block.headers) && Array.isArray(block.rows)) {
    const table = document.createElement('table');
    table.className = 'study-table';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const h of block.headers) {
      const th = document.createElement('th');
      th.textContent = h;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    for (const row of block.rows) {
      const tr = document.createElement('tr');
      for (const cell of row) {
        const td = document.createElement('td');
        td.textContent = cell;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    body.appendChild(table);
    return;
  }
  if (block.type === 'code' && typeof block.text === 'string') {
    const pre = document.createElement('pre');
    pre.className = 'study-code';
    const code = document.createElement('code');
    code.textContent = block.text;
    if (block.language) code.dataset.language = block.language;
    pre.appendChild(code);
    body.appendChild(pre);
    return;
  }
  if (block.type === 'diagram' && typeof block.text === 'string') {
    const pre = document.createElement('pre');
    pre.className = 'study-diagram';
    pre.textContent = block.text;
    pre.setAttribute('aria-label', block.label || 'Diagram');
    body.appendChild(pre);
    return;
  }
  if (block.type === 'note' && typeof block.text === 'string') {
    const aside = document.createElement('aside');
    aside.className = 'study-note';
    const p = document.createElement('p');
    renderLinkedText(p, block.text, excludeId);
    aside.appendChild(p);
    body.appendChild(aside);
    return;
  }
  if (typeof block.text === 'string') {
    const p = document.createElement('p');
    renderLinkedText(p, block.text, excludeId);
    body.appendChild(p);
  }
}

function appendSectionBody(body, blocks, excludeId) {
  const items = Array.isArray(blocks) ? blocks : [blocks];
  for (const block of items) {
    appendStudyBlock(body, block, excludeId);
  }
}

function buildContextualStudySections(entry) {
  if (!entry) return [];

  const headingSet = getArticleHeadings(entry.article?.sections ?? []);
  const sections = [];
  const buildsOn = (entry.buildsOn ?? [])
    .map((id) => topicById.get(id))
    .filter(Boolean);
  const leadsTo = topics.filter((topic) => (topic.buildsOn ?? []).includes(entry.id));
  const placements = getTopicTrackPlacements(entry.id);
  const activePlacement = placements[0];
  const categoryGuides = {
    'Data Structures': 'Trace one node by one pointer/slot and always name what changed.',
    Sorting: 'Track element movement decisions and explain why any swap is safe for order.',
    Searching: 'Name how each step narrows the candidate set and why no candidate is skipped incorrectly.',
    Algorithms: 'State the invariant before each step and show what it lets you drop.',
    Concepts: 'Translate the mechanism into a reusable rule you can apply in later designs.',
    Systems: 'Connect state transitions in this frame to latency, ownership, and boundary behavior.',
    Security: 'Treat correctness as an explicit trust boundary, not a final output.',
    'AI & ML': 'Tie each step to cost, memory layout, and quality/error tradeoffs.',
    Papers: 'Extract the core mechanism, then explain what part is exact and what is an approximation.',
  };
  const categoryGuide = categoryGuides[entry.category] || 'Ask what property stays true after this frame.';
  const prerequisiteLine = buildsOn.length > 0
    ? `Before this topic, review ${buildsOn.map((topic) => topic.title).join(', ')}.`
    : 'This topic has no explicit prerequisite list, so treat it as an early entry in its path.';
  const unlockLine = leadsTo.length > 0
    ? `This unlocks: ${leadsTo.map((topic) => topic.title).join(', ')}.`
    : 'Use the completion of this topic as a checkpoint before moving to a broader application topic.';
  const courseLine = activePlacement
    ? `You are studying this as part of ${activePlacement.track.title} (${activePlacement.module.title}), topic ${activePlacement.absoluteIndex + 1} of ${activePlacement.total} in that path.`
    : 'Use this page as a standalone study point, then follow its Next Up topics to stay on track.';

  if (!headingSet.has('learning map')) {
    sections.push({
      heading: 'Learning map',
      paragraphs: [
        prerequisiteLine,
        unlockLine,
        categoryGuide,
        courseLine,
      ],
    });
  }

  if (!headingSet.has('frame by frame checkpoints')) {
    sections.push({
      heading: 'Frame by frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'At each frame, identify the active state element and the explicit rule that allows it to change.',
            'After the change, restate the invariant that remains true and why no candidate was invalidly modified.',
            `If this topic is your first pass, replay once and only answer: "What state changed first?" "What stayed stable?"`,
            'Then map the frame to one real question: lookup, scheduling, ordering, or memory safety.',
            'Pause at transition points where ownership, order, or memory references are reassigned.',
          ],
        },
      ],
    });
  }

  if (!headingSet.has('micro checks')) {
    sections.push({
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you explain one correct-by-construction rule for this operation in one sentence?',
            'Can you state what changes in O(1), O(log n), or O(n) terms?',
            'Can you point to one scenario where this operation is the wrong tool?',
            'Can you write a one-line example where this topic is the controlling bottleneck?',
          ],
        },
      ],
    });
  }

  if (!headingSet.has('try this now')) {
    const promptByCategory = {
      'Data Structures': 'Build a tiny custom version with 3 operations, then run three edge inputs: empty state, one element, and repeated insert/remove.',
      Sorting: 'Sort 20 random values by hand with your own trace, then compare operation count to the animation.',
      Searching: 'Build input where the search target is missing and verify the final stop condition is logically complete.',
      Algorithms: 'Change one condition in the input and describe how the complexity story changes.',
      Concepts: 'Try the same sequence with one assumption removed and explain which proof step breaks.',
      Systems: 'Convert this mechanism into a boundary rule between producer and consumer, sender and receiver, or writer and reader.',
      Security: 'Add one attacker or failure event and state what additional invariant you would need.',
      'AI & ML': 'Add one large and one small input and estimate both runtime and memory trend from the animation shape.',
      Papers: 'Write the implementation contract: what is exact, what is optimized, and what is approximation.',
    };
    const tryLine = promptByCategory[entry.category]
      || 'Create one short input, predict every frame in words, then compare against the live animation.';
    sections.push({
      heading: 'Try this now',
      paragraphs: [
        `Project prompt: ${tryLine}`,
        `Use the unlocks line as your completion check: if ${entry.title} can explain the transition to ${leadsTo.length ? leadsTo.slice(0, 3).map((topic) => topic.title).join(', ') : 'one concrete follow-up topic'}, you are ready to continue.`,
      ],
    });
  }

  return sections;
}

function appendTopicLinkedText(el, text, excludeId) {
  for (const seg of linkifyByTitle(text, excludeId)) {
    if (seg.id) {
      const a = document.createElement('a');
      a.className = 'inline-topic-link';
      a.href = `./topic.html?topic=${seg.id}`;
      a.textContent = seg.text;
      el.appendChild(a);
    } else {
      el.appendChild(document.createTextNode(seg.text));
    }
  }
}

function renderLinkedText(el, text, excludeId) {
  el.textContent = '';
  const source = String(text ?? '');
  let cursor = 0;
  for (const match of source.matchAll(URL_PATTERN)) {
    if (match.index > cursor) appendTopicLinkedText(el, source.slice(cursor, match.index), excludeId);

    let href = match[0];
    let trailing = '';
    while (/[.,;:!?)]$/.test(href)) {
      trailing = `${href.at(-1)}${trailing}`;
      href = href.slice(0, -1);
    }

    const a = document.createElement('a');
    a.className = 'external-source-link';
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = href.replace(/^https?:\/\//, '');
    el.appendChild(a);
    if (trailing) el.appendChild(document.createTextNode(trailing));

    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) appendTopicLinkedText(el, source.slice(cursor), excludeId);
}

// ----------------------------------------------------------------- theme

function initTheme() {
  const stored = localStorage.getItem('theme');
  if (stored) document.documentElement.dataset.theme = stored;
  const button = document.querySelector('[data-theme-toggle]');
  if (!button) return;
  button.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
  });
}

// ------------------------------------------------------------------ home

function entryHref(entry) {
  return entry.type === 'article' ? entry.url : `./topic.html?topic=${entry.id}`;
}

function topicHref(topicId, trackId = null) {
  const entry = topicById.get(topicId);
  if (!entry) return './index.html';
  const href = entryHref(entry);
  return trackId && entry.type !== 'article' ? `${href}&track=${trackId}` : href;
}

function appendTopicLinkList(container, ids, options = {}) {
  const { trackId = null, limit = ids.length } = options;
  const visible = ids
    .map((id) => topicById.get(id))
    .filter(Boolean)
    .slice(0, limit);

  for (const entry of visible) {
    const link = document.createElement('a');
    link.href = topicHref(entry.id, trackId);
    link.textContent = entry.title;
    container.appendChild(link);
  }

  const hidden = ids.length - visible.length;
  if (hidden > 0) {
    const more = document.createElement('span');
    more.className = 'more-count';
    more.textContent = `+${hidden} more`;
    container.appendChild(more);
  }
}

function initHome() {
  const listEl = document.querySelector('[data-topic-list]');
  const searchEl = document.querySelector('[data-search]');

  const topicCountEl = document.querySelector('[data-topic-count]');
  if (topicCountEl) topicCountEl.textContent = `${topics.length} topics and growing`;

  function renderSection(heading, entries, parent = listEl) {
    const section = document.createElement('section');
    section.className = 'category';
    const h = document.createElement('h2');
    h.textContent = heading;
    section.appendChild(h);
    const grid = document.createElement('div');
    grid.className = 'card-grid';
    for (const entry of entries) {
      const card = document.createElement('a');
      card.className = 'card';
      card.href = entryHref(entry);
      const title = document.createElement('h3');
      title.textContent = entry.title;
      const summary = document.createElement('p');
      summary.textContent = entry.summary;
      card.append(title, summary);
      grid.appendChild(card);
    }
    section.appendChild(grid);
    parent.appendChild(section);
  }

  function renderTrackCard(track, compact = false) {
    const card = document.createElement('article');
    card.className = compact ? 'track-card track-card-compact' : 'track-card';

    const completion = getTrackCompletion(track);
    const lockState = getTrackLockState(track);
    const prerequisiteTracks = getTracksByIds(track.prerequisiteTrackIds ?? []);
    const actionTopicId = completion.nextTopicId ?? trackTopicIds(track)[0];

    const eyebrow = document.createElement('p');
    eyebrow.className = 'track-meta';
    eyebrow.textContent = `${track.level} • ${track.pace}`;

    const title = document.createElement('h3');
    title.textContent = track.title;

    const summary = document.createElement('p');
    summary.className = 'track-summary';
    summary.textContent = track.summary;

    const outcome = document.createElement('p');
    outcome.className = 'track-outcome';
    outcome.textContent = track.outcome;

    const progress = document.createElement('p');
    progress.className = 'track-progress';
    const progressBar = document.createElement('progress');
    progressBar.value = String(completion.completed);
    progressBar.max = String(Math.max(completion.total, 1));
    progressBar.setAttribute('aria-label', `${completion.percent}% complete`);
    const status = document.createElement('span');
    status.textContent = `${completion.completed}/${completion.total} topics complete`;
    progress.append(progressBar, status);

    const modules = document.createElement('ol');
    modules.className = 'track-modules';
    const moduleLimit = compact ? 2 : track.modules.length;
    for (const module of track.modules.slice(0, moduleLimit)) {
      const item = document.createElement('li');
      const moduleTitle = document.createElement('strong');
      moduleTitle.textContent = module.title;
      item.appendChild(moduleTitle);
    if (!compact) item.appendChild(document.createTextNode(`: ${module.goal}`));
      modules.appendChild(item);
    }
    if (compact && track.modules.length > moduleLimit) {
      const more = document.createElement('li');
      more.textContent = `${track.modules.length - moduleLimit} more modules`;
      modules.appendChild(more);
    }

    const prereq = document.createElement('p');
    prereq.className = 'track-prereq';
    if (prerequisiteTracks.length > 0) {
      const required = prerequisiteTracks.map(trackChipText).join(', ');
      if (lockState.isLocked) {
        const missingNames = lockState.missing.map((entry) => trackChipText(entry)).join(', ');
        const details = lockState.missing.length === 1
          ? 'Complete all topics before this track unlocks.'
          : 'Complete these required tracks before continuing.';
        prereq.textContent = `Prerequisites (${required}): ${missingNames}. ${details}`;
        if (lockState.missing.length === 1) {
          const only = lockState.missing[0];
          prereq.textContent = `Prerequisite: ${trackChipText(only)} (${only.completed}/${only.total} topics).`;
        }
      } else {
        prereq.textContent = `Prerequisites: ${required} (met).`;
      }
    } else {
      prereq.textContent = 'Prerequisites: none';
    }

    const actions = document.createElement('p');
    actions.className = 'track-actions';
    const start = document.createElement('a');
    start.className = 'btn btn-primary';
    if (lockState.isLocked) {
      start.href = '#';
      start.className = 'btn btn-secondary';
      start.setAttribute('aria-disabled', 'true');
      start.tabIndex = -1;
      start.textContent = 'Complete prerequisites first';
    } else if (completion.total === 0) {
      start.href = './index.html';
      start.classList.remove('btn-primary');
      start.classList.add('btn');
      start.setAttribute('aria-disabled', 'true');
      start.textContent = 'Path not ready';
    } else if (completion.isComplete) {
      start.textContent = 'Review path';
    } else if (completion.completed > 0) {
      start.textContent = 'Continue path';
    } else {
      start.textContent = 'Start path';
    }

    if (!lockState.isLocked && completion.total > 0) {
      start.href = topicHref(actionTopicId, track.id);
    }
    const count = document.createElement('span');
    count.className = 'track-count';
    count.textContent = `${completion.total} unique topics`;

    const followups = document.createElement('p');
    followups.className = 'track-followups';
    const nextTracks = getTracksByIds(track.nextTrackIds ?? []);
    if (nextTracks.length > 0) {
      const names = nextTracks.slice(0, 3).map(trackChipText).join(', ');
      followups.textContent = `Next: ${names}`;
      if (nextTracks.length > 3) {
        followups.textContent = `${followups.textContent} (+${nextTracks.length - 3} more)`;
      }
    } else {
      followups.textContent = 'Next path: keep exploring related topics manually.';
    }

    actions.append(start, count);
    card.append(eyebrow, title, summary, progress);
    if (!compact) card.appendChild(outcome);
    card.append(prereq, modules, actions, followups);
    return card;
  }

function renderCurriculumOverview() {
    const section = document.createElement('section');
    section.className = 'curriculum-section';

    const h = document.createElement('h2');
    h.textContent = 'Start With a Learning Path';
    const p = document.createElement('p');
    p.className = 'section-intro';
    p.textContent = 'The full library is large on purpose. Paths turn it into courses: who each route is for, what order to study, what the modules unlock, and what to do next.';

    const grid = document.createElement('div');
    grid.className = 'track-grid';
    for (const track of learningTracks) grid.appendChild(renderTrackCard(track));

    section.append(h, p, grid);
    listEl.appendChild(section);
  }

  function renderDomainMap() {
    const section = document.createElement('section');
    section.className = 'domain-section';

    const h = document.createElement('h2');
    h.textContent = 'Domain Map';
    const p = document.createElement('p');
    p.className = 'section-intro';
    p.textContent = 'Domains are shelves; paths are courses. Use this map when you know the broad area but need a safe first topic.';

    const grid = document.createElement('div');
    grid.className = 'domain-grid';
    for (const category of categories) {
      const guide = domainGuides[category];
      const entries = topics.filter((entry) => entry.category === category);
      if (!guide || entries.length === 0) continue;

      const card = document.createElement('article');
      card.className = 'domain-card';
      const title = document.createElement('h3');
      title.textContent = category;
      const count = document.createElement('p');
      count.className = 'domain-count';
      count.textContent = `${entries.length} topics`;
      const summary = document.createElement('p');
      summary.textContent = guide.summary;
      const use = document.createElement('p');
      use.className = 'domain-use';
      use.textContent = guide.useWhen;
      const starters = document.createElement('div');
      starters.className = 'mini-link-list';
      appendTopicLinkList(starters, guide.starterTopicIds);
      card.append(title, count, summary, use, starters);
      grid.appendChild(card);
    }

    section.append(h, p, grid);
    listEl.appendChild(section);
  }

  function renderAllTopicBrowse() {
    const details = document.createElement('details');
    details.className = 'all-topics';
    const summary = document.createElement('summary');
    summary.textContent = `Browse all ${topics.length} topics by category`;
    details.appendChild(summary);
    for (const category of categories) {
      const entries = topics.filter((t) => t.category === category);
      if (entries.length > 0) renderSection(category, entries, details);
    }
    listEl.appendChild(details);
  }

  function render(rawQuery = '') {
    const query = rawQuery.trim();
    listEl.replaceChildren();

    if (query) {
      // ranked, typo-tolerant results in relevance order
      const trackResults = searchTracks(query);
      const results = searchTopics(query);
      if (trackResults.length > 0) {
        const section = document.createElement('section');
        section.className = 'curriculum-section';
        const h = document.createElement('h2');
        h.textContent = `Learning paths (${trackResults.length})`;
        const grid = document.createElement('div');
        grid.className = 'track-grid track-grid-compact';
        for (const track of trackResults) grid.appendChild(renderTrackCard(track, true));
        section.append(h, grid);
        listEl.appendChild(section);
      }
      if (results.length === 0 && trackResults.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty-results';
        empty.textContent = `Nothing matches "${query}" yet — more topics are on the way.`;
        listEl.appendChild(empty);
        return;
      }
      if (results.length > 0) renderSection(`Topics (${results.length})`, results);
      return;
    }

    renderCurriculumOverview();
    renderDomainMap();
    renderAllTopicBrowse();
  }

  searchEl.addEventListener('input', () => render(searchEl.value));
  render();
}

// ----------------------------------------------------------------- topic

function renderTopicNav(nav, currentId) {
  for (const category of categories) {
    const entries = topics.filter((t) => t.category === category);
    if (entries.length === 0) continue;
    const heading = document.createElement('h2');
    heading.textContent = category;
    nav.appendChild(heading);
    const list = document.createElement('ul');
    for (const entry of entries) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = entryHref(entry);
      link.textContent = entry.title;
      if (entry.id === currentId) link.setAttribute('aria-current', 'page');
      item.appendChild(link);
      list.appendChild(item);
    }
    nav.appendChild(list);
  }
}

async function initTopic() {
  const root = document.querySelector('[data-page="topic"]');
  const params = new URLSearchParams(location.search);
  const id = params.get('topic');
  const activeTrackId = params.get('track');
  const entry = topics.find((t) => t.id === id && t.type === 'visualization');
  const titleEl = root.querySelector('[data-topic-title]');

  renderTopicNav(root.querySelector('[data-topic-nav]'), id);

  if (!entry) {
    titleEl.textContent = 'Topic not found';
    root.querySelector('[data-topic-summary]').textContent =
      'That topic does not exist (yet). Pick one from the list.';
    root.querySelector('.learn-grid').hidden = true;
    return;
  }

  document.title = `${entry.title} — Visualized`;
  titleEl.textContent = entry.title;
  root.querySelector('[data-topic-summary]').textContent = entry.summary;

  // Update Open Graph and Twitter Card meta tags for social sharing.
  const ogTitle = `${entry.title} — Visualized`;
  const ogDesc = entry.summary || 'Free, visual computer-science education: every algorithm animated, every step explained.';
  const ogUrl = `${location.origin}${location.pathname}?topic=${encodeURIComponent(entry.id)}`;
  const metaUpdates = {
    'meta[property="og:title"]': ogTitle,
    'meta[property="og:description"]': ogDesc,
    'meta[property="og:url"]': ogUrl,
    'meta[name="twitter:title"]': ogTitle,
    'meta[name="twitter:description"]': ogDesc,
  };
  for (const [selector, value] of Object.entries(metaUpdates)) {
    const el = document.querySelector(selector);
    if (el) el.setAttribute('content', value);
  }
  const descMeta = document.querySelector('meta[name="description"]');
  if (descMeta) descMeta.setAttribute('content', ogDesc);

  setProgressText(root, entry.id);
  renderTopicLinks(root.querySelector('[data-topic-links]'), entry);
  const topicContext = root.querySelector('[data-topic-context]');
  renderTopicContext(topicContext, entry, activeTrackId);
  renderLearningPathPanel(topicContext, entry, activeTrackId);

  const mod = await entry.module();
  const initialInput = {};
  for (const control of mod.topic.controls ?? []) {
    if (params.has(control.id)) initialInput[control.id] = params.get(control.id);
  }

      const compactToggle = root.querySelector('[data-auto-compact-notes]');
  if (compactToggle) {
    compactToggle.checked = getAutoCompactNotes();
    compactToggle.addEventListener('change', () => {
      const isCompact = Boolean(compactToggle.checked);
      setAutoCompactNotes(isCompact);
      const articleRoot = root.querySelector('[data-topic-article]');
      setStudySectionsCompact(articleRoot, isCompact);
    });
  }

  const frameLog = root.querySelector('[data-frame-log]');

  createTopicRuntime({
    root,
    topic: mod.topic,
    initialInput,
    renderExplanation: (el, text) => renderLinkedText(el, text, entry.id),
    onStep: ({ step, index, total }) => {
      setTopicProgress(entry.id, {
        totalSteps: total,
        lastStep: index,
        completed: index === total - 1 && total > 0,
      });
      setProgressText(root, entry.id);
      updateFrameLog(frameLog, entry.id, step, index, total);
      const articleRoot = root.querySelector('[data-topic-article]');
      setStudySectionsCompact(articleRoot, getAutoCompactNotes(), index);
    },
    onStepsPrepared: ({ steps }) => {
      setTopicProgress(entry.id, {
        totalSteps: steps.length,
        lastStep: 0,
        completed: false,
      });
      setProgressText(root, entry.id);
      resetFrameLog(frameLog, entry.id);
      const articleRoot = root.querySelector('[data-topic-article]');
      setStudySectionsCompact(articleRoot, getAutoCompactNotes(), 0);
    },
  });
  renderArticle(
    root.querySelector('[data-topic-article]'),
    mod.article,
    entry.id,
    getAutoCompactNotes(),
  );
}

function renderLearningPathPanel(container, entry, activeTrackId) {
  if (!container) return;
  const existing = container.querySelector('[data-learning-path-panel]');
  if (existing) existing.remove();

  const placements = getTopicTrackPlacements(entry.id);
  if (!placements.length) return;

  const activePlacement = placements.find((placement) => placement.track.id === activeTrackId) ?? placements[0];
  const {
    track,
    module,
    moduleIndex,
    localIndex,
    absoluteIndex,
    total,
    previousId,
    nextId,
  } = activePlacement;
  const trackTopics = trackTopicIds(track);
  const currentPosition = absoluteIndex + 1;
  const checkpointEvery = track.courseGuide?.checkpointEvery;

  const panel = document.createElement('section');
  panel.className = 'learning-path-panel';
  panel.setAttribute('data-learning-path-panel', '');

  const header = document.createElement('h3');
  header.className = 'track-meta';
  header.textContent = `Learning path: ${track.title}`;
  panel.appendChild(header);

  const objective = document.createElement('p');
  objective.className = 'topic-outcome';
  objective.textContent = track.outcome;
  panel.appendChild(objective);

  const stateLine = document.createElement('p');
  stateLine.className = 'learning-path-state';
  stateLine.textContent = `Module ${moduleIndex + 1} of ${track.modules.length} • Topic ${currentPosition} of ${trackTopics.length} in this path`;
  panel.appendChild(stateLine);

  const crumb = document.createElement('div');
  crumb.className = 'learning-path-strip';

  const windowRadius = 2;
  const topicWindowStart = Math.max(0, absoluteIndex - windowRadius);
  const topicWindowEnd = Math.min(trackTopicIds(track).length - 1, absoluteIndex + windowRadius);
  const topicWindow = trackTopicIds(track).slice(topicWindowStart, topicWindowEnd + 1);

  for (const topicId of topicWindow) {
    const topic = topicById.get(topicId);
    if (!topic) continue;
    const isCurrent = topicId === entry.id;
    const node = document.createElement('a');
    node.href = topicHref(topicId, track.id);
    node.className = `learning-path-node${isCurrent ? ' current' : ''}`;
    node.textContent = topic.title;
    if (isCurrent) node.setAttribute('aria-current', 'page');
    crumb.appendChild(node);
  }
  panel.appendChild(crumb);

  const upcoming = trackTopics.slice(absoluteIndex + 1, absoluteIndex + 4);
  if (upcoming.length > 0) {
    const upcomingBlock = document.createElement('div');
    upcomingBlock.className = 'learning-path-upcoming';
    const nextHeading = document.createElement('p');
    nextHeading.className = 'track-meta';
    nextHeading.textContent = 'Next in this path:';
    const upcomingRow = document.createElement('div');
    upcomingRow.className = 'learning-path-strip';

    for (const topicId of upcoming) {
      const topic = topicById.get(topicId);
      if (!topic) continue;
      const link = document.createElement('a');
      link.href = topicHref(topicId, track.id);
      link.className = 'learning-path-node';
      link.textContent = topic.title;
      upcomingRow.appendChild(link);
    }
    upcomingBlock.append(nextHeading, upcomingRow);
    panel.appendChild(upcomingBlock);
  }

  const nav = document.createElement('div');
  nav.className = 'track-nav-links';
  if (previousId) {
    const prev = document.createElement('a');
    prev.href = topicHref(previousId, track.id);
    prev.className = 'btn';
    prev.textContent = `Prev: ${topicById.get(previousId)?.title ?? previousId}`;
    nav.appendChild(prev);
  }
  if (nextId) {
    const next = document.createElement('a');
    next.href = topicHref(nextId, track.id);
    next.className = 'btn btn-secondary';
    next.textContent = `Next: ${topicById.get(nextId)?.title ?? nextId}`;
    nav.appendChild(next);
  }
  panel.appendChild(nav);

  if (Number.isFinite(checkpointEvery)) {
    const nextCheckpoint = atModulo(currentPosition, checkpointEvery)
      ? currentPosition
      : Math.min(trackTopics.length, (Math.floor((currentPosition - 1) / checkpointEvery) + 1) * checkpointEvery);
    const remaining = Math.max(0, nextCheckpoint - currentPosition);
    const note = document.createElement('p');
    note.className = 'learning-path-note';
    if (remaining === 0) {
      note.textContent = `You are at checkpoint ${currentPosition}/${trackTopics.length}. Use this as a verification stop before continuing.`;
    } else {
      note.textContent = `Next checkpoint at topic ${nextCheckpoint}/${trackTopics.length}; ${remaining} topic${remaining === 1 ? '' : 's'} to go.`;
    }
    panel.appendChild(note);
  }

  if (module?.topicIds) {
    const moduleMeta = document.createElement('p');
    moduleMeta.className = 'track-meta';
    const moduleTopicIndex = localIndex + 1;
    const moduleTotal = module.topicIds.length;
    moduleMeta.textContent = `In this module: "${module.title}" topic ${moduleTopicIndex}/${moduleTotal}`;
    panel.appendChild(moduleMeta);
  }

  const portfolio = track.courseGuide?.portfolioPrompt;
  if (portfolio) {
    const portfolioEl = document.createElement('p');
    portfolioEl.className = 'learning-path-note';
    portfolioEl.textContent = `Capstone prompt: ${portfolio}`;
    panel.appendChild(portfolioEl);
  }

  container.appendChild(panel);
}

// Study notes: the written course that lives under every animation.
// Modules export `article = { sections: [{heading, paragraphs: [...]}] }`.
function renderArticle(container, article, topicId, compactMode = true) {
  if (!article || !Array.isArray(article.sections)) return;
  const topic = topicById.get(topicId);
  const allSections = [...article.sections, ...buildContextualStudySections({ ...(topic ?? {}), article })];

  const slugify = (text) => String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'section';

  const title = container.querySelector('.study-title');
  const nav = document.createElement('nav');
  nav.className = 'study-jump-list';
  nav.setAttribute('aria-label', 'Study note sections');

  const sections = document.createElement('div');
  sections.className = 'study-sections';

  for (const [index, section] of allSections.entries()) {
    const slug = `${topicId}-${slugify(section.heading)}`;
    const articleSection = document.createElement('details');
    articleSection.className = 'study-section';
    articleSection.id = slug;
    articleSection.dataset.studySection = 'true';
    articleSection.dataset.studySectionIndex = String(index);
    articleSection.open = !compactMode || index < 2;

    const jump = document.createElement('a');
    jump.href = `#${slug}`;
    jump.textContent = section.heading;
    nav.appendChild(jump);

    const heading = document.createElement('h3');
    heading.textContent = section.heading;
    const summary = document.createElement('summary');
    summary.appendChild(heading);
    const body = document.createElement('div');
    body.className = 'study-section-body';
    articleSection.appendChild(summary);
    appendSectionBody(body, section.paragraphs, topicId);
    articleSection.appendChild(body);
    sections.appendChild(articleSection);
  }

  if (title) title.after(nav, sections);
  else container.append(nav, sections);
  container.hidden = false;
}

// "Built from": the simpler ideas this topic is composed of.
// "Next up": computed in reverse — everything that builds on this topic.
function renderTopicLinks(container, entry) {
  const buildsOn = (entry.buildsOn ?? [])
    .map((id) => topics.find((t) => t.id === id))
    .filter(Boolean);
  const leadsTo = topics.filter((t) => (t.buildsOn ?? []).includes(entry.id));

  const addRow = (label, entries) => {
    if (entries.length === 0) return;
    const row = document.createElement('p');
    row.className = 'chip-row';
    const caption = document.createElement('span');
    caption.className = 'chip-caption';
    caption.textContent = label;
    row.appendChild(caption);
    const visible = entries.slice(0, 12);
    for (const target of visible) {
      const chip = document.createElement('a');
      chip.className = 'chip';
      chip.href = entryHref(target);
      chip.textContent = target.title;
      row.appendChild(chip);
    }
    if (entries.length > visible.length) {
      const more = document.createElement('span');
      more.className = 'chip chip-more';
      more.textContent = `+${entries.length - visible.length} more`;
      row.appendChild(more);
    }
    container.appendChild(row);
  };

  addRow('Built from:', buildsOn);
  addRow('Next up:', leadsTo);
}

function renderTopicContext(container, entry, activeTrackId) {
  if (!container) return;
  container.replaceChildren();

  const placements = getTopicTrackPlacements(entry.id);
  const activePlacement =
    placements.find((placement) => placement.track.id === activeTrackId) ?? placements[0] ?? null;
  const buildsOn = (entry.buildsOn ?? []).filter((id) => topicById.has(id));
  const leadsTo = topics
    .filter((topic) => (topic.buildsOn ?? []).includes(entry.id))
    .map((topic) => topic.id);

  if (!activePlacement && placements.length === 0 && buildsOn.length === 0 && leadsTo.length === 0) {
    container.hidden = true;
    return;
  }

  const heading = document.createElement('h2');
  heading.textContent = 'Where This Fits';
  container.appendChild(heading);

  if (activePlacement) {
    const { track, module, moduleIndex, absoluteIndex, total, previousId, nextId } = activePlacement;
    const primary = document.createElement('article');
    primary.className = 'context-primary';

    const meta = document.createElement('p');
    meta.className = 'track-meta';
    meta.textContent = `${track.title} Â· module ${moduleIndex + 1} of ${track.modules.length} Â· topic ${absoluteIndex + 1} of ${total}`;

    const title = document.createElement('h3');
    title.textContent = module.title;

    const goal = document.createElement('p');
    goal.textContent = module.goal;

    const use = document.createElement('p');
    use.className = 'context-use';
    use.textContent = track.useWhen;

    const lockState = getTrackLockState(track);
    if (lockState.isLocked) {
      const locked = document.createElement('p');
      locked.className = 'learning-path-note';
      locked.textContent = `This track is locked until prerequisite tracks are complete. Open prerequisite paths in the home page to continue this route with full continuity.`;
      primary.appendChild(locked);
    }

    const stepNav = document.createElement('div');
    stepNav.className = 'step-nav';
    if (previousId) {
      const previous = document.createElement('a');
      previous.href = topicHref(previousId, track.id);
      previous.textContent = `Previous: ${topicById.get(previousId)?.title ?? previousId}`;
      stepNav.appendChild(previous);
    }
    if (nextId) {
      const next = document.createElement('a');
      next.href = topicHref(nextId, track.id);
      next.textContent = `Next: ${topicById.get(nextId)?.title ?? nextId}`;
      stepNav.appendChild(next);
    }

    primary.append(meta, title, goal, use, stepNav);
    container.appendChild(primary);
  }

  if (placements.length > 0) {
    const pathRow = document.createElement('p');
    pathRow.className = 'chip-row context-paths';
    const caption = document.createElement('span');
    caption.className = 'chip-caption';
    caption.textContent = 'Also in:';
    pathRow.appendChild(caption);
    for (const placement of placements) {
      const link = document.createElement('a');
      link.className = 'chip';
      link.href = topicHref(entry.id, placement.track.id);
      link.textContent = placement.track.shortTitle;
      if (placement.track.id === activePlacement?.track.id) link.setAttribute('aria-current', 'true');
      pathRow.appendChild(link);
    }
    container.appendChild(pathRow);
  }

  const grid = document.createElement('div');
  grid.className = 'context-grid';

  const addContextCard = (title, body, ids, emptyText) => {
    const card = document.createElement('article');
    card.className = 'context-card';
    const h = document.createElement('h3');
    h.textContent = title;
    const p = document.createElement('p');
    p.textContent = body;
    const links = document.createElement('div');
    links.className = 'mini-link-list';
    if (ids.length > 0) appendTopicLinkList(links, ids, { limit: 8 });
    else links.textContent = emptyText;
    card.append(h, p, links);
    grid.appendChild(card);
  };

  addContextCard(
    'Learn Before',
    'Prerequisites declared by this topic. These are the ingredients that make the animation easier to read.',
    buildsOn,
    'No explicit prerequisites yet.',
  );
  addContextCard(
    'This Unlocks',
    'Topics that directly build on this one. Use these when the idea feels solid and you want the next application.',
    leadsTo,
    'No direct dependents yet.',
  );
  if (activePlacement) {
    const trackSequence = trackTopicIds(activePlacement.track);
    const nextInTrack = trackSequence.slice(activePlacement.absoluteIndex + 1, activePlacement.absoluteIndex + 4);
    addContextCard(
      'Continue this path',
      `The course path keeps order and scope tight. Next topics in ${activePlacement.track.shortTitle}:`,
      nextInTrack,
      'No remaining topics in this track.',
    );
  }
  const nextTrackIds = activePlacement?.track.nextTrackIds ?? [];
  if (nextTrackIds.length > 0) {
    const card = document.createElement('article');
    card.className = 'context-card';
    const h = document.createElement('h3');
    h.textContent = 'Possible next tracks';
    const p = document.createElement('p');
    p.textContent = 'When you finish this track, consider these follow-on tracks for broader fluency.';
    const links = document.createElement('div');
    links.className = 'mini-link-list';
    for (const trackRef of getTracksByIds(nextTrackIds).slice(0, 5)) {
      const link = document.createElement('a');
      const firstTopic = getTrackCompletion(trackRef).topicIds[0];
      const href = topicHref(firstTopic, trackRef.id);
      link.href = href;
      link.textContent = trackRef.shortTitle ?? trackRef.title;
      links.append(link);
    }
    if (nextTrackIds.length > 5) {
      const more = document.createElement('span');
      more.className = 'chip chip-more';
      more.textContent = `+${nextTrackIds.length - 5} more`;
      links.appendChild(more);
    }
    card.append(h, p, links);
    grid.appendChild(card);
  }

  container.appendChild(grid);
  container.hidden = false;
}

// -------------------------------------------------------------- bootstrap

initTheme();
const page = document.body.dataset.page || document.querySelector('[data-page]')?.dataset.page;
if (page === 'home') initHome();
if (page === 'topic') initTopic();

