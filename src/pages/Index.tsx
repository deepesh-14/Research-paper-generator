import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, FileText, Sparkles, BookOpen } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Optional: Auto-redirect to auth page
    // navigate("/auth");
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-academic-cream to-academic-light p-4 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iaHNsKDIyMSA4MyUgMjUlIC8gMC4wNSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-40" />
      
      {/* Floating Icons */}
      <div className="absolute top-20 left-20 animate-pulse">
        <BookOpen className="w-12 h-12 text-academic-blue/20" />
      </div>
      <div className="absolute bottom-20 right-20 animate-pulse delay-100">
        <FileText className="w-16 h-16 text-secondary/20" />
      </div>
      
      <div className="text-center space-y-8 max-w-4xl relative z-10">
        {/* Logo */}
        <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-primary to-academic-blue flex items-center justify-center shadow-elegant animate-float">
          <GraduationCap className="w-12 h-12 text-primary-foreground" />
        </div>
        
        {/* Main Heading */}
        <div className="space-y-4">
          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-primary via-academic-blue to-secondary bg-clip-text text-transparent leading-tight">
            AI Research Paper Generator
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Transform your ideas into professionally formatted research papers with the power of AI
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <div className="p-6 rounded-xl bg-card/50 backdrop-blur border border-academic-blue/20 shadow-paper hover:shadow-elegant transition-all">
            <Sparkles className="w-8 h-8 text-secondary mb-3 mx-auto" />
            <h3 className="font-semibold text-lg mb-2">AI-Powered</h3>
            <p className="text-sm text-muted-foreground">
              Advanced AI generates comprehensive, well-structured academic papers
            </p>
          </div>
          <div className="p-6 rounded-xl bg-card/50 backdrop-blur border border-academic-blue/20 shadow-paper hover:shadow-elegant transition-all">
            <FileText className="w-8 h-8 text-secondary mb-3 mx-auto" />
            <h3 className="font-semibold text-lg mb-2">Multiple Formats</h3>
            <p className="text-sm text-muted-foreground">
              Support for IEEE and APA formatting standards with LaTeX export
            </p>
          </div>
          <div className="p-6 rounded-xl bg-card/50 backdrop-blur border border-academic-blue/20 shadow-paper hover:shadow-elegant transition-all">
            <BookOpen className="w-8 h-8 text-secondary mb-3 mx-auto" />
            <h3 className="font-semibold text-lg mb-2">Academic Quality</h3>
            <p className="text-sm text-muted-foreground">
              Professional citations, references, and academic writing standards
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <div className="pt-8">
          <Button
            onClick={() => navigate("/auth")}
            size="lg"
            className="bg-gradient-to-r from-primary to-academic-blue hover:opacity-90 transition-all shadow-elegant text-lg px-8 py-6 gap-3"
          >
            <Sparkles className="w-5 h-5" />
            Get Started
          </Button>
        </div>

        <p className="text-sm text-muted-foreground pt-4">
          Join researchers worldwide in accelerating academic writing
        </p>
      </div>

      {/* Custom animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .delay-100 {
          animation-delay: 0.1s;
        }
      `}</style>
    </div>
  );
};

export default Index;