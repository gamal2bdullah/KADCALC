// =======================================================================
//  Multi-Level Profile Builder
//  Hourly → Daily → Seasonal → Calendar (weekday/weekend/holiday)
// =======================================================================

import type { Load } from '../../types';
import { calcRunningLoad } from '../../utils/calculations';

export interface HourlyProfile { hour: number; power: number; loadIds: string[] }
export interface DailyProfile { total: number; day: number; night: number; peak: number; peakHour: number }
export interface SeasonalProfile { summer: DailyProfile; winter: DailyProfile; variance: number }
export interface CalendarProfile { weekday: DailyProfile; weekend: DailyProfile; weekendFactor: number }
export interface CompleteProfile { hourly: HourlyProfile[]; daily: DailyProfile; seasonal: SeasonalProfile; calendar: CalendarProfile; loadContributions: Map<string, number[]> }

// =======================================================================
//  DEFAULT HOURLY PROFILES BY TYPE
// =======================================================================
const PROFILE_24_7 = Array(24).fill(1);
const profileMorning = [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
const profileNoon = [0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0];
const profileEvening = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0];
const profileNight = [1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1];
const profileDay = [0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0];
const profileBase = Array(24).fill(1);

function defaultProfile(type: string): number[] {
  switch (type) {
    case '24/7': return PROFILE_24_7;
    case 'Morning Peak': return profileMorning;
    case 'Noon Peak': return profileNoon;
    case 'Evening Peak': return profileEvening;
    case 'Night Load': return profileNight;
    case 'Day Load': return profileDay;
    case 'Base Load': return profileBase;
    default: return profileDay;
  }
}

// =======================================================================
//  THE BUILDER
// =======================================================================
export function buildCompleteProfile(loads: Load[]): CompleteProfile {
  // === 1. HOURLY PROFILE ===
  // For each load, distribute its total daily energy across 24 hours
  // using its hourlyProfile (or default for timeProfileType)
  const hourly: HourlyProfile[] = Array.from({ length: 24 }, (_, hour) => ({
    hour, power: 0, loadIds: [],
  }));

  const loadContributions = new Map<string, number[]>();
  loads.forEach(l => {
    const hp = l.hourlyProfile;
    const hasCustomProfile = !!hp && hp.length === 24 && hp.some(v => v !== 0);
    const profile = hasCustomProfile ? hp : defaultProfile(l.timeProfileType);
    const total = profile.reduce((s, v) => s + v, 0) || 1;
    const running = calcRunningLoad(l);
    const hours = (l.dayHoursSummer + l.nightHoursSummer) || 1;
    // For each hour, allocate a share of the running power proportional to the profile
    const perHourContribution = profile.map(v => (running * v) / total * hours * l.utilizationFactorKu * (l.dutyCyclePercent / 100) * l.demandFactor);
    loadContributions.set(l.id, perHourContribution);
    perHourContribution.forEach((w, h) => {
      hourly[h].power += w;
      if (w > 0) hourly[h].loadIds.push(l.id);
    });
  });

  // === 2. DAILY PROFILE ===
  const total = hourly.reduce((s, h) => s + h.power, 0);
  const dayEnergy = hourly.slice(8, 18).reduce((s, h) => s + h.power, 0);
  const nightEnergy = total - dayEnergy;
  const peakHour = hourly.reduce((max, h, i) => h.power > hourly[max].power ? i : max, 0);
  const daily: DailyProfile = {
    total, day: dayEnergy, night: nightEnergy,
    peak: hourly[peakHour].power, peakHour,
  };

  // === 3. SEASONAL PROFILE ===
  const summer = buildDailyForSeason(loads, 'summer');
  const winter = buildDailyForSeason(loads, 'winter');
  const variance = summer.total > 0 ? Math.abs((summer.total - winter.total) / summer.total) * 100 : 0;
  const seasonal: SeasonalProfile = { summer, winter, variance };

  // === 4. CALENDAR PROFILE ===
  // Approximate weekend factor based on operatingDaysPerWeek
  const avgOperatingDays = loads.reduce((s, l) => s + l.operatingDaysPerWeek, 0) / Math.max(1, loads.length);
  const weekendFactor = 1 + ((7 - avgOperatingDays) / 7) * 0.15; // +15% on weekend heuristic
  const weekday: DailyProfile = { ...daily };
  const weekend: DailyProfile = { ...daily, total: daily.total * weekendFactor, day: daily.day * weekendFactor, night: daily.night * weekendFactor, peak: daily.peak * weekendFactor };
  const calendar: CalendarProfile = { weekday, weekend, weekendFactor };

  return { hourly, daily, seasonal, calendar, loadContributions };
}

function buildDailyForSeason(loads: Load[], season: 'summer' | 'winter'): DailyProfile {
  const hourly = Array(24).fill(0);
  loads.forEach(l => {
    const hp = l.hourlyProfile;
    const hasCustomProfile = !!hp && hp.length === 24 && hp.some(v => v !== 0);
    const profile = hasCustomProfile ? hp : defaultProfile(l.timeProfileType);
    const total = profile.reduce((s, v) => s + v, 0) || 1;
    const running = calcRunningLoad(l);
    const hours = season === 'summer' ? (l.dayHoursSummer + l.nightHoursSummer) : (l.dayHoursWinter + l.nightHoursWinter);
    profile.forEach((v, h) => {
      hourly[h] += (running * v) / total * hours * l.utilizationFactorKu * (l.dutyCyclePercent / 100) * l.demandFactor * (l.operatingDaysPerWeek / 7);
    });
  });
  const total = hourly.reduce((s, v) => s + v, 0);
  const dayEnergy = hourly.slice(8, 18).reduce((s, v) => s + v, 0);
  const peakHour = hourly.reduce((max, v, i) => v > hourly[max] ? i : max, 0);
  return { total, day: dayEnergy, night: total - dayEnergy, peak: hourly[peakHour], peakHour };
}

// =======================================================================
//  PEAK WINDOW DETECTION
// =======================================================================
export function detectPeakWindows(hourly: HourlyProfile[]): { start: number; end: number; avgPower: number }[] {
  const threshold = Math.max(...hourly.map(h => h.power)) * 0.7; // 70% of peak
  const windows: { start: number; end: number; avgPower: number }[] = [];
  let inWindow = false, start = 0, sum = 0, count = 0;
  hourly.forEach((h, i) => {
    if (h.power >= threshold && !inWindow) {
      inWindow = true; start = i; sum = 0; count = 0;
    }
    if (inWindow) {
      sum += h.power; count++;
      if (h.power < threshold || i === 23) {
        windows.push({ start, end: i, avgPower: sum / count });
        inWindow = false;
      }
    }
  });
  return windows;
}
