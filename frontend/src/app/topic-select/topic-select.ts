import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-topic-select',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './topic-select.html',
  styleUrl: './topic-select.css',
})
export class TopicSelectComponent {}
