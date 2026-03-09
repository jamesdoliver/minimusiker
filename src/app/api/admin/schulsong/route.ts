import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { EINRICHTUNGEN_TABLE_ID, EINRICHTUNGEN_FIELD_IDS, EVENTS_TABLE_ID, EVENTS_FIELD_IDS } from '@/lib/types/airtable';

export const dynamic = 'force-dynamic';

async function fetchEinrichtungNames(ids: string[]): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  if (uniqueIds.length === 0) return nameMap;

  const filterFormula = `OR(${uniqueIds.map(id => `RECORD_ID()='${id}'`).join(',')})`;

  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!);
  const records = await base(EINRICHTUNGEN_TABLE_ID)
    .select({
      filterByFormula: filterFormula,
      fields: [EINRICHTUNGEN_FIELD_IDS.customer_name],
      returnFieldsByFieldId: true,
    })
    .all();

  for (const record of records) {
    const name = record.fields[EINRICHTUNGEN_FIELD_IDS.customer_name] as string | undefined;
    if (name) {
      nameMap.set(record.id, name);
    }
  }

  return nameMap;
}

async function fetchEventCodes(ids: string[]): Promise<Map<string, string>> {
  const codeMap = new Map<string, string>();
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  if (uniqueIds.length === 0) return codeMap;

  const filterFormula = `OR(${uniqueIds.map(id => `RECORD_ID()='${id}'`).join(',')})`;

  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!);
  const records = await base(EVENTS_TABLE_ID)
    .select({
      filterByFormula: filterFormula,
      fields: [EVENTS_FIELD_IDS.event_id],
      returnFieldsByFieldId: true,
    })
    .all();

  for (const record of records) {
    const eventCode = record.fields[EVENTS_FIELD_IDS.event_id] as string | undefined;
    if (eventCode) {
      codeMap.set(record.id, eventCode);
    }
  }

  return codeMap;
}

export async function GET(request: NextRequest) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const airtableService = getAirtableService();
    const schulsongs = await airtableService.getAllSchulsongs();

    // Resolve Einrichtung names in a single batch call
    const einrichtungIds = schulsongs.map(s => s.einrichtungenId).filter(Boolean) as string[];
    const einrichtungNames = await fetchEinrichtungNames(einrichtungIds);

    // Resolve Event codes in a single batch call
    const eventIds = schulsongs.map(s => s.eventId).filter(Boolean) as string[];
    const eventCodes = await fetchEventCodes(eventIds);

    const enrichedSchulsongs = schulsongs.map(s => ({
      ...s,
      einrichtungName: s.einrichtungenId ? einrichtungNames.get(s.einrichtungenId) : undefined,
      eventCode: s.eventId ? eventCodes.get(s.eventId) : undefined,
    }));

    return NextResponse.json({
      success: true,
      data: { schulsongs: enrichedSchulsongs },
    });
  } catch (error) {
    console.error('Error fetching schulsongs:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch schulsongs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.songName?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Song name is required' },
        { status: 400 }
      );
    }
    if (!body.einrichtungenId?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Einrichtung (school) is required' },
        { status: 400 }
      );
    }

    const airtableService = getAirtableService();
    const schulsong = await airtableService.createSchulsong({
      songName: body.songName.trim(),
      einrichtungenId: body.einrichtungenId.trim(),
      schulsongTyp: body.schulsongTyp || undefined,
      statusBooking: body.statusBooking || undefined,
      statusProduktion: body.statusProduktion || undefined,
      songtext: body.songtext?.trim() || undefined,
      songtextGoogleDocUrl: body.songtextGoogleDocUrl?.trim() || undefined,
      feedback: body.feedback?.trim() || undefined,
      poolsongAuswahl: body.poolsongAuswahl || undefined,
      gebuchtAm: body.gebuchtAm || undefined,
      aufnahmetagDatum: body.aufnahmetagDatum || undefined,
      projekteId: body.projekteId || undefined,
      streamingLink: body.streamingLink?.trim() || undefined,
      layoutUrl: body.layoutUrl?.trim() || undefined,
      playbackUrl: body.playbackUrl?.trim() || undefined,
      songUrl: body.songUrl?.trim() || undefined,
      notenUrl: body.notenUrl?.trim() || undefined,
      textUrl: body.textUrl?.trim() || undefined,
      materialUrl: body.materialUrl?.trim() || undefined,
      instrumentalUrl: body.instrumentalUrl?.trim() || undefined,
      leadUrl: body.leadUrl?.trim() || undefined,
      backingsUrl: body.backingsUrl?.trim() || undefined,
      notenKonfig: body.notenKonfig,
      uebematerialKonfig: body.uebematerialKonfig,
      streamingKonfig: body.streamingKonfig,
      cdKonfig: body.cdKonfig != null ? Number(body.cdKonfig) : undefined,
      aufnahmetagKonfig: body.aufnahmetagKonfig,
      miniKonfig: body.miniKonfig,
    });

    return NextResponse.json({ success: true, data: schulsong });
  } catch (error) {
    console.error('Error creating schulsong:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create schulsong' },
      { status: 500 }
    );
  }
}
