'use client';

import { Eye, EyeOff } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const PASSWORD_MIN_LENGTH = 8;

function getPasswordError(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }

  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include both letters and numbers.';
  }

  return '';
}

export default function SetupPasswordPage() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams?.get('token') || '', [searchParams]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const passwordError = getPasswordError(password);
  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!token) {
      setError('Invite token is missing.');
      return;
    }

    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/setup-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to set password.');
      }

      setMessage('Password set successfully. You can now sign in.');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to set password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_transparent_40%),linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] px-4 py-12 text-slate-900">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-2xl shadow-slate-300/40 backdrop-blur">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-cyan-700">Invitation</p>
        <h1 className="text-3xl font-black tracking-tight">Set your password</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Finish your account setup with a secure password. This invitation link expires after 24 hours.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.25em] text-slate-500">
              New password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 outline-none transition focus:border-cyan-500 focus:bg-white"
                placeholder="At least 8 characters"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="mt-2 text-xs font-medium text-slate-500">
              Use at least 8 characters with letters and numbers.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.25em] text-slate-500">
              Confirm password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 outline-none transition focus:border-cyan-500 focus:bg-white"
                placeholder="Repeat password"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((visible) => !visible)}
                className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800"
                aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {!passwordsMatch ? (
              <p className="mt-2 text-xs font-bold text-rose-600">Passwords do not match.</p>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting || Boolean(passwordError) || !passwordsMatch}
            className="w-full rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-black uppercase tracking-[0.25em] text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? 'Saving...' : 'Save Password'}
          </button>
        </form>

        <Link href="/login" className="mt-6 inline-block text-sm font-bold text-cyan-700 hover:text-cyan-800">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
