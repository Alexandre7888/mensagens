function TutorialOverlay({ onComplete }) {
    const [step, setStep] = React.useState(0);
    const [targetRect, setTargetRect] = React.useState(null);

    const steps = [
        {
            title: "Bem-vindo ao mensagensHUB!",
            text: "Vamos fazer um tour rápido pelas funcionalidades principais. Você pode pular isso a qualquer momento.",
            targetSelector: null,
            position: "center"
        },
        {
            title: "Seus Chats",
            text: "Aqui ficam todas as suas conversas individuais e em grupo. Clique em uma para começar a falar.",
            targetSelector: "[data-tutorial='chats-tab']",
            position: "bottom"
        },
        {
            title: "Atualizações (Pulse)",
            text: "Compartilhe rapidamente como você está se sentindo usando emojis e cores no seu Pulse.",
            targetSelector: "[data-tutorial='pulse-tab']",
            position: "bottom"
        },
        {
            title: "Menu Principal",
            text: "Acesse as configurações, adicione contatos e crie grupos tocando aqui.",
            targetSelector: "[data-tutorial='main-menu']",
            position: "bottom"
        }
    ];

    React.useEffect(() => {
        const updateRect = () => {
            const currentStep = steps[step];
            if (currentStep && currentStep.targetSelector) {
                const el = document.querySelector(currentStep.targetSelector);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    setTargetRect(rect);
                } else {
                    setTargetRect(null);
                }
            } else {
                setTargetRect(null);
            }
        };

        updateRect();
        window.addEventListener('resize', updateRect);
        
        // Timeout para garantir que elementos dinâmicos renderizaram
        const timeout = setTimeout(updateRect, 500);

        return () => {
            window.removeEventListener('resize', updateRect);
            clearTimeout(timeout);
        };
    }, [step]);

    const nextStep = () => {
        if (step < steps.length - 1) {
            setStep(step + 1);
        } else {
            completeTutorial();
        }
    };

    const completeTutorial = () => {
        localStorage.setItem("tutorialCompleted", "true");
        if (onComplete) onComplete();
    };

    const currentStep = steps[step];

    return (
        <div className="fixed inset-0 z-[9999] pointer-events-auto transition-all duration-300">
            {/* Overlay com spotlight */}
            <div 
                className="absolute inset-0 bg-black/70 transition-all duration-300 pointer-events-none"
                style={{
                    clipPath: targetRect 
                        ? `polygon(0% 0%, 0% 100%, ${targetRect.left - 10}px 100%, ${targetRect.left - 10}px ${targetRect.top - 10}px, ${targetRect.right + 10}px ${targetRect.top - 10}px, ${targetRect.right + 10}px ${targetRect.bottom + 10}px, ${targetRect.left - 10}px ${targetRect.bottom + 10}px, ${targetRect.left - 10}px 100%, 100% 100%, 100% 0%)`
                        : 'none'
                }}
            ></div>

            {/* Furo visível com borda (spotlight) */}
            {targetRect && (
                <div 
                    className="absolute rounded-2xl pointer-events-none transition-all duration-300 border-2 border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.5)]"
                    style={{
                        left: targetRect.left - 10,
                        top: targetRect.top - 10,
                        width: targetRect.width + 20,
                        height: targetRect.height + 20
                    }}
                ></div>
            )}

            {/* Conteúdo do Tutorial */}
            <div 
                className={`absolute transition-all duration-300 bg-white rounded-2xl p-6 shadow-2xl w-80 max-w-[90vw] ${!targetRect ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' : ''}`}
                style={targetRect ? {
                    top: currentStep.position === 'bottom' ? targetRect.bottom + 20 : Math.max(10, targetRect.top - 200),
                    left: Math.max(10, Math.min(window.innerWidth - 330, targetRect.left + (targetRect.width / 2) - 160))
                } : {}}
            >
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded">Passo {step + 1} de {steps.length}</span>
                    <button onClick={completeTutorial} className="text-gray-400 hover:text-gray-600 text-sm font-medium">Pular</button>
                </div>
                
                <h3 className="text-xl font-bold text-gray-800 mb-2">{currentStep.title}</h3>
                <p className="text-gray-600 mb-6 text-sm">{currentStep.text}</p>
                
                <div className="flex justify-between items-center">
                    <div className="flex gap-1">
                        {steps.map((_, i) => (
                            <div key={i} className={`w-2 h-2 rounded-full ${i === step ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
                        ))}
                    </div>
                    <button onClick={nextStep} className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-indigo-700 transition-colors">
                        {step === steps.length - 1 ? 'Começar!' : 'Avançar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

window.TutorialOverlay = TutorialOverlay;