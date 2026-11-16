import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { ShortLink } from './links-api.service';

const apiUrl = 'http://localhost:3000/api/links';

describe('AppComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  function createLoadedFixture(): ComponentFixture<AppComponent> {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    httpTesting.expectOne(apiUrl).flush([]);
    fixture.detectChanges();
    return fixture;
  }

  it('validates HTTP and HTTPS URLs', () => {
    const fixture = createLoadedFixture();
    const control = fixture.componentInstance.urlControl;

    control.setValue('ftp://example.com');
    expect(control.invalid).toBeTrue();

    control.setValue('https://example.com/path');
    expect(control.valid).toBeTrue();
  });

  it('creates a link and refreshes the table', () => {
    const fixture = createLoadedFixture();
    const link: ShortLink = {
      code: 'abc123',
      url: 'https://example.com/path',
      shortUrl: 'http://localhost:3000/abc123',
      hits: 0,
      createdAt: '2026-11-16T00:00:00.000Z'
    };

    fixture.componentInstance.urlControl.setValue(link.url);
    fixture.componentInstance.createLink();
    httpTesting.expectOne({ method: 'POST', url: apiUrl }).flush(link);
    httpTesting.expectOne(apiUrl).flush([link]);
    fixture.detectChanges();

    expect(fixture.componentInstance.createdLink()).toEqual(link);
    expect(fixture.nativeElement.textContent).toContain(link.shortUrl);
    expect(fixture.nativeElement.textContent).toContain(link.url);
    expect(fixture.nativeElement.textContent).toContain('0');
  });

  it('shows API errors inline', () => {
    const fixture = createLoadedFixture();
    fixture.componentInstance.urlControl.setValue('https://example.com');
    fixture.componentInstance.createLink();

    httpTesting.expectOne({ method: 'POST', url: apiUrl }).flush(
      { error: 'The URL could not be shortened.' },
      { status: 400, statusText: 'Bad Request' }
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('The URL could not be shortened.');
  });
});
