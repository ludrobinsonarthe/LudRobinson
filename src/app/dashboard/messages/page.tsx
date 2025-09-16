
"use client";

import ChatLayout from "@/components/chat-layout";
import { mockMessages } from "@/lib/mock-data";
import { useUser } from "@/hooks/use-user";

export default function MessagesPage() {
  const { users } = useUser();
  return (
    <div>
       <div className="mb-6">
        <h1 className="text-3xl font-bold font-headline tracking-tight">Messagerie</h1>
        <p className="text-muted-foreground">
          Discussions privées avec les autres utilisateurs.
        </p>
      </div>
      <ChatLayout
        defaultLayout={[320, 1]}
        messages={mockMessages}
        users={users}
      />
    </div>
  );
}
