import React, { useState, useEffect } from 'react';
import { getPanelSettings, savePanelSettings } from '../services/databaseService.ts';
import { Loader } from './Loader.tsx';

export const LandingPageSettings: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            await getPanelSettings();
            setIsLoading(false);
        } catch (err) {
            console.error('Failed to load settings:', err);
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setMessage(null);
        try {
            // Landing page settings are managed through the main SystemSettings
            // This is just a placeholder redirecting users
            setMessage({ type: 'success', text: 'Landing Page settings are managed in System Settings > Landing Page tab' });
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to save settings' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="glass-card">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                    Landing Page Configuration
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                    Landing page settings can be configured through the System Settings page. 
                    This section is available in SuperAdmin for oversight purposes.
                </p>
                
                {message && (
                    <div className={`p-4 rounded-lg ${
                        message.type === 'success' 
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' 
                            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    }`}>
                        {message.text}
                    </div>
                )}

                <div className="flex gap-4">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium rounded-lg transition-colors"
                    >
                        {isSaving ? 'Saving...' : 'View in System Settings'}
                    </button>
                </div>
            </div>
        </div>
    );
};
