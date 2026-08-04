import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

function validateEmail(value: string): string {
  if (!value) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address';
  return '';
}

function validatePassword(value: string): string {
  if (!value) return 'Password is required';
  return '';
}

function EyeToggle({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={-1}
      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate hover:text-navy"
      aria-label={visible ? 'Hide password' : 'Show password'}
    >
      {visible ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.751 6.69l1.109 1.109a2.5 2.5 0 013.341 3.341l1.109 1.109a4 4 0 00-5.559-5.559z" clipRule="evenodd" />
          <path d="M10.75 12.75l-4.207-4.207a3.02 3.02 0 00-.238.966A4 4 0 0010 14a4 4 0 004-4 3.99 3.99 0 00-.049-.5l-1.71-1.71a2.5 2.5 0 01-1.49 1.49l-.001.47z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
          <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    setFieldErrors({ email: emailError, password: passwordError });
    if (emailError || passwordError) return;

    setLoginError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (!err.response) {
          setLoginError('Unable to connect. Please check your connection and try again.');
        } else if (err.response.status === 401) {
          setLoginError('Invalid email or password. Please try again.');
        } else if (err.response.status === 403) {
          setLoginError('Your account has been disabled. Please contact your administrator.');
        } else {
          setLoginError('Something went wrong. Please try again.');
        }
      } else {
        setLoginError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy px-4">
      <h1 className="mb-8 text-2xl font-bold text-white">eVyoog ERP</h1>

      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h2 className="mb-6 text-lg font-semibold text-navy">Sign in to your account</h2>

        <form
          onSubmit={handleSubmit}
          role="form"
          aria-label="Sign in form"
          className="flex flex-col gap-4"
          noValidate
        >
          <Input
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            aria-label="Email address"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
            }}
            onBlur={() => setFieldErrors((prev) => ({ ...prev, email: validateEmail(email) }))}
            error={fieldErrors.email}
            required
          />
          <div className="relative">
            <Input
              id="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              aria-label="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }}
              onBlur={() =>
                setFieldErrors((prev) => ({ ...prev, password: validatePassword(password) }))
              }
              error={fieldErrors.password}
              className="pr-10"
              required
            />
            <EyeToggle visible={showPassword} onClick={() => setShowPassword((v) => !v)} />
          </div>

          {loginError && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {loginError}
            </div>
          )}

          <Button
            type="submit"
            loading={loading}
            aria-label="Sign in to eVyoog ERP"
            className="mt-2 w-full"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </div>

      <p className="mt-8 text-xs text-white/60">eVyoog ERP · India-first · Secure</p>
    </div>
  );
}
