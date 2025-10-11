const axios = require('axios');

const CF_API_URL = process.env.CODEFORCES_API_URL || 'https://codeforces.com/api';

// In-memory cache for problems (24 hours)
let problemsCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Fetch all problems from Codeforces API with caching
const fetchAllProblems = async () => {
  try {
    // Check cache
    if (problemsCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
      console.log('✅ Using cached problems');
      return problemsCache;
    }

    console.log('🔄 Fetching problems from Codeforces API...');
    const response = await axios.get(`${CF_API_URL}/problemset.problems`);
    
    if (response.data.status !== 'OK') {
      throw new Error('Failed to fetch problems from Codeforces');
    }

    const problems = response.data.result.problems;
    
    // Cache problems
    problemsCache = problems;
    cacheTimestamp = Date.now();

    console.log(`✅ Cached ${problems.length} problems`);
    return problems;
  } catch (error) {
    console.error('Error fetching Codeforces problems:', error.message);
    
    // If cache exists but expired, return stale cache as fallback
    if (problemsCache) {
      console.warn('⚠️ Using stale cache as fallback');
      return problemsCache;
    }
    
    throw new Error('Failed to fetch problems from Codeforces API');
  }
};

/**
 * Estimate problem year from contestId
 */
const estimateProblemYear = (contestId) => {
  if (!contestId || contestId < 1) return null;
  
  if (contestId < 100) return 2010;
  if (contestId < 500) return 2013;
  if (contestId < 1000) return 2017;
  if (contestId < 1500) return 2019;
  if (contestId < 2000) return 2022;
  return 2024;
};

/**
 * Fetch user's attempted problems (both solved AND unsolved)
 * NO CACHING - always fetch fresh for accuracy
 * @param {string} cfHandle - Codeforces handle
 * @returns {Set<string>} - Set of attempted problem IDs (format: "contestId-index")
 */
const fetchUserAttemptedProblems = async (cfHandle) => {
  try {
    console.log(`🔄 Fetching attempted problems for ${cfHandle}...`);
    
    const response = await axios.get(`${CF_API_URL}/user.status`, {
      params: {
        handle: cfHandle,
        from: 1,
        count: 500, // Fetch more submissions for better coverage
      },
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Failed to fetch submissions for ${cfHandle}`);
    }

    const submissions = response.data.result;
    const attemptedSet = new Set();

    // Extract ALL attempted problems (regardless of verdict)
    submissions.forEach(sub => {
      if (sub.problem.contestId && sub.problem.index) {
        const problemId = `${sub.problem.contestId}-${sub.problem.index}`;
        attemptedSet.add(problemId);
      }
    });

    console.log(`✅ Found ${attemptedSet.size} attempted problems for ${cfHandle}`);
    return attemptedSet;
  } catch (error) {
    if (error.response?.data?.comment?.includes('not found')) {
      console.error(`❌ CF handle not found: ${cfHandle}`);
      throw new Error(`Codeforces handle "${cfHandle}" not found`);
    }
    console.error(`Error fetching attempted problems for ${cfHandle}:`, error.message);
    // Return empty set on error (fallback behavior)
    return new Set();
  }
};

/**
 * Filter problems by rating range, tags, year, and unattempted status
 */
const getFilteredProblems = async (
  ratingMin,
  ratingMax,
  tags,
  minYear = null,
  player1AttemptedSet = new Set(),
  player2AttemptedSet = new Set()
) => {
  const allProblems = await fetchAllProblems();

  const filtered = allProblems.filter(problem => {
    // CRITICAL: Skip special problems (Kotlin Heroes, April Fools, etc.)
    if (problem.tags && problem.tags.includes('*special')) {
      return false;
    }

    // Check if problem has rating
    if (!problem.rating) return false;

    // Check rating range
    if (problem.rating < ratingMin || problem.rating > ratingMax) return false;

    // Check if problem was attempted by either player
    const problemId = `${problem.contestId}-${problem.index}`;
    if (player1AttemptedSet.has(problemId) || player2AttemptedSet.has(problemId)) {
      return false;
    }

    // Check tags (at least one common tag)
    if (tags && tags.length > 0) {
      const hasCommonTag = problem.tags.some(tag => 
        tags.map(t => t.toLowerCase()).includes(tag.toLowerCase())
      );
      if (!hasCommonTag) return false;
    }

    // Check year if specified
    if (minYear !== null && minYear > 0) {
      const estimatedYear = estimateProblemYear(problem.contestId);
      if (estimatedYear !== null && estimatedYear < minYear) {
        return false;
      }
    }

    return true;
  });

  return filtered;
};

/**
 * Select random unattempted problem with intelligent fallback
 * @param {number} ratingMin - Minimum rating
 * @param {number} ratingMax - Maximum rating
 * @param {string[]} tags - Problem tags (optional)
 * @param {number} minYear - Minimum year (optional)
 * @param {string} player1Handle - Player 1 CF handle
 * @param {string} player2Handle - Player 2 CF handle
 */
const selectRandomUnsolvedProblem = async (
  ratingMin, 
  ratingMax, 
  tags, 
  minYear,
  player1Handle,
  player2Handle
) => {
  console.log('\n🎯 Starting unattempted problem selection...');
  console.log('   Rating range:', ratingMin, '-', ratingMax);
  console.log('   Tags:', tags || 'none');
  console.log('   Min year:', minYear || 'none');
  console.log('   Players:', player1Handle, 'vs', player2Handle);

  // STEP 1: Fetch both players' attempted problems in parallel (2 API calls)
  const [player1Attempted, player2Attempted] = await Promise.all([
    fetchUserAttemptedProblems(player1Handle),
    fetchUserAttemptedProblems(player2Handle),
  ]);

  console.log(`   Player 1 attempted: ${player1Attempted.size} problems`);
  console.log(`   Player 2 attempted: ${player2Attempted.size} problems`);

  // STEP 2: Try with all filters (rating + tags + year + unattempted)
  let problems = await getFilteredProblems(
    ratingMin, ratingMax, tags, minYear,
    player1Attempted, player2Attempted
  );

  if (problems.length > 0) {
    console.log(`✅ Found ${problems.length} unattempted problems with all filters`);
    return selectRandomFromArray(problems);
  }

  // FALLBACK 1: Remove tags filter
  if (tags && tags.length > 0) {
    console.log('⚠️ No problems with tags, retrying without tags...');
    problems = await getFilteredProblems(
      ratingMin, ratingMax, [], minYear,
      player1Attempted, player2Attempted
    );

    if (problems.length > 0) {
      console.log(`✅ Found ${problems.length} problems without tag filter`);
      return selectRandomFromArray(problems);
    }
  }

  // FALLBACK 2: Remove year filter
  if (minYear !== null) {
    console.log('⚠️ No problems with year filter, retrying without year...');
    problems = await getFilteredProblems(
      ratingMin, ratingMax, [], null,
      player1Attempted, player2Attempted
    );

    if (problems.length > 0) {
      console.log(`✅ Found ${problems.length} problems without year filter`);
      return selectRandomFromArray(problems);
    }
  }

  // FALLBACK 3: Expand rating range by 200 on each side
  console.log('⚠️ Expanding rating range...');
  const expandedMin = Math.max(800, ratingMin - 200);
  const expandedMax = Math.min(3500, ratingMax + 200);
  
  problems = await getFilteredProblems(
    expandedMin, expandedMax, [], null,
    player1Attempted, player2Attempted
  );

  if (problems.length > 0) {
    console.log(`✅ Found ${problems.length} problems with expanded rating`);
    return selectRandomFromArray(problems);
  }

  // FALLBACK 4: Allow attempted problems (last resort)
  console.log('⚠️ WARNING: All unattempted problems exhausted, allowing attempted problems...');
  problems = await getFilteredProblems(ratingMin, ratingMax, [], null);

  if (problems.length > 0) {
    console.log(`✅ Found ${problems.length} problems (may include attempted)`);
    return selectRandomFromArray(problems);
  }

  throw new Error('No problems found matching any criteria');
};

/**
 * Helper: Select random element from array
 */
const selectRandomFromArray = (array) => {
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
};

/**
 * LEGACY: Keep old function for backward compatibility
 * Use selectRandomUnsolvedProblem instead
 */
const selectRandomProblem = async (ratingMin, ratingMax, tags, minYear = null) => {
  const allProblems = await fetchAllProblems();
  
  let problems = allProblems.filter(problem => {
    // Skip special problems
    if (problem.tags && problem.tags.includes('*special')) {
      return false;
    }
    
    if (!problem.rating) return false;
    if (problem.rating < ratingMin || problem.rating > ratingMax) return false;

    if (tags && tags.length > 0) {
      const hasCommonTag = problem.tags.some(tag => 
        tags.map(t => t.toLowerCase()).includes(tag.toLowerCase())
      );
      if (!hasCommonTag) return false;
    }

    if (minYear !== null && minYear > 0) {
      const estimatedYear = estimateProblemYear(problem.contestId);
      if (estimatedYear !== null && estimatedYear < minYear) {
        return false;
      }
    }

    return true;
  });

  // Automatic fallback if no problems with year filter
  if (problems.length === 0 && minYear !== null) {
    console.log('⚠️ No problems with year filter, retrying without year...');
    problems = allProblems.filter(problem => {
      if (problem.tags && problem.tags.includes('*special')) return false;
      if (!problem.rating) return false;
      if (problem.rating < ratingMin || problem.rating > ratingMax) return false;
      
      if (tags && tags.length > 0) {
        const hasCommonTag = problem.tags.some(tag => 
          tags.map(t => t.toLowerCase()).includes(tag.toLowerCase())
        );
        if (!hasCommonTag) return false;
      }
      
      return true;
    });
  }

  if (problems.length === 0) {
    throw new Error('No problems found matching the criteria');
  }

  return selectRandomFromArray(problems);
};

// Fetch user submissions
const fetchUserSubmissions = async (cfHandle, count = 20) => {
  try {
    const response = await axios.get(`${CF_API_URL}/user.status`, {
      params: {
        handle: cfHandle,
        from: 1,
        count,
      },
    });

    if (response.data.status !== 'OK') {
      throw new Error('Failed to fetch user submissions');
    }

    return response.data.result;
  } catch (error) {
    if (error.response?.data?.comment?.includes('not found')) {
      throw new Error('Codeforces handle not found');
    }
    console.error('Error fetching user submissions:', error.message);
    throw new Error('Failed to fetch submissions from Codeforces API');
  }
};

// Check if user solved a specific problem after a given time
const checkProblemSolved = async (cfHandle, contestId, problemIndex, afterTimestamp) => {
  try {
    const submissions = await fetchUserSubmissions(cfHandle, 50);

    // Filter submissions for the specific problem after match start
    const relevantSubmissions = submissions.filter(sub => 
      sub.problem.contestId === contestId &&
      sub.problem.index === problemIndex &&
      sub.creationTimeSeconds >= Math.floor(afterTimestamp / 1000)
    );

    // Check if any submission is accepted
    const acceptedSubmission = relevantSubmissions.find(sub => 
      sub.verdict === 'OK'
    );

    return {
      solved: !!acceptedSubmission,
      submission: acceptedSubmission || null,
      attempts: relevantSubmissions.length,
    };
  } catch (error) {
    console.error('Error checking problem solved:', error.message);
    return {
      solved: false,
      submission: null,
      attempts: 0,
    };
  }
};

/**
 * Initialize and auto-refresh problems cache
 * Call this when server starts
 */
const initializeProblemsCache = async () => {
  try {
    console.log('🚀 Initializing problems cache on server startup...');
    await fetchAllProblems();
    console.log('✅ Problems cache initialized');
    
    // Auto-refresh every 12 hours
    setInterval(async () => {
      try {
        console.log('🔄 Auto-refreshing problems cache...');
        problemsCache = null;
        cacheTimestamp = null;
        await fetchAllProblems();
        console.log('✅ Problems cache refreshed');
      } catch (error) {
        console.error('❌ Cache refresh failed:', error.message);
      }
    }, 12 * 60 * 60 * 1000); // 12 hours
    
  } catch (error) {
    console.error('❌ Failed to initialize problems cache:', error.message);
  }
};

module.exports = {
  fetchAllProblems,
  getFilteredProblems,
  selectRandomProblem, // Legacy
  selectRandomUnsolvedProblem, // Use this for matches
  fetchUserSubmissions,
  checkProblemSolved,
  estimateProblemYear,
  fetchUserAttemptedProblems, // NEW
  initializeProblemsCache, // NEW - call on server start
};