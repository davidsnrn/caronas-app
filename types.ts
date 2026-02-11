export interface Participant {
  id: string;
  name: string;
  paid: boolean;
}

export type TripType = 'Ida' | 'Volta';

export interface Trip {
  day: string;
  time: string | null;
  type: TripType;
  participants: Participant[];
}

export interface AppData {
  active_trips: Trip[];
  currentWeekName: string;
  [key: string]: any; // For archived weeks
}

export interface WeekGroup {
  year: number;
  months: {
    monthIndex: number;
    weeks: {
      name: string;
      startDate: Date;
      isActive: boolean;
    }[];
  }[];
}

export const PAYMENT_VALUE = 30.00;
export const DEFAULT_WEEK_NAME = 'Semana Atual';
export const LOCAL_STORAGE_KEY = 'carona_payment_data_v4';
