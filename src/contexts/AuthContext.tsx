import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  // Sandbox Dev Mock features
  isSandboxMode: boolean;
  setSandboxMode: (enabled: boolean) => void;
  sandboxRole: UserRole;
  setSandboxRole: (role: UserRole) => void;
  // Auth methods
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateReputation: (points: number) => Promise<void>;
  addBadge: (badge: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sandbox modes for convenient local testing in the iframe
  const [isSandboxMode, setIsSandboxMode] = useState<boolean>(() => {
    return localStorage.getItem('ch_sandbox_mode') === 'true';
  });
  const [sandboxRole, setSandboxRoleState] = useState<UserRole>(() => {
    return (localStorage.getItem('ch_sandbox_role') as UserRole) || 'Citizen';
  });

  const setSandboxMode = (enabled: boolean) => {
    setIsSandboxMode(enabled);
    localStorage.setItem('ch_sandbox_mode', String(enabled));
    if (!enabled && auth?.currentUser) {
      // Re-trigger standard profile load
      loadProfile(auth.currentUser.uid, auth.currentUser.email || '', auth.currentUser.displayName || 'Citizen Profile');
    } else if (enabled) {
      // Set a fully detailed sandbox profile
      setProfile({
        uid: 'sandbox-user-123',
        name: `Sandbox ${sandboxRole}`,
        email: `sandbox-${sandboxRole.toLowerCase().replace(' ', '')}@example.com`,
        role: sandboxRole,
        reputation: 150,
        badges: ['Pioneer', 'Civic Minded'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  };

  const setSandboxRole = (role: UserRole) => {
    setSandboxRoleState(role);
    localStorage.setItem('ch_sandbox_role', role);
    if (isSandboxMode) {
      setProfile({
        uid: 'sandbox-user-123',
        name: `Sandbox ${role}`,
        email: `sandbox-${role.toLowerCase().replace(' ', '')}@example.com`,
        role: role,
        reputation: 150,
        badges: ['Pioneer', 'Civic Minded'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  };

  const loadProfile = async (uid: string, email: string, displayName: string) => {
    if (!db) {
      // Fallback if firestore is not ready
      setProfile({
        uid,
        name: displayName,
        email,
        role: 'Citizen',
        reputation: 0,
        badges: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return;
    }

    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        setProfile(userSnap.data() as UserProfile);
      } else {
        // Create initial default Citizen profile
        const newProfile: UserProfile = {
          uid,
          name: displayName || 'Civic Hero',
          email,
          role: 'Citizen',
          reputation: 25, // starting bonus
          badges: ['Civic Pioneer'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(userRef, newProfile);
        setProfile(newProfile);
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
      // Fail gracefully with a temporary client state
      setProfile({
        uid,
        name: displayName,
        email,
        role: 'Citizen',
        reputation: 25,
        badges: ['Civic Pioneer'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  };

  useEffect(() => {
    if (isSandboxMode) {
      setProfile({
        uid: 'sandbox-user-123',
        name: `Sandbox ${sandboxRole}`,
        email: `sandbox-${sandboxRole.toLowerCase().replace(' ', '')}@example.com`,
        role: sandboxRole,
        reputation: 150,
        badges: ['Pioneer', 'Civic Minded'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setLoading(false);
      return;
    }

    if (!auth) {
      // Fallback mode if auth service is not active
      setSandboxMode(true);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setError(null);
      if (firebaseUser) {
        setUser(firebaseUser);
        await loadProfile(
          firebaseUser.uid, 
          firebaseUser.email || '', 
          firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Citizen'
        );
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [isSandboxMode, sandboxRole]);

  // Auth Functions
  const loginWithEmail = async (email: string, password: string) => {
    if (!auth) throw new Error('Auth is not initialized');
    setError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      setUser(cred.user);
      setIsSandboxMode(false);
      localStorage.setItem('ch_sandbox_mode', 'false');
    } catch (err: any) {
      setError(err.message || 'Failed to login');
      throw err;
    }
  };

  const registerWithEmail = async (email: string, password: string, name: string) => {
    if (!auth) throw new Error('Auth is not initialized');
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      setUser(cred.user);
      setIsSandboxMode(false);
      localStorage.setItem('ch_sandbox_mode', 'false');
      // Wait for profile setup
      await loadProfile(cred.user.uid, email, name);
    } catch (err: any) {
      setError(err.message || 'Failed to register');
      throw err;
    }
  };

  const loginWithGoogle = async () => {
    if (!auth) throw new Error('Auth is not initialized');
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      setUser(cred.user);
      setIsSandboxMode(false);
      localStorage.setItem('ch_sandbox_mode', 'false');
    } catch (err: any) {
      setError(err.message || 'Google Sign-In failed');
      throw err;
    }
  };

  const logout = async () => {
    setIsSandboxMode(false);
    localStorage.removeItem('ch_sandbox_mode');
    setUser(null);
    setProfile(null);
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const updateReputation = async (points: number) => {
    if (!profile) return;
    const newRep = Math.max(0, profile.reputation + points);
    
    // Update local profile state
    const updated = { ...profile, reputation: newRep, updatedAt: new Date().toISOString() };
    setProfile(updated);

    if (isSandboxMode || !db) return;

    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, { reputation: newRep, updatedAt: new Date().toISOString() });
    } catch (err) {
      console.error('Failed to update reputation in Firestore:', err);
    }
  };

  const addBadge = async (badge: string) => {
    if (!profile) return;
    if (profile.badges.includes(badge)) return;

    const newBadges = [...profile.badges, badge];
    const updated = { ...profile, badges: newBadges, updatedAt: new Date().toISOString() };
    setProfile(updated);

    if (isSandboxMode || !db) return;

    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, { badges: newBadges, updatedAt: new Date().toISOString() });
    } catch (err) {
      console.error('Failed to add badge in Firestore:', err);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      error,
      isSandboxMode,
      setSandboxMode,
      sandboxRole,
      setSandboxRole,
      loginWithEmail,
      registerWithEmail,
      loginWithGoogle,
      logout,
      updateReputation,
      addBadge
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
