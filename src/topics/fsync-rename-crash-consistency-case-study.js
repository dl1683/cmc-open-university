// Crash-consistent file replacement: write temp, fsync file, rename atomically,
// then fsync the directory so both contents and name survive power loss.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'fsync-rename-crash-consistency-case-study',
  title: 'fsync Rename Crash Consistency',
  category: 'Systems',
  summary: 'How durable file replacement uses temp files, dirty page cache, fsync, atomic rename, directory fsync, and crash-window reasoning.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['safe replace', 'crash windows'], defaultValue: 'safe replace' },
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

function fsyncGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'app', label: 'app', x: 0.7, y: 4.8, note: notes.app ?? 'save config' },
      { id: 'tmp', label: 'tmp', x: 2.2, y: 3.0, note: notes.tmp ?? 'new bytes' },
      { id: 'cache', label: 'cache', x: 3.9, y: 3.0, note: notes.cache ?? 'dirty' },
      { id: 'old', label: 'old', x: 2.2, y: 6.4, note: notes.old ?? 'config.json' },
      { id: 'rename', label: 'rename', x: 5.5, y: 4.8, note: notes.rename ?? 'atomic name' },
      { id: 'dir', label: 'dir', x: 7.1, y: 3.0, note: notes.dir ?? 'entry' },
      { id: 'disk', label: 'disk', x: 7.1, y: 6.4, note: notes.disk ?? 'stable' },
      { id: 'crash', label: 'crash', x: 8.8, y: 4.8, note: notes.crash ?? 'audit' },
    ],
    edges: [
      { id: 'e-app-tmp', from: 'app', to: 'tmp', weight: '' },
      { id: 'e-tmp-cache', from: 'tmp', to: 'cache', weight: '' },
      { id: 'e-cache-disk', from: 'cache', to: 'disk', weight: '' },
      { id: 'e-old-rename', from: 'old', to: 'rename', weight: '' },
      { id: 'e-tmp-rename', from: 'tmp', to: 'rename', weight: '' },
      { id: 'e-rename-dir', from: 'rename', to: 'dir', weight: '' },
      { id: 'e-dir-disk', from: 'dir', to: 'disk', weight: '' },
      { id: 'e-disk-crash', from: 'disk', to: 'crash', weight: '' },
    ],
  }, { title });
}

function* safeReplace() {
  yield {
    state: fsyncGraph('Write the new contents to a separate temp file'),
    highlight: { active: ['app', 'tmp', 'cache', 'e-app-tmp', 'e-tmp-cache'], compare: ['old'] },
    explanation: 'Safe replacement starts by writing new bytes to a temp file in the same directory. The old file remains the visible version while new data is still being prepared.',
    invariant: 'Do not overwrite the only good copy before the replacement is durable.',
  };

  yield {
    state: fsyncGraph('fsync the temp file to force its contents', { cache: 'dirty tmp', disk: 'tmp bytes stable' }),
    highlight: { active: ['tmp', 'cache', 'disk', 'e-tmp-cache', 'e-cache-disk'], found: ['old'] },
    explanation: 'write() can return after copying bytes into the page cache. fsync(tempfd) asks the kernel and filesystem to push the temp file contents and required file metadata to stable storage.',
  };

  yield {
    state: fsyncGraph('rename swaps the directory entry atomically', { rename: 'tmp -> live', old: 'old name', dir: 'new points' }),
    highlight: { active: ['tmp', 'old', 'rename', 'dir', 'e-old-rename', 'e-tmp-rename', 'e-rename-dir'], compare: ['crash'] },
    explanation: 'rename within the same filesystem is atomic from the namespace point of view. Readers should see either the old file or the new file name, not a half-written mixture.',
  };

  yield {
    state: fsyncGraph('fsync the directory to persist the name change', { dir: 'dirty dirent', disk: 'name stable', crash: 'survives' }),
    highlight: { active: ['dir', 'disk', 'crash', 'e-dir-disk', 'e-disk-crash'], found: ['rename'] },
    explanation: 'The directory entry is metadata too. fsync on the containing directory is the conservative step that makes the rename durable across crash recovery.',
  };

  yield {
    state: labelMatrix(
      'Durable replace recipe',
      [
        { id: 'write', label: 'write tmp' },
        { id: 'fsyncf', label: 'fsync file' },
        { id: 'rename', label: 'rename' },
        { id: 'fsyncd', label: 'fsync dir' },
      ],
      [
        { id: 'protects', label: 'protects' },
        { id: 'if crash', label: 'if crash' },
      ],
      [
        ['new bytes', 'old visible'],
        ['file data', 'tmp valid'],
        ['atomic name', 'old or new'],
        ['dir entry', 'new durable'],
      ],
    ),
    highlight: { active: ['fsyncf:protects', 'rename:protects', 'fsyncd:protects'], compare: ['write:if crash'] },
    explanation: 'The pattern separates content durability from namespace durability. File fsync protects bytes. Directory fsync protects the fact that the name now points at those bytes.',
  };
}

function* crashWindows() {
  yield {
    state: labelMatrix(
      'Crash windows',
      [
        { id: 'beforeF', label: 'before fsync' },
        { id: 'afterF', label: 'after file' },
        { id: 'afterR', label: 'after rename' },
        { id: 'afterD', label: 'after dir' },
      ],
      [
        { id: 'visible', label: 'visible' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['old', 'new lost'],
        ['old', 'tmp remains'],
        ['old/new', 'name may roll'],
        ['new', 'done'],
      ],
    ),
    highlight: { active: ['afterD:visible'], compare: ['beforeF:risk', 'afterR:risk'] },
    explanation: 'Crash consistency is timeline reasoning. Each syscall moves one boundary, but only the final directory fsync makes the replacement contract fully durable.',
    invariant: 'Atomic visibility and durable visibility are different promises.',
  };

  yield {
    state: fsyncGraph('A crash before file fsync can lose the temp data', { tmp: 'dirty only', cache: 'RAM', disk: 'old stable', crash: 'new gone' }),
    highlight: { active: ['tmp', 'cache', 'crash'], removed: ['disk'], compare: ['old'] },
    explanation: 'If the system loses power before fsync(tempfd), the new data may never reach stable media. The old file is still the safe fallback because rename has not happened.',
  };

  yield {
    state: fsyncGraph('A crash after rename but before directory fsync is filesystem-dependent risk', { rename: 'visible new', dir: 'dirty', disk: 'file stable', crash: 'dir uncertain' }),
    highlight: { active: ['rename', 'dir', 'disk', 'crash'], compare: ['old'] },
    explanation: 'The new file contents can be durable while the directory entry update is not. Journaling helps metadata consistency, but portable code should still fsync the directory for the name update.',
  };

  yield {
    state: fsyncGraph('The complete case is editor safe-save', { app: 'editor', tmp: '.file.tmp', old: 'file.txt', rename: 'replace', dir: 'parent', crash: 'old or new' }),
    highlight: { active: ['app', 'tmp', 'cache', 'rename', 'dir', 'disk', 'crash'], found: ['old'] },
    explanation: 'An editor safe-save writes .file.tmp, fsyncs it, renames it over file.txt, and fsyncs the directory. After a crash, recovery should find either the old file or the complete new file.',
  };

  yield {
    state: labelMatrix(
      'Common mistakes',
      [
        { id: 'overwrite', label: 'overwrite' },
        { id: 'noFsync', label: 'no fsync' },
        { id: 'noDir', label: 'no dir' },
        { id: 'cross', label: 'cross fs' },
      ],
      [
        { id: 'problem', label: 'problem' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['torn file', 'temp+rename'],
        ['dirty RAM', 'fsync file'],
        ['lost name', 'fsync dir'],
        ['not atomic', 'same dir'],
      ],
    ),
    highlight: { removed: ['overwrite:problem', 'noFsync:problem', 'noDir:problem'], found: ['cross:fix'] },
    explanation: 'The mistakes all confuse a different boundary: content, name, or filesystem. The recipe works because it treats each boundary explicitly.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'safe replace') yield* safeReplace();
  else if (view === 'crash windows') yield* crashWindows();
  else throw new InputError('Pick an fsync/rename view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Crash-consistent file replacement is the pattern behind safe saves: write a temp file, fsync the temp file, atomically rename it over the old name, then fsync the containing directory.',
        'The key distinction is visibility versus durability. rename can make the new name visible atomically, while fsync is what pushes content or directory metadata toward stable storage.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'There are two objects to make durable: the file contents and the directory entry. The file path points to an inode; the directory contains the name-to-inode mapping. fsync(file) and fsync(directory) target different parts of that structure.',
        'The page cache sits between write() and storage. A successful write() generally means bytes are in kernel memory. fsync is the explicit syscall boundary that asks the filesystem to force dirty data and required metadata.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A text editor saves file.txt. It writes .file.txt.tmp in the same directory, fsyncs the temp file, renames .file.txt.tmp to file.txt, and fsyncs the directory. A crash before rename leaves the old file visible. A crash after the full recipe leaves the new file visible and durable.',
        'This is the filesystem version of write-ahead thinking. Do not destroy the only good copy until the replacement is prepared, then commit the namespace change as a small atomic step.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'rename atomicity is not the same as crash durability. Another common mistake is fsyncing only the file and forgetting the parent directory, so the new contents may exist but the name update may not survive crash recovery on all systems.',
        'Cross-filesystem moves are not the same atomic rename. They become copy plus unlink behavior and need a different durability protocol.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Linux fsync(2) at https://man7.org/linux/man-pages/man2/fsync.2.html, rename(2) at https://man7.org/linux/man-pages/man2/rename.2.html, and open(2) O_TMPFILE notes at https://man7.org/linux/man-pages/man2/open.2.html. Study Readahead & Dirty Writeback, Linux Page Cache XArray, Write-Through vs Write-Back, Write-Ahead Log, Filesystem Extent Tree & Delayed Allocation, SQLite B-Tree & Pager, OPFS Origin Private File System, and ext4 JBD2 Journal Modes next.',
      ],
    },
  ],
};
