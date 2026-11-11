
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  UserRound,
  Mail,
  LockKeyhole,
  Save,
  Loader2,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Settings,
  IndianRupee,
  Eye,
  EyeOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState({
    fullName: "",
    currency: "INR",
  });

  const [passwords, setPasswords] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadProfile = useCallback(async () => {
    const { data, error: authError } =
      await supabase.auth.getUser();

    if (authError || !data.user) {
      router.replace("/login");
      return;
    }

    setEmail(data.user.email ?? "");

    setProfile({
      fullName: data.user.user_metadata?.full_name ?? "",
      currency: data.user.user_metadata?.currency ?? "INR",
    });

    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!profile.fullName.trim()) {
      setError("Please enter your display name.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        full_name: profile.fullName.trim(),
        currency: profile.currency,
      },
    });

    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage("Profile updated successfully.");
    }

    setSaving(false);
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (passwords.newPassword.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (passwords.newPassword !== passwords.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    setError("");
    setMessage("");

    const { error: passwordError } = await supabase.auth.updateUser({
      password: passwords.newPassword,
    });

    if (passwordError) {
      setError(passwordError.message);
    } else {
      setMessage("Password changed successfully.");
      setPasswords({
        newPassword: "",
        confirmPassword: "",
      });
    }

    setPasswordSaving(false);
  }

  async function handleLogout() {
    setLoggingOut(true);
    setError("");

    const { error: logoutError } = await supabase.auth.signOut();

    if (logoutError) {
      setError(logoutError.message);
      setLoggingOut(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1120] text-white">
        <div className="text-center">
          <Loader2
            size={32}
            className="mx-auto mb-4 animate-spin text-indigo-400"
          />
          <p className="text-sm text-slate-400">
            Loading settings...
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b1120] px-4 py-6 text-slate-100 md:px-8">

      <div className="mx-auto max-w-4xl">

        <header className="mb-8">
          <button
            onClick={() => router.push("/")}
            className="mb-4 flex items-center gap-2 text-sm text-slate-400 hover:text-white"
          >
            <ArrowLeft size={17} />
            Back to Dashboard
          </button>

          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-500/15 p-3 text-indigo-400">
              <Settings size={25} />
            </div>

            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="mt-1 text-sm text-slate-400">
                Manage your account and preferences.
              </p>
            </div>
          </div>
        </header>

        {message && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-400">
            <CheckCircle2 size={19} />
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
            <AlertCircle size={19} />
            {error}
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-slate-800 bg-[#151e30] p-6">

          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl bg-indigo-500/15 p-3 text-indigo-400">
              <UserRound size={22} />
            </div>

            <div>
              <h2 className="text-lg font-semibold">
                Profile Information
              </h2>
              <p className="text-xs text-slate-400">
                Manage your personal account details.
              </p>
            </div>
          </div>

          <form onSubmit={saveProfile} className="space-y-5">

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Display Name
              </label>

              <input
                required
                maxLength={80}
                value={profile.fullName}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    fullName: e.target.value,
                  })
                }
                placeholder="Enter your name"
                className="w-full rounded-xl border border-slate-700 bg-[#0b1120] px-4 py-3 text-sm outline-none transition focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Email Address
              </label>

              <div className="relative">
                <Mail
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                />

                <input
                  readOnly
                  value={email}
                  className="w-full cursor-not-allowed rounded-xl border border-slate-800 bg-slate-900/60 py-3 pl-11 pr-4 text-sm text-slate-400 outline-none"
                />
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Your registered email address.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Preferred Currency
              </label>

              <div className="relative">
                <IndianRupee
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                />

                <select
                  value={profile.currency}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      currency: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-[#0b1120] py-3 pl-11 pr-4 text-sm outline-none focus:border-indigo-500"
                >
                  <option value="INR">INR — Indian Rupee (₹)</option>
                  <option value="USD">USD — US Dollar ($)</option>
                  <option value="EUR">EUR — Euro (€)</option>
                  <option value="GBP">GBP — British Pound (£)</option>
                </select>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                This preference is saved to your account.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Save size={17} />
              )}
              {saving ? "Saving..." : "Save Profile"}
            </button>

          </form>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-800 bg-[#151e30] p-6">

          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl bg-amber-500/15 p-3 text-amber-400">
              <LockKeyhole size={22} />
            </div>

            <div>
              <h2 className="text-lg font-semibold">
                Security & Password
              </h2>
              <p className="text-xs text-slate-400">
                Update your account password.
              </p>
            </div>
          </div>

          <form onSubmit={changePassword} className="space-y-5">

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                New Password
              </label>

              <div className="relative">
                <input
                  required
                  minLength={8}
                  type={showPassword ? "text" : "password"}
                  value={passwords.newPassword}
                  onChange={(e) =>
                    setPasswords({
                      ...passwords,
                      newPassword: e.target.value,
                    })
                  }
                  placeholder="Enter new password"
                  className="w-full rounded-xl border border-slate-700 bg-[#0b1120] px-4 py-3 pr-12 text-sm outline-none focus:border-indigo-500"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Confirm New Password
              </label>

              <div className="relative">
                <input
                  required
                  minLength={8}
                  type={showConfirmPassword ? "text" : "password"}
                  value={passwords.confirmPassword}
                  onChange={(e) =>
                    setPasswords({
                      ...passwords,
                      confirmPassword: e.target.value,
                    })
                  }
                  placeholder="Confirm new password"
                  className="w-full rounded-xl border border-slate-700 bg-[#0b1120] px-4 py-3 pr-12 text-sm outline-none focus:border-indigo-500"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  aria-label="Toggle confirmation password visibility"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Use at least 8 characters. Supabase may also enforce additional password requirements.
            </p>

            <button
              type="submit"
              disabled={passwordSaving}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-6 py-3 text-sm font-semibold transition hover:bg-slate-800 disabled:opacity-50"
            >
              {passwordSaving && (
                <Loader2 size={17} className="animate-spin" />
              )}
              {passwordSaving ? "Updating..." : "Update Password"}
            </button>

          </form>
        </section>

        <section className="rounded-2xl border border-rose-500/20 bg-[#151e30] p-6">

          <div className="mb-5">
            <h2 className="text-lg font-semibold text-rose-400">
              Account Actions
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Sign out of your SpendWise account on this session.
            </p>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-2 rounded-xl border border-rose-500/30 px-5 py-3 text-sm font-semibold text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-50"
          >
            {loggingOut ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <LogOut size={18} />
            )}

            {loggingOut ? "Signing out..." : "Logout"}
          </button>

        </section>

        <footer className="mt-8 text-center text-xs text-slate-600">
          SpendWise v1.0.0 · Account Settings
        </footer>

      </div>
    </main>
  );
}
