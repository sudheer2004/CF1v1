# CodeForces Competitive Duel Platform

A full-stack web application for competitive programming enthusiasts to engage in 1v1 duels and team battles using real problems from Codeforces. Players compete by solving problems, with rankings and statistics tracked in real-time.

## 🎯 Features

### Core Gameplay
- **1v1 Duels**: Head-to-head competitive matches against other players
- **Team Battles**: Multiplayer team-based competitions with point-based scoring
- **Real Codeforces Problems**: Integrated with Codeforces API for authentic problem sets
- **Live Matchmaking**: Real-time player matching and battle initiation
- **WebSocket Integration**: Live updates and real-time notifications

### User System
- **Authentication**: JWT-based auth with Google OAuth 2.0 support
- **User Profiles**: Track stats, rating, and match history
- **Leaderboards**: Global and category-based rankings
- **Rating System**: Dynamic rating calculations similar to Codeforces

### Battle Features
- **Smart Polling**: Optimized API usage based on player count
- **Timed Matches**: Configurable match durations
- **Problem Selection**: Difficulty-based problem selection for fair gameplay
- **Scoring System**: Point-based scoring with customizable multipliers
- **Real-time Chat**: In-battle messaging between competitors

## 📋 Tech Stack

### Frontend
- **Framework**: React 19 with Vite
- **Styling**: Tailwind CSS
- **Real-time Communication**: Socket.io Client
- **Icons**: Lucide React
- **Email**: EmailJS for notifications
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Passport.js (JWT + Google OAuth)
- **Real-time**: Socket.io
- **Security**: Helmet, CORS, Rate Limiting, Input Validation
- **API Integration**: Axios for Codeforces API

### Key Dependencies
- `@prisma/client` - Database ORM
- `express` - Web framework
- `jsonwebtoken` - JWT authentication
- `passport` - Authentication middleware
- `socket.io` - Real-time communication
- `bcryptjs` - Password hashing
- `express-validator` - Input validation
- `express-rate-limit` - Rate limiting

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- PostgreSQL database
- Codeforces API access

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd CF1v1
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   ```

3. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   ```

### Environment Configuration

Create `.env` file in the `backend` directory:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/codeforces_duel

# JWT
JWT_SECRET=your-secret-key-at-least-32-characters

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Codeforces API
CF_API_BASE_URL=https://codeforces.com/api
```

### Database Migration

```bash
cd backend
npm run prisma:migrate
npm run prisma:generate
```

### Running the Application

**Terminal 1 - Backend Server**
```bash
cd backend
npm run dev
```
Server runs on `http://localhost:5000`

**Terminal 2 - Frontend Dev Server**
```bash
cd frontend
npm run dev
```
Frontend runs on `http://localhost:5173`

## 📂 Project Structure

```
CF1v1/
├── backend/
│   ├── config/               # Configuration files
│   │   ├── database.config.js
│   │   └── passport.config.js
│   ├── controllers/          # Route handlers
│   │   ├── auth.controller.js
│   │   ├── duel.controller.js
│   │   ├── matchmaking.controller.js
│   │   ├── teamBattle.controller.js
│   │   └── ...
│   ├── routes/              # API route definitions
│   ├── services/            # Business logic
│   │   ├── codeforces.service.js
│   │   ├── matchmaking.service.js
│   │   ├── teamBattle.service.js
│   │   ├── cfApiQueue.service.js
│   │   └── ...
│   ├── middlewares/         # Express middleware
│   ├── prisma/              # Database schema and migrations
│   ├── socket/              # WebSocket handlers
│   ├── validators/          # Input validation
│   ├── utils/               # Utility functions
│   ├── server.js            # Express app setup
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── Dashboard.jsx
│   │   │   ├── DuelMode.jsx
│   │   │   ├── TeamBattle.jsx
│   │   │   ├── Matchmaking.jsx
│   │   │   ├── Leaderboard.jsx
│   │   │   ├── AuthPage.jsx
│   │   │   ├── Profile.jsx
│   │   │   └── ...
│   │   ├── hooks/           # Custom React hooks
│   │   │   ├── useMatchManager.js
│   │   │   ├── useTeamBattleSocket.js
│   │   │   ├── useBattleTimer.js
│   │   │   └── ...
│   │   ├── services/        # API & Socket services
│   │   ├── utils/           # Utility functions
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── eslint.config.js
│   └── package.json
│
└── README.md
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/google` - Google OAuth authentication
- `GET /api/auth/verify` - Verify JWT token
- `POST /api/auth/logout` - Logout user

### Matchmaking
- `POST /api/matchmaking/find` - Find opponent for 1v1 duel
- `POST /api/matchmaking/cancel` - Cancel matchmaking search
- `GET /api/matchmaking/status` - Get matchmaking status

### Duel/Matches
- `GET /api/duel/match/:id` - Get match details
- `POST /api/duel/submit` - Submit solution
- `GET /api/duel/result/:id` - Get match result
- `GET /api/match/history` - Get user's match history

### Team Battle
- `POST /api/team-battle/create` - Create new team battle
- `POST /api/team-battle/:code/join` - Join team battle
- `GET /api/team-battle/active` - Get user's active battle
- `GET /api/team-battle/:code` - Get battle details
- `DELETE /api/team-battle/:id/leave` - Leave team battle

### User Profile
- `GET /api/profile/:userId` - Get user profile
- `PUT /api/profile` - Update user profile
- `GET /api/profile/stats` - Get user statistics

### Leaderboard
- `GET /api/leaderboard` - Get global leaderboard
- `GET /api/leaderboard/rating` - Get rating-based leaderboard

## 🔌 WebSocket Events

### Team Battle Events
**Client → Server:**
- `create-team-battle` - Create a new team battle
- `join-team-battle-room` - Join a team battle
- `start-team-battle` - Start the battle
- `get-team-battle-update` - Request battle state update
- `move-team-player` - Update player position
- `remove-team-player` - Remove player from battle

**Server → Client:**
- `team-battle-created` - Battle created successfully
- `team-battle-state` - Current battle state
- `team-battle-updated` - Battle state changed
- `team-battle-started` - Battle has started
- `team-battle-ended` - Battle has ended
- `removed-from-battle` - User removed from battle

## 🎮 Gameplay Flow

### 1v1 Duel
1. User initiates matchmaking
2. System finds opponent with similar rating
3. Problem is selected and fetched from Codeforces
4. Both players see problem and timer starts
5. Players submit solutions
6. Results are calculated and ratings updated

### Team Battle
1. Team leader creates a battle and shares code
2. Team members join using the code
3. Leader selects problem difficulty
4. System fetches different problems for each player
5. All players solve simultaneously
6. Team with most points wins
7. Ratings updated for all participants

## 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Helmet.js**: Security headers protection
- **CORS**: Cross-Origin Resource Sharing configuration
- **Input Validation**: Express-validator for all inputs
- **Rate Limiting**: Protection against brute force attacks
- **Password Hashing**: bcryptjs for secure password storage
- **SQL Injection Prevention**: Prisma parameterized queries
- **XSS Protection**: Content Security Policy headers

## 📊 Database Schema

Key tables:
- **Users**: User accounts and profiles
- **Matches**: 1v1 match records
- **TeamBattles**: Team battle sessions
- **TeamBattleParticipants**: Team battle members
- **UserRatings**: Rating history and statistics
- **Problems**: Cached Codeforces problems
- **Submissions**: User submissions

See `backend/prisma/schema.prisma` for complete schema.

## 📈 Performance Optimization

- **Smart API Polling**: Optimized Codeforces API calls based on player count
- **API Queue System**: Rate-limited queue for API requests
- **WebSocket Optimization**: Efficient real-time updates
- **Database Indexing**: Optimized queries via Prisma
- **Frontend Optimization**: Vite for fast builds

## 🛠️ Development

### Backend Development
```bash
cd backend
npm run dev          # Start with nodemon
npm run prisma:studio  # Open Prisma Studio
npm run prisma:migrate # Run migrations
```

### Frontend Development
```bash
cd frontend
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

## 📝 Scripts

### Backend
- `npm start` - Start production server
- `npm run dev` - Start with hot reload
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open database GUI

### Frontend
- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Reset database (development only)
cd backend
npm run prisma:migrate -- --reset
```

### Port Already in Use
```bash
# Change port in .env
PORT=5001
```

### WebSocket Connection Failures
- Ensure backend is running on correct port
- Check CORS configuration matches frontend URL
- Verify firewall allows WebSocket connections

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details

## 👥 Author

Created by the CF1v1 development team

## 📞 Support

For issues and feature requests, please open an issue on the repository.

---

**Last Updated**: January 2026
