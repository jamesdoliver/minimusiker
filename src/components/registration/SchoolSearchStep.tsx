'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';

interface SchoolSearchStepProps {
  onSchoolSelect: (schoolName: string) => void;
  onBack?: () => void;
}

interface SchoolResult {
  schoolName: string;
  eventCount: number;
}

export default function SchoolSearchStep({
  onSchoolSelect,
  onBack,
}: SchoolSearchStepProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SchoolResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const debouncedQuery = useDebounce(searchQuery, 300);

  const searchSchools = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/airtable/search-schools?q=${encodeURIComponent(query)}`
      );
      const data = await response.json();

      if (data.success) {
        setResults(data.data);
        setHasSearched(true);
      } else {
        setError(data.error || 'Failed to search schools');
      }
    } catch (err) {
      console.error('Error searching schools:', err);
      setError('Failed to search schools. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    searchSchools(debouncedQuery);
  }, [debouncedQuery, searchSchools]);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Find Your School
        </h2>
        <p className="text-gray-600">
          Enter your school name to find upcoming events
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="school-search"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            School Name
          </label>
          <div className="relative">
            <input
              id="school-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Start typing your school name..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500"
              autoComplete="off"
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-sage-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Search Results */}
        {results.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              {results.length} school{results.length !== 1 ? 's' : ''} found
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {results.map((school) => (
                <button
                  key={school.schoolName}
                  onClick={() => onSchoolSelect(school.schoolName)}
                  className="w-full p-4 text-left bg-white border border-gray-200 rounded-lg hover:border-sage-500 hover:bg-sage-50 transition-colors"
                >
                  <div className="font-medium text-gray-900">
                    {school.schoolName}
                  </div>
                  <div className="text-sm text-gray-500">
                    {school.eventCount} upcoming event
                    {school.eventCount !== 1 ? 's' : ''}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {hasSearched && results.length === 0 && searchQuery.length >= 2 && (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
            <p className="text-gray-600">
              No schools found with upcoming events matching "{searchQuery}"
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Please check the spelling or contact your school for the
              registration link.
            </p>
          </div>
        )}

        {/* Help Text */}
        {searchQuery.length < 2 && (
          <p className="text-sm text-gray-500 text-center">
            Type at least 2 characters to search
          </p>
        )}
      </div>

      {onBack && (
        <div className="mt-6">
          <button
            onClick={onBack}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            &larr; Back
          </button>
        </div>
      )}
    </div>
  );
}
