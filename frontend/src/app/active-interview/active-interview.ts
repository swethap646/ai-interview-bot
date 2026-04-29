import { Component, ElementRef, OnInit, ViewChild, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-active-interview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './active-interview.html',
  styleUrl: './active-interview.css'
})
export class ActiveInterviewComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;

  stream: MediaStream | null = null;
  isRecording = false;
  mediaRecorder: MediaRecorder | null = null;
  recordedChunks: Blob[] = [];

  // Set from query params when coming via topic-interview flow
  interviewTopic = 'general';
  interviewMode: 'chat' | 'audio' | 'video' | null = null;
  interviewTime = '';

  private isInitialized = false;
  
  // Timer State
  remainingSeconds = 300; // Default to 5 mins
  timerDisplay = '05:00';
  private timerInterval: any;
  isTimeLow = false;
  isEvaluating = false;

  questions: string[] = [];
  isLoading = true;
  error: string | null = null;

  currentQuestionIndex = 0;
  isSpeaking = false;
  private speechSynthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  // --- STT & Media Specific ---
  transcripts: string[] = [];
  mediaUrls: string[] = [];
  liveTranscript = '';
  private recognition: any;
  isUploading = false;

  // --- Chat Mode Specific ---
  chatMessages: { role: 'user' | 'assistant', content: string }[] = [];
  userChatMessage = '';
  isChatLoading = false;
  maxChatQuestions = 5;
  isRetry = false; // Track if current turn is a retry
  conversationHistory: any[] = []; // Store history for LangGraph context
  @ViewChild('chatScrollContainer') private chatScrollContainer!: ElementRef;

  get totalQuestions(): number {
    return this.interviewMode === 'chat' ? this.maxChatQuestions : this.questions.length;
  }

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      console.log('🔍 [Interview] Received Query Params:', params);
      if (params['topic']) this.interviewTopic = params['topic'];
      if (params['mode'])  this.interviewMode  = params['mode'] as 'chat' | 'audio' | 'video';
      if (params['time'])  this.interviewTime  = params['time'];

      if (!this.interviewMode) {
        console.warn('⚠️ [Interview] Navigated to active-interview with no mode, redirecting home.');
        this.router.navigate(['/']);
        return;
      }

      // Initialize remaining seconds and chat question limit
      if (this.interviewTime) {
        const mins = parseInt(this.interviewTime);
        this.remainingSeconds = mins * 60;
        this.updateTimerDisplay();

        // Map time to question count (Matching backend questions.js logic)
        if (mins <= 5) this.maxChatQuestions = 3;
        else if (mins <= 10) this.maxChatQuestions = 5;
        else if (mins <= 15) this.maxChatQuestions = 8;
        else if (mins <= 20) this.maxChatQuestions = 10;
        else this.maxChatQuestions = 12;
        
        console.log(`💬 [Chat] Time: ${mins}m, Max Questions: ${this.maxChatQuestions}`);
      }

      // Check if questions were passed via router state (Resume flow)
      const navigation = this.router.getCurrentNavigation();
      const stateQuestions = history.state?.questions;

      if (stateQuestions && Array.isArray(stateQuestions) && stateQuestions.length > 0) {
        console.log('📄 [Interview] Using resume-based questions from state:', stateQuestions);
        this.questions = stateQuestions;
        this.isLoading = false;
        this.isInitialized = true;
        
        if (this.interviewMode === 'chat') {
          this.initializeChat();
        } else if (this.interviewMode === 'audio' || this.interviewMode === 'video') {
          setTimeout(() => this.speakQuestion(), 800); // Slight delay for browser initialization
        }
        
        this.startTimer();
        this.cdr.detectChanges();
        return;
      }

      if (this.interviewMode === 'chat') {
        if (!this.isInitialized) {
          this.isInitialized = true;
          this.isLoading = false;
          this.initializeChat();
          this.startTimer();
        }
      } else {
        if (!this.isInitialized) {
          this.isInitialized = true;
          console.log(`🚀 [Interview] Starting fetch for topic: ${this.interviewTopic}`);
          this.fetchQuestions(this.interviewTopic);
          this.startTimer();
        }
      }
    });
  }

  // --- Timer Methods ---
  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    
    this.timerInterval = setInterval(() => {
      if (this.remainingSeconds > 0) {
        this.remainingSeconds--;
        this.updateTimerDisplay();
        
        // Status checks
        if (this.remainingSeconds <= 60) {
          this.isTimeLow = true;
        }

        this.cdr.detectChanges();
      } else {
        this.stopTimer();
        this.handleTimeUp();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  updateTimerDisplay() {
    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = this.remainingSeconds % 60;
    this.timerDisplay = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  handleTimeUp() {
    console.log('🕒 [Interview] Time is up!');
    // If not in chat mode, just end it. 
    // If in chat mode, the AI should have already concluded, but we'll safety end here.
    alert('Time is up! The interview is concluding.');
    this.endInterview();
  }

  fetchQuestions(topic: string) {
    this.isLoading = true;
    this.error = null;
    const url = `http://localhost:3000/api/questions?topic=${topic}&time=${this.interviewTime}`;
    
    console.log(`📡 [Interview] Calling API: ${url}`);
    
    this.http.get<{ topic: string, questions: string[] }>(url)
      .subscribe({
        next: (response) => {
          console.log('✅ [Interview] API Success. Received Questions:', response.questions);
          this.questions = response.questions;
          this.transcripts = new Array(this.questions.length).fill('');
          this.mediaUrls = new Array(this.questions.length).fill('');
          this.isLoading = false;
          this.cdr.detectChanges(); // Force UI to update
          
          // Auto-speak first question in audio/video mode
          if ((this.interviewMode === 'audio' || this.interviewMode === 'video') && this.questions.length > 0) {
            setTimeout(() => this.speakQuestion(), 500);
          }
          
          // Initialize STT if in audio/video mode
          if (this.interviewMode === 'audio' || this.interviewMode === 'video') {
            this.initSpeechRecognition();
          }
        },
        error: (err) => {
          console.error('❌ [Interview] API Error:', err);
          this.error = 'Failed to generate questions. Please try again.';
          this.isLoading = false;
          this.cdr.detectChanges(); // Force UI to update
          
          console.log('⚠️ [Interview] Reverting to fallback questions.');
          this.questions = [
            "Tell me about yourself and your background.",
            "What interests you about this specific topic?",
            "Can you describe a project where you used these skills?",
            "What are some common challenges in this field?",
            "Do you have any questions for us?"
          ];
        }
      });
  }

  ngOnDestroy() {
    this.stopCamera();
    this.stopTimer();
    this.stopSpeaking();
  }

  async startCamera() {
    try {
      const constraints = {
        video: this.interviewMode === 'video' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      console.log(`📡 [Media] Requesting stream with constraints:`, constraints);
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('Stream started:', this.stream);
      
      if (this.interviewMode === 'video' && this.videoElement) {
        this.videoElement.nativeElement.srcObject = this.stream;
        this.videoElement.nativeElement.muted = true; // Extra safety to prevent loopback
        this.videoElement.nativeElement.play();
        console.log('Stream assigned to video element (muted)');
      }
    } catch (err) {
      console.error('Error accessing media devices.', err);
      alert('Microphone/Camera access is required for the interview.');
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  async nextQuestion() {
    if (this.isChatLoading) return;

    if (this.isRecording) {
      await this.toggleRecording(); 
      // Give STT a moment to fire its final result and for recorded chunks to assemble
      this.isChatLoading = true; 
      setTimeout(() => this.processTurn(), 1000);
    } else {
      this.processTurn();
    }
  }

  async processTurn() {
    this.isChatLoading = true;
    this.cdr.detectChanges();

    const currentAnswer = this.liveTranscript || this.transcripts[this.currentQuestionIndex] || '';
    
    // Safety check: if answer is empty and we're not on the very first turn, maybe confirm?
    // But for now we'll just send it and let the graph handle the "missed" state.

    const payload = {
      topic: this.interviewTopic,
      questionIndex: this.currentQuestionIndex,
      allQuestions: this.questions,
      currentQuestion: this.questions[this.currentQuestionIndex] || '',
      userAnswer: currentAnswer,
      maxQuestions: this.maxChatQuestions,
      isRetry: this.isRetry,
      conversationHistory: this.conversationHistory
    };

    console.log(`[Interview] Turn Q${this.currentQuestionIndex + 1} | Answer: "${currentAnswer.substring(0, 30)}..." | History Len: ${this.conversationHistory.length}`);

    this.http.post<any>('http://localhost:3000/api/interviews/graph', payload)
      .subscribe({
        next: (res) => {
          console.log(`[Interview] Backend decided: ${res.nextAction} (Retry: ${res.isRetry})`);
          
          this.isRetry = res.isRetry;
          this.conversationHistory = res.conversationHistory || this.conversationHistory;
          
          if (res.nextAction === 'retry') {
            this.questions[this.currentQuestionIndex] = res.currentQuestion;
            this.liveTranscript = ''; 
          } else if (res.nextAction === 'next') {
            this.currentQuestionIndex = res.questionIndex;
            if (this.questions.length <= this.currentQuestionIndex) {
              this.questions.push(res.currentQuestion);
            } else {
              this.questions[this.currentQuestionIndex] = res.currentQuestion;
            }
            this.liveTranscript = '';
          } else if (res.nextAction === 'conclude' || res.nextAction === 'done') {
            this.endInterview();
            return;
          }

          this.isChatLoading = false;
          this.cdr.detectChanges();

          if (this.interviewMode === 'audio' || this.interviewMode === 'video') {
            this.speakQuestion();
          }
        },
        error: (err) => {
          console.error('[Interview] Turn failed:', err);
          this.isChatLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  prevQuestion() {
    // Save current live transcript before moving
    if (this.liveTranscript) {
      this.transcripts[this.currentQuestionIndex] = this.liveTranscript;
      this.liveTranscript = '';
    }

    if (this.currentQuestionIndex > 0) {
      if (this.isRecording) {
        this.toggleRecording(); // Stop and upload current question
      }
      this.currentQuestionIndex--;
      if (this.interviewMode === 'audio') {
        this.speakQuestion();
      }
    }
  }

  // --- TTS Methods ---
  speakQuestion() {
    const text = this.questions[this.currentQuestionIndex];
    if (text) {
      this.speakText(text);
    }
  }

  speakText(text: string) {
    this.stopSpeaking();

    if (!window.speechSynthesis) {
      console.warn('Speech synthesis not supported in this browser.');
      return;
    }

    this.currentUtterance = new SpeechSynthesisUtterance(text);
    
    // Optional: Pick a professional voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Microsoft David'));
    if (preferredVoice) {
      this.currentUtterance.voice = preferredVoice;
    }

    this.currentUtterance.rate = 0.95; // Slightly slower for clarity
    this.currentUtterance.pitch = 1.0;

    this.currentUtterance.onstart = () => {
      this.isSpeaking = true;
      this.cdr.detectChanges();
    };

    this.currentUtterance.onend = () => {
      this.isSpeaking = false;
      this.cdr.detectChanges();
    };

    this.currentUtterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      this.isSpeaking = false;
      this.cdr.detectChanges();
    };

    window.speechSynthesis.speak(this.currentUtterance);
  }

  stopSpeaking() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.cdr.detectChanges();
  }

  // --- STT Methods ---
  initSpeechRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      this.liveTranscript = (this.transcripts[this.currentQuestionIndex] || '') + finalTranscript + interimTranscript;
      this.cdr.detectChanges();
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        // Keep it running or restart if needed
      }
    };
  }

  async toggleRecording() {
    if (this.isRecording) {
      // Stop recording
      if (this.mediaRecorder) {
        this.mediaRecorder.stop();
      }
      if (this.recognition) {
        this.recognition.stop();
      }
      this.isRecording = false;
      // Note: Final transcript is handled via the recognition.onresult callback
      // and mediaRecorder.onstop callback. We'll add a small delay in the caller.
    } else {
      // Start camera first if not already started
      if (!this.stream) {
        await this.startCamera();
      }

      // Start recording
      if (!this.stream) return;

      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(this.stream);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const type = this.interviewMode === 'video' ? 'video/webm' : 'audio/webm';
        const blob = new Blob(this.recordedChunks, { type });
        console.log(`[Media] Recording finished, size: ${blob.size}. Uploading for Q${this.currentQuestionIndex + 1}...`);
        this.uploadRecording(blob, this.currentQuestionIndex);
      };

      this.mediaRecorder.start();
      
      if (this.recognition) {
        this.liveTranscript = this.transcripts[this.currentQuestionIndex] || '';
        this.recognition.start();
      }

      this.isRecording = true;
    }
  }

  uploadRecording(blob: Blob, index: number) {
    this.isUploading = true;
    const formData = new FormData();
    const extension = this.interviewMode === 'video' ? 'webm' : 'webm';
    formData.append('recording', blob, `q${index + 1}_${Date.now()}.${extension}`);

    this.http.post<{ filename: string }>('http://localhost:3000/api/upload', formData)
      .subscribe({
        next: (response) => {
          console.log(`✅ [Upload] Success for Q${index + 1}:`, response.filename);
          this.mediaUrls[index] = response.filename;
          this.isUploading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(`❌ [Upload] Failed for Q${index + 1}:`, err);
          this.isUploading = false;
          this.cdr.detectChanges();
        }
      });
  }

  endInterview() {
    this.stopTimer();
    this.stopCamera();
    this.stopSpeaking();
    if (this.recognition) this.recognition.stop();
    if (this.isRecording) this.toggleRecording(); // Ensure final upload
    
    if (this.isEvaluating) return;
    this.isEvaluating = true;
    this.cdr.detectChanges();

    console.log('🚀 [Interview] Closing session and starting evaluation...');

    // Format questions for backend: { questionText, transcript, mediaUrl }
    let formattedQuestions = [];

    if (this.interviewMode === 'chat') {
      // Robust extraction: Pair assistant questions with subsequent user answers
      for (let i = 0; i < this.chatMessages.length; i++) {
        if (this.chatMessages[i].role === 'assistant') {
          const qText = this.chatMessages[i].content;
          
          // Skip very short messages or concluding remarks
          if (qText.length < 15 || qText.toLowerCase().includes('conclude') || qText.toLowerCase().includes('thank you')) continue;

          let answer = 'No response provided';
          // The very next message should be the user's answer
          if (this.chatMessages[i + 1] && this.chatMessages[i + 1].role === 'user') {
            answer = this.chatMessages[i + 1].content;
          }

          formattedQuestions.push({
            questionText: qText,
            transcript: answer,
            mediaUrl: null
          });
        }
      }
    } else {
      formattedQuestions = this.questions.map((q, i) => ({
        questionText: q,
        transcript: this.transcripts[i] || this.liveTranscript || 'No response provided',
        mediaUrl: this.mediaUrls[i] || null
      }));
    }

    const payload = {
      topic: this.interviewTopic,
      mode: this.interviewMode,
      questions: formattedQuestions
    };

    this.http.post<any>('http://localhost:3000/api/interviews/evaluate', payload)
      .subscribe({
        next: (savedInterview) => {
          console.log('✅ [Interview] Saved & Evaluated:', savedInterview._id);
          this.router.navigate(['/interview-result', savedInterview._id]);
        },
        error: (err) => {
          console.error('❌ [Interview] Evaluation failed:', err);
          this.isEvaluating = false;
          alert('Failed to evaluate. Redirecting to home.');
          this.router.navigate(['/topic-select']);
        }
      });
  }

  // --- Chat Methods ---
  async initializeChat() {
    this.isChatLoading = true;
    this.cdr.detectChanges();

    const payload = {
      topic: this.interviewTopic,
      questionIndex: 0,
      allQuestions: this.questions,
      currentQuestion: '',
      userAnswer: '', // First turn
      maxQuestions: this.maxChatQuestions,
      isRetry: false,
      conversationHistory: []
    };

    this.http.post<any>('http://localhost:3000/api/interviews/graph', payload)
      .subscribe({
        next: (res) => {
           this.chatMessages.push({ role: 'assistant', content: res.currentQuestion });
           this.questions[0] = res.currentQuestion;
           this.currentQuestionIndex = 0; // Explicitly set starting index
           this.conversationHistory = res.conversationHistory || [];
           this.isChatLoading = false;
           this.cdr.detectChanges();
           this.scrollToBottom();
        },
        error: (err) => {
          console.error('Initial chat error:', err);
          this.isChatLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  async sendChatMessage() {
    if (!this.userChatMessage.trim() || this.isChatLoading) return;

    const userMsg = this.userChatMessage.trim();
    this.chatMessages.push({ role: 'user', content: userMsg });
    this.userChatMessage = '';
    this.isChatLoading = true;
    this.scrollToBottom();

    const lastAssistantMessage = [...this.chatMessages].reverse().find(m => m.role === 'assistant')?.content || '';

    const payload = {
      topic: this.interviewTopic,
      questionIndex: this.currentQuestionIndex,
      allQuestions: this.questions,
      currentQuestion: lastAssistantMessage || this.questions[this.currentQuestionIndex] || '',
      userAnswer: userMsg,
      maxQuestions: this.maxChatQuestions,
      isRetry: this.isRetry,
      conversationHistory: this.conversationHistory
    };

    this.http.post<any>('http://localhost:3000/api/interviews/graph', payload)
      .subscribe({
        next: (res) => {
          this.isRetry = res.isRetry;
          this.currentQuestionIndex = res.questionIndex;
          this.conversationHistory = res.conversationHistory || this.conversationHistory;
          
           if (res.nextAction === 'conclude' || res.nextAction === 'done') {
             this.chatMessages.push({ role: 'assistant', content: res.conclusion });
             this.isChatLoading = true; // Stay in loading state to disable input
             this.cdr.detectChanges();
             this.scrollToBottom();
             setTimeout(() => this.endInterview(), 3000);
             return; // Stop processing further
           } else {
            this.chatMessages.push({ role: 'assistant', content: res.currentQuestion });
            this.questions[this.currentQuestionIndex] = res.currentQuestion; // Track for graph
          }
          
          this.isChatLoading = false;
          this.cdr.detectChanges();
          this.scrollToBottom();
        },
        error: (err) => {
          console.error('Chat error:', err);
          this.isChatLoading = false;
          this.chatMessages.push({ role: 'assistant', content: "I'm sorry, I encountered an error. Please try again." });
          this.cdr.detectChanges();
        }
      });
  }

  private async fetchStream(messages: any[], isInitial = false) {
    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: this.interviewTopic,
          messages: messages
        })
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let assistantMsg = { role: 'assistant' as const, content: '' };
      this.chatMessages.push(assistantMsg);
      this.isChatLoading = false; 

      let lineBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        lineBuffer += chunk;

        const lines = lineBuffer.split('\n');
        // Keep the last partial line in the buffer
        lineBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') break;

          try {
            const data = JSON.parse(dataStr);
            if (data.token) {
              assistantMsg.content += data.token;
              this.cdr.detectChanges();
              this.scrollToBottom();
            }
          } catch (e) {
            // Partial JSON within an SSE line? Buffer it.
            lineBuffer = line + lineBuffer; 
          }
        }
      }

      // After streaming is done, we don't conclude immediately.
      // We wait for the user to answer this question.
      // EXCEPT if this is the initial greeting, which doesn't count as a "question".

    } catch (err) {
      console.error('Streaming Error:', err);
      this.chatMessages.push({ role: 'assistant', content: "I'm sorry, I encountered an error. Please try again." });
      this.isChatLoading = false;
      this.cdr.detectChanges();
    } finally {
      this.isChatLoading = false;
      this.cdr.detectChanges();
    }
  }

  scrollToBottom() {
    setTimeout(() => {
      if (this.chatScrollContainer) {
        this.chatScrollContainer.nativeElement.scrollTop = this.chatScrollContainer.nativeElement.scrollHeight;
      }
    }, 100);
  }
}
