
"use client";

import { useState, useEffect } from "react";
import ChatLayout from "@/components/chat-layout";
import { useUser } from "@/hooks/use-user";
import { Message } from "@/lib/types";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";

export default function MessagesPage() {
  const { user, users } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function fetchMessages() {
        setLoading(true);
        try {
            const q = query(
                collection(db, "messages"),
                where("type", "==", "private")
            );

            const snapshot = await getDocs(q);
            const allMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
            
            const userMessages = allMessages.filter(
                msg => msg.senderId === user.uid || msg.receiverId === user.uid
            );
            
            userMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            setMessages(userMessages);
        } catch(error) {
            console.error("Error fetching messages: ", error);
        } finally {
            setLoading(false);
        }
    }
    
    fetchMessages();

  }, [user]);
  
  const handleNewMessage = (newMessage: Message) => {
    setMessages(prev => [...prev, newMessage].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
  }

  return (
    <div>
       <div className="mb-6">
        <h1 className="text-3xl font-bold font-headline tracking-tight">Messagerie</h1>
        <p className="text-muted-foreground">
          Discussions privées avec les autres utilisateurs.
        </p>
      </div>
      {loading ? (
         <div className="flex items-center justify-center h-96">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="ml-4 text-muted-foreground">Chargement des messages...</p>
         </div>
      ) : (
        <ChatLayout
          defaultLayout={[320, 1]}
          messages={messages}
          users={users}
          onNewMessage={handleNewMessage}
        />
      )}
    </div>
  );
}

    