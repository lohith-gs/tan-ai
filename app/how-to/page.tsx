// app/how-to/page.tsx — public guide with illustrated steps
import Link from "next/link";
import Logo from "@/components/Logo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How to use | tan(AI)",
  description: "Learn how to branch, compare, merge and share non-linear AI conversations.",
};

// Shared bits for the illustrations
const PANEL = { fill: "#0c0f1a", stroke: "#1c2035" };
const HILITE = "#3b82f6";

function Highlight({ x, y, w, h, r = 10 }: { x: number; y: number; w: number; h: number; r?: number }) {
  return (
    <>
      <rect x={x - 4} y={y - 4} width={w + 8} height={h + 8} rx={r} fill="none"
        stroke={HILITE} strokeWidth="2" strokeOpacity="0.9" />
      <rect x={x - 9} y={y - 9} width={w + 18} height={h + 18} rx={r + 4} fill="none"
        stroke={HILITE} strokeWidth="1.5" strokeOpacity="0.25" />
    </>
  );
}

function StepChat() {
  return (
    <svg viewBox="0 0 460 190" className="w-full">
      <rect x="10" y="10" width="440" height="170" rx="14" {...PANEL} strokeWidth="1" />
      <circle cx="34" cy="30" r="3" fill="#3b82f6" />
      <text x="46" y="34" fontSize="10" fill="#64748b" fontFamily="monospace">main thread</text>
      <rect x="240" y="48" width="190" height="26" rx="10" fill="#2563eb" />
      <text x="252" y="65" fontSize="10" fill="#fff">explain quantum computing simply</text>
      <rect x="30" y="84" width="260" height="40" rx="10" fill="#10141f" />
      <text x="42" y="100" fontSize="10" fill="#a1a1aa">Quantum computers use qubits that can</text>
      <text x="42" y="114" fontSize="10" fill="#a1a1aa">exist in many states at once...</text>
      <rect x="30" y="140" width="360" height="28" rx="10" fill="#07090f" stroke="#1c2035" />
      <text x="44" y="158" fontSize="10" fill="#52525b">Message main thread...</text>
      <rect x="396" y="140" width="34" height="28" rx="10" fill="#2563eb" />
      <path d="M 408 150 L 420 154 L 408 158 Z" fill="#fff" />
      <Highlight x={30} y={140} w={400} h={28} />
    </svg>
  );
}

function StepBranch() {
  return (
    <svg viewBox="0 0 460 190" className="w-full">
      <rect x="10" y="10" width="440" height="170" rx="14" {...PANEL} strokeWidth="1" />
      <rect x="28" y="28" width="200" height="44" rx="10" fill="#10141f" stroke="#3b82f6" strokeOpacity="0.35" />
      <text x="40" y="46" fontSize="10" fill="#a1a1aa">Quantum computers use qubits</text>
      <text x="40" y="60" fontSize="10" fill="#a1a1aa">that can exist in many states...</text>
      {/* cursor */}
      <path d="M 200 62 l 6 14 l 3 -6 l 6 -2 Z" fill="#e4e4e7" stroke="#0c0f1a" />
      {/* checkpoint chips */}
      <rect x="28" y="82" width="118" height="18" rx="9" fill="#0c0f1a" stroke="#6366f1" strokeOpacity="0.4" />
      <text x="38" y="94" fontSize="9" fill="#818cf8">→ What is a qubit?</text>
      <rect x="152" y="82" width="130" height="18" rx="9" fill="#0c0f1a" stroke="#6366f1" strokeOpacity="0.4" />
      <text x="162" y="94" fontSize="9" fill="#818cf8">→ Real-world uses?</text>
      {/* popup */}
      <rect x="250" y="44" width="182" height="104" rx="12" fill="#18181b" stroke="#3f3f46" />
      <text x="264" y="66" fontSize="10" fill="#d4d4d8" fontWeight="600">Branch from here</text>
      <rect x="264" y="76" width="154" height="22" rx="7" fill="#27272a" stroke="#3f3f46" />
      <text x="272" y="91" fontSize="9" fill="#52525b">Your question...</text>
      <rect x="264" y="108" width="62" height="22" rx="7" fill="#0c0f1a" stroke="#3f3f46" />
      <text x="274" y="123" fontSize="9" fill="#71717a">compare</text>
      <rect x="356" y="108" width="62" height="22" rx="7" fill="#2563eb" />
      <text x="370" y="123" fontSize="9" fill="#fff">Branch</text>
      <Highlight x={250} y={44} w={182} h={104} r={12} />
    </svg>
  );
}

function StepCanvas() {
  return (
    <svg viewBox="0 0 460 190" className="w-full">
      <rect x="10" y="10" width="150" height="170" rx="12" {...PANEL} strokeWidth="1" />
      <text x="24" y="30" fontSize="9" fill="#64748b" fontFamily="monospace">main thread</text>
      <rect x="24" y="40" width="120" height="14" rx="5" fill="#10141f" />
      <rect x="24" y="60" width="120" height="14" rx="5" fill="#10141f" />
      <circle cx="144" cy="67" r="3" fill="#3b82f6" />
      <rect x="24" y="80" width="120" height="14" rx="5" fill="#10141f" />
      <circle cx="144" cy="87" r="3" fill="#252d42" />
      {/* connectors */}
      <path d="M 147 67 C 190 67 190 50 216 50" stroke="#3b82f6" strokeWidth="1.5" fill="none" />
      <path d="M 147 87 C 190 87 190 120 216 120" stroke="#1e2540" strokeWidth="1.5" fill="none" strokeDasharray="4 3" />
      {/* branch cards */}
      <rect x="216" y="30" width="150" height="70" rx="12" fill="#0c0f1a" stroke="#22c55e" strokeOpacity="0.45" />
      <text x="228" y="48" fontSize="9" fill="#86efac">What is a qubit?</text>
      <rect x="228" y="56" width="126" height="10" rx="4" fill="#10141f" />
      <rect x="228" y="72" width="126" height="10" rx="4" fill="#10141f" />
      <rect x="216" y="112" width="150" height="58" rx="12" fill="#0c0f1a" stroke="#1c2035" />
      <text x="228" y="130" fontSize="9" fill="#a1a1aa">Real-world uses?</text>
      <rect x="228" y="138" width="126" height="10" rx="4" fill="#10141f" />
      {/* nested branch */}
      <path d="M 366 60 C 392 60 392 76 400 76" stroke="#1e2540" strokeWidth="1.5" fill="none" strokeDasharray="4 3" />
      <rect x="400" y="56" width="50" height="44" rx="10" fill="#0c0f1a" stroke="#1c2035" />
      <text x="408" y="74" fontSize="8" fill="#71717a">deeper</text>
      <text x="408" y="86" fontSize="8" fill="#71717a">still...</text>
    </svg>
  );
}

function StepCompare() {
  return (
    <svg viewBox="0 0 460 190" className="w-full">
      <rect x="10" y="10" width="440" height="170" rx="14" {...PANEL} strokeWidth="1" />
      {/* popup fragment */}
      <rect x="26" y="26" width="188" height="66" rx="10" fill="#18181b" stroke="#3f3f46" />
      <rect x="38" y="38" width="70" height="20" rx="6" fill="#27272a" stroke="#3f3f46" />
      <text x="44" y="52" fontSize="8" fill="#a1a1aa">Llama 3.1 8B</text>
      <text x="113" y="52" fontSize="8" fill="#52525b">vs</text>
      <rect x="126" y="38" width="76" height="20" rx="6" fill="#27272a" stroke="#3f3f46" />
      <text x="132" y="52" fontSize="8" fill="#a1a1aa">GPT-4o mini</text>
      <rect x="38" y="64" width="62" height="18" rx="6" fill="#2563eb" />
      <text x="48" y="77" fontSize="8" fill="#fff">Compare</text>
      <Highlight x={26} y={26} w={188} h={66} r={10} />
      {/* two sibling cards */}
      <rect x="240" y="26" width="200" height="66" rx="10" fill="#0c0f1a" stroke="#1c2035" />
      <text x="252" y="44" fontSize="9" fill="#a1a1aa">Which DB should I use?</text>
      <rect x="352" y="34" width="76" height="14" rx="7" fill="#78350f" fillOpacity="0.3" stroke="#f59e0b" strokeOpacity="0.4" />
      <text x="358" y="44" fontSize="8" fill="#fbbf24">Llama 3.1 8B</text>
      <rect x="252" y="56" width="176" height="10" rx="4" fill="#10141f" />
      <rect x="252" y="72" width="140" height="10" rx="4" fill="#10141f" />
      <rect x="240" y="104" width="200" height="66" rx="10" fill="#0c0f1a" stroke="#1c2035" />
      <text x="252" y="122" fontSize="9" fill="#a1a1aa">Which DB should I use?</text>
      <rect x="352" y="112" width="76" height="14" rx="7" fill="#78350f" fillOpacity="0.3" stroke="#f59e0b" strokeOpacity="0.4" />
      <text x="360" y="122" fontSize="8" fill="#fbbf24">GPT-4o mini</text>
      <rect x="252" y="134" width="176" height="10" rx="4" fill="#10141f" />
      <rect x="252" y="150" width="150" height="10" rx="4" fill="#10141f" />
    </svg>
  );
}

function StepMerge() {
  return (
    <svg viewBox="0 0 460 190" className="w-full">
      {/* branch card */}
      <rect x="10" y="30" width="190" height="120" rx="12" {...PANEL} strokeWidth="1" />
      <text x="24" y="52" fontSize="9" fill="#86efac">What is a qubit?</text>
      <rect x="118" y="40" width="52" height="16" rx="8" fill="#0c0f1a" stroke="#8b5cf6" strokeOpacity="0.5" />
      <text x="128" y="51" fontSize="8" fill="#a78bfa">merge</text>
      <Highlight x={118} y={40} w={52} h={16} r={8} />
      <rect x="24" y="66" width="160" height="12" rx="5" fill="#10141f" />
      <rect x="24" y="84" width="160" height="12" rx="5" fill="#10141f" />
      <rect x="24" y="102" width="120" height="12" rx="5" fill="#10141f" />
      {/* arrow */}
      <path d="M 208 90 C 240 90 240 90 252 90" stroke="#8b5cf6" strokeWidth="2" fill="none" strokeDasharray="5 4" />
      <path d="M 250 84 L 262 90 L 250 96 Z" fill="#8b5cf6" />
      {/* parent thread with merge card */}
      <rect x="270" y="30" width="180" height="120" rx="12" {...PANEL} strokeWidth="1" />
      <text x="284" y="50" fontSize="9" fill="#64748b" fontFamily="monospace">main thread</text>
      <rect x="284" y="60" width="152" height="12" rx="5" fill="#10141f" />
      <rect x="284" y="82" width="152" height="48" rx="10" fill="#8b5cf6" fillOpacity="0.07" stroke="#8b5cf6" strokeOpacity="0.35" />
      <text x="296" y="100" fontSize="9" fill="#c4b5fd">⑂ merged from "What is a qubit?"</text>
      <rect x="296" y="108" width="128" height="8" rx="3" fill="#10141f" />
      <rect x="296" y="120" width="100" height="8" rx="3" fill="#10141f" />
    </svg>
  );
}

function StepGraph() {
  return (
    <svg viewBox="0 0 460 190" className="w-full">
      <rect x="10" y="10" width="440" height="170" rx="14" {...PANEL} strokeWidth="1" />
      {/* toggle */}
      <rect x="362" y="22" width="72" height="22" rx="8" fill="#151a28" stroke="#1c2035" />
      <text x="378" y="37" fontSize="9" fill="#a1a1aa">⑂ graph</text>
      <Highlight x={362} y={22} w={72} h={22} r={8} />
      {/* nodes */}
      <rect x="40" y="80" width="96" height="36" rx="10" fill="#2563eb" fillOpacity="0.15" stroke="#3b82f6" strokeOpacity="0.5" />
      <text x="54" y="101" fontSize="9" fill="#93c5fd">main thread</text>
      <path d="M 136 98 C 170 98 170 62 200 62" stroke="#3f3f46" strokeWidth="1.5" fill="none" />
      <path d="M 136 98 C 170 98 170 134 200 134" stroke="#8b5cf6" strokeWidth="1.5" fill="none" strokeDasharray="4 3" />
      <rect x="200" y="44" width="96" height="36" rx="10" fill="#16a34a" fillOpacity="0.1" stroke="#22c55e" strokeOpacity="0.5" />
      <text x="214" y="65" fontSize="9" fill="#86efac">qubits deep-dive</text>
      <rect x="200" y="116" width="96" height="36" rx="10" fill="#7c3aed" fillOpacity="0.1" stroke="#8b5cf6" strokeOpacity="0.45" />
      <text x="212" y="133" fontSize="8" fill="#c4b5fd">real-world uses</text>
      <rect x="212" y="138" width="42" height="10" rx="5" fill="#7c3aed" fillOpacity="0.15" stroke="#8b5cf6" strokeOpacity="0.4" />
      <text x="217" y="146" fontSize="7" fill="#c4b5fd">merged</text>
      <path d="M 296 62 C 330 62 330 80 356 80" stroke="#3f3f46" strokeWidth="1.5" fill="none" />
      <rect x="356" y="62" width="80" height="36" rx="10" fill="#0c0f1a" stroke="#3f3f46" />
      <text x="368" y="83" fontSize="9" fill="#a1a1aa">nested...</text>
    </svg>
  );
}

function StepShare() {
  return (
    <svg viewBox="0 0 460 190" className="w-full">
      <rect x="10" y="10" width="440" height="170" rx="14" {...PANEL} strokeWidth="1" />
      {/* header bar */}
      <rect x="10" y="10" width="440" height="40" rx="14" fill="#0c0f1a" />
      <line x1="10" y1="50" x2="450" y2="50" stroke="#1c2035" />
      <text x="30" y="35" fontSize="10" fill="#64748b" fontFamily="monospace">main thread</text>
      <rect x="300" y="20" width="60" height="22" rx="8" fill="#151a28" />
      <text x="313" y="35" fontSize="9" fill="#a1a1aa">share</text>
      <Highlight x={300} y={20} w={60} h={22} r={8} />
      <rect x="370" y="20" width="60" height="22" rx="8" fill="#151a28" />
      <text x="382" y="35" fontSize="9" fill="#a1a1aa">graph</text>
      {/* copied toast */}
      <rect x="120" y="86" width="220" height="34" rx="10" fill="#07090f" stroke="#22c55e" strokeOpacity="0.4" />
      <text x="136" y="107" fontSize="10" fill="#86efac">✓ link copied: /share/9f2a...</text>
      <text x="120" y="150" fontSize="9" fill="#64748b">Anyone with the link gets a read-only mind map. No login needed.</text>
    </svg>
  );
}

const STEPS = [
  {
    title: "Chat on the main thread",
    desc: "Start like any AI chat. The main thread is your conversation's spine, and every reply can become a launch point.",
    art: <StepChat />,
  },
  {
    title: "Branch from any AI response",
    desc: "Click any AI message to open the branch popup and ask a follow-up in a new direction. Or tap the suggested checkpoint chips under a reply. The main thread stays clean while you explore.",
    art: <StepBranch />,
  },
  {
    title: "Explore on the canvas",
    desc: "Branches appear as cards beside the main thread, connected to the exact message they forked from. Branch from branches and go as deep as you want. The active branch glows green.",
    art: <StepCanvas />,
  },
  {
    title: "Compare two models",
    desc: "In the branch popup, toggle compare and pick two models. You get side-by-side sibling branches answering the same question, and each branch stays pinned to its model for follow-ups.",
    art: <StepCompare />,
  },
  {
    title: "Merge insights back",
    desc: "Done exploring? Hit merge on a branch. The AI distills the branch into a compact synthesis and adds it to the parent thread, so your main conversation actually learns from the tangent. If the branch grows later, re-merge refreshes it.",
    art: <StepMerge />,
  },
  {
    title: "See your whole thinking in graph view",
    desc: "Switch to graph view for a bird's-eye map of every thread. Merged branches show in violet. Click any node to jump straight to it on the canvas.",
    art: <StepGraph />,
  },
  {
    title: "Share it as a mind map",
    desc: "One click publishes a read-only snapshot with a public link. Viewers get the interactive map with zoomable, scrollable chat cards. No account needed.",
    art: <StepShare />,
  },
];

export default function HowToPage() {
  return (
    <div className="h-screen overflow-y-auto bg-[#07090f] text-zinc-200">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-4 px-6 py-3 border-b border-[#1c2035]/60 bg-[#0c0f1a]/85 backdrop-blur-md">
        <Link href="/"><Logo width={64} height={36} /></Link>
        <span className="text-sm text-zinc-400 flex-1">How to use</span>
        <Link
          href="/"
          className="text-xs px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
        >
          Open tan(AI) →
        </Link>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12 flex flex-col gap-14">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">Think in branches, not threads</h1>
          <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
            tan(AI) lets a conversation go off on tangents without losing the plot.
            Seven things to know, two minutes to read.
          </p>
        </div>

        {STEPS.map((step, i) => (
          <div key={step.title} className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <span className="text-xs font-mono text-blue-500/70 mt-1 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h2 className="text-base font-medium text-zinc-100">{step.title}</h2>
                <p className="text-sm text-zinc-500 mt-1 leading-relaxed">{step.desc}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-[#1c2035] bg-[#0a0d16] p-3">
              {step.art}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div className="border-t border-[#1c2035]/60 pt-8 flex flex-col gap-3">
          <p className="text-sm text-zinc-400">
            The free trial gives you 3 chats with 5 branches each, no API key needed.
            Add your own key in the profile page for unlimited use. Groq keys are free.
          </p>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
            >
              Start branching →
            </Link>
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
            >
              Get a free Groq key
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
