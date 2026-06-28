import React, { useState, useEffect } from 'react';
import { getPanelSettings, savePanelSettings, getAuthHeader } from '../services/databaseService.ts';
import { Loader } from './Loader.tsx';
import type { PanelSettings } from '../types.ts';

// Helper component for text inputs
const TextInput: React.FC<{
    label: string;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ label, name, value, onChange }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
        <input
            type="text"
            name={name}
            value={value}
            onChange={onChange}
            className="mt-1 block w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-slate-900 dark:text-white"
        />
    </div>
);

// Settings section wrapper
const SettingsSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
        </div>
        <div className="p-6">{children}</div>
    </div>
);

export const LandingPageSettings: React.FC = () => {
    const [settings, setSettings] = useState<PanelSettings>({} as PanelSettings);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const data = await getPanelSettings();
            setSettings(data);
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
            await savePanelSettings(settings);
            setMessage({ type: 'success', text: 'Landing page settings saved successfully!' });
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to save settings' });
        } finally {
            setIsSaving(false);
        }
    };

    const cfg = settings.landingPageConfig || {};
    const templates = [
        {
            id: 'classic',
            name: 'Classic',
            theme: { primary500: '#f97316', primary600: '#ea580c', primary700: '#c2410c', accent: '#0ea5e9', background: '#ffffff' },
            config: {
                webTitle: 'ISP Panel',
                heroBadge: 'Reliable Internet',
                heroTitle: 'Fast and Affordable Plans',
                heroSubtitle: 'Connect your home or business today',
                heroCtaLabel: 'Get Started',
                heroLoginPrompt: 'Already a customer?',
                heroLoginLabel: 'Client Portal',
                navAdminLabel: 'Admin Login',
                navClientPortalLabel: 'Client Portal',
                pages: [{ id: 'features', label: 'Features' }, { id: 'plans', label: 'Plans' }, { id: 'contact', label: 'Contact' }],
                features: [{ title: 'Stable Connection', description: 'Consistent speeds with low latency.' }, { title: '24/7 Support', description: 'We are here when you need us.' }],
                plansTitle: 'Popular Plans',
                plans: [{ name: 'Basic', speedText: '50 Mbps', priceText: '₱999', ctaLabel: 'Inquire' }, { name: 'Premium', speedText: '150 Mbps', priceText: '₱1,499', ctaLabel: 'Inquire' }],
                productCards: [],
                footerLinks: [{ label: 'Email', href: 'mailto:' }],
                contactTitle: 'Contact Us',
                contactEmail: '',
                contactPhone: '',
                contactAddress: '',
                contactFacebookUrl: ''
            }
        },
        {
            id: 'modern',
            name: 'Modern',
            theme: { primary500: '#6366f1', primary600: '#4f46e5', primary700: '#4338ca', accent: '#22d3ee', background: '#ffffff' },
            config: {
                webTitle: 'Modern ISP',
                heroBadge: 'Fiber Ready',
                heroTitle: 'Experience Next-Gen Internet',
                heroSubtitle: 'Ultra-fast fiber plans',
                heroCtaLabel: 'View Plans',
                heroLoginPrompt: 'Manage your account',
                heroLoginLabel: 'Login',
                navAdminLabel: 'Admin Login',
                navClientPortalLabel: 'Client Portal',
                pages: [{ id: 'plans', label: 'Plans' }, { id: 'contact', label: 'Contact' }],
                features: [{ title: 'Unlimited Data', description: 'No data caps.' }, { title: 'Fiber Backbone', description: 'High reliability.' }],
                plansTitle: 'Fiber Plans',
                plans: [{ name: 'Fiber 100', speedText: '100 Mbps', priceText: '₱1,299', ctaLabel: 'Inquire' }, { name: 'Fiber 300', speedText: '300 Mbps', priceText: '₱2,499', ctaLabel: 'Inquire' }],
                productCards: [],
                footerLinks: [{ label: 'Support', href: '#' }],
                contactTitle: 'Get Support',
                contactEmail: '',
                contactPhone: '',
                contactAddress: '',
                contactFacebookUrl: ''
            }
        },
        {
            id: 'business',
            name: 'Business',
            theme: { primary500: '#10b981', primary600: '#059669', primary700: '#047857', accent: '#f59e0b', background: '#ffffff' },
            config: {
                webTitle: 'Business Connectivity',
                heroBadge: 'SME Solutions',
                heroTitle: 'Scale With Reliable Internet',
                heroSubtitle: 'Flexible plans for growing teams',
                heroCtaLabel: 'Contact Sales',
                heroLoginPrompt: 'Existing clients',
                heroLoginLabel: 'Portal',
                navAdminLabel: 'Admin Login',
                navClientPortalLabel: 'Client Portal',
                pages: [{ id: 'features', label: 'Features' }, { id: 'plans', label: 'Plans' }],
                features: [{ title: 'SLA', description: 'Uptime guarantees.' }, { title: 'Priority Support', description: 'Dedicated support line.' }],
                plansTitle: 'Business Plans',
                plans: [{ name: 'SME 50', speedText: '50 Mbps', priceText: '₱2,999', ctaLabel: 'Inquire' }, { name: 'Enterprise 200', speedText: '200 Mbps', priceText: '₱9,999', ctaLabel: 'Inquire' }],
                productCards: [],
                footerLinks: [{ label: 'Facebook', href: '#' }],
                contactTitle: 'Talk To Us',
                contactEmail: '',
                contactPhone: '',
                contactAddress: '',
                contactFacebookUrl: ''
            }
        },
        {
            id: 'minimal',
            name: 'Minimal',
            theme: { primary500: '#0ea5e9', primary600: '#0284c7', primary700: '#0369a1', accent: '#14b8a6', background: '#ffffff' },
            config: {
                webTitle: 'Simple ISP',
                heroBadge: 'Simple & Fast',
                heroTitle: 'Internet Made Easy',
                heroSubtitle: 'No-frills plans',
                heroCtaLabel: 'Inquire',
                heroLoginPrompt: 'Account',
                heroLoginLabel: 'Login',
                navAdminLabel: 'Admin',
                navClientPortalLabel: 'Portal',
                pages: [{ id: 'plans', label: 'Plans' }],
                features: [{ title: 'Straightforward', description: 'Clear pricing.' }],
                plansTitle: 'Plans',
                plans: [{ name: 'Home 30', speedText: '30 Mbps', priceText: '₱799', ctaLabel: 'Inquire' }],
                productCards: [],
                footerLinks: [{ label: 'Email', href: 'mailto:' }],
                contactTitle: 'Contact',
                contactEmail: '',
                contactPhone: '',
                contactAddress: '',
                contactFacebookUrl: ''
            }
        },
        {
            id: 'dark',
            name: 'Dark',
            theme: { primary500: '#f59e0b', primary600: '#d97706', primary700: '#b45309', accent: '#22c55e', background: '#0f172a' },
            config: {
                webTitle: 'Dark ISP',
                heroBadge: 'Performance',
                heroTitle: 'Powerful Connectivity',
                heroSubtitle: 'Built for performance users',
                heroCtaLabel: 'Start',
                heroLoginPrompt: 'Have an account?',
                heroLoginLabel: 'Login',
                navAdminLabel: 'Admin',
                navClientPortalLabel: 'Portal',
                pages: [{ id: 'features', label: 'Features' }, { id: 'plans', label: 'Plans' }, { id: 'contact', label: 'Contact' }],
                features: [{ title: 'Low Latency', description: 'Optimized routes.' }],
                plansTitle: 'Performance Plans',
                plans: [{ name: 'Pro 200', speedText: '200 Mbps', priceText: '₱3,499', ctaLabel: 'Inquire' }],
                productCards: [],
                footerLinks: [{ label: 'Email', href: 'mailto:' }],
                contactTitle: 'Reach Us',
                contactEmail: '',
                contactPhone: '',
                contactAddress: '',
                contactFacebookUrl: ''
            }
        }
    ];

    const markCustom = () => {
        if (cfg.templateId && cfg.templateId !== 'custom') {
            setSettings(s => ({
                ...s,
                landingPageConfig: {
                    ...(s.landingPageConfig || {}),
                    templateId: 'custom',
                    templateName: (cfg.templateName ? cfg.templateName : '') || `Custom`
                }
            }));
        }
    };

    const updateCfg = (key: keyof NonNullable<PanelSettings['landingPageConfig']>, value: any) => {
        markCustom();
        setSettings(s => ({ ...s, landingPageConfig: { ...(s.landingPageConfig || {}), [key]: value } }));
    };

    const updateArrayItem = <T extends any[]>(key: keyof NonNullable<PanelSettings['landingPageConfig']>, index: number, field: string, value: any) => {
        const arr = ((cfg as any)[key] as T) || ([] as unknown as T);
        const next = arr.map((it: any, i: number) => i === index ? { ...it, [field]: value } : it);
        markCustom();
        updateCfg(key, next);
    };

    const addArrayItem = (key: keyof NonNullable<PanelSettings['landingPageConfig']>, item: any) => {
        const arr = ((cfg as any)[key] as any[]) || [];
        markCustom();
        updateCfg(key, [...arr, item]);
    };

    const removeArrayItem = (key: keyof NonNullable<PanelSettings['landingPageConfig']>, index: number) => {
        const arr = ((cfg as any)[key] as any[]) || [];
        markCustom();
        updateCfg(key, arr.filter((_, i) => i !== index));
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
                    Configure the public landing page that visitors see before logging in.
                </p>
                
                {message && (
                    <div className={`p-4 rounded-lg mb-6 ${
                        message.type === 'success' 
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' 
                            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    }`}>
                        {message.text}
                    </div>
                )}
            </div>

            <div className="space-y-8">
                <SettingsSection title="Template & Theme">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Template</label>
                            <select
                                value={cfg.templateId || ''}
                                onChange={(e) => {
                                    const selected = templates.find(t => t.id === e.target.value);
                                    if (selected) {
                                        setSettings(s => ({
                                            ...s,
                                            landingPageConfig: {
                                                ...selected.config,
                                                templateId: selected.id,
                                                templateName: selected.name,
                                                theme: selected.theme
                                            }
                                        }));
                                    }
                                }}
                                className="mt-1 block w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-slate-900 dark:text-white"
                            >
                                <option value="">Select</option>
                                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                <option value="custom">Custom</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Template Name</label>
                            <input
                                type="text"
                                value={cfg.templateName || ''}
                                onChange={(e) => setSettings(s => ({ ...s, landingPageConfig: { ...(s.landingPageConfig || {}), templateName: e.target.value, templateId: 'custom' } }))}
                                className="mt-1 block w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-slate-900 dark:text-white"
                                placeholder="Custom Template Name"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Primary Color</label>
                            <input
                                type="color"
                                value={cfg.theme?.primary600 || '#ea580c'}
                                onChange={(e) => updateCfg('theme', { ...(cfg.theme || {}), primary600: e.target.value })}
                                className="mt-1 h-10 w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md"
                            />
                        </div>
                    </div>
                </SettingsSection>

                <SettingsSection title="Landing Page Basics">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <TextInput label="Web Title" name="webTitle" value={cfg.webTitle || ''} onChange={e => updateCfg('webTitle', e.target.value)} />
                        <TextInput label="Hero Badge" name="heroBadge" value={cfg.heroBadge || ''} onChange={e => updateCfg('heroBadge', e.target.value)} />
                        <TextInput label="Hero Title" name="heroTitle" value={cfg.heroTitle || ''} onChange={e => updateCfg('heroTitle', e.target.value)} />
                        <TextInput label="Hero Subtitle" name="heroSubtitle" value={cfg.heroSubtitle || ''} onChange={e => updateCfg('heroSubtitle', e.target.value)} />
                    </div>
                </SettingsSection>

                <SettingsSection title="Buttons & Labels">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <TextInput label="Hero Primary Button" name="heroCtaLabel" value={cfg.heroCtaLabel || ''} onChange={e => updateCfg('heroCtaLabel', e.target.value)} />
                        <TextInput label="Login Prompt Text" name="heroLoginPrompt" value={cfg.heroLoginPrompt || ''} onChange={e => updateCfg('heroLoginPrompt', e.target.value)} />
                        <TextInput label="Login Link Label" name="heroLoginLabel" value={cfg.heroLoginLabel || ''} onChange={e => updateCfg('heroLoginLabel', e.target.value)} />
                        <TextInput label="Admin Login Button" name="navAdminLabel" value={cfg.navAdminLabel || ''} onChange={e => updateCfg('navAdminLabel', e.target.value)} />
                        <TextInput label="Client Portal Button" name="navClientPortalLabel" value={cfg.navClientPortalLabel || ''} onChange={e => updateCfg('navClientPortalLabel', e.target.value)} />
                    </div>
                </SettingsSection>

                <SettingsSection title="Navigation Pages">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {(cfg.pages || []).map((p: any, idx: number) => (
                                <div key={`page-${idx}`} className="space-y-2 border border-slate-200 dark:border-slate-700 rounded-md p-3">
                                    <TextInput label="Label" name={`page_label_${idx}`} value={p.label || ''} onChange={e => updateArrayItem('pages', idx, 'label', e.target.value)} />
                                    <TextInput label="Section ID" name={`page_id_${idx}`} value={p.id || ''} onChange={e => updateArrayItem('pages', idx, 'id', e.target.value)} />
                                    <button onClick={() => removeArrayItem('pages', idx)} className="px-3 py-2 bg-red-600 text-white rounded-md">Remove</button>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => addArrayItem('pages', { id: 'custom', label: 'Custom' })} className="px-4 py-2 bg-slate-700 text-white rounded-md">Add Page</button>
                    </div>
                </SettingsSection>

                <SettingsSection title="Product Cards">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {(cfg.productCards || []).map((c: any, idx: number) => (
                                <div key={`card-${idx}`} className="space-y-2 border border-slate-200 dark:border-slate-700 rounded-md p-3">
                                    <TextInput label="Title" name={`card_title_${idx}`} value={c.title || ''} onChange={e => updateArrayItem('productCards', idx, 'title', e.target.value)} />
                                    <TextInput label="Subtitle" name={`card_sub_${idx}`} value={c.subtitle || ''} onChange={e => updateArrayItem('productCards', idx, 'subtitle', e.target.value)} />
                                    <TextInput label="Price Text" name={`card_price_${idx}`} value={c.priceText || ''} onChange={e => updateArrayItem('productCards', idx, 'priceText', e.target.value)} />
                                    <button onClick={() => removeArrayItem('productCards', idx)} className="px-3 py-2 bg-red-600 text-white rounded-md">Remove</button>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => addArrayItem('productCards', { title: 'New', subtitle: '', priceText: '' })} className="px-4 py-2 bg-slate-700 text-white rounded-md">Add Card</button>
                    </div>
                </SettingsSection>

                <SettingsSection title="Features">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {(cfg.features || []).map((f: any, idx: number) => (
                                <div key={`feat-${idx}`} className="space-y-2 border border-slate-200 dark:border-slate-700 rounded-md p-3">
                                    <TextInput label="Title" name={`feat_title_${idx}`} value={f.title || ''} onChange={e => updateArrayItem('features', idx, 'title', e.target.value)} />
                                    <TextInput label="Description" name={`feat_desc_${idx}`} value={f.description || ''} onChange={e => updateArrayItem('features', idx, 'description', e.target.value)} />
                                    <button onClick={() => removeArrayItem('features', idx)} className="px-3 py-2 bg-red-600 text-white rounded-md">Remove</button>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => addArrayItem('features', { title: 'New Feature', description: '' })} className="px-4 py-2 bg-slate-700 text-white rounded-md">Add Feature</button>
                    </div>
                </SettingsSection>

                <SettingsSection title="Plans">
                    <div className="space-y-4">
                        <TextInput label="Section Title" name="plansTitle" value={cfg.plansTitle || ''} onChange={e => updateCfg('plansTitle', e.target.value)} />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {(cfg.plans || []).map((p: any, idx: number) => (
                                <div key={`plan-${idx}`} className="space-y-2 border border-slate-200 dark:border-slate-700 rounded-md p-3">
                                    <TextInput label="Name" name={`plan_name_${idx}`} value={p.name || ''} onChange={e => updateArrayItem('plans', idx, 'name', e.target.value)} />
                                    <TextInput label="Speed Text" name={`plan_speed_${idx}`} value={p.speedText || ''} onChange={e => updateArrayItem('plans', idx, 'speedText', e.target.value)} />
                                    <TextInput label="Price Text" name={`plan_price_${idx}`} value={p.priceText || ''} onChange={e => updateArrayItem('plans', idx, 'priceText', e.target.value)} />
                                    <TextInput label="CTA Label" name={`plan_cta_${idx}`} value={p.ctaLabel || ''} onChange={e => updateArrayItem('plans', idx, 'ctaLabel', e.target.value)} />
                                    <button onClick={() => removeArrayItem('plans', idx)} className="px-3 py-2 bg-red-600 text-white rounded-md">Remove</button>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => addArrayItem('plans', { name: 'New Plan', speedText: '', priceText: '', ctaLabel: 'Inquire' })} className="px-4 py-2 bg-slate-700 text-white rounded-md">Add Plan</button>
                    </div>
                </SettingsSection>

                <SettingsSection title="Contact">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <TextInput label="Section Title" name="contactTitle" value={cfg.contactTitle || ''} onChange={e => updateCfg('contactTitle', e.target.value)} />
                        <TextInput label="Email" name="contactEmail" value={cfg.contactEmail || ''} onChange={e => updateCfg('contactEmail', e.target.value)} />
                        <TextInput label="Phone" name="contactPhone" value={cfg.contactPhone || ''} onChange={e => updateCfg('contactPhone', e.target.value)} />
                        <TextInput label="Address" name="contactAddress" value={cfg.contactAddress || ''} onChange={e => updateCfg('contactAddress', e.target.value)} />
                        <TextInput label="Facebook URL" name="contactFacebookUrl" value={cfg.contactFacebookUrl || ''} onChange={e => updateCfg('contactFacebookUrl', e.target.value)} />
                    </div>
                </SettingsSection>

                <SettingsSection title="Footer Links">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {(cfg.footerLinks || []).map((l: any, idx: number) => (
                                <div key={`link-${idx}`} className="space-y-2 border border-slate-200 dark:border-slate-700 rounded-md p-3">
                                    <TextInput label="Label" name={`link_label_${idx}`} value={l.label || ''} onChange={e => updateArrayItem('footerLinks', idx, 'label', e.target.value)} />
                                    <TextInput label="Href" name={`link_href_${idx}`} value={l.href || ''} onChange={e => updateArrayItem('footerLinks', idx, 'href', e.target.value)} />
                                    <button onClick={() => removeArrayItem('footerLinks', idx)} className="px-3 py-2 bg-red-600 text-white rounded-md">Remove</button>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => addArrayItem('footerLinks', { label: 'Email', href: 'mailto:' })} className="px-4 py-2 bg-slate-700 text-white rounded-md">Add Link</button>
                    </div>
                </SettingsSection>
                
                <SettingsSection title="Advertising Image">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Image URL</label>
                                <input 
                                    type="url"
                                    placeholder="https://example.com/banner.jpg"
                                    className="mt-1 block w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-slate-900 dark:text-white"
                                    onChange={(e) => updateCfg('adImageLink', e.target.value)}
                                    value={cfg.adImageLink || ''}
                                />
                                <div className="mt-2 flex gap-2">
                                    <button
                                        className="px-4 py-2 bg-[--color-primary-600] hover:bg-[--color-primary-700] text-white rounded-md"
                                        onClick={async () => {
                                            const url = cfg.adImageLink || '';
                                            if (!url) { alert('Please enter an image URL first.'); return; }
                                            try {
                                                const resp = await fetch('/api/landing/ad-image-download', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                                                    body: JSON.stringify({ url })
                                                });
                                                const data = await resp.json();
                                                if (!resp.ok) throw new Error(data.message || 'Failed to download image.');
                                                updateCfg('adImageBase64', data.adImageBase64);
                                                alert('Image downloaded and saved.');
                                            } catch (e) {
                                                alert((e as Error).message);
                                            }
                                        }}
                                    >
                                        Download & Save
                                    </button>
                                    <button
                                        className="px-4 py-2 bg-slate-700 text-white rounded-md"
                                        onClick={() => { updateCfg('adImageBase64', ''); }}
                                    >
                                        Clear Image
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Alt Text</label>
                                <input 
                                    type="text"
                                    className="mt-1 block w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-slate-900 dark:text-white"
                                    value={cfg.adImageAlt || ''}
                                    onChange={(e) => updateCfg('adImageAlt', e.target.value)}
                                    placeholder="Promotion banner"
                                />
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Preview</label>
                            {cfg.adImageBase64 ? (
                                <img src={cfg.adImageBase64} alt={cfg.adImageAlt || 'Advertising Image'} className="w-full max-w-xl rounded-lg border border-slate-200 dark:border-slate-700" />
                            ) : (
                                <div className="w-full max-w-xl h-40 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 grid place-content-center text-slate-500">
                                    No image selected
                                </div>
                            )}
                        </div>
                    </div>
                </SettingsSection>
            </div>

            <div className="flex gap-4 mt-6">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium rounded-lg transition-colors"
                >
                    {isSaving ? 'Saving...' : 'Save Landing Page Settings'}
                </button>
            </div>
        </div>
    );
};
