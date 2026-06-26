import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { Loader } from './Loader.tsx';

interface LoginProps {
    onSwitchToForgotPassword: () => void;
    onSwitchToTenantRegister: () => void;
}

export const Login: React.FC<LoginProps> = ({ onSwitchToForgotPassword, onSwitchToTenantRegister }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [tenantSlug, setTenantSlug] = useState('');
    const [showTenantLogin, setShowTenantLogin] = useState(false);
    const { login, error, isLoading } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (showTenantLogin) {
            // Redirect to tenant login page
            window.location.href = `/tenant/${tenantSlug}/login`;
            return;
        }
        
        await login(username, password);
    };

    return (
        <div className="w-full max-w-md">
            <div className="glass-card shadow-glass-lg">
                <h2 className="text-2xl font-bold text-center text-slate-800 dark:text-slate-200 mb-6">
                    {showTenantLogin ? 'Tenant Login' : 'Login to Panel'}
                </h2>
                
                {showTenantLogin ? (
                    // Tenant Login Form
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="tenantSlug" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Tenant Slug
                            </label>
                            <input
                                id="tenantSlug"
                                type="text"
                                required
                                value={tenantSlug}
                                onChange={(e) => setTenantSlug(e.target.value.toLowerCase())}
                                className="mt-1 block w-full glass-panel px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[--color-primary-500] transition-all"
                                placeholder="e.g., cityconnect"
                            />
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Enter your tenant identifier
                            </p>
                        </div>
                        <button
                            type="submit"
                            className="w-full flex justify-center py-3 px-4 gradient-primary text-white rounded-xl shadow-glass hover:shadow-glass-lg transition-all hover:-translate-y-0.5 font-semibold"
                        >
                            Continue to Tenant Login
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowTenantLogin(false)}
                            className="w-full glass-button py-3 px-4 rounded-xl text-slate-700 dark:text-slate-200 font-medium"
                        >
                            Back to Superadmin Login
                        </button>
                    </form>
                ) : (
                    // Superadmin Login Form
                    <>
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
                <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
                    <button onClick={onSwitchToForgotPassword} className="font-medium text-[--color-primary-600] hover:text-[--color-primary-500]">
                        Forgot Password?
                    </button>
                </p>
                <div className="mt-6 pt-6 border-t border-[--glass-border]">
                    <p className="text-center text-sm text-slate-600 dark:text-slate-400 mb-3">
                        Don't have an account?
                    </p>
                    <button
                        onClick={onSwitchToTenantRegister}
                        className="w-full glass-button text-[--color-primary-600] dark:text-[--color-primary-400] font-semibold py-3 rounded-xl hover-lift"
                    >
                        Register as New Tenant
                    </button>
                    <button
                        onClick={() => setShowTenantLogin(true)}
                        className="w-full mt-2 glass-button text-[--color-primary-600] dark:text-[--color-primary-400] font-semibold py-3 rounded-xl hover-lift"
                    >
                        Login as Tenant
                    </button>
                </div>
                </>
                )}
            </div>
        </div>
    );
};