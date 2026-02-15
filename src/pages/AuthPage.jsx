import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { Film, Mail, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react';
import './AuthPage.css';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { user, hasCompletedOnboarding, login } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    navigate(hasCompletedOnboarding ? '/feed' : '/genres', { replace: true });
  }, [user, hasCompletedOnboarding, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setTimeout(() => {
      login({
        name: formData.name || formData.email.split('@')[0],
        email: formData.email,
        avatar: null,
        isAdmin: formData.email === 'admin@clipflow.com',
      });
      setLoading(false);
      navigate('/genres');
    }, 800);
  };

  return (
    <div className="auth-page">
      <div className="auth-bg-effects">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
      </div>

      <div className="auth-container">
        <div className="auth-brand">
          <div className="auth-logo">
            <Film size={32} />
          </div>
          <h1 className="auth-title">ClipFlow</h1>
          <p className="auth-subtitle">Discover your next favorite movie</p>
        </div>

        <div className="auth-card glass-strong">
          <div className="auth-tabs">
            <button
              className={`auth-tab ${isLogin ? 'active' : ''}`}
              onClick={() => setIsLogin(true)}
            >
              Sign In
            </button>
            <button
              className={`auth-tab ${!isLogin ? 'active' : ''}`}
              onClick={() => setIsLogin(false)}
            >
              Sign Up
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="auth-field">
                <div className="auth-input-wrapper">
                  <User size={18} className="auth-input-icon" />
                  <input
                    type="text"
                    placeholder="Your name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            <div className="auth-field">
              <div className="auth-input-wrapper">
                <Mail size={18} className="auth-input-icon" />
                <input
                  type="email"
                  placeholder="Email address"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <div className="auth-input-wrapper">
                <Lock size={18} className="auth-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  className="auth-toggle-pw"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {isLogin && (
              <div className="auth-forgot">
                <button type="button">Forgot password?</button>
              </div>
            )}

            <button
              type="submit"
              className={`auth-submit ${loading ? 'loading' : ''}`}
              disabled={loading}
            >
              <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
              {!loading && <ArrowRight size={18} />}
              {loading && <div className="auth-spinner" />}
            </button>
          </form>

          <div className="auth-divider">
            <span>or continue with</span>
          </div>

          <div className="auth-social">
            <button className="auth-social-btn glass" onClick={() => {
              login({ name: 'Demo User', email: 'demo@clipflow.com', avatar: null, isAdmin: false });
              navigate('/genres');
            }}>
              <span className="auth-social-icon">🎬</span>
              <span>Demo Account</span>
            </button>
            <button className="auth-social-btn glass" onClick={() => {
              login({ name: 'Admin', email: 'admin@clipflow.com', avatar: null, isAdmin: true });
              navigate('/genres');
            }}>
              <span className="auth-social-icon">👑</span>
              <span>Admin Demo</span>
            </button>
          </div>
        </div>

        <p className="auth-footer">
          By continuing, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
