import { useState, useEffect } from "react";

type Slide = { id: number; image: string; alt?: string };

function getOptimizedImageSrc(src: string) {
  if (src.endsWith("/portfolio-banner-kitchen.png")) {
    return {
      src,
      webpSrc: src.replace(/\.png$/, ".webp"),
    };
  }

  return {
    src,
    webpSrc: null as string | null,
  };
}

export default function HeroCarousel({ slides = [] }: { slides: Slide[] }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slideCount = slides.length;

  useEffect(() => {
    if (slideCount <= 1) return undefined;
    const intervalId = window.setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideCount);
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [slideCount]);

  const goToPrev = () => {
    if (slideCount === 0) return;
    setCurrentSlide((prev) => (prev - 1 + slideCount) % slideCount);
  };
  const goToNext = () => {
    if (slideCount === 0) return;
    setCurrentSlide((prev) => (prev + 1) % slideCount);
  };

  if (slideCount === 0) {
    return <div className="absolute inset-0 overflow-hidden bg-primary" />;
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-primary">
      {slides.map((slide, index) => (
        <picture key={slide.id}>
          {getOptimizedImageSrc(slide.image).webpSrc && (
            <source srcSet={getOptimizedImageSrc(slide.image).webpSrc!} type="image/webp" />
          )}
          <img
            src={getOptimizedImageSrc(slide.image).src}
            alt={slide.alt || "Hero slide"}
            width="1367"
            height="599"
            loading={index === 0 ? "eager" : "lazy"}
            decoding={index === 0 ? "sync" : "async"}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
              index === currentSlide ? "opacity-100" : "opacity-0"
            }`}
          />
        </picture>
      ))}
      {slideCount > 1 && (
        <>
          <button
            onClick={goToPrev}
            aria-label="Previous slide"
            className="absolute bottom-5 right-[76px] md:bottom-7 md:right-[92px] z-30 w-11 h-11 border border-white/35 bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white hover:text-primary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button
            onClick={goToNext}
            aria-label="Next slide"
            className="absolute bottom-5 right-5 md:bottom-7 md:right-9 z-30 w-11 h-11 border border-white/35 bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white hover:text-primary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </>
      )}
    </div>
  );
}
