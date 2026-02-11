import React from 'react';
import { Trip, PAYMENT_VALUE, Participant } from '../types';
import { Trash2, Edit2, UserX } from 'lucide-react';
import { parseStartDateFromWeekName } from '../services/dataUtils';

interface TripListProps {
  trips: Trip[];
  currentWeekName: string;
  onTogglePayment: (tripIndex: number, participantIndex: number) => void;
  onDeleteTrip: (tripIndex: number) => void;
  onDeleteParticipant: (tripIndex: number, participantIndex: number) => void;
  onEditParticipantName: (tripIndex: number, participantIndex: number) => void;
}

export const TripList: React.FC<TripListProps> = ({
  trips,
  currentWeekName,
  onTogglePayment,
  onDeleteTrip,
  onDeleteParticipant,
  onEditParticipantName
}) => {
  if (trips.length === 0) {
    return (
      <div className="p-12 text-center bg-white rounded-xl border-2 border-dashed border-gray-200 shadow-sm">
        <div className="text-gray-400 mb-2">
          <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900">Semana Vazia</h3>
        <p className="text-gray-500 mt-1">Use o botão "+ Adicionar Trecho" para cadastrar caronas.</p>
      </div>
    );
  }

  // Grouping logic
  const dayOrder = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  
  const grouped = trips.map((trip, idx) => ({ ...trip, originalIndex: idx })).reduce((acc, trip) => {
    if (!acc[trip.day]) acc[trip.day] = { dayKey: trip.day, ida: null, volta: null };
    if (trip.type === 'Ida') acc[trip.day].ida = trip;
    else acc[trip.day].volta = trip;
    return acc;
  }, {} as Record<string, { dayKey: string, ida: any, volta: any }>);

  const sortedDays = Object.keys(grouped).sort((a, b) => {
     const dayA = a.split(' ')[0];
     const dayB = b.split(' ')[0];
     return dayOrder.indexOf(dayA) - dayOrder.indexOf(dayB);
  });

  const renderTripBlock = (trip: any, type: 'Ida' | 'Volta') => {
    // Colors
    const isIda = type === 'Ida';
    const headerColor = isIda ? 'bg-sky-100 text-sky-800 border-sky-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200';
    
    // Past due logic check
    let isPastDue = false;
    const match = trip.day.match(/\((\d{2})\/(\d{2})\)/);
    if (match) {
        const d = parseInt(match[1]);
        const m = parseInt(match[2]) - 1;
        const weekStart = parseStartDateFromWeekName(currentWeekName);
        const y = weekStart ? weekStart.getFullYear() : new Date().getFullYear();
        const tripDate = new Date(y, m, d);
        const today = new Date();
        today.setHours(0,0,0,0);
        
        if (tripDate < today) {
          isPastDue = true;
        }
    }

    // Sort participants alphabetically just to be safe in UI
    const sortedParticipants = [...trip.participants].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    return (
      <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className={`px-4 py-3 flex justify-between items-center border-b ${headerColor}`}>
           <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-2">
             {type === 'Ida' ? '🌅' : '🌇'} {type}
           </h3>
           <button 
             onClick={() => onDeleteTrip(trip.originalIndex)}
             className="text-xs font-semibold bg-white/50 hover:bg-white text-red-600 px-2 py-1 rounded transition-colors flex items-center gap-1"
           >
             <Trash2 size={12} /> Excluir
           </button>
        </div>
        
        <div className="flex flex-col">
          {sortedParticipants.map((person: Participant) => {
             // Find original index in trip.participants for the callback
             const pIdx = trip.participants.findIndex((p: Participant) => p.id === person.id);
             
             const isLateAndUnpaid = !person.paid && isPastDue;
             const rowStateClass = isLateAndUnpaid
                ? 'bg-red-50 border-l-4 border-l-red-500'
                : 'border-l-4 border-transparent hover:bg-gray-50';

             return (
               <div 
                 key={person.id} 
                 className={`flex items-center justify-between p-3 pl-4 transition-colors group border-b border-gray-50 last:border-b-0 ${rowStateClass}`}
               >
                 <div className="flex items-center gap-3">
                   <div className="flex flex-col">
                     <span className={`font-medium text-sm ${isLateAndUnpaid ? 'text-red-700' : 'text-gray-800'}`}>
                       {person.name}
                     </span>
                   </div>
                   
                   <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1 ml-2">
                     <button 
                        onClick={() => onEditParticipantName(trip.originalIndex, pIdx)}
                        className="p-1 text-gray-400 hover:text-indigo-600 rounded" title="Editar Nome"
                      >
                       <Edit2 size={14} />
                     </button>
                     <button 
                        onClick={() => onDeleteParticipant(trip.originalIndex, pIdx)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded" title="Remover Pessoa"
                      >
                       <UserX size={14} />
                     </button>
                   </div>
                 </div>

                 <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold hidden sm:block ${person.paid ? 'text-green-600' : (isLateAndUnpaid ? 'text-red-500' : 'text-gray-400')}`}>
                      R$ {PAYMENT_VALUE.toFixed(2).replace('.', ',')}
                    </span>
                    
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={person.paid}
                        onChange={() => onTogglePayment(trip.originalIndex, pIdx)}
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                 </div>
               </div>
             )
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {sortedDays.map(dayKey => {
        const { ida, volta } = grouped[dayKey];
        return (
          <div key={dayKey} className="relative">
             <div className="sticky top-[70px] z-10 py-2 bg-gray-50/95 backdrop-blur-sm mb-2 border-b border-gray-200">
                <h2 className="text-lg font-extrabold text-gray-800">{dayKey}</h2>
             </div>
             <div className="grid gap-4 md:grid-cols-1">
               {ida && renderTripBlock(ida, 'Ida')}
               {volta && renderTripBlock(volta, 'Volta')}
             </div>
          </div>
        )
      })}
    </div>
  );
};