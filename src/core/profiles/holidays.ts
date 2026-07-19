// =======================================================================
//  Holiday Calendar — Define regional holiday profiles
//  For the Calendar profile level (4th time dimension)
// =======================================================================

export type HolidayClass = 'religious' | 'national' | 'commercial' | 'school' | 'weekend';

export interface Holiday {
  date: string;        // MM-DD for annual, or YYYY-MM-DD for one-off
  name: string;
  region: string;      // 'GLOBAL', 'SA', 'AE', 'EG', etc.
  class: HolidayClass;
  loadMultiplier: number; // typical load factor on this day
  description: string;
}

// Default Middle East / Global holiday set
export const HOLIDAYS: Holiday[] = [
  // Religious — variable dates, use a representative example
  { date: '03-20', name: 'Ramadan (start — typical)', region: 'SA', class: 'religious', loadMultiplier: 0.7, description: 'Daily fasting — daytime load drops, evening peak surges' },
  { date: '04-10', name: 'Eid al-Fitr', region: 'SA', class: 'religious', loadMultiplier: 1.4, description: 'Multi-day celebration — cooking and gatherings' },
  { date: '06-15', name: 'Eid al-Adha', region: 'SA', class: 'religious', loadMultiplier: 1.4, description: 'Multi-day celebration' },
  // National
  { date: '09-23', name: 'National Day', region: 'SA', class: 'national', loadMultiplier: 1.2, description: 'Public holiday — higher residential usage' },
  { date: '12-02', name: 'National Day', region: 'AE', class: 'national', loadMultiplier: 1.2, description: 'UAE National Day' },
  { date: '07-23', name: 'Revolution Day', region: 'EG', class: 'national', loadMultiplier: 1.1, description: 'Egypt public holiday' },
  { date: '01-01', name: "New Year's Day", region: 'GLOBAL', class: 'national', loadMultiplier: 1.0, description: 'Global new year' },
  { date: '12-25', name: 'Christmas', region: 'GLOBAL', class: 'national', loadMultiplier: 1.3, description: 'High load — cooking, lighting, gatherings' },
  // Commercial
  { date: '11-25', name: 'Black Friday', region: 'GLOBAL', class: 'commercial', loadMultiplier: 1.5, description: 'Commercial surge if applicable' },
  { date: '12-31', name: "New Year's Eve", region: 'GLOBAL', class: 'commercial', loadMultiplier: 1.4, description: 'Late-night high usage' },
];

export function getHolidayMultiplier(date: Date, region: string = 'GLOBAL'): { isHoliday: boolean; factor: number; name: string } {
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const dow = date.getDay();

  // Weekend base
  if (dow === 0 || dow === 6) {
    return { isHoliday: true, factor: 1.15, name: 'Weekend' };
  }

  const match = HOLIDAYS.find(h => h.date === mmdd && (h.region === 'GLOBAL' || h.region === region));
  if (match) return { isHoliday: true, factor: match.loadMultiplier, name: match.name };

  return { isHoliday: false, factor: 1.0, name: 'Normal Day' };
}

export function buildCalendarYearProfile(year: number = new Date().getFullYear(), region: string = 'GLOBAL'): { date: string; isHoliday: boolean; factor: number; name: string }[] {
  const result = [];
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const h = getHolidayMultiplier(d, region);
    result.push({ date: d.toISOString().substring(0, 10), ...h });
  }
  return result;
}

export function getAnnualHolidayStats(year: number = new Date().getFullYear(), region: string = 'GLOBAL') {
  const profile = buildCalendarYearProfile(year, region);
  const holidays = profile.filter(d => d.isHoliday && d.name !== 'Weekend');
  const weekends = profile.filter(d => d.name === 'Weekend');
  const normalDays = profile.filter(d => !d.isHoliday);
  return {
    totalDays: profile.length,
    weekendDays: weekends.length,
    holidayDays: holidays.length,
    normalDays: normalDays.length,
    avgLoadFactor: profile.reduce((s, d) => s + d.factor, 0) / profile.length,
    holidays,
  };
}
