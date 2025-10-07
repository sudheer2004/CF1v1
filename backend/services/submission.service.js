const { checkProblemSolved } = require('./codeforces.service');
const { parseProblemId } = require('../utils/helpers.util');

// Poll submissions for both players in a match
const pollMatchSubmissions = async (match) => {
  console.log('[SUBMISSION SERVICE] Starting poll...');
  console.log('[SUBMISSION SERVICE] Match ID:', match.id);
  console.log('[SUBMISSION SERVICE] Problem ID:', match.problemId);
  
  const { contestId, index } = parseProblemId(match.problemId);
  const startTimestamp = Math.floor(new Date(match.startTime).getTime() / 1000); // Convert to seconds
  
  console.log('[SUBMISSION SERVICE] Contest ID:', contestId);
  console.log('[SUBMISSION SERVICE] Problem Index:', index);
  console.log('[SUBMISSION SERVICE] Start Timestamp:', startTimestamp);
  console.log('[SUBMISSION SERVICE] Start Date:', new Date(match.startTime).toISOString());

  const results = {
    player1: { solved: false, attempts: 0, submission: null, solveTime: null },
    player2: { solved: false, attempts: 0, submission: null, solveTime: null },
  };

  // Check player 1 submissions
  if (match.player1?.cfHandle) {
    console.log('[SUBMISSION SERVICE] Checking Player 1:', match.player1.cfHandle);
    try {
      results.player1 = await checkProblemSolved(
        match.player1.cfHandle,
        contestId,
        index,
        startTimestamp
      );
      console.log('[SUBMISSION SERVICE] Player 1 result:', {
        solved: results.player1.solved,
        attempts: results.player1.attempts,
      });
    } catch (error) {
      console.error('[SUBMISSION SERVICE] Error checking player1:', error.message);
      results.player1 = { solved: false, attempts: 0, submission: null, solveTime: null };
    }
  } else {
    console.error('[SUBMISSION SERVICE] Player 1 has no CF handle!');
  }

  // Check player 2 submissions
  if (match.player2?.cfHandle) {
    console.log('[SUBMISSION SERVICE] Checking Player 2:', match.player2.cfHandle);
    try {
      results.player2 = await checkProblemSolved(
        match.player2.cfHandle,
        contestId,
        index,
        startTimestamp
      );
      console.log('[SUBMISSION SERVICE] Player 2 result:', {
        solved: results.player2.solved,
        attempts: results.player2.attempts,
      });
    } catch (error) {
      console.error('[SUBMISSION SERVICE] Error checking player2:', error.message);
      results.player2 = { solved: false, attempts: 0, submission: null, solveTime: null };
    }
  } else {
    console.error('[SUBMISSION SERVICE] Player 2 has no CF handle!');
  }

  console.log('[SUBMISSION SERVICE] Final results:', {
    player1: { solved: results.player1.solved, attempts: results.player1.attempts },
    player2: { solved: results.player2.solved, attempts: results.player2.attempts },
  });

  return results;
};

// Determine winner based on submissions
const determineWinner = (player1Result, player2Result, player1Id, player2Id) => {
  console.log('[SUBMISSION SERVICE] Determining winner...');
  console.log('[SUBMISSION SERVICE] Player 1 solved:', player1Result.solved);
  console.log('[SUBMISSION SERVICE] Player 2 solved:', player2Result.solved);

  // Only player 1 solved
  if (player1Result.solved && !player2Result.solved) {
    console.log('[SUBMISSION SERVICE] Winner: Player 1');
    return player1Id;
  }
  
  // Only player 2 solved
  if (player2Result.solved && !player1Result.solved) {
    console.log('[SUBMISSION SERVICE] Winner: Player 2');
    return player2Id;
  }

  // Both solved - compare submission times
  if (player1Result.solved && player2Result.solved) {
    const player1Time = player1Result.submission.creationTimeSeconds;
    const player2Time = player2Result.submission.creationTimeSeconds;
    
    console.log('[SUBMISSION SERVICE] Both solved! Comparing times...');
    console.log('[SUBMISSION SERVICE] Player 1 time:', player1Time);
    console.log('[SUBMISSION SERVICE] Player 2 time:', player2Time);
    
    const winnerId = player1Time < player2Time ? player1Id : player2Id;
    console.log('[SUBMISSION SERVICE] Winner:', winnerId === player1Id ? 'Player 1' : 'Player 2');
    return winnerId;
  }

  // Neither solved
  console.log('[SUBMISSION SERVICE] No winner (draw)');
  return null;
};

module.exports = {
  pollMatchSubmissions,
  determineWinner,
};