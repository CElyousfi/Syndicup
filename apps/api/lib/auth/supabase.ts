/**
 * Client Supabase Auth côté serveur — les endpoints /auth/* de l'API sont des proxys fins vers
 * GoTrue (Master Spec Partie 4.3) : l'API reste le seul point d'entrée des clients
 * (CLAUDE.md §1.7 — Flutter/web ne parlent jamais à la base ; Auth Supabase est l'exception
 * autorisée, mais on garde le contrat /auth/* stable côté API).
 *
 * Interface volontairement minimale + injectable (tests : mock de SupabaseAuthPort, la CI n'a
 * pas de GoTrue). En local, l'OTP SMS utilise les numéros de test de supabase/config.toml
 * ([auth.sms.test_otp]) — mock SMS en attendant l'agrégateur marocain (ROADMAP, notes).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SessionTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface SupabaseAuthPort {
  otpRequest(telephone: string): Promise<{ error: string | null }>;
  otpVerify(
    telephone: string,
    code: string
  ): Promise<{ session: SessionTokens | null; userId: string | null; error: string | null }>;
  loginEmail(
    email: string,
    motDePasse: string
  ): Promise<{ session: SessionTokens | null; userId: string | null; error: string | null }>;
  refresh(refreshToken: string): Promise<{ session: SessionTokens | null; error: string | null }>;
}

function toTokens(s: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
} | null): SessionTokens | null {
  return s
    ? {
        access_token: s.access_token,
        refresh_token: s.refresh_token,
        expires_in: s.expires_in,
      }
    : null;
}

export function createSupabaseAuth(): SupabaseAuthPort {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY manquants.");
  }
  const client: SupabaseClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async otpRequest(telephone) {
      const { error } = await client.auth.signInWithOtp({ phone: telephone });
      return { error: error?.message ?? null };
    },
    async otpVerify(telephone, code) {
      const { data, error } = await client.auth.verifyOtp({
        phone: telephone,
        token: code,
        type: "sms",
      });
      return {
        session: toTokens(data.session),
        userId: data.user?.id ?? null,
        error: error?.message ?? null,
      };
    },
    async loginEmail(email, motDePasse) {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password: motDePasse,
      });
      return {
        session: toTokens(data.session),
        userId: data.user?.id ?? null,
        error: error?.message ?? null,
      };
    },
    async refresh(refreshToken) {
      const { data, error } = await client.auth.refreshSession({
        refresh_token: refreshToken,
      });
      return { session: toTokens(data.session), error: error?.message ?? null };
    },
  };
}
