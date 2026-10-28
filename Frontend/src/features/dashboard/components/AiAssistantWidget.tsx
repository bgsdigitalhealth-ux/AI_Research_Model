import { useState } from 'react';
import { useProductConfig } from '@/hooks/useProductConfig';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Bot, X } from 'lucide-react';

export function AiAssistantWidget() {
  const { isAiAssistantEnabled } = useProductConfig();
  const [isOpen, setIsOpen] = useState(false);

  // If the product configuration does not enable the AI Assistant, do not render it
  if (!isAiAssistantEnabled) {
    return null;
  }

  return (
    <>
      <Card className="border-blue-200 bg-linear-to-r from-blue-50/70 via-indigo-50/40 to-white shadow-xs">
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-600 text-white shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                AI Research Assistant
              </h4>
              <p className="text-xs text-slate-600">
                AI protocol synthesis and statistical hypothesis guidance enabled by configuration.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => setIsOpen(true)}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white shrink-0"
          >
            Launch Assistant
          </Button>
        </CardContent>
      </Card>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">AI Research Assistant</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              AI Assistant is configured. When connected to a live backend AI model, interactive protocol suggestions, power analysis, and literature checks will appear here.
            </p>

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setIsOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

