import React, { useState, useMemo } from 'react';
import { AppData, DEFAULT_WEEK_NAME } from '../types';
import { parseStartDateFromWeekName } from '../services/dataUtils';
import { ChevronRight, ChevronDown, Trash2, Calendar, Database, ChevronLeft } from 'lucide-react';

interface SidebarProps {
  data: AppData;
  onSelectWeek: (name: string) => void;
  onDeleteWeek: (name: string) => void;
  onOpenNewWeek: () => void;
  onOpenBackup: () => void;
  
  // Mobile state
  isOpen: boolean;
  toggleSidebar: () => void;

  // Desktop state
  isDesktopOpen: boolean;
  onDesktopToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  data, 
  onSelectWeek, 
  onDeleteWeek, 
  onOpenNewWeek, 
  onOpenBackup,
  isOpen,
  toggleSidebar,
  isDesktopOpen,
  onDesktopToggle
}) => {
  // Collapsed state for years/months
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (id: string) => {
    const newSet = new Set(expandedGroups);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedGroups(newSet);
  };

  // Grouping Logic
  const groupedData = useMemo(() => {
    const allNames = Object.keys(data).filter(key => 
      key !== 'active_trips' && 
      key !== 'currentWeekName' && 
      Array.isArray(data[key])
    );
    
    // Include current if not default
    if (data.currentWeekName !== DEFAULT_WEEK_NAME && !allNames.includes(data.currentWeekName)) {
      allNames.push(data.currentWeekName);
    }

    const weeks = allNames.map(name => ({
      name,
      date: parseStartDateFromWeekName(name),
      isActive: name === data.currentWeekName
    }));

    // Split into dated and undated
    const validWeeks = weeks.filter(w => w.date !== null).sort((a, b) => a.date!.getTime() - b.date!.getTime());
    const otherWeeks = weeks.filter(w => w.date === null).sort((a, b) => a.name.localeCompare(b.name));

    const grouped: Record<number, Record<number, typeof weeks>> = {};
    
    validWeeks.forEach(week => {
      const year = week.date!.getFullYear();
      const month = week.date!.getMonth();
      if (!grouped[year]) grouped[year] = {};
      if (!grouped[year][month]) grouped[year][month] = [];
      grouped[year][month].push(week);
    });

    return { grouped, otherWeeks };
  }, [data]);

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  // Auto-expand current week on load
  React.useEffect(() => {
     if (data.currentWeekName !== DEFAULT_WEEK_NAME) {
       const date = parseStartDateFromWeekName(data.currentWeekName);
       if (date) {
         setExpandedGroups(prev => {
           const newSet = new Set(prev);
           newSet.add(`year-${date.getFullYear()}`);
           newSet.add(`month-${date.getFullYear()}-${date.getMonth()}`);
           return newSet;
         });
       }
     }
  }, [data.currentWeekName]);

  const renderWeekItem = (week: { name: string, isActive: boolean }) => (
    <div 
      key={week.name}
      className={`group flex items-center justify-between p-2 rounded-md mb-1 cursor-pointer transition-colors ${
        week.isActive ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
      }`}
      onClick={() => {
        onSelectWeek(week.name);
        if (window.innerWidth < 768) toggleSidebar();
      }}
    >
      <span className="text-sm truncate flex-1">{week.name}</span>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onDeleteWeek(week.name);
        }}
        className={`p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${
          week.isActive ? 'text-indigo-200 hover:bg-indigo-500 hover:text-white' : 'text-gray-400 hover:bg-gray-600 hover:text-red-400'
        }`}
        title="Excluir"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
          onClick={toggleSidebar}
        />
      )}

      <aside 
        className={`fixed inset-y-0 left-0 z-40 w-72 h-screen bg-gray-800 text-gray-100 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
          md:${isDesktopOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Discrete Toggle Button (Desktop Only) */}
        <button
          onClick={onDesktopToggle}
          className="hidden md:flex absolute -right-3 top-12 z-50 items-center justify-center w-6 h-6 bg-white text-gray-600 rounded-full shadow-md border border-gray-200 hover:bg-gray-100 hover:text-indigo-600 transition-colors"
          title={isDesktopOpen ? "Recolher Menu" : "Expandir Menu"}
        >
          {isDesktopOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Compact Header: p-3, text-lg */}
        <div className="p-3 border-b border-gray-700 bg-gray-800 shrink-0">
          <h1 className="text-lg font-extrabold text-indigo-400 flex items-center gap-2">
            <span>🚗</span>
            <span>Controle Caronas</span>
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
          <div className="mb-2">
             <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Histórico</h3>
             
             {/* Dynamic Tree */}
             {Object.keys(groupedData.grouped).sort().map(yearStr => {
               const year = parseInt(yearStr);
               const yearId = `year-${year}`;
               const isYearOpen = expandedGroups.has(yearId);

               return (
                 <div key={yearId} className="mb-1">
                   <button 
                    onClick={() => toggleGroup(yearId)}
                    className="w-full flex items-center text-indigo-300 hover:text-white font-bold text-lg mb-1"
                   >
                     {isYearOpen ? <ChevronDown size={16} className="mr-1" /> : <ChevronRight size={16} className="mr-1" />}
                     {year}
                   </button>
                   
                   {isYearOpen && (
                     <div className="ml-3 border-l-2 border-gray-700 pl-2">
                       {Object.keys(groupedData.grouped[year]).sort((a,b) => parseInt(a)-parseInt(b)).map(monthStr => {
                         const month = parseInt(monthStr);
                         const monthId = `month-${year}-${month}`;
                         const isMonthOpen = expandedGroups.has(monthId);

                         return (
                           <div key={monthId} className="mb-1">
                             <button 
                              onClick={() => toggleGroup(monthId)}
                              className="w-full flex items-center text-gray-400 hover:text-gray-200 font-medium text-sm py-1"
                             >
                               {isMonthOpen ? <ChevronDown size={14} className="mr-1" /> : <ChevronRight size={14} className="mr-1" />}
                               {monthNames[month]}
                             </button>

                             {isMonthOpen && (
                               <div className="ml-2 mt-1">
                                 {groupedData.grouped[year][month].map(renderWeekItem)}
                               </div>
                             )}
                           </div>
                         )
                       })}
                     </div>
                   )}
                 </div>
               )
             })}

             {/* Other Weeks */}
             {groupedData.otherWeeks.length > 0 && (
               <div className="mt-2">
                 <button 
                   onClick={() => toggleGroup('other')}
                   className="w-full flex items-center text-gray-400 hover:text-white font-bold text-sm mb-2"
                 >
                    {expandedGroups.has('other') ? <ChevronDown size={16} className="mr-1" /> : <ChevronRight size={16} className="mr-1" />}
                    Outros Arquivos
                 </button>
                 {expandedGroups.has('other') && (
                   <div className="ml-2 border-l border-gray-700 pl-2">
                     {groupedData.otherWeeks.map(renderWeekItem)}
                   </div>
                 )}
               </div>
             )}
          </div>
        </div>

        {/* Compact Footer: p-2, smaller gap */}
        <div className="p-2 border-t border-gray-700 bg-gray-800 space-y-2 shrink-0 pb-3 md:pb-2">
          <button 
            onClick={onOpenNewWeek}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-3 rounded-lg shadow-lg transition-all active:scale-95 text-sm"
          >
            <Calendar size={16} />
            <span className={!isDesktopOpen && !isOpen ? 'hidden' : 'block'}>Nova Semana</span>
          </button>
          <button 
            onClick={onOpenBackup}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-3 rounded-lg shadow-lg transition-all active:scale-95 text-sm"
          >
            <Database size={16} />
            <span className={!isDesktopOpen && !isOpen ? 'hidden' : 'block'}>Backup</span>
          </button>
        </div>
      </aside>
    </>
  );
};