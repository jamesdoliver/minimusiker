'use client';

import { useState, useMemo } from 'react';
import { DealType, DealConfig, CustomFees } from '@/lib/types/airtable';
import { calculateDealFee, FeeBreakdown, MIMU_DEFAULTS, MIMU_SCS_DEFAULTS, isKleineEinrichtungOn, isGrosseEinrichtungOn } from '@/lib/utils/dealCalculator';

interface DealBuilderProps {
  eventId: string;
  enabled: boolean;
  dealType: DealType | null;
  dealConfig: DealConfig;
  estimatedChildren?: number;
  onToggleEnabled: (enabled: boolean) => void;
  onUpdate: (dealType: DealType | null, config: DealConfig) => void;
  isUpdating: boolean;
}

const DEAL_TYPES: { id: DealType; label: string; color: string; bgColor: string }[] = [
  { id: 'mimu', label: '#mimu', color: '#166534', bgColor: '#86efac' },
  { id: 'mimu_scs', label: '#mimuSCS', color: '#9a3412', bgColor: '#fed7aa' },
  { id: 'schus', label: '#schus', color: '#1e40af', bgColor: '#93c5fd' },
  { id: 'schus_xl', label: '#schusXL', color: '#6b21a8', bgColor: '#d8b4fe' },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

function FeeInput({
  feeKey,
  defaultValue,
  customFees,
  onChange,
  isNegative,
  disabled,
}: {
  feeKey: keyof CustomFees;
  defaultValue: number;
  customFees?: CustomFees;
  onChange: (key: keyof CustomFees, value: number | undefined) => void;
  isNegative?: boolean;
  disabled?: boolean;
}) {
  const customValue = customFees?.[feeKey];
  const hasOverride = customValue !== undefined;
  // For display: show absolute value (admin enters positive, stored as negative for discounts)
  const displayDefault = Math.abs(defaultValue);
  const displayValue = hasOverride ? Math.abs(customValue) : '';

  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-xs text-gray-400">{isNegative ? '-' : '+'}€</span>
      <input
        type="number"
        min="0"
        step="50"
        placeholder={displayDefault.toLocaleString('de-DE')}
        value={displayValue === 0 ? '0' : displayValue || ''}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            onChange(feeKey, undefined);
          } else {
            const num = parseFloat(raw);
            if (!isNaN(num)) {
              onChange(feeKey, isNegative ? -num : num);
            }
          }
        }}
        disabled={disabled}
        className={`w-20 text-xs px-1.5 py-0.5 rounded border text-right tabular-nums ${
          hasOverride
            ? 'border-blue-400 bg-blue-50 font-medium'
            : 'border-gray-200 bg-white'
        } focus:outline-none focus:ring-1 focus:ring-blue-400`}
      />
      {hasOverride && (
        <button
          type="button"
          onClick={() => onChange(feeKey, undefined)}
          className="text-gray-400 hover:text-gray-600 p-0.5"
          title="Reset to default"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      )}
    </span>
  );
}

function DealRow({
  label,
  enabled,
  onToggle,
  feeKey,
  defaultValue,
  customFees,
  onFeeChange,
  isNegative,
  disabled,
  isAuto,
  onResetAuto,
  toggleColor = 'green',
}: {
  label: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  feeKey: keyof CustomFees;
  defaultValue: number;
  customFees?: CustomFees;
  onFeeChange: (key: keyof CustomFees, value: number | undefined) => void;
  isNegative?: boolean;
  disabled?: boolean;
  isAuto?: boolean;
  onResetAuto?: () => void;
  toggleColor?: 'green' | 'orange';
}) {
  const colorClass = toggleColor === 'orange' ? 'peer-checked:bg-orange-500' : 'peer-checked:bg-green-500';
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
          <div className={`w-9 h-5 bg-gray-200 rounded-full peer ${colorClass} peer-disabled:opacity-50 transition-colors`} />
          <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform" />
        </div>
        <span className="text-sm text-gray-800 font-medium">{label}</span>
        {isAuto && (
          <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">auto</span>
        )}
        {!isAuto && onResetAuto && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onResetAuto(); }}
            className="text-[10px] text-gray-400 hover:text-amber-600 underline"
            title="Reset to auto"
          >
            reset auto
          </button>
        )}
      </label>
      <FeeInput
        feeKey={feeKey}
        defaultValue={defaultValue}
        customFees={customFees}
        onChange={onFeeChange}
        isNegative={isNegative}
        disabled={disabled}
      />
    </div>
  );
}

export default function DealBuilder({
  enabled,
  dealType,
  dealConfig,
  estimatedChildren,
  onToggleEnabled,
  onUpdate,
  isUpdating,
}: DealBuilderProps) {
  const [localType, setLocalType] = useState<DealType | null>(dealType);
  const [localConfig, setLocalConfig] = useState<DealConfig>(dealConfig);
  const [isDirty, setIsDirty] = useState(false);

  const feeBreakdown = useMemo<FeeBreakdown | null>(() => {
    if (!localType) return null;
    return calculateDealFee(localType, localConfig, estimatedChildren);
  }, [localType, localConfig, estimatedChildren]);

  function updateConfig(partial: Partial<DealConfig>) {
    setLocalConfig(prev => ({ ...prev, ...partial }));
    setIsDirty(true);
  }

  function handleFeeChange(key: keyof CustomFees, value: number | undefined) {
    setLocalConfig(prev => {
      const cf = { ...prev.custom_fees };
      if (value !== undefined) {
        cf[key] = value;
      } else {
        delete cf[key];
      }
      const hasKeys = Object.keys(cf).length > 0;
      return { ...prev, custom_fees: hasKeys ? cf : undefined };
    });
    setIsDirty(true);
  }

  function handleTypeChange(type: DealType) {
    setLocalType(type);
    // Reset config for the new type with sensible defaults
    if (type === 'mimu') {
      setLocalConfig({
        pauschale_enabled: true,
        music_pricing_enabled: false,
        distance_surcharge: false,
        // kleine_einrichtung_enabled: undefined → auto from estimatedChildren
      });
    } else if (type === 'mimu_scs') {
      setLocalConfig({
        scs_pauschale_enabled: true,
        scs_song_option: 'schusXL',
        scs_shirts_included: true,
        scs_audio_pricing: 'standard',
        // grosse_einrichtung_enabled: undefined → auto from estimatedChildren
      });
    } else {
      setLocalConfig({});
    }
    setIsDirty(true);
  }

  function handleSave() {
    const configWithFee: DealConfig = {
      ...localConfig,
      calculated_fee: feeBreakdown?.total,
      fee_breakdown: feeBreakdown || undefined,
    };
    onUpdate(localType, configWithFee);
    setIsDirty(false);
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      {/* Header with master toggle */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">Deal Builder</span>
          {enabled && localType && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: DEAL_TYPES.find(d => d.id === localType)?.bgColor,
                color: DEAL_TYPES.find(d => d.id === localType)?.color,
              }}
            >
              {DEAL_TYPES.find(d => d.id === localType)?.label}
            </span>
          )}
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onToggleEnabled(e.target.checked)}
              disabled={isUpdating}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-emerald-500 peer-disabled:opacity-50 transition-colors" />
            <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform" />
          </div>
        </label>
      </div>

      {/* Collapsed state */}
      {!enabled && (
        <div className="px-4 py-3 text-sm text-gray-500">
          Enable Deal Builder to use the new pricing structure for this event.
        </div>
      )}

      {/* Expanded state */}
      {enabled && (
        <div className="px-4 py-3 space-y-4">
          {/* Deal Type Selector */}
          <div
            className="inline-flex rounded-lg p-0.5"
            style={{ backgroundColor: '#e5e7eb' }}
          >
            {DEAL_TYPES.map((dt) => (
              <button
                key={dt.id}
                type="button"
                onClick={() => handleTypeChange(dt.id)}
                disabled={isUpdating}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                style={localType === dt.id ? {
                  backgroundColor: dt.bgColor,
                  color: dt.color,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                } : {
                  backgroundColor: 'transparent',
                  color: '#6b7280',
                }}
              >
                {dt.label}
              </button>
            ))}
          </div>

          {/* #mimu options */}
          {localType === 'mimu' && (
            <div className="bg-green-50 rounded-lg p-3 space-y-3">
              <DealRow
                label="Pauschale"
                enabled={localConfig.pauschale_enabled !== false}
                onToggle={(v) => updateConfig({ pauschale_enabled: v })}
                feeKey="base"
                defaultValue={MIMU_DEFAULTS.base}
                customFees={localConfig.custom_fees}
                onFeeChange={handleFeeChange}
                disabled={isUpdating}
              />
              <DealRow
                label="Plus-Preise für Musik"
                enabled={localConfig.music_pricing_enabled || false}
                onToggle={(v) => updateConfig({ music_pricing_enabled: v })}
                feeKey="music_pricing"
                defaultValue={MIMU_DEFAULTS.music_pricing}
                customFees={localConfig.custom_fees}
                onFeeChange={handleFeeChange}
                disabled={isUpdating}
              />
              <DealRow
                label="Entfernungspauschale"
                enabled={localConfig.distance_surcharge || false}
                onToggle={(v) => updateConfig({ distance_surcharge: v })}
                feeKey="distance_surcharge"
                defaultValue={MIMU_DEFAULTS.distance_surcharge}
                customFees={localConfig.custom_fees}
                onFeeChange={handleFeeChange}
                disabled={isUpdating}
              />
              <DealRow
                label="kleine Einrichtung"
                enabled={isKleineEinrichtungOn(localConfig, estimatedChildren)}
                onToggle={(v) => updateConfig({ kleine_einrichtung_enabled: v })}
                feeKey="under_100_kids"
                defaultValue={MIMU_DEFAULTS.under_100_kids}
                customFees={localConfig.custom_fees}
                onFeeChange={handleFeeChange}
                disabled={isUpdating}
                isAuto={localConfig.kleine_einrichtung_enabled === undefined}
                onResetAuto={() => updateConfig({ kleine_einrichtung_enabled: undefined })}
              />
            </div>
          )}

          {/* #mimuSCS options */}
          {localType === 'mimu_scs' && (
            <div className="bg-orange-50 rounded-lg p-3 space-y-3">
              <DealRow
                label="Pauschale"
                enabled={localConfig.scs_pauschale_enabled !== false}
                onToggle={(v) => updateConfig({ scs_pauschale_enabled: v })}
                feeKey="base"
                defaultValue={MIMU_SCS_DEFAULTS.base}
                customFees={localConfig.custom_fees}
                onFeeChange={handleFeeChange}
                disabled={isUpdating}
                toggleColor="orange"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Schulsong</label>
                <select
                  value={localConfig.scs_song_option || 'schusXL'}
                  onChange={(e) => updateConfig({ scs_song_option: e.target.value as DealConfig['scs_song_option'] })}
                  disabled={isUpdating}
                  className="block w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-orange-500 focus:ring-orange-500"
                >
                  <option value="schusXL">#schusXL &mdash; Individual Song</option>
                  <option value="schus">#schus &mdash; Standard Song</option>
                  <option value="none">No Song</option>
                </select>
                {localConfig.scs_song_option === 'schus' && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                    <span>Discount:</span>
                    <FeeInput
                      feeKey="standard_song_discount"
                      defaultValue={MIMU_SCS_DEFAULTS.standard_song_discount}
                      customFees={localConfig.custom_fees}
                      onChange={handleFeeChange}
                      isNegative
                      disabled={isUpdating}
                    />
                  </div>
                )}
                {localConfig.scs_song_option === 'none' && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                    <span>Discount:</span>
                    <FeeInput
                      feeKey="no_song_discount"
                      defaultValue={MIMU_SCS_DEFAULTS.no_song_discount}
                      customFees={localConfig.custom_fees}
                      onChange={handleFeeChange}
                      isNegative
                      disabled={isUpdating}
                    />
                  </div>
                )}
              </div>

              <DealRow
                label="T-Shirts inklusive"
                enabled={localConfig.scs_shirts_included !== false}
                onToggle={(v) => updateConfig({ scs_shirts_included: v })}
                feeKey="no_shirts_discount"
                defaultValue={MIMU_SCS_DEFAULTS.no_shirts_discount}
                customFees={localConfig.custom_fees}
                onFeeChange={handleFeeChange}
                isNegative
                disabled={isUpdating}
                toggleColor="orange"
              />

              <DealRow
                label="Grosse Einrichtung"
                enabled={isGrosseEinrichtungOn(localConfig, estimatedChildren)}
                onToggle={(v) => updateConfig({ grosse_einrichtung_enabled: v })}
                feeKey="over_250_kids"
                defaultValue={MIMU_SCS_DEFAULTS.over_250_kids}
                customFees={localConfig.custom_fees}
                onFeeChange={handleFeeChange}
                disabled={isUpdating}
                isAuto={localConfig.grosse_einrichtung_enabled === undefined}
                onResetAuto={() => updateConfig({ grosse_einrichtung_enabled: undefined })}
                toggleColor="orange"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Audio Pricing</label>
                <select
                  value={localConfig.scs_audio_pricing || 'standard'}
                  onChange={(e) => updateConfig({ scs_audio_pricing: e.target.value as 'standard' | 'plus' })}
                  disabled={isUpdating}
                  className="block w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-orange-500 focus:ring-orange-500"
                >
                  <option value="standard">Standard prices</option>
                  <option value="plus">PLUS prices (cheaper for parents)</option>
                </select>
              </div>
            </div>
          )}

          {/* #schus / #schusXL info */}
          {(localType === 'schus' || localType === 'schus_xl') && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                {localType === 'schus'
                  ? 'Schulsong only (standard) — clothing shop only, no audio products, no fee tracking.'
                  : 'Schulsong XL (individual song) — clothing shop only, no audio products, no fee tracking.'}
              </p>
            </div>
          )}

          {/* Fee Summary */}
          {feeBreakdown && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Fee Summary</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Base fee</span>
                  <span>{formatCurrency(feeBreakdown.base)}</span>
                </div>
                {feeBreakdown.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-gray-600">
                    <span>{item.amount >= 0 ? '+' : ''} {item.label}</span>
                    <span className={item.amount < 0 ? 'text-green-600' : ''}>{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-300 pt-1 mt-1 flex justify-between font-semibold text-gray-800">
                  <span>Total</span>
                  <div className="text-right">
                    <span>{formatCurrency(feeBreakdown.total)}</span>
                    <span className="text-xs text-gray-500 font-normal ml-1">
                      ({formatCurrency(feeBreakdown.total / 1.19)} net)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save button */}
          {localType && (
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
          )}
        </div>
      )}
    </div>
  );
}
