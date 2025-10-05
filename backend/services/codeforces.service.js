const axios = require('axios');

const CF_API_URL = process.env.CODEFORCES_API_URL || 'https://codeforces.com/api';

// In-memory cache for problems
let problemsCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Fetch all problems from Codeforces API
const fetchAllProblems = async () => {
  try {
    // Check cache
    if (problemsCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
      return problemsCache;
    }

    const response = await axios.get(`${CF_API_URL}/problemset.problems`);
    
    if (response.data.status !== 'OK') {
      throw new Error('Failed to fetch problems from Codeforces');
    }

    const problems = response.data.result.problems;
    
    // Cache problems
    problemsCache = problems;
    cacheTimestamp = Date.now();

    return problems;
  } catch (error) {
    console.error('Error fetching Codeforces problems:', error.message);
    throw new Error('Failed to fetch problems from Codeforces API');
  }
};

// Filter problems by rating range and tags
const getFilteredProblems = async (ratingMin, ratingMax, tags) => {
  const allProblems = await fetchAllProblems();

  const filtered = allProblems.filter(problem => {
    // Check if problem has rating
    if (!problem.rating) return false;

    // Check rating range
    if (problem.rating < ratingMin || problem.rating > ratingMax) return false;

    // Check tags (at least one common tag)
    if (tags && tags.length > 0) {
      const hasCommonTag = problem.tags.some(tag => 
        tags.map(t => t.toLowerCase()).includes(tag.toLowerCase())
      );
      if (!hasCommonTag) return false;
    }

    return true;
  });

  return filtered;
};

// Select random problem from filtered list
const selectRandomProblem = async (ratingMin, ratingMax, tags) => {
  const problems = await getFilteredProblems(ratingMin, ratingMax, tags);

  if (problems.length === 0) {
    throw new Error('No problems found matching the criteria');
  }

  const randomIndex = Math.floor(Math.random() * problems.length);
  return problems[randomIndex];
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

module.exports = {
  fetchAllProblems,
  getFilteredProblems,
  selectRandomProblem,
  fetchUserSubmissions,
  checkProblemSolved,
};