/**
 * Smart text splitting utility for school names on printables
 * Handles German school names that may be too long for a single line
 */

import { TextLines } from '@/lib/config/printableTextConfig';

export interface SplitOptions {
  maxCharsPerLine?: number;
  preferredSplitPoints?: string[]; // Words/phrases to prefer splitting at
}

const DEFAULT_MAX_CHARS = 25;

// Common German school name components that are good split points
const GERMAN_SPLIT_POINTS = [
  'Grundschule',
  'Schule',
  'Gymnasium',
  'Realschule',
  'Hauptschule',
  'Gesamtschule',
  'Förderschule',
  'Oberschule',
  'Mittelschule',
  'Gemeinschaftsschule',
  'Stadtteilschule',
  'am',
  'an der',
  'in',
  'zu',
  'der',
  'die',
  'das',
];

/**
 * Intelligently splits a school name across up to 3 lines
 *
 * Algorithm:
 * 1. If the name fits on one line, return it in line1
 * 2. Try to split at natural break points (common German school terms)
 * 3. Fall back to splitting at word boundaries
 * 4. Balance line lengths for visual appeal
 */
export function smartSplitSchoolName(
  schoolName: string,
  options: SplitOptions = {}
): TextLines {
  const maxChars = options.maxCharsPerLine || DEFAULT_MAX_CHARS;
  const trimmedName = schoolName.trim();

  // If it fits on one line, use only line1
  if (trimmedName.length <= maxChars) {
    return { line1: trimmedName, line2: '', line3: '' };
  }

  const words = trimmedName.split(/\s+/);

  // Try to find a good split point
  const splitResult = findBestSplit(words, maxChars);

  return splitResult;
}

/**
 * Find the best way to split words across lines
 */
function findBestSplit(words: string[], maxChars: number): TextLines {
  const totalLength = words.join(' ').length;

  // If we can fit in 2 lines, try that first
  if (totalLength <= maxChars * 2 + 5) {
    // +5 for some flexibility
    const twoLineSplit = splitIntoNLines(words, 2, maxChars);
    if (isValidSplit(twoLineSplit, maxChars)) {
      return { line1: twoLineSplit[0], line2: twoLineSplit[1], line3: '' };
    }
  }

  // Otherwise use 3 lines
  const threeLineSplit = splitIntoNLines(words, 3, maxChars);
  return {
    line1: threeLineSplit[0] || '',
    line2: threeLineSplit[1] || '',
    line3: threeLineSplit[2] || '',
  };
}

/**
 * Split words into n lines, trying to balance lengths
 */
function splitIntoNLines(words: string[], numLines: number, maxChars: number): string[] {
  if (words.length === 0) return Array(numLines).fill('');
  if (words.length === 1) return [words[0], ...Array(numLines - 1).fill('')];

  const totalLength = words.join(' ').length;
  const targetPerLine = Math.ceil(totalLength / numLines);

  const lines: string[] = [];
  let currentLine: string[] = [];
  let currentLength = 0;

  for (const word of words) {
    const wordWithSpace = currentLine.length > 0 ? ' ' + word : word;
    const newLength = currentLength + wordWithSpace.length;

    // Check if we should start a new line
    const shouldStartNewLine =
      lines.length < numLines - 1 && // Not on the last line
      currentLine.length > 0 && // Current line has content
      (newLength > maxChars || // Would exceed max
        (newLength > targetPerLine && isGoodBreakPoint(word))); // Past target and good break

    if (shouldStartNewLine) {
      lines.push(currentLine.join(' '));
      currentLine = [word];
      currentLength = word.length;
    } else {
      currentLine.push(word);
      currentLength = currentLine.join(' ').length;
    }
  }

  // Don't forget the last line
  if (currentLine.length > 0) {
    lines.push(currentLine.join(' '));
  }

  // Pad with empty strings if needed
  while (lines.length < numLines) {
    lines.push('');
  }

  return lines;
}

/**
 * Check if a word is a good point to break before
 */
function isGoodBreakPoint(word: string): boolean {
  const lowerWord = word.toLowerCase();

  // Check against known split points
  for (const splitPoint of GERMAN_SPLIT_POINTS) {
    if (lowerWord === splitPoint.toLowerCase()) {
      return true;
    }
  }

  // Small connecting words are good break points
  if (word.length <= 3) {
    return true;
  }

  return false;
}

/**
 * Validate that a split doesn't exceed max chars per line
 */
function isValidSplit(lines: string[], maxChars: number): boolean {
  // Allow some overflow (10%) for flexibility
  const maxWithOverflow = Math.ceil(maxChars * 1.1);
  return lines.every((line) => line.length <= maxWithOverflow);
}

/**
 * Initialize text lines for all printable items from a school name
 * Returns a record with the same split for all items (can be customized per-item later)
 */
export function initializeTextLinesFromSchoolName(
  schoolName: string,
  options: SplitOptions = {}
): TextLines {
  return smartSplitSchoolName(schoolName, options);
}

/**
 * Calculate approximate text width (for preview purposes)
 * This is a rough estimate - actual rendering may vary
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  // Average character width is roughly 0.5-0.6 of font size for most fonts
  const avgCharWidth = fontSize * 0.55;
  return text.length * avgCharWidth;
}
