
"use client";

import { useState, useEffect } from "react";
import ChatLayout from "@/components/chat-layout";
import { useUser } from "@/hooks/use-user";
import { Message } from "@/lib/types";
import { collection, query, where, onSnapshot, or, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";

export default function MessagesPage() {
  const { user, users } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const q = query(
      collection(db, "messages"),
      where('type', '==', 'private'),
      or(
          where('senderId', '==', user.uid),
          where('receiverId', '==', user.uid)
      )
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const userMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message))
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setMessages(userMessages);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching messages:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);
  
  const handleNewMessage = async (newMessageData: Omit<Message, 'id' | 'createdAt'>) => {
     await addDoc(collection(db, "messages"), {
        ...newMessageData,
        createdAt: new Date().toISOString(),
    });
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
