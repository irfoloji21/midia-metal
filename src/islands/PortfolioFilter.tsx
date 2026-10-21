import { useState } from "react";
import portfolioImageAlt from "@/data/portfolio-image-alt.json";

const imageAltByUrl: Record<string, string> = portfolioImageAlt;

type Category = { id: number; name: string };
type Project = { id: number; slug: string; title: string; image: string; description?: string; portfolio_category?: { name: string } };

export default function PortfolioFilter({ categories, projects }: { categories: Category[]; projects: Project[] }) {
  const [active, setActive] = useState("All");
  const filtered = active === "All" ? projects : projects.filter((p) => p.portfolio_category?.name === active);

  return (
    <>
      <section className="container mx-auto px-4 lg:px-8 pt-16 md:pt-20 pb-6 md:pb-8">
        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={() => setActive("All")} className={`h-10 px-5 text-[13px] font-semibold transition-colors border ${active === "All" ? "bg-[#10275c] text-white border-[#10275c]" : "bg-[#eef2f6] text-[#10275c] border-[#cfd8e6] hover:bg-orange hover:border-orange hover:text-white"}`}>All</button>
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => setActive(cat.name)} className={`h-10 px-5 text-[13px] font-semibold transition-colors border ${active === cat.name ? "bg-[#10275c] text-white border-[#10275c]" : "bg-[#eef2f6] text-[#10275c] border-[#cfd8e6] hover:bg-orange hover:border-orange hover:text-white"}`}>{cat.name}</button>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 lg:px-8 pb-20 md:pb-24">
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 md:gap-x-8 gap-y-10">
            {filtered.map((project) => (
              <a key={project.id} href={`/portfolio/${project.slug}`} className="group block">
                <div className="relative overflow-hidden bg-[#f7f8fa]">
                  <img src={project.image} alt={imageAltByUrl[project.image] || project.title} className="w-full h-[250px] md:h-[300px] object-contain" />
                  <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/45 transition-colors duration-300 flex items-center justify-center">
                    <span className="text-white font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[13px] tracking-wide">View Project</span>
                  </div>
                </div>
                <div className="pt-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] font-semibold text-[#8f9ab0] mb-2">{project.portfolio_category?.name || "Uncategorized"}</p>
                  <h3 className="font-sans text-[23px] md:text-[28px] leading-[1.02] font-semibold text-orange">{project.title}</h3>
                  <p className="text-[14px] leading-7 text-[#6e7a92] mt-3">{project.description?.split(/\n\s*\n/)[0] || ""}</p>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-[#6e7a92] bg-[#f4f5f7] border border-[#d5deea]">No projects found.</div>
        )}
      </section>
    </>
  );
}
