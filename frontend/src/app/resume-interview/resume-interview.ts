import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-resume-interview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './resume-interview.html',
  styleUrl: './resume-interview.css',
})
export class ResumeInterviewComponent {
  selectedFile: File | null = null;
  selectedTime: string = '15';
  isUploading = false;
  error: string | null = null;

  constructor(private router: Router, private http: HttpClient) {}

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      this.selectedFile = file;
      this.error = null;
    } else {
      this.error = 'Please select a valid PDF file.';
      this.selectedFile = null;
    }
  }

  selectTime(time: string) {
    this.selectedTime = time;
  }

  async startResumeInterview(mode: 'audio' | 'video' | 'chat') {
    if (!this.selectedFile) {
      this.error = 'Please upload your resume before starting.';
      return;
    }

    this.isUploading = true;
    this.error = null;

    const formData = new FormData();
    formData.append('resume', this.selectedFile);
    formData.append('time', this.selectedTime);

    console.log(`[Resume] Uploading resume and generating questions for ${mode} mode...`);

    this.http.post<any>('http://localhost:3000/api/questions/resume', formData)
      .subscribe({
        next: (response) => {
          console.log('✅ [Resume] Analysis Complete. Questions:', response.questions);
          this.isUploading = false;
          
          // Navigate to active interview with the generated questions in state
          this.router.navigate(['/active-interview'], {
            queryParams: {
              topic: response.topic,
              mode: mode,
              time: this.selectedTime
            },
            state: {
              questions: response.questions
            }
          });
        },
        error: (err) => {
          console.error('❌ [Resume] Upload Error:', err);
          // Show the specific error message from the backend if available
          this.error = err?.error?.error || 'Failed to analyze resume. Please try again.';
          this.isUploading = false;
        }
      });
  }

  openSystemCheckDialog() {
    this.router.navigate(['/active-interview']);
  }
}
