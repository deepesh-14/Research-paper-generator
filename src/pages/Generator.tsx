import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileText, LogOut, Sparkles, Download, Eye, Plus, Minus, ShieldCheck, Wand2 } from "lucide-react";
import { User, Session } from "@supabase/supabase-js";
import { z } from "zod";

interface Author {
  name: string;
  email: string;
  university: string;
  address: string;
}

const authorSchema = z.object({
  name: z.string().trim().min(1, "Author name is required"),
  email: z.string().trim().email("Invalid email address"),
  university: z.string().trim().min(1, "University is required"),
  address: z.string().trim().min(1, "Address is required"),
});

const paperSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  authors: z.array(authorSchema).min(1, "At least one author is required"),
  keywords: z.string().trim().min(1, "Keywords required"),
  additionalInfo: z.string().optional(),
  pageCount: z.number().min(1).max(50),
});

const Generator = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [paperType, setPaperType] = useState<"IEEE" | "APA">("IEEE");
  const [title, setTitle] = useState("");
  const [authorCount, setAuthorCount] = useState(1);
  const [authors, setAuthors] = useState<Author[]>([{ name: "", email: "", university: "", address: "" }]);
  const [keywords, setKeywords] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [pageCount, setPageCount] = useState("5");
  const [loading, setLoading] = useState(false);
  const [generatedPaper, setGeneratedPaper] = useState<string | null>(null);
  const [latexSource, setLatexSource] = useState<string | null>(null);
  const [isCheckingPlagiarism, setIsCheckingPlagiarism] = useState(false);
  const [plagiarismScore, setPlagiarismScore] = useState<number | null>(null);
  const [isHumanizing, setIsHumanizing] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleAuthorCountChange = (value: string) => {
    const count = parseInt(value);
    setAuthorCount(count);
    
    const newAuthors = [...authors];
    if (count > authors.length) {
      for (let i = authors.length; i < count; i++) {
        newAuthors.push({ name: "", email: "", university: "", address: "" });
      }
    } else {
      newAuthors.splice(count);
    }
    setAuthors(newAuthors);
  };

  const updateAuthor = (index: number, field: keyof Author, value: string) => {
    const newAuthors = [...authors];
    newAuthors[index] = { ...newAuthors[index], [field]: value };
    setAuthors(newAuthors);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const formatAuthorsForLatex = (authorsList: Author[]) => {
    return authorsList.map(a => 
      `\\IEEEauthorblockN{${a.name}}
\\IEEEauthorblockA{${a.university}\\\\${a.address}\\\\${a.email}}`
    ).join("\n\\and\n");
  };

  const formatAuthorsDisplay = (authorsList: Author[]) => {
    return authorsList.map(a => a.name).join(", ");
  };

  const handleGenerate = async () => {
    try {
      const validatedData = paperSchema.parse({
        title: title.trim(),
        authors: authors,
        keywords: keywords.trim(),
        additionalInfo: additionalInfo.trim() || undefined,
        pageCount: parseInt(pageCount),
      });

      // Cast to Author[] since validation passed
      const validatedAuthors = validatedData.authors as Author[];

      setLoading(true);
      setGeneratedPaper(null);
      setLatexSource(null);
      setPlagiarismScore(null);

      const { data, error } = await supabase.functions.invoke('generate-paper', {
        body: {
          paperType,
          title: validatedData.title,
          authors: formatAuthorsForLatex(validatedAuthors),
          authorsDisplay: formatAuthorsDisplay(validatedAuthors),
          authorDetails: validatedAuthors,
          keywords: validatedData.keywords.split(',').map(k => k.trim()),
          additionalInfo: validatedData.additionalInfo,
          pageCount: validatedData.pageCount,
        }
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.content) {
        throw new Error('No content received from AI');
      }

      setGeneratedPaper(data.content);
      setLatexSource(data.latex_source);

      if (user) {
        const { error: saveError } = await supabase.from('research_papers').insert({
          user_id: user.id,
          title: validatedData.title,
          authors: formatAuthorsDisplay(validatedAuthors),
          paper_type: paperType,
          keywords: validatedData.keywords.split(',').map(k => k.trim()),
          additional_info: validatedData.additionalInfo,
          page_count: validatedData.pageCount,
          content: data.content,
          latex_source: data.latex_source,
        });

        if (saveError) {
          console.error('Error saving paper:', saveError);
        }
      }

      toast({
        title: "Paper Generated!",
        description: "Your paper is ready! Check plagiarism or open the LaTeX Editor below.",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to generate paper",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!generatedPaper) return;
    
    const element = document.createElement("a");
    const file = new Blob([generatedPaper], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${title || 'research-paper'}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handlePlagiarismCheck = async () => {
    if (!generatedPaper) return;
    
    setIsCheckingPlagiarism(true);
    setPlagiarismScore(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/check-plagiarism`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ content: generatedPaper }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to analyze paper');
      }

      setPlagiarismScore(data.score);
      
      toast({
        title: "Plagiarism Check Complete",
        description: `Estimated plagiarism score: ${data.score}%`,
      });
      
    } catch (error) {
       toast({
        title: "Check Failed",
        description: error instanceof Error ? error.message : "Failed to run plagiarism check",
        variant: "destructive",
      });
    } finally {
      setIsCheckingPlagiarism(false);
    }
  };

  const handleHumanize = async () => {
    if (!generatedPaper) return;

    setIsHumanizing(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/humanize-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ content: generatedPaper }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to humanize content');
      }

      setGeneratedPaper(data.content);
      setPlagiarismScore(null); // Reset score so user can re-check

      toast({
        title: "Content Humanized!",
        description: "Your paper has been rewritten. Click 'Check Plagiarism' again to see the new score.",
      });

    } catch (error) {
      toast({
        title: "Humanization Failed",
        description: error instanceof Error ? error.message : "Failed to humanize content",
        variant: "destructive",
      });
    } finally {
      setIsHumanizing(false);
    }
  };

  const handleOpenLatexEditor = () => {
    if (latexSource) {
      navigate('/latex-editor', { state: { latex: latexSource } });
    }
  };

  const isFormValid = title && authors.every(a => a.name && a.email && a.university && a.address) && keywords;

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-academic-cream to-academic-light p-4 md:p-8">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iaHNsKDIyMSA4MyUgMjUlIC8gMC4wNSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-40" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-academic-blue flex items-center justify-center shadow-paper">
              <FileText className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-academic-blue bg-clip-text text-transparent">
                Research Paper Generator
              </h1>
              <p className="text-sm text-muted-foreground">AI-Powered Academic Writing</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Input Form */}
          <Card className="shadow-elegant border-academic-blue/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-secondary" />
                Paper Configuration
              </CardTitle>
              <CardDescription>
                Configure your research paper parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="paperType">Paper Format</Label>
                <Select value={paperType} onValueChange={(value) => setPaperType(value as "IEEE" | "APA")}>
                  <SelectTrigger id="paperType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IEEE">IEEE Conference Format</SelectItem>
                    <SelectItem value="APA">APA 7th Edition</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Project Title</Label>
                <Input
                  id="title"
                  placeholder="Enter your research title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* Author Count Selector */}
              <div className="space-y-2">
                <Label htmlFor="authorCount">Number of Authors</Label>
                <Select value={authorCount.toString()} onValueChange={handleAuthorCountChange}>
                  <SelectTrigger id="authorCount">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} Author{num > 1 ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dynamic Author Fields */}
              <div className="space-y-4">
                {authors.map((author, index) => (
                  <Card key={index} className="p-4 bg-muted/30">
                    <h4 className="font-semibold text-sm mb-3 text-primary">
                      Author {index + 1}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Name</Label>
                        <Input
                          placeholder="Full Name"
                          value={author.name}
                          onChange={(e) => updateAuthor(index, "name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Email</Label>
                        <Input
                          type="email"
                          placeholder="email@university.edu"
                          value={author.email}
                          onChange={(e) => updateAuthor(index, "email", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">University/Institution</Label>
                        <Input
                          placeholder="University Name"
                          value={author.university}
                          onChange={(e) => updateAuthor(index, "university", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Address</Label>
                        <Input
                          placeholder="City, Country"
                          value={author.address}
                          onChange={(e) => updateAuthor(index, "address", e.target.value)}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="keywords">Keywords (comma-separated)</Label>
                <Input
                  id="keywords"
                  placeholder="machine learning, artificial intelligence, deep learning"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pageCount">Number of Pages</Label>
                <Input
                  id="pageCount"
                  type="number"
                  min="1"
                  max="50"
                  value={pageCount}
                  onChange={(e) => setPageCount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="additionalInfo">Additional Information (Optional)</Label>
                <Textarea
                  id="additionalInfo"
                  placeholder="Any specific requirements, methodology, or focus areas..."
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  rows={4}
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={loading || !isFormValid}
                className="w-full bg-gradient-to-r from-primary to-academic-blue hover:opacity-90 transition-all shadow-paper gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {loading ? "Generating Paper..." : "Generate Research Paper"}
              </Button>
            </CardContent>
          </Card>

          {/* Preview/Output */}
          <Card className="shadow-elegant border-academic-blue/20">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-secondary" />
                  Generated Paper
                </span>
                {generatedPaper && (
                  <div className="flex gap-2 flex-wrap justify-end">
                    <Button 
                      size="sm" 
                      variant={plagiarismScore !== null ? (plagiarismScore > 20 ? "destructive" : "default") : "outline"} 
                      onClick={handlePlagiarismCheck} 
                      disabled={isCheckingPlagiarism}
                      className={`gap-2 ${plagiarismScore === null && !isCheckingPlagiarism ? 'text-blue-600 border-blue-200 hover:bg-blue-50' : ''}`}
                    >
                      <ShieldCheck className={`w-4 h-4 ${isCheckingPlagiarism ? 'animate-pulse' : ''}`} />
                      {isCheckingPlagiarism 
                        ? "Checking..." 
                        : plagiarismScore !== null 
                          ? `Plagiarism: ${plagiarismScore}%`
                          : "Check Plagiarism"}
                    </Button>
                    {plagiarismScore !== null && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={handleHumanize} 
                        disabled={isHumanizing}
                        className="gap-2 text-purple-600 border-purple-200 hover:bg-purple-50"
                      >
                        <Wand2 className={`w-4 h-4 ${isHumanizing ? 'animate-spin' : ''}`} />
                        {isHumanizing ? "Humanizing..." : "Reduce Plagiarism"}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={handleOpenLatexEditor} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                      <FileText className="w-4 h-4" />
                      Open LaTeX Editor
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleDownload} className="gap-2">
                      <Download className="w-4 h-4" />
                      Download Text
                    </Button>
                  </div>
                )}
              </CardTitle>
              <CardDescription>
                Your AI-generated research paper will appear here
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex flex-col items-center justify-center h-96 space-y-4">
                  <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full" />
                  <p className="text-muted-foreground">Generating your research paper...</p>
                </div>
              ) : generatedPaper ? (
                <div className="prose prose-sm max-w-none bg-card/50 p-6 rounded-lg border border-border max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-sans text-sm">{generatedPaper}</pre>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-96 text-center space-y-4">
                  <FileText className="w-16 h-16 text-muted-foreground/40" />
                  <p className="text-muted-foreground">
                    Configure your paper parameters and click "Generate Research Paper" to begin
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Generator;