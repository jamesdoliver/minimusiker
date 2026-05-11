/**
 * Audit script: Live `template_id` distribution in the Tasks table.
 *
 * Reads ALL Tasks records from Airtable (paginated, read-only) and prints
 * a histogram of `template_id` values partitioned by `status`. Writes the
 * result as a markdown report to:
 *   docs/plans/2026-04-27-task-system-april-improvements/template-id-audit.md
 *
 * Used by Phase 2, Task 2.1 of the task system improvement plan to decide
 * whether legacy template_ids can be safely removed.
 *
 * Usage:
 *   npx @dotenvx/dotenvx run -f .env.local -- npx ts-node \
 *     --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
 *     scripts/audit-task-template-ids.ts
 *
 * (The `--compiler-options` overrides are required because the root tsconfig
 * uses `module: esnext` / `moduleResolution: bundler`, which ts-node cannot
 * execute under Node's CommonJS loader. This matches the pattern used by
 * other scripts in this directory.)
 */

import { promises as fs } from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in env');
  console.error(
    'Run with: npx @dotenvx/dotenvx run -f .env.local -- npx ts-node scripts/audit-task-template-ids.ts'
  );
  process.exit(1);
}

const TASKS_TABLE_ID = 'tblf59JyawJjgDqPJ';

const TASKS_FIELD_IDS = {
  task_id: 'fldYwXmqYLHXmCd1B',
  template_id: 'fldVXRwHmCbmRwAoe',
  status: 'fldTlA0kywaIji0BL',
  deadline: 'fld3KdpL5s6HKYm6t',
} as const;

const OUTPUT_PATH = path.resolve(
  __dirname,
  '..',
  'docs',
  'plans',
  '2026-04-27-task-system-april-improvements',
  'template-id-audit.md'
);

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

const LEGACY_TEMPLATE_IDS = new Set<string>([
  'poster_letter',
  'flyer1',
  'flyer2',
  'flyer3',
  'minicard',
  'order_schul_shirts',
  'order_standard_shirts',
]);

const V2_TEMPLATE_IDS = new Set<string>([
  'ship_poster',
  'ship_flyer_1',
  'ship_flyer_2',
  'ship_flyer_3',
  'order_schul_clothing',
  'order_minicard',
  'order_schul_clothing_2',
  'shipment_welle_1',
  'shipment_welle_2',
  'audio_master_cd',
  'audio_cd_production',
]);

/** Old-to-new template id mapping (mirrors scripts/migrate-task-templates.ts). */
const LEGACY_TO_V2: Record<string, string> = {
  poster_letter: 'ship_poster',
  flyer1: 'ship_flyer_1',
  flyer2: 'ship_flyer_2',
  flyer3: 'ship_flyer_3',
  minicard: 'order_minicard',
  order_schul_shirts: 'order_schul_clothing',
};

/** V2 timeline offsets, used purely for documentation in the report. */
const V2_OFFSETS: Record<string, number> = {
  ship_poster: -45,
  ship_flyer_1: -43,
  ship_flyer_2: -18,
  ship_flyer_3: -10,
  order_schul_clothing: -18,
  order_schul_clothing_2: 7,
  shipment_welle_1: -9,
  shipment_welle_2: 14,
  order_minicard: 5,
  audio_master_cd: 11,
  audio_cd_production: 12,
};

type Classification = 'legacy' | 'v2' | 'shipping' | 'unknown' | 'empty';

function classify(templateId: string | undefined | null): Classification {
  if (!templateId) return 'empty';
  if (V2_TEMPLATE_IDS.has(templateId)) return 'v2';
  if (LEGACY_TEMPLATE_IDS.has(templateId)) return 'legacy';
  if (templateId.startsWith('shipping_')) return 'shipping';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Airtable client (read-only)
// ---------------------------------------------------------------------------

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
}

const BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;
const headers = { Authorization: `Bearer ${AIRTABLE_API_KEY}` };

async function fetchAllTasks(): Promise<AirtableRecord[]> {
  const all: AirtableRecord[] = [];
  let offset: string | undefined;
  let pageCount = 0;

  do {
    const params = new URLSearchParams({
      pageSize: '100',
      returnFieldsByFieldId: 'true',
    });
    if (offset) params.set('offset', offset);

    const url = `${BASE_URL}/${TASKS_TABLE_ID}?${params.toString()}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Airtable fetch failed: ${response.status} ${response.statusText} — ${errorText}`
      );
    }

    const data = (await response.json()) as AirtableListResponse;
    all.push(...data.records);
    offset = data.offset;
    pageCount++;
    process.stdout.write(
      `  Fetched page ${pageCount} (${data.records.length} records, total ${all.length})\r`
    );
  } while (offset);

  process.stdout.write('\n');
  return all;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

const STATUSES = ['pending', 'partial', 'completed', 'cancelled', 'skipped'] as const;
type StatusKey = (typeof STATUSES)[number] | 'other';

interface TemplateStats {
  templateId: string;
  classification: Classification;
  pending: number;
  partial: number;
  completed: number;
  cancelled: number;
  skipped: number;
  other: number;
  total: number;
  /** Sample task IDs for cross-checking (capped at 3 per template) */
  sampleRecords: Array<{ recordId: string; status: string; deadline: string | null }>;
}

function normaliseStatus(raw: unknown): StatusKey {
  if (typeof raw !== 'string') return 'other';
  if ((STATUSES as readonly string[]).includes(raw)) return raw as StatusKey;
  return 'other';
}

function aggregate(records: AirtableRecord[]): {
  perTemplate: Map<string, TemplateStats>;
  total: number;
  emptyTemplateCount: number;
  rawStatusValues: Set<string>;
} {
  const perTemplate = new Map<string, TemplateStats>();
  let emptyTemplateCount = 0;
  const rawStatusValues = new Set<string>();

  for (const record of records) {
    const templateId = record.fields[TASKS_FIELD_IDS.template_id] as
      | string
      | undefined;
    const statusRaw = record.fields[TASKS_FIELD_IDS.status];
    const deadline =
      (record.fields[TASKS_FIELD_IDS.deadline] as string | undefined) ?? null;

    if (typeof statusRaw === 'string') rawStatusValues.add(statusRaw);

    if (!templateId) {
      emptyTemplateCount++;
      continue;
    }

    const status = normaliseStatus(statusRaw);
    const classification = classify(templateId);

    let stats = perTemplate.get(templateId);
    if (!stats) {
      stats = {
        templateId,
        classification,
        pending: 0,
        partial: 0,
        completed: 0,
        cancelled: 0,
        skipped: 0,
        other: 0,
        total: 0,
        sampleRecords: [],
      };
      perTemplate.set(templateId, stats);
    }

    stats[status] += 1;
    stats.total += 1;

    if (stats.sampleRecords.length < 3) {
      stats.sampleRecords.push({
        recordId: record.id,
        status: typeof statusRaw === 'string' ? statusRaw : '(none)',
        deadline,
      });
    }
  }

  return {
    perTemplate,
    total: records.length,
    emptyTemplateCount,
    rawStatusValues,
  };
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

function classificationOrder(c: Classification): number {
  switch (c) {
    case 'v2':
      return 0;
    case 'legacy':
      return 1;
    case 'shipping':
      return 2;
    case 'unknown':
      return 3;
    case 'empty':
      return 4;
  }
}

function renderMarkdown(args: {
  total: number;
  emptyTemplateCount: number;
  perTemplate: Map<string, TemplateStats>;
  rawStatusValues: Set<string>;
  generatedAt: Date;
}): string {
  const { total, emptyTemplateCount, perTemplate, rawStatusValues, generatedAt } =
    args;

  const sortedStats = Array.from(perTemplate.values()).sort((a, b) => {
    const co = classificationOrder(a.classification) - classificationOrder(b.classification);
    if (co !== 0) return co;
    return b.total - a.total;
  });

  const lines: string[] = [];
  lines.push(`# Task template_id Audit — ${generatedAt.toISOString().slice(0, 10)}`);
  lines.push('');
  lines.push(
    `Generated by \`scripts/audit-task-template-ids.ts\` at ${generatedAt.toISOString()}.`
  );
  lines.push('');
  lines.push(`**Total Task records:** ${total}`);
  lines.push(`**Distinct template_id values:** ${perTemplate.size}`);
  lines.push(`**Records with empty template_id:** ${emptyTemplateCount}`);
  lines.push(
    `**Distinct raw status values seen:** ${
      Array.from(rawStatusValues).sort().map((s) => `\`${s}\``).join(', ') || '(none)'
    }`
  );
  lines.push('');

  // ----- Histogram table -----
  lines.push('## By template_id and status');
  lines.push('');
  lines.push(
    '| template_id | classification | pending | partial | completed | cancelled | skipped | other | total |'
  );
  lines.push(
    '|-------------|----------------|---------|---------|-----------|-----------|---------|-------|-------|'
  );
  for (const s of sortedStats) {
    lines.push(
      `| \`${s.templateId}\` | ${s.classification} | ${s.pending} | ${s.partial} | ${s.completed} | ${s.cancelled} | ${s.skipped} | ${s.other} | ${s.total} |`
    );
  }
  lines.push('');

  // ----- Classification table -----
  lines.push('## Classification');
  lines.push('');
  lines.push('| template_id | classification | notes |');
  lines.push('|-------------|----------------|-------|');
  for (const s of sortedStats) {
    let note = '';
    if (s.classification === 'legacy') {
      const v2 = LEGACY_TO_V2[s.templateId];
      if (v2) {
        note = `maps to \`${v2}\` (offset ${V2_OFFSETS[v2] ?? '?'}) per migrate-task-templates.ts`;
      } else {
        note =
          'no direct v2 mapping (likely legacy weekly batch — `order_standard_shirts`)';
      }
    } else if (s.classification === 'v2') {
      note = `offset ${V2_OFFSETS[s.templateId] ?? '?'}`;
    } else if (s.classification === 'shipping') {
      note = 'dynamically generated `shipping_<original>` from legacy auto-create flow';
    } else if (s.classification === 'unknown') {
      note = 'unrecognised — flag for investigation';
    }
    lines.push(`| \`${s.templateId}\` | ${s.classification} | ${note} |`);
  }
  lines.push('');

  // ----- Pending-on-legacy section -----
  const legacyWithPending = sortedStats.filter(
    (s) => s.classification === 'legacy' && s.pending + s.partial > 0
  );
  const shippingWithPending = sortedStats.filter(
    (s) => s.classification === 'shipping' && s.pending + s.partial > 0
  );
  const unknownWithPending = sortedStats.filter(
    (s) => s.classification === 'unknown' && s.pending + s.partial > 0
  );

  lines.push('## Open tasks on non-v2 IDs');
  lines.push('');
  if (legacyWithPending.length === 0) {
    lines.push('**Legacy IDs with open tasks:** None — no legacy template_id has any pending or partial tasks.');
  } else {
    lines.push('**Legacy IDs with open (pending/partial) tasks:**');
    lines.push('');
    lines.push('| template_id | pending | partial | maps to |');
    lines.push('|-------------|---------|---------|---------|');
    for (const s of legacyWithPending) {
      lines.push(
        `| \`${s.templateId}\` | ${s.pending} | ${s.partial} | \`${
          LEGACY_TO_V2[s.templateId] ?? '(no v2 equivalent)'
        }\` |`
      );
    }
  }
  lines.push('');

  if (shippingWithPending.length > 0) {
    lines.push('**Dynamic `shipping_*` IDs with open tasks:**');
    lines.push('');
    lines.push('| template_id | pending | partial |');
    lines.push('|-------------|---------|---------|');
    for (const s of shippingWithPending) {
      lines.push(`| \`${s.templateId}\` | ${s.pending} | ${s.partial} |`);
    }
    lines.push('');
  }

  if (unknownWithPending.length > 0) {
    lines.push('**Unknown IDs with open tasks (NEEDS INVESTIGATION):**');
    lines.push('');
    lines.push('| template_id | pending | partial | total |');
    lines.push('|-------------|---------|---------|-------|');
    for (const s of unknownWithPending) {
      lines.push(
        `| \`${s.templateId}\` | ${s.pending} | ${s.partial} | ${s.total} |`
      );
    }
    lines.push('');
  }

  // ----- Decision -----
  const totalLegacyOpen = legacyWithPending.reduce(
    (sum, s) => sum + s.pending + s.partial,
    0
  );
  const totalShippingOpen = shippingWithPending.reduce(
    (sum, s) => sum + s.pending + s.partial,
    0
  );
  const totalUnknownOpen = unknownWithPending.reduce(
    (sum, s) => sum + s.pending + s.partial,
    0
  );

  lines.push('## Decision');
  lines.push('');
  if (totalLegacyOpen === 0 && totalUnknownOpen === 0) {
    const legacyTotal = sortedStats
      .filter((s) => s.classification === 'legacy')
      .reduce((acc, s) => acc + s.total, 0);
    const legacyClosedSentence =
      legacyTotal === 0
        ? 'There are no records using legacy IDs at all in the live Tasks table — the migration in `scripts/migrate-task-templates.ts` already moved everything to v2.'
        : `All ${legacyTotal} legacy-id tasks are completed/cancelled/skipped, so their meaning is frozen in completion data and we don't need template lookups for them.`;
    const shippingSentence =
      totalShippingOpen > 0
        ? ` There are ${totalShippingOpen} open dynamic \`shipping_*\` tasks, but those are produced from the legacy auto-create-shipping flow and will be retired alongside the legacy code path — they don't need an Airtable rename.`
        : '';
    lines.push('- **Decision:** Skip Task 2.2 (no legacy renames needed in Airtable).');
    lines.push(
      `- **Rationale:** No pending or partial tasks reference legacy template_ids.${shippingSentence} ${legacyClosedSentence} Safe to delete legacy IDs from \`taskTemplates.ts\` without an Airtable migration.`
    );
    if (emptyTemplateCount > 0) {
      lines.push('');
      lines.push(
        `> Note: ${emptyTemplateCount} record(s) have an empty \`template_id\` field. These are not blockers for the legacy-removal decision (they reference no template at all), but flag them as a separate data-hygiene issue.`
      );
    }
  } else {
    const breakdown = [
      totalLegacyOpen > 0 ? `${totalLegacyOpen} on legacy IDs` : '',
      totalUnknownOpen > 0 ? `${totalUnknownOpen} on unknown IDs` : '',
    ]
      .filter(Boolean)
      .join(', ');
    lines.push('- **Decision:** Run Task 2.2 (rename legacy template_ids in Airtable before code removal).');
    lines.push(
      `- **Rationale:** ${breakdown}. These open tasks would be orphaned if we remove the legacy IDs from code, since the lookup paths in \`taskTemplates.ts\`/\`taskService.ts\` would no longer resolve them. Migrate them to v2 IDs first (per the mapping in \`scripts/migrate-task-templates.ts\`), then re-run this audit to confirm the legacy-open count is zero, then proceed with code removal.`
    );
  }
  lines.push('');

  // ----- Sample records for spot-check -----
  lines.push('## Sample records (for spot-checking)');
  lines.push('');
  lines.push('Up to three sample record IDs per template_id:');
  lines.push('');
  lines.push('| template_id | record_id | status | deadline |');
  lines.push('|-------------|-----------|--------|----------|');
  for (const s of sortedStats) {
    for (const sample of s.sampleRecords) {
      lines.push(
        `| \`${s.templateId}\` | \`${sample.recordId}\` | ${sample.status} | ${
          sample.deadline ?? '—'
        } |`
      );
    }
  }
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Console summary
// ---------------------------------------------------------------------------

function printConsoleSummary(args: {
  total: number;
  emptyTemplateCount: number;
  perTemplate: Map<string, TemplateStats>;
}): void {
  const { total, emptyTemplateCount, perTemplate } = args;

  const sortedStats = Array.from(perTemplate.values()).sort((a, b) => {
    const co = classificationOrder(a.classification) - classificationOrder(b.classification);
    if (co !== 0) return co;
    return b.total - a.total;
  });

  console.log('');
  console.log('='.repeat(72));
  console.log('Task template_id Audit — Summary');
  console.log('='.repeat(72));
  console.log(`Total Task records:            ${total}`);
  console.log(`Distinct template_id values:   ${perTemplate.size}`);
  console.log(`Records with empty template_id: ${emptyTemplateCount}`);
  console.log('');

  const colWidth = Math.max(12, ...sortedStats.map((s) => s.templateId.length));
  const pad = (s: string, w: number) => s.padEnd(w);
  console.log(
    `${pad('template_id', colWidth)} | ${pad('class', 8)} | pending | partial | completed | cancelled | skipped | other | total`
  );
  console.log('-'.repeat(colWidth + 76));
  for (const s of sortedStats) {
    console.log(
      `${pad(s.templateId, colWidth)} | ${pad(s.classification, 8)} | ${String(s.pending).padStart(7)} | ${String(s.partial).padStart(7)} | ${String(s.completed).padStart(9)} | ${String(s.cancelled).padStart(9)} | ${String(s.skipped).padStart(7)} | ${String(s.other).padStart(5)} | ${String(s.total).padStart(5)}`
    );
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('Auditing Tasks table template_id distribution...');
  console.log(`Base: ${AIRTABLE_BASE_ID}, Table: ${TASKS_TABLE_ID}`);
  console.log('');

  console.log('Fetching all Tasks records (paginated)...');
  const records = await fetchAllTasks();
  console.log(`Fetched ${records.length} records total.`);

  const { perTemplate, total, emptyTemplateCount, rawStatusValues } =
    aggregate(records);

  printConsoleSummary({ total, emptyTemplateCount, perTemplate });

  const generatedAt = new Date();
  const markdown = renderMarkdown({
    total,
    emptyTemplateCount,
    perTemplate,
    rawStatusValues,
    generatedAt,
  });

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, markdown, 'utf8');
  console.log(`Wrote audit report to: ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
