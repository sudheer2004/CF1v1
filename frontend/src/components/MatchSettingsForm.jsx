import React, { useState, useRef, useEffect } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';

const PROBLEM_TAGS = [
  '2-sat',
  'binary search',
  'bitmasks',
  'brute force',
  'chinese remainder theorem',
  'combinatorics',
  'constructive algorithms',
  'data structures',
  'dfs and similar',
  'divide and conquer',
  'dp',
  'dsu',
  'expression parsing',
  'fft',
  'flows',
  'games',
  'geometry',
  'graph matchings',
  'graphs',
  'greedy',
  'hashing',
  'implementation',
  'interactive',
  'math',
  'matrices',
  'meet-in-the-middle',
  'number theory',
  'probabilities',
  'schedules',
  'shortest paths',
  'sortings',
  'string suffix structures',
  'strings',
  'ternary search',
  'trees',
  'two pointers',
];

export default function MatchSettingsForm({
  formData,
  setFormData,
  disabled = false
}) {
  const [tagSearch, setTagSearch] = useState('');
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [customDuration, setCustomDuration] = useState('');
  const [useCustomDuration, setUseCustomDuration] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsTagDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTagToggle = (tag) => {
    setFormData({
      ...formData,
      tags: formData.tags.includes(tag)
        ? formData.tags.filter((t) => t !== tag)
        : [...formData.tags, tag],
    });
  };

  const handleRemoveTag = (tag) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((t) => t !== tag),
    });
  };

  const handleCustomDurationChange = (value) => {
    setCustomDuration(value);
    const duration = parseInt(value);
    if (duration >= 1 && duration <= 180) {
      setFormData({ ...formData, duration });
    }
  };

  const filteredTags = PROBLEM_TAGS.filter((tag) =>
    tag.toLowerCase().includes(tagSearch.toLowerCase())
  );

  const quickDurations = [15, 30, 45, 60, 90];

  return (
    <>
      {/* Rating Range */}
      <div className="mb-6">
        <label className="block text-white font-medium mb-3">
          Problem Rating Range
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Min Rating</label>
            <input
              type="number"
              value={formData.ratingMin}
              onChange={(e) =>
                setFormData({ ...formData, ratingMin: parseInt(e.target.value) || 800 })
              }
              min="800"
              max="3500"
              step="100"
              disabled={disabled}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Max Rating</label>
            <input
              type="number"
              value={formData.ratingMax}
              onChange={(e) =>
                setFormData({ ...formData, ratingMax: parseInt(e.target.value) || 1600 })
              }
              min="800"
              max="3500"
              step="100"
              disabled={disabled}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      {/* Duration */}
      <div className="mb-6">
        <label className="block text-white font-medium mb-3">Match Duration</label>
        
        {/* Quick Select Buttons */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
          {quickDurations.map((dur) => (
            <button
              key={dur}
              onClick={() => {
                setFormData({ ...formData, duration: dur });
                setUseCustomDuration(false);
                setCustomDuration('');
              }}
              disabled={disabled}
              className={`px-4 py-2 rounded-lg transition disabled:opacity-50 ${
                formData.duration === dur && !useCustomDuration
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {dur}m
            </button>
          ))}
        </div>

        {/* Custom Duration Input */}
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="customDuration"
            checked={useCustomDuration}
            onChange={(e) => {
              setUseCustomDuration(e.target.checked);
              if (!e.target.checked) {
                setCustomDuration('');
                setFormData({ ...formData, duration: 30 });
              }
            }}
            disabled={disabled}
            className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
          />
          <label htmlFor="customDuration" className="text-sm text-gray-400">
            Custom duration
          </label>
          {useCustomDuration && (
            <div className="flex-1 flex items-center space-x-2">
              <input
                type="number"
                value={customDuration}
                onChange={(e) => handleCustomDurationChange(e.target.value)}
                placeholder="1-180"
                min="1"
                max="180"
                disabled={disabled}
                className="w-24 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 disabled:opacity-50"
              />
              <span className="text-gray-400 text-sm">minutes (1-180)</span>
            </div>
          )}
        </div>
      </div>

      {/* Tags with Search */}
      <div className="mb-8">
        <label className="block text-white font-medium mb-3">
          Problem Tags ({formData.tags.length} selected) - Optional
        </label>

        {/* Selected Tags */}
        {formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 p-3 bg-gray-700/50 rounded-lg">
            {formData.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg"
              >
                <span>{tag}</span>
                <button
                  onClick={() => handleRemoveTag(tag)}
                  disabled={disabled}
                  className="hover:bg-purple-700 rounded-full p-0.5 transition disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Tag Search Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <div
            className="flex items-center space-x-2 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer hover:border-purple-500 transition"
            onClick={() => !disabled && setIsTagDropdownOpen(!isTagDropdownOpen)}
          >
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={tagSearch}
              onChange={(e) => {
                setTagSearch(e.target.value);
                setIsTagDropdownOpen(true);
              }}
              onClick={(e) => {
                e.stopPropagation();
                setIsTagDropdownOpen(true);
              }}
              placeholder="Search tags..."
              disabled={disabled}
              className="flex-1 bg-transparent text-white focus:outline-none placeholder-gray-400 disabled:opacity-50"
            />
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform ${
                isTagDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </div>

          {/* Dropdown Menu */}
          {isTagDropdownOpen && !disabled && (
            <div className="absolute z-10 w-full mt-2 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
              {filteredTags.length > 0 ? (
                filteredTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      handleTagToggle(tag);
                      setTagSearch('');
                    }}
                    className={`w-full text-left px-4 py-2.5 hover:bg-gray-700 transition flex items-center justify-between ${
                      formData.tags.includes(tag) ? 'bg-purple-600/20' : ''
                    }`}
                  >
                    <span className="text-white">{tag}</span>
                    {formData.tags.includes(tag) && (
                      <span className="text-purple-400 text-sm">✓</span>
                    )}
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-gray-400 text-sm text-center">
                  No tags found
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Click to search and select tags. Leave empty for any tag.
        </p>
      </div>
    </>
  );
}