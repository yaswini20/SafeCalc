import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';

const Landing = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

  const slides = [
    {
      title: 'Stay Safe',
      description: 'Your personal safety companion is always ready when you need it.',
    },
    {
      title: 'Emergency SOS',
      description: 'Send an SOS alert quickly when you are in an emergency.',
    },
    {
      title: 'Your Trusted Contacts',
      description: 'Add up to 3 trusted contacts who can receive your emergency alerts.',
    },
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      navigate('/login');
    }
  };

  const handleSkip = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col font-sans relative overflow-hidden select-none">
      {/* Decorative subtle background glow */}
      <div className="absolute top-[20%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-[#FF6D6D]/5 blur-[80px] pointer-events-none"></div>

      {/* Header */}
      <header className="w-full max-w-6xl mx-auto px-6 py-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-[#FF6D6D]" />
          <span className="text-xl font-medium tracking-tight">TravelSafetySOS</span>
        </div>
        <button 
          onClick={handleSkip}
          className="px-5 py-2 text-sm font-semibold text-[#FF6D6D] bg-[#FF6D6D]/10 hover:bg-[#FF6D6D]/20 rounded-full transition-all"
        >
          Sign In
        </button>
      </header>

      {/* Carousel Body */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full px-6 z-10">
        <div className="w-full flex flex-col items-center text-center space-y-12">
          {/* Big SOS Circle */}
          <div className="w-60 h-60 md:w-64 md:h-64 rounded-full bg-[#FF6D6D] flex items-center justify-center shadow-lg shadow-[#FF6D6D]/10">
            <span className="text-5xl font-light text-white tracking-widest pl-2">SOS</span>
          </div>

          {/* Slide Text Content */}
          <div className="space-y-4 min-h-[140px]">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight transition-all duration-300">
              {slides[currentSlide].title}
            </h1>
            <p className="text-base text-zinc-400 max-w-sm mx-auto leading-relaxed transition-all duration-300">
              {slides[currentSlide].description}
            </p>
          </div>

          {/* Dot Indicators */}
          <div className="flex items-center justify-center gap-2">
            {slides.map((_, index) => {
              const isActive = index === currentSlide;
              return (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    isActive ? 'w-6 bg-[#FF6D6D]' : 'w-2 bg-[#4F4F4F]'
                  }`}
                />
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="w-full space-y-4 pt-4">
            <button
              onClick={handleNext}
              className="w-full py-4 bg-[#FF6D6D] hover:bg-[#ff7e7e] active:scale-[0.99] text-white font-medium rounded-full transition-all text-lg shadow-md shadow-[#FF6D6D]/10"
            >
              {currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}
            </button>

            {currentSlide < slides.length - 1 ? (
              <button
                onClick={handleSkip}
                className="block mx-auto text-base text-[#FF6D6D] hover:text-[#ff7e7e] font-normal transition-all"
              >
                Skip
              </button>
            ) : (
              <div className="h-6" /> // spacer to keep height layout same
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full py-6 text-center text-xs text-zinc-600 z-10">
        &copy; {new Date().getFullYear()} TravelSafetySOS. All rights reserved.
      </footer>
    </div>
  );
};

export default Landing;

