export default function Home() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-cream-50">
      {/* Mobile Background */}
      <div 
        className="absolute inset-0 w-full h-[80%] bg-cover bg-center bg-no-repeat md:hidden"
        style={{
          backgroundImage: "url('/green-banner-mobile.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      
      {/* Desktop Background */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat hidden md:block"
        style={{
          backgroundImage: "url('/green-banner-desktop.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Gradient Overlay - Bottom Right to Top Left */}
      <div 
        className="absolute inset-0 w-full h-full"
        style={{
          background: `linear-gradient(
            225deg,
            rgba(168, 203, 161, 0.3) 0%,
            rgba(168, 203, 161, 0.15) 25%,
            rgba(249, 244, 239, 0.4) 60%,
            rgba(249, 244, 239, 0.7) 100%
          )`
        }}
      />
      
      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="pt-6 px-6 md:pt-12 md:pl-16">
          <h1 className="brand-title text-xl lg:text-5xl font-bold text-dark-green">
            GutRoot
          </h1>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center">
          <div className="w-full">
            {/* Mobile Layout */}
            <div className="md:hidden flex flex-col items-center justify-center px-6 text-center">
              <div className="max-w-sm">
                <h2 className="text-3xl font-bold text-dark-gray leading-tight mb-8">
                  Gut Health,
                  <br />
                  Personalized
                  <br />
                  from the
                  <br />
                  Root Up.
                </h2>
                
                <a href="/auth" className="btn-primary text-base px-8 py-3 font-medium shadow-lg hover:shadow-xl transition-all duration-300 w-full max-w-xs inline-block text-center">
                  Start Your Gut Check
                </a>
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:flex items-center">
              <div className="max-w-4xl mx-auto px-16">
                <div className="max-w-xl">
                  <h2 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-dark-gray leading-tight mb-8">
                    Gut Health,
                    <br />
                    Personalized
                    <br />
                    from the Root Up.
                  </h2>
                  
                  <a href="/auth" className="btn-primary text-lg px-8 py-4 font-medium shadow-lg hover:shadow-xl transition-all duration-300 inline-block">
                    Start Your Gut Check
                  </a>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
