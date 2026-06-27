import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader } from './Loader.tsx';
import { getAuthHeader } from '../services/databaseService.ts';
import { CodeBlock } from './CodeBlock.tsx';
import { LockClosedIcon, TrashIcon, CloudArrowUpIcon, UpdateIcon, ExclamationTriangleIcon, ServerIcon, UsersIcon, ClockIcon, CodeBracketIcon } from '../constants.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { CloudflareTunnel } from './CloudflareTunnel.tsx';
import { ZeroTier } from './ZeroTier.tsx';
import { PiTunnel } from './PiTunnel.tsx';
import { NgrokManager } from './NgrokManager.tsx';
import { Dataplicity } from './Dataplicity.tsx';
import { SSHTerminal } from './SSHTerminal.tsx';
import { Updater } from './Updater.tsx';
import { factoryReset } from '../services/databaseService.ts';
import { useLocalization } from '../contexts/LocalizationContext.tsx';

type SuperAdminTab = 'backup' | 'zerotier' | 'pitunnel' | 'ngrok' | 'dataplicity' | 'updater' | 'factory-reset' | 'cloudflare' | 'tenant-approval' | 'ntp' | 'ssh-terminal';

const TabButton: React.FC<{
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors duration-200 focus:outline-none ${
            isActive
                ? 'border-[--color-primary-500] text-[--color-primary-500] dark:text-[--color-primary-400]'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
        }`}
    >
        {icon}
        <span className="hidden sm:inline">{label}</span>
    </button>
);

// --- Full Backup & Restore Component ---
const FullBackupManager: React.FC = () => {
    const [backups, setBackups] = useState<string[]>([]);
    const [status, setStatus] = useState<'idle' | 'fetching' | 'backing_up' | 'restoring' | 'uploading' | 'deleting' | 'downloading' | 'error'>('idle');
    const [logs, setLogs] = useState<{ text: string, isError?: boolean }[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [fileToRestore, setFileToRestore] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isWorking = status !== 'idle' && status !== 'error';

    const fetchBackups = useCallback(async () => {
        setStatus('fetching');
        setError(null);
        try {
            const res = await fetch('/api/superadmin/list-full-backups', { headers: getAuthHeader() });
            if (!res.ok) throw new Error('Failed to fetch backup list.');
            const data = await res.json();
            setBackups(data);
            setStatus('idle');
        } catch (err) {
            setError((err as Error).message);
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        fetchBackups();
    }, [fetchBackups]);
    
    const handleStream = async (url: string, onMessage: (data: any) => void) => {
        try {
            const response = await fetch(url, { headers: getAuthHeader() });

            if (response.status === 401) {
                onMessage({ status: 'error', message: 'Authentication error. Please log in again.' });
                return;
            }

            if (!response.ok || !response.body) {
                throw new Error(`Failed to connect to stream: ${response.statusText}`);
            }

            const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) {
                    onMessage({ status: 'finished' });
                    break;
                }

                buffer += value;
                const parts = buffer.split('\n\n');
                buffer = parts.pop() || ''; // Keep the last, possibly incomplete, part

                for (const part of parts) {
                    if (part.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(part.substring(6));
                            onMessage(data);
                        } catch (e) {
                            console.error("Failed to parse SSE message:", e);
                        }
                    }
                }
            }
        } catch (err) {
            onMessage({ status: 'error', message: (err as Error).message });
        }
    };

    const handleCreateBackup = () => {
        setStatus('backing_up');
        setLogs([]);
        setError(null);
        handleStream('/api/superadmin/create-full-backup', (data) => {
            if (data.log) setLogs(prev => [...prev, { text: data.log, isError: data.isError }]);
            if (data.status === 'success') {
                setStatus('idle');
                fetchBackups();
                alert('Backup created successfully!');
            }
            if (data.status === 'error') {
                setError(data.message);
                setStatus('error');
            }
        });
    };

    const handleDeleteBackup = async (filename: string) => {
        if (!window.confirm(`Are you sure you want to delete backup "${filename}"?`)) return;
        setStatus('deleting');
        setError(null);
        try {
            const res = await fetch('/api/superadmin/delete-full-backup', {
                method: 'POST',
                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ backupFile: filename })
            });
            if (!res.ok) throw new Error(await res.json().then(d => d.message));
            await fetchBackups();
        } catch (err) {
            setError((err as Error).message);
            setStatus('error');
        }
    };
    
    const handleDownloadBackup = async (filename: string) => {
        setStatus('downloading');
        setLogs(prev => [...prev, { text: `Starting download for ${filename}...` }]);
        setError(null);
        try {
            const res = await fetch(`/download-backup/${filename}`, {
                headers: getAuthHeader(),
            });
            if (!res.ok) {
                let errorMsg = `Download failed: ${res.statusText}`;
                try {
                    const data = await res.json();
                    errorMsg = data.message || errorMsg;
                } catch (e) { /* ignore */ }
                throw new Error(errorMsg);
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            setLogs(prev => [...prev, { text: 'Download successful.' }]);
        } catch (err) {
            const errorMsg = (err as Error).message;
            setError(errorMsg);
            setLogs(prev => [...prev, { text: `Error: ${errorMsg}`, isError: true }]);
            setStatus('error');
        } finally {
            if (status !== 'error') {
                setTimeout(() => setStatus('idle'), 500);
            }
        }
    };

    const handleRestore = async () => {
        if (!fileToRestore) return;
        if (!window.confirm("Restoring will overwrite the entire panel application, including the database. This cannot be undone. Are you sure?")) return;
        
        setStatus('uploading');
        setLogs([]);
        setError(null);
        try {
            setLogs(prev => [...prev, { text: 'Uploading backup file to server...' }]);
            const uploadRes = await fetch('/api/superadmin/upload-backup', {
                method: 'POST',
                headers: { ...getAuthHeader(), 'Content-Type': 'application/octet-stream' },
                body: fileToRestore
            });
            const uploadData = await uploadRes.json();
            if (!uploadRes.ok) throw new Error(uploadData.message);
            
            setStatus('restoring');
            const restoreFile = uploadData.filename;
            setLogs(prev => [...prev, { text: 'Upload complete. Starting restore process...' }]);

            handleStream(`/api/superadmin/restore-from-backup?file=${encodeURIComponent(restoreFile)}`, (data) => {
                if (data.log) setLogs(prev => [...prev, { text: data.log, isError: data.isError }]);
                if (data.status === 'restarting') {
                    alert('Restore complete! The panel is restarting. This page will reload in a few seconds...');
                    setTimeout(() => window.location.reload(), 8000);
                }
                if (data.status === 'error') {
                    setError(data.message);
                    setStatus('error');
                }
            });

        } catch (err) {
            setError((err as Error).message);
            setStatus('error');
        } finally {
            setFileToRestore(null);
            if(fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const LogViewer: React.FC<{ logs: { text: string, isError?: boolean }[] }> = ({ logs }) => (
        <div className="bg-slate-900 text-slate-300 font-mono text-xs p-4 rounded-md h-64 overflow-y-auto">
            {logs.map((log, index) => <pre key={index} className={`whitespace-pre-wrap break-words ${log.isError ? 'text-red-400' : ''}`}>{log.text}</pre>)}
        </div>
    );

    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Full Panel Backup & Restore</h2>
            <p className="text-sm text-slate-500 mt-1">Create an encrypted backup of the entire panel, or restore from a previous one.</p>
            
            {(isWorking || logs.length > 0 || error) && (
                <div className="mt-6">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2 capitalize">{status.replace('_', ' ')}...</h3>
                    {error && <p className="text-red-500 bg-red-100 dark:bg-red-900/30 p-3 rounded-md">{error}</p>}
                    {logs.length > 0 && <LogViewer logs={logs} />}
                </div>
            )}

            {!isWorking && (
                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button onClick={handleCreateBackup} disabled={isWorking} className="w-full sm:w-auto px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg disabled:opacity-50">
                        Create Full Panel Backup (.mk)
                    </button>
                </div>
            )}
                
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">Available Backups</h3>
                    {status === 'fetching' ? <div className="flex justify-center"><Loader /></div> : backups.length > 0 ? (
                    <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {backups.map(file => (
                            <li key={file} className="bg-slate-100 dark:bg-slate-700/50 p-2 rounded-md flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                <span className="font-mono text-sm break-all">{file}</span>
                                <div className="flex gap-2 self-end sm:self-center flex-shrink-0">
                                    <button onClick={() => handleDownloadBackup(file)} disabled={isWorking} className="px-3 py-1 text-xs bg-green-600 text-white rounded-md disabled:opacity-50">
                                        {status === 'downloading' ? '...' : 'Download'}
                                    </button>
                                    <button onClick={() => handleDeleteBackup(file)} disabled={isWorking} className="px-3 py-1 text-xs bg-red-600 text-white rounded-md">Delete</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                    ) : <p className="text-sm text-slate-500">No backups found.</p>}
            </div>
            
            {!isWorking && (
                 <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                     <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Restore from Backup</h3>
                     <p className="text-sm text-yellow-600 dark:text-yellow-400 my-2">Warning: Restoring will overwrite all current panel files and data.</p>
                     <div className="flex items-center gap-4">
                        <input ref={fileInputRef} type="file" accept=".mk" onChange={e => setFileToRestore(e.target.files?.[0] || null)} className="flex-grow text-sm text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-200 dark:file:bg-slate-600" />
                        <button onClick={handleRestore} disabled={!fileToRestore || isWorking} className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg font-semibold disabled:opacity-50">
                            Upload & Restore
                        </button>
                     </div>
                 </div>
            )}
        </div>
    );
};

// --- Tenant Approval Manager Component ---
const TenantApprovalManager: React.FC = () => {
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    
    // Subscription modal state
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
    const [selectedTenant, setSelectedTenant] = useState<{ id: string; name: string } | null>(null);
    const [subscriptionPeriod, setSubscriptionPeriod] = useState('trial-3days');

    const fetchTenants = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/superadmin/tenants', { headers: getAuthHeader() });
            if (!res.ok) throw new Error('Failed to fetch tenants');
            const data = await res.json();
            setTenants(data.tenants || []);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTenants();
    }, [fetchTenants]);

    const handleApproveClick = (tenantId: string, tenantName: string) => {
        setSelectedTenant({ id: tenantId, name: tenantName });
        setSubscriptionPeriod('trial-3days');
        setShowSubscriptionModal(true);
    };

    const handleApprove = async () => {
        if (!selectedTenant) return;
        
        setActionLoading(selectedTenant.id);
        setShowSubscriptionModal(false);
        
        try {
            const res = await fetch(`/api/superadmin/tenants/${selectedTenant.id}/approve`, {
                method: 'POST',
                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    approvedBy: 'superadmin',
                    subscriptionPeriod 
                })
            });
            
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to approve tenant');
            }
            
            // Refresh list
            await fetchTenants();
            setSelectedTenant(null);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (tenantId: string, tenantName: string) => {
        const reason = prompt(`Reject tenant "${tenantName}". Enter reason (optional):`);
        if (reason === null) return; // User cancelled
        
        setActionLoading(tenantId);
        try {
            const res = await fetch(`/api/superadmin/tenants/${tenantId}/reject`, {
                method: 'POST',
                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: reason || 'No reason provided' })
            });
            
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to reject tenant');
            }
            
            // Refresh list
            await fetchTenants();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async (tenantId: string, tenantName: string, tenantSlug: string) => {
        const confirmInput = prompt(
            `⚠️ DELETE TENANT: "${tenantName}"\n\n` +
            `This will PERMANENTLY delete:\n` +
            `- All tenant data\n` +
            `- Tenant database\n` +
            `- All users, customers, sales, etc.\n\n` +
            `Type "${tenantSlug}" to confirm deletion:`
        );
        
        if (confirmInput !== tenantSlug) {
            if (confirmInput !== null) {
                setError('Deletion cancelled - confirmation slug did not match');
            }
            return;
        }
        
        setActionLoading(tenantId);
        try {
            const res = await fetch(`/api/superadmin/tenants/${tenantId}`, {
                method: 'DELETE',
                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmDelete: tenantSlug })
            });
            
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to delete tenant');
            }
            
            // Refresh list
            await fetchTenants();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setActionLoading(null);
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString();
    };

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            'pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
            'approved': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
            'rejected': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
            'active': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
            'suspended': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
        };
        return colors[status] || 'bg-slate-100 text-slate-800';
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <Loader />
                <p className="mt-4 text-slate-500 dark:text-slate-400">Loading tenants...</p>
            </div>
        );
    }

    return (
        <>
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Tenant Management</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Approve or reject tenant registrations</p>
                </div>
                <button
                    onClick={fetchTenants}
                    className="glass-button px-4 py-2 rounded-xl text-sm font-medium"
                >
                    Refresh List
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300">
                    {error}
                </div>
            )}

            {tenants.length === 0 ? (
                <div className="glass-card text-center py-12">
                    <ServerIcon className="w-16 h-16 mx-auto text-slate-400 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No tenants found</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Tenant registrations will appear here</p>
                </div>
            ) : (
                <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[--glass-border]">
                                    <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tenant</th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Admin</th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Created</th>
                                    <th className="text-right px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[--glass-border]">
                                {tenants.map((tenant) => (
                                    <tr key={tenant.id} className="hover:bg-emerald-50/30 dark:hover:bg-slate-700/20 transition-colors">
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="font-semibold text-slate-800 dark:text-slate-200">{tenant.name}</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">{tenant.slug}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="text-sm text-slate-700 dark:text-slate-300">{tenant.admin_username}</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">{tenant.admin_email}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(tenant.approval_status)}`}>
                                                    {tenant.approval_status}
                                                </span>
                                                {tenant.approved_by && (
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                                        by {tenant.approved_by}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                            {formatDate(tenant.created_at)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {tenant.approval_status === 'pending' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleApproveClick(tenant.id, tenant.name)}
                                                            disabled={actionLoading === tenant.id}
                                                            className="px-4 py-2 gradient-primary text-white text-sm font-medium rounded-xl shadow-glass hover:shadow-glass-lg transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {actionLoading === tenant.id ? <Loader size="sm" /> : 'Approve'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleReject(tenant.id, tenant.name)}
                                                            disabled={actionLoading === tenant.id}
                                                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-xl shadow-glass transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            Reject
                                                        </button>
                                                    </>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(tenant.id, tenant.name, tenant.slug)}
                                                    disabled={actionLoading === tenant.id}
                                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl shadow-glass transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Delete tenant permanently"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card">
                    <div className="text-sm text-slate-500 dark:text-slate-400">Pending Approval</div>
                    <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-2">
                        {tenants.filter(t => t.approval_status === 'pending').length}
                    </div>
                </div>
                <div className="glass-card">
                    <div className="text-sm text-slate-500 dark:text-slate-400">Approved Tenants</div>
                    <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                        {tenants.filter(t => t.approval_status === 'approved').length}
                    </div>
                </div>
                <div className="glass-card">
                    <div className="text-sm text-slate-500 dark:text-slate-400">Rejected</div>
                    <div className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">
                        {tenants.filter(t => t.approval_status === 'rejected').length}
                    </div>
                </div>
            </div>
        </div>
        
        {/* Subscription Modal */}
        {showSubscriptionModal && selectedTenant && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        Approve Tenant
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-6">
                        Setting up subscription for <span className="font-semibold text-slate-900 dark:text-white">{selectedTenant.name}</span>
                    </p>

                    <div className="space-y-4 mb-6">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Subscription Period
                        </label>
                        <select
                            value={subscriptionPeriod}
                            onChange={(e) => setSubscriptionPeriod(e.target.value)}
                            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="trial-3days">Trial - 3 Days</option>
                            <option value="1-month">1 Month</option>
                            <option value="3-months">3 Months</option>
                            <option value="6-months">6 Months</option>
                            <option value="1-year">1 Year</option>
                        </select>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                setShowSubscriptionModal(false);
                                setSelectedTenant(null);
                            }}
                            className="flex-1 px-4 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApprove}
                            disabled={actionLoading === selectedTenant.id}
                            className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium rounded-lg transition-colors"
                        >
                            {actionLoading === selectedTenant.id ? 'Approving...' : 'Approve & Activate'}
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

// --- NTP Settings Component ---
const NTPSettingsManager: React.FC = () => {
    const [ntpInfo, setNtpInfo] = useState<any>(null);
    const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'error'>('loading');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [countryCode, setCountryCode] = useState('PH');
    const [enableNTP, setEnableNTP] = useState(true);
    const [currentTimezone, setCurrentTimezone] = useState('');
    const [selectedTimezone, setSelectedTimezone] = useState('Asia/Manila');

    const timezoneList = [
        { value: 'Asia/Manila', label: '🇵🇭 Philippines (PST, UTC+8)', offset: '+08:00' },
        { value: 'Asia/Shanghai', label: '🇨🇳 China (CST, UTC+8)', offset: '+08:00' },
        { value: 'Asia/Singapore', label: '🇸🇬 Singapore (SGT, UTC+8)', offset: '+08:00' },
        { value: 'Asia/Tokyo', label: '🇯🇵 Japan (JST, UTC+9)', offset: '+09:00' },
        { value: 'Asia/Seoul', label: '🇰🇷 South Korea (KST, UTC+9)', offset: '+09:00' },
        { value: 'Asia/Bangkok', label: '🇹🇭 Thailand (ICT, UTC+7)', offset: '+07:00' },
        { value: 'Asia/Ho_Chi_Minh', label: '🇻🇳 Vietnam (ICT, UTC+7)', offset: '+07:00' },
        { value: 'Asia/Jakarta', label: '🇮🇩 Indonesia/Western (WIB, UTC+7)', offset: '+07:00' },
        { value: 'Asia/Kuala_Lumpur', label: '🇲🇾 Malaysia (MYT, UTC+8)', offset: '+08:00' },
        { value: 'Asia/Hong_Kong', label: '🇭🇰 Hong Kong (HKT, UTC+8)', offset: '+08:00' },
        { value: 'Asia/Taipei', label: '🇹🇼 Taiwan (CST, UTC+8)', offset: '+08:00' },
        { value: 'Australia/Sydney', label: '🇦🇺 Australia/Sydney (AEST, UTC+10)', offset: '+10:00' },
        { value: 'Australia/Perth', label: '🇦🇺 Australia/Perth (AWST, UTC+8)', offset: '+08:00' },
        { value: 'America/New_York', label: '🇺🇸 US/Eastern (EST, UTC-5)', offset: '-05:00' },
        { value: 'America/Chicago', label: '🇺🇸 US/Central (CST, UTC-6)', offset: '-06:00' },
        { value: 'America/Denver', label: '🇺🇸 US/Mountain (MST, UTC-7)', offset: '-07:00' },
        { value: 'America/Los_Angeles', label: '🇺🇸 US/Pacific (PST, UTC-8)', offset: '-08:00' },
        { value: 'America/Toronto', label: '🇨🇦 Canada/Eastern (EST, UTC-5)', offset: '-05:00' },
        { value: 'Europe/London', label: '🇬🇧 UK (GMT, UTC+0)', offset: '+00:00' },
        { value: 'Europe/Berlin', label: '🇩🇪 Germany (CET, UTC+1)', offset: '+01:00' },
        { value: 'Europe/Paris', label: '🇫🇷 France (CET, UTC+1)', offset: '+01:00' },
        { value: 'Europe/Moscow', label: '🇷🇺 Russia/Moscow (MSK, UTC+3)', offset: '+03:00' },
        { value: 'Asia/Kolkata', label: '🇮🇳 India (IST, UTC+5:30)', offset: '+05:30' },
        { value: 'Asia/Dubai', label: '🇦🇪 UAE (GST, UTC+4)', offset: '+04:00' },
        { value: 'UTC', label: '🌍 UTC (Coordinated Universal Time)', offset: '+00:00' },
    ];

    const countryList = [
        { code: 'GLOBAL', name: 'Global (Recommended)', flag: '🌍' },
        { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
        { code: 'US', name: 'United States', flag: '🇺🇸' },
        { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
        { code: 'DE', name: 'Germany', flag: '🇩🇪' },
        { code: 'FR', name: 'France', flag: '🇫🇷' },
        { code: 'JP', name: 'Japan', flag: '🇯🇵' },
        { code: 'AU', name: 'Australia', flag: '🇦🇺' },
        { code: 'CA', name: 'Canada', flag: '🇨🇦' },
        { code: 'IN', name: 'India', flag: '🇮🇳' },
        { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
        { code: 'CN', name: 'China', flag: '🇨🇳' },
        { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
        { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
        { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
        { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
        { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
        { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
        { code: 'IT', name: 'Italy', flag: '🇮🇹' },
        { code: 'ES', name: 'Spain', flag: '🇪🇸' },
        { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
        { code: 'RU', name: 'Russia', flag: '🇷🇺' },
        { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
        { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
        { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
        { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
        { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
        { code: 'AE', name: 'UAE', flag: '🇦🇪' },
    ];

    const fetchNTPInfo = useCallback(async () => {
        setStatus('loading');
        setError(null);
        try {
            const res = await fetch('/api/superadmin/ntp', { headers: getAuthHeader() });
            if (!res.ok) throw new Error('Failed to fetch NTP configuration.');
            const data = await res.json();
            setNtpInfo(data);
            setEnableNTP(data.ntpEnabled);
            // Extract just the timezone name (e.g., "Asia/Manila" from "Asia/Manila (PST, +0800)")
            const tzName = data.timeZone ? data.timeZone.split(' ')[0] : '';
            setCurrentTimezone(tzName);
            setSelectedTimezone(tzName || 'Asia/Manila');
            setStatus('idle');
        } catch (err) {
            setError((err as Error).message);
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        fetchNTPInfo();
    }, [fetchNTPInfo]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setStatus('saving');

        try {
            // Save timezone
            const tzRes = await fetch('/api/superadmin/timezone', {
                method: 'POST',
                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ timezone: selectedTimezone })
            });
            
            const tzData = await tzRes.json();
            if (!tzRes.ok) {
                throw new Error(tzData.message || 'Failed to update timezone');
            }
            
            console.log('[NTP Settings] Timezone updated:', tzData);
            
            // Save NTP
            const ntpRes = await fetch('/api/superadmin/ntp', {
                method: 'POST',
                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ countryCode, enableNTP })
            });
            
            const ntpData = await ntpRes.json();
            if (!ntpRes.ok) throw new Error(ntpData.message || 'Failed to update NTP configuration.');
            
            setSuccess(`✅ Timezone changed to ${selectedTimezone} and NTP updated!`);
            await fetchNTPInfo();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setStatus('idle');
        }
    };

    if (status === 'loading') {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <Loader />
                <p className="mt-4 text-[--color-primary-500] dark:text-[--color-primary-400]">Loading NTP configuration...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">NTP Time Settings</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Configure Network Time Protocol to keep your server clock synchronized</p>
            </div>

            {/* Current Status */}
            {ntpInfo && (
                <div className="glass-card">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Current Status</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                            <div className="text-sm text-slate-500 dark:text-slate-400">Current Time</div>
                            <div className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-1">
                                {ntpInfo.currentTime || 'N/A'}
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                            <div className="text-sm text-slate-500 dark:text-slate-400">Time Zone</div>
                            <div className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-1">
                                {ntpInfo.timeZone || 'N/A'}
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                            <div className="text-sm text-slate-500 dark:text-slate-400">NTP Service</div>
                            <div className="mt-1">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                    ntpInfo.ntpEnabled 
                                        ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' 
                                        : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                                }`}>
                                    {ntpInfo.ntpEnabled ? 'Enabled' : 'Disabled'}
                                </span>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                            <div className="text-sm text-slate-500 dark:text-slate-400">Clock Synchronized</div>
                            <div className="mt-1">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                    ntpInfo.ntpSynchronized 
                                        ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' 
                                        : 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
                                }`}>
                                    {ntpInfo.ntpSynchronized ? 'Synchronized' : 'Not Synchronized'}
                                </span>
                            </div>
                        </div>
                        {ntpInfo.ntpServers && ntpInfo.ntpServers.length > 0 && (
                            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg md:col-span-2">
                                <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">Configured NTP Servers</div>
                                <div className="font-mono text-xs text-slate-700 dark:text-slate-300 space-y-1">
                                    {ntpInfo.ntpServers.map((server: string, idx: number) => (
                                        <div key={idx}>{server}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Configuration Form */}
            <div className="glass-card">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">NTP Configuration</h3>
                
                {error && <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md">{error}</div>}
                {success && <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md">{success}</div>}

                <form onSubmit={handleSave} className="space-y-4">
                    {/* Timezone Selector */}
                    <div>
                        <label htmlFor="timezone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Select Timezone
                        </label>
                        <select
                            id="timezone"
                            value={selectedTimezone}
                            onChange={(e) => setSelectedTimezone(e.target.value)}
                            className="block w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md py-2.5 px-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[--color-primary-500]"
                        >
                            {timezoneList.map(tz => (
                                <option key={tz.value} value={tz.value}>
                                    {tz.label}
                                </option>
                            ))}
                        </select>
                        {currentTimezone && (
                            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                                ⚠️ Current: <span className="font-mono">{currentTimezone}</span> — Will change to: <span className="font-mono">{selectedTimezone}</span>
                            </p>
                        )}
                    </div>

                    {/* Country Selector */}
                    <div>
                        <label htmlFor="country" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Select Country/Region
                        </label>
                        <select
                            id="country"
                            value={countryCode}
                            onChange={(e) => setCountryCode(e.target.value)}
                            className="block w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md py-2.5 px-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[--color-primary-500]"
                        >
                            {countryList.map(country => (
                                <option key={country.code} value={country.code}>
                                    {country.flag} {country.name}
                                </option>
                            ))}
                        </select>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            Selecting your country will automatically configure the nearest NTP servers for optimal time synchronization
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="enableNTP"
                            checked={enableNTP}
                            onChange={(e) => setEnableNTP(e.target.checked)}
                            className="w-4 h-4 text-[--color-primary-600] bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 rounded focus:ring-[--color-primary-500]"
                        />
                        <label htmlFor="enableNTP" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Enable automatic time synchronization
                        </label>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={status === 'saving'}
                            className="px-5 py-2.5 bg-[--color-primary-600] hover:bg-[--color-primary-500] disabled:bg-[--color-primary-400] text-white font-semibold rounded-lg transition-colors"
                        >
                            {status === 'saving' ? 'Saving...' : 'Save NTP Configuration'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Info Box */}
            <div className="glass-card bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <div className="flex gap-3">
                    <div className="flex-shrink-0">
                        <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300">Why NTP Matters</h4>
                        <p className="mt-1 text-sm text-blue-800 dark:text-blue-400">
                            Accurate time synchronization is critical for:
                        </p>
                        <ul className="mt-2 text-sm text-blue-800 dark:text-blue-400 space-y-1 list-disc list-inside">
                            <li>Authentication and security certificates</li>
                            <li>Network logging and troubleshooting</li>
                            <li>Database consistency and backups</li>
                            <li>Scheduled tasks and cron jobs</li>
                            <li>Remote access services (ZeroTier, SSH)</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const SuperAdmin: React.FC = () => {
    const { logout } = useAuth();
    const { t } = useLocalization();
    const [activeTab, setActiveTab] = useState<SuperAdminTab>('backup');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isPasswordSaving, setIsPasswordSaving] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
    const [isRestarting, setIsRestarting] = useState(false);
    const [restartStatus, setRestartStatus] = useState<string | null>(null);

    const handleRestartPanel = async () => {
        if (!window.confirm('⚠️ Are you sure you want to restart the panel? This will temporarily disconnect all users.')) {
            return;
        }
        
        setIsRestarting(true);
        setRestartStatus('Sending restart command...');
        
        try {
            const res = await fetch('/api/superadmin/restart-panel', {
                method: 'POST',
                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' }
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.message || 'Failed to restart panel');
            }
            
            setRestartStatus('✅ Panel restart command sent successfully! The panel will be back online in 10-15 seconds.');
            
            // Auto-logout after restart
            setTimeout(() => {
                logout();
            }, 5000);
        } catch (err) {
            setRestartStatus(`❌ Error: ${(err as Error).message}`);
        } finally {
            setIsRestarting(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError(null);
        setPasswordSuccess(null);

        if (newPassword !== confirmPassword) {
            setPasswordError('Passwords do not match.');
            return;
        }
        if (newPassword.length < 6) {
            setPasswordError('Password must be at least 6 characters long.');
            return;
        }

        setIsPasswordSaving(true);
        try {
            const res = await fetch('/api/auth/change-superadmin-password', {
                method: 'POST',
                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || 'Failed to update password.');
            }
            setPasswordSuccess('Password updated! You will be logged out shortly.');
            setTimeout(() => {
                logout();
            }, 2000);
        } catch (err) {
            setPasswordError((err as Error).message);
        } finally {
            setIsPasswordSaving(false);
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'backup':
                return <FullBackupManager />;
            case 'zerotier':
                return <ZeroTier />;
            case 'pitunnel':
                return <PiTunnel />;
            case 'ngrok':
                return <NgrokManager />;
            case 'dataplicity':
                return <Dataplicity />;
            case 'updater':
                return <Updater />;
            case 'factory-reset':
                return <FactoryResetManager />;
            case 'cloudflare':
                return <CloudflareTunnel />;
            case 'tenant-approval':
                return <TenantApprovalManager />;
            case 'ntp':
                return <NTPSettingsManager />;
            case 'ssh-terminal':
                return <SSHTerminal />;
            default:
                return <FullBackupManager />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="flex space-x-2 -mb-px overflow-x-auto" aria-label="Tabs">
                    <TabButton 
                        label="Backup & Restore" 
                        icon={<CloudArrowUpIcon className="w-5 h-5"/>} 
                        isActive={activeTab === 'backup'} 
                        onClick={() => setActiveTab('backup')} 
                    />
                    <TabButton 
                        label="ZeroTier" 
                        icon={<ServerIcon className="w-5 h-5"/>} 
                        isActive={activeTab === 'zerotier'} 
                        onClick={() => setActiveTab('zerotier')} 
                    />
                    <TabButton 
                        label="PiTunnel" 
                        icon={<CloudArrowUpIcon className="w-5 h-5"/>} 
                        isActive={activeTab === 'pitunnel'} 
                        onClick={() => setActiveTab('pitunnel')} 
                    />
                    <TabButton 
                        label="Ngrok" 
                        icon={<CloudArrowUpIcon className="w-5 h-5"/>} 
                        isActive={activeTab === 'ngrok'} 
                        onClick={() => setActiveTab('ngrok')} 
                    />
                    <TabButton 
                        label="Dataplicity" 
                        icon={<CloudArrowUpIcon className="w-5 h-5"/>} 
                        isActive={activeTab === 'dataplicity'} 
                        onClick={() => setActiveTab('dataplicity')} 
                    />
                    <TabButton 
                        label="Updater" 
                        icon={<UpdateIcon className="w-5 h-5"/>} 
                        isActive={activeTab === 'updater'} 
                        onClick={() => setActiveTab('updater')} 
                    />
                    <TabButton 
                        label="Factory Reset" 
                        icon={<ExclamationTriangleIcon className="w-5 h-5"/>} 
                        isActive={activeTab === 'factory-reset'} 
                        onClick={() => setActiveTab('factory-reset')} 
                    />
                    <TabButton 
                        label="Cloudflare Tunnel" 
                        icon={<CloudArrowUpIcon className="w-5 h-5"/>} 
                        isActive={activeTab === 'cloudflare'} 
                        onClick={() => setActiveTab('cloudflare')} 
                    />
                    <TabButton 
                        label="Tenant Approval" 
                        icon={<UsersIcon className="w-5 h-5"/>} 
                        isActive={activeTab === 'tenant-approval'} 
                        onClick={() => setActiveTab('tenant-approval')} 
                    />
                    <TabButton 
                        label="NTP Settings" 
                        icon={<ClockIcon className="w-5 h-5"/>} 
                        isActive={activeTab === 'ntp'} 
                        onClick={() => setActiveTab('ntp')} 
                    />
                    <TabButton 
                        label="SSH Terminal" 
                        icon={<CodeBracketIcon className="w-5 h-5"/>} 
                        isActive={activeTab === 'ssh-terminal'} 
                        onClick={() => setActiveTab('ssh-terminal')} 
                    />
                </nav>
            </div>
            
            {/* Restart Panel Button */}
            <div className="glass-card">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Panel Management</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Restart the panel service to apply changes or fix issues</p>
                    </div>
                    <button
                        onClick={handleRestartPanel}
                        disabled={isRestarting}
                        className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-400 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                    >
                        <UpdateIcon className="w-5 h-5" />
                        {isRestarting ? 'Restarting...' : 'Restart Panel'}
                    </button>
                </div>
                {restartStatus && (
                    <div className={`mt-4 p-3 rounded-md text-sm ${
                        restartStatus.startsWith('✅') 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                            : restartStatus.startsWith('❌')
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    }`}>
                        {restartStatus}
                    </div>
                )}
            </div>
            
            <div className="glass-card">
                {renderContent()}
            </div>

            <div className="glass-card">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
                    <LockClosedIcon className="w-6 h-6" />
                    Change Superadmin Password
                </h2>

                {passwordError && <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md">{passwordError}</div>}
                {passwordSuccess && <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md">{passwordSuccess}</div>}

                <form onSubmit={handlePasswordChange} className="mt-6 space-y-4">
                    <div>
                        <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300">New Password</label>
                        <input
                            id="newPassword"
                            type="password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            required
                            className="mt-1 block w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-slate-900 dark:text-white"
                        />
                    </div>
                     <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Confirm New Password</label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            required
                            className="mt-1 block w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-slate-900 dark:text-white"
                        />
                    </div>
                     <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={isPasswordSaving}
                            className="px-6 py-2 bg-[--color-primary-600] hover:bg-[--color-primary-500] text-white font-semibold rounded-lg disabled:opacity-50 flex items-center gap-2"
                        >
                            {isPasswordSaving && <Loader />}
                            {isPasswordSaving ? 'Saving...' : 'Save Password'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Factory Reset Component ---
const FactoryResetManager: React.FC = () => {
    const { t } = useLocalization();
    const [isResetting, setIsResetting] = useState(false);

    const handleFactoryReset = async () => {
        const firstConfirm = window.confirm(
            '⚠️ WARNING: FACTORY RESET\n\n' +
            'This will DELETE ALL DATA including:\n' +
            '• All user accounts\n' +
            '• All customers\n' +
            '• All routers\n' +
            '• All sales records\n' +
            '• All settings\n' +
            '• All uploaded files\n\n' +
            '✓ GOOD NEWS: Your system license is stored in the cloud and will be automatically restored after reset.\n\n' +
            'This action CANNOT be undone!\n\n' +
            'Are you sure you want to continue?'
        );
        
        if (!firstConfirm) return;
        
        const secondConfirm = window.confirm(
            'FINAL WARNING\n\n' +
            'You are about to perform a FACTORY RESET.\n' +
            'The system will restart and return to the first-time setup page.\n' +
            'Your license will be automatically restored from the cloud.\n\n' +
            'Click OK to proceed, or Cancel to abort.'
        );
        
        if (!secondConfirm) return;
        
        const thirdConfirm = window.prompt(
            'Type "RESET" in the box below to confirm factory reset:'
        );
        
        if (thirdConfirm !== 'RESET') {
            alert('Factory reset cancelled. Type "RESET" exactly to confirm.');
            return;
        }
        
        setIsResetting(true);
        try {
            const result = await factoryReset();
            if (result.success) {
                alert('Factory reset completed! The system is restarting...\n\nYour license will be automatically restored from the cloud when the system restarts.');
                localStorage.clear();
                sessionStorage.clear();
                setTimeout(() => {
                    window.location.href = '/register';
                }, 2000);
            } else {
                alert('Factory reset failed: ' + result.message);
            }
        } catch (err) {
            alert('Factory reset error: ' + (err as Error).message);
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3 mb-6">
                <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
                Factory Reset
            </h2>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <div className="flex-1">
                        <h4 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">Danger Zone</h4>
                        <p className="text-sm text-red-700 dark:text-red-400 mb-4">
                            Factory reset will permanently delete ALL data and return the system to its initial state. 
                            This includes all user accounts, customers, routers, sales records, settings, and uploaded files.
                            <strong className="block mt-1">This action cannot be undone!</strong>
                        </p>
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                            <p className="text-sm text-blue-700 dark:text-blue-400">
                                <strong>ℹ️ License Recovery:</strong> Your system license is safely stored in the cloud. 
                                After factory reset, your license will be automatically restored when you access the system again.
                            </p>
                        </div>
                        <button
                            onClick={handleFactoryReset}
                            disabled={isResetting}
                            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg disabled:opacity-50 flex items-center gap-2"
                        >
                            {isResetting && <Loader />}
                            {isResetting ? 'Resetting...' : '⚠️ Factory Reset'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};