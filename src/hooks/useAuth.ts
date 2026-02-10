import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Send welcome email on first sign-up
        if (event === 'SIGNED_IN' && session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('created_at')
            .eq('user_id', session.user.id)
            .single();

          if (profile) {
            const createdAt = new Date(profile.created_at);
            const now = new Date();
            const diffMs = now.getTime() - createdAt.getTime();
            // If profile was created less than 30 seconds ago, send welcome email
            if (diffMs < 30000) {
              try {
                await supabase.functions.invoke('send-welcome-email', {
                  body: {
                    email: session.user.email,
                    displayName:
                      session.user.user_metadata?.full_name ||
                      session.user.user_metadata?.name ||
                      '',
                  },
                });
              } catch (e) {
                console.error('Failed to send welcome email:', e);
              }
            }
          }
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, session, loading, signOut };
}
