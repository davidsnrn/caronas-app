import { supabase } from './supabaseClient';
import { AppData, Trip, DEFAULT_WEEK_NAME } from '../types';

const DB_ID = 1; // ID fixo para salvar o estado global da aplicação
const LOCAL_STORAGE_KEY = 'carona_payment_data_v4';

// Helper to ensure data structure integrity
const sanitizeData = (data: any): AppData => {
  if (!data) {
    return { active_trips: [], currentWeekName: DEFAULT_WEEK_NAME };
  }
  // Convert JSON string to object if necessary (Supabase returns object, LocalStorage returns string)
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return { active_trips: [], currentWeekName: DEFAULT_WEEK_NAME };
    }
  }

  if (!data.active_trips) data.active_trips = [];
  if (!data.currentWeekName) data.currentWeekName = DEFAULT_WEEK_NAME;
  return data;
};

// Funcao para verificar conexao
export const checkConnection = async (): Promise<boolean> => {
  if (!navigator.onLine) return false;
  try {
    // Faz uma requisicao leve (HEAD) apenas para verificar acesso
    const { status, error } = await supabase
      .from('app_state')
      .select('id', { count: 'exact', head: true })
      .eq('id', DB_ID);
      
    // Status 200-299 indica sucesso na conexao HTTP com o banco
    return !error && status >= 200 && status < 300;
  } catch (e) {
    return false;
  }
};

export const loadAppData = async (): Promise<AppData> => {
  let finalData: AppData | null = null;

  // 1. Tentar carregar do Supabase
  try {
    const { data, error } = await supabase
      .from('app_state')
      .select('payload')
      .eq('id', DB_ID)
      .maybeSingle(); // Usa maybeSingle para não estourar erro se não existir

    if (data && data.payload) {
      console.log("Data loaded from Supabase");
      finalData = sanitizeData(data.payload);
      // Atualiza cache local
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(finalData));
    } else if (!data && !error) {
       // Tabela existe, mas linha não. Tenta inicializar.
       console.log("Database Row missing. Initializing...");
       const defaultData = { active_trips: [], currentWeekName: DEFAULT_WEEK_NAME };
       await supabase.from('app_state').insert({ id: DB_ID, payload: defaultData });
       finalData = defaultData;
    } else if (error) {
      console.warn("Supabase load error (using local fallback):", error.message);
    }
  } catch (e) {
    console.error("Failed to connect to Supabase", e);
  }

  // 2. Se falhar ou não tiver dados, carregar do LocalStorage
  if (!finalData) {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        console.log("Data loaded from LocalStorage (Fallback)");
        finalData = sanitizeData(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load local data", e);
    }
  }

  return finalData || {
    active_trips: [],
    currentWeekName: DEFAULT_WEEK_NAME
  };
};

let saveTimeout: any = null;

export const saveAppData = async (data: AppData) => {
  // 1. Salvar Localmente imediatamente (UI otimista)
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save local data", e);
  }

  // 2. Debounce para salvar no Supabase (evita excesso de requisições ao digitar/clicar rápido)
  if (saveTimeout) clearTimeout(saveTimeout);
  
  saveTimeout = setTimeout(async () => {
    try {
      const { error } = await supabase
        .from('app_state')
        .upsert({ id: DB_ID, payload: data });
      
      if (error) {
        console.error("Error saving to Supabase:", error);
      } else {
        console.log("Data synced to Supabase");
      }
    } catch (e) {
      console.error("Failed to sync remote data", e);
    }
  }, 1000); // Aguarda 1 segundo de inatividade antes de enviar
};

export const generateParticipantId = (name: string) => 
  `p-${Date.now()}-${name.replace(/\s/g, '').toLowerCase().substring(0, 5)}`;

export const formatDate = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export const generateWeekName = (startDateString: string) => {
  if (!startDateString) return null;
  const parts = startDateString.split('-');
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1;
  const day = parseInt(parts[2]);
  const startDate = new Date(year, month, day);
  
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 4);

  return `Semana ${formatDate(startDate)} - ${formatDate(endDate)}`;
};

export const parseStartDateFromWeekName = (weekName: string): Date | null => {
  const match = weekName.match(/Semana (\d{2}\/\d{2}\/\d{4})/);
  if (match) {
    const parts = match[1].split('/').map(Number);
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return null;
};

export const getAllUniqueNames = (data: AppData): string[] => {
  const names = new Set<string>();
  
  // Add from active
  data.active_trips.forEach(trip => {
    trip.participants.forEach(p => names.add(p.name));
  });

  // Add from archives
  Object.keys(data).forEach(key => {
    if (key !== 'active_trips' && key !== 'currentWeekName' && Array.isArray(data[key])) {
      (data[key] as Trip[]).forEach(trip => {
        trip.participants.forEach(p => names.add(p.name));
      });
    }
  });

  return Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR'));
};

export const generateShareText = (trips: Trip[], payers: number, totalReceived: number, weekName: string) => {
  let text = `📅 Status de Pagamento de Caronas - ${weekName}\n`;
  text += `💰 Total Recebido: R$ ${totalReceived.toFixed(2).replace('.', ',')}\n`;
  text += `👥 Pagamentos Concluídos: ${payers}\n`;
  text += '==================================================\n\n';

  if (trips.length === 0) {
    text += 'Nenhuma viagem cadastrada nesta semana ativa.';
    return text;
  }

  trips.forEach(trip => {
    text += `📅 ${trip.day} - ${trip.type}:\n`;
    trip.participants.forEach(p => {
      const status = p.paid ? '✅ PAGO' : '❌ PENDENTE';
      text += `- ${p.name}: ${status}\n`;
    });
    text += '\n';
  });
  return text;
};