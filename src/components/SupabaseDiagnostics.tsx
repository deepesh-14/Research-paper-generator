import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Loader } from "lucide-react";

export const SupabaseDiagnostics = () => {
  const [diagnostics, setDiagnostics] = useState({
    envVars: { status: "loading", message: "" },
    supabaseClient: { status: "loading", message: "" },
    sessionCheck: { status: "loading", message: "" },
    directFetch: { status: "loading", message: "" },
  });

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    const results: any = {};

    // Test 1: Environment Variables
    try {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!url || !key || !anonKey) {
        results.envVars = {
          status: "error",
          message: `Missing env vars: ${!url ? "URL " : ""}${!key ? "KEY " : ""}${!anonKey ? "ANON_KEY" : ""}`.trim(),
        };
      } else {
        results.envVars = {
          status: "success",
          message: `Loaded: URL (${url.substring(0, 30)}...), Keys present`,
        };
      }
    } catch (e) {
      results.envVars = { status: "error", message: String(e) };
    }

    // Test 2: Supabase Client
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      if (supabase) {
        results.supabaseClient = {
          status: "success",
          message: "Supabase client initialized successfully",
        };
      } else {
        results.supabaseClient = { status: "error", message: "Client is null" };
      }
    } catch (e) {
      results.supabaseClient = { status: "error", message: String(e) };
    }

    // Test 3: Session Check
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        results.sessionCheck = { status: "error", message: `Auth error: ${error.message}` };
      } else {
        results.sessionCheck = {
          status: "success",
          message: data.session ? "Session found" : "No active session (expected on first visit)",
        };
      }
    } catch (e) {
      results.sessionCheck = { status: "error", message: String(e) };
    }

    // Test 4: Direct Fetch
    try {
      const response = await fetch("https://vyifrwfuduzogpmjgadd.supabase.co/rest/v1/", {
        headers: {
          "Content-Type": "application/json",
        },
      });
      results.directFetch = {
        status: response.ok ? "success" : "warning",
        message: `HTTP ${response.status} - ${response.statusText}`,
      };
    } catch (e: any) {
      results.directFetch = {
        status: "error",
        message: e.message || String(e),
      };
    }

    setDiagnostics(results);
  };

  const getIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case "warning":
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      default:
        return <Loader className="w-5 h-5 text-blue-600 animate-spin" />;
    }
  };

  const getColor = (status: string) => {
    switch (status) {
      case "success":
        return "border-green-200 bg-green-50";
      case "error":
        return "border-red-200 bg-red-50";
      case "warning":
        return "border-yellow-200 bg-yellow-50";
      default:
        return "border-blue-200 bg-blue-50";
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Supabase Connection Diagnostics</CardTitle>
          <CardDescription>Test your Supabase configuration and connectivity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(diagnostics).map(([key, test]: any) => (
            <div key={key} className={`p-4 border rounded-lg flex items-start gap-3 ${getColor(test.status)}`}>
              {getIcon(test.status)}
              <div className="flex-1">
                <h3 className="font-semibold capitalize">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </h3>
                <p className="text-sm text-gray-700">{test.message}</p>
              </div>
            </div>
          ))}

          <Button onClick={runDiagnostics} className="w-full mt-4">
            Run Again
          </Button>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Troubleshooting Tips:</strong>
              <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                <li>Ensure .env file contains all required variables</li>
                <li>Restart dev server after .env changes: Ctrl+C then npm run dev</li>
                <li>Clear browser cache: Ctrl+Shift+Delete</li>
                <li>Check browser console (F12) for detailed errors</li>
                <li>Verify your Supabase project is active (not paused)</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupabaseDiagnostics;
