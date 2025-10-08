import React, { useState, useRef } from 'react';
import { Code, Swords, AlertCircle } from 'lucide-react';
import api from '../services/api.service';

export default function AuthPage({ setUser, setView }) {
  const [mode, setMode] = useState('login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    cfHandle: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({
    length: false,
    uppercase: false,
    special: false,
  });
  const [usernameError, setUsernameError] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [checkingEmail, setCheckingEmail] = useState(false);

  const usernameTimerRef = useRef(null);
  const emailTimerRef = useRef(null);

  const validatePassword = (password) => {
    const errors = {
      length: password.length < 8,
      uppercase: !/[A-Z]/.test(password),
      special: !/[^a-zA-Z]/.test(password),
    };
    setPasswordErrors(errors);
    return !errors.length && !errors.uppercase && !errors.special;
  };

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const checkEmailAvailability = async (email) => {
    if (!email || !isValidEmail(email)) {
      setEmailError('');
      return;
    }

    setCheckingEmail(true);
    try {
      const response = await api.checkEmail(email);
      if (response.exists) {
        setEmailError('Email already registered');
      } else {
        setEmailError('');
      }
    } catch (err) {
      console.error('Error checking email:', err);
      setEmailError('');
    } finally {
      setCheckingEmail(false);
    }
  };

  const checkUsernameAvailability = async (username) => {
    if (!username || username.length < 3) {
      setUsernameError('');
      return;
    }

    setCheckingUsername(true);
    try {
      const response = await api.checkUsername(username);
      if (response.exists) {
        setUsernameError('Username already taken');
      } else {
        setUsernameError('');
      }
    } catch (err) {
      console.error('Error checking username:', err);
      setUsernameError('');
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
    
    if (name === 'password' && mode === 'signup') {
      validatePassword(value);
    }
    
    if (name === 'email' && mode === 'signup') {
      setEmailError('');
      setCheckingEmail(false);
      
      if (emailTimerRef.current) {
        clearTimeout(emailTimerRef.current);
      }
      
      if (isValidEmail(value)) {
        emailTimerRef.current = setTimeout(() => {
          checkEmailAvailability(value);
        }, 500);
      }
    }
    
    if (name === 'username' && mode === 'signup') {
      setUsernameError('');
      setCheckingUsername(false);
      
      if (usernameTimerRef.current) {
        clearTimeout(usernameTimerRef.current);
      }
      
      if (value.length >= 3) {
        usernameTimerRef.current = setTimeout(() => {
          checkUsernameAvailability(value);
        }, 500);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (mode === 'signup' && !validatePassword(formData.password)) {
      setError('Please fix the password requirements');
      return;
    }
    
    if (mode === 'signup' && (emailError || usernameError)) {
      setError('Please fix the validation errors');
      return;
    }
    
    setLoading(true);

    try {
      const response = mode === 'login'
        ? await api.login(formData.email, formData.password)
        : await api.signup(
            formData.email,
            formData.password,
            formData.username,
            formData.cfHandle || null
          );

      localStorage.setItem('token', response.data.token);
      setUser(response.data.user);
      setView('dashboard');
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/google`;
  };

  const toggleMode = (newMode) => {
    setMode(newMode);
    setError('');
    setPasswordErrors({ length: false, uppercase: false, special: false });
    setUsernameError('');
    setEmailError('');
    setCheckingUsername(false);
    setCheckingEmail(false);
    
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
  };

  const isPasswordValid = !passwordErrors.length && !passwordErrors.uppercase && !passwordErrors.special;
  
  const isSignupValid = mode === 'login' || (
    formData.email &&
    formData.password &&
    formData.username &&
    isPasswordValid &&
    !emailError &&
    !usernameError &&
    !checkingEmail &&
    !checkingUsername
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Code className="size-12 text-purple-400" />
            <Swords className="size-12 text-purple-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">
            Codeforces Duel
          </h1>
          <p className="text-gray-400">
            Compete with coders in real-time battles
          </p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-8 border border-purple-500/20 shadow-2xl">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => toggleMode('login')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                mode === 'login'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => toggleMode('signup')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                mode === 'signup'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start gap-2">
              <AlertCircle className="size-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    minLength={3}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder:text-gray-400 focus:outline-none focus:border-purple-500 transition-colors"
                    placeholder="Enter your username"
                  />
                  {checkingUsername && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                {usernameError && (
                  <p className="text-red-400 text-xs mt-1">{usernameError}</p>
                )}
                {!usernameError && formData.username.length >= 3 && !checkingUsername && (
                  <p className="text-green-400 text-xs mt-1">✓ Username available</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder:text-gray-400 focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="Enter your email"
                />
                {checkingEmail && mode === 'signup' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              {mode === 'signup' && emailError && (
                <p className="text-red-400 text-xs mt-1">{emailError}</p>
              )}
              {mode === 'signup' && !emailError && isValidEmail(formData.email) && !checkingEmail && (
                <p className="text-green-400 text-xs mt-1">✓ Email available</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder:text-gray-400 focus:outline-none focus:border-purple-500 transition-colors"
                placeholder="Enter your password"
              />
              
              {mode === 'signup' && formData.password && (
                <div className="mt-2 space-y-1">
                  <div className={`flex items-center text-xs ${
                    passwordErrors.length ? 'text-red-400' : 'text-green-400'
                  }`}>
                    <span className="mr-1">{passwordErrors.length ? '✗' : '✓'}</span>
                    <span>At least 8 characters</span>
                  </div>
                  <div className={`flex items-center text-xs ${
                    passwordErrors.uppercase ? 'text-red-400' : 'text-green-400'
                  }`}>
                    <span className="mr-1">{passwordErrors.uppercase ? '✗' : '✓'}</span>
                    <span>At least one uppercase letter</span>
                  </div>
                  <div className={`flex items-center text-xs ${
                    passwordErrors.special ? 'text-red-400' : 'text-green-400'
                  }`}>
                    <span className="mr-1">{passwordErrors.special ? '✗' : '✓'}</span>
                    <span>At least one special character (number or symbol)</span>
                  </div>
                </div>
              )}
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Codeforces Handle (Optional)
                </label>
                <input
                  type="text"
                  name="cfHandle"
                  value={formData.cfHandle}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder:text-gray-400 focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="Your CF handle"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !isSignupValid}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : mode === 'login' ? 'Login' : 'Sign Up'}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-800 text-gray-400">Or continue with</span>
              </div>
            </div>

            <button
              onClick={handleGoogleLogin}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              <svg className="size-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.261.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Google</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}