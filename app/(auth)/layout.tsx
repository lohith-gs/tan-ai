import NeuralBackground from "@/components/canvas/NeuralBackground";
import Logo from "@/components/Logo";
import { Github, Linkedin, Instagram, Mail, Globe } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full bg-[#0e111a] flex overflow-hidden">
      <NeuralBackground />

      {/* Left — branding 60% */}
      <div className="relative z-10 hidden md:flex flex-col justify-between w-[60%] p-12 border-r border-zinc-800/60">
        {/* Logo */}
        <div>
          <Logo width={96} height={54} />
        </div>

        {/* Hero text */}
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-semibold text-zinc-100 leading-tight tracking-tight">
              Think in branches,<br />not threads.
            </h1>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-sm">
              Most AI chats are a single straight line. tan(AI) lets you branch off any response, explore parallel ideas, and visualise your entire thinking as a canvas.
            </p>
          </div>

          {/* How it works */}
          <div className="flex flex-col gap-3">
            <p className="text-[11px] text-zinc-600 font-mono uppercase tracking-widest">How it works</p>
            <div className="flex flex-col gap-3">
              {[
                { n: "01", text: "Start a conversation on the main thread" },
                { n: "02", text: "Click any AI response to branch off into a new direction" },
                { n: "03", text: "Branch from branches, explore as deep as you want" },
                { n: "04", text: "Switch to graph view to see your entire thinking at a glance" },
              ].map(({ n, text }) => (
                <div key={n} className="flex items-start gap-3">
                  <span className="text-[11px] text-blue-500/60 font-mono mt-0.5 shrink-0">{n}</span>
                  <span className="text-sm text-zinc-400 leading-snug">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Built by */}
        <div className="flex flex-col gap-3 pt-4 border-t border-zinc-800/50">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <p className="text-[12px] text-zinc-400 leading-none">Built by <span className="text-zinc-100 font-semibold">Lohith Gs</span></p>
              <p className="text-[11px] text-zinc-500">Full Stack Developer</p>
            </div>
            <div className="flex items-center gap-3.5">
              <span className="text-zinc-600 cursor-default" title="Coming soon"><Globe size={14} /></span>
              <a href="https://www.linkedin.com/in/LohithGs/" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-zinc-200 transition-colors"><Linkedin size={14} /></a>
              <a href="https://github.com/lohith-gs" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-zinc-200 transition-colors"><Github size={14} /></a>
              <a href="mailto:lohith7711@gmail.com" className="text-zinc-500 hover:text-zinc-200 transition-colors"><Mail size={14} /></a>
              <a href="https://instagram.com/lohith.gs" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-zinc-200 transition-colors"><Instagram size={14} /></a>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">Also built</p>
            <div className="flex items-center gap-2">
              <a href="https://gitcity-3d.vercel.app/" target="_blank" rel="noopener noreferrer"
                className="text-[11px] text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-400/50 hover:text-blue-300 px-3 py-1 rounded-full transition-all">
                Git City ↗
              </a>
              <a href="https://chromewebstore.google.com/detail/allolniimedofhingkeodfglnogcmelj" target="_blank" rel="noopener noreferrer"
                className="text-[11px] text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-400/50 hover:text-blue-300 px-3 py-1 rounded-full transition-all">
                DevLens ↗
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Right — form 40% */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full md:w-[40%] px-8 bg-zinc-950/60 backdrop-blur-sm">
        <div className="w-full max-w-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
