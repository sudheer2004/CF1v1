// Constants
export const AVAILABLE_YEARS = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017];
export const TEAM_SIZE = 4;

// Helper Functions
export const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const getTeamPlayers = (activeBattle, team) => {
  if (!activeBattle) return [];
  const teamPlayers = activeBattle.players.filter((p) => p.team === team);
  const slots = Array(TEAM_SIZE).fill(null);
  teamPlayers.forEach((player) => {
    if (player.position >= 0 && player.position < TEAM_SIZE) {
      slots[player.position] = player;
    }
  });
  return slots;
};

export const getUserTeam = (activeBattle, user) => {
  if (!activeBattle || !user) return null;
  const player = activeBattle.players.find((p) => p.userId === user.id);
  return player ? player.team : null;
};

// Validation Functions
export const validateDuration = (duration) => {
  if (duration < 1 || duration > 500) {
    return "Duration must be between 1 and 500 minutes";
  }
  return null;
};

export const validateProblem = (problem, index) => {
  if (problem.points < 1 || problem.points > 1000) {
    return `Problem ${index + 1}: Points must be between 1 and 1000`;
  }

  if (problem.useCustomLink) {
    if (!problem.customLink || !problem.customLink.trim()) {
      return `Problem ${index + 1}: Please provide a problem link`;
    }
  } else {
    if (problem.useRange) {
      if (problem.ratingMin < 800 || problem.ratingMax > 3500) {
        return `Problem ${index + 1}: Rating must be between 800 and 3500`;
      }
      if (problem.ratingMin > problem.ratingMax) {
        return `Problem ${index + 1}: Min rating cannot be greater than max rating`;
      }
    } else {
      if (problem.rating < 800 || problem.rating > 3500) {
        return `Problem ${index + 1}: Rating must be between 800 and 3500`;
      }
    }
  }
  return null;
};

export const validateBattleForm = (formData) => {
  const durationError = validateDuration(formData.duration);
  if (durationError) return durationError;

  for (let i = 0; i < formData.problems.length; i++) {
    const error = validateProblem(formData.problems[i], i);
    if (error) return error;
  }

  return null;
};

export const validateTeamsForStart = (activeBattle) => {
  if (!activeBattle) return "No active battle";
  
  const teamA = activeBattle.players.filter((p) => p.team === "A");
  const teamB = activeBattle.players.filter((p) => p.team === "B");

  if (teamA.length === 0 || teamB.length === 0) {
    return "Both teams must have at least one player";
  }

  return null;
};