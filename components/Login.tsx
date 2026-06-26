import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { Loader } from './Loader.tsx';

interface LoginProps {
    onSwitchToForgotPassword: () => void;
    onSwitchToTenantRegister: () => void;
    isSuperAdmin?: boolean;
}

export const Login: React.FC<LoginProps> = ({ onSwitchToForgotPassword, onSwitchToTenantRegister, isSuperAdmin = false }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const { login, error, isLoading } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (isSuperAdmin) {
            // Superadmin login - use regular login
            await login(username, password);
        } else {
            // Tenant login - auto-find tenant by username
            await loginTenantAuto(username, password);
        }
    };

    const loginTenantAuto = async (username: string, password: string) => {
        try {
            // First, try to find which tenant this user belongs to
            const response = await fetch('/api/tenants/find-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'User not found in any tenant');
            }

            // Now login to the specific tenant
            const loginResponse = await fetch(`/tenant/${data.tenantSlug}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const loginData = await loginResponse.json();

            if (!loginResponse.ok) {
                throw new Error(loginData.error || 'Invalid credentials');
            }

            // Store token with tenant context
            localStorage.setItem('authToken', loginData.token);
            localStorage.setItem('tenantSlug', data.tenantSlug);
            localStorage.setItem('tenantId', loginData.tenantId);

            // Redirect to tenant dashboard
            window.location.href = `/tenant/${data.tenantSlug}/dashboard`;
        } catch (err: any) {
            throw err;
        }
    };

    return (
        <div className="w-full max-w-md">
            <div className="glass-card shadow-glass-lg">
                <h2 className="text-2xl font-bold text-center text-slate-800 dark:text-slate-200 mb-6">
                    {isSuperAdmin ? 'Superadmin Login' : 'Tenant Login'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-600 rounded-xl text-red-700 dark:text-red-300 text-sm">
                            {error}
                        </div>
                    )}
                    
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Username</label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            autoComplete="username"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="mt-1 block w-full glass-panel px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[--color-primary-500] focus:border-[--color-primary-500 transition-all"
                        />
                    </div>
                    <div>
                        <label htmlFor="password"className="block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 block w-full glass-panel px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[--color-primary-500] focus:border-[--color-primary-500] transition-all"
                        />
                    </div>
                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center py-3 px-4 gradient-primary text-white rounded-xl shadow-glass hover:shadow-glass-lg transition-all hover:-translate-y-0.5 disabled:opacity-50 font-semibold"
                        >
                            {isLoading ? <Loader /> : 'Sign in'}
                        </button>
                    </div>
                </form>
                {!isSuperAdmin && (
                    <>
                    <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
                        <button onClick={onSwitchToTenantRegister} className="font-medium text-[--color-primary-600] hover:text-[--color-primary-500]">
                            Register as New Tenant
                        </button>
                    </p>
                    <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                        Are you the superadmin?{' '}
                        <a href="/superadmin/login" className="font-medium text-[--color-primary-600] hover:text-[--color-primary-500]">
                            Login here
                        </a>
                    </p>
                    </>
                )}
                {isSuperAdmin && (
                    <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
                        Tenant?{' '}
                        <a href="/login" className="font-medium text-[--color-primary-600] hover:text-[--color-primary-500]">
                            Login here
                        </a>
                    </p>
                )}
            </div>
        </div>
    );
};