import { TechnicianNavbar } from "@/components/technician/navbar";
import { ChatInterface } from "@/components/technician/chat-interface";
import { ChatProvider } from "@/hooks/use-chat";
import { AvatarProvider } from "@/hooks/use-avatar";

export default function TechnicianPage() {
  return (
    <AvatarProvider>
      <ChatProvider>
        <div className="min-h-screen bg-neutral-50 flex flex-col">
          <TechnicianNavbar />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <ChatInterface />
            </div>
          </div>
        </div>
      </ChatProvider>
    </AvatarProvider>
  );
}
