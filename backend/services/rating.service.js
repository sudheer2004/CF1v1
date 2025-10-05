// ELO Rating System (like Lichess)

const K_FACTOR = 32; // Standard K-factor for ELO

// Calculate expected score for a player
const calculateExpectedScore = (playerRating, opponentRating) => {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
};

// Calculate rating change based on match result
const calculateRatingChange = (playerRating, opponentRating, actualScore) => {
  const expectedScore = calculateExpectedScore(playerRating, opponentRating);
  const ratingChange = Math.round(K_FACTOR * (actualScore - expectedScore));
  return ratingChange;
};

// Calculate new ratings for both players after a match
const calculateNewRatings = (player1Rating, player2Rating, winnerId, player1Id) => {
  let player1ActualScore, player2ActualScore;

  if (winnerId === null) {
    // Draw
    player1ActualScore = 0.5;
    player2ActualScore = 0.5;
  } else if (winnerId === player1Id) {
    // Player 1 wins
    player1ActualScore = 1;
    player2ActualScore = 0;
  } else {
    // Player 2 wins
    player1ActualScore = 0;
    player2ActualScore = 1;
  }

  const player1Change = calculateRatingChange(player1Rating, player2Rating, player1ActualScore);
  const player2Change = calculateRatingChange(player2Rating, player1Rating, player2ActualScore);

  return {
    player1Change,
    player2Change,
    player1NewRating: Math.max(0, player1Rating + player1Change), // Floor at 0
    player2NewRating: Math.max(0, player2Rating + player2Change), // Floor at 0
  };
};

module.exports = {
  calculateNewRatings,
  calculateRatingChange,
  calculateExpectedScore,
};