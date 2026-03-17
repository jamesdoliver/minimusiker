'use client';

import { useState, useMemo } from 'react';
import { DealConfig, DealConfigPreset } from '@/lib/types/airtable';

// ─── Props ───────────────────────────────────────────────────────────
interface DealBuilderProps {
  dealConfig: DealConfig;
  isPlus?: boolean;
  scsShirtsIncluded?: boolean;
  minicardOrderEnabled?: boolean;
  minicardOrderQuantity?: number;
  onSave: (config: DealConfig) => void;
  isUpdating?: boolean;
}

// ─── Preset definitions ──────────────────────────────────────────────
type PresetKey = 'pauschale' | 'distance_surcharge' | 'kleine_einrichtung' | 'schulsong_vorlage' | 'schulsong_individuell';

interface PresetDef {
  key: PresetKey;
  label: string;
  defaultAmount: number;
  defaultEnabled?: boolean;
}

const PRESET_DEFS: PresetDef[] = [
  { key: 'pauschale',              label: 'Pauschale',                          defaultAmount: 0,    defaultEnabled: true },
  { key: 'distance_surcharge',     label: 'Entfernungspauschale',               defaultAmount: 0 },
  { key: 'kleine_einrichtung',     label: 'Zuschlag für kleine Einrichtungen',  defaultAmount: 0 },
  { key: 'schulsong_vorlage',      label: 'Schulsong (nach Vorlage)',           defaultAmount: 1000 },
  { key: 'schulsong_individuell',  label: 'Schulsong (individuell)',            defaultAmount: 1800 },
];

// ─── Helpers ─────────────────────────────────────────────────────────
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

/**
 * Migrate old preset keys to v3 structure.
 * Maps old keys to new ones where possible.
 */
function migratePresets(cfg: DealConfig): DealConfig['presets'] {
  const existing = cfg.presets;
  if (!existing) return undefined;

  const migrated: NonNullable<DealConfig['presets']> = { ...existing };

  // Carry over pauschale, distance_surcharge, kleine_einrichtung as-is (keys unchanged)
  // Map old schulsong_discount → schulsong_vorlage if no v3 keys exist yet
  if (!migrated.schulsong_vorlage && !migrated.schulsong_individuell) {
    if (existing.schulsong_discount) {
      migrated.schulsong_vorlage = {
        enabled: existing.schulsong_discount.enabled,
        amount: Math.abs(existing.schulsong_discount.amount) || 1000,
      };
    }
  }

  return migrated;
}

// ─── Sub-components ──────────────────────────────────────────────────

function PresetRow({
  label,
  preset,
  defaultAmount,
  onChange,
  disabled,
}: {
  label: string;
  preset?: DealConfigPreset;
  defaultAmount: number;
  onChange: (preset: DealConfigPreset) => void;
  disabled?: boolean;
}) {
  const enabled = preset?.enabled ?? false;
  const amount = preset?.amount ?? defaultAmount;

  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange({ enabled: e.target.checked, amount })}
          disabled={disabled}
          className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
        />
        <span className={`text-sm ${enabled ? 'text-gray-800' : 'text-gray-500'}`}>{label}</span>
      </label>
      <span className="inline-flex items-center gap-1">
        <span className="text-xs text-gray-400">€</span>
        <input
          type="number"
          min="0"
          step="50"
          value={amount}
          onChange={(e) => {
            const raw = parseFloat(e.target.value);
            if (!isNaN(raw)) {
              onChange({ enabled, amount: raw });
            }
          }}
          disabled={disabled}
          className={`w-20 text-sm px-2 py-1 rounded border text-right tabular-nums ${
            enabled ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-400'
          } focus:outline-none focus:ring-1 focus:ring-emerald-400`}
        />
      </span>
    </div>
  );
}

function CustomFeesSection({
  fees,
  onChange,
  disabled,
}: {
  fees: { title: string; amount: number }[];
  onChange: (fees: { title: string; amount: number }[]) => void;
  disabled?: boolean;
}) {
  function updateFee(index: number, field: 'title' | 'amount', value: string | number) {
    const next = [...fees];
    if (field === 'title') {
      next[index] = { ...next[index], title: value as string };
    } else {
      next[index] = { ...next[index], amount: value as number };
    }
    onChange(next);
  }

  function removeFee(index: number) {
    onChange(fees.filter((_, i) => i !== index));
  }

  function addFee() {
    onChange([...fees, { title: '', amount: 0 }]);
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Individuelle Deals</h4>
      {fees.length === 0 && (
        <div className="flex items-center gap-2 opacity-40">
          <input
            type="text"
            placeholder="z.B. Pauschale für gratis Minicards"
            disabled
            className="flex-1 text-sm px-2 py-1 rounded border border-gray-200 bg-gray-50"
          />
          <span className="text-xs text-gray-400">€</span>
          <input
            type="number"
            placeholder="-"
            disabled
            className="w-20 text-sm px-2 py-1 rounded border border-gray-200 bg-gray-50 text-right"
          />
        </div>
      )}
      {fees.map((f, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={f.title}
            placeholder="Bezeichnung"
            onChange={(e) => updateFee(i, 'title', e.target.value)}
            disabled={disabled}
            className="flex-1 text-sm px-2 py-1 rounded border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
          <span className="text-xs text-gray-400">€</span>
          <input
            type="number"
            step="50"
            value={f.amount === 0 ? '0' : f.amount || ''}
            onChange={(e) => {
              const raw = e.target.value;
              updateFee(i, 'amount', raw === '' ? 0 : parseFloat(raw) || 0);
            }}
            disabled={disabled}
            className="w-20 text-sm px-2 py-1 rounded border border-gray-200 bg-white text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
          <button
            type="button"
            onClick={() => removeFee(i)}
            disabled={disabled}
            className="text-gray-400 hover:text-red-500 p-0.5"
            title="Entfernen"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addFee}
        disabled={disabled}
        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
      >
        + weiteren Posten hinzufügen
      </button>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────

export default function DealBuilder({
  dealConfig,
  isPlus,
  scsShirtsIncluded,
  minicardOrderEnabled,
  minicardOrderQuantity,
  onSave,
  isUpdating,
}: DealBuilderProps) {
  const [localConfig, setLocalConfig] = useState<DealConfig>(() => {
    const migrated = migratePresets(dealConfig);
    const cfg = migrated ? { ...dealConfig, presets: migrated } : dealConfig;
    // Ensure pauschale is always enabled for new configs
    if (!cfg.presets?.pauschale) {
      return {
        ...cfg,
        presets: {
          ...cfg.presets,
          pauschale: { enabled: true, amount: 0 },
        },
      };
    }
    return cfg;
  });
  const [isDirty, setIsDirty] = useState(false);

  // ── Derived total ────────────────────────────────────────────────
  const total = useMemo(() => {
    let sum = 0;
    if (localConfig.presets) {
      for (const key of PRESET_DEFS.map(d => d.key)) {
        const preset = localConfig.presets[key];
        if (preset?.enabled) sum += preset.amount;
      }
    }
    for (const fee of localConfig.additional_fees ?? []) {
      sum += fee.amount;
    }
    return sum;
  }, [localConfig]);

  // ── State updaters ───────────────────────────────────────────────
  function updatePreset(key: PresetKey, preset: DealConfigPreset) {
    setLocalConfig(prev => ({
      ...prev,
      presets: { ...prev.presets, [key]: preset },
    }));
    setIsDirty(true);
  }

  function updateConfig(partial: Partial<DealConfig>) {
    setLocalConfig(prev => ({ ...prev, ...partial }));
    setIsDirty(true);
  }

  function handleSave() {
    const breakdownItems: { label: string; amount: number }[] = [];

    for (const def of PRESET_DEFS) {
      const preset = localConfig.presets?.[def.key];
      if (preset?.enabled) {
        breakdownItems.push({ label: def.label, amount: preset.amount });
      }
    }

    for (const fee of localConfig.additional_fees || []) {
      if (fee.title && fee.amount !== 0) {
        breakdownItems.push({ label: fee.title, amount: fee.amount });
      }
    }

    const configToSave: DealConfig = {
      ...localConfig,
      calculated_fee: total,
      fee_breakdown: { base: 0, items: breakdownItems, total },
      // Store Zusatzinformationen snapshot
      info_tshirts_included: scsShirtsIncluded,
      info_tshirts_quantity: localConfig.info_tshirts_quantity,
      info_minicards_included: minicardOrderEnabled,
      info_minicards_quantity: localConfig.info_minicards_quantity,
      info_scs: scsShirtsIncluded,
      info_plus: isPlus,
    };
    onSave(configToSave);
    setIsDirty(false);
  }

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="pb-3 border-b border-gray-100">
        <span className="text-lg font-semibold text-gray-900">Deal Builder</span>
      </div>

      <div className="pt-4 space-y-5">
        {/* ── Presets ─────────────────────────────────────────── */}
        <div className="space-y-2.5">
          {PRESET_DEFS.map((def) => (
            <PresetRow
              key={def.key}
              label={def.label}
              preset={localConfig.presets?.[def.key]}
              defaultAmount={def.defaultAmount}
              onChange={(p) => updatePreset(def.key, p)}
              disabled={isUpdating}
            />
          ))}
        </div>

        {/* ── Individuelle Deals ─────────────────────────────── */}
        <CustomFeesSection
          fees={localConfig.additional_fees ?? []}
          onChange={(fees) => {
            updateConfig({ additional_fees: fees.length > 0 ? fees : undefined });
          }}
          disabled={isUpdating}
        />

        {/* ── Zusatzinformationen (read-only from Event Config + note quantities) */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Zusatzinformationen</h4>
          <div className="space-y-2">
            {/* T-Shirts inkl. */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={scsShirtsIncluded || false}
                disabled
                className="w-4 h-4 rounded border-gray-300 text-emerald-600"
              />
              <span className={`text-sm flex-1 ${scsShirtsIncluded ? 'text-gray-800' : 'text-gray-400'}`}>T-Shirts inkl.</span>
              <span className="text-xs text-gray-400">Anzahl</span>
              <input
                type="number"
                min="0"
                value={localConfig.info_tshirts_quantity ?? 0}
                onChange={(e) => {
                  updateConfig({ info_tshirts_quantity: parseInt(e.target.value) || 0 });
                }}
                disabled={isUpdating}
                className="w-16 text-sm px-2 py-1 rounded border border-gray-200 bg-white text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
            </div>

            {/* Minicards inkl. */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={minicardOrderEnabled || false}
                disabled
                className="w-4 h-4 rounded border-gray-300 text-emerald-600"
              />
              <span className={`text-sm flex-1 ${minicardOrderEnabled ? 'text-gray-800' : 'text-gray-400'}`}>Minicards inkl.</span>
              <span className="text-xs text-gray-400">Anzahl</span>
              <input
                type="number"
                min="0"
                value={localConfig.info_minicards_quantity ?? minicardOrderQuantity ?? 0}
                onChange={(e) => {
                  updateConfig({ info_minicards_quantity: parseInt(e.target.value) || 0 });
                }}
                disabled={isUpdating}
                className="w-16 text-sm px-2 py-1 rounded border border-gray-200 bg-white text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
            </div>

            {/* Start-Chancen-Schule */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={scsShirtsIncluded || false}
                disabled
                className="w-4 h-4 rounded border-gray-300 text-emerald-600"
              />
              <span className={`text-sm ${scsShirtsIncluded ? 'text-gray-800' : 'text-gray-400'}`}>Start-Chancen-Schule</span>
            </div>

            {/* Plus-Preise */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isPlus || false}
                disabled
                className="w-4 h-4 rounded border-gray-300 text-emerald-600"
              />
              <span className={`text-sm ${isPlus ? 'text-gray-800' : 'text-gray-400'}`}>Plus-Preise</span>
            </div>
          </div>
        </div>

        {/* ── Summary ─────────────────────────────────────────── */}
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <div className="space-y-1 text-sm">
            {PRESET_DEFS.map((def) => {
              const preset = localConfig.presets?.[def.key];
              if (!preset?.enabled) return null;
              return (
                <div key={def.key} className="flex justify-between text-gray-600">
                  <span>{def.label}</span>
                  <span>{formatCurrency(preset.amount)}</span>
                </div>
              );
            })}
            {(localConfig.additional_fees ?? []).map((fee, i) => (
              fee.title ? (
                <div key={`custom-${i}`} className="flex justify-between text-gray-600">
                  <span>{fee.title}</span>
                  <span>{formatCurrency(fee.amount)}</span>
                </div>
              ) : null
            ))}
            <div className="border-t border-gray-300 pt-1 mt-1 flex justify-between font-semibold text-gray-800">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* ── Save button ─────────────────────────────────────── */}
        <button
          type="button"
          onClick={handleSave}
          disabled={isUpdating || !isDirty}
          className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            isDirty && !isUpdating
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isUpdating ? 'Saving...' : 'Save Deal'}
        </button>
      </div>
    </div>
  );
}
