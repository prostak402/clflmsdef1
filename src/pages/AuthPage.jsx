import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/useApp'
import { Film, Mail, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react'
import './AuthPage.css'

const DEMO_PASSWORD = 'demo-password'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const { user, hasCompletedOnboarding, login, sessionExpired } = useApp()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) {
      return
    }

    navigate(hasCompletedOnboarding ? '/feed' : '/genres', { replace: true })
  }, [hasCompletedOnboarding, navigate, user])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (loading) {
      return
    }

    setLoading(true)
    setSubmitError('')

    try {
      await login(
        isLogin
          ? { email: formData.email, password: formData.password, mode: 'signin' }
          : {
              displayName: formData.name,
              email: formData.email,
              password: formData.password,
              mode: 'signup',
            }
      )
      navigate('/genres')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  const signInDemo = async (email) => {
    if (loading) {
      return
    }

    setLoading(true)
    setSubmitError('')

    try {
      await login({ email, password: DEMO_PASSWORD, mode: 'signin' })
      navigate('/genres')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

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

          {sessionExpired && (
            <p className="auth-session-expired">Session expired. Please sign in again.</p>
          )}
          {submitError && <p className="auth-session-expired">{submitError}</p>}

          <form className="auth-form" onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="auth-field">
                <div className="auth-input-wrapper">
                  <User size={18} className="auth-input-icon" />
                  <input
                    type="text"
                    placeholder="Your name"
                    value={formData.name}
                    onChange={(event) => setFormData({ ...formData, name: event.target.value })}
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
                  onChange={(event) => setFormData({ ...formData, email: event.target.value })}
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
                  onChange={(event) => setFormData({ ...formData, password: event.target.value })}
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
            <button className="auth-social-btn glass" onClick={() => signInDemo('user@local.dev')}>
              <span className="auth-social-icon">🎬</span>
              <span>Demo Account</span>
            </button>
            <button className="auth-social-btn glass" onClick={() => signInDemo('admin@local.dev')}>
              <span className="auth-social-icon">👑</span>
              <span>Admin Demo</span>
            </button>
          </div>
        </div>

        <p className="auth-footer">By continuing, you agree to our Terms of Service</p>
      </div>
    </div>
  )
}
