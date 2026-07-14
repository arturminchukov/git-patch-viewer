// Shown from document_start: hides the raw patch text and displays a spinner
// while the (possibly large) patch loads and parses, so the user never sees a
// flash of unstyled text before the rendered UI appears.

export function showLoader(): () => void {
  const dark =
    typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

  const style = document.createElement('style');
  style.textContent =
    'body{display:none!important}@keyframes gpv-spin{to{transform:rotate(360deg)}}';

  const overlay = document.createElement('div');
  overlay.id = 'gpv-loader';
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:2147483647',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'gap:10px',
    `background:${dark ? '#0d1117' : '#ffffff'}`,
    `color:${dark ? '#8b949e' : '#656d76'}`,
    'font:600 14px -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif',
  ].join(';');

  const spinner = document.createElement('div');
  spinner.style.cssText = [
    'width:16px',
    'height:16px',
    'border:2px solid currentColor',
    'border-right-color:transparent',
    'border-radius:50%',
    'animation:gpv-spin .7s linear infinite',
  ].join(';');

  overlay.append(spinner, document.createTextNode('Parsing patch…'));
  document.documentElement.append(style, overlay);

  // Idempotent: safe to call more than once.
  return () => {
    style.remove();
    overlay.remove();
  };
}
