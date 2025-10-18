const API_URL = import.meta.env.VITE_API_URL;

class ApiService {
  async call(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Auth endpoints
  async signup(email, password, username, cfHandle) {
    return this.call('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, username, cfHandle }),
    });
  }

  async login(email, password) {
    return this.call('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getCurrentUser() {
    return this.call('/auth/me');
  }

  async checkUsername(username) {
    return this.call(`/auth/check-username/${username}`);
  }

  async checkEmail(email) {
    return this.call(`/auth/check-email/${encodeURIComponent(email)}`);
  }

  // Profile endpoints
  async getProfile(userId = 'me') {
    return this.call(`/profile/${userId}`);
  }

  async updateCfHandle(cfHandle) {
    return this.call('/profile/cfhandle', {
      method: 'PUT',
      body: JSON.stringify({ cfHandle }),
    });
  }

  async getMatchHistory(userId, limit = 20, offset = 0) {
    return this.call(`/profile/${userId}/matches?limit=${limit}&offset=${offset}`);
  }

  // Matchmaking endpoints
  async joinQueue(data) {
    return this.call('/matchmaking/join', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async leaveQueue() {
    return this.call('/matchmaking/leave', {
      method: 'POST',
    });
  }

  async getQueueStatus() {
    return this.call('/matchmaking/status');
  }

  // Duel endpoints
  async createDuel(data) {
    return this.call('/duel/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async joinDuel(duelCode) {
    return this.call(`/duel/join/${duelCode}`, {
      method: 'POST',
    });
  }

  async getDuel(duelCode) {
    return this.call(`/duel/${duelCode}`);
  }

  async cancelDuel(duelId) {
    return this.call(`/duel/${duelId}/cancel`, {
      method: 'POST',
    });
  }

  // Match endpoints
  async getActiveMatch() {
    return this.call('/matches/active');
  }

  async getMatch(matchId) {
    return this.call(`/matches/${matchId}`);
  }

  async getMatchHistoryForUser() {
    return this.call('/matches/history');
  }

  // Leaderboard endpoints
  async getLeaderboard(limit = 100, offset = 0) {
    return this.call(`/leaderboard?limit=${limit}&offset=${offset}`);
  }
   async getActiveTeamBattle() {
    return this.call('/team-battle/active');
  }

  async joinTeamBattle(battleCode) {
    return this.call(`/team-battle/${battleCode}/join`, {
      method: 'POST',
    });
  }

async leaveTeamBattle(battleId) {
  console.log('🌐 API: Calling leave team battle endpoint:', battleId);
  
  const response = await this.call(`/team-battle/${battleId}/leave`, {
    method: 'DELETE',
  });
  
  console.log('🌐 API: Raw response received:', response);
  console.log('🌐 API: Response type:', typeof response);
  console.log('🌐 API: Response keys:', Object.keys(response));
  console.log('🌐 API: teamEliminated value:', response.teamEliminated);
  console.log('🌐 API: teamEliminated type:', typeof response.teamEliminated);
  
  return response;
}

  async getTeamBattle(battleCode) {
    return this.call(`/team-battle/${battleCode}`);
  }
}
 
export default new ApiService();