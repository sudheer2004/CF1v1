import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import GlobalChat from './components/GlobalChat'; // Floating chat
import GlobalChatPage from './components/GlobalChatPage'; // Full page chat (NEW)
import api from './services/api.service';
import socketService from './services/socket.service';
import './styles/chatStyles.css';

const isDev = import.meta.env.MODE === 'development';
const devLog = (...args) => {
  if (isDev) console.log(...args);
};
const MATCH_CONTEXT_STORAGE_KEY = 'activeMatchContext';

const VIEW_TO_PATH = {
  login: '/',
  dashboard: '/dashboard',
  matchmaking: '/matchmaking',
  duel: '/duel',
  'team-battle': '/team-battle',
  leaderboard: '/leaderboard',
  'global-chat': '/global-chat',
  profile: '/profile',
  'report-issues': '/report-issues',
};

const VIEW_SUBROUTES = {
  duel: new Set(['create', 'join', 'match']),
  'team-battle': new Set(['create', 'join', 'waiting', 'match', 'result']),
};

const getRouteStateFromPath = (pathname) => {
  const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');

  if (normalizedPath === '/') {
    return { view: 'login', subview: null };
  }

  for (const [viewKey, basePath] of Object.entries(VIEW_TO_PATH)) {
    if (viewKey === 'login') continue;

    if (normalizedPath === basePath) {
      return { view: viewKey, subview: null };
    }

    if (normalizedPath.startsWith(`${basePath}/`)) {
      const subview = normalizedPath.slice(basePath.length + 1);
      const allowedSubroutes = VIEW_SUBROUTES[viewKey];

      return {
        view: viewKey,
        subview: allowedSubroutes?.has(subview) ? subview : null,
      };
    }
  }

  return { view: 'dashboard', subview: null };
};

const buildPathForView = (viewKey, subview = null) => {
  const basePath = VIEW_TO_PATH[viewKey] || VIEW_TO_PATH.dashboard;
  const allowedSubroutes = VIEW_SUBROUTES[viewKey];

  if (allowedSubroutes?.has(subview)) {
    return `${basePath}/${subview}`;
  }

  return basePath;
};

export default function App() {
  const initialRoute = getRouteStateFromPath(window.location.pathname);
  const [user, setUser] = useState(null);
  const [view, setView] = useState(initialRoute.view);
  const [subview, setSubview] = useState(initialRoute.subview);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [socketReady, setSocketReady] = useState(false);
  const [globalOnlineCount, setGlobalOnlineCount] = useState(0);
  
  // Match states
  const [activeMatch, setActiveMatch] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [matchTimer, setMatchTimer] = useState(0);
  const [matchAttempts, setMatchAttempts] = useState({ player1: 0, player2: 0 });
  const [activeMatchContext, setActiveMatchContext] = useState(
    () => sessionStorage.getItem(MATCH_CONTEXT_STORAGE_KEY) || null,
  );
  
  // Team Battle states
  const [activeTeamBattle, setActiveTeamBattle] = useState(null);
  const [teamBattleStats, setTeamBattleStats] = useState(null);
  const [teamBattleTimer, setTeamBattleTimer] = useState(0);
  
  const [error, setError] = useState(null);

  const matchEndHandledRef = useRef(false);
  const teamBattleEndHandledRef = useRef(false);

  const navigateToView = useCallback((nextView, options = {}) => {
    const { replace = false, subview: nextSubview = null } = options;
    const normalizedView = nextView || 'dashboard';
    const normalizedSubview = VIEW_SUBROUTES[normalizedView]?.has(nextSubview)
      ? nextSubview
      : null;
    const nextPath = buildPathForView(normalizedView, normalizedSubview);

    setView(normalizedView);
    setSubview(normalizedSubview);

    if (window.location.pathname !== nextPath) {
      const method = replace ? 'replaceState' : 'pushState';
      window.history[method](
        { view: normalizedView, subview: normalizedSubview },
        '',
        nextPath,
      );
    }
  }, []);

  const updateMatchContext = useCallback((nextContext) => {
    setActiveMatchContext(nextContext);

    if (nextContext) {
      sessionStorage.setItem(MATCH_CONTEXT_STORAGE_KEY, nextContext);
    } else {
      sessionStorage.removeItem(MATCH_CONTEXT_STORAGE_KEY);
    }
  }, []);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const nextRoute = getRouteStateFromPath(window.location.pathname);
      setView(nextRoute.view);
      setSubview(nextRoute.subview);
      setError(null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
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
              const restoredContext = sessionStorage.getItem(MATCH_CONTEXT_STORAGE_KEY);
              updateMatchContext(restoredContext);
              navigateToView(
                restoredContext === 'duel' ? 'duel' : 'matchmaking',
                {
                  replace: true,
                  subview: restoredContext === 'duel' ? 'match' : null,
                },
              );
            } else {
              navigateToView('dashboard', { replace: true });
            }
          } catch (err) {
            devLog('⚠️ OAuth: No active match found');
            navigateToView('dashboard', { replace: true });
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
  }, [navigateToView, updateMatchContext]);

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

  useEffect(() => {
    if (!socket || !socketReady || !user) return;

    const handleOnlineUsersCount = (count) => {
      setGlobalOnlineCount(count);
    };

    socketService.onOnlineUsersCount(handleOnlineUsersCount);

    return () => {
      socketService.offOnlineUsersCount(handleOnlineUsersCount);
    };
  }, [socket, socketReady, user]);

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
        
        if (matchResponse.match && matchResponse.match.endTime) {
          setActiveMatch({
            match: matchResponse.match,
            opponent: matchResponse.opponent,
            problemUrl: matchResponse.problemUrl,
          });
          
          setMatchAttempts(matchResponse.attempts);
          const restoredContext = sessionStorage.getItem(MATCH_CONTEXT_STORAGE_KEY);
          updateMatchContext(restoredContext);
          navigateToView(
            restoredContext === 'duel' ? 'duel' : 'matchmaking',
            {
              replace: true,
              subview: restoredContext === 'duel' ? 'match' : null,
            },
          );
        }
      } catch (err) {
        // No active match
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [user, activeMatch, matchResult, view, navigateToView, updateMatchContext]);

  // Poll for active team battle (fallback)
  useEffect(() => {
    if (!user || activeTeamBattle) return;
    if (view !== 'team-battle') return;
    
    const pollInterval = setInterval(async () => {
      try {
        const battleResponse = await api.getActiveTeamBattle();
        
        if (battleResponse.battle) {
          devLog('📥 Poll: Restored team battle:', battleResponse.battle);
          
          setActiveTeamBattle(battleResponse.battle);
          setTeamBattleStats(battleResponse.stats);
          
          if (socket && socketReady) {
            socket.emit('join-team-battle-room', { 
              battleCode: battleResponse.battle.battleCode 
            });
          }
        }
      } catch (err) {
        // No active team battle
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [user, activeTeamBattle, view, socket, socketReady]);

  // Match timer (endTime-based)
  useEffect(() => {
    if (!activeMatch?.match?.endTime) {
      setMatchTimer(0);
      return;
    }

    matchEndHandledRef.current = false;

    const calculateRemaining = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((activeMatch.match.endTime - now) / 1000));
      return remaining;
    };

    setMatchTimer(calculateRemaining());

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setMatchTimer(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeMatch?.match?.endTime]);

  // Team Battle timer (endTime-based)
  useEffect(() => {
    if (!activeTeamBattle?.endTime) {
      setTeamBattleTimer(0);
      return;
    }

    teamBattleEndHandledRef.current = false;

    const calculateRemaining = () => {
      const now = Date.now();
      const endTime = typeof activeTeamBattle.endTime === 'number' 
        ? activeTeamBattle.endTime 
        : new Date(activeTeamBattle.endTime).getTime();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      return remaining;
    };

    setTeamBattleTimer(calculateRemaining());
    
    devLog('🔥 Team Battle Timer Started:', {
      endTime: activeTeamBattle.endTime,
      initialRemaining: calculateRemaining()
    });

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setTeamBattleTimer(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTeamBattle?.endTime]);

  // Handle match timer expiry
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
          navigateToView('dashboard', { replace: true });
          setError(null);
        }, 5000);
      }, 10000);

      return () => clearTimeout(timeoutId);
    }
  }, [matchTimer, activeMatch, matchResult, user, navigateToView]);

  // Sync match attempts periodically
  useEffect(() => {
    if (!activeMatch || !user) return;

    const syncInterval = setInterval(async () => {
      try {
        const matchResponse = await api.getActiveMatch();
        
        if (matchResponse.match && matchResponse.match.id === activeMatch.match.id) {
          setMatchAttempts(matchResponse.attempts);
        }
      } catch (err) {
        // Ignore sync errors
      }
    }, 20000);

    return () => clearInterval(syncInterval);
  }, [activeMatch?.match?.id, user]);

  useEffect(() => {
    if (!activeMatch && !matchResult && activeMatchContext) {
      updateMatchContext(null);
    }
  }, [activeMatch, matchResult, activeMatchContext, updateMatchContext]);

  useEffect(() => {
    if (!activeMatch) return;

    if (activeMatchContext === 'duel' && view === 'duel' && subview !== 'match') {
      navigateToView('duel', { replace: true, subview: 'match' });
      return;
    }

    if (activeMatchContext === 'duel' && view === 'matchmaking') {
      navigateToView('duel', { replace: true, subview: 'match' });
      return;
    }

    if (activeMatchContext === 'matchmaking' && view === 'duel') {
      navigateToView('matchmaking', { replace: true });
    }
  }, [activeMatch, activeMatchContext, view, subview, navigateToView]);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const response = await api.getCurrentUser();
        setUser(response.data.user);
        
        try {
          const matchResponse = await api.getActiveMatch();
          
          if (matchResponse.match && matchResponse.match.endTime) {
            devLog('📥 Auth: Restored match with endTime:', matchResponse.match.endTime);
            
            setActiveMatch({
              match: matchResponse.match,
              opponent: matchResponse.opponent,
              problemUrl: matchResponse.problemUrl,
            });
            
            setMatchAttempts(matchResponse.attempts);
            const restoredContext = sessionStorage.getItem(MATCH_CONTEXT_STORAGE_KEY);
            updateMatchContext(restoredContext);
            navigateToView(
              restoredContext === 'duel' ? 'duel' : 'matchmaking',
              {
                replace: true,
                subview: restoredContext === 'duel' ? 'match' : null,
              },
            );
          } else {
            try {
              const battleResponse = await api.getActiveTeamBattle();
              
              if (battleResponse.battle) {
                devLog('📥 Auth: Restored team battle:', battleResponse.battle);
                
                setActiveTeamBattle(battleResponse.battle);
                setTeamBattleStats(battleResponse.stats);
                navigateToView('team-battle', {
                  replace: true,
                  subview: battleResponse.battle.status === 'waiting' ? 'waiting' : 'match',
                });
                
                if (socket && socketReady) {
                  socket.emit('join-team-battle-room', { 
                    battleCode: battleResponse.battle.battleCode 
                  });
                }
              } else {
                navigateToView(view === 'login' ? 'dashboard' : view, {
                  replace: true,
                  subview: view === 'login' ? null : subview,
                });
              }
            } catch (err) {
              devLog('⚠️ Auth: No active team battle found');
              navigateToView(view === 'login' ? 'dashboard' : view, {
                replace: true,
                subview: view === 'login' ? null : subview,
              });
            }
          }
        } catch (err) {
          devLog('⚠️ Auth: No active match found');
          navigateToView(view === 'login' ? 'dashboard' : view, {
            replace: true,
            subview: view === 'login' ? null : subview,
          });
        }
      } catch (err) {
        localStorage.removeItem('token');
        navigateToView('login', { replace: true });
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
    navigateToView('login', { replace: true });
    setActiveMatch(null);
    setMatchResult(null);
    setMatchTimer(0);
    setMatchAttempts({ player1: 0, player2: 0 });
    updateMatchContext(null);
    setActiveTeamBattle(null);
    setTeamBattleStats(null);
    setTeamBattleTimer(0);
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
          {/* Always show Navbar when user is logged in */}
          <Navbar user={user} view={view} setView={navigateToView} onLogout={handleLogout} />
          
          {/* Global Chat Full Page - Renders outside main container */}
          {view === 'global-chat' ? (
            <GlobalChatPage
              user={user}
              socket={socket}
              socketReady={socketReady}
              onlineCount={globalOnlineCount}
            />
          ) : (
            <main className="container mx-auto px-4 py-8 max-w-7xl">
              {view === 'dashboard' && <Dashboard user={user} setView={navigateToView} />}
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
                  navigateToView={navigateToView}
                  updateMatchContext={updateMatchContext}
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
                  routeSubview={view === 'duel' ? subview : null}
                  navigateToView={navigateToView}
                  activeMatchContext={activeMatchContext}
                  updateMatchContext={updateMatchContext}
                />
              )}
              {view === 'team-battle' && (
                <TeamBattle
                  user={user}
                  socket={socket}
                  socketReady={socketReady}
                  activeBattle={activeTeamBattle}
                  setActiveBattle={setActiveTeamBattle}
                  battleStats={teamBattleStats}
                  setBattleStats={setTeamBattleStats}
                  routeSubview={view === 'team-battle' ? subview : null}
                  navigateToView={navigateToView}
                />
              )}
              {view === 'leaderboard' && <Leaderboard />}
              {view === 'profile' && <Profile user={user} setUser={setUser} />}
              {view === 'report-issues' && <ReportIssues user={user} />}
            </main>
          )}

          {/* Floating Global Chat - Hidden on global-chat page */}
          {view !== 'global-chat' && (
            <GlobalChat
              user={user}
              socket={socket}
              socketReady={socketReady}
              onlineCount={globalOnlineCount}
              setView={navigateToView}
            />
          )}
        </>
      ) : (
        <AuthPage setUser={setUser} setView={navigateToView} />
      )}
    </div>
  );
}
