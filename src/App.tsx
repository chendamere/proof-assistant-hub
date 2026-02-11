import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PanelProvider } from "@/contexts/PanelContext";
import Index from "./pages/Index";
import ProofStep from "./pages/ProofStep";
import ProofSteps from "./pages/ProofSteps";
import SubstitutionDAGDemo from "./pages/SubstitutionDAGDemo";
import SubstitutionExample from "./pages/SubstitutionExample";
import Glossary from "./pages/Glossary";
import Bibliography from "./pages/Bibliography";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <PanelProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Auth route removed – all pages are publicly accessible */}
            <Route path="/" element={<Index />} />
            <Route path="/proof-steps" element={<ProofSteps />} />
            <Route path="/substitution-dag" element={<SubstitutionDAGDemo />} />
            <Route path="/bibliography" element={<Bibliography />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </PanelProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
