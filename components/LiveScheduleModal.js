function LiveScheduleModal({ onClose, onSchedule }) {
    const [title, setTitle] = React.useState('');
    const [date, setDate] = React.useState('');
    const [time, setTime] = React.useState('');

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2"><div className="icon-radio text-red-500"></div> Agendar Live</h2>
                    <button onClick={onClose}><div className="icon-x text-gray-400 hover:text-white"></div></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Título da Live</label>
                        <input type="text" value={title} onChange={e=>setTitle(e.target.value)} className="w-full bg-gray-800 p-3 rounded-xl outline-none" placeholder="Ex: Bate-papo semanal" />
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm text-gray-400 mb-1">Data</label>
                            <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full bg-gray-800 p-3 rounded-xl outline-none" />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm text-gray-400 mb-1">Horário</label>
                            <input type="time" value={time} onChange={e=>setTime(e.target.value)} className="w-full bg-gray-800 p-3 rounded-xl outline-none" />
                        </div>
                    </div>
                    <button 
                        onClick={() => {
                            if(title && date && time) {
                                onSchedule({ title, date, time });
                                onClose();
                            }
                        }}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 py-3 rounded-xl font-bold mt-4"
                    >
                        Agendar
                    </button>
                </div>
            </div>
        </div>
    );
}

window.LiveScheduleModal = LiveScheduleModal;