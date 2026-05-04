'use client';

import { hasFormMode, getFieldRegistry } from '@/lib/config/printableFieldRegistry';
import { PrintableEditor, type PrintableEditorProps } from './PrintableEditor';
import { FormModeEditor } from './FormModeEditor';
import type { FormModeItemState } from '@/lib/config/formModeState';
import type { PrintableItemType } from '@/lib/config/printableTextConfig';
import type { ResolverBooking } from '@/lib/config/printableFieldResolver';
import type { MasterCdTrack } from '@/lib/services/masterCdService';

export interface PrintableFormEditorProps extends PrintableEditorProps {
  /** Per-item override map; consulted only when hasFormMode(itemType). */
  formModeState: FormModeItemState;
  /** Called by FormModeEditor when admin edits a field; lifts to modal state. */
  onFormModeStateChange: (itemType: PrintableItemType, next: FormModeItemState) => void;
  /** Booking projection for the resolver. */
  booking: ResolverBooking;
  /** Master CD tracklist for items whose fields use the `songList` computed source. */
  tracklist?: MasterCdTrack[] | null;
}

/**
 * Editor router. For migrated items (registered via printableFieldRegistry.ts)
 * renders the new FormModeEditor; otherwise falls through to the legacy
 * draggable PrintableEditor.
 */
export function PrintableFormEditor(props: PrintableFormEditorProps) {
  const itemType = props.itemConfig.type;
  const fields = getFieldRegistry(itemType);

  if (hasFormMode(itemType) && fields) {
    // PrintableEditorProps allows accessCode: string | number and eventDate?:
    // string for legacy parity. Form-mode tightens both: accessCode is numeric
    // (we coerce here) and eventDate is required (default to '').
    const accessCodeNum =
      typeof props.accessCode === 'string'
        ? Number(props.accessCode) || undefined
        : props.accessCode;
    return (
      <FormModeEditor
        itemConfig={props.itemConfig}
        fields={fields}
        state={props.formModeState}
        onStateChange={next => props.onFormModeStateChange(itemType, next)}
        booking={props.booking}
        schoolName={props.schoolName}
        accessCode={accessCodeNum}
        eventDate={props.eventDate ?? ''}
        tracklist={props.tracklist}
      />
    );
  }

  // Legacy path: strip form-mode props before spreading.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { formModeState: _fms, onFormModeStateChange: _ofs, booking: _b, tracklist: _tl, ...legacyProps } = props;
  return <PrintableEditor {...legacyProps} />;
}
