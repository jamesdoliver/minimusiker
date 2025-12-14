'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface Event {
  booking_id: string;
  class_id?: string;
  school_name: string;
  booking_date?: string;
  event_type: string;
  teacher_name: string;
  main_teacher?: string;
  class: string;
  parent_count: number;
}

interface UploadResult {
  key: string;
  eventId: string;
  type: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  uploadedAt: string;
}

export default function AdminUpload() {
  // Event selection state
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<'preview' | 'full'>('preview');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Fetch events on mount
  useEffect(() => {
    fetchEvents();
  }, []);

  // Filter events when search/filters change
  useEffect(() => {
    filterEvents();
  }, [events, searchQuery, selectedDate, selectedSchool, selectedClass]);

  const fetchEvents = async () => {
    setIsLoadingEvents(true);
    setEventError(null);
    try {
      const response = await fetch('/api/airtable/get-events?view=class');
      const data = await response.json();

      if (data.success) {
        setEvents(data.data);
      } else {
        setEventError(data.error || 'Failed to load events');
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      setEventError('Failed to connect to server');
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const filterEvents = () => {
    let filtered = [...events];

    // Filter by search query (booking_id or school_name)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.booking_id.toLowerCase().includes(query) ||
          e.school_name.toLowerCase().includes(query) ||
          e.teacher_name.toLowerCase().includes(query)
      );
    }

    // Filter by date
    if (selectedDate) {
      filtered = filtered.filter((e) => e.booking_date === selectedDate);
    }

    // Filter by school
    if (selectedSchool) {
      filtered = filtered.filter((e) => e.school_name === selectedSchool);
    }

    // Filter by class
    if (selectedClass) {
      filtered = filtered.filter((e) => e.class === selectedClass);
    }

    setFilteredEvents(filtered);
  };

  // Get unique schools for dropdown
  const uniqueSchools = Array.from(new Set(events.map((e) => e.school_name))).sort();

  // Get unique dates for filter
  const uniqueDates = Array.from(new Set(events.map((e) => e.booking_date).filter(Boolean))).sort(
    (a, b) => new Date(b!).getTime() - new Date(a!).getTime()
  );

  // Get unique classes for filter (from filtered events based on date/school)
  const getUniqueClasses = () => {
    let classEvents = [...events];

    // Apply date filter
    if (selectedDate) {
      classEvents = classEvents.filter((e) => e.booking_date === selectedDate);
    }

    // Apply school filter
    if (selectedSchool) {
      classEvents = classEvents.filter((e) => e.school_name === selectedSchool);
    }

    return Array.from(new Set(classEvents.map((e) => e.class).filter(Boolean))).sort();
  };

  const uniqueClasses = getUniqueClasses();

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'No date';
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleFileSelect = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('audio/')) {
      setErrorMessage('Please select an audio file (MP3, WAV, etc.)');
      return;
    }

    // Validate file size (max 500MB)
    if (file.size > 500 * 1024 * 1024) {
      setErrorMessage('File size must be less than 500MB');
      return;
    }

    setSelectedFile(file);
    setErrorMessage('');
    setUploadStatus('idle');
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, []);

  const handleUpload = async () => {
    if (!selectedFile || !selectedEvent) {
      setErrorMessage('Please select an event and a file');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('idle');
    setErrorMessage('');

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('eventId', selectedEvent.booking_id);
      formData.append('type', uploadType);

      // Include class_id if available (preferred)
      if (selectedEvent.class_id) {
        formData.append('classId', selectedEvent.class_id);
      }

      // Include className for backward compatibility
      if (selectedEvent.class) {
        formData.append('className', selectedEvent.class);
      }

      const response = await fetch('/api/r2/upload-recording', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      clearInterval(progressInterval);

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploadProgress(100);
      setUploadStatus('success');
      setUploadResult(result.data);

      setTimeout(() => {
        setSelectedFile(null);
        setUploadProgress(0);
        setUploadStatus('idle');
        setUploadResult(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 5000);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to upload file');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (Math.round((bytes / Math.pow(k, i)) * 100) / 100).toFixed(2) + ' ' + sizes[i];
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedDate('');
    setSelectedSchool('');
    setSelectedClass('');
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Upload Recording</h1>
        <p className="mt-2 text-gray-600">
          Upload preview or full recordings for school events
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Event Selection */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <span className="bg-sage-100 text-sage-700 rounded-full w-8 h-8 flex items-center justify-center mr-3 font-bold">
                1
              </span>
              Select Event
            </h2>

            {/* Search Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search by Booking ID, School, or Teacher
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500"
                placeholder="Type to search..."
              />
            </div>

            {/* Filter Row */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Date
                </label>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500"
                >
                  <option value="">All dates</option>
                  {uniqueDates.map((date) => (
                    <option key={date} value={date}>
                      {formatDate(date)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by School
                </label>
                <select
                  value={selectedSchool}
                  onChange={(e) => setSelectedSchool(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500"
                >
                  <option value="">All schools</option>
                  {uniqueSchools.map((school) => (
                    <option key={school} value={school}>
                      {school}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Class Filter Row */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Class
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500"
                disabled={uniqueClasses.length === 0}
              >
                <option value="">All classes</option>
                {uniqueClasses.map((className) => (
                  <option key={className} value={className}>
                    {className}
                  </option>
                ))}
              </select>
              {uniqueClasses.length === 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  Select a date or school to see available classes
                </p>
              )}
            </div>

            {(searchQuery || selectedDate || selectedSchool || selectedClass) && (
              <button
                onClick={clearFilters}
                className="text-sm text-sage-600 hover:text-sage-800 mb-4"
              >
                Clear all filters
              </button>
            )}

            {/* Events List */}
            <div className="border border-gray-200 rounded-lg max-h-80 overflow-y-auto">
              {isLoadingEvents ? (
                <div className="p-8 text-center">
                  <LoadingSpinner size="md" />
                  <p className="mt-2 text-gray-600">Loading events...</p>
                </div>
              ) : eventError ? (
                <div className="p-8 text-center">
                  <p className="text-red-600">{eventError}</p>
                  <button
                    onClick={fetchEvents}
                    className="mt-2 text-sage-600 hover:text-sage-800"
                  >
                    Retry
                  </button>
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  {events.length === 0
                    ? 'No events found in database'
                    : 'No events match your filters'}
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredEvents.map((event) => (
                    <button
                      key={event.booking_id}
                      onClick={() => setSelectedEvent(event)}
                      className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                        selectedEvent?.booking_id === event.booking_id
                          ? 'bg-sage-50 border-l-4 border-sage-500'
                          : ''
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900">{event.school_name}</p>
                            {event.class && (
                              <span className="text-xs bg-sage-100 text-sage-700 px-2 py-1 rounded font-medium">
                                {event.class}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{formatDate(event.booking_date)}</p>
                        </div>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          {event.event_type}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        <span>Teacher: {event.main_teacher || event.teacher_name}</span>
                        <span className="mx-2">•</span>
                        <span>{event.parent_count} parent(s)</span>
                      </div>
                      {event.class_id && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-xs text-gray-500">Class ID:</span>
                          <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">
                            {event.class_id}
                          </code>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Selected Event Details */}
          {selectedEvent && (
            <div className="bg-sage-50 rounded-xl p-6 border-2 border-sage-200">
              <h3 className="font-semibold text-sage-900 mb-3">Selected Event</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">School:</span>
                  <span className="font-medium">{selectedEvent.school_name}</span>
                </div>
                {selectedEvent.class && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Class:</span>
                    <span className="font-medium bg-sage-100 text-sage-700 px-2 py-1 rounded">
                      {selectedEvent.class}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span className="font-medium">{formatDate(selectedEvent.booking_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium capitalize">{selectedEvent.event_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Teacher:</span>
                  <span className="font-medium">{selectedEvent.teacher_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Booking ID:</span>
                  <span className="font-mono text-xs bg-white px-2 py-1 rounded">
                    {selectedEvent.booking_id}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - File Upload */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <span className="bg-sage-100 text-sage-700 rounded-full w-8 h-8 flex items-center justify-center mr-3 font-bold">
                2
              </span>
              Upload Recording
            </h2>

            {/* Recording Type Toggle */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Recording Type
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setUploadType('preview')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    uploadType === 'preview'
                      ? 'border-sage-500 bg-sage-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-2">🎵</div>
                  <div className="font-semibold">Preview</div>
                  <div className="text-xs text-gray-500">30-second sample</div>
                </button>
                <button
                  onClick={() => setUploadType('full')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    uploadType === 'full'
                      ? 'border-sage-500 bg-sage-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-2">🎶</div>
                  <div className="font-semibold">Full Recording</div>
                  <div className="text-xs text-gray-500">Complete audio</div>
                </button>
              </div>
            </div>

            {/* Drag & Drop Zone */}
            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                isDragging
                  ? 'border-sage-500 bg-sage-50'
                  : selectedFile
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />

              {selectedFile ? (
                <div>
                  <div className="text-4xl mb-3">✅</div>
                  <p className="font-semibold text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-600 mt-1">{formatFileSize(selectedFile.size)}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="mt-3 text-sm text-red-600 hover:text-red-800"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div>
                  <div className="text-4xl mb-3">🎵</div>
                  <p className="font-semibold text-gray-900">Drop audio file here</p>
                  <p className="text-sm text-gray-600 mt-1">or click to browse</p>
                  <p className="text-xs text-gray-500 mt-2">
                    MP3, WAV, AAC • Max 500MB
                  </p>
                </div>
              )}
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-600">{errorMessage}</p>
              </div>
            )}

            {/* Success Message */}
            {uploadStatus === 'success' && uploadResult && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="font-semibold text-green-700 mb-2">Upload successful!</p>
                <div className="text-xs text-green-600 space-y-1">
                  <p>
                    <span className="font-medium">R2 Key:</span> {uploadResult.key}
                  </p>
                  <p>
                    <span className="font-medium">Type:</span> {uploadResult.type}
                  </p>
                  <p>
                    <span className="font-medium">Size:</span>{' '}
                    {formatFileSize(uploadResult.fileSize)}
                  </p>
                </div>
              </div>
            )}

            {/* Upload Progress */}
            {isUploading && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Uploading to Cloudflare R2...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-sage-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={!selectedFile || !selectedEvent || isUploading}
              className="mt-6 w-full py-4 px-6 bg-gradient-to-r from-sage-500 to-sage-700 text-white font-bold uppercase tracking-wide rounded-lg shadow-lg hover:from-sage-600 hover:to-sage-800 transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isUploading ? (
                <span className="flex items-center justify-center">
                  <LoadingSpinner size="sm" className="mr-2" />
                  Uploading...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  Upload {uploadType === 'preview' ? 'Preview' : 'Full Recording'}
                </span>
              )}
            </button>

            {!selectedEvent && (
              <p className="mt-3 text-center text-sm text-gray-500">
                Please select an event first
              </p>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Quick Tips</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Preview recordings should be ~30 seconds long</li>
              <li>Full recordings can be up to 2 hours</li>
              <li>Files are stored securely in Cloudflare R2</li>
              <li>Uploading will overwrite existing files for the same event</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
