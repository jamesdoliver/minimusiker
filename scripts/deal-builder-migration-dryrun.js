/**
 * Deal Builder Migration — Dry Run
 *
 * Scans all events with deal_builder_enabled=true and reports:
 * - Current deal type and config summary
 * - Current legacy flags vs expected flags from dealTypeToFlags()
 * - Whether scs_shirts_included needs to be set
 * - Whether hidden_products needs updating for SCS events
 * - Mismatches and items needing attention
 *
 * NO WRITES — read-only audit.
 */

const Airtable = require('airtable');
require('dotenv').config({ path: '.env.local' });

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';

const FIELDS = {
  event_id: 'fldcNaHZyr6E5khDe',
  school_name: 'fld5QcpEsDFrLun6w',
  event_date: 'fld7pswBblm9jlOsS',
  status: 'fld636QqQuc5Uwyec',
  estimated_children: 'fldjnXCnyfeA1KSeX',
  // Legacy flags
  is_plus: 'fldMFQPU0v0SEmGqJ',
  is_kita: 'flddRbQV0qoqR3KIr',
  is_schulsong: 'fld2ml1yiecD1a5ms',
  is_minimusikertag: 'fld2GuudFY4Rk6f8i',
  // Deal builder
  deal_builder_enabled: 'fld19LJoYvr3ZVKpc',
  deal_type: 'fldJNjJnyIPOMmb9y',
  deal_config: 'fldw4PwiZTkShCZ7q',
  // Timeline overrides (for hidden_products check)
  timeline_overrides: 'fld25hstx4yePlpnB',
};

// Replicate dealTypeToFlags logic from src/lib/utils/dealCalculator.ts
function dealTypeToFlags(dealType, config) {
  switch (dealType) {
    case 'mimu':
      return {
        is_minimusikertag: true,
        is_plus: (config.music_pricing_enabled ?? config.cheaper_music) === true,
        is_kita: false,
        is_schulsong: true,
      };
    case 'mimu_scs':
      return {
        is_minimusikertag: true,
        is_plus: config.scs_audio_pricing === 'plus',
        is_kita: false,
        is_schulsong: config.scs_song_option !== 'none',
      };
    case 'schus':
    case 'schus_xl':
      return {
        is_minimusikertag: false,
        is_plus: false,
        is_kita: false,
        is_schulsong: true,
      };
    default:
      return null;
  }
}

function parseDealConfig(raw) {
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

function parseTimelineOverrides(raw) {
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

async function run() {
  console.log('=== Deal Builder Migration — Dry Run ===\n');
  console.log('Fetching all events...\n');

  const allRecords = await base(EVENTS_TABLE_ID)
    .select({
      fields: Object.values(FIELDS),
      returnFieldsByFieldId: true,
    })
    .all();

  const dealBuilderEvents = allRecords.filter(
    (r) => r.fields[FIELDS.deal_builder_enabled] === true
  );

  console.log(`Total events: ${allRecords.length}`);
  console.log(`Events with deal_builder_enabled=true: ${dealBuilderEvents.length}\n`);

  if (dealBuilderEvents.length === 0) {
    console.log('No events with deal builder enabled. Migration is trivial — just deploy the code changes.');
    return;
  }

  console.log('='.repeat(100));

  const issues = [];
  const migrationActions = [];

  for (const record of dealBuilderEvents) {
    const f = record.fields;
    const eventId = f[FIELDS.event_id] || record.id;
    const schoolName = f[FIELDS.school_name] || '(unknown school)';
    const eventDate = f[FIELDS.event_date] || '(no date)';
    const status = f[FIELDS.status] || '(no status)';
    const estimatedChildren = f[FIELDS.estimated_children] || 0;

    const dealType = f[FIELDS.deal_type] || null;
    const dealConfig = parseDealConfig(f[FIELDS.deal_config]);
    const timelineOverrides = parseTimelineOverrides(f[FIELDS.timeline_overrides]);

    // Current legacy flags
    const currentFlags = {
      is_minimusikertag: !!f[FIELDS.is_minimusikertag],
      is_plus: !!f[FIELDS.is_plus],
      is_kita: !!f[FIELDS.is_kita],
      is_schulsong: !!f[FIELDS.is_schulsong],
    };

    // Expected flags from deal type
    const expectedFlags = dealType ? dealTypeToFlags(dealType, dealConfig || {}) : null;

    // Flag comparison
    const flagMismatches = [];
    if (expectedFlags) {
      for (const key of Object.keys(expectedFlags)) {
        if (currentFlags[key] !== expectedFlags[key]) {
          flagMismatches.push(`${key}: current=${currentFlags[key]}, expected=${expectedFlags[key]}`);
        }
      }
    }

    // SCS analysis
    const isScsWithShirts = dealType === 'mimu_scs' && (dealConfig?.scs_shirts_included !== false);
    const needsScsShirtsFlag = isScsWithShirts;

    // Hidden products analysis for SCS
    const hiddenProducts = timelineOverrides?.hidden_products || [];
    const scsRequiredHidden = ['minicard', 'minicard-cd-bundle', 'tshirt', 'tshirt-hoodie'];
    const missingHiddenProducts = isScsWithShirts
      ? scsRequiredHidden.filter((p) => !hiddenProducts.includes(p))
      : [];

    // Deal config summary
    const configSummary = [];
    if (dealConfig) {
      if (dealConfig.scs_pauschale_enabled) configSummary.push(`SCS Pauschale`);
      if (dealConfig.pauschale_enabled) configSummary.push(`Pauschale`);
      if (dealConfig.music_pricing_enabled) configSummary.push(`Music pricing (Plus)`);
      if (dealConfig.distance_surcharge) configSummary.push(`Distance surcharge`);
      if (dealConfig.kleine_einrichtung_enabled) configSummary.push(`Kleine Einrichtung`);
      if (dealConfig.grosse_einrichtung_enabled) configSummary.push(`Grosse Einrichtung`);
      if (dealConfig.scs_song_option) configSummary.push(`Song option: ${dealConfig.scs_song_option}`);
      if (dealConfig.scs_shirts_included !== undefined) configSummary.push(`Shirts included: ${dealConfig.scs_shirts_included}`);
      if (dealConfig.scs_audio_pricing) configSummary.push(`Audio pricing: ${dealConfig.scs_audio_pricing}`);
      if (dealConfig.gratis_tshirts_enabled) configSummary.push(`Gratis T-shirts: ${dealConfig.gratis_tshirts_quantity || '?'}`);
      if (dealConfig.gratis_minicards_enabled) configSummary.push(`Gratis Minicards: ${dealConfig.gratis_minicards_quantity || '?'}`);
      if (dealConfig.additional_fees?.length) configSummary.push(`Custom fees: ${dealConfig.additional_fees.length} items`);
      if (dealConfig.calculated_fee != null) configSummary.push(`Total fee: €${dealConfig.calculated_fee}`);
    }

    // Determine attention needed
    const needsAttention = [];
    if (flagMismatches.length > 0) needsAttention.push('FLAG_MISMATCH');
    if (!dealType) needsAttention.push('NO_DEAL_TYPE');
    if (needsScsShirtsFlag) needsAttention.push('NEEDS_SCS_SHIRTS_FLAG');
    if (missingHiddenProducts.length > 0) needsAttention.push('NEEDS_HIDDEN_PRODUCTS');

    // Print report for this event
    console.log(`\n📋 Event: ${schoolName}`);
    console.log(`   Record ID: ${record.id}`);
    console.log(`   Event ID: ${eventId}`);
    console.log(`   Date: ${eventDate} | Status: ${status} | Est. children: ${estimatedChildren}`);
    console.log(`   Deal Type: ${dealType || '(none set)'}`);
    console.log(`   Config: ${configSummary.length > 0 ? configSummary.join(', ') : '(empty)'}`);
    console.log(`   Current Flags: mimu=${currentFlags.is_minimusikertag} plus=${currentFlags.is_plus} schulsong=${currentFlags.is_schulsong} kita=${currentFlags.is_kita}`);

    if (expectedFlags) {
      console.log(`   Expected Flags: mimu=${expectedFlags.is_minimusikertag} plus=${expectedFlags.is_plus} schulsong=${expectedFlags.is_schulsong} kita=${expectedFlags.is_kita}`);
    }

    if (flagMismatches.length > 0) {
      console.log(`   ⚠️  FLAG MISMATCHES: ${flagMismatches.join(' | ')}`);
    } else if (expectedFlags) {
      console.log(`   ✅ Flags in sync`);
    }

    if (needsScsShirtsFlag) {
      console.log(`   🔧 MIGRATION: Set scs_shirts_included=true on this event`);
    }

    if (missingHiddenProducts.length > 0) {
      console.log(`   🔧 MIGRATION: Add to hidden_products: ${missingHiddenProducts.join(', ')}`);
    }

    if (needsAttention.length > 0) {
      console.log(`   🚩 NEEDS ATTENTION: ${needsAttention.join(', ')}`);
      issues.push({ eventId, schoolName, status, issues: needsAttention });
    } else {
      console.log(`   ✅ No issues — safe to decouple`);
    }

    // Track migration actions
    if (flagMismatches.length > 0) {
      migrationActions.push({ recordId: record.id, schoolName, action: 'SYNC_FLAGS', expectedFlags });
    }
    if (needsScsShirtsFlag) {
      migrationActions.push({ recordId: record.id, schoolName, action: 'SET_SCS_SHIRTS' });
    }
    if (missingHiddenProducts.length > 0) {
      migrationActions.push({ recordId: record.id, schoolName, action: 'UPDATE_HIDDEN_PRODUCTS', products: missingHiddenProducts });
    }

    console.log('-'.repeat(100));
  }

  // Summary
  console.log('\n' + '='.repeat(100));
  console.log('\n=== MIGRATION SUMMARY ===\n');
  console.log(`Total deal builder events: ${dealBuilderEvents.length}`);
  console.log(`Events with issues: ${issues.length}`);
  console.log(`Migration actions needed: ${migrationActions.length}`);

  if (issues.length > 0) {
    console.log('\n--- Events Needing Attention ---');
    for (const issue of issues) {
      console.log(`  ${issue.schoolName} (${issue.status}): ${issue.issues.join(', ')}`);
    }
  }

  if (migrationActions.length > 0) {
    console.log('\n--- Migration Actions ---');
    for (const action of migrationActions) {
      switch (action.action) {
        case 'SYNC_FLAGS':
          console.log(`  ${action.schoolName}: Sync flags → mimu=${action.expectedFlags.is_minimusikertag} plus=${action.expectedFlags.is_plus} schulsong=${action.expectedFlags.is_schulsong} kita=${action.expectedFlags.is_kita}`);
          break;
        case 'SET_SCS_SHIRTS':
          console.log(`  ${action.schoolName}: Set scs_shirts_included=true`);
          break;
        case 'UPDATE_HIDDEN_PRODUCTS':
          console.log(`  ${action.schoolName}: Hide products: ${action.products.join(', ')}`);
          break;
      }
    }
  }

  if (migrationActions.length === 0) {
    console.log('\n✅ No migration actions needed — all events are clean. Safe to deploy code changes.');
  }
}

run().catch(console.error);
