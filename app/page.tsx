export default function Home() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-cream-50">
      {/* Mobile Background */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat md:hidden"
        style={{
          backgroundImage: "url('/green-banner-mobile.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      
      {/* Desktop Background */}
      <div 
        className="absolute inset-0 w-full h-full bg-no-repeat hidden lg:block"
        style={{
          backgroundImage: "url('/green-banner-desktop.png')",
          backgroundSize: 'contain',
          backgroundPosition: 'center top',
        }}
      />
      
      {/* Medium screens background - full width */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat hidden md:block lg:hidden"
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
            260deg,
            rgba(168, 203, 161, 0.85) 0%,
            rgba(168, 203, 161, 0.65) 25%,
            rgba(249, 244, 239, 0.4) 60%,
            rgba(249, 244, 239, 0.6) 100%
          )`,
          mixBlendMode: 'multiply'
        }}
      />
      
      {/* Content */}
      <div className="relative z-10 min-h-screen">
        {/* Mobile Layout */}
        <div className="md:hidden h-[80%] flex flex-col px-8">
          {/* Brand Title */}
          <div className="pt-6 mb-32">
            <h1 className="brand-title text-3xl font-black text-dark-green">
              GutRoot
            </h1>
          </div>
          
          {/* Headline - Aligned with Brand Title */}
          <div className="mb-48">
            <div className="max-w-sm">
              <h2 className="text-5xl font-semibold text-dark-gray leading-tight text-left">
                Gut Health,
                <br />
                Personalized
                <br />
                from the
                <br />
                Root Up.
              </h2>
            </div>
          </div>
          
          {/* CTA Button - Centered */}
          <div className="pb-8 flex justify-center">
            <a href="/auth" className="btn-primary text-xl px-8 py-3 font-medium shadow-lg hover:shadow-xl transition-all duration-300 max-w-xs w-full text-center">
              Start Your Gut Check
            </a>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:block min-h-screen">
          {/* Content Container - Responsive Left Side */}
          <div className="absolute left-8 md:left-20 lg:left-54 xl:left-150 top-0 h-full flex flex-col py-4 max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl">
            {/* Brand Title */}
            <div className="pt-4 md:pt-6 lg:pt-8 xl:pt-10 md:mb-42 xl:mb-45">
              <h1 className="brand-title md:text-5xl font-black text-dark-green">
                GutRoot
              </h1>
            </div>
            
            {/* Headline */}
            <div className="md:mb-52 lg:mb-48 xl:mb-45">
              <h2 className="md:text-5xl lg:text-6xl xl:text-7xl font-semibold text-dark-gray leading-tight text-left">
                Gut Health,
                <br />
                Personalized
                <br />
                from the Root Up.
              </h2>
            </div>
            
            {/* CTA Button */}
            <div className="flex justify-center">
              <a href="/auth" className="btn-primary lg:text-3xl px-6 md:px-8 lg:px-10 xl:px-12 py-3 md:py-4 lg:py-5 xl:py-6 font-bold shadow-lg hover:shadow-xl transition-all duration-300 inline-block">
                Start Your Gut Check
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
