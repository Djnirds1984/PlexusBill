import React from 'react';
import { ExclamationTriangleIcon } from '../constants.tsx';

interface SubscriptionExpiredOverlayProps {
    subscriptionEndsAt: string | null;
}

export const SubscriptionExpiredOverlay: React.FC<SubscriptionExpiredOverlayProps> = ({ subscriptionEndsAt }) => {
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <div className="fixed inset-0 z-[9999] pointer-events-auto">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" />
            
            {/* Content */}
            <div className="relative min-h-screen flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full p-8 md:p-12 relative overflow-hidden">
                    {/* Animated background pattern */}
                    <div className="absolute inset-0 opacity-5">
                        <div className="absolute inset-0" style={{
                            backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
                            backgroundSize: '40px 40px'
                        }} />
                    </div>
                    
                    <div className="relative z-10">
                        {/* Warning Icon */}
                        <div className="flex justify-center mb-6">
                            <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <svg className="w-10 h-10 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                        </div>
                        
                        {/* Title */}
                        <h2 className="text-3xl md:text-4xl font-bold text-center text-slate-900 dark:text-white mb-4">
                            Subscription Expired
                        </h2>
                        
                        {/* Message */}
                        <p className="text-center text-slate-600 dark:text-slate-400 text-lg mb-8">
                            Your subscription expired on <span className="font-semibold text-slate-900 dark:text-white">{subscriptionEndsAt ? formatDate(subscriptionEndsAt) : 'N/A'}</span>.
                            All features are currently locked.
                        </p>
                        
                        {/* Warning Box */}
                        <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 mb-8 rounded-r-lg">
                            <div className="flex items-start gap-3">
                                <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm text-amber-800 dark:text-amber-300 font-medium mb-1">
                                        Account Access Restricted
                                    </p>
                                    <p className="text-sm text-amber-700 dark:text-amber-400">
                                        Please contact your system administrator to renew your subscription and restore access to all features.
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        {/* Status Indicator */}
                        <div className="flex items-center justify-center gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl mb-8">
                            <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                Contact your administrator to renew subscription
                            </span>
                        </div>
                        
                        {/* Action Button */}
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                onClick={() => window.location.href = '/'}
                                className="px-6 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-medium rounded-xl transition-colors"
                            >
                                Return to Home
                            </button>
                            <button
                                onClick={() => {
                                    localStorage.removeItem('authToken');
                                    localStorage.removeItem('tenantSlug');
                                    localStorage.removeItem('user');
                                    window.location.href = '/';
                                }}
                                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
