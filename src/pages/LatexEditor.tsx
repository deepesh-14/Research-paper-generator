import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Copy, Download, Home, FileText, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-latex";
import "prismjs/themes/prism-tomorrow.css";

const LatexEditor = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const [latex, setLatex] = useState("");
  const [isCompiling, setIsCompiling] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const latexFromState = location.state?.latex;
    if (latexFromState) {
      setLatex(latexFromState);
    } else {
      // Default IEEE template
      setLatex(`\\documentclass[conference]{IEEEtran}
\\usepackage{cite}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{algorithmic}
\\usepackage{graphicx}
\\usepackage{textcomp}
\\usepackage{xcolor}

\\begin{document}

\\title{Your Research Paper Title}

\\author{Author Name}

\\maketitle

\\begin{abstract}
Your abstract goes here.
\\end{abstract}

\\section{Introduction}
Your introduction goes here.

\\section{Conclusion}
Your conclusion goes here.

\\end{document}`);
    }

    // Cleanup blob URL on unmount
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [location.state]);

  const validateLatex = (code: string): { valid: boolean; error?: string } => {
    if (!code.includes("\\documentclass")) {
      return { valid: false, error: "Missing \\documentclass declaration" };
    }
    if (!code.includes("\\begin{document}")) {
      return { valid: false, error: "Missing \\begin{document}" };
    }
    if (!code.includes("\\end{document}")) {
      return { valid: false, error: "Missing \\end{document}" };
    }
    
    return { valid: true };
  };

  const dataURLtoBlob = (dataURL: string): Blob => {
    const parts = dataURL.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/pdf';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const handleCompile = async () => {
    setError("");
    
    // Revoke previous blob URL
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl("");
    }
    
    // Validate LaTeX
    const validation = validateLatex(latex);
    if (!validation.valid) {
      setError(validation.error || "LaTeX validation failed");
      toast({
        title: "Validation Error",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    setIsCompiling(true);
    
    try {
      const { data, error: functionError } = await supabase.functions.invoke("compile-latex", {
        body: { latex },
      });

      if (functionError) {
        // Supabase function invocation error (network, auth, etc.)
        throw new Error(functionError.message || 'Failed to reach the compilation server');
      }

      if (!data) {
        throw new Error('No response received from compilation server');
      }

      if (data.success && data.pdf_url) {
        // Convert data URL to blob URL for proper iframe display
        const blob = dataURLtoBlob(data.pdf_url);
        const blobUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(blobUrl);
        
        toast({
          title: "Compilation Successful",
          description: "Your PDF has been generated!",
        });
      } else {
        const errMsg = data.error || "Compilation failed. The LaTeX code may contain syntax errors.";
        setError(errMsg);
        toast({
          title: "Compilation Failed",
          description: "Check the error panel for details",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      const errorMsg = err.message || "Failed to compile LaTeX";
      setError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg.length > 100 ? errorMsg.substring(0, 100) + '...' : errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsCompiling(false);
    }
  };

  const handleCopyLatex = () => {
    navigator.clipboard.writeText(latex);
    toast({
      title: "Copied!",
      description: "LaTeX code copied to clipboard",
    });
  };

  const handleDownloadPDF = () => {
    if (pdfBlobUrl) {
      const link = document.createElement("a");
      link.href = pdfBlobUrl;
      link.download = "research-paper.pdf";
      link.click();
      toast({
        title: "Downloading",
        description: "Your PDF is being downloaded",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">LaTeX Editor</h1>
          </div>
          <Button onClick={() => navigate("/")} variant="outline">
            <Home className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-4">
          <Button 
            onClick={handleCompile} 
            disabled={isCompiling}
            className="flex-1"
          >
            {isCompiling ? "Compiling..." : "Compile to PDF"}
          </Button>
          <Button onClick={handleCopyLatex} variant="outline">
            <Copy className="w-4 h-4 mr-2" />
            Copy LaTeX
          </Button>
          {pdfBlobUrl && (
            <Button onClick={handleDownloadPDF} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* LaTeX Editor */}
          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-3">LaTeX Code</h2>
            <div className="border rounded-md overflow-hidden bg-[#2d2d2d]">
              <Editor
                value={latex}
                onValueChange={setLatex}
                highlight={(code) => Prism.highlight(code, Prism.languages.latex, "latex")}
                padding={16}
                style={{
                  fontFamily: '"Fira code", "Fira Mono", monospace',
                  fontSize: 14,
                  minHeight: "600px",
                  backgroundColor: "#2d2d2d",
                  color: "#ccc",
                }}
                textareaClassName="focus:outline-none"
              />
            </div>
          </Card>

          {/* PDF Preview / Error Panel */}
          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-3">
              {error ? "Error Log" : "PDF Preview"}
            </h2>
            
            {error ? (
              <div className="border rounded-md p-4 bg-destructive/10 border-destructive">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-destructive mb-2">Compilation Error</h3>
                    <pre className="text-sm whitespace-pre-wrap font-mono text-destructive/90">
                      {error}
                    </pre>
                  </div>
                </div>
              </div>
            ) : pdfBlobUrl ? (
              <object
                data={pdfBlobUrl}
                type="application/pdf"
                className="w-full border rounded-md"
                style={{ height: "600px" }}
              >
                <iframe
                  src={pdfBlobUrl}
                  className="w-full border rounded-md"
                  style={{ height: "600px" }}
                  title="PDF Preview"
                />
              </object>
            ) : (
              <div className="border rounded-md p-8 text-center text-muted-foreground h-[600px] flex items-center justify-center">
                <div>
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Click "Compile to PDF" to generate your document</p>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Info Panel */}
        <Card className="mt-4 p-4 bg-muted/50">
          <h3 className="font-semibold mb-2">IEEE Format Guidelines</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Must use <code className="text-foreground">\documentclass[journal]&#123;IEEEtran&#125;</code></li>
            <li>• Required: <code className="text-foreground">\begin&#123;document&#125;</code> and <code className="text-foreground">\end&#123;document&#125;</code></li>
            <li>• All environments must be properly closed</li>
            <li>• Use standard IEEE sections: Abstract, Introduction, Methodology, Results, Conclusion</li>
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default LatexEditor;