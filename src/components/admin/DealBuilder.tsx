'use client';

import { useState, useMemo } from 'react';
import { DealConfig, DealConfigPreset } from '@/lib/types/airtable';

// ─── Props ───────────────────────────────────────────────────────────
interface DealBuilderProps {
  dealConfig: DealConfig;
  onSave: (config: DealConfig) => void;
  isUpdating?: boolean;
}

// ─── Preset definitions ──────────────────────────────────────────────
type PresetKey = keyof NonNullable<DealConfig['presets']>;

interface PresetDef {
  key: PresetKey;
  label: string;
  defaultAmount: number;
  isNegative?: boolean;
}

const PRESET_DEFS: PresetDef[] = [
  { key: 'pauschale',          label: 'Pauschale',              defaultAmount: 0 },
  { key: 'scs_pauschale',     label: 'SCS Pauschale',          defaultAmount: 9500 },
  { key: 'distance_surcharge', label: 'Entfernungspauschale',   defaultAmount: 500 },
  { key: 'kleine_einrichtung', label: 'Kleine Einrichtung',     defaultAmount: -500,  isNegative: true },
  { key: 'grosse_einrichtung', label: 'Grosse Einrichtung',     defaultAmount: 2000 },
  { key: 'schulsong_discount', label: 'Schulsong Discount',     defaultAmount: -500,  isNegative: true },
  { key: 'shirts_discount',    label: 'Shirts Discount',        defaultAmount: -3000, isNegative: true },
];

// ─── Helpers ─────────────────────────────────────────────────────────
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

/**
 * Migrate old flat-field DealConfig into the new presets structure.
 * Only runs when `presets` is missing and old-format keys exist.
 */
function migrateToPresets(cfg: DealConfig): DealConfig['presets'] {
  const presets: NonNullable<DealConfig['presets']> = {};

  // Old #mimu fields
  if (cfg.pauschale_enabled !== undefined) {
    presets.pauschale = {
      enabled: cfg.pauschale_enabled !== false,
      amount: cfg.custom_fees?.base ?? 0,
    };
  }
  if (cfg.scs_pauschale_enabled !== undefined) {
    presets.scs_pauschale = {
      enabled: cfg.scs_pauschale_enabled !== false,
      amount: cfg.custom_fees?.base ?? 9500,
    };
  }
  if (cfg.distance_surcharge !== undefined) {
    presets.distance_surcharge = {
      enabled: !!cfg.distance_surcharge,
      amount: cfg.custom_fees?.distance_surcharge ?? 500,
    };
  }
  if (cfg.kleine_einrichtung_enabled !== undefined) {
    presets.kleine_einrichtung = {
      enabled: !!cfg.kleine_einrichtung_enabled,
      amount: cfg.custom_fees?.under_100_kids ?? -500,
    };
  }
  if (cfg.grosse_einrichtung_enabled !== undefined) {
    presets.grosse_einrichtung = {
      enabled: !!cfg.grosse_einrichtung_enabled,
      amount: cfg.custom_fees?.over_250_kids ?? 2000,
    };
  }
  if (cfg.scs_shirts_included === false) {
    presets.shirts_discount = {
      enabled: true,
      amount: cfg.custom_fees?.no_shirts_discount ?? -3000,
    };
  }

  return Object.keys(presets).length > 0 ? presets : undefined;
}

// ─── Sub-components ──────────────────────────────────────────────────

function PresetRow({
  label,
  preset,
  defaultAmount,
  onChange,
  isNegative,
  disabled,
}: {
  label: string;
  preset?: DealConfigPreset;
  defaultAmount: number;
  onChange: (preset: DealConfigPreset) => void;
  isNegative?: boolean;
  disabled?: boolean;
}) {
  const enabled = preset?.enabled ?? false;
  const amount = preset?.amount ?? defaultAmount;

  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
        <div className="relative flex-shrink-0">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onChange({ enabled: e.target.checked, amount })}
            disabled={disabled}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-emerald-500 peer-disabled:opacity-50 transition-colors" />
          <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform" />
        </div>
        <span className="text-sm text-gray-800 font-medium">{label}</span>
      </label>
      <span className="inline-flex items-center gap-1">
        <span className="text-xs text-gray-400">{isNegative ? '-' : '+'}€</span>
        <input
          type="number"
          min="0"
          step="50"
          value={Math.abs(amount)}
          onChange={(e) => {
            const raw = parseFloat(e.target.value);
            if (!isNaN(raw)) {
              onChange({ enabled, amount: isNegative ? -raw : raw });
            }
          }}
          disabled={disabled || !enabled}
          className={`w-24 text-xs px-1.5 py-0.5 rounded border text-right tabular-nums ${
            enabled ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-400'
          } focus:outline-none focus:ring-1 focus:ring-emerald-400`}
        />
        {amount !== defaultAmount && enabled && (
          <button
            type="button"
            onClick={() => onChange({ enabled, amount: defaultAmount })}
            className="text-gray-400 hover:text-gray-600 p-0.5"
            title="Reset to default"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </span>
    </div>
  );
}

function GratisItemRow({
  label,
  enabled,
  onToggle,
  quantity,
  onQuantityChange,
  disabled,
}: {
  label: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
        <div className="relative flex-shrink-0">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            disabled={disabled}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-emerald-500 peer-disabled:opacity-50 transition-colors" />
          <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform" />
        </div>
        <span className="text-sm text-gray-800 font-medium">{label}</span>
      </label>
      <span className="inline-flex items-center gap-1">
        <span className="text-xs text-gray-400">Anz:</span>
        <input
          type="number"
          min="0"
          value={quantity || ''}
          placeholder="0"
          onChange={(e) => {
            const v = parseInt(e.target.value);
            onQuantityChange(isNaN(v) ? 0 : v);
          }}
          disabled={disabled || !enabled}
          className={`w-16 text-xs px-1.5 py-0.5 rounded border text-right tabular-nums ${
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
    <div className="border border-gray-200 rounded-lg p-3 space-y-2">
      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Custom Fees</h4>
      {fees.map((f, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={f.title}
            placeholder="Fee title"
            onChange={(e) => updateFee(i, 'title', e.target.value)}
            disabled={disabled}
            className="flex-1 text-sm px-2 py-1 rounded border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="inline-flex items-center gap-1">
            <span className="text-xs text-gray-400">+€</span>
            <input
              type="number"
              step="50"
              value={f.amount === 0 ? '0' : f.amount || ''}
              onChange={(e) => {
                const raw = e.target.value;
                updateFee(i, 'amount', raw === '' ? 0 : parseFloat(raw) || 0);
              }}
              disabled={disabled}
              className="w-20 text-xs px-1.5 py-0.5 rounded border border-gray-200 bg-white text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </span>
          <button
            type="button"
            onClick={() => removeFee(i)}
            disabled={disabled}
            className="text-gray-400 hover:text-red-500 p-0.5"
            title="Remove fee"
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
        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        + Add Custom Fee
      </button>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────

export default function DealBuilder({
  dealConfig,
  onSave,
  isUpdating,
}: DealBuilderProps) {
  // Initialise local config, migrating old format if necessary
  const [localConfig, setLocalConfig] = useState<DealConfig>(() => {
    if (dealConfig.presets) return dealConfig;
    const migrated = migrateToPresets(dealConfig);
    return migrated ? { ...dealConfig, presets: migrated } : dealConfig;
  });
  const [isDirty, setIsDirty] = useState(false);

  // ── Derived total ────────────────────────────────────────────────
  const total = useMemo(() => {
    let sum = 0;
    if (localConfig.presets) {
      for (const preset of Object.values(localConfig.presets)) {
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
    // Build fee_breakdown from enabled presets + custom fees
    const breakdownItems: { label: string; amount: number }[] = [];

    for (const [key, preset] of Object.entries(localConfig.presets || {})) {
      if (preset?.enabled) {
        const def = PRESET_DEFS.find(d => d.key === key);
        breakdownItems.push({ label: def?.label || key, amount: preset.amount });
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
      fee_breakdown: {
        base: 0,
        items: breakdownItems,
        total,
      },
    };
    onSave(configToSave);
    setIsDirty(false);
  }

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="pb-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-800">Deal Builder</span>
      </div>

      <div className="pt-3 space-y-4">
        {/* ── Presets ─────────────────────────────────────────── */}
        <div className="space-y-3">
          {PRESET_DEFS.map((def) => (
            <PresetRow
              key={def.key}
              label={def.label}
              preset={localConfig.presets?.[def.key]}
              defaultAmount={def.defaultAmount}
              isNegative={def.isNegative}
              onChange={(p) => updatePreset(def.key, p)}
              disabled={isUpdating}
            />
          ))}
        </div>

        {/* ── Gratis Items ────────────────────────────────────── */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-3">
          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Gratis Items</h4>
          <GratisItemRow
            label="Gratis T-Shirts"
            enabled={localConfig.gratis_tshirts_enabled || false}
            onToggle={(v) => updateConfig({ gratis_tshirts_enabled: v })}
            quantity={localConfig.gratis_tshirts_quantity ?? 0}
            onQuantityChange={(qty) => updateConfig({ gratis_tshirts_quantity: qty })}
            disabled={isUpdating}
          />
          <GratisItemRow
            label="Gratis Minicards"
            enabled={localConfig.gratis_minicards_enabled || false}
            onToggle={(v) => updateConfig({ gratis_minicards_enabled: v })}
            quantity={localConfig.gratis_minicards_quantity ?? 0}
            onQuantityChange={(qty) => updateConfig({ gratis_minicards_quantity: qty })}
            disabled={isUpdating}
          />
        </div>

        {/* ── Custom Fees ─────────────────────────────────────── */}
        <CustomFeesSection
          fees={localConfig.additional_fees ?? []}
          onChange={(fees) => updateConfig({ additional_fees: fees.length > 0 ? fees : undefined })}
          disabled={isUpdating}
        />

        {/* ── Summary ─────────────────────────────────────────── */}
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Summary</h4>
          <div className="space-y-1 text-sm">
            {localConfig.presets && Object.entries(localConfig.presets).map(([key, preset]) => {
              if (!preset?.enabled) return null;
              const def = PRESET_DEFS.find(d => d.key === key);
              return (
                <div key={key} className="flex justify-between text-gray-600">
                  <span>{def?.label ?? key}</span>
                  <span className={preset.amount < 0 ? 'text-green-600' : ''}>{formatCurrency(preset.amount)}</span>
                </div>
              );
            })}
            {(localConfig.additional_fees ?? []).map((fee, i) => (
              <div key={`custom-${i}`} className="flex justify-between text-gray-600">
                <span>{fee.title || 'Custom Fee'}</span>
                <span className={fee.amount < 0 ? 'text-green-600' : ''}>{formatCurrency(fee.amount)}</span>
              </div>
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
