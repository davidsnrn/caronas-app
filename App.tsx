import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { TripList } from './components/TripList';
import { Modal } from './components/Modal';
import { AppData, Trip, Participant, TripType, DEFAULT_WEEK_NAME, PAYMENT_VALUE, LOCAL_STORAGE_KEY } from './types';
import { 
  loadAppData, 
  saveAppData, 
  generateWeekName, 
  generateParticipantId, 
  getAllUniqueNames, 
  generateShareText,
  checkConnection
} from './services/dataUtils';
import { Menu, Plus, Edit, RefreshCw, Loader2, Wifi, WifiOff, Search, X, Copy, Trash2, Database, Calendar, CheckSquare, Square } from 'lucide-react';

const App: React.FC = () => {
  // --- STATE ---
  const [data, setData] = useState<AppData>({ active_trips: [], currentWeekName: DEFAULT_WEEK_NAME });
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  // Modals State
  const [modalOpen, setModalOpen] = useState<'none' | 'newWeek' | 'addTrip' | 'backup'>('none');
  
  // Form States
  const [newWeekDate, setNewWeekDate] = useState('');
  const [newWeekError, setNewWeekError] = useState('');
  
  const [newTripDate, setNewTripDate] = useState('');
  const [newTripTypes, setNewTripTypes] = useState<Set<TripType>>(new Set(['Ida']));
  const [selectedExistingNames, setSelectedExistingNames] = useState<Set<string>>(new Set());
  const [newParticipantInput, setNewParticipantInput] = useState('');
  const [participantSearchTerm, setParticipantSearchTerm] = useState('');
  const [isEditingExistingTrip, setIsEditingExistingTrip] = useState(false);

  // Share Text State
  const [shareText, setShareText] = useState('');

  // --- STATS ---
  const totalPayers = data.active_trips.reduce((acc, t) => acc + t.participants.filter(p => p.paid).length, 0);
  const totalParticipants = data.active_trips.reduce((acc, t) => acc + t.participants.length, 0);
  const totalReceived = totalPayers * PAYMENT_VALUE;
  const totalExpected = totalParticipants * PAYMENT_VALUE;

  // --- EFFECTS ---
  
  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      const loadedData = await loadAppData();
      setData(loadedData);
      setIsLoading(false);
      verifyConnection();
    };
    initData();
  }, []);

  const verifyConnection = async () => {
    setDbStatus('checking');
    const isOnline = await checkConnection();
    setDbStatus(isOnline ? 'online' : 'offline');
  };

  useEffect(() => {
    const interval = setInterval(verifyConnection, 30000);
    const handleOnline = () => verifyConnection();
    const handleOffline = () => setDbStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (modalOpen !== 'addTrip') {
      setParticipantSearchTerm('');
    }
  }, [modalOpen]);

  useEffect(() => {
    if (modalOpen === 'backup') {
      setShareText(generateShareText(data.active_trips, totalPayers, totalReceived, data.currentWeekName));
    }
  }, [modalOpen, data.active_trips, totalPayers, totalReceived, data.currentWeekName]);

  useEffect(() => {
    if (modalOpen !== 'addTrip' || !newTripDate) {
      if (modalOpen !== 'addTrip') setIsEditingExistingTrip(false);
      return;
    }

    const daysPT = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const dateObj = new Date(newTripDate + 'T12:00:00');
    const dayName = daysPT[dateObj.getDay()];
    const formattedDate = `${dayName} (${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')})`;

    const existing = data.active_trips.some(t => t.day === formattedDate && newTripTypes.has(t.type));
    
    if (existing) {
      setIsEditingExistingTrip(true);
      const firstMatch = data.active_trips.find(t => t.day === formattedDate && newTripTypes.has(t.type));
      if (firstMatch) {
        const currentNames = new Set(firstMatch.participants.map(p => p.name));
        setSelectedExistingNames(currentNames);
      }
    } else {
      setIsEditingExistingTrip(false);
      setSelectedExistingNames(new Set());
    }
  }, [newTripDate, newTripTypes, modalOpen, data.active_trips]);

  const showToast = (msg: string) => setToastMessage(msg);

  const saveData = (newData: AppData) => {
    setData(newData);
    saveAppData(newData);
  };

  const autoArchiveCurrent = (currentData: AppData): { archivedName: string | null, updatedData: AppData } => {
    const trips = currentData.active_trips;
    const name = currentData.currentWeekName;
    const newData = { ...currentData };

    if (trips.length > 0 || (name !== DEFAULT_WEEK_NAME && !newData[name])) {
      let archiveName = name;
      if (newData[archiveName] || archiveName === DEFAULT_WEEK_NAME) {
         archiveName = `${archiveName} (Arq. ${new Date().toLocaleDateString('pt-BR')}-${Date.now() % 1000})`;
      }
      newData[archiveName] = [...trips];
      newData.active_trips = [];
      newData.currentWeekName = DEFAULT_WEEK_NAME;
      return { archivedName: archiveName, updatedData: newData };
    }
    return { archivedName: null, updatedData: newData };
  };

  const handleCreateNewWeek = () => {
    if (!newWeekDate) {
      setNewWeekError('Selecione uma data.');
      return;
    }
    const newName = generateWeekName(newWeekDate);
    if (!newName) return;
    const { archivedName, updatedData } = autoArchiveCurrent(data);
    if (updatedData[newName]) {
       setNewWeekError(`A semana "${newName}" já existe.`);
       return;
    }
    updatedData.currentWeekName = newName;
    updatedData.active_trips = [];
    saveData(updatedData);
    setModalOpen('none');
    setNewWeekDate('');
    setNewWeekError('');
    showToast(`✅ ${archivedName ? 'Anterior arquivada. ' : ''}Semana "${newName}" iniciada.`);
  };

  const handleSelectWeek = (weekName: string) => {
    if (weekName === data.currentWeekName) return;
    const { archivedName, updatedData } = autoArchiveCurrent(data);
    if (weekName === DEFAULT_WEEK_NAME) {
      updatedData.active_trips = [];
    } else {
      updatedData.active_trips = JSON.parse(JSON.stringify(updatedData[weekName] || []));
      delete updatedData[weekName];
    }
    updatedData.currentWeekName = weekName;
    saveData(updatedData);
    showToast(`✅ Semana "${weekName}" carregada.`);
  };

  const handleDeleteWeek = (weekName: string) => {
    const isActive = weekName === data.currentWeekName;
    if (!confirm(`Excluir permanentemente a semana "${weekName}"?`)) return;
    const newData = { ...data };
    if (isActive) {
      newData.active_trips = [];
      newData.currentWeekName = DEFAULT_WEEK_NAME;
    } else {
      delete newData[weekName];
    }
    saveData(newData);
    showToast(`🗑️ Semana "${weekName}" excluída.`);
  };

  const handleEditActiveWeekName = () => {
     if (data.currentWeekName === DEFAULT_WEEK_NAME) return;
     const newName = prompt("Novo nome da semana:", data.currentWeekName);
     if (newName && newName.trim() !== "") {
       if (data[newName.trim()]) {
         alert("Nome já existe.");
         return;
       }
       saveData({ ...data, currentWeekName: newName.trim() });
     }
  };

  const handleAddTrip = () => {
    if (!newTripDate) {
       alert("Selecione a data."); 
       return; 
    }
    if (newTripTypes.size === 0) {
      alert("Selecione pelo menos um tipo (Ida ou Volta).");
      return;
    }

    const daysPT = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const dateObj = new Date(newTripDate + 'T12:00:00');
    const dayName = daysPT[dateObj.getDay()];
    const formattedDate = `${dayName} (${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')})`;

    const manualNames = newParticipantInput.split('\n').map(s => s.trim()).filter(s => s);
    const targetNameSet = new Set([...Array.from(selectedExistingNames), ...manualNames]);
    const targetNames = Array.from(targetNameSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    if (targetNames.length === 0) {
      alert("Adicione participantes.");
      return;
    }

    const newTripsList = [...data.active_trips];
    const selectedTypes = Array.from(newTripTypes);

    selectedTypes.forEach(type => {
      const existingIndex = newTripsList.findIndex(t => t.day === formattedDate && t.type === type);

      if (existingIndex >= 0) {
        const existingTrip = newTripsList[existingIndex];
        const mergedParticipants: Participant[] = targetNames.map(name => {
          const existingPerson = existingTrip.participants.find(p => p.name === name);
          if (existingPerson) return existingPerson;
          return { id: generateParticipantId(name), name, paid: false };
        });
        // Always ensure alphabetical order
        mergedParticipants.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        newTripsList[existingIndex] = { ...existingTrip, participants: mergedParticipants };
      } else {
        const participants: Participant[] = targetNames.map(name => ({
          id: generateParticipantId(name), name, paid: false
        }));
        // Sort participants
        participants.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        newTripsList.push({ day: formattedDate, time: null, type, participants });
      }
    });

    saveData({ ...data, active_trips: newTripsList });
    setModalOpen('none');
    setNewParticipantInput('');
    setSelectedExistingNames(new Set());
    setNewTripDate('');
    setParticipantSearchTerm('');
    showToast("✅ Carona(s) salva(s) com sucesso.");
  };

  const handleDeleteTrip = (index: number) => {
    if (!confirm("Excluir viagem?")) return;
    const newTrips = [...data.active_trips];
    newTrips.splice(index, 1);
    saveData({ ...data, active_trips: newTrips });
  };

  const handleDeleteParticipant = (tIdx: number, pIdx: number) => {
     if (!confirm("Remover participante?")) return;
     const newTrips = [...data.active_trips];
     newTrips[tIdx].participants.splice(pIdx, 1);
     saveData({ ...data, active_trips: newTrips });
  };

  const handleEditParticipantName = (tIdx: number, pIdx: number) => {
    const currentName = data.active_trips[tIdx].participants[pIdx].name;
    const newName = prompt("Editar nome:", currentName);
    if (newName && newName.trim()) {
      const newTrips = [...data.active_trips];
      newTrips[tIdx].participants[pIdx].name = newName.trim();
      // Maintain sorting after edit
      newTrips[tIdx].participants.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      saveData({ ...data, active_trips: newTrips });
    }
  };

  const handleTogglePayment = (tIdx: number, pIdx: number) => {
    const newTrips = [...data.active_trips];
    newTrips[tIdx].participants[pIdx].paid = !newTrips[tIdx].participants[pIdx].paid;
    saveData({ ...data, active_trips: newTrips });
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `caronas_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Backup baixado.");
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (typeof json === 'object') {
          saveData(json);
          setModalOpen('none');
          showToast("Dados restaurados.");
        }
      } catch (err) { alert("Erro no arquivo JSON."); }
    };
    reader.readAsText(file);
  };

  const handleFactoryReset = async () => {
    if (confirm("⚠️ PERIGO: Apagar TODOS os dados e reiniciar?")) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        window.location.reload();
    }
  };

  const uniqueNames = useCallback(() => getAllUniqueNames(data), [data]);

  const filteredUniqueNames = useCallback(() => {
    const all = uniqueNames();
    if (!participantSearchTerm.trim()) return all;
    return all.filter(name => name.toLowerCase().includes(participantSearchTerm.toLowerCase()));
  }, [uniqueNames, participantSearchTerm]);

  const toggleTripType = (type: TripType) => {
    const newSet = new Set(newTripTypes);
    if (newSet.has(type)) {
      if (newSet.size > 1) newSet.delete(type);
    } else {
      newSet.add(type);
    }
    setNewTripTypes(newSet);
  };

  const StatusBadge = () => (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${
      dbStatus === 'checking' ? 'bg-gray-100 text-gray-500 border-gray-200' :
      dbStatus === 'offline' ? 'bg-red-50 text-red-600 border-red-100' :
      'bg-green-50 text-green-600 border-green-100'
    }`}>
      {dbStatus === 'checking' ? <RefreshCw size={12} className="animate-spin" /> : 
       dbStatus === 'offline' ? <WifiOff size={12} /> : <Wifi size={12} />}
      <span>{dbStatus === 'checking' ? 'Sincronizando...' : dbStatus === 'offline' ? 'Offline' : 'Online'}</span>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-indigo-900">
        <div className="text-center">
          <Loader2 className="animate-spin h-10 w-10 mx-auto mb-4" />
          <h2 className="text-xl font-bold">Carregando dados...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 font-sans">
      <Sidebar 
        data={data}
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isDesktopOpen={isDesktopSidebarOpen}
        onDesktopToggle={() => setIsDesktopSidebarOpen(!isDesktopSidebarOpen)}
        onSelectWeek={handleSelectWeek}
        onDeleteWeek={handleDeleteWeek}
        onOpenNewWeek={() => { setModalOpen('newWeek'); setIsSidebarOpen(false); }}
        onOpenBackup={() => { setModalOpen('backup'); setIsSidebarOpen(false); }}
      />

      <div className={`flex-1 flex flex-col transition-all duration-300 ${isDesktopSidebarOpen ? 'md:ml-72' : ''}`}>
        <header className="md:hidden bg-white border-b border-gray-200 p-4 sticky top-0 z-20 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
             <h1 className="text-lg font-bold text-indigo-900">Carpool</h1>
             <StatusBadge />
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-indigo-600 rounded-lg bg-indigo-50"><Menu size={24} /></button>
        </header>

        {toastMessage && (
           <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl text-sm font-medium animate-bounce">
             {toastMessage}
           </div>
        )}

        <main className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full relative">
          <div className="hidden md:flex absolute top-8 right-8"><StatusBadge /></div>

          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl shadow-xl overflow-hidden mb-8 text-white mt-2 md:mt-0">
             <div className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               <div>
                 <div className="flex items-center gap-3">
                   <h2 className="text-2xl md:text-3xl font-bold">{data.currentWeekName}</h2>
                   <button onClick={handleEditActiveWeekName} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg"><Edit size={16} /></button>
                 </div>
               </div>
               <div className="flex gap-6 bg-white/10 p-4 rounded-xl backdrop-blur-sm">
                  <div className="text-center">
                    <div className="text-xs text-indigo-200 uppercase tracking-wider font-semibold">Recebido (Total)</div>
                    <div className="text-2xl font-bold text-emerald-300">
                      R$ {totalReceived.toFixed(2).replace('.', ',')}
                      <span className="text-base font-medium text-indigo-200 ml-1.5 opacity-80">
                        (R$ {totalExpected.toFixed(2).replace('.', ',')})
                      </span>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-indigo-200 uppercase tracking-wider font-semibold">Pagos</div>
                    <div className="text-2xl font-bold">{totalPayers} <span className="text-lg text-indigo-300 font-normal">/ {totalParticipants}</span></div>
                  </div>
               </div>
             </div>
          </div>

          <button 
            onClick={() => setModalOpen('addTrip')}
            className="w-full md:w-auto mb-6 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-transform active:scale-95"
          >
            <Plus size={20} /> Adicionar Trecho
          </button>

          <TripList 
            trips={data.active_trips}
            currentWeekName={data.currentWeekName}
            onDeleteTrip={handleDeleteTrip}
            onTogglePayment={handleTogglePayment}
            onDeleteParticipant={handleDeleteParticipant}
            onEditParticipantName={handleEditParticipantName}
          />
        </main>
      </div>

      {/* --- MODALS --- */}
      <Modal isOpen={modalOpen === 'newWeek'} onClose={() => setModalOpen('none')} title="Nova Semana">
         <div className="space-y-4">
           <input type="date" className="w-full p-3 border border-gray-300 rounded-lg outline-none" value={newWeekDate} onChange={(e) => setNewWeekDate(e.target.value)} />
           {newWeekError && <p className="text-red-500 text-sm">{newWeekError}</p>}
           <div className="flex justify-end gap-2"><button onClick={handleCreateNewWeek} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Criar</button></div>
         </div>
      </Modal>

      <Modal isOpen={modalOpen === 'addTrip'} onClose={() => setModalOpen('none')} title={isEditingExistingTrip ? "Editar Trecho" : "Novo Trecho"}>
         <div className="space-y-4">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <input type="date" className="w-full p-2 border border-gray-300 rounded-lg" value={newTripDate} onChange={(e) => setNewTripDate(e.target.value)} />
             <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-lg border border-gray-200">
               <button 
                 onClick={() => toggleTripType('Ida')} 
                 className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-md font-bold transition-all ${newTripTypes.has('Ida') ? 'bg-sky-600 text-white shadow-sm' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
               >
                 {newTripTypes.has('Ida') ? <CheckSquare size={16} /> : <Square size={16} />} Ida
               </button>
               <button 
                 onClick={() => toggleTripType('Volta')} 
                 className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-md font-bold transition-all ${newTripTypes.has('Volta') ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
               >
                 {newTripTypes.has('Volta') ? <CheckSquare size={16} /> : <Square size={16} />} Volta
               </button>
             </div>
           </div>
           
           <div>
             <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-tight">Recentes (Ordem Alfabética)</label>
                <div className="relative">
                  <input type="text" placeholder="Filtrar..." className="pl-8 pr-8 py-1.5 text-xs border border-gray-300 rounded-full w-40 outline-none focus:ring-1 focus:ring-indigo-500" value={participantSearchTerm} onChange={(e) => setParticipantSearchTerm(e.target.value)} />
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  {participantSearchTerm && <button onClick={() => setParticipantSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
                </div>
             </div>
             <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50 grid grid-cols-2 gap-2 scrollbar-thin">
               {filteredUniqueNames().map(name => (
                 <label key={name} className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer text-sm">
                   <input type="checkbox" className="rounded text-indigo-600" checked={selectedExistingNames.has(name)} onChange={(e) => {
                        const newSet = new Set(selectedExistingNames);
                        if (e.target.checked) newSet.add(name); else newSet.delete(name);
                        setSelectedExistingNames(newSet);
                   }} />
                   <span className="truncate">{name}</span>
                 </label>
               ))}
               {filteredUniqueNames().length === 0 && <span className="text-gray-400 text-xs italic col-span-2 text-center py-2">Sem resultados.</span>}
             </div>
           </div>

           <div>
             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Novos (um por linha)</label>
             <textarea className="w-full p-2 border border-gray-300 rounded-lg h-20 text-sm resize-none scrollbar-thin" placeholder="Nome Sobrenome" value={newParticipantInput} onChange={(e) => setNewParticipantInput(e.target.value)} />
           </div>

           <div className="flex justify-end gap-2 pt-2"><button onClick={handleAddTrip} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-lg active:scale-95 transition-transform">Salvar Trecho(s)</button></div>
         </div>
      </Modal>

      <Modal isOpen={modalOpen === 'backup'} onClose={() => setModalOpen('none')} title="Backup e Exportação">
        <div className="space-y-6">
           <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Resumo da Semana</label>
              <textarea readOnly className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs h-40 font-mono scrollbar-thin" value={shareText} />
              <button onClick={() => { navigator.clipboard.writeText(shareText); showToast("Texto copiado!"); }} className="mt-2 w-full flex items-center justify-center gap-2 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors font-semibold text-sm">
                <Copy size={16} /> Copiar Relatório
              </button>
           </div>
           <div className="grid grid-cols-2 gap-3">
             <button onClick={handleExportJSON} className="flex items-center justify-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 hover:bg-emerald-100 transition-all font-bold text-sm">Baixar Backup</button>
             <label className="flex items-center justify-center gap-2 p-3 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-all font-bold text-sm cursor-pointer">
               Restaurar
               <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
             </label>
           </div>
           <div className="pt-4 border-t border-red-100"><button onClick={handleFactoryReset} className="w-full p-3 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl font-bold text-sm transition-colors">⚠️ Limpar Tudo (Reset de Fábrica)</button></div>
        </div>
      </Modal>
    </div>
  );
};

export default App;