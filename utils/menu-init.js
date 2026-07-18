class MenuErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("CodeHUB Menu Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return null; // Oculta o menu silenciosamente se houver erro
        }
        return this.props.children;
    }
}

window.addEventListener('load', async () => {
    try {
        // Fetch the external menu script dynamically
        const res = await fetch('https://alexandre7888.github.io/app-menu.js');
        if (!res.ok) throw new Error('Failed to fetch app-menu.js');
        let code = await res.text();
        
        // Wrap the code in an IIFE to isolate its scope (prevents global const/let conflicts like useState TDZ)
        // and explicitly assign the AppMenu component to the window object so we can access it.
        code = `
            (function() {
                try {
                    ${code}
                    window.AppMenu = AppMenu;
                } catch(e) {
                    console.error("Error executing app-menu.js internal code:", e);
                }
            })();
        `;
        
        // Transpile the code explicitly using window.Babel
        let compiledCode = code;
        if (window.Babel) {
            try {
                compiledCode = window.Babel.transform(code, { presets: ['react'] }).code;
            } catch (transformErr) {
                console.error("Erro ao transformar o código do menu:", transformErr);
            }
        }

        // Inject the script into the document as standard javascript
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.innerHTML = compiledCode;
        document.body.appendChild(script);

        // Wait a short tick to ensure the injected script has executed
        setTimeout(() => {
            if (typeof window.AppMenu !== 'undefined') {
                const menuContainer = document.getElementById('app-menu-root');
                if (menuContainer) {
                    const root = ReactDOM.createRoot(menuContainer);
                    root.render(
                        <MenuErrorBoundary>
                            {React.createElement(window.AppMenu)}
                        </MenuErrorBoundary>
                    );
                }
            } else {
                console.warn("AppMenu function was not found after script execution.");
            }
        }, 100);

    } catch (err) {
        console.error("Erro ao carregar app-menu:", err);
    }
});