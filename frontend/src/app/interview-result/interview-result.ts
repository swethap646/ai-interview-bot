import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
@Component({
  selector: 'app-interview-result',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './interview-result.html',
  styleUrl: './interview-result.css'
})
export class InterviewResultComponent implements OnInit {
  interviewId: string | null = null;
  interviewData: any = null;
  isLoading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.interviewId = this.route.snapshot.paramMap.get('id');
    if (this.interviewId) {
      this.fetchResult();
    } else {
      this.error = 'No interview ID found.';
      this.isLoading = false;
    }
  }

  fetchResult() {
    this.isLoading = true;
    console.log(`📡 [Result] Fetching data for: ${this.interviewId}`);
    
    this.http.get(`http://localhost:3000/api/interviews/${this.interviewId}`)
      .subscribe({
        next: (data) => {
          console.log('✅ [Result] Data received:', data);
          this.interviewData = data;
          // Use a small timeout to ensure Angular's change detection catches the update
          setTimeout(() => {
            this.isLoading = false;
            this.cdr.detectChanges(); // Manually trigger refresh
          }, 500);
        },
        error: (err) => {
          console.error('❌ [Result] Error fetching result:', err);
          this.error = 'Failed to load results. Please try again.';
          this.isLoading = false;
          this.cdr.detectChanges(); // Manually trigger refresh
        }
      });
  }

  getScoreColor(): string {
    const score = this.interviewData?.score || 0;
    if (score >= 8) return '#00f2fe'; // Cyan-ish
    if (score >= 5) return '#f9d423'; // Yellow
    return '#ff4b2b'; // Red
  }

  getScoreDashoffset(): number {
    const score = this.interviewData?.score || 0;
    const circumference = 2 * Math.PI * 45; // r=45
    return circumference - (score / 10) * circumference;
  }

  getMetricWidth(value: number): string {
    return `${(value / 10) * 100}%`;
  }

  getMetricClass(value: number): string {
    if (value >= 8) return 'high';
    if (value >= 5) return 'med';
    return 'low';
  }
}
