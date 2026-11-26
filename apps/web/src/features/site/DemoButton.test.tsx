import { fireEvent, render, screen } from '@testing-library/react';
import { Intl } from '../../test/intl';
import { DemoButton, captionsUrl, embedUrl } from './DemoButton';

describe('DemoButton', () => {
  it('shows nothing without a video link', () => {
    const { container } = render(
      <Intl>
        <DemoButton url="" />
      </Intl>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('turns YouTube links into embed links and leaves files alone', () => {
    expect(embedUrl('https://www.youtube.com/watch?v=abc123XYZ')).toBe(
      'https://www.youtube-nocookie.com/embed/abc123XYZ?autoplay=1',
    );
    expect(embedUrl('https://youtu.be/abc123XYZ')).toContain('/embed/abc123XYZ');
    expect(embedUrl('/site/demo.mp4')).toBeNull();
    expect(captionsUrl('/site/demo.mp4')).toBe('/site/demo.vtt');
  });

  it('opens the YouTube player in a pop-up and closes with Escape', () => {
    render(
      <Intl>
        <DemoButton url="https://youtu.be/abc123XYZ" />
      </Intl>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Watch the 2-min demo/ }));
    expect(screen.getByTitle('Job Search Hunter demo video')).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/abc123XYZ?autoplay=1',
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('plays a video file and closes with the Close button', () => {
    render(
      <Intl locale="de">
        <DemoButton url="/site/demo.mp4" />
      </Intl>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Demo ansehen/ }));
    expect(
      screen.getByLabelText('Demo-Video von Job Search Hunter', { selector: 'video' }),
    ).toHaveAttribute('src', '/site/demo.mp4');
    const closers = screen.getAllByRole('button', { name: 'Schließen' });
    expect(closers[1]).toHaveFocus();
    fireEvent.click(closers[1]!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
