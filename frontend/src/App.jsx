import React, { useState, useEffect } from 'react';
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
  const [activeMatch, setActiveMatch] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [matchTimer, setMatchTimer] = useState(0);
  const [matchAttempts, setMatchAttempts] = useState({ player1: 0, player2: 0 });
  const [error, setError] = useState(null);

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
        
        // Save token
        localStorage.setItem('token', token);
        
        // Clean up URL immediately
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Fetch user data
        try {
          const response = await api.getCurrentUser();
          setUser(response.data.user);
          
          // Check for active match
          try {
            const matchResponse = await api.getActiveMatch();
            if (matchResponse.match && matchResponse.remainingTime > 0) {
              console.log('✅ Restoring active match');
              setActiveMatch({
                match: matchResponse.match,
                opponent: matchResponse.opponent,
                problemUrl: matchResponse.problemUrl,
                startTime: new Date(matchResponse.match.startedAt).getTime(),
                matchDuration: matchResponse.match.duration * 60,
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
        console.log('No token or user, skipping socket connection');
        return;
      }

      try {
        console.log('Initializing socket connection...');
        
        // Connect socket
        const newSocket = socketService.connect();
        setSocket(newSocket);
        
        // Authenticate with a small delay to ensure connection is established
        await new Promise(resolve => setTimeout(resolve, 100));
        await socketService.authenticate(token);
        
        console.log('✅ Socket fully initialized');
      } catch (error) {
        console.error('Socket initialization error:', error);
        setError('Failed to connect to server. Please refresh the page.');
      }
    };

    initializeSocket();

    return () => {
      // Don't disconnect on component unmount to maintain connection
      // Only disconnect on logout
    };
  }, [user]); // Only re-initialize if user changes

  // Force clear expired matches on timer reaching 0
  useEffect(() => {
    if (activeMatch && matchTimer === 0 && !matchResult) {
      console.log('⏰ Timer reached 0, forcing match clear after 5 seconds...');
      
      const timeoutId = setTimeout(async () => {
        console.log('🔄 Forcing match state clear and returning to dashboard');
        
        // Clear all match state
        setActiveMatch(null);
        setMatchTimer(0);
        setMatchAttempts({ player1: 0, player2: 0 });
        
        // Set a draw result
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
        
        setError('Match timed out. Returning to dashboard.');
        
        // Force navigate to dashboard after showing result
        setTimeout(() => {
          setMatchResult(null);
          setView('dashboard');
          setError(null);
        }, 3000);
      }, 5000); // Wait 5 seconds for backend response

      return () => clearTimeout(timeoutId);
    }
  }, [activeMatch, matchTimer, matchResult, user]);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const response = await api.getCurrentUser();
        setUser(response.data.user);
        
        // Check for active match after authentication
        try {
          const matchResponse = await api.getActiveMatch();
          if (matchResponse.match) {
            const matchData = matchResponse;
            
            // Check if match has actually expired
            if (matchData.remainingTime <= 0) {
              console.log('⏰ Active match found but expired, skipping restore');
              setView('dashboard');
            } else {
              console.log('✅ Restoring active match with', matchData.remainingTime, 'seconds remaining');
              
              // Set active match
              setActiveMatch({
                match: matchData.match,
                opponent: matchData.opponent,
                problemUrl: matchData.problemUrl,
                startTime: new Date(matchData.match.startedAt).getTime(),
                matchDuration: matchData.match.duration * 60,
              });
              
              // Set remaining time
              setMatchTimer(matchData.remainingTime);
              
              // Set attempts
              setMatchAttempts(matchData.attempts);
              
              // Navigate to appropriate view
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
    // Properly disconnect socket
    if (socket) {
      socketService.disconnect();
      setSocket(null);
    }
    
    // Clear user data
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