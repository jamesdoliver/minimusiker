'use client';

import { TextLines } from '@/lib/config/printableTextConfig';

interface TextInputPanelProps {
  textLines: TextLines;
  onChange: (textLines: TextLines) => void;
  itemName: string;
}

export default function TextInputPanel({ textLines, onChange, itemName }: TextInputPanelProps) {
  const handleLineChange = (line: keyof TextLines, value: string) => {
    onChange({
      ...textLines,
      [line]: value,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Text for {itemName}</h3>
        <p className="text-sm text-gray-500">
          Edit how the school name appears on this item. Leave lines empty if not needed.
        </p>
      </div>

      <div className="space-y-4">
        {/* Line 1 */}
        <div>
          <label htmlFor="line1" className="block text-sm font-medium text-gray-700 mb-1">
            Line 1
          </label>
          <input
            id="line1"
            type="text"
            value={textLines.line1}
            onChange={(e) => handleLineChange('line1', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F4A261] focus:border-[#F4A261] transition-colors"
            placeholder="First line of text"
          />
          <p className="mt-1 text-xs text-gray-400">{textLines.line1.length} characters</p>
        </div>

        {/* Line 2 */}
        <div>
          <label htmlFor="line2" className="block text-sm font-medium text-gray-700 mb-1">
            Line 2
          </label>
          <input
            id="line2"
            type="text"
            value={textLines.line2}
            onChange={(e) => handleLineChange('line2', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F4A261] focus:border-[#F4A261] transition-colors"
            placeholder="Second line of text (optional)"
          />
          <p className="mt-1 text-xs text-gray-400">{textLines.line2.length} characters</p>
        </div>

        {/* Line 3 */}
        <div>
          <label htmlFor="line3" className="block text-sm font-medium text-gray-700 mb-1">
            Line 3
          </label>
          <input
            id="line3"
            type="text"
            value={textLines.line3}
            onChange={(e) => handleLineChange('line3', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F4A261] focus:border-[#F4A261] transition-colors"
            placeholder="Third line of text (optional)"
          />
          <p className="mt-1 text-xs text-gray-400">{textLines.line3.length} characters</p>
        </div>
      </div>

      {/* Tips section */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <h4 className="text-sm font-medium text-blue-800 mb-2">Tips</h4>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• Keep lines balanced for the best visual appearance</li>
          <li>• Split at natural break points (e.g., after &quot;Grundschule&quot;)</li>
          <li>• Preview updates automatically as you type</li>
        </ul>
      </div>
    </div>
  );
}
