import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ShortLink, LinksApiService } from './links-api.service';

const httpUrlValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname
      ? null
      : { httpUrl: true };
  } catch {
    return { httpUrl: true };
  }
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  readonly urlControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, httpUrlValidator]
  });
  readonly form = new FormGroup({ url: this.urlControl });

  readonly links = signal<ShortLink[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly linksError = signal('');
  readonly submitError = signal('');
  readonly createdLink = signal<ShortLink | null>(null);

  constructor(private readonly linksApi: LinksApiService) {}

  ngOnInit(): void {
    this.refreshLinks();
  }

  createLink(): void {
    this.submitError.set('');
    this.createdLink.set(null);

    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.linksApi.createLink(this.urlControl.value.trim()).subscribe({
      next: (link) => {
        this.createdLink.set(link);
        this.urlControl.reset();
        this.submitting.set(false);
        this.refreshLinks();
      },
      error: (error: unknown) => {
        this.submitError.set(this.getErrorMessage(error));
        this.submitting.set(false);
      }
    });
  }

  private refreshLinks(): void {
    this.loading.set(true);
    this.linksError.set('');

    this.linksApi.getLinks().subscribe({
      next: (links) => {
        this.links.set(links);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.linksError.set(this.getErrorMessage(error));
        this.loading.set(false);
      }
    });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Could not reach the Snip API. Check that the backend is running and try again.';
      }

      const body: unknown = error.error;
      if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
        return body.error;
      }

      return `The Snip API returned an error (${error.status}). Please try again.`;
    }

    return 'Something went wrong. Please try again.';
  }
}
