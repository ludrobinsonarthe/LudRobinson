
'use client';
import { Bot, Loader2, Send, Sparkles, X } from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from './ui/scroll-area';
import { Textarea } from './ui/textarea';
import { useUser } from '@/hooks/use-user';
import { askTutor } from '@/ai/flows/tutor-flow';
import { Course, User } from '@/lib/types';
import ReactMarkdown from 'react-markdown';

type Message = {
  role: 'user' | 'model';
  content: string;
};

interface TutorPanelProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export default function TutorPanel({ isOpen, setIsOpen }: TutorPanelProps) {
  const { user, allCourses, fields } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const studentCourses = React.useMemo(() => {
    if (user?.role !== 'student' || !user.student || !allCourses) return [];

    const studentField = fields.find((f) => f.id === user.student!.fieldId);
    const studentSectorId = user.student.sectorId || studentField?.sectorId;

    return allCourses.filter(
      (c) =>
        c.level === user.student!.level &&
        (c.fieldId === user.student!.fieldId ||
          (!c.fieldId && c.sectorId === studentSectorId))
    );
  }, [user, allCourses, fields]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || !user) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await askTutor({
        query: input,
        student: user,
        courses: studentCourses,
        history: messages,
      });

      const modelMessage: Message = { role: 'model', content: response };
      setMessages((prev) => [...prev, modelMessage]);
    } catch (error) {
      console.error('Error with AI Tutor:', error);
      const errorMessage: Message = {
        role: 'model',
        content:
          'Désolé, une erreur est survenue. Veuillez réessayer plus tard.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0">
        <SheetHeader className="p-6">
          <SheetTitle className="flex items-center gap-2 font-headline">
            <Sparkles className="h-6 w-6 text-primary" />
            Tuteur IA Personnalisé
          </SheetTitle>
          <SheetDescription>
            Posez des questions sur vos cours, demandez des explications ou
            générez des quiz.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6" ref={scrollAreaRef}>
          <div className="space-y-6 pb-6">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground p-8">
                <Bot className="mx-auto h-12 w-12" />
                <p className="mt-4">
                  Bonjour {user?.firstName}! Comment puis-je t'aider à réviser
                  aujourd'hui ?
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-3 ${
                  m.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-sm rounded-lg p-3 ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">
                    {m.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start gap-3">
                <div className="max-w-sm rounded-lg p-3 bg-muted">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-background">
          <form onSubmit={handleSubmit} className="relative">
            <Textarea
              placeholder="Posez une question sur un de vos cours..."
              className="pr-20 resize-none"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              disabled={isLoading || !input.trim()}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
