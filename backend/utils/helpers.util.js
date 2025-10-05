// Generate random duel code (8 characters)
const generateDuelCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Format problem ID (contestId-index)
const formatProblemId = (contestId, index) => {
  return `${contestId}-${index}`;
};

// Parse problem ID
const parseProblemId = (problemId) => {
  const [contestId, index] = problemId.split('-');
  return { contestId: parseInt(contestId), index };
};

// Generate Codeforces problem URL
const getCodeforcesUrl = (contestId, index) => {
  return `https://codeforces.com/problemset/problem/${contestId}/${index}`;
};

// Check if two arrays have at least one common element
const hasCommonElement = (arr1, arr2) => {
  return arr1.some(item => arr2.includes(item));
};

module.exports = {
  generateDuelCode,
  formatProblemId,
  parseProblemId,
  getCodeforcesUrl,
  hasCommonElement,
};