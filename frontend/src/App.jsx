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

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user && !socket) {
      const token = localStorage.getItem('token');
      const newSocket = socketService.connect(token);
      setSocket(newSocket);
    }

    return () => {
      if (!user && socket) {
        socketService.disconnect();
        setSocket(null);
      }
    };
  }, [user]);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const response = await api.getCurrentUser();
        setUser(response.data.user);
        setView('dashboard');
      } catch (err) {
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    if (socket) {
      socketService.disconnect();
      setSocket(null);
    }
    setUser(null);
    setView('login');
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
      {user ? (
        <>
          <Navbar user={user} view={view} setView={setView} onLogout={handleLogout} />
          <main className="container mx-auto px-4 py-8 max-w-7xl">
            {view === 'dashboard' && <Dashboard user={user} setView={setView} />}
            {view === 'matchmaking' && <Matchmaking user={user} socket={socket} />}
            {view === 'duel' && <DuelMode user={user} socket={socket} />}
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