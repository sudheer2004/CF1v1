import React, { useState, useEffect, useRef } from 'react';
import { Loader } from 'lucide-react';
import AuthPage from './components/AuthPage';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import Matchmaking from './components/Matchmaking';
import DuelMode from './components/DuelMode';
import TeamBattle from './components/TeamBattle';
import Leaderboard from './components/Leaderboard';
import Profile from './components/Profile';
import ReportIssues from './components/ReportIssues';
import api from './services/api.service';
import socketService from './services/socket.service';

const isDev = import.meta.env.MODE === 'development';
const devLog = (...args) => {
  if (isDev) console.log(...args);
};

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login');
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [socketReady, setSocketReady] = useState(false);
  const [activeMatch, setActiveMatch] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [matchTimer, setMatchTimer] = useState(0);
  const [matchAttempts, setMatchAttempts] = useState({ player1: 0, player2: 0 });
  const [error, setError] = useState(null);

  const matchEndHandledRef = useRef(false);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Handle Google OAuth callback
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const authError = urlParams.get('error');

      if (token) {
        localStorage.setItem('token', token);
        window.history.replaceState({}, document.title, window.location.pathname);
        
        try {
          const response = await api.getCurrentUser();
          setUser(response.data.user);
          
          try {
            const matchResponse = await api.getActiveMatch();
            if (matchResponse.match && matchResponse.match.endTime) {
              devLog('📥 OAuth: Restored match with endTime:', matchResponse.match.endTime);
              
              setActiveMatch({
                match: matchResponse.match,
                opponent: matchResponse.opponent,
                problemUrl: matchResponse.problemUrl,
              });
              setMatchAttempts(matchResponse.attempts);
              setView('matchmaking');
            } else {
              setView('dashboard');
            }
          } catch (err) {
            devLog('⚠️ OAuth: No active match found');
            setView('dashboard');
          }
          
          setLoading(false);
        } catch (err) {
          console.error('Failed to load user data:', err);
          setError('Failed to load user data');
          localStorage.removeItem('token');
          setLoading(false);
        }
      } else if (authError) {
        console.error('OAuth error:', authError);
        setError('Authentication failed. Please try again.');
        window.history.replaceState({}, document.title, window.location.pathname);
        setLoading(false);
      }
    };

    handleOAuthCallback();
  }, []);

  // Initialize socket connection
  useEffect(() => {
    const initializeSocket = async () => {
      const token = localStorage.getItem('token');
      if (!token || !user) {
        setSocketReady(false);
        return;
      }

      try {
        const newSocket = socketService.connect();
        setSocket(newSocket);
        
        const waitForConnection = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Socket connection timeout'));
          }, 10000);

          if (newSocket.connected) {
            clearTimeout(timeout);
            resolve();
          } else {
            const onConnect = () => {
              clearTimeout(timeout);
              newSocket.off('connect', onConnect);
              resolve();
            };
            newSocket.on('connect', onConnect);
          }
        });

        await waitForConnection;
        await socketService.authenticate(token);
        setSocketReady(true);
        
        newSocket.on('disconnect', (reason) => {
          setSocketReady(false);
          if (reason === 'io server disconnect') {
            newSocket.connect();
          }
        });

        newSocket.on('connect', () => {
          socketService.authenticate(token).then(() => {
            setSocketReady(true);
          }).catch(err => {
            console.error('Re-authentication failed:', err);
            setSocketReady(false);
          });
        });

      } catch (error) {
        console.error('Socket initialization error:', error);
        setError('Failed to connect to server. Please refresh the page.');
        setSocketReady(false);
      }
    };

    initializeSocket();
  }, [user]);

  // Monitor socket connection status
  useEffect(() => {
    if (!user) return;

    const checkInterval = setInterval(() => {
      const isConnected = socketService.isConnected();
      const isAuthenticated = socketService.isAuthenticated();
      setSocketReady(isConnected && isAuthenticated);
    }, 3000);

    return () => clearInterval(checkInterval);
  }, [user]);

  // Poll for active match (fallback)
  useEffect(() => {
    if (!user || activeMatch || matchResult) return;
    if (view !== 'matchmaking' && view !== 'duel') return;
    
    const pollInterval = setInterval(async () => {
      try {
        const matchResponse = await api.getActiveMatch();
        
        // ✅ NEW: Check for endTime instead of remainingTime
        if (matchResponse.match && matchResponse.match.endTime) {
          
          setActiveMatch({
            match: matchResponse.match,
            opponent: matchResponse.opponent,
            problemUrl: matchResponse.problemUrl,
          });
          
          setMatchAttempts(matchResponse.attempts);
          
          if (view !== 'matchmaking' && view !== 'duel') {
            setView('matchmaking');
          }
        }
      } catch (err) {
        // No active match
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [user, activeMatch, matchResult, view]);

  // ============================================
  // 🔥 INDUSTRY STANDARD TIMER (endTime-based)
  // ============================================
  useEffect(() => {
    if (!activeMatch?.match?.endTime) {
      setMatchTimer(0);
      return;
    }

    matchEndHandledRef.current = false;

    // Calculate remaining time from server's endTime
    const calculateRemaining = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((activeMatch.match.endTime - now) / 1000));
      return remaining;
    };

    // Set initial timer
    setMatchTimer(calculateRemaining());
    
  

    // Update every second
    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setMatchTimer(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeMatch?.match?.endTime]);

  // Handle timer expiry
  useEffect(() => {
    if (!activeMatch || matchResult || matchEndHandledRef.current) return;
    
    if (matchTimer === 0) {
      matchEndHandledRef.current = true;
      
     
      
      const timeoutId = setTimeout(() => {
        setMatchResult({
          won: false,
          draw: true,
          ratingChange: 0,
          newRating: user.rating,
          opponentRatingChange: 0,
          opponent: activeMatch.opponent,
          problem: activeMatch.match.problemName,
          problemRating: activeMatch.match.problemRating,
        });
        setActiveMatch(null);
        setMatchTimer(0);
        setError('Match timed out. The server may have had an issue.');
        
        setTimeout(() => {
          setMatchResult(null);
          setView('dashboard');
          setError(null);
        }, 5000);
      }, 10000);

      return () => clearTimeout(timeoutId);
    }
  }, [matchTimer, activeMatch, matchResult, user]);

  // Sync attempts periodically (no timer syncing needed!)
  useEffect(() => {
    if (!activeMatch || !user) return;

    const syncInterval = setInterval(async () => {
      try {
        const matchResponse = await api.getActiveMatch();
        
        if (matchResponse.match && matchResponse.match.id === activeMatch.match.id) {
          // Only update attempts, timer handles itself via endTime
          setMatchAttempts(matchResponse.attempts);
          
         
        }
      } catch (err) {
        // Ignore sync errors
      }
    }, 20000);

    return () => clearInterval(syncInterval);
  }, [activeMatch?.match?.id, user]);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const response = await api.getCurrentUser();
        setUser(response.data.user);
        
        try {
          const matchResponse = await api.getActiveMatch();
          
          // ✅ NEW: Check for endTime instead of remainingTime
          if (matchResponse.match && matchResponse.match.endTime) {
            devLog('📥 Auth: Restored match with endTime:', matchResponse.match.endTime);
            
            setActiveMatch({
              match: matchResponse.match,
              opponent: matchResponse.opponent,
              problemUrl: matchResponse.problemUrl,
            });
            
            setMatchAttempts(matchResponse.attempts);
            setView('matchmaking');
          } else {
            setView('dashboard');
          }
        } catch (err) {
          devLog('⚠️ Auth: No active match found');
          setView('dashboard');
        }
      } catch (err) {
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  };

  const handleLogout = () => {
    if (socket) {
      socketService.disconnect();
      setSocket(null);
      setSocketReady(false);
    }
    
    localStorage.removeItem('token');
    setUser(null);
    setView('login');
    setActiveMatch(null);
    setMatchResult(null);
    setMatchTimer(0);
    setMatchAttempts({ player1: 0, player2: 0 });
    setError(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <Loader className="w-12 h-12 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {user && !socketReady && (
        <div className="fixed top-20 right-4 bg-yellow-500/20 border border-yellow-500 text-yellow-300 px-4 py-2 rounded-lg shadow-lg z-50 flex items-center space-x-2">
          <Loader className="w-4 h-4 animate-spin" />
          <span className="text-sm">Connecting to server...</span>
        </div>
      )}

      {error && (
        <div className="fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-md">
          <p className="text-sm">{error}</p>
          <button 
            onClick={() => setError(null)}
            className="text-xs underline mt-1"
          >
            Dismiss
          </button>
        </div>
      )}
      
      {user ? (
        <>
          <Navbar user={user} view={view} setView={setView} onLogout={handleLogout} />
          <main className="container mx-auto px-4 py-8 max-w-7xl">
            {view === 'dashboard' && <Dashboard user={user} setView={setView} />}
            {view === 'matchmaking' && (
              <Matchmaking 
                user={user} 
                socket={socket}
                socketReady={socketReady}
                activeMatch={activeMatch}
                setActiveMatch={setActiveMatch}
                matchResult={matchResult}
                setMatchResult={setMatchResult}
                matchTimer={matchTimer}
                setMatchTimer={setMatchTimer}
                matchAttempts={matchAttempts}
                setMatchAttempts={setMatchAttempts}
              />
            )}
            {view === 'duel' && (
              <DuelMode
                user={user}
                socket={socket}
                socketReady={socketReady}
                activeMatch={activeMatch}
                setActiveMatch={setActiveMatch}
                matchResult={matchResult}
                setMatchResult={setMatchResult}
                matchTimer={matchTimer}
                setMatchTimer={setMatchTimer}
                matchAttempts={matchAttempts}
                setMatchAttempts={setMatchAttempts}
              />
            )}
            {view === 'team-battle' && (
              <TeamBattle
                user={user}
                socket={socket}
                socketReady={socketReady}
              />
            )}
            {view === 'leaderboard' && <Leaderboard />}
            {view === 'profile' && <Profile user={user} setUser={setUser} />}
            {view === 'report-issues' && <ReportIssues user={user} />}
          </main>
        </>
      ) : (
        <AuthPage setUser={setUser} setView={setView} />
      )}
    </div>
  );
}