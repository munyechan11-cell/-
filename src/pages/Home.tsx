import { Link } from 'react-router-dom';
import { 
  Store, UserCircle, ShieldCheck, Heart, 
  MapPin, Clock, ArrowRight, Sparkles,
  Award, Star, LayoutGrid, Zap
} from 'lucide-react';

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center bg-surface-bright font-sans text-on-surface hanji-texture relative min-h-screen overflow-hidden px-6 pt-20 pb-32">
      <div className="lattice-overlay absolute inset-0 pointer-events-none opacity-10"></div>
      
      {/* Decorative Brand Circles */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full -ml-48 -mt-48 blur-3xl opacity-50"></div>
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-burgundy/5 rounded-full -mr-64 -mb-64 blur-3xl opacity-50"></div>

      {/* Hero Section */}
      <div className="text-center relative z-10 mb-16 animate-in fade-in slide-in-from-top-12 duration-1000 ease-out">
        <div className="inline-block relative mb-8">
           <div className="absolute -inset-4 bg-primary/5 rounded-full blur-xl animate-pulse"></div>
           <h1 className="text-[120px] sm:text-[160px] font-serif font-black text-primary leading-none tracking-tighter italic select-none relative">
             결
           </h1>
        </div>
        <div className="space-y-4 max-w-sm mx-auto">
          <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.4em] leading-relaxed">
            Universal Governance & Guest Heritage
          </p>
          <div className="h-px w-20 bg-primary/10 mx-auto"></div>
          <p className="text-sm font-serif italic text-primary/60 serif leading-relaxed px-4">
            The bridge between the Master's oversight and the Citizen's journey.
          </p>
        </div>
      </div>
      
      {/* Action Portal */}
      <div className="w-full max-w-xl space-y-6 mt-12 relative z-10">
        <Link 
          to="/scan"
          className="group relative block p-8 rounded-[3.5rem] bg-white border border-primary/5 shadow-sm hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-700 overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity">
             <UserCircle className="w-32 h-32 text-primary" strokeWidth={1} />
          </div>
          
          <div className="flex items-center space-x-8">
            <div className="w-20 h-20 rounded-[2rem] bg-primary flex items-center justify-center shadow-xl shadow-primary/20 rotate-3 group-hover:rotate-0 transition-transform duration-500">
               <UserCircle className="w-10 h-10 text-white" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h2 className="text-3xl font-serif font-black text-primary italic tracking-tight">Citizens</h2>
                <div className="h-4 w-px bg-primary/10"></div>
                <span className="text-[9px] font-black text-primary/30 uppercase tracking-widest">Guest Entry</span>
              </div>
              <p className="text-sm text-primary/40 font-serif italic serif leading-relaxed max-w-[200px]">
                Access your digital heritage and scan the atelier cipher.
              </p>
            </div>
            <div className="hidden sm:flex items-center justify-center w-12 h-12 rounded-full border border-primary/5 group-hover:bg-primary group-hover:text-white transition-all">
               <ArrowRight className="w-5 h-5" />
            </div>
          </div>
        </Link>

        <Link 
          to="/owner/login"
          className="group relative block p-8 rounded-[3.5rem] bg-white border border-primary/5 shadow-sm hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-700 overflow-hidden"
        >
          <div className="absolute bottom-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity translate-y-4">
             <Store className="w-32 h-32 text-burgundy" strokeWidth={1} />
          </div>

          <div className="flex items-center space-x-8">
            <div className="w-20 h-20 rounded-[2rem] bg-burgundy flex items-center justify-center shadow-xl shadow-burgundy/20 -rotate-3 group-hover:rotate-0 transition-transform duration-500">
               <Store className="w-10 h-10 text-white" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h2 className="text-3xl font-serif font-black text-primary italic tracking-tight">Ateliers</h2>
                <div className="h-4 w-px bg-primary/10"></div>
                <span className="text-[9px] font-black text-primary/30 uppercase tracking-widest">Management</span>
              </div>
              <p className="text-sm text-primary/40 font-serif italic serif leading-relaxed max-w-[200px]">
                Oversee floor plans and citizen registry analytics.
              </p>
            </div>
            <div className="hidden sm:flex items-center justify-center w-12 h-12 rounded-full border border-primary/5 group-hover:bg-burgundy group-hover:text-white transition-all">
               <ArrowRight className="w-5 h-5" />
            </div>
          </div>
        </Link>
      </div>

      {/* Footer / Master Admin */}
      <div className="mt-auto pt-24 pb-8 relative z-10 flex flex-col items-center">
        <Link 
          to="/master" 
          className="group flex items-center space-x-3 text-[10px] font-black text-primary/20 hover:text-primary transition-all uppercase tracking-[0.4em]"
        >
          <ShieldCheck className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" strokeWidth={3} />
          <span>Governance Master</span>
        </Link>
        <div className="mt-8 flex items-center space-x-6 opacity-10">
           <Zap className="w-4 h-4 text-primary" fill="currentColor" />
           <div className="h-1 w-1 rounded-full bg-primary/50"></div>
           <Zap className="w-4 h-4 text-burgundy" fill="currentColor" />
        </div>
      </div>
    </div>
  );
}
