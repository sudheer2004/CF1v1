export const PROBLEM_TAGS = [
  'implementation',
  'math',
  'greedy',
  'dp',
  'data structures',
  'brute force',
  'constructive algorithms',
  'graphs',
  'sortings',
  'binary search',
  'dfs and similar',
  'trees',
  'strings',
  'number theory',
  'combinatorics',
  'geometry',
  'bitmasks',
  'two pointers',
  'divide and conquer',
  'games',
];

export const RATING_RANGES = [
  { label: '800-1200 (Beginner)', min: 800, max: 1200 },
  { label: '1200-1600 (Easy)', min: 1200, max: 1600 },
  { label: '1600-2000 (Medium)', min: 1600, max: 2000 },
  { label: '2000-2400 (Hard)', min: 2000, max: 2400 },
  { label: '2400+ (Expert)', min: 2400, max: 3500 },
];

export const DURATIONS = [
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '45 minutes', value: 45 },
  { label: '60 minutes', value: 60 },
  { label: '90 minutes', value: 90 },
];

export const MATCH_STATUS = {
  WAITING: 'waiting',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export const getRatingColor = (rating) => {
  if (rating < 1200) return 'text-gray-400';
  if (rating < 1400) return 'text-green-400';
  if (rating < 1600) return 'text-cyan-400';
  if (rating < 1900) return 'text-blue-400';
  if (rating < 2100) return 'text-purple-400';
  if (rating < 2400) return 'text-yellow-400';
  return 'text-red-400';
};

export const getRatingBadge = (rating) => {
  if (rating < 1200) return 'Newbie';
  if (rating < 1400) return 'Pupil';
  if (rating < 1600) return 'Specialist';
  if (rating < 1900) return 'Expert';
  if (rating < 2100) return 'Candidate Master';
  if (rating < 2400) return 'Master';
  if (rating < 3000) return 'International Master';
  return 'Grandmaster';
};