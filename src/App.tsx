import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { 
  Shield, 
  User, 
  MapPin, 
  Award, 
  LogOut, 
  Flame, 
  AlertCircle, 
  Lock, 
  Mail, 
  Key, 
  Plus, 
  CheckCircle, 
  Menu, 
  X,
  Compass,
  FileText,
  BarChart3,
  HelpCircle,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DiscoveryFeed } from './components/DiscoveryFeed';
import { ReportIssueForm } from './components/ReportIssueForm';
import { InteractiveMap } from './components/InteractiveMap';
import { OfficerWorkspace } from './components/OfficerWorkspace';
import { AdminPanel } from './components/AdminPanel';
import { UserRole } from './types';

function AppContent() {
  const { 
    profile, 
    loginWithEmail, 
    registerWithEmail, 
    loginWithGoogle,
    logout, 
    isSandboxMode, 
    setSandboxMode, 
    sandboxRole, 
    setSandboxRole,
    loading
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Core navigation tabs
  const [activeTab, setActiveTab] = useState<'feed' | 'map' | 'report' | 'officer' | 'admin'>('feed');
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4" id="app-loading-screen">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" id="loading-spinner"></div>
        <p className="text-slate-600 font-display font-medium animate-pulse" id="loading-text">Loading Community Hero...</p>
      </div>
    );
  }

  // If not logged in, render an elegant authentication page
  if (!profile) {
    const handleAuthSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setAuthError(null);
      if (!email || !password) {
        setAuthError('Please fill in all fields');
        return;
      }
      try {
        if (isRegistering) {
          if (!name) {
            setAuthError('Please enter your name');
            return;
          }
          await registerWithEmail(email, password, name);
        } else {
          await loginWithEmail(email, password);
        }
      } catch (err: any) {
        setAuthError(err.message || 'Authentication failed');
      }
    };

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row" id="auth-page">
        {/* Left column: Visual branding */}
        <div className="bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900 text-white flex-1 p-8 md:p-16 flex flex-col justify-between relative overflow-hidden" id="auth-left-branding">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-10 -left-10 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl"></div>
          
          <div className="flex items-center gap-2.5 relative z-10" id="brand-logo-container">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md border border-white/20">
              <Shield className="w-6 h-6 text-blue-300" />
            </div>
            <span className="text-xl font-display font-bold tracking-tight">Community Hero</span>
          </div>

          <div className="max-w-md my-auto relative z-10 py-12 md:py-0" id="auth-marketing-content">
            <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-semibold tracking-wide border border-blue-500/30">
              CIVIC ACCOUNTABILITY PLATFORM
            </span>
            <h1 className="text-4xl md:text-5xl font-display font-extrabold tracking-tight text-white mt-4 leading-tight">
              Report. Resolve. <br />
              <span className="text-blue-300">Rebuild Trust.</span>
            </h1>
            <p className="text-slate-300 mt-4 leading-relaxed text-sm md:text-base">
              The AI-powered portal bridging the gap between proactive citizens and city services. Report neighborhood issues, track resolution lifecycles with transparent audits, and earn reputation badges.
            </p>
          </div>

          <div className="text-xs text-slate-400 border-t border-white/10 pt-4 relative z-10" id="auth-footer-tag">
            Empowering Municipal Transparency and Civil Verification.
          </div>
        </div>

        {/* Right column: Auth & Sandbox fallback container */}
        <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-white" id="auth-right-container">
          <div className="w-full max-w-md" id="auth-card">
            <div className="mb-6">
              <h2 className="text-2xl font-display font-bold text-slate-900" id="auth-title">
                {isRegistering ? 'Create citizen account' : 'Welcome back, Hero'}
              </h2>
              <p className="text-sm text-slate-500 mt-1" id="auth-subtitle">
                {isRegistering ? 'Join your local neighborhood action network.' : 'Sign in to monitor ongoing neighborhood resolutions.'}
              </p>
            </div>

            {authError && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex flex-col gap-3 mb-5 shadow-xs" id="auth-error-box">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-800">Authentication Issue Detected</p>
                    <p className="mt-1 leading-relaxed text-slate-600">
                      {authError.includes('auth/operation-not-allowed') 
                        ? 'Email/Password authentication is not yet enabled in your Firebase console. Please go to your Firebase Console -> Build -> Authentication -> Sign-in Method, and enable Email/Password.'
                        : authError}
                    </p>
                  </div>
                </div>
                
                <div className="pt-2 border-t border-red-100 flex flex-col gap-1.5">
                  <p className="font-medium text-slate-500 text-[10px] uppercase tracking-wider">Hackathon Quick Bypass:</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSandboxRole('Citizen');
                      setSandboxMode(true);
                    }}
                    className="w-full py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold text-center transition-all duration-150 shadow-sm shadow-red-200"
                  >
                    ⚡ Launch Offline Sandbox Mode (No Setup Required)
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4" id="auth-form">
              {isRegistering && (
                <div id="register-name-field">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe" 
                      className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hero@municipality.gov" 
                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Password</label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" 
                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm transition-all duration-200 glow-btn"
                id="submit-auth-btn"
              >
                {isRegistering ? 'Create Free Account' : 'Sign In'}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-4" id="auth-divider">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                <span className="bg-white px-3 text-slate-400 font-bold">Or secure access via</span>
              </div>
            </div>

            {/* Google Sign-In Button */}
            <button
              type="button"
              onClick={async () => {
                setAuthError(null);
                try {
                  await loginWithGoogle();
                } catch (err: any) {
                  setAuthError(err.message || 'Google Sign-In failed');
                }
              }}
              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 font-bold py-2 rounded-lg text-xs transition-all duration-150 shadow-xs cursor-pointer"
              id="google-auth-btn"
            >
              <Compass className="w-4 h-4 text-blue-600" />
              <span>Continue with Google</span>
            </button>

            <div className="mt-4 text-center" id="auth-switch-prompt">
              <button 
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setAuthError(null);
                }} 
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Register as Citizen"}
              </button>
            </div>

            {/* SANDBOX DEV BYPASS PANEL */}
            <div className="mt-8 pt-6 border-t border-slate-100" id="sandbox-bypass-panel">
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 text-center">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-[10px] font-bold tracking-wide mb-2 uppercase">
                  Sandbox Testing Tool
                </span>
                <p className="text-xs text-slate-500 mb-3">
                  Instantly bypass authentication and login as any stakeholding role to test specific platform dashboard features.
                </p>
                <div className="grid grid-cols-2 gap-1.5" id="sandbox-role-selection-grid">
                  <button 
                    onClick={() => {
                      setSandboxRole('Citizen');
                      setSandboxMode(true);
                    }}
                    className="py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-all"
                  >
                    Citizen View
                  </button>
                  <button 
                    onClick={() => {
                      setSandboxRole('Officer');
                      setSandboxMode(true);
                    }}
                    className="py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-all"
                  >
                    Officer View
                  </button>
                  <button 
                    onClick={() => {
                      setSandboxRole('Department Head');
                      setSandboxMode(true);
                    }}
                    className="py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-all col-span-2"
                  >
                    Department Head Panel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Logged-in Core Dashboard Layout
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" id="app-shell">
      
      {/* 1. Header Navigation Bar */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm px-4 lg:px-6 py-3" id="main-header">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-blue-600 text-white rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-display font-bold tracking-tight text-slate-900 leading-none">Community Hero</h1>
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Civic Accountability</span>
            </div>
          </div>

          {/* Sandbox Controls directly inside the top navigation bar */}
          <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-xl text-xs" id="header-sandbox-tools">
            <span className="font-semibold text-slate-500 px-1.5">Sandbox Mode:</span>
            <button 
              onClick={() => setSandboxMode(!isSandboxMode)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                isSandboxMode 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'bg-transparent text-slate-600 hover:bg-slate-200'
              }`}
            >
              {isSandboxMode ? 'ON' : 'OFF'}
            </button>
            {isSandboxMode && (
              <select 
                value={sandboxRole}
                onChange={(e) => setSandboxRole(e.target.value as UserRole)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-medium focus:outline-none"
              >
                <option value="Citizen">Citizen Role</option>
                <option value="Officer">Officer Role</option>
                <option value="Department Head">Dept Head Role</option>
                <option value="Super Admin">Admin Role</option>
              </select>
            )}
          </div>

          {/* User profile capsule */}
          <div className="flex items-center gap-3" id="header-user-profile">
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-900">{profile.name}</span>
              <span className="text-[10px] text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 mt-0.5 self-end font-semibold">
                {profile.role}
              </span>
            </div>
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm relative">
              {profile.name[0]}
              {profile.reputation > 0 && (
                <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-0.5 border-2 border-white flex items-center justify-center">
                  <Award className="w-2.5 h-2.5" />
                </div>
              )}
            </div>
            <button 
              onClick={logout}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-red-600 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Sandbox controller banner on mobile */}
      <div className="md:hidden bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center justify-between text-xs" id="mobile-sandbox-banner">
        <span className="font-medium text-slate-700">Sandbox Test Settings:</span>
        <select 
          value={sandboxRole}
          onChange={(e) => {
            setSandboxMode(true);
            setSandboxRole(e.target.value as UserRole);
          }}
          className="bg-white border border-slate-200 rounded px-1 py-0.5 text-slate-700 font-semibold focus:outline-none"
        >
          <option value="Citizen">Citizen</option>
          <option value="Officer">Officer</option>
          <option value="Department Head">Dept Head</option>
          <option value="Super Admin">Admin</option>
        </select>
      </div>

      {/* 2. Platform Navigation & Page Feed Layout */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto" id="dashboard-body">
        
        {/* Responsive Side Menu */}
        <aside className="w-full lg:w-64 bg-white lg:border-r border-slate-100 p-4 shrink-0" id="sidebar-navigation">
          {/* Reputation Indicator widget */}
          <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-200/50">
            <div className="flex items-center gap-2 text-slate-700">
              <Flame className="w-4 h-4 text-orange-500 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider">Reputation Status</span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold font-display text-slate-900">{profile.reputation}</span>
              <span className="text-xs text-slate-400">Points</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {profile.badges.map((b) => (
                <span key={b} className="text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-100 rounded-md px-1.5 py-0.5">
                  🏆 {b}
                </span>
              ))}
            </div>
          </div>

          {/* Navigation Items filtered based on active roles */}
          <nav className="space-y-1">
            <button 
              onClick={() => setActiveTab('feed')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'feed' 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Discovery Feed</span>
            </button>
            <button 
              onClick={() => setActiveTab('map')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'map' 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>Interactive Map</span>
            </button>
            
            {profile.role === 'Citizen' && (
              <button 
                onClick={() => setActiveTab('report')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeTab === 'report' 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>File New Report</span>
              </button>
            )}

            {(profile.role === 'Officer' || profile.role === 'Department Head' || profile.role === 'Super Admin') && (
              <button 
                onClick={() => setActiveTab('officer')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeTab === 'officer' 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>Officer Workspace</span>
              </button>
            )}

            {(profile.role === 'Department Head' || profile.role === 'Super Admin') && (
              <button 
                onClick={() => setActiveTab('admin')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeTab === 'admin' 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Admin Panel</span>
              </button>
            )}
          </nav>
        </aside>

        {/* 3. Main Dashboard Window Feed */}
        <main className="flex-1 p-4 lg:p-6" id="dashboard-main-panel">
          <AnimatePresence mode="wait">
            {activeTab === 'feed' && (
              <motion.div 
                key="feed"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-xl lg:text-2xl font-display font-extrabold text-slate-950">Civic Discovery Feed</h2>
                  <p className="text-xs text-slate-500 mt-1">Explore ongoing issues and support pending resolutions in your neighborhood.</p>
                </div>

                <DiscoveryFeed 
                  onReportNew={() => setActiveTab('report')} 
                  selectedIssueId={selectedIssueId} 
                  onClearSelectedIssue={() => setSelectedIssueId(null)}
                />
              </motion.div>
            )}

            {activeTab === 'map' && (
              <motion.div 
                key="map"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div>
                  <h2 className="text-xl lg:text-2xl font-display font-extrabold text-slate-950">Interactive Heatmap</h2>
                  <p className="text-xs text-slate-500 mt-1">Live tracking of reported incidents using coordinates with customized status icons.</p>
                </div>
                <InteractiveMap 
                  onViewIssue={(issueId) => {
                    setSelectedIssueId(issueId);
                    setActiveTab('feed');
                  }} 
                />
              </motion.div>
            )}

            {activeTab === 'report' && (
              <motion.div 
                key="report"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div>
                  <h2 className="text-xl lg:text-2xl font-display font-extrabold text-slate-950">File New Citizen Report</h2>
                  <p className="text-xs text-slate-500 mt-1">Submit visual or speech-to-text proof of issues. AI generates the summary and routes to correct departments.</p>
                </div>
                
                <ReportIssueForm 
                  onSuccess={(issueId) => {
                    setSelectedIssueId(issueId);
                    setActiveTab('feed');
                  }}
                  onViewIssue={(issueId) => {
                    setSelectedIssueId(issueId);
                    setActiveTab('feed');
                  }}
                />
              </motion.div>
            )}

            {activeTab === 'officer' && (
              <motion.div 
                key="officer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div>
                  <h2 className="text-xl lg:text-2xl font-display font-extrabold text-slate-950">Officer Queue Workspace</h2>
                  <p className="text-xs text-slate-500 mt-1">View delegated incident assignments, manage statuses, and initiate community double-blind verification.</p>
                </div>
                <OfficerWorkspace />
              </motion.div>
            )}

            {activeTab === 'admin' && (
              <motion.div 
                key="admin"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div>
                  <h2 className="text-xl lg:text-2xl font-display font-extrabold text-slate-950">Admin Analytics Panel</h2>
                  <p className="text-xs text-slate-500 mt-1">High-level municipality statistics, response speed charts, department rankings, and mock database controllers.</p>
                </div>
                <AdminPanel />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
