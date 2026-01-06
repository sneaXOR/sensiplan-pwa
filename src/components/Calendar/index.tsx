/**
 * Composant Calendar - Vue calendrier des cycles
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './Calendar.css';
import {
    getAllCycles,
    getEntriesByCycle,
    getCurrentCycle,
} from '../../storage/db';
import type { Cycle, DailyEntry } from '@sensiplan/rule-engine';

interface CalendarDay {
    date: string;
    dayOfMonth: number;
    isCurrentMonth: boolean;
    entry?: DailyEntry;
    cycleDay?: number;
}

interface CalendarProps {
    onDateSelect?: (date: string) => void;
}

export default function Calendar({ onDateSelect }: CalendarProps) {
    const { t } = useTranslation();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [cycles, setCycles] = useState<Cycle[]>([]);
    const [currentCycle, setCurrentCycle] = useState<Cycle | null>(null);
    const [displayedCycle, setDisplayedCycle] = useState<Cycle | null>(null);
    const [entries, setEntries] = useState<DailyEntry[]>([]);
    const [displayedEntries, setDisplayedEntries] = useState<DailyEntry[]>([]);
    const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthNames = t('calendar.monthNames', { returnObjects: true }) as string[];
    const monthName = monthNames[month];

    // Charger les données
    useEffect(() => {
        async function loadData() {
            try {
                const allCycles = await getAllCycles();
                setCycles(allCycles);

                const current = await getCurrentCycle();
                setCurrentCycle(current || null);
                // Par défaut, afficher le cycle en cours
                if (!displayedCycle) {
                    setDisplayedCycle(current || null);
                }

                // Charger les entrées du cycle en cours pour le calendrier
                if (current) {
                    const cycleEntries = await getEntriesByCycle(current.id);
                    setEntries(cycleEntries);
                }
            } catch (error) {
                console.error('Error loading calendar data:', error);
            }
        }
        loadData();
    }, []);

    // Charger les entrées du cycle affiché (pour le graphique)
    useEffect(() => {
        async function loadDisplayedEntries() {
            if (displayedCycle) {
                const CycleEntries = await getEntriesByCycle(displayedCycle.id);
                setDisplayedEntries(CycleEntries);
            } else {
                setDisplayedEntries([]);
            }
        }
        loadDisplayedEntries();
    }, [displayedCycle]);

    function goToPreviousCycle() {
        if (!displayedCycle || cycles.length === 0) return;
        const index = cycles.findIndex(c => c.id === displayedCycle.id);
        if (index < cycles.length - 1) {
            setDisplayedCycle(cycles[index + 1]);
        }
    }

    function goToNextCycle() {
        if (!displayedCycle || cycles.length === 0) return;
        const index = cycles.findIndex(c => c.id === displayedCycle.id);
        if (index > 0) {
            setDisplayedCycle(cycles[index - 1]);
        }
    }

    // Générer les jours du calendrier
    useEffect(() => {
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const startDay = firstDayOfMonth.getDay(); // 0 = Sunday
        const daysInMonth = lastDayOfMonth.getDate();

        const days: CalendarDay[] = [];

        // Jours du mois précédent
        const prevMonth = new Date(year, month, 0);
        const prevMonthDays = prevMonth.getDate();
        for (let i = startDay - 1; i >= 0; i--) {
            const day = prevMonthDays - i;
            const date = new Date(year, month - 1, day);
            days.push({
                date: formatDate(date),
                dayOfMonth: day,
                isCurrentMonth: false,
            });
        }

        // Jours du mois en cours
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = formatDate(date);
            const entry = entries.find(e => e.date === dateStr);

            let cycleDay: number | undefined;
            if (currentCycle) {
                const cycleStart = new Date(currentCycle.startDate);
                const diff = Math.floor((date.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));
                if (diff >= 0) {
                    cycleDay = diff + 1;
                }
            }

            days.push({
                date: dateStr,
                dayOfMonth: day,
                isCurrentMonth: true,
                entry,
                cycleDay,
            });
        }

        // Jours du mois suivant
        const remainingDays = 42 - days.length; // 6 rows
        for (let day = 1; day <= remainingDays; day++) {
            const date = new Date(year, month + 1, day);
            days.push({
                date: formatDate(date),
                dayOfMonth: day,
                isCurrentMonth: false,
            });
        }

        setCalendarDays(days);
    }, [year, month, entries, currentCycle]);

    function formatDate(date: Date): string {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function goToPreviousMonth() {
        setCurrentDate(new Date(year, month - 1, 1));
    }

    function goToNextMonth() {
        setCurrentDate(new Date(year, month + 1, 1));
    }

    function goToToday() {
        setCurrentDate(new Date());
    }

    const today = formatDate(new Date());

    return (
        <div className="calendar">
            {/* Header */}
            <div className="calendar-header">
                <button className="nav-btn" onClick={goToPreviousMonth}>‹</button>
                <div className="month-year">
                    <span className="month-name">{monthName}</span>
                    <span className="year">{year}</span>
                </div>
                <button className="nav-btn" onClick={goToNextMonth}>›</button>
            </div>

            <button className="today-btn" onClick={goToToday}>
                {t('calendar.today')}
            </button>

            {/* Day names */}
            <div className="calendar-grid day-names">
                {(t('calendar.dayNames', { returnObjects: true }) as string[]).map((name, i) => (
                    <div key={i} className="day-name">{name}</div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="calendar-grid">
                {calendarDays.map((day, i) => (
                    <div
                        key={i}
                        className={`calendar-day ${day.isCurrentMonth ? '' : 'other-month'} ${day.date === today ? 'today' : ''}`}
                        onClick={() => onDateSelect?.(day.date)}
                        style={{ cursor: 'pointer' }}
                    >
                        <span className="day-number">{day.dayOfMonth}</span>
                        {day.entry && (
                            <div className="day-indicators">
                                {day.entry.bleedingIntensity && day.entry.bleedingIntensity > 0 && (
                                    <span className={`indicator bleeding-${day.entry.bleedingIntensity}`} />
                                )}
                                {day.entry.mucusObservation && (
                                    <span className={`indicator mucus-${day.entry.mucusObservation.replace('+', 'plus')}`} />
                                )}
                                {day.entry.temperature && (
                                    <span className="indicator temp" />
                                )}
                            </div>
                        )}
                        {day.cycleDay && (
                            <span className="cycle-day-label">J{day.cycleDay}</span>
                        )}
                    </div>
                ))}
            </div>

            {/* Temperature Chart - SVG dynamique scrollable */}
            {displayedEntries.length > 0 && (
                <div className="temp-chart card">
                    <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <button
                            className="nav-btn"
                            onClick={goToPreviousCycle}
                            disabled={!displayedCycle || cycles.findIndex(c => c.id === displayedCycle.id) >= cycles.length - 1}
                        >
                            ‹
                        </button>
                        <h3>
                            {t('chart.title')}
                            {displayedCycle && (
                                <span style={{ fontSize: '0.8em', fontWeight: 'normal', marginLeft: '10px' }}>
                                    (Cycle du {new Date(displayedCycle.startDate).toLocaleDateString()})
                                </span>
                            )}
                        </h3>
                        <button
                            className="nav-btn"
                            onClick={goToNextCycle}
                            disabled={!displayedCycle || cycles.findIndex(c => c.id === displayedCycle.id) <= 0}
                        >
                            ›
                        </button>
                    </div>

                    <div className="chart-scroll-container">
                        <svg
                            width={Math.max(displayedEntries.length * 40, 350)}
                            height="300"
                            className="chart-svg"
                        >
                            {/* Fond et Grille */}
                            <rect x="0" y="0" width="100%" height="300" fill="#f8f9fa" />

                            {/* Grille horizontale (Températures) */}
                            {[36.2, 36.3, 36.4, 36.5, 36.6, 36.7, 36.8, 36.9, 37.0, 37.1, 37.2].map((temp, i) => {
                                const y = 280 - ((temp - 36.2) * 250); // Échelle augmentée
                                return (
                                    <g key={temp}>
                                        <line
                                            x1="40"
                                            y1={y}
                                            x2="100%"
                                            y2={y}
                                            stroke={i % 5 === 0 ? "#ccc" : "#eee"}
                                            strokeWidth="1"
                                        />
                                        <text x="5" y={y + 4} fontSize="10" fill="#666">
                                            {temp.toFixed(1)}
                                        </text>
                                    </g>
                                );
                            })}

                            {/* Grille verticale (Jours) */}
                            {displayedEntries.map((entry, i) => {
                                const x = 60 + (i * 40);
                                const isWeekend = new Date(entry.date).getDay() === 0 || new Date(entry.date).getDay() === 6;
                                return (
                                    <g key={entry.date}>
                                        <line
                                            x1={x}
                                            y1="0"
                                            x2={x}
                                            y2="280"
                                            stroke="#eee"
                                            strokeDasharray="4 4"
                                        />
                                        {/* Fond jour weekend */}
                                        {isWeekend && (
                                            <rect x={x - 20} y="0" width="40" height="280" fill="rgba(0,0,0,0.02)" />
                                        )}
                                        <text x={x} y="295" fontSize="10" textAnchor="middle" fill="#666">
                                            {entry.cycleDay}
                                        </text>
                                    </g>
                                );
                            })}

                            {/* Courbe de température */}
                            <polyline
                                points={displayedEntries
                                    .filter(e => e.temperature && !e.temperatureExcluded)
                                    .map((e, i) => {
                                        const x = 60 + (i * 40);
                                        const y = 280 - ((e.temperature! - 36.2) * 250);
                                        return `${x},${y}`;
                                    })
                                    .join(' ')}
                                fill="none"
                                stroke="#4a7c59"
                                strokeWidth="2"
                            />

                            {/* Points de données */}
                            {displayedEntries.map((entry, i) => {
                                if (!entry.temperature || entry.temperatureExcluded) return null;
                                const x = 60 + (i * 40);
                                const y = 280 - ((entry.temperature - 36.2) * 250);
                                return (
                                    <circle
                                        key={i}
                                        cx={x}
                                        cy={y}
                                        r="4"
                                        fill="#4a7c59"
                                    />
                                );
                            })}

                            {/* Indicateurs Glaire (S/S+) et Saignements sous la courbe */}
                            {displayedEntries.map((entry, i) => {
                                const x = 60 + (i * 40);
                                return (
                                    <g key={`ind-${i}`}>
                                        {/* Saignements */}
                                        {entry.bleedingIntensity ? (
                                            <circle cx={x} cy="270" r="3" fill="#e74c3c" />
                                        ) : null}

                                        {/* Glaire fertile (S, S+) */}
                                        {(entry.mucusObservation === 'S' || entry.mucusObservation === 'S+') && (
                                            <circle cx={x} cy="260" r="3" fill="#3498db" />
                                        )}

                                        {/* Glaire infertile (d, ø, m) */}
                                        {(entry.mucusObservation === 'd' || entry.mucusObservation === 'm' || entry.mucusObservation === 'ø') && (
                                            <circle cx={x} cy="260" r="3" fill="#95a5a6" />
                                        )}
                                    </g>
                                );
                            })}
                        </svg>
                    </div>

                    {/* Légende */}
                    <div className="chart-legend">
                        <div className="legend-item">
                            <span className="legend-color temp-color"></span>
                            <span>{t('chart.legend.temperature')}</span>
                        </div>
                        <div className="legend-item">
                            <span className="legend-color mucus-fertile-color"></span>
                            <span>{t('chart.legend.fertile')}</span>
                        </div>
                        <div className="legend-item">
                            <span className="legend-color mucus-infertile-color"></span>
                            <span>{t('chart.legend.mucus')}</span>
                        </div>
                        <div className="legend-item">
                            <span className="legend-color bleeding-color"></span>
                            <span>{t('chart.legend.bleeding')}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Cycle Info */}
            {currentCycle && (
                <div className="cycle-info card">
                    <h3>{t('cycle.current')}</h3>
                    <p>
                        {t('cycle.length')}: {
                            Math.floor(
                                (new Date().getTime() - new Date(currentCycle.startDate).getTime())
                                / (1000 * 60 * 60 * 24)
                            ) + 1
                        } {t('cycle.day').toLowerCase()}s
                    </p>
                </div>
            )}


            {/* Previous Cycles */}
            {
                cycles.length > 1 && (
                    <div className="previous-cycles">
                        <h3>Cycles précédents</h3>
                        <ul className="cycles-list">
                            {cycles.slice(1, 6).map((cycle) => (
                                <li key={cycle.id} className="cycle-item">
                                    <span className="cycle-dates">
                                        {new Date(cycle.startDate).toLocaleDateString()}
                                        {cycle.endDate && ` → ${new Date(cycle.endDate).toLocaleDateString()}`}
                                    </span>
                                    {cycle.endDate && (
                                        <span className="cycle-length">
                                            {Math.floor(
                                                (new Date(cycle.endDate).getTime() - new Date(cycle.startDate).getTime())
                                                / (1000 * 60 * 60 * 24)
                                            ) + 1} jours
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )
            }
        </div >
    );
}
