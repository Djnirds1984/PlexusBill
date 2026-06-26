import React, { useState, useRef, useEffect } from 'react';
import { getAuthHeader } from '../services/databaseService.ts';

export const SSHTerminal: React.FC = () => {
    const [commandHistory, setCommandHistory] = useState<Array<{
        command: string;
        output: string;
        error: string;
        timestamp: Date;
        exitCode: number;
    }>>([]);
    const [currentCommand, setCurrentCommand] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);
    const [commandHistoryIndex, setCommandHistoryIndex] = useState(-1);
    const [pastedCommands, setPastedCommands] = useState<string[]>([]);
    const terminalRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Auto-scroll to bottom
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [commandHistory]);

    const executeCommand = async (cmd: string) => {
        if (!cmd.trim() || isExecuting) return;

        setIsExecuting(true);
        
        try {
            const res = await fetch('/api/superadmin/ssh', {
                method: 'POST',
                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: cmd })
            });

            const data = await res.json();
            
            setCommandHistory(prev => [...prev, {
                command: cmd,
                output: data.output || '',
                error: data.error || '',
                timestamp: new Date(),
                exitCode: data.exitCode || 0
            }]);
        } catch (err) {
            setCommandHistory(prev => [...prev, {
                command: cmd,
                output: '',
                error: (err as Error).message,
                timestamp: new Date(),
                exitCode: 1
            }]);
        } finally {
            setIsExecuting(false);
            setCurrentCommand('');
            setCommandHistoryIndex(-1);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        executeCommand(currentCommand);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            // Navigate command history up
            if (commandHistory.length > 0) {
                const newIndex = commandHistoryIndex === -1 
                    ? commandHistory.length - 1 
                    : Math.max(0, commandHistoryIndex - 1);
                setCommandHistoryIndex(newIndex);
                setCurrentCommand(commandHistory[newIndex].command);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            // Navigate command history down
            if (commandHistoryIndex !== -1) {
                const newIndex = commandHistoryIndex + 1;
                if (newIndex >= commandHistory.length) {
                    setCommandHistoryIndex(-1);
                    setCurrentCommand('');
                } else {
                    setCommandHistoryIndex(newIndex);
                    setCurrentCommand(commandHistory[newIndex].command);
                }
            }
        } else if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            executeCommand(currentCommand);
        } else if (e.key === 'l' && e.ctrlKey) {
            e.preventDefault();
            setCommandHistory([]);
        }
    };

    const quickCommands = [
        { label: '📊 System Info', cmd: 'uname -a && echo "---" && uptime' },
        { label: '💾 Disk Usage', cmd: 'df -h' },
        { label: '🧠 Memory Usage', cmd: 'free -h' },
        { label: '📡 Network Status', cmd: 'ip addr show' },
        { label: '🔄 PM2 Status', cmd: 'pm2 status' },
        { label: '🔧 Restart Panel', cmd: 'pm2 restart mikrotik-manager' },
        { label: '📝 View Logs', cmd: 'pm2 logs mikrotik-manager --lines 50 --nostream' },
        { label: '🕐 Current Time', cmd: 'timedatectl && echo "---" && date' },
        { label: '🌐 ZeroTier Status', cmd: 'sudo zerotier-cli status && echo "---" && sudo zerotier-cli listnetworks' },
        { label: '📦 Top Processes', cmd: 'ps aux --sort=-%mem | head -20' },
    ];

    const handleQuickCommand = (cmd: string) => {
        setCurrentCommand(cmd);
        executeCommand(cmd);
    };

    const clearTerminal = () => {
        setCommandHistory([]);
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        SSH Terminal
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Execute commands directly on your SBC
                    </p>
                </div>
                <button
                    onClick={clearTerminal}
                    className="px-3 py-1.5 text-sm bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-md transition-colors"
                >
                    Clear Terminal
                </button>
            </div>

            {/* Quick Commands */}
            <div className="glass-card p-4">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Quick Commands:</h4>
                <div className="flex flex-wrap gap-2">
                    {quickCommands.map((qc, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleQuickCommand(qc.cmd)}
                            disabled={isExecuting}
                            className="px-3 py-1.5 text-xs bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-md transition-colors disabled:opacity-50"
                        >
                            {qc.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Terminal Output */}
            <div 
                ref={terminalRef}
                className="bg-slate-900 text-green-400 font-mono text-sm rounded-lg p-4 h-96 overflow-y-auto border border-slate-700"
            >
                {commandHistory.length === 0 ? (
                    <div className="text-slate-500">
                        <div>Welcome to PlexusBill SSH Terminal</div>
                        <div>Type a command below and press Enter</div>
                        <div className="mt-2">Keyboard shortcuts:</div>
                        <div>  ↑/↓ - Navigate command history</div>
                        <div>  Ctrl+Enter - Execute command</div>
                        <div>  Ctrl+L - Clear terminal</div>
                    </div>
                ) : (
                    commandHistory.map((entry, idx) => (
                        <div key={idx} className="mb-4">
                            {/* Command */}
                            <div className="flex items-start gap-2">
                                <span className="text-cyan-400 select-none">$</span>
                                <span className="text-white flex-1">{entry.command}</span>
                                <span className="text-slate-500 text-xs">
                                    {entry.timestamp.toLocaleTimeString()}
                                </span>
                            </div>
                            
                            {/* Output */}
                            {entry.output && (
                                <pre className="text-green-400 mt-1 whitespace-pre-wrap break-words ml-4">
                                    {entry.output}
                                </pre>
                            )}
                            
                            {/* Error */}
                            {entry.error && (
                                <pre className="text-red-400 mt-1 whitespace-pre-wrap break-words ml-4">
                                    {entry.error}
                                </pre>
                            )}
                            
                            {/* Exit code */}
                            {entry.exitCode !== 0 && (
                                <div className="text-yellow-400 mt-1 ml-4 text-xs">
                                    [Exit code: {entry.exitCode}]
                                </div>
                            )}
                            
                            {/* Separator */}
                            <div className="border-t border-slate-800 mt-2"></div>
                        </div>
                    ))
                )}
                
                {isExecuting && (
                    <div className="text-yellow-400 animate-pulse">
                        Executing...
                    </div>
                )}
            </div>

            {/* Command Input */}
            <form onSubmit={handleSubmit} className="flex gap-2">
                <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400 font-mono select-none">
                        $
                    </span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={currentCommand}
                        onChange={(e) => setCurrentCommand(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter command..."
                        disabled={isExecuting}
                        className="w-full bg-slate-900 text-green-400 font-mono text-sm pl-8 pr-4 py-3 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        autoFocus
                    />
                </div>
                <button
                    type="submit"
                    disabled={isExecuting || !currentCommand.trim()}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
                >
                    {isExecuting ? 'Running...' : 'Execute'}
                </button>
            </form>

            {/* Warning */}
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    ⚠️ <strong>Warning:</strong> This executes commands directly on your SBC with root privileges. 
                    Dangerous commands are blocked for safety. Use with caution.
                </p>
            </div>
        </div>
    );
};
