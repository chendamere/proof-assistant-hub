import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PanelProvider } from "@/contexts/PanelContext";
import Index from "./pages/Index";
import Verifier from "./pages/Verifier";
import OperandNormalizer from "./pages/OperandNormalizer";
import ProofStep from "./pages/ProofStep";
import Glossary from "./pages/Glossary";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <PanelProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/verifier" element={<Verifier />} />
            <Route path="/normalizer" element={<OperandNormalizer />} />
            <Route path="/proof-step" element={<ProofStep />} />
            <Route path="/glossary" element={<Glossary />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </PanelProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
