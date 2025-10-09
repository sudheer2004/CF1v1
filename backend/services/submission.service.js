const { checkProblemSolved } = require('./codeforces.service');
const { parseProblemId } = require('../utils/helpers.util');

// Poll submissions for both players in a match
const pollMatchSubmissions = async (match) => {

  const { contestId, index } = parseProblemId(match.problemId);
  const startTimestamp = Math.floor(new Date(match.startTime).getTime() / 1000); // Convert to seconds
  
  

  const results = {
    player1: { solved: false, attempts: 0, submission: null, solveTime: null },
    player2: { solved: false, attempts: 0, submission: null, solveTime: null },
  };

  // Check player 1 submissions
  if (match.player1?.cfHandle) {
    
    try {
      results.player1 = await checkProblemSolved(
        match.player1.cfHandle,
        contestId,
        index,
        startTimestamp
      );
     
    } catch (error) {
      console.error('[SUBMISSION SERVICE] Error checking player1:', error.message);
      results.player1 = { solved: false, attempts: 0, submission: null, solveTime: null };
    }
  } else {
    console.error('[SUBMISSION SERVICE] Player 1 has no CF handle!');
  }

  // Check player 2 submissions
  if (match.player2?.cfHandle) {
    
    try {
      results.player2 = await checkProblemSolved(
        match.player2.cfHandle,
        contestId,
        index,
        startTimestamp
      );
     
    } catch (error) {
      console.error('[SUBMISSION SERVICE] Error checking player2:', error.message);
      results.player2 = { solved: false, attempts: 0, submission: null, solveTime: null };
    }
  } else {
    console.error('[SUBMISSION SERVICE] Player 2 has no CF handle!');
  }



  return results;
};

// Determine winner based on submissions
const determineWinner = (player1Result, player2Result, player1Id, player2Id) => {
  

  // Only player 1 solved
  if (player1Result.solved && !player2Result.solved) {
  
    return player1Id;
  }
  
  // Only player 2 solved
  if (player2Result.solved && !player1Result.solved) {
  
    return player2Id;
  }

  // Both solved - compare submission times
  if (player1Result.solved && player2Result.solved) {
    const player1Time = player1Result.submission.creationTimeSeconds;
    const player2Time = player2Result.submission.creationTimeSeconds;
    
    const winnerId = player1Time < player2Time ? player1Id : player2Id;
   
    return winnerId;
  }

  // Neither solved
 
  return null;
};

module.exports = {
  pollMatchSubmissions,
  determineWinner,
};