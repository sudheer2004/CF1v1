# Team Battle System - Implementation Guide

## 🎯 Overview

Complete team battle system implementation for n vs m competitive programming battles (1-4 players per team).

## ✅ Features Implemented

- ✅ **Flexible Team Size**: 1-4 players per team (n vs m)
- ✅ **Point-Based Scoring**: Custom points per problem (default: 100)
- ✅ **Smart Polling**: min(users, problems) API optimization
- ✅ **API Queue Management**: Rate-limited Codeforces API calls
- ✅ **No Rating Changes**: Team battles don't affect ELO
- ✅ **Draw Detection**: Equal points when time expires = draw
- ✅ **All Problems Visible**: Everyone sees all problems from start
- ✅ **Custom Problem Selection**: Select problems with custom points

---

## 📁 Files Created

### New Files:
1. **`backend/controllers/teamBattle.controller.js`** - HTTP endpoints
2. **`backend/routes/teamBattle.routes.js`** - Route definitions
3. **`backend/socket/teamBattle.socket.js`** - WebSocket handlers

### Modified Files:
1. **`backend/server.js`** - Added team battle routes
2. **`backend/socket/socket.handler.js`** - Added team battle socket initialization
3. **`backend/services/codeforces.service.js`** - Added `selectRandomUnsolvedProblemForTeamBattle()`

---

## 🔌 API Endpoints

### HTTP Routes (REST API)

#### 1. Create Team Battle
```http
POST /api/team-battle/create
Authorization: Bearer <token>

Body:
{
  "duration": 60,              // minutes (15-180)
  "numProblems": 3,            // 1-6 problems
  "problems": [
    {
      "points": 100,           // 1-1000 points
      "useCustomLink": false,
      "rating": 1500,          // If not using range
      "useRange": false,
      "ratingMin": 1400,       // If using range
      "ratingMax": 1600,
      "minYear": 2020          // Optional
    }
  ]
}

Response:
{
  "success": true,
  "battle": {
    "id": "...",
    "battleCode": "ABC12345",  // 8-char code
    "duration": 60,
    "status": "waiting",
    "players": [],
    "problems": [...]
  }
}
```

#### 2. Get Team Battle
```http
GET /api/team-battle/:code
Authorization: Bearer <token>

Response:
{
  "success": true,
  "battle": {...},
  "stats": {
    "teamAScore": 200,
    "teamBScore": 100,
    "problemsSolved": {
      "teamA": 2,
      "teamB": 1
    }
  }
}
```

#### 3. Join Team Battle
```http
POST /api/team-battle/:code/join
Authorization: Bearer <token>

Response:
{
  "success": true,
  "battle": {...}
}
```

#### 4. Get Active Team Battle
```http
GET /api/team-battle/active
Authorization: Bearer <token>

Response:
{
  "success": true,
  "battle": {...} | null,
  "stats": {...} | null
}
```

#### 5. Leave Team Battle
```http
DELETE /api/team-battle/:id/leave
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Left battle successfully"
}
```

---

## 🔌 Socket.IO Events

### Client → Server Events

#### 1. create-team-battle
```javascript
socket.emit('create-team-battle', {
  duration: 60,
  numProblems: 3,
  problems: [...]
});

// Response: 'team-battle-created'
socket.on('team-battle-created', (data) => {
  console.log('Battle created:', data.battle);
});
```

#### 2. join-team-battle-room
```javascript
socket.emit('join-team-battle-room', {
  battleCode: 'ABC12345'
});

// Response: 'team-battle-state'
socket.on('team-battle-state', (data) => {
  console.log('Battle state:', data.battle);
});
```

#### 3. move-team-player (Creator only)
```javascript
socket.emit('move-team-player', {
  battleId: '...',
  userId: '...',
  newTeam: 'B',      // 'A' or 'B'
  newPosition: 2     // 0-3
});

// Broadcast: 'team-battle-updated'
```

#### 4. remove-team-player (Creator only)
```javascript
socket.emit('remove-team-player', {
  battleId: '...',
  targetUserId: '...'
});

// Broadcast: 'team-battle-updated'
// To removed player: 'removed-from-battle'
```

#### 5. start-team-battle (Creator only)
```javascript
socket.emit('start-team-battle', {
  battleId: '...'
});

// Broadcast: 'team-battle-preparing' (loading state)
// Then: 'team-battle-started'
```

#### 6. get-team-battle-update
```javascript
socket.emit('get-team-battle-update', {
  battleId: '...'
});

// Response: 'team-battle-update'
```

---

### Server → Client Events

#### 1. team-battle-created
```javascript
socket.on('team-battle-created', (data) => {
  // data.battle: Full battle object
});
```

#### 2. team-battle-state
```javascript
socket.on('team-battle-state', (data) => {
  // Current state of the battle
});
```

#### 3. team-battle-updated
```javascript
socket.on('team-battle-updated', (data) => {
  // Emitted when players join/move/leave
  // data.battle: Updated battle object
});
```

#### 4. team-battle-preparing
```javascript
socket.on('team-battle-preparing', (data) => {
  // Show loading screen
  // data.message: "Selecting problems from Codeforces..."
});
```

#### 5. team-battle-started
```javascript
socket.on('team-battle-started', (data) => {
  // data.battle: Battle with selected problems
  // data.startTime: ISO timestamp
  // data.endTime: ISO timestamp
});
```

#### 6. team-battle-update
```javascript
socket.on('team-battle-update', (data) => {
  // Real-time updates during battle
  // data.battle: Current state
  // data.stats: { teamAScore, teamBScore, ... }
  // data.newSolves: Array of recent solves (if any)
});
```

#### 7. team-battle-ended
```javascript
socket.on('team-battle-ended', (data) => {
  // data.battle: Final battle state
  // data.stats: Final scores
  // data.winningTeam: 'A' | 'B' | null (draw)
  // data.isDraw: boolean
});
```

#### 8. removed-from-battle
```javascript
socket.on('removed-from-battle', (data) => {
  // User was kicked from battle
  // data.battleId: Battle ID
  // data.message: "You have been removed..."
});
```

#### 9. player-joined-room
```javascript
socket.on('player-joined-room', (data) => {
  // Another player joined the socket room
  // data.userId: User ID
});
```

---

## 🧠 Smart Polling Strategy

The system uses an intelligent polling strategy to minimize Codeforces API calls:

```javascript
if (numPlayers <= numProblems) {
  // Strategy A: Fetch each player's submissions
  // Cost: numPlayers API calls (e.g., 8 calls for 8 players)
  
  for each player {
    fetchUserSubmissions(player.cfHandle, 50);
    // Check if they solved any unsolved problems
  }
  
} else {
  // Strategy B: Fetch contest standings
  // Cost: numUniqueContests API calls (usually 1-3)
  
  for each contest {
    fetchContestStandings(contestId, allPlayerHandles);
    // Check all players' progress at once
  }
}
```

### API Rate Limiting

All Codeforces API calls go through `cfApiQueue.service.js`:
- ✅ Queue-based request management
- ✅ 1 second minimum interval between requests
- ✅ Priority queue support
- ✅ 10-second caching to reduce duplicate calls
- ✅ Automatic retry on failure

---

## 🏆 Scoring System

### Winner Determination

```javascript
Team A Score = Σ (points of problems solved by Team A)
Team B Score = Σ (points of problems solved by Team B)

if (teamAScore > teamBScore) {
  winner = 'Team A';
} else if (teamBScore > teamAScore) {
  winner = 'Team B';
} else {
  winner = null;  // DRAW
}
```

### Example:

**Problems:**
- Problem 1: 100 points → Solved by Team A
- Problem 2: 200 points → Solved by Team B
- Problem 3: 300 points → Solved by Team A

**Result:**
- Team A: 100 + 300 = **400 points** ✅ WINNER
- Team B: 200 = **200 points**

---

## 🔄 Battle Flow

### 1. **Waiting Stage**
- Creator creates battle with problem configurations
- Players join using 8-character code
- Auto-assigned to teams (balanced)
- Creator can move players between slots
- Creator can remove players

### 2. **Starting Battle**
- Creator clicks "Start Battle"
- Server shows "Selecting problems..." loading screen
- System selects problems from Codeforces based on:
  - Rating/rating range
  - Custom links (if provided)
  - Min year filter
  - Avoiding problems players already attempted
- Problems are revealed to all players

### 3. **Active Battle**
- Polling starts (every 10 seconds by default)
- Server checks for new submissions
- Real-time updates sent to all players
- First to solve gets the points for their team
- Timer counts down

### 4. **Battle Ends When:**
- Time expires (automatic)
- All problems solved (automatic)
- Winner determined by total points

### 5. **Completed Battle**
- Final scores displayed
- Winner announced (or draw)
- No rating changes applied
- Battle data saved in database

---

## 📊 Database Schema (Already Exists)

### TeamBattle Table
```prisma
model TeamBattle {
  id            String   @id @default(uuid())
  battleCode    String   @unique
  creatorId     String
  duration      Int
  numProblems   Int
  status        String   @default("waiting")
  startTime     DateTime?
  endTime       DateTime?
  winningTeam   String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  players       TeamBattlePlayer[]
  problems      TeamBattleProblem[]
}
```

### TeamBattlePlayer Table
```prisma
model TeamBattlePlayer {
  id          String      @id @default(uuid())
  battleId    String
  userId      String
  username    String
  cfHandle    String
  rating      Int
  team        String      // "A" or "B"
  position    Int         // 0-3
  isCreator   Boolean     @default(false)
  createdAt   DateTime    @default(now())
  
  @@unique([battleId, userId])
}
```

### TeamBattleProblem Table
```prisma
model TeamBattleProblem {
  id            String      @id @default(uuid())
  battleId      String
  problemIndex  Int         // 0-5
  points        Int         @default(100)
  
  // Configuration
  useCustomLink Boolean     @default(false)
  customLink    String?
  rating        Int?
  useRange      Boolean     @default(false)
  ratingMin     Int?
  ratingMax     Int?
  minYear       Int?
  
  // Selected problem
  contestId     Int?
  problemIndexChar String?
  problemName   String?
  problemRating Int?
  problemUrl    String?
  
  // Solve status
  solvedBy      String?     // "A" or "B"
  solvedByUserId String?
  solvedByUsername String?
  solvedAt      DateTime?
  
  @@unique([battleId, problemIndex])
}
```

---

## 🧪 Testing the Implementation

### 1. Start the server
```bash
cd backend
npm run dev
```

### 2. Test HTTP Endpoints

```bash
# Get JWT token first
TOKEN="your_jwt_token_here"

# Create a battle
curl -X POST http://localhost:5000/api/team-battle/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "duration": 60,
    "numProblems": 2,
    "problems": [
      {"points": 100, "rating": 1500, "useRange": false, "useCustomLink": false},
      {"points": 200, "rating": 1600, "useRange": false, "useCustomLink": false}
    ]
  }'

# Get active battle
curl -X GET http://localhost:5000/api/team-battle/active \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Test Socket.IO Events

Use a Socket.IO client or test from frontend:

```javascript
const socket = io('http://localhost:5000');

// Authenticate
socket.emit('authenticate', 'your_jwt_token');

socket.on('authenticated', () => {
  // Create battle
  socket.emit('create-team-battle', {
    duration: 60,
    numProblems: 2,
    problems: [...]
  });
});

socket.on('team-battle-created', (data) => {
  console.log('Battle code:', data.battle.battleCode);
});
```

---

## 🚀 Frontend Integration Guide

### 1. Navigation Update

Update your navbar to show team battle option:

```jsx
// In Navbar component
<div className="duel-mode-dropdown">
  <button>Duel Mode</button>
  <div className="dropdown">
    <Link to="/duel">Normal 1v1</Link>
    <Link to="/team-battle">Team Battle</Link>
  </div>
</div>
```

### 2. Create Team Battle Page

```jsx
import { useState } from 'react';
import { useSocket } from './hooks/useSocket';

function CreateTeamBattle() {
  const socket = useSocket();
  const [problems, setProblems] = useState([
    { points: 100, rating: 1500, useRange: false, useCustomLink: false }
  ]);

  const createBattle = () => {
    socket.emit('create-team-battle', {
      duration: 60,
      numProblems: problems.length,
      problems
    });
  };

  socket.on('team-battle-created', (data) => {
    // Redirect to battle room
    navigate(`/team-battle/${data.battle.battleCode}`);
  });

  return (
    <div>
      {/* Problem configuration UI */}
      <button onClick={createBattle}>Create Battle</button>
    </div>
  );
}
```

### 3. Team Battle Room Page

```jsx
function TeamBattleRoom({ battleCode }) {
  const socket = useSocket();
  const [battle, setBattle] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    socket.emit('join-team-battle-room', { battleCode });

    socket.on('team-battle-state', (data) => {
      setBattle(data.battle);
    });

    socket.on('team-battle-updated', (data) => {
      setBattle(data.battle);
    });

    socket.on('team-battle-preparing', (data) => {
      // Show loading screen
    });

    socket.on('team-battle-started', (data) => {
      setBattle(data.battle);
      // Start timer with data.endTime
    });

    socket.on('team-battle-update', (data) => {
      setBattle(data.battle);
      setStats(data.stats);
    });

    socket.on('team-battle-ended', (data) => {
      // Show results screen
    });
  }, [socket, battleCode]);

  return (
    <div>
      {/* Battle UI */}
    </div>
  );
}
```

---

## ⚠️ Important Notes

1. **No Rating Changes**: Team battles do NOT affect user ELO ratings
2. **CF Handle Required**: Users must have linked Codeforces handle to join
3. **First Solve Wins**: If Team A solves Problem 1 first, they get the points (Team B cannot steal it)
4. **All Problems Visible**: Unlike 1v1, all problems are visible to everyone from the start
5. **Minimum Players**: At least 1 player per team required to start
6. **Maximum Players**: 4 players per team (8 total)
7. **Custom Links**: Support for external problem links (not just Codeforces)

---

## 🐛 Troubleshooting

### Issue: "Battle not found"
- Check if battle code is exactly 8 characters
- Verify battle hasn't been deleted

### Issue: Polling not working
- Check `SUBMISSION_POLL_INTERVAL_SECONDS` env variable (default: 10)
- Verify Codeforces API is accessible
- Check server logs for API errors

### Issue: Problems not being selected
- Ensure all players have valid CF handles
- Check rating range isn't too narrow
- System will automatically fallback to wider ranges

### Issue: Socket events not received
- Verify user is authenticated (`socket.userId` set)
- Check if user joined the socket room
- Ensure event names match exactly

---

## 📝 Environment Variables

Add to your `.env` file:

```env
SUBMISSION_POLL_INTERVAL_SECONDS=10    # Polling interval
CODEFORCES_API_URL=https://codeforces.com/api
```

---

## ✅ Implementation Checklist

- [x] Team battle controller
- [x] Team battle routes
- [x] Team battle socket handlers
- [x] Problem selection for team battles
- [x] Smart polling strategy
- [x] API queue management
- [x] Score calculation
- [x] Draw detection
- [x] Server integration
- [x] Syntax validation

---

## 🎉 Summary

You now have a fully functional team battle system with:

✅ HTTP REST API endpoints
✅ Real-time WebSocket communication
✅ Smart polling optimization
✅ Point-based scoring
✅ Draw detection
✅ No rating changes
✅ Flexible team sizes (1-4 per team)
✅ Custom problem points
✅ Rate-limited API calls

**Next Steps:**
1. Update frontend to consume these APIs
2. Add UI for creating team battles
3. Add UI for joining team battles
4. Add real-time battle room UI
5. Test with multiple users

Good luck! 🚀
