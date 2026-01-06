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

export default function Calendar() {
    const { t } = useTranslation();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [cycles, setCycles] = useState<Cycle[]>([]);
    const [currentCycle, setCurrentCycle] = useState<Cycle | null>(null);
    const [entries, setEntries] = useState<DailyEntry[]>([]);
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

                // Charger les entrées du cycle en cours
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
        return date.toISOString().split('T')[0];
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

            {/* Temperature Chart - SVG léger */}
            {entries.length > 0 && (
                <div className="temp-chart card">
                    <h3>{t('chart.title')}</h3>
                    <svg
                        viewBox="0 0 320 160"
                        className="chart-svg"
                        preserveAspectRatio="xMidYMid meet"
                    >
                        {/* Grille horizontale */}
                        {[36.2, 36.4, 36.6, 36.8, 37.0, 37.2].map((temp, i) => (
                            <g key={temp}>
                                <line
                                    x1="30"
                                    y1={140 - i * 24}
                                    x2="310"
                                    y2={140 - i * 24}
                                    stroke="#e0e0e0"
                                    strokeWidth="1"
                                />
                                <text
                                    x="25"
                                    y={144 - i * 24}
                                    fontSize="8"
                                    fill="#666"
                                    textAnchor="end"
                                >
                                    {temp.toFixed(1)}
                                </text>
                            </g>
                        ))}

                        {/* Courbe de température */}
                        <polyline
                            fill="none"
                            stroke="var(--color-primary)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={entries
                                .filter(e => e.temperature && !e.temperatureExcluded)
                                .map(e => {
                                    const x = 30 + (e.cycleDay - 1) * 10;
                                    const y = 140 - ((e.temperature! - 36.2) / 1.0) * 120;
                                    return `${Math.min(310, x)},${Math.max(20, Math.min(140, y))}`;
                                })
                                .join(' ')}
                        />

                        {/* Points de température */}
                        {entries
                            .filter(e => e.temperature)
                            .map(e => {
                                const x = 30 + (e.cycleDay - 1) * 10;
                                const y = 140 - ((e.temperature! - 36.2) / 1.0) * 120;
                                return (
                                    <circle
                                        key={e.cycleDay}
                                        cx={Math.min(310, x)}
                                        cy={Math.max(20, Math.min(140, y))}
                                        r={e.temperatureExcluded ? 3 : 4}
                                        fill={e.temperatureExcluded ? '#999' : 'var(--color-primary)'}
                                        stroke="white"
                                        strokeWidth="1"
                                    />
                                );
                            })}

                        {/* Labels jours du cycle */}
                        {[1, 5, 10, 15, 20, 25, 28].map(d => {
                            const x = 30 + (d - 1) * 10;
                            if (x > 310) return null;
                            return (
                                <text
                                    key={d}
                                    x={x}
                                    y="155"
                                    fontSize="8"
                                    fill="#666"
                                    textAnchor="middle"
                                >
                                    {d}
                                </text>
                            );
                        })}
                    </svg>

                    {/* Légende glaire sous le graphique */}
                    <div className="mucus-legend">
                        {entries.filter(e => e.mucusObservation).slice(0, 28).map(e => (
                            <span
                                key={e.cycleDay}
                                className={`mucus-mark mucus-${e.mucusObservation?.replace('+', 'plus')}`}
                                title={`J${e.cycleDay}: ${e.mucusObservation}`}
                            >
                                {e.mucusObservation}
                            </span>
                        ))}
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
            {cycles.length > 1 && (
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
            )}
        </div>
    );
}
