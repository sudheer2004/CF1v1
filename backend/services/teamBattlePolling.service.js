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

    for (const problem of problems) {
      if (problem.solvedBy) continue;

      console.log(`               🔍 Checking Problem ${problem.problemIndex + 1}: ${problem.contestId}${problem.problemIndexChar}`);

      let firstSolveRecorded = false;

      for (let i = 0; i < validPlayers.length; i++) {
        const player = validPlayers[i];
        const submissions = allSubmissions[i] || [];

        const relevantSubmissions = submissions.filter(sub => 
          sub.problem.contestId === problem.contestId &&
          sub.problem.index === problem.problemIndexChar &&
          sub.creationTimeSeconds >= battleStartTime &&
          (!battleEndTime || sub.creationTimeSeconds <= battleEndTime)
        );

        if (relevantSubmissions.length > 0) {
          console.log(`                  📝 ${player.username}: ${relevantSubmissions.length} attempt(s)`);
        }

        for (const sub of relevantSubmissions) {
          await this.recordAttempt(battle.id, player, problem.problemIndex, sub);

          if (!firstSolveRecorded && sub.verdict === 'OK') {
            // Atomic first solve recording
            const updated = await prisma.teamBattleProblem.updateMany({
              where: {
                battleId: battle.id,
                problemIndex: problem.problemIndex,
                solvedBy: null
              },
              data: {
                solvedBy: player.team,
                solvedByUserId: player.userId,
                solvedByUsername: player.username,
                solvedAt: new Date(sub.creationTimeSeconds * 1000)
              }
            });

            if (updated.count > 0) {
              firstSolveRecorded = true;
              console.log(`                  🏆 FIRST SOLVE by ${player.username}!`);
              results.push({
                problemIndex: problem.problemIndex,
                solvedBy: player.team,
                userId: player.userId,
                username: player.username,
                points: problem.points,
                solvedAt: new Date(sub.creationTimeSeconds * 1000),
              });
            }
          }
        }
      }
    }

    console.log(`            ✅ Player polling complete`);
    return results;
  }

  /**
   * Poll by fetching contest submissions (NEW APPROACH)
   */
  async pollByProblems(battle, players, problems) {
    console.log(`         ┌─────────────────────────────────┐`);
    console.log(`         │ Fetching Contest Submissions    │`);
    console.log(`         └─────────────────────────────────┘`);

    const battleStartTime = Math.floor(new Date(battle.startTime).getTime() / 1000);
    const battleEndTime = battle.endTime ? Math.floor(new Date(battle.endTime).getTime() / 1000) : null;
    
    const contestProblems = new Map();
    problems.forEach(problem => {
      if (!problem.solvedBy && problem.contestId) {
        if (!contestProblems.has(problem.contestId)) contestProblems.set(problem.contestId, []);
        contestProblems.get(problem.contestId).push(problem);
      }
    });

    console.log(`            Contests to poll: ${contestProblems.size}`);

    const results = [];
    const validPlayers = players.filter(p => p.cfHandle && p.cfHandle.trim());

    if (validPlayers.length === 0) return [];

    const playersByHandle = new Map();
    validPlayers.forEach(p => playersByHandle.set(p.cfHandle.toLowerCase(), p));

    for (const [contestId, contestProbs] of contestProblems.entries()) {
      try {
        console.log(`            🌐 Fetching recent submissions for contest ${contestId}...`);

        const submissions = await cfApiQueue.request('contest.status', {
          contestId,
          from: 1,
          count: 100,
        }, 0, false);

        if (!submissions || submissions.length === 0) continue;

        const ourPlayersSubmissions = submissions.filter(sub => {
          const member = sub.author.members?.[0];
          return member && playersByHandle.has(member.handle.toLowerCase());
        });

        for (const problem of contestProbs) {
          if (problem.solvedBy) continue;

          let firstSolveRecorded = false;

          const problemSubmissions = ourPlayersSubmissions.filter(sub => sub.problem.index === problem.problemIndexChar);

          for (const sub of problemSubmissions) {
            const member = sub.author.members?.[0];
            if (!member) continue;

            const player = playersByHandle.get(member.handle.toLowerCase());
            if (!player) continue;

            const submissionTime = sub.creationTimeSeconds;
            if (submissionTime < battleStartTime || (battleEndTime && submissionTime > battleEndTime)) continue;

            await this.recordAttempt(battle.id, player, problem.problemIndex, sub);

            if (!firstSolveRecorded && sub.verdict === 'OK') {
              const updated = await prisma.teamBattleProblem.updateMany({
                where: {
                  battleId: battle.id,
                  problemIndex: problem.problemIndex,
                  solvedBy: null
                },
                data: {
                  solvedBy: player.team,
                  solvedByUserId: player.userId,
                  solvedByUsername: player.username,
                  solvedAt: new Date(submissionTime * 1000)
                }
              });

              if (updated.count > 0) {
                firstSolveRecorded = true;
                results.push({
                  problemIndex: problem.problemIndex,
                  solvedBy: player.team,
                  userId: player.userId,
                  username: player.username,
                  points: problem.points,
                  solvedAt: new Date(submissionTime * 1000),
                });
                console.log(`                  🏆 FIRST SOLVE by ${player.username}!`);
              }
            }
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
   * Record attempt in database (avoiding duplicate writes)
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
      if (!error.message.includes('Unique constraint')) {
        console.error('Error recording attempt:', error.message);
      }
    }
  }
}

module.exports = new TeamBattlePollingService();
