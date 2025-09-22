
'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, CornerDownLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUser } from '@/hooks/use-user';
import { tutorAction } from '@/lib/actions';
import type { TutorMessage, TutorOutput } from '@/ai/flows/tutor-flow';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface MessageWithQuiz extends TutorMessage {
    quiz?: TutorOutput['quiz'];
}

export default function TutorPage() {
    const { user } = useUser();
    const { toast } = useToast();
    const [messages, setMessages] = useState<MessageWithQuiz[]>([
        {
            role: 'model',
            content: 'Bonjour ! Je suis ISGI-Bot, votre tuteur IA personnel. Posez-moi une question sur vos cours et je ferai de mon mieux pour y répondre.',
        },
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    
    const getInitials = (firstName: string = '', lastName: string = '') => {
        return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage: TutorMessage = { role: 'user', content: input };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        const result = await tutorAction(newMessages.map(({ quiz, ...rest }) => rest));

        if (result.error) {
            const errorMessage: MessageWithQuiz = { role: 'model', content: result.error };
            setMessages((prev) => [...prev, errorMessage]);
        } else if (result.response) {
            const modelMessage: MessageWithQuiz = {
                role: 'model',
                content: result.response.response,
                quiz: result.response.quiz,
            };
            setMessages((prev) => [...prev, modelMessage]);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({
                top: scrollAreaRef.current.scrollHeight,
                behavior: 'smooth',
            });
        }
    }, [messages]);

    const QuizComponent = ({ quiz }: { quiz: NonNullable<TutorOutput['quiz']> }) => {
        const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
        const [submitted, setSubmitted] = useState(false);

        const handleCheckAnswers = () => {
            setSubmitted(true);
            let correctCount = 0;
            quiz.forEach((q, index) => {
                if (selectedAnswers[index] === q.answer) {
                    correctCount++;
                }
            });
            toast({
                title: 'Résultats du Quiz',
                description: `Vous avez obtenu ${correctCount} sur ${quiz.length} !`,
            });
        };

        return (
            <Card className="mt-4 bg-muted/50">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold">Mini-Quiz</CardTitle>
                    <CardDescription>Testez votre compréhension !</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {quiz.map((q, index) => (
                        <div key={index} className={cn("p-4 rounded-lg border", submitted && (selectedAnswers[index] === q.answer ? 'border-green-500 bg-green-500/10' : 'border-destructive bg-destructive/10'))}>
                            <p className="font-medium mb-2">{index + 1}. {q.question}</p>
                            <RadioGroup
                                value={selectedAnswers[index]}
                                onValueChange={(value) => setSelectedAnswers(prev => ({ ...prev, [index]: value }))}
                                disabled={submitted}
                            >
                                {q.options.map((option, i) => (
                                    <div key={i} className="flex items-center space-x-2">
                                        <RadioGroupItem value={option} id={`q${index}-o${i}`} />
                                        <Label htmlFor={`q${index}-o${i}`} className="cursor-pointer">{option}</Label>
                                    </div>
                                ))}
                            </RadioGroup>
                            {submitted && (
                                <div className="mt-3 text-sm p-2 rounded-md bg-background/50">
                                    <p><strong>Réponse correcte :</strong> {q.answer}</p>
                                    <p><strong>Explication :</strong> {q.explanation}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </CardContent>
                <CardFooter>
                    <Button onClick={handleCheckAnswers} disabled={submitted || Object.keys(selectedAnswers).length < quiz.length}>
                        Vérifier mes réponses
                    </Button>
                </CardFooter>
            </Card>
        );
    };

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col">
            <div className="mb-6">
                <h1 className="text-3xl font-bold font-headline tracking-tight">Tuteur IA</h1>
                <p className="text-muted-foreground">Votre assistant personnel pour vous aider à réussir vos études.</p>
            </div>

            <Card className="flex-1 flex flex-col">
                <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                    <div className="space-y-6">
                        {messages.map((message, index) => (
                            <div key={index} className={cn('flex items-start gap-4', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                                {message.role === 'model' && (
                                    <Avatar className="h-10 w-10 border bg-primary text-primary-foreground">
                                        <AvatarFallback><Bot /></AvatarFallback>
                                    </Avatar>
                                )}
                                <div className={cn('max-w-2xl rounded-lg px-4 py-3', message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                                    <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">
                                        {message.content}
                                    </ReactMarkdown>
                                    {message.quiz && <QuizComponent quiz={message.quiz} />}
                                </div>
                                {message.role === 'user' && user && (
                                    <Avatar className="h-10 w-10 border">
                                        <AvatarImage src={user.photoUrl} alt={user.firstName} />
                                        <AvatarFallback>{getInitials(user.firstName, user.lastName)}</AvatarFallback>
                                    </Avatar>
                                )}
                            </div>
                        ))}
                         {isLoading && (
                            <div className="flex items-start gap-4 justify-start">
                                 <Avatar className="h-10 w-10 border bg-primary text-primary-foreground">
                                    <AvatarFallback><Bot /></AvatarFallback>
                                </Avatar>
                                <div className="max-w-2xl rounded-lg px-4 py-3 bg-muted flex items-center">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                    <span className="ml-2 text-muted-foreground text-sm">Réflexion...</span>
                                </div>
                            </div>
                         )}
                    </div>
                </ScrollArea>
                <div className="border-t p-4">
                    <form onSubmit={handleSendMessage} className="relative">
                        <Textarea
                            placeholder="Posez une question sur un cours, demandez un résumé..."
                            className="pr-20"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    handleSendMessage(e);
                                }
                            }}
                            disabled={isLoading}
                        />
                        <Button type="submit" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" disabled={isLoading || !input.trim()}>
                            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CornerDownLeft className="h-5 w-5" />}
                        </Button>
                    </form>
                </div>
            </Card>
        </div>
    );
}
