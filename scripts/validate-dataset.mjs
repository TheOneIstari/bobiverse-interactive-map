import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.cwd(), 'bobiverse_dataset.json');
const dataset = JSON.parse(fs.readFileSync(file, 'utf8'));

const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
};
const pass = (message) => console.log(`✓ ${message}`);

const systems = new Set(dataset.systems.map((item) => item.id));
const bobs = new Set(dataset.bobs.map((item) => item.id));
const entities = new Set(dataset.non_bob_entities.map((item) => item.id));
const bookIndexes = new Set(dataset.books.map((item) => item.book_index));

for (const event of dataset.events) {
  if (!bookIndexes.has(event.book_index)) fail(`event ${event.id} references unknown book_index ${event.book_index}`);
  if (!bookIndexes.has(event.spoiler_book_index)) fail(`event ${event.id} references unknown spoiler_book_index ${event.spoiler_book_index}`);
  if (event.system_id && !systems.has(event.system_id)) fail(`event ${event.id} references unknown system ${event.system_id}`);
  for (const id of event.participants ?? []) {
    if (!bobs.has(id) && !entities.has(id)) fail(`event ${event.id} references unknown participant ${id}`);
  }
}

for (const bob of dataset.bobs) {
  if (bob.origin_bob_id && !bobs.has(bob.origin_bob_id)) fail(`bob ${bob.id} references unknown origin ${bob.origin_bob_id}`);
  for (const child of bob.known_children_ids ?? []) {
    if (!bobs.has(child)) fail(`bob ${bob.id} references unknown child ${child}`);
  }
  for (const systemId of bob.primary_system_ids ?? []) {
    if (!systems.has(systemId)) fail(`bob ${bob.id} references unknown primary system ${systemId}`);
  }
}

for (const row of dataset.bob_status_by_book) {
  if (!bobs.has(row.bob_id)) fail(`bob_status row references unknown bob ${row.bob_id}`);
  if (!bookIndexes.has(row.book_index)) fail(`bob_status row for ${row.bob_id} references unknown book ${row.book_index}`);
  if (row.system_id && !systems.has(row.system_id)) fail(`bob_status row for ${row.bob_id} references unknown system ${row.system_id}`);
}

if (process.exitCode !== 1) {
  pass(`validated ${dataset.books.length} books, ${dataset.systems.length} systems, ${dataset.bobs.length} bobs, ${dataset.events.length} events`);
}
