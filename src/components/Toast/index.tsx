/**
 * Toast Component - Notification feedback
 */

import { useEffect, useState } from 'react';
import './Toast.css';

export interface ToastProps {
    message: string;
    type?: 'success' | 'error' | 'info';
    duration?: number;
    onClose?: () => void;
}

export default function Toast({ message, type = 'success', duration = 2500, onClose }: ToastProps) {
    const [visible, setVisible] = useState(true);
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setExiting(true);
            setTimeout(() => {
                setVisible(false);
                onClose?.();
            }, 300); // Match animation duration
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    if (!visible) return null;

    return (
        <div className={`toast toast-${type} ${exiting ? 'toast-exit' : ''}`}>
            <span className="toast-icon">
                {type === 'success' && '✓'}
                {type === 'error' && '✕'}
                {type === 'info' && 'ℹ'}
            </span>
            <span className="toast-message">{message}</span>
        </div>
    );
}
