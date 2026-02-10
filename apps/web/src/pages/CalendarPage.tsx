import { useState, useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useFrontmatterEnabled, useSettingsLoading } from '@/contexts/SettingsContext';
import { usePlans } from '@/lib/hooks/usePlans';
import { getDeadlineBgColor, cn } from '@/lib/utils';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/plan/StatusBadge';
import type { PlanMeta } from '@ccplans/shared';

type CalendarView = 'month' | 'week';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Pad start to Monday
  let dayOfWeek = firstDay.getDay();
  if (dayOfWeek === 0) dayOfWeek = 7; // Sunday = 7
  const startPad = dayOfWeek - 1; // Monday = 0

  for (let i = startPad; i > 0; i--) {
    const d = new Date(year, month, 1 - i);
    days.push(d);
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }

  // Pad end to fill last week
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      days.push(new Date(year, month + 1, i));
    }
  }

  return days;
}

function getWeekDays(baseDate: Date): Date[] {
  const days: Date[] = [];
  const dayOfWeek = baseDate.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() + mondayOffset);

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }

  return days;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

interface CalendarCellProps {
  date: Date;
  plans: PlanMeta[];
  isCurrentMonth: boolean;
  isToday: boolean;
  view: CalendarView;
}

function CalendarCell({ date, plans, isCurrentMonth, isToday, view }: CalendarCellProps) {
  return (
    <div
      className={cn(
        'border p-1 min-h-[80px] transition-colors',
        view === 'week' && 'min-h-[200px]',
        !isCurrentMonth && 'bg-muted/30 text-muted-foreground',
        isToday && 'bg-primary/5 border-primary'
      )}
    >
      <div
        className={cn(
          'text-xs font-medium mb-1 px-1',
          isToday && 'text-primary font-bold'
        )}
      >
        {date.getDate()}
      </div>
      <div className="space-y-0.5">
        {plans.slice(0, view === 'week' ? 10 : 3).map((plan) => {
          const bgColor = getDeadlineBgColor(plan.frontmatter?.dueDate);
          return (
            <Link
              key={plan.filename}
              to={`/plan/${encodeURIComponent(plan.filename)}`}
              className={cn(
                'block rounded px-1 py-0.5 text-xs truncate hover:bg-accent transition-colors',
                bgColor
              )}
              title={plan.title}
            >
              <span className="flex items-center gap-1">
                {plan.frontmatter?.status && (
                  <StatusBadge status={plan.frontmatter.status} />
                )}
                <span className="truncate">{plan.title}</span>
              </span>
            </Link>
          );
        })}
        {plans.length > (view === 'week' ? 10 : 3) && (
          <p className="text-xs text-muted-foreground px-1">
            +{plans.length - (view === 'week' ? 10 : 3)} more
          </p>
        )}
      </div>
    </div>
  );
}

export function CalendarPage() {
  const frontmatterEnabled = useFrontmatterEnabled();
  const settingsLoading = useSettingsLoading();
  if (settingsLoading) return null;
  if (!frontmatterEnabled) return <Navigate to="/" replace />;

  const { data, isLoading, error } = usePlans();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');

  const plans = data?.plans || [];

  // Build a map of date -> plans for quick lookup
  const plansByDate = useMemo(() => {
    const map = new Map<string, PlanMeta[]>();
    for (const plan of plans) {
      const dueDate = plan.frontmatter?.dueDate;
      if (!dueDate) continue;
      const key = dueDate.slice(0, 10); // YYYY-MM-DD
      const existing = map.get(key) || [];
      existing.push(plan);
      map.set(key, existing);
    }
    return map;
  }, [plans]);

  const days = useMemo(() => {
    if (view === 'month') {
      return getMonthDays(currentDate.getFullYear(), currentDate.getMonth());
    }
    return getWeekDays(currentDate);
  }, [currentDate, view]);

  const today = new Date();

  const navigatePrev = () => {
    const d = new Date(currentDate);
    if (view === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else {
      d.setDate(d.getDate() - 7);
    }
    setCurrentDate(d);
  };

  const navigateNext = () => {
    const d = new Date(currentDate);
    if (view === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else {
      d.setDate(d.getDate() + 7);
    }
    setCurrentDate(d);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const monthLabel = currentDate.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
  });

  const plansWithDueDate = plans.filter((p) => p.frontmatter?.dueDate);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-destructive">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p>Failed to load plans</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Calendar</h1>
        <p className="text-muted-foreground">
          {plansWithDueDate.length} plans with due dates
        </p>
      </div>

      {/* Navigation */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={navigatePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <h2 className="text-lg font-semibold ml-2">{monthLabel}</h2>
        </div>
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          <button
            onClick={() => setView('month')}
            className={cn(
              'px-3 py-1 text-sm rounded transition-colors',
              view === 'month'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent'
            )}
          >
            Month
          </button>
          <button
            onClick={() => setView('week')}
            className={cn(
              'px-3 py-1 text-sm rounded transition-colors',
              view === 'week'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent'
            )}
          >
            Week
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-muted">
          {DAY_LABELS.map((label) => (
            <div
              key={label}
              className="text-center text-xs font-medium py-2 border-b"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = formatDateKey(day);
            const dayPlans = plansByDate.get(key) || [];
            const isCurrentMonth =
              view === 'week' || day.getMonth() === currentDate.getMonth();
            const isDayToday = isSameDay(day, today);

            return (
              <CalendarCell
                key={key}
                date={day}
                plans={dayPlans}
                isCurrentMonth={isCurrentMonth}
                isToday={isDayToday}
                view={view}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
