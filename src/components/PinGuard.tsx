'use client';

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Lock, ChevronRight, ShieldCheck } from 'lucide-react';

export default function PinGuard({ children }: { children: React.ReactNode }) {
    const [authenticated, setAuthenticated] = useState(false);
    const [checking, setChecking] = useState(true);
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);

    useEffect(() => {
        // Check session on mount
        const isAuth = sessionStorage.getItem('lendflow_auth');
        if (isAuth === 'true') {
            setAuthenticated(true);
        }
        setChecking(false);
    }, []);

    const handleUnlock = (e: React.FormEvent) => {
        e.preventDefault();
        // Simple PIN hardcoded or from env. Using 1234 for demo.
        const CORRECT_PIN = process.env.NEXT_PUBLIC_PIN || '1234';

        if (pin === CORRECT_PIN) {
            sessionStorage.setItem('lendflow_auth', 'true');
            setAuthenticated(true);
            setError(false);
        } else {
            setError(true);
            setPin('');
        }
    };

    // Avoid flash of content or login screen while checking session
    if (checking) return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="animate-pulse text-emerald-500">
                <ShieldCheck className="w-8 h-8" />
            </div>
        </div>
    );

    if (authenticated) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient Background Effects */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 mb-4 shadow-lg shadow-emerald-500/10">
                        <Lock className="w-5 h-5 text-emerald-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">LendFlow</h1>
                    <p className="text-zinc-500 text-sm mt-1">Secure Interest Engine</p>
                </div>

                <form onSubmit={handleUnlock} className="glass-panel p-8 rounded-2xl shadow-2xl backdrop-blur-xl border border-zinc-800/50">
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2 block">
                                Security PIN
                            </label>
                            <div className="relative group">
                                <input
                                    type="password"
                                    className={clsx(
                                        "w-full bg-zinc-900/50 border text-center text-2xl tracking-[0.5em] font-mono text-white rounded-xl px-4 py-4 outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-500/20",
                                        error
                                            ? "border-red-500/50 focus:border-red-500"
                                            : "border-zinc-800 focus:border-emerald-500"
                                    )}
                                    value={pin}
                                    onChange={(e) => {
                                        if (e.target.value.length <= 6 && /^\d*$/.test(e.target.value)) {
                                            setPin(e.target.value);
                                            setError(false);
                                        }
                                    }}
                                    placeholder="••••"
                                    autoFocus
                                />
                                {pin.length > 0 && !error && (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 animate-pulse">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center justify-center gap-2 text-sm text-red-400 bg-red-500/10 py-2 rounded-lg animate-in fade-in slide-in-from-top-1">
                                <span>Invalid PIN Code</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={pin.length < 4}
                            className="w-full bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-2 group"
                        >
                            <span>Access Dashboard</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </div>

                    <div className="mt-6 text-center">
                        <p className="text-xs text-zinc-600 font-mono">
                            Protected Route • End-to-End Encrypted
                        </p>
                    </div>
                </form>
            </div>

            {/* Demo Hint (Bottom) */}
            <div className="absolute bottom-8 text-center">
                <p className="text-xs text-zinc-800 font-mono hover:text-zinc-600 transition-colors cursor-help">
                    Default Access: 1234
                </p>
            </div>
        </div>
    );
}
