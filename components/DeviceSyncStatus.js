function DeviceSyncStatus() {
    const [isConnected, setIsConnected] = React.useState(false);

    React.useEffect(() => {
        const handleStatus = (e) => {
            setIsConnected(e.detail.connected);
            if (e.detail.connected) {
                console.log("%c[Sync] Dispositivo sincronizado e online via WebRTC P2P", "color: green; font-weight: bold;");
            } else {
                console.log("%c[Sync] Nenhum outro dispositivo online via WebRTC P2P", "color: gray; font-weight: bold;");
            }
        };
        window.addEventListener('sync_status_changed', handleStatus);
        
        if ((window.appSyncManager && window.appSyncManager.isConnected) || (window.tvSyncManager && window.tvSyncManager.isConnected)) {
            setIsConnected(true);
        }

        return () => window.removeEventListener('sync_status_changed', handleStatus);
    }, []);

    return null;
}

window.DeviceSyncStatus = DeviceSyncStatus;