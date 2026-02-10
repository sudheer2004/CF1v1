// Chat utility functions for avatar colors, initials, and time formatting

/**
 * Generate consistent avatar color based on user ID
 */
export function getAvatarColor(userId) {
  const colors = [
    '#FF6B6B', // red
    '#4ECDC4', // teal
    '#45B7D1', // blue
    '#FFA07A', // salmon
    '#98D8C8', // mint
    '#F7DC6F', // yellow
    '#BB8FCE', // purple
    '#85C1E2', // sky blue
    '#F8B88B', // peach
    '#52B788', // green
  ];
  
  // Convert userId to number for consistent hashing
  const hash = userId.split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);
  
  return colors[hash % colors.length];
}

/**
 * Get initials from username
 */
export function getInitials(username) {
  if (!username) return '?';
  
  const parts = username.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  
  return username.slice(0, 2).toUpperCase();
}

/**
 * Format timestamp to relative time (e.g., "2m ago", "Just now")
 */
export function formatRelativeTime(timestamp) {
  const now = Date.now();
  const date = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  
  // For older messages, show date
  const msgDate = new Date(date);
  return msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}