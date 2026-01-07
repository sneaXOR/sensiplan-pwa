/**
 * CollapsibleTip - Tooltip/conseil pliable
 * 
 * Affiche un bouton ℹ️ qui, au clic, révèle un conseil contextuel.
 * Permet une disclosure progressive des informations.
 */

import { useState } from 'react';
import './CollapsibleTip.css';

interface CollapsibleTipProps {
    /** Contenu du conseil à afficher */
    content: string;
    /** Variante de style */
    variant?: 'info' | 'tip' | 'warning';
    /** Label pour l'accessibilité */
    ariaLabel?: string;
    /** Afficher inline (à côté du label) ou en block */
    inline?: boolean;
}

export default function CollapsibleTip({
    content,
    variant = 'info',
    ariaLabel = 'Afficher le conseil',
    inline = true,
}: CollapsibleTipProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const toggleExpanded = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <span className={`collapsible-tip ${inline ? 'inline' : 'block'}`}>
            <button
                type="button"
                className={`tip-trigger ${isExpanded ? 'expanded' : ''}`}
                onClick={toggleExpanded}
                aria-label={ariaLabel}
                aria-expanded={isExpanded}
            >
                <span className="tip-icon">ℹ️</span>
            </button>

            {isExpanded && (
                <span
                    className={`tip-content tip-${variant}`}
                    role="tooltip"
                >
                    {content}
                </span>
            )}
        </span>
    );
}
