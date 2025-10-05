const { checkProblemSolved } = require('./codeforces.service');
const { parseProblemId } = require('../utils/helpers.util');

// Poll submissions for both players in a match
const pollMatchSubmissions = async (match) => {
  const { contestId, index } = parseProblemId(match.problemId);
  const startTimestamp = new Date(match.startTime).getTime();

  const results = {
    player1: null,
    player2: null,
  };

  // Check player 1 submissions
  if (match.player1.cfHandle) {
    try {
      results.player1 = await checkProblemSolved(
        match.player1.cfHandle,
        contestId,
        index,
        startTimestamp
      );
    } catch (error) {
      console.error(`Error checking player1 submissions:`, error.message);
      results.player1 = { solved: false, attempts: 0, submission: null };
    }
  }

  // Check player 2 submissions
  if (match.player2.cfHandle) {
    try {
      results.player2 = await checkProblemSolved(
        match.player2.cfHandle,
        contestId,
        index,
        startTimestamp
      );
    } catch (error) {
      console.error(`Error checking player2 submissions:`, error.message);
      results.player2 = { solved: false, attempts: 0, submission: null };
    }
  }

  return results;
};

// Determine winner based on submissions
const determineWinner = (player1Result, player2Result, player1Id, player2Id) => {
  if (player1Result.solved && !player2Result.solved) {
    return player1Id;
  }
  
  if (player2Result.solved && !player1Result.solved) {
    return player2Id;
  }

  if (player1Result.solved && player2Result.solved) {
    // Both solved - compare submission times
    const player1Time = player1Result.submission.creationTimeSeconds;
    const player2Time = player2Result.submission.creationTimeSeconds;
    
    return player1Time < player2Time ? player1Id : player2Id;
  }

  // Neither solved
  return null;
};

module.exports = {
  pollMatchSubmissions,
  determineWinner,
};