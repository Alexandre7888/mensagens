function Login() {
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    // Sequence of animations
    const timers = [
      setTimeout(() => setStep(1), 500),   // Show "Venha se juntar..."
      setTimeout(() => setStep(2), 3000),  // Show "...ao nosso lar."
      setTimeout(() => setStep(3), 5500),  // Show "Comece para fazer login"
      setTimeout(() => setStep(4), 6500)   // Show login card
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleLogin = () => {
    window.location.href = "https://alexandre7888.github.io/API/v2/continuar-conta?token=Q8bQbwEW2nbkYY0UDkhj";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-indigo-900 to-purple-900 p-4 relative overflow-hidden" data-name="login" data-file="components/Login.js">
      
      {/* Background Particles/Stars */}
      <div className="absolute inset-0 pointer-events-none opacity-50">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="absolute bg-white rounded-full animate-pulse" style={{
            width: Math.random() * 4 + 1 + 'px',
            height: Math.random() * 4 + 1 + 'px',
            top: Math.random() * 100 + '%',
            left: Math.random() * 100 + '%',
            animationDuration: (Math.random() * 3 + 2) + 's'
          }}></div>
        ))}
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center justify-center h-full text-center">
        
        {/* Animated Welcome Texts */}
        <div className="h-40 flex flex-col items-center justify-center mb-8">
          <h2 className={`text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-300 transition-all duration-1000 transform ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            Venha se juntar à nossa comunidade
          </h2>
          <h2 className={`text-3xl md:text-4xl font-extrabold text-white mt-2 transition-all duration-1000 transform ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            ao nosso lar.
          </h2>
          <p className={`text-lg text-indigo-200 mt-6 font-medium transition-all duration-1000 transform ${step >= 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
            Comece para fazer login
          </p>
        </div>

        {/* Login Card */}
        <div className={`bg-white/10 backdrop-blur-xl p-8 rounded-3xl shadow-2xl w-full border border-white/20 transition-all duration-1000 transform ${step >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12 pointer-events-none'}`}>
          <div className="w-24 h-24 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-500/30">
            <div className="icon-fingerprint text-5xl text-white"></div>
          </div>
          
          <button 
            onClick={handleLogin}
            className="w-full bg-white text-indigo-900 hover:bg-indigo-50 font-bold py-4 px-6 rounded-xl transition duration-300 flex items-center justify-center gap-3 mb-6 shadow-lg hover:shadow-xl hover:-translate-y-1"
          >
            <div className="icon-log-in text-2xl"></div>
            Entrar com CodeHUB
          </button>

          <div className="text-xs text-indigo-200/70">
            Ao entrar, você concorda com nossos <br/>
            <a href="termos.html" className="text-white hover:underline">Termos de Uso</a> e <a href="privacidade.html" className="text-white hover:underline">Política de Privacidade</a>.
          </div>
        </div>
      </div>
    </div>
  );
}
window.Login = Login;
