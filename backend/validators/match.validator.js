// Validation utility for match-related data
const validateMatchSettings = (ratingMin, ratingMax, tags, duration) => {
  const errors = [];

  // Validate ratingMin
  if (typeof ratingMin !== 'number' || isNaN(ratingMin)) {
    errors.push('Minimum rating must be a valid number');
  } else if (ratingMin < 800 || ratingMin > 3500) {
    errors.push('Minimum rating must be between 800 and 3500');
  }

  // Validate ratingMax
  if (typeof ratingMax !== 'number' || isNaN(ratingMax)) {
    errors.push('Maximum rating must be a valid number');
  } else if (ratingMax < 800 || ratingMax > 3500) {
    errors.push('Maximum rating must be between 800 and 3500');
  }

  // Validate rating range
  if (typeof ratingMin === 'number' && typeof ratingMax === 'number' && ratingMin > ratingMax) {
    errors.push('Minimum rating cannot be greater than maximum rating');
  }

  // Validate tags
  if (tags !== undefined && tags !== null) {
    if (!Array.isArray(tags)) {
      errors.push('Tags must be an array');
    } else {
      // Check each tag is a string
      const invalidTags = tags.filter(tag => typeof tag !== 'string');
      if (invalidTags.length > 0) {
        errors.push('All tags must be strings');
      }
      
      // Reasonable tag limit
      if (tags.length > 20) {
        errors.push('Too many tags (maximum 20)');
      }
    }
  }

  // Validate duration
  if (typeof duration !== 'number' || isNaN(duration)) {
    errors.push('Duration must be a valid number');
  } else if (!Number.isInteger(duration)) {
    errors.push('Duration must be a whole number');
  } else if (duration < 1 || duration > 180) {
    errors.push('Duration must be between 1 and 180 minutes');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Sanitize match settings to prevent injection/manipulation
const sanitizeMatchSettings = (ratingMin, ratingMax, tags, duration) => {
  return {
    ratingMin: Math.floor(Number(ratingMin)),
    ratingMax: Math.floor(Number(ratingMax)),
    tags: Array.isArray(tags) ? tags.filter(tag => typeof tag === 'string').slice(0, 20) : [],
    duration: Math.floor(Number(duration))
  };
};

module.exports = {
  validateMatchSettings,
  sanitizeMatchSettings
};