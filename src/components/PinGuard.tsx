'use client';

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
// We reused global classes like 'glass-panel', 'input', 'btn'

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
    if (checking) return null; // or accessible loading spinner

    if (authenticated) {
        return <>{children}</>;
    }

    return (
        <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="text-center">
                <h1 className="text-3xl font-bold tracking-tight mb-2">LendFlow</h1>
                <p className="text-muted">Secure Interest Engine</p>
            </div>

            <form onSubmit={handleUnlock} className="glass-panel" style={{ width: '100%', maxWidth: '320px', padding: '2rem' }}>
                <div className="mb-4">
                    <label className="text-sm text-muted mb-1 block">Security PIN</label>
                    <input
                        type="password"
                        className={clsx("input", error && "border-red-500")}
                        value={pin}
                        onChange={(e) => { setPin(e.target.value); setError(false); }}
                        placeholder="Enter PIN"
                        maxLength={6}
                        autoFocus
                    />
                </div>

                {error && <p className="text-sm text-center mb-4 text-red-500">Access Denied</p>}

                <button type="submit" className="btn btn-primary w-full">
                    Unlock System
                </button>
                <p className="text-xs text-center mt-4 text-muted">(Default: 1234)</p>
            </form>
        </div>
    );
}
