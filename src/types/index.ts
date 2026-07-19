// Master Load Engine — Type Definitions
// A complete engineering-grade type system for the Solar Load Calculator

export type CategoryMain =
  | 'Lighting' | 'HVAC' | 'Kitchen' | 'Pump' | 'Medical'
  | 'IT' | 'Industrial' | 'EV' | 'Security' | 'Water'
  | 'Office' | 'Laundry' | 'Other';

export type PhaseType = '1Ø' | '3Ø';
export type ElectricalType = 'AC' | 'DC';
export type HarmonicClass = 'Linear' | 'Nonlinear' | 'High Harmonics';
export type OperatingMode = 'Continuous' | 'Intermittent' | 'Scheduled' | 'Seasonal' | 'Sensor-Based';
export type Criticality = 'Critical' | 'Essential' | 'Normal' | 'Optional';
export type TimeProfileType = 'Base Load' | 'Morning Peak' | 'Noon Peak' | 'Evening Peak' | 'Night Load' | '24/7' | 'Day Load';
export type DataSource = 'Nameplate' | 'Measured' | 'Manufacturer' | 'EnergyStar' | 'Estimated';
export type MeasurementMethod = 'Wattmeter' | 'Clamp Meter' | 'Datasheet' | 'Estimate';
export type ConfidenceLevel = 'High' | 'Medium' | 'Low';
export type ExpertLevel = 'Basic' | 'Professional' | 'Commercial' | 'Expert';

export interface Load {
  // A) Identity
  id: string;
  loadId: string;           // LD-0001
  loadTag: string;          // AC-LR-01
  loadName: string;
  arabicName: string;
  categoryMain: CategoryMain;
  categorySub: string;
  spaceArea: string;
  buildingLevel: string;
  distributionBoard: string;
  circuitReference: string;
  description: string;

  // B) Electrical basics
  electricalType: ElectricalType;
  voltageNominal: number;   // V
  frequency: '50Hz' | '60Hz';
  phaseType: PhaseType;
  ratedPowerW: number;
  runningPowerW: number;
  measuredPowerW: number;
  powerFactor: number;      // 0..1
  efficiency: number;       // 0..100
  thdPercent: number;       // 0..100
  harmonicClass: HarmonicClass;
  lockedRotorCurrentA: number;
  surgeMultiplier: number;  // 1, 1.5, 2, 3, 5, 7, custom
  surgePowerW: number;      // computed

  // C) Behavior
  quantity: number;
  dutyCyclePercent: number; // 0..100
  utilizationFactorKu: number;     // 0..1
  demandFactor: number;           // 0..1
  coincidenceFactor: number;      // 0..1
  diversityFactor: number;        // 0..1
  continuousLoad: boolean;
  continuousHours: number;
  criticality: Criticality;
  deferrableLoad: boolean;
  shiftableToDaytime: boolean;
  smartControlled: boolean;
  autoStart: boolean;
  cyclingLoad: boolean;
  standbyLoad: boolean;
  phantomLoadW: number;

  // D) Time-of-use
  dayHoursSummer: number;
  nightHoursSummer: number;
  dayHoursWinter: number;
  nightHoursWinter: number;
  weekdayHours: number;
  weekendHours: number;
  operatingDaysPerWeek: number;
  operatingDaysPerYear: number;
  operatingMode: OperatingMode;

  // E) Time profiles
  timeProfileType: TimeProfileType;
  peakStartTime: string;    // HH:MM
  peakEndTime: string;      // HH:MM
  hourlyProfile: number[];  // 24 values 0..1
  simultaneousGroup: string;
  maxSimultaneousUnits: number;

  // G) Verification
  dataSource: DataSource;
  measurementMethod: MeasurementMethod;
  measurementDate: string;
  confidenceLevel: ConfidenceLevel;
  notes: string;
}

export interface ApplianceTemplate {
  name: string;
  arabicName: string;
  categoryMain: CategoryMain;
  categorySub: string;
  ratedPowerW: number;
  runningPowerW: number;
  powerFactor: number;
  efficiency: number;
  electricalType: ElectricalType;
  voltageNominal: number;
  phaseType: PhaseType;
  frequency: '50Hz' | '60Hz';
  thdPercent: number;
  harmonicClass: HarmonicClass;
  surgeMultiplier: number;
  dutyCyclePercent: number;
  utilizationFactorKu: number;
  demandFactor: number;
  isMotor: boolean;
  hasStandby: boolean;
  phantomLoadW: number;
  typicalDayHours: number;
  typicalNightHours: number;
  operatingMode: OperatingMode;
  timeProfileType: TimeProfileType;
  continuousLoad: boolean;
  criticality: Criticality;
  isCyclic: boolean;
  hourlyProfile: number[];
}

export interface SummaryMetrics {
  totalConnectedLoadW: number;
  totalRunningLoadW: number;
  maximumDemandW: number;
  diversifiedLoadW: number;
  coincidentPeakLoadW: number;
  totalDailyEnergyWh: number;
  dayEnergyWh: number;
  nightEnergyWh: number;
  monthlyEnergyKWh: number;
  annualEnergyKWh: number;
  peakDemandKW: number;
  peakDemandKVA: number;
  estimatedMaxCurrentA: number;
  maximumSurgeKW: number;
  loadFactor: number;
  phantomLossWh: number;
  criticalLoadWh: number;
  deferrableLoadWh: number;
  byCategory: { name: string; value: number; color: string }[];
  byCriticality: { name: string; value: number; color: string }[];
  hourlyProfile: number[];        // 24 values in W (connected)
  hourlyOperatingProfile: number[]; // 24 values in W (operating)
}
