import React, { useState, useEffect, useRef } from 'react';
import { Loader } from 'lucide-react';
import AuthPage from './components/AuthPage';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import Matchmaking from './components/Matchmaking';
import DuelMode from './components/DuelMode';
import Leaderboard from './components/Leaderboard';
import Profile from './components/Profile';
import api from './services/api.service';
import socketService from './services/socket.service';

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

  // CRITICAL: Store the actual server timestamp for accurate time calculation
  const matchStartTimeRef = useRef(null);
  const matchDurationRef = useRef(null);
  const timerIntervalRef = useRef(null);
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
        console.log('✅ Google OAuth token received');
        
        localStorage.setItem('token', token);
        window.history.replaceState({}, document.title, window.location.pathname);
        
        try {
          const response = await api.getCurrentUser();
          setUser(response.data.user);
          
          try {
            const matchResponse = await api.getActiveMatch();
            if (matchResponse.match && matchResponse.remainingTime > 0) {
              console.log('✅ Restoring active match');
              
              // Store server timestamps
              matchStartTimeRef.current = new Date(matchResponse.match.startedAt).getTime();
              matchDurationRef.current = matchResponse.match.duration * 60;
              
              setActiveMatch({
                match: matchResponse.match,
                opponent: matchResponse.opponent,
                problemUrl: matchResponse.problemUrl,
              });
              setMatchTimer(matchResponse.remainingTime);
              setMatchAttempts(matchResponse.attempts);
              setView('matchmaking');
            } else {
              setView('dashboard');
            }
          } catch (err) {
            console.log('No active match found');
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

  // Initialize socket connection when user is authenticated
  useEffect(() => {
    const initializeSocket = async () => {
      const token = localStorage.getItem('token');
      if (!token || !user) {
        console.log('⏭️ No token or user, skipping socket connection');
        setSocketReady(false);
        return;
      }

      try {
        console.log('🔌 Initializing socket connection...');
        
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
        console.log('✅ Socket connected, authenticating...');
        
        await socketService.authenticate(token);
        console.log('✅ Socket authenticated successfully');
        
        setSocketReady(true);
        
        newSocket.on('disconnect', (reason) => {
          console.log('❌ Socket disconnected:', reason);
          setSocketReady(false);
          
          if (reason === 'io server disconnect') {
            console.log('🔄 Attempting to reconnect...');
            newSocket.connect();
          }
        });

        newSocket.on('connect', () => {
          console.log('✅ Socket reconnected');
          socketService.authenticate(token).then(() => {
            console.log('✅ Re-authenticated after reconnection');
            setSocketReady(true);
          }).catch(err => {
            console.error('❌ Re-authentication failed:', err);
            setSocketReady(false);
          });
        });

      } catch (error) {
        console.error('❌ Socket initialization error:', error);
        setError('Failed to connect to server. Please refresh the page.');
        setSocketReady(false);
      }
    };

    initializeSocket();
  }, [user]);

  // Monitor socket connection status periodically
  useEffect(() => {
    if (!user) return;

    const checkInterval = setInterval(() => {
      const isConnected = socketService.isConnected();
      const isAuthenticated = socketService.isAuthenticated();
      
      setSocketReady(isConnected && isAuthenticated);
      
      if (!isConnected) {
        console.log('⚠️ Socket not connected, checking status...');
      }
    }, 3000);

    return () => clearInterval(checkInterval);
  }, [user]);

  // FALLBACK: Poll for active match if waiting in queue/duel for too long
  useEffect(() => {
    if (!user || activeMatch || matchResult) return;

    if (view !== 'matchmaking' && view !== 'duel') return;

    console.log('🔄 Starting fallback match checker...');
    
    const pollInterval = setInterval(async () => {
      try {
        const matchResponse = await api.getActiveMatch();
        
        if (matchResponse.match && matchResponse.remainingTime > 0) {
          console.log('✅ FALLBACK: Found active match via API poll!');
          
          // Store server timestamps
          matchStartTimeRef.current = new Date(matchResponse.match.startedAt).getTime();
          matchDurationRef.current = matchResponse.match.duration * 60;
          
          setActiveMatch({
            match: matchResponse.match,
            opponent: matchResponse.opponent,
            problemUrl: matchResponse.problemUrl,
          });
          
          setMatchTimer(matchResponse.remainingTime);
          setMatchAttempts(matchResponse.attempts);
          
          if (view !== 'matchmaking' && view !== 'duel') {
            setView('matchmaking');
          }
        }
      } catch (err) {
        // No active match found, which is fine
      }
    }, 5000);

    return () => {
      console.log('🛑 Stopping fallback match checker');
      clearInterval(pollInterval);
    };
  }, [user, activeMatch, matchResult, view]);

  // ============================================
  // SERVER-SYNCED TIMER - CALCULATES FROM SERVER TIME
  // ============================================
  useEffect(() => {
    // Clear any existing timer first
    if (timerIntervalRef.current) {
      console.log('🧹 Clearing existing timer interval');
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Only start timer if we have an active match
    if (!activeMatch || !matchStartTimeRef.current || !matchDurationRef.current) {
      console.log('⏸️ No active match data, not starting timer');
      return;
    }

    console.log('⏱️ Starting server-synced timer');
    console.log('   Match started at:', new Date(matchStartTimeRef.current).toISOString());
    console.log('   Duration:', matchDurationRef.current, 'seconds');
    
    matchEndHandledRef.current = false;

    // Function to calculate remaining time from server timestamp
    const calculateRemainingTime = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - matchStartTimeRef.current) / 1000);
      const remaining = Math.max(0, matchDurationRef.current - elapsed);
      
      return remaining;
    };

    // Set initial timer from calculation
    const initialRemaining = calculateRemainingTime();
    console.log('   Initial remaining time:', initialRemaining, 'seconds');
    setMatchTimer(initialRemaining);

    // Update timer every second by recalculating from server time
    timerIntervalRef.current = setInterval(() => {
      const remaining = calculateRemainingTime();
      
      // Log every 30 seconds
      if (remaining % 30 === 0 && remaining > 0) {
        console.log('⏱️ Timer:', remaining, 'seconds remaining');
      }
      
      setMatchTimer(remaining);
    }, 1000);

    // Cleanup function
    return () => {
      if (timerIntervalRef.current) {
        console.log('🛑 Cleaning up timer interval');
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [activeMatch?.match?.id]); // Only depend on match ID

  // Handle timer expiry - SEPARATE from timer itself
  useEffect(() => {
    if (!activeMatch || matchResult || matchEndHandledRef.current) return;
    
    if (matchTimer === 0) {
      console.log('⏰ Timer reached 0, waiting for backend...');
      matchEndHandledRef.current = true;
      
      const timeoutId = setTimeout(() => {
        console.log('🔄 No match-end event received, forcing draw');
        
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
        matchStartTimeRef.current = null;
        matchDurationRef.current = null;
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

  // Periodic sync with server to ensure timer accuracy
  useEffect(() => {
    if (!activeMatch || !user) return;

    console.log('🔄 Starting periodic server sync for timer accuracy');

    const syncInterval = setInterval(async () => {
      try {
        const matchResponse = await api.getActiveMatch();
        
        if (matchResponse.match && matchResponse.match.id === activeMatch.match.id) {
          // Update server time reference if there's significant drift
          const serverRemaining = matchResponse.remainingTime;
          const clientRemaining = matchTimer;
          const drift = Math.abs(serverRemaining - clientRemaining);
          
          if (drift > 3) {
            console.log('⚠️ Timer drift detected:', drift, 'seconds. Syncing with server...');
            console.log('   Server says:', serverRemaining, 'Client says:', clientRemaining);
            
            // Recalculate start time based on server's remaining time
            const now = Date.now();
            const duration = matchResponse.match.duration * 60;
            const elapsed = duration - serverRemaining;
            matchStartTimeRef.current = now - (elapsed * 1000);
            
            console.log('✅ Timer synced. New start time:', new Date(matchStartTimeRef.current).toISOString());
          }
          
          // Update attempts
          setMatchAttempts(matchResponse.attempts);
        } else if (!matchResponse.match) {
          console.log('⚠️ Server says no active match - may have ended');
        }
      } catch (err) {
        console.log('Sync check: No active match on server');
      }
    }, 15000); // Sync every 15 seconds

    return () => {
      console.log('🛑 Stopping periodic server sync');
      clearInterval(syncInterval);
    };
  }, [activeMatch, matchTimer, user]);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const response = await api.getCurrentUser();
        setUser(response.data.user);
        
        try {
          const matchResponse = await api.getActiveMatch();
          if (matchResponse.match) {
            const matchData = matchResponse;
            
            if (matchData.remainingTime <= 0) {
              console.log('⏰ Active match found but expired, skipping restore');
              setView('dashboard');
            } else {
              console.log('✅ Restoring active match with', matchData.remainingTime, 'seconds remaining');
              
              // Store server timestamps for accurate calculation
              matchStartTimeRef.current = new Date(matchData.match.startedAt).getTime();
              matchDurationRef.current = matchData.match.duration * 60;
              
              setActiveMatch({
                match: matchData.match,
                opponent: matchData.opponent,
                problemUrl: matchData.problemUrl,
              });
              
              setMatchTimer(matchData.remainingTime);
              setMatchAttempts(matchData.attempts);
              setView('matchmaking');
            }
          } else {
            setView('dashboard');
          }
        } catch (err) {
          console.log('No active match found');
          setView('dashboard');
        }
      } catch (err) {
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  };

  const handleLogout = () => {
    // Clean up timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Clear time references
    matchStartTimeRef.current = null;
    matchDurationRef.current = null;

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
            {view === 'leaderboard' && <Leaderboard />}
            {view === 'profile' && <Profile user={user} setUser={setUser} />}
          </main>
        </>
      ) : (
        <AuthPage setUser={setUser} setView={setView} />
      )}
    </div>
  );
}