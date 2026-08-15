import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import type { AccountRole, LoginPortal, Profile } from './types';

const STAFF_ROLES: AccountRole[] = ['lecturer', 'hod', 'registrar', 'finance'];
const ACCOUNT_ROLES: AccountRole[] = ['student', 'lecturer', 'hod', 'registrar', 'finance', 'admin'];

function roleMatchesPortal(role: AccountRole, portal: LoginPortal) {
  if (portal === 'staff') return STAFF_ROLES.includes(role);
  return role === portal;
}

async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, full_name, email, account_status, department_id, cohort_id, registration_number, year_of_study, class_section_id')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data || data.account_status !== 'active' || !ACCOUNT_ROLES.includes(data.role as AccountRole)) {
    throw new Error('This MIPC account is not currently available for mobile access.');
  }
  return data as Profile;
}

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  verifyOtp: (email: string, token: string, portal: LoginPortal) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const hydrate = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    if (!nextSession) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      const nextProfile = await fetchProfile(nextSession.user.id);
      setProfile(nextProfile);
    } catch {
      setProfile(null);
      await supabase.auth.signOut();
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) void hydrate(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setTimeout(() => {
        if (active) void hydrate(nextSession);
      }, 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [hydrate]);

  const verifyOtp = useCallback(async (email: string, token: string, portal: LoginPortal) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedToken = token.replace(/\s+/g, '');
    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: normalizedToken,
      type: 'email'
    });

    if (error || !data.session || !data.user) {
      throw new Error('That code is invalid or has expired. Request a new code and try again.');
    }

    let nextProfile: Profile;
    try {
      nextProfile = await fetchProfile(data.user.id);
    } catch (profileError) {
      await supabase.auth.signOut();
      throw profileError;
    }

    if (!roleMatchesPortal(nextProfile.role, portal) || nextProfile.email.trim().toLowerCase() !== normalizedEmail) {
      await supabase.auth.signOut();
      throw new Error('This account cannot use the selected MIPC portal.');
    }

    setSession(data.session);
    setProfile(nextProfile);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session) return;
    const nextProfile = await fetchProfile(session.user.id);
    setProfile(nextProfile);
  }, [session]);

  const value = useMemo<AuthContextValue>(() => ({
    loading,
    session,
    profile,
    verifyOtp,
    signOut,
    refreshProfile
  }), [loading, profile, refreshProfile, session, signOut, verifyOtp]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider.');
  return value;
}
