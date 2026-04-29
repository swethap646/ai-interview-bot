import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// Compact SVG stand-ins for various requested technologies
const SVGS: Record<string, string> = {
  python: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/></svg>`,
  java: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>`,
  c: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M14 9a3 3 0 1 0 0 6"/></svg>`,
  cpp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M10 9a3 3 0 1 0 0 6"/><path d="M14 10v4"/><path d="M12 12h4"/><path d="M19 10v4"/><path d="M17 12h4"/></svg>`,
  sql: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>`,
  mongodb: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8 6 6 10 6 14c0 4.418 3 8 6 8s6-3.582 6-8c0-4-2-8-6-12Z"/></svg>`,
  postgres: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1v12z"/><path d="M4 22v-7"/></svg>`,
  redis: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  mysql: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="7" rx="8" ry="4"/><path d="M4 11v6c0 2.2 3.6 4 8 4s8-1.8 8-4v-6"/><path d="M4 11c0 2.2 3.6 4 8 4s8-1.8 8-4"/></svg>`,
  microservices: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  scalability: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/></svg>`,
  caching: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M6 12h.01"/><path d="M10 12h.01"/><path d="M6 16h.01"/><path d="M10 16h.01"/></svg>`,
  api: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m8 10 4-4 4 4"/><path d="M12 6v12"/><path d="m8 14 4 4 4-4"/></svg>`,
  loadbalancer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22V2"/><path d="m5 10-3 3 3 3"/><path d="m19 10 3 3-3 3"/></svg>`,
  react: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(45 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(135 12 12)"/><circle cx="12" cy="12" r="2"/></svg>`,
  angular: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 2 9 4v6c0 5.5-4 10-9 10S3 17.5 3 12V6z"/><path d="M12 8l4 6H8z"/></svg>`,
  node: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l10 5v10l-10 5-10-5V7z"/><path d="M12 22V12"/><path d="m22 7-10 5"/><path d="m2 7 10 5"/></svg>`,
  html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  vue: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20L2 4h4l6 10 6-10h4z"/><path d="M12 15L7 7h4l1 2 1-2h4z"/></svg>`,
  coreMech: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  coreCivil: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 14h.01"/></svg>`,
  coreElec: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>`,
  coreEce: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3"/><path d="M15 1v3"/><path d="M9 20v3"/><path d="M15 20v3"/><path d="M20 9h3"/><path d="M20 14h3"/><path d="M1 9h3"/><path d="M1 14h3"/></svg>`,
  go: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>`
};

interface Subtopic {
  id: string;
  label: string;
  iconColor: string;
  safeIcon?: SafeHtml;
  rawSvgName: string;
}

interface TopicGroup {
  name: string;
  items: Subtopic[];
}

interface Domain {
  id: string;
  label: string;
  icon: string;
  groups: TopicGroup[];
}

interface Mode {
  id: string;
  label: string;
  icon: string;
  badge: string;
}

@Component({
  selector: 'app-topic-interview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './topic-interview.html',
  styleUrl: './topic-interview.css'
})
export class TopicInterviewComponent implements OnInit {
  selectedDomain: Domain | null = null;
  selectedSubtopic: Subtopic | null = null;
  selectedMode: Mode | null = null;
  selectedTime: number | null = null;

  times: number[] = [5, 10, 15, 20, 25];

  domains: Domain[] = [
    {
      id: 'it',
      label: 'IT',
      icon: '💻',
      groups: [
        {
          name: 'Programming',
          items: [
            { id: 'python', label: 'Python', iconColor: '#3776AB', rawSvgName: 'python' },
            { id: 'java', label: 'Java', iconColor: '#b07219', rawSvgName: 'java' },
            { id: 'c', label: 'C', iconColor: '#555555', rawSvgName: 'c' },
            { id: 'cpp', label: 'C++', iconColor: '#f34b7d', rawSvgName: 'cpp' },
            { id: 'go', label: 'Go', iconColor: '#00ADD8', rawSvgName: 'go' }
          ]
        },
        {
          name: 'Database',
          items: [
            { id: 'sql', label: 'SQL', iconColor: '#336791', rawSvgName: 'sql' },
            { id: 'mongodb', label: 'MongoDB', iconColor: '#47A248', rawSvgName: 'mongodb' },
            { id: 'postgres', label: 'PostgreSQL', iconColor: '#336791', rawSvgName: 'postgres' },
            { id: 'redis', label: 'Redis', iconColor: '#DC382D', rawSvgName: 'redis' },
            { id: 'mysql', label: 'MySQL', iconColor: '#4479A1', rawSvgName: 'mysql' }
          ]
        },

        {
          name: 'Web Development',
          items: [
            { id: 'react', label: 'React', iconColor: '#61DAFB', rawSvgName: 'react' },
            { id: 'angular', label: 'Angular', iconColor: '#DD0031', rawSvgName: 'angular' },
            { id: 'node', label: 'Node.js', iconColor: '#339933', rawSvgName: 'node' },
            { id: 'html', label: 'HTML/CSS', iconColor: '#E34F26', rawSvgName: 'html' },
            { id: 'vue', label: 'Vue.js', iconColor: '#4fc08d', rawSvgName: 'vue' }
          ]
        }
      ]
    },
    {
      id: 'core',
      label: 'Core',
      icon: '⚙️',
      groups: [
        {
          name: 'Core Subjects',
          items: [
            { id: 'mechanical', label: 'Mechanical', iconColor: '#9d50bb', rawSvgName: 'coreMech' },
            { id: 'civil', label: 'Civil', iconColor: '#9d50bb', rawSvgName: 'coreCivil' },
            { id: 'electrical', label: 'Electrical', iconColor: '#9d50bb', rawSvgName: 'coreElec' },
            { id: 'electronics', label: 'ECE', iconColor: '#9d50bb', rawSvgName: 'coreEce' }
          ]
        }
      ]
    }
  ];

  modes: Mode[] = [
    { id: 'chat', label: 'Chat Mode', icon: '💬', badge: 'Flexible' },
    { id: 'audio', label: 'Audio Mode', icon: '🎙️', badge: 'Fluency' },
    { id: 'video', label: 'Video Mode', icon: '🎥', badge: 'Realistic' }
  ];

  constructor(private router: Router, private sanitizer: DomSanitizer) {}

  ngOnInit() {
    this.domains.forEach(domain => {
      domain.groups.forEach(group => {
        group.items.forEach(item => {
          if (SVGS[item.rawSvgName]) {
            item.safeIcon = this.sanitizer.bypassSecurityTrustHtml(SVGS[item.rawSvgName]);
          }
        });
      });
    });
  }

  selectDomain(domain: Domain) {
    if (this.selectedDomain?.id === domain.id) return;
    this.selectedDomain = domain;
    this.selectedSubtopic = null;
  }

  selectSubtopic(subtopic: Subtopic) {
    this.selectedSubtopic = subtopic;
  }

  selectMode(mode: Mode) {
    this.selectedMode = mode;
  }

  selectTime(time: number) {
    this.selectedTime = time;
  }

  get isFormValid(): boolean {
    return !!(this.selectedDomain && this.selectedSubtopic && this.selectedMode && this.selectedTime);
  }

  startInterview() {
    if (!this.isFormValid) return;
    this.router.navigate(['/active-interview'], {
      queryParams: {
        topic: this.selectedSubtopic!.id,
        mode: this.selectedMode!.id,
        time: this.selectedTime!.toString()
      }
    });
  }
}
