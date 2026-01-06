/**
 * Auto-Matching Utility for Batch Audio Uploads
 * Uses fuzzy string matching to automatically assign uploaded files to songs
 */

import Fuse from 'fuse.js';
import { Song } from '@/lib/types/teacher';

/**
 * Confidence level for auto-matching
 */
export type MatchConfidence = 'high' | 'medium' | 'low' | 'none';

/**
 * Result of matching a file to a song
 */
export interface AutoMatchResult {
  filename: string; // Original filename
  songId: string | null; // Matched song ID (null if no match)
  songTitle: string | null; // Matched song title (null if no match)
  confidence: MatchConfidence; // Confidence level
  score: number; // Raw matching score (0-1, lower is better for Fuse.js)
  alternatives?: AutoMatchResult[]; // Alternative matches for manual correction
}

/**
 * Configuration for auto-matching
 */
export interface AutoMatchConfig {
  highConfidenceThreshold: number; // Score threshold for high confidence (default: 0.2)
  mediumConfidenceThreshold: number; // Score threshold for medium confidence (default: 0.4)
  maxAlternatives: number; // Max number of alternative matches to return (default: 3)
}

const DEFAULT_CONFIG: AutoMatchConfig = {
  highConfidenceThreshold: 0.2, // Fuse.js score <= 0.2 = high confidence (80-100%)
  mediumConfidenceThreshold: 0.4, // Fuse.js score <= 0.4 = medium confidence (60-79%)
  maxAlternatives: 3,
};

/**
 * Clean filename for matching
 * Removes extension, replaces underscores/hyphens with spaces, converts to lowercase
 */
function cleanFilename(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, '') // Remove extension
    .replace(/[_-]/g, ' ') // Replace underscores and hyphens with spaces
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .trim()
    .toLowerCase();
}

/**
 * Convert Fuse.js score to confidence level
 */
function scoreToConfidence(score: number, config: AutoMatchConfig): MatchConfidence {
  if (score <= config.highConfidenceThreshold) {
    return 'high';
  } else if (score <= config.mediumConfidenceThreshold) {
    return 'medium';
  } else if (score <= 0.6) {
    return 'low';
  } else {
    return 'none';
  }
}

/**
 * Auto-match a single file to songs using fuzzy string matching
 */
export function autoMatchFile(
  filename: string,
  songs: Song[],
  config: AutoMatchConfig = DEFAULT_CONFIG
): AutoMatchResult {
  if (songs.length === 0) {
    return {
      filename,
      songId: null,
      songTitle: null,
      confidence: 'none',
      score: 1,
      alternatives: [],
    };
  }

  const cleanedFilename = cleanFilename(filename);

  // Configure Fuse.js for fuzzy string matching
  const fuse = new Fuse(songs, {
    keys: [
      { name: 'title', weight: 0.7 }, // Song title is most important
      { name: 'artist', weight: 0.3 }, // Artist is secondary
    ],
    includeScore: true,
    threshold: 0.6, // Max score to consider as a match
    ignoreLocation: true, // Don't penalize matches based on position
    minMatchCharLength: 2,
  });

  // Search for matches
  const results = fuse.search(cleanedFilename);

  if (results.length === 0) {
    return {
      filename,
      songId: null,
      songTitle: null,
      confidence: 'none',
      score: 1,
      alternatives: [],
    };
  }

  // Get the best match
  const bestMatch = results[0];
  const bestScore = bestMatch.score ?? 1;
  const bestConfidence = scoreToConfidence(bestScore, config);

  // Get alternative matches (excluding the best match)
  const alternatives = results
    .slice(1, config.maxAlternatives + 1)
    .map((result) => ({
      filename,
      songId: result.item.id,
      songTitle: result.item.title,
      confidence: scoreToConfidence(result.score ?? 1, config),
      score: result.score ?? 1,
    }));

  return {
    filename,
    songId: bestMatch.item.id,
    songTitle: bestMatch.item.title,
    confidence: bestConfidence,
    score: bestScore,
    alternatives,
  };
}

/**
 * Auto-match multiple files to songs
 * Returns an array of match results, one per file
 */
export function autoMatchFiles(
  filenames: string[],
  songs: Song[],
  config: AutoMatchConfig = DEFAULT_CONFIG
): AutoMatchResult[] {
  return filenames.map((filename) => autoMatchFile(filename, songs, config));
}

/**
 * Validate that all files are matched before confirming batch upload
 * Returns true if all files have at least a low confidence match
 */
export function validateMatches(matches: AutoMatchResult[]): {
  isValid: boolean;
  unmatchedFiles: string[];
  lowConfidenceFiles: string[];
} {
  const unmatchedFiles: string[] = [];
  const lowConfidenceFiles: string[] = [];

  for (const match of matches) {
    if (match.confidence === 'none' || !match.songId) {
      unmatchedFiles.push(match.filename);
    } else if (match.confidence === 'low') {
      lowConfidenceFiles.push(match.filename);
    }
  }

  return {
    isValid: unmatchedFiles.length === 0,
    unmatchedFiles,
    lowConfidenceFiles,
  };
}

/**
 * Get summary statistics for auto-matching results
 */
export function getMatchSummary(matches: AutoMatchResult[]): {
  total: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  unmatched: number;
} {
  return {
    total: matches.length,
    highConfidence: matches.filter((m) => m.confidence === 'high').length,
    mediumConfidence: matches.filter((m) => m.confidence === 'medium').length,
    lowConfidence: matches.filter((m) => m.confidence === 'low').length,
    unmatched: matches.filter((m) => m.confidence === 'none').length,
  };
}
