const defaultSettings = {
    theme: 'sistema',
    language: 'pt-BR',
    fontSize: 'medio',
    sound: true,
    vibration: true,
    vibrationIntensity: 'media',
    msgSound: 'padrao',
    wallpaper: 'padrao',
    bubbleStyle: 'arredondado',
    animations: 'deslizar',
    appLock: 'nenhum',
    disappearingMsgs: 'desligado',
    lastSeen: 'todos',
    readReceipts: true,
    autoBackup: 'semanal',
    dataUsageWifiOnly: false,
    imgQuality: 'alta',
    swipeReply: true,
    autoDarkMode: false,
    reduceAnimations: false
};

const SettingsManager = {
    getSettings: () => {
        try {
            const saved = localStorage.getItem('app_settings');
            if (saved) return { ...defaultSettings, ...JSON.parse(saved) };
        } catch (e) {
            console.error("Error reading settings", e);
        }
        return defaultSettings;
    },
    saveSettings: (settings) => {
        try {
            localStorage.setItem('app_settings', JSON.stringify(settings));
            SettingsManager.applyGlobalSettings(settings);
        } catch (e) {
            console.error("Error saving settings", e);
        }
    },
    applyGlobalSettings: (settings) => {
        // Theme
        let isDark = false;
        if (settings.theme === 'escuro') isDark = true;
        else if (settings.theme === 'sistema' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) isDark = true;
        
        if (isDark) {
            document.documentElement.classList.add('dark');
            document.body.style.backgroundColor = '#121212';
            document.body.style.color = '#e0e0e0';
        } else {
            document.documentElement.classList.remove('dark');
            document.body.style.backgroundColor = '#f3f4f6';
            document.body.style.color = '#1f2937';
        }

        // Font Size
        document.documentElement.classList.remove('text-sm', 'text-base', 'text-lg');
        if (settings.fontSize === 'pequeno') document.documentElement.classList.add('text-sm');
        else if (settings.fontSize === 'grande') document.documentElement.classList.add('text-lg');
        else document.documentElement.classList.add('text-base');

        // Dispatch event for React components to listen
        window.dispatchEvent(new CustomEvent('settingsChanged', { detail: settings }));
    },
    playNotificationSound: () => {
        const settings = SettingsManager.getSettings();
        if (!settings.sound) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            // Simple beep
            if (settings.msgSound === 'padrao') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.1);
            } else if (settings.msgSound === 'pop') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, ctx.currentTime);
                gain.gain.setValueAtTime(0.5, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.05);
            } else {
                // Fallback sound
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(500, ctx.currentTime);
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.2);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.2);
            }
        } catch (e) {}
    },
    vibrate: (type = 'send') => {
        const settings = SettingsManager.getSettings();
        if (!settings.vibration || !('vibrate' in navigator)) return;
        
        let duration = 50;
        if (settings.vibrationIntensity === 'leve') duration = 30;
        if (settings.vibrationIntensity === 'forte') duration = 100;
        
        if (type === 'receive') duration = [duration, 50, duration];
        
        navigator.vibrate(duration);
    }
};

// Initial apply
SettingsManager.applyGlobalSettings(SettingsManager.getSettings());

// Listen for system theme change
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const settings = SettingsManager.getSettings();
    if (settings.theme === 'sistema') SettingsManager.applyGlobalSettings(settings);
});

window.SettingsManager = SettingsManager;