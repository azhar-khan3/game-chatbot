import { 
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  signal,
  viewChild
} from '@angular/core';
import { RouterLink } from '@angular/router';

interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chatbot.html',
  styleUrl: './chatbot.css',
})
export class Chatbot {

  chatHistory = signal<ChatMessage[]>([]);
  isTyping = signal<boolean>(false);
  
  // ViewChild to handle auto-scrolling
  scrollContainer = viewChild<ElementRef>('scrollContainer');

  private readonly API_KEY = 'AIzaSyDTYBM7tqtF5L-NkmVA3jdqovn4xf0gpWg'; // Managed by Canvas context
  private readonly API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';
  private readonly SYSTEM_INSTRUCTION = "You are a helpful, brilliant, and charming AI assistant built using Angular. You provide concise, accurate, and high-quality answers.";

  constructor() {
    // Auto-scroll effect whenever chat history or typing status changes
    effect(() => {
      this.chatHistory();
      this.isTyping();
      setTimeout(() => this.scrollToBottom(), 50);
    });
  }

  async sendMessage(input: HTMLInputElement) {
    const text = input.value.trim();
    if (!text || this.isTyping()) return;

    // 1. Update UI locally
    const userMsg: ChatMessage = { role: 'user', parts: [{ text }] };
    this.chatHistory.update(history => [...history, userMsg]);
    input.value = '';
    
    // 2. Start AI request
    this.isTyping.set(true);

    try {
      const responseText = await this.callGeminiAPI(text);
      const modelMsg: ChatMessage = { role: 'model', parts: [{ text: responseText }] };
      this.chatHistory.update(history => [...history, modelMsg]);
    } catch (error) {
      console.error('Gemini Error:', error);
      const errMsg: ChatMessage = { 
        role: 'model', 
        parts: [{ text: "I encountered a connection error. Please try again in a moment." }] 
      };
      this.chatHistory.update(history => [...history, errMsg]);
    } finally {
      this.isTyping.set(false);
    }
  }

  private async callGeminiAPI(query: string): Promise<string> {
    const payload = {
      contents: [
        ...this.chatHistory().slice(0, -1), // Current history (user just added one)
        { role: 'user', parts: [{ text: query }] }
      ],
      systemInstruction: {
        parts: [{ text: this.SYSTEM_INSTRUCTION }]
      }
    };

    let attempt = 0;
    const maxRetries = 3;

    while (attempt < maxRetries) {
      try {
        const res = await fetch(`${this.API_URL}?key=${this.API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData?.error?.message || `API Error: ${res.status}`);
        }

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) throw new Error("Empty AI response received.");
        return text;

      } catch (err) {
        attempt++;
        if (attempt >= maxRetries) throw err;
        // Exponential backoff
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
    return "Error generating response.";
  }

  clearChat() {
    this.chatHistory.set([]);
  }

  private scrollToBottom() {
    const el = this.scrollContainer()?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }


}




