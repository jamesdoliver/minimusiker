'use client';

import { useMemo, useState } from 'react';
import type { PrintableTextConfig, PrintableItemType } from '@/lib/config/printableTextConfig';
import { partialBasenameFor } from '@/lib/config/printableShared';
import type { PrintableFieldDef } from '@/lib/config/printableFields';
import type { FormModeItemState, FormModeFieldOverride, FieldRender } from '@/lib/config/formModeState';
import { mergeFieldRender } from '@/lib/config/formModeState';
import type { ResolverBooking } from '@/lib/config/printableFieldResolver';
import { resolveFieldValues } from '@/lib/config/printableFieldResolver';
import type { MasterCdTrack } from '@/lib/services/masterCdService';
import DraggableText from './DraggableText';
import DraggableQrCode from './DraggableQrCode';

/** Single source of truth for the form-mode canvas display width (CSS px). */
const CANVAS_DISPLAY_WIDTH = 800;

export interface FormModeEditorProps {
  itemConfig: PrintableTextConfig;
  fields: PrintableFieldDef[];
  state: FormModeItemState;
  onStateChange: (next: FormModeItemState) => void;
  booking: ResolverBooking;
  /** Pass-through props the legacy editor consumes; preserved here for parity. */
  schoolName: string;
  accessCode?: number;
  eventDate: string;
  /** Master CD tracklist; consumed by `songList` computed source. May be null when not yet loaded or when the event has no songs. */
  tracklist?: MasterCdTrack[] | null;
}

/**
 * Form-mode editor for migrated printable items. Renders a two-pane layout:
 * a form panel on the left (Task 10 fills inputs in) and a canvas on the right
 * showing the partially-blank PDF preview PNG. Field overlays (Task 9) and
 * form inputs (Task 10) layer on top of this skeleton.
 *
 * Phase 0 wires Flyer 1 (front + back). Subsequent phases reuse this component.
 */
export function FormModeEditor(props: FormModeEditorProps) {
  const partialPreviewSrc = useMemo(
    () => previewPathFor(props.itemConfig.type),
    [props.itemConfig.type],
  );

  const resolved = useMemo(
    () => resolveFieldValues(props.fields, props.booking, null, props.tracklist ?? null),
    [props.fields, props.booking, props.tracklist],
  );

  const renders: FieldRender[] = useMemo(
    () => props.fields.map(def =>
      mergeFieldRender(def, props.state[def.key], resolved[def.key] ?? defaultResolvedFor(def.kind)),
    ),
    [props.fields, props.state, resolved],
  );

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const scale = CANVAS_DISPLAY_WIDTH / props.itemConfig.pdfDimensions.width;
  const canvasDisplayHeight = props.itemConfig.pdfDimensions.height * scale;

  function updateOverride(key: string, patch: Partial<FormModeFieldOverride>) {
    props.onStateChange({
      ...props.state,
      [key]: { ...(props.state[key] ?? {}), ...patch },
    });
  }

  function resetField(key: string) {
    const current = props.state[key];
    if (!current) return;
    // Strip text + textOverridden, preserve the rest (position, size, font, color).
    const { text: _t, textOverridden: _to, ...rest } = current;
    const next = { ...props.state };
    if (Object.keys(rest).length === 0) {
      delete next[key];
    } else {
      next[key] = rest;
    }
    props.onStateChange(next);
  }

  return (
    <div className="flex gap-4 h-full">
      <aside className="w-72 shrink-0 border-r border-gray-200 pr-4 overflow-y-auto">
        <h3 className="font-semibold text-sm mb-3">{props.itemConfig.name}</h3>
        <div className="space-y-3">
          {props.fields.map(def => {
            const render = renders.find(r => r.key === def.key);
            if (!render) return null;
            return (
              <FieldFormRow
                key={def.key}
                def={def}
                render={render}
                override={props.state[def.key]}
                onChange={patch => updateOverride(def.key, patch)}
                onReset={() => resetField(def.key)}
                isSelected={selectedKey === def.key}
                onFocus={() => setSelectedKey(def.key)}
              />
            );
          })}
        </div>
      </aside>

      <main className="flex-1 min-h-0 overflow-auto bg-gray-50">
        {/* Inner wrapper centers the canvas when it fits the viewport, and grows
            past the visible area (so the outer <main> can scroll) when the
            canvas is taller than the available space — e.g. portrait Flyer 3. */}
        <div className="min-h-full flex items-center justify-center p-4">
        <div
          className="relative"
          style={{ width: CANVAS_DISPLAY_WIDTH, height: canvasDisplayHeight, maxWidth: '100%' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={partialPreviewSrc}
            alt={`${props.itemConfig.name} preview`}
            className="block w-full h-full select-none pointer-events-none"
            draggable={false}
          />
          {renders.map(r => {
            const isSelected = selectedKey === r.key;
            const cssPos = { x: r.position.x * scale, y: r.position.y * scale };
            const cssSize = { width: r.size.width * scale, height: r.size.height * scale };

            if (r.kind === 'qr') {
              return (
                <DraggableQrCode
                  key={r.key}
                  position={cssPos}
                  size={cssSize.width}
                  canvasWidth={CANVAS_DISPLAY_WIDTH}
                  canvasHeight={canvasDisplayHeight}
                  qrUrl={r.url}
                  onPositionChange={p => updateOverride(r.key, {
                    position: { x: p.x / scale, y: p.y / scale },
                  })}
                  onSizeChange={s => updateOverride(r.key, {
                    size: { width: s / scale, height: s / scale },
                  })}
                  onResize={(p, s) => updateOverride(r.key, {
                    position: { x: p.x / scale, y: p.y / scale },
                    size: { width: s / scale, height: s / scale },
                  })}
                />
              );
            }
            return (
              <DraggableText
                key={r.key}
                text={r.text ?? ''}
                fontSize={(r.fontSize ?? 14) * scale}
                position={cssPos}
                size={cssSize}
                canvasWidth={CANVAS_DISPLAY_WIDTH}
                canvasHeight={canvasDisplayHeight}
                color={r.color}
                fontFamily={r.fontFamily}
                isSelected={isSelected}
                onSelect={() => setSelectedKey(r.key)}
                onPositionChange={p => updateOverride(r.key, {
                  position: { x: p.x / scale, y: p.y / scale },
                })}
                onSizeChange={s => updateOverride(r.key, {
                  size: { width: s.width / scale, height: s.height / scale },
                })}
              />
            );
          })}
        </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Resolve the partial-blank preview PNG path for an item type. Filename
 * convention: `<basename>-partial-<front|back>.png`. The basename mapping
 * is shared with the runtime + upload script via `partialBasenameFor`.
 */
function previewPathFor(itemType: PrintableItemType): string {
  const isBack = itemType.endsWith('-back');
  const basename = partialBasenameFor(itemType);
  const suffix = isBack ? 'back' : 'front';
  return `/images/printable_previews/${basename}-partial-${suffix}.png`;
}

function defaultResolvedFor(kind: 'text' | 'qr' | 'date') {
  if (kind === 'qr') return { kind: 'qr' as const, url: '' };
  return { kind, text: '' };
}

interface FieldFormRowProps {
  def: PrintableFieldDef;
  render: FieldRender;
  override: FormModeFieldOverride | undefined;
  onChange: (patch: Partial<FormModeFieldOverride>) => void;
  onReset: () => void;
  isSelected: boolean;
  onFocus: () => void;
}

function FieldFormRow(props: FieldFormRowProps) {
  const { def, render, override, onChange, onReset, isSelected, onFocus } = props;
  const isTextOverridden = override?.textOverridden === true;
  // Use a textarea for multi-line text fields based on the explicit registry flag.
  const isMultiline = def.kind === 'text' && def.multiline === true;

  return (
    <div
      className={`p-2 rounded border cursor-pointer ${
        isSelected ? 'border-[#F4A261] bg-orange-50' : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={onFocus}
    >
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-700">{def.label}</label>
        {isTextOverridden && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onReset();
            }}
            className="text-xs text-gray-500 hover:text-[#E07B3A]"
          >
            Reset
          </button>
        )}
      </div>

      {def.kind === 'qr' ? (
        <input
          type="text"
          value={render.url ?? ''}
          readOnly
          className="w-full text-xs px-2 py-1 border border-gray-200 rounded bg-gray-50 text-gray-500"
        />
      ) : isMultiline ? (
        <textarea
          value={render.text ?? ''}
          onChange={e => onChange({ text: e.target.value, textOverridden: true })}
          onFocus={onFocus}
          rows={3}
          className="w-full text-xs px-2 py-1 border border-gray-300 rounded resize-y"
        />
      ) : (
        <input
          type="text"
          value={render.text ?? ''}
          onChange={e => onChange({ text: e.target.value, textOverridden: true })}
          onFocus={onFocus}
          className="w-full text-xs px-2 py-1 border border-gray-300 rounded"
        />
      )}
    </div>
  );
}
