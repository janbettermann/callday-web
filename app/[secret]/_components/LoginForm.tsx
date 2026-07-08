import { loginAction } from "../actions";

export function LoginForm({ error }: { error: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form
        action={loginAction}
        className="w-full max-w-sm rounded-2xl border border-[#1a1d26]/[0.06] bg-white p-7 shadow-sm"
      >
        <div className="mb-6">
          <div className="font-mono text-[11px] uppercase tracking-[1.5px] text-[#1a1d26]/40">
            Internal
          </div>
          <h1 className="mt-1 text-lg font-semibold tracking-tight">
            Sign in
          </h1>
        </div>

        <label className="mb-2 block text-sm text-[#1a1d26]/70">
          Password
        </label>
        <input
          type="password"
          name="password"
          autoFocus
          required
          autoComplete="off"
          className="w-full rounded-lg border border-[#1a1d26]/12 bg-[#faf9f5] px-3 py-2.5 text-base outline-none focus:border-[#4a7af7] focus:bg-white"
        />

        {error ? (
          <p className="mt-3 text-sm text-[#dc2626]">Wrong password.</p>
        ) : null}

        <button
          type="submit"
          className="mt-5 w-full rounded-lg bg-[#3564e0] py-2.5 text-sm font-medium text-white transition hover:bg-[#2b56c4]"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
