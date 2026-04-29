import { Routes } from '@angular/router';
import { WelcomeComponent } from './welcome/welcome';
import { TopicSelectComponent } from './topic-select/topic-select';
import { TopicInterviewComponent } from './topic-interview/topic-interview';
import { ResumeInterviewComponent } from './resume-interview/resume-interview';
import { ActiveInterviewComponent } from './active-interview/active-interview';
import { InterviewResultComponent } from './interview-result/interview-result';

export const routes: Routes = [
  { path: '', redirectTo: 'welcome', pathMatch: 'full' },
  { path: 'welcome', component: WelcomeComponent },
  { path: 'topic-select', component: TopicSelectComponent },
  { path: 'topic-interview', component: TopicInterviewComponent },
  { path: 'resume-interview', component: ResumeInterviewComponent },
  { path: 'active-interview', component: ActiveInterviewComponent },
  { path: 'interview-result/:id', component: InterviewResultComponent },
];

