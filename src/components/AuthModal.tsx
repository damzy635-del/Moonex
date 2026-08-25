import React, { useState } from 'react';
import {
  X,
  Mail,
  Lock,
  User,
  Sparkles,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'signin',
}) => {
  const {
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.message?.includes('popup-closed-by-user')
      ) {
        // User voluntarily dismissed popup
        return;
      }
      setError(err?.message?.replace('Firebase: ', '') || 'Google authentication failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setError(null);
    setAppleLoading(true);
    try {
      await signInWithApple();
      onClose();
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.message?.includes('popup-closed-by-user')
      ) {
        // User voluntarily dismissed popup
        return;
      }
      setError(err?.message?.replace('Firebase: ', '') || 'Apple authentication failed.');
    } finally {
      setAppleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        if (!email || !password) {
          throw new Error('Please enter both email and password.');
        }
        await signInWithEmail(email, password);
        onClose();
      } else if (mode === 'signup') {
        if (!email || !password) {
          throw new Error('Please enter email and password.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        await signUpWithEmail(email, password, name || email.split('@')[0]);
        onClose();
      } else if (mode === 'forgot') {
        if (!email) {
          throw new Error('Please enter your account email address.');
        }
        await resetPassword(email);
        setSuccessMessage('Password reset link sent to your email.');
      }
    } catch (err: any) {
      let msg = err?.message || 'Authentication error';
      if (
        msg.includes('auth/operation-not-allowed') ||
        msg.includes('operation-not-allowed')
      ) {
        msg =
          'Email authentication is not enabled. Please sign in using Google or Apple.';
      } else if (
        msg.includes('auth/invalid-credential') ||
        msg.includes('auth/user-not-found') ||
        msg.includes('auth/wrong-password')
      ) {
        msg = 'Invalid email or password. Please try again.';
      } else if (
        msg.includes('auth/email-already-in-use') ||
        err?.code === 'auth/email-already-in-use'
      ) {
        msg = 'An account already exists with this email address. Please sign in.';
      } else if (msg.includes('auth/weak-password')) {
        msg = 'Password should be at least 6 characters.';
      } else if (msg.includes('auth/invalid-email')) {
        msg = 'Please enter a valid email address.';
      } else if (
        msg.includes('auth/admin-restricted-operation') ||
        msg.includes('admin-restricted-operation')
      ) {
        msg = 'Operation is restricted. Please sign in using Google or Apple.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        id="auth-modal-dialog"
        className="relative w-full max-w-md rounded-2xl border border-gray-800 bg-[#171717] p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-150 text-gray-100"
      >
        {/* Close Button */}
        <button
          id="btn-close-auth-modal"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Brand & Header */}
        <div className="flex flex-col items-center text-center space-y-2 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-md shadow-indigo-500/20 text-white">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {mode === 'signin' && 'Sign in to My AI Model'}
              {mode === 'signup' && 'Create your account'}
              {mode === 'forgot' && 'Reset your password'}
            </h2>
            <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
              {mode === 'signin' && 'Sign in with Google, Apple, or Email to start chatting, generating code, and accessing cloud workspaces.'}
              {mode === 'signup' && 'Create an account to start prompting, research, and cloud sync.'}
              {mode === 'forgot' && 'Enter your email and we’ll send you a recovery link.'}
            </p>
          </div>
        </div>

        {/* Alert Notifications */}
        {error && (
          <div className="mb-4 flex flex-col gap-2 rounded-xl border border-rose-900/60 bg-rose-950/30 p-3 text-xs text-rose-300">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
            {error.includes('already exists') && mode === 'signup' && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('signin');
                }}
                className="self-start text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline ml-6"
              >
                Sign in with this email &rarr;
              </button>
            )}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-900/60 bg-emerald-950/30 p-3 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            <span className="leading-snug">{successMessage}</span>
          </div>
        )}

        {/* OAuth Providers: Google & Apple */}
        {mode !== 'forgot' && (
          <div className="space-y-2.5 mb-5">
            {/* Google Sign-in */}
            <button
              type="button"
              id="btn-google-auth"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || appleLoading || loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-700/80 bg-[#212121] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#282828] hover:border-gray-600 transition-all shadow-xs disabled:opacity-50"
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
              ) : (
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>Continue with Google</span>
            </button>

            {/* Apple Sign-in */}
            <button
              type="button"
              id="btn-apple-auth"
              onClick={handleAppleSignIn}
              disabled={appleLoading || googleLoading || loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-700/80 bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-900 hover:border-gray-600 transition-all shadow-xs disabled:opacity-50"
            >
              {appleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-300" />
              ) : (
                <svg className="h-4 w-4 shrink-0 fill-white" viewBox="0 0 170 170">
                  <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.6-7.85-11.75-14.42-6-9.47-10.74-20.44-14.22-32.91-3.48-12.47-5.22-24.16-5.22-35.08 0-14.92 3.8-27.42 11.41-37.5 7.61-10.09 17.2-15.22 28.77-15.4 4.58 0 9.87 1.25 15.86 3.75 5.99 2.5 9.94 3.79 11.85 3.87 1.52 0 5.66-1.39 12.42-4.17 6.76-2.77 12.39-4.01 16.9-3.71 12.92.65 23.36 5.48 31.33 14.51-11.5 6.96-17.13 16.63-16.9 29.02.22 9.68 3.97 17.84 11.25 24.48 7.28 6.64 16.03 10.4 26.25 11.28-2.6 7.63-5.87 15.35-9.8 23.16zM119.22 33.64c0-7.4 2.65-14.36 7.96-20.89 5.3-6.53 11.77-10.78 19.39-12.75.22 1.09.33 2.07.33 2.94 0 7.4-2.77 14.53-8.31 21.39-5.54 6.86-12.23 11.05-20.06 12.57-.44-1.09-.69-2.09-.69-3.26z" />
                </svg>
              )}
              <span>Continue with Apple</span>
            </button>

            <div className="relative my-4 flex items-center justify-center">
              <div className="w-full border-t border-gray-800" />
              <span className="absolute bg-[#171717] px-3 text-[11px] font-medium uppercase tracking-wider text-gray-500">
                Or with email
              </span>
            </div>
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Display Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-[#212121] pl-9 pr-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-800 bg-[#212121] pl-9 pr-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-300">
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-[#212121] pl-9 pr-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* Primary Submit Button */}
          <button
            type="submit"
            disabled={loading || googleLoading || appleLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 mt-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>
                  {mode === 'signin' && 'Sign In with Email'}
                  {mode === 'signup' && 'Create Account'}
                  {mode === 'forgot' && 'Send Recovery Email'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Mode switcher links & Auth requirement note */}
        <div className="mt-5 space-y-3 text-center">
          {mode === 'signin' && (
            <p className="text-xs text-gray-400">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                }}
                className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
              >
                Sign up for free
              </button>
            </p>
          )}

          {mode === 'signup' && (
            <p className="text-xs text-gray-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                }}
                className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
              >
                Sign in
              </button>
            </p>
          )}

          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
            >
              Back to Sign In
            </button>
          )}

          <div className="pt-3 border-t border-gray-800/80">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
              <span>Authentication required to make requests & store workspaces</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
