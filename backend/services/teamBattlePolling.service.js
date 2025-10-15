const prisma = require('../config/database.config');
const cfApiQueue = require('./cfApiQueue.service');

class TeamBattlePollingService {
  /**
   * Smart polling: min(players, problems) strategy
   */
  async pollBattleSubmissions(battle) {
    const players = battle.players;
    const problems = battle.problems.filter(p => p.contestId && p.problemIndexChar);

    const totalPlayers = players.length;
    const totalProblems = problems.length;

    console.log(`      ┌─────────────────────────────────────┐`);
    console.log(`      │ 🔍 POLLING SUBMISSIONS              │`);
    console.log(`      └─────────────────────────────────────┘`);
    console.log(`         Players: ${totalPlayers}`);
    console.log(`         CF Problems: ${totalProblems}`);
    console.log(`         Total Problems: ${battle.problems.length}`);

    if (totalProblems === 0) {
      console.log(`         ⚠️  No Codeforces problems to poll`);
      return [];
    }

    // Show unsolved problems
    const unsolvedProblems = problems.filter(p => !p.solvedBy);
    console.log(`         Unsolved: ${unsolvedProblems.length}`);
    unsolvedProblems.forEach(p => {
      console.log(`            - Problem ${p.problemIndex + 1}: ${p.problemName || p.contestId + p.problemIndexChar}`);
    });

    let results;

    // Strategy: Use fewer API calls
    if (totalPlayers <= totalProblems) {
      console.log(`         📋 Strategy: Fetch player submissions (${totalPlayers} API calls)`);
      results = await this.pollByPlayers(battle, players, problems);
    } else {
      console.log(`         📋 Strategy: Fetch contest standings (${new Set(problems.map(p => p.contestId)).size} API calls)`);
      results = await this.pollByProblems(battle, players, problems);
    }

    console.log(`         ✅ Polling complete - ${results.length} solve(s) found`);

    return results;
  }

  /**
   * Poll by fetching each player's submissions
   */
  async pollByPlayers(battle, players, problems) {
    console.log(`         ┌─────────────────────────────────┐`);
    console.log(`         │ Fetching Player Submissions     │`);
    console.log(`         └─────────────────────────────────┘`);

    const battleStartTime = Math.floor(new Date(battle.startTime).getTime() / 1000);
    const battleEndTime = battle.endTime ? Math.floor(new Date(battle.endTime).getTime() / 1000) : null;
    const results = [];

    // Filter players with valid CF handles
    const validPlayers = players.filter(p => p.cfHandle && p.cfHandle.trim());

    console.log(`            Valid CF handles: ${validPlayers.length}/${players.length}`);
    validPlayers.forEach(p => console.log(`               - ${p.username} (${p.cfHandle})`));

    if (validPlayers.length === 0) {
      console.log(`            ⚠️  No valid CF handles found`);
      return [];
    }

    // Fetch all players' submissions in parallel (with queue rate limiting)
    console.log(`            🌐 Fetching submissions from Codeforces...`);
    
    const submissionPromises = validPlayers.map(player =>
      cfApiQueue.fetchUserSubmissions(player.cfHandle, 50)
        .then(subs => {
          console.log(`               ✅ ${player.username}: ${subs?.length || 0} recent submissions`);
          return subs;
        })
        .catch(error => {
          console.error(`               ❌ ${player.username}: ${error.message}`);
          return [];
        })
    );

    const allSubmissions = await Promise.all(submissionPromises);

    console.log(`            📊 Processing submissions...`);

    // Track first solves across all problems
    const firstSolves = new Map(); // problemIndex -> { player, time, submission }

    // Check each problem
    for (const problem of problems) {
      if (problem.solvedBy) {
        console.log(`               ⏭️  Problem ${problem.problemIndex + 1} already solved, skipping`);
        continue;
      }

      console.log(`               🔍 Checking Problem ${problem.problemIndex + 1}: ${problem.contestId}${problem.problemIndexChar}`);

      // Check submissions for all players for this problem
      for (let i = 0; i < validPlayers.length; i++) {
        const player = validPlayers[i];
        const submissions = allSubmissions[i] || [];

        // Filter submissions for this problem within battle time
        const relevantSubmissions = submissions.filter(sub => {
          const isCorrectProblem = 
            sub.problem.contestId === problem.contestId &&
            sub.problem.index === problem.problemIndexChar;
          
          const isAfterStart = sub.creationTimeSeconds >= battleStartTime;
          const isBeforeEnd = !battleEndTime || sub.creationTimeSeconds <= battleEndTime;
          
          return isCorrectProblem && isAfterStart && isBeforeEnd;
        });

        if (relevantSubmissions.length > 0) {
          console.log(`                  📝 ${player.username}: ${relevantSubmissions.length} attempt(s)`);
          
          relevantSubmissions.forEach(sub => {
            const time = new Date(sub.creationTimeSeconds * 1000).toLocaleTimeString();
            console.log(`                     - ${time}: ${sub.verdict} (ID: ${sub.id})`);
          });
        }

        // Record all attempts
        for (const sub of relevantSubmissions) {
          await this.recordAttempt(battle.id, player, problem.problemIndex, sub);
        }

        // Check if solved (verdict === 'OK')
        const acceptedSubmission = relevantSubmissions.find(sub => sub.verdict === 'OK');

        if (acceptedSubmission) {
          const solveTime = acceptedSubmission.creationTimeSeconds;
          
          // Track first solve for this problem
          if (!firstSolves.has(problem.problemIndex) || solveTime < firstSolves.get(problem.problemIndex).time) {
            firstSolves.set(problem.problemIndex, {
              player,
              time: solveTime,
              submission: acceptedSubmission,
              problem
            });
          }
        }
      }

      // Award points to first solver of this problem
      if (firstSolves.has(problem.problemIndex)) {
        const firstSolve = firstSolves.get(problem.problemIndex);
        const solveTime = new Date(firstSolve.time * 1000).toLocaleTimeString();
        console.log(`                  🏆 FIRST SOLVE by ${firstSolve.player.username} at ${solveTime}!`);
        
        results.push({
          problemIndex: problem.problemIndex,
          solvedBy: firstSolve.player.team,
          userId: firstSolve.player.userId,
          username: firstSolve.player.username,
          points: problem.points,
          solvedAt: new Date(firstSolve.time * 1000),
        });
      }
    }

    console.log(`            ✅ Player polling complete`);
    return results;
  }

  /**
   * Poll by fetching contest submissions (NEW APPROACH)
   * Fetches all recent contest submissions and filters for our players
   */
  async pollByProblems(battle, players, problems) {
    console.log(`         ┌─────────────────────────────────┐`);
    console.log(`         │ Fetching Contest Submissions    │`);
    console.log(`         └─────────────────────────────────┘`);

    const battleStartTime = Math.floor(new Date(battle.startTime).getTime() / 1000);
    const battleEndTime = battle.endTime ? Math.floor(new Date(battle.endTime).getTime() / 1000) : null;
    
    // Group problems by contest
    const contestProblems = new Map();

    problems.forEach(problem => {
      if (!problem.solvedBy && problem.contestId) {
        if (!contestProblems.has(problem.contestId)) {
          contestProblems.set(problem.contestId, []);
        }
        contestProblems.get(problem.contestId).push(problem);
      }
    });

    console.log(`            Contests to poll: ${contestProblems.size}`);
    contestProblems.forEach((probs, contestId) => {
      console.log(`               - Contest ${contestId}: ${probs.length} problem(s)`);
    });

    const results = [];
    const validPlayers = players.filter(p => p.cfHandle && p.cfHandle.trim());

    if (validPlayers.length === 0) {
      console.log(`            ⚠️  No valid CF handles found`);
      return [];
    }

    console.log(`            Valid CF handles: ${validPlayers.length}`);
    validPlayers.forEach(p => console.log(`               - ${p.username} (${p.cfHandle})`));

    // Create a map of CF handles for quick lookup (case-insensitive)
    const playersByHandle = new Map();
    validPlayers.forEach(p => {
      playersByHandle.set(p.cfHandle.toLowerCase(), p);
    });

    // Fetch submissions for each contest
    for (const [contestId, contestProbs] of contestProblems.entries()) {
      try {
        console.log(`            🌐 Fetching recent submissions for contest ${contestId}...`);
        
        // Fetch recent contest submissions (status API)
        const submissions = await cfApiQueue.request('contest.status', {
          contestId,
          from: 1,
          count: 100, // Get last 100 submissions
        }, 0, false); // No cache

        if (!submissions || submissions.length === 0) {
          console.log(`               ⚠️  No submissions found for contest ${contestId}`);
          continue;
        }

        console.log(`               ✅ Found ${submissions.length} recent submissions in contest`);

        // Filter submissions from our players
        const ourPlayersSubmissions = submissions.filter(sub => {
          const handle = sub.author.members[0].handle.toLowerCase();
          return playersByHandle.has(handle);
        });

        console.log(`               📊 ${ourPlayersSubmissions.length} submission(s) from our players`);

        // Process each problem
        for (const problem of contestProbs) {
          if (problem.solvedBy) {
            console.log(`               ⏭️  Problem ${problem.problemIndex + 1} already solved, skipping`);
            continue;
          }

          console.log(`               🔍 Checking Problem ${problem.problemIndex + 1}: ${problem.contestId}${problem.problemIndexChar}`);

          let firstSolve = null;
          let firstSolveTime = null;

          // Check submissions for this specific problem
          const problemSubmissions = ourPlayersSubmissions.filter(sub => 
            sub.problem.index === problem.problemIndexChar
          );

          if (problemSubmissions.length === 0) {
            console.log(`                  ℹ️  No submissions for this problem yet`);
            continue;
          }

          console.log(`                  📝 Found ${problemSubmissions.length} submission(s) for this problem`);

          // Process each submission
          for (const sub of problemSubmissions) {
            const handle = sub.author.members[0].handle.toLowerCase();
            const player = playersByHandle.get(handle);

            if (!player) continue;

            const submissionTime = sub.creationTimeSeconds;
            const submissionDate = new Date(submissionTime * 1000);

            // Check if submission is within battle time window
            const isAfterBattleStart = submissionTime >= battleStartTime;
            const isBeforeBattleEnd = !battleEndTime || submissionTime <= battleEndTime;
            const isDuringBattle = isAfterBattleStart && isBeforeBattleEnd;

            if (!isDuringBattle) {
              const battleStart = new Date(battleStartTime * 1000).toLocaleTimeString();
              const battleEnd = battleEndTime ? new Date(battleEndTime * 1000).toLocaleTimeString() : 'ongoing';
              console.log(`                  ⏭️  ${player.username}'s submission at ${submissionDate.toLocaleTimeString()} is outside battle window (${battleStart} - ${battleEnd})`);
              continue;
            }

            console.log(`                  📝 ${player.username}: ${sub.verdict} at ${submissionDate.toLocaleTimeString()} (ID: ${sub.id})`);

            // Record attempt
            await this.recordAttempt(battle.id, player, problem.problemIndex, sub);

            // Check if this is an accepted solution
            if (sub.verdict === 'OK') {
              console.log(`                     ✅ ACCEPTED!`);

              // Track first solve
              if (!firstSolve || submissionTime < firstSolveTime) {
                firstSolve = {
                  player,
                  solveTime: submissionTime,
                  solveDate: submissionDate,
                  submission: sub,
                };
                firstSolveTime = submissionTime;
              }
            } else {
              console.log(`                     ❌ ${sub.verdict}`);
            }
          }

          // Award points to first solver
          if (firstSolve) {
            const solveTime = firstSolve.solveDate.toLocaleTimeString();
            console.log(`                  🏆 FIRST SOLVE by ${firstSolve.player.username} at ${solveTime}!`);

            results.push({
              problemIndex: problem.problemIndex,
              solvedBy: firstSolve.player.team,
              userId: firstSolve.player.userId,
              username: firstSolve.player.username,
              points: problem.points,
              solvedAt: firstSolve.solveDate,
            });

            // Mark as solved
            problem.solvedBy = firstSolve.player.team;
          }
        }

      } catch (error) {
        console.error(`               ❌ Failed to fetch submissions for contest ${contestId}:`, error.message);
      }
    }

    console.log(`            ✅ Contest polling complete`);
    return results;
  }

  /**
   * Record attempt in database
   */
  async recordAttempt(battleId, player, problemIndex, submission) {
    try {
      await prisma.teamBattleAttempt.create({
        data: {
          battleId,
          userId: player.userId,
          username: player.username,
          team: player.team,
          problemIndex,
          submissionId: submission.id,
          verdict: submission.verdict,
          timestamp: new Date(submission.creationTimeSeconds * 1000),
        },
      });
    } catch (error) {
      // Ignore duplicate errors (already recorded)
      if (!error.message.includes('Unique constraint')) {
        console.error('Error recording attempt:', error.message);
      }
    }
  }
}

module.exports = new TeamBattlePollingService();