import ChatLayout from "@/components/chat-layout";
import { mockMessages, mockUsers } from "@/lib/mock-data";

export default function MessagesPage() {
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
        users={mockUsers}
      />
    </div>
  );
}
