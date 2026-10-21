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
    </div>
  );
}
