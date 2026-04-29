'use client';

import { buildPomodoroHistoryCalendar } from '@/lib/pomodoro/history';
import {
  formatPomodoroHistoryMinutes,
  POMODORO_HISTORY_DAY_LABEL_ROWS,
  POMODORO_HISTORY_DAY_LABELS,
  POMODORO_HISTORY_LEVEL_STYLES,
} from '@/lib/pomodoro/constants';
import type { PomodoroHistoryRow } from '@/lib/pomodoro/history';
import { toPomodoroDayKey } from '@/lib/pomodoro/date';
import { useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type PomodoroHistoryGraphProps = {
  rows: PomodoroHistoryRow[];
};

const POMODORO_HISTORY_CELL_SIZE_PX = 14;
const POMODORO_HISTORY_COLUMN_GAP_PX = 4;

function formatTooltip(date: Date, totalMinutes: number) {
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  if (totalMinutes <= 0) {
    return `No focus time on ${formattedDate}.`;
  }

  return `${formatPomodoroHistoryMinutes(totalMinutes)} focused on ${formattedDate}.`;
}

function formatTooltipDetail(totalMinutes: number) {
  if (totalMinutes <= 0) {
    return 'No focused work logged';
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m of focused work`;
  }
  if (hours > 0) {
    return `${hours}h of focused work`;
  }
  return `${Math.round(totalMinutes)}m of focused work`;
}

export function PomodoroHistoryGraph({ rows }: PomodoroHistoryGraphProps) {
  const calendar = useMemo(() => buildPomodoroHistoryCalendar(rows), [rows]);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const todayKey = useMemo(() => toPomodoroDayKey(new Date()), []);
  const graphWidth = useMemo(() => (
    (calendar.weeks.length * POMODORO_HISTORY_CELL_SIZE_PX)
    + (Math.max(0, calendar.weeks.length - 1) * POMODORO_HISTORY_COLUMN_GAP_PX)
  ), [calendar.weeks.length]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const todayCell = scrollContainer?.querySelector<HTMLElement>('[data-today="true"]');

    if (!scrollContainer || !todayCell) {
      return;
    }

    const targetLeft = todayCell.offsetLeft - (scrollContainer.clientWidth / 2) + (todayCell.clientWidth / 2);
    const maxScrollLeft = Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth);

    scrollContainer.scrollTo({
      left: Math.min(Math.max(0, targetLeft), maxScrollLeft),
      behavior: 'smooth',
    });
  }, [calendar.weeks]);

  return (
    <Card className="w-full min-w-0 overflow-hidden rounded-2xl border border-border/70 shadow-sm">
      <CardHeader className="space-y-1 px-5 pb-2 sm:px-6">
        <CardTitle className="text-base font-semibold">
          Focus History
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          {`${formatPomodoroHistoryMinutes(calendar.totalMinutes)} focused across ${calendar.activeDays} active days in the last year`}
        </p>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4 px-5 pt-0 pb-5 sm:px-6 sm:pb-6">
        <div className="max-w-full overflow-hidden">
          <div
            ref={scrollContainerRef}
            className="max-w-full overflow-x-auto overflow-y-hidden pb-1"
          >
            <div className="inline-flex min-w-max gap-1 pr-1">
              <div className="grid grid-rows-[20px_repeat(7,14px)] gap-1 pt-5 text-[10px] text-muted-foreground">
                <div />
                {POMODORO_HISTORY_DAY_LABELS.map((label, dayIndex) => (
                  <div key={label} className="flex h-3.5 items-center justify-end pr-0.5">
                    {POMODORO_HISTORY_DAY_LABEL_ROWS.has(dayIndex) ? label : ''}
                  </div>
                ))}
              </div>

              <div className="min-w-max">
                <div
                  className="relative mb-1 h-5 text-[11px] text-muted-foreground"
                  style={{ width: `${graphWidth}px` }}
                >
                  {calendar.monthLabels.map(label => (
                    <div
                      key={`month-${label.weekIndex}-${label.label}`}
                      className="absolute top-0 whitespace-nowrap"
                      style={{
                        left: `${label.weekIndex * (POMODORO_HISTORY_CELL_SIZE_PX + POMODORO_HISTORY_COLUMN_GAP_PX)}px`,
                      }}
                    >
                      {label.label}
                    </div>
                  ))}
                </div>

                <div
                  className="grid gap-x-1"
                  style={{ gridTemplateColumns: `repeat(${calendar.weeks.length}, max-content)` }}
                >
                  {calendar.weeks.map(week => (
                    <div key={`week-${week[0]?.dateKey ?? 'empty'}`} className="grid grid-rows-7 gap-1">
                      {week.map((cell) => {
                        const tooltipLabel = formatTooltip(cell.date, cell.totalMinutes);
                        const isToday = cell.dateKey === todayKey;

                        if (!cell.isInRange) {
                          return <div key={cell.dateKey} className="h-3.5 w-3.5 rounded-[3px] bg-transparent" />;
                        }

                        return (
                          <Tooltip key={cell.dateKey}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                data-today={isToday ? 'true' : 'false'}
                                aria-label={tooltipLabel}
                                className={`h-3.5 w-3.5 rounded-[3px] ${POMODORO_HISTORY_LEVEL_STYLES[cell.level]} ${isToday ? 'ring-primary/70 ring-1 ring-offset-1 ring-offset-background' : ''} transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
                              />
                            </TooltipTrigger>
                            <TooltipContent side="top" sideOffset={0}>
                              <div className="space-y-0">
                                <p>
{cell.date.toLocaleDateString('en-US', {
                                  month: 'long',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                                </p>
                                <p className="text-primary-foreground/80">
                                  {formatTooltipDetail(cell.totalMinutes)}
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <p className="min-w-0">Each square shows focused time completed that day.</p>
          <div className="flex items-center gap-1 whitespace-nowrap">
            <span>Less</span>
            {[0, 1, 2, 3, 4].map(level => (
              <div
                key={level}
                className={`h-3.5 w-3.5 rounded-[3px] ${POMODORO_HISTORY_LEVEL_STYLES[level as 0 | 1 | 2 | 3 | 4]}`}
              />
            ))}
            <span>More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
